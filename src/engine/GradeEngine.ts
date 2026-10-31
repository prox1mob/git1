import { mat3ToGl, type Vec3 } from '../lib/color';
import { VERT } from './glsl/common';
import { gradeFrag, haloFrag, imageFrag, sourceFrag } from './glsl/grade';
import { SCENE_SOURCES } from './glsl/scenes';
import {
  bakeCurve, captureMatrix, colorActive, contrastFactor, curvesActive, defaultParams, defaultView, gainVec, gammaVec, kneeFor, liftVec, wbMatrix,
  type CaptureSpec, type GradeParams, type SourceSpec, type ViewSpec,
} from './params';
import { CARD_RECT, CHART_RECT } from './scenes';

/** Top-down RGBA8 pixels, display-encoded (sRGB). */
export interface Frame { data: Uint8Array; width: number; height: number }

interface Program { prog: WebGLProgram; locs: Map<string, WebGLUniformLocation | null> }
interface Target { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }

export class EngineError extends Error {}

export function webgl2Available(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/**
 * Real-time image engine. Three passes:
 *  1. source  → scene-linear float texture (procedural scene, photo or video + capture problem)
 *  2. halo    → thresholded, blurred highlights (only when halation is used)
 *  3. grade   → the full documented pipeline, to the canvas or to a small analysis buffer for scopes.
 */
export class GradeEngine {
  readonly gl: WebGL2RenderingContext;
  readonly floatTargets: boolean;
  private vao: WebGLVertexArrayObject;
  private programs = new Map<string, Program>();
  private src: Target | null = null;
  private haloA: Target | null = null;
  private haloB: Target | null = null;
  private analysis: Target | null = null;
  private curveTex: WebGLTexture;
  private mediaTex: WebGLTexture | null = null;
  private mediaKey = '';
  private curvesKey = '';
  private srcDirty = true;
  private haloDirty = true;
  private lost = false;

  source: SourceSpec = { kind: 'scene', scene: 'coast' };
  capture: CaptureSpec = {};
  params: GradeParams = defaultParams();
  view: ViewSpec = defaultView();
  time = 0;
  width = 0;
  height = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new EngineError('WebGL2 is not available');
    this.gl = gl;
    this.floatTargets = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;
    this.curveTex = gl.createTexture()!;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
  }

  get contextLost() { return this.lost || this.gl.isContextLost(); }

  // ------------------------------------------------------------ programs

  private program(key: string, frag: string): Program {
    const cached = this.programs.get(key);
    if (cached) return cached;
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        console.error(log, src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
        throw new EngineError('Shader compile failed: ' + log);
      }
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new EngineError('Program link failed: ' + gl.getProgramInfoLog(prog));
    const p = { prog, locs: new Map() };
    this.programs.set(key, p);
    return p;
  }

  private loc(p: Program, name: string) {
    if (!p.locs.has(name)) p.locs.set(name, this.gl.getUniformLocation(p.prog, name));
    return p.locs.get(name)!;
  }
  private u1f(p: Program, n: string, v: number) { this.gl.uniform1f(this.loc(p, n), v); }
  private u1i(p: Program, n: string, v: number) { this.gl.uniform1i(this.loc(p, n), v); }
  private u2f(p: Program, n: string, a: number, b: number) { this.gl.uniform2f(this.loc(p, n), a, b); }
  private u3f(p: Program, n: string, v: ArrayLike<number>) { this.gl.uniform3f(this.loc(p, n), v[0], v[1], v[2]); }
  private u4f(p: Program, n: string, v: ArrayLike<number>) { this.gl.uniform4f(this.loc(p, n), v[0], v[1], v[2], v[3]); }

  // ------------------------------------------------------------ targets

  private target(t: Target | null, w: number, h: number, float: boolean): Target {
    const gl = this.gl;
    if (t && t.w === w && t.h === h) return t;
    if (t) { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fbo, tex, w, h };
  }

  // ------------------------------------------------------------ state

  setSize(w: number, h: number) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.srcDirty = true;
    this.haloDirty = true;
  }
  setSource(s: SourceSpec) { this.source = s; this.srcDirty = true; this.haloDirty = true; }
  setCapture(c: CaptureSpec) { this.capture = c; this.srcDirty = true; this.haloDirty = true; }
  setTime(t: number) { if (t !== this.time) { this.time = t; this.srcDirty = true; this.haloDirty = true; } }
  setParams(p: GradeParams) {
    const prev = this.params;
    this.params = p;
    if (prev.temp !== p.temp || prev.tint !== p.tint || prev.exposure !== p.exposure) this.haloDirty = true;
  }
  setView(v: ViewSpec) { this.view = v; }
  /** Video frames change underneath us: call before render while playing. */
  markSourceDirty() { this.srcDirty = true; this.haloDirty = true; }

  // ------------------------------------------------------------ passes

  private draw() { this.gl.bindVertexArray(this.vao); this.gl.drawArrays(this.gl.TRIANGLES, 0, 3); }

  private uploadMedia() {
    const s = this.source;
    if (s.kind === 'scene') return;
    const gl = this.gl;
    if (!this.mediaTex) this.mediaTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.mediaTex);
    if (s.kind === 'video' || this.mediaKey !== s.key) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, s.kind === 'video' ? s.video : s.image);
      } catch (e) {
        console.warn('Could not upload media', e);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.mediaKey = s.kind === 'image' ? s.key : '';
    }
  }

  private renderSource(target: Target, maskMode = false) {
    const gl = this.gl;
    const s = this.source;
    const p = s.kind === 'scene' ? this.program('scene:' + s.scene, sourceFrag(SCENE_SOURCES[s.scene])) : this.program('image', imageFrag);
    gl.useProgram(p.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.w, target.h);
    this.u2f(p, 'u_res', target.w, target.h);
    this.u1f(p, 'u_time', this.time);
    if (s.kind === 'scene') {
      this.u1f(p, 'u_variant', s.variant ?? 0);
      this.u4f(p, 'u_sp', s.params ?? [0, 0, 0, 0]);
      this.u3f(p, 'u_frame', s.frame ?? [0, 0, 1]);
      if (s.scene === 'stilllife') {
        this.u4f(p, 'u_chart', CHART_RECT);
        this.u4f(p, 'u_card', CARD_RECT);
      }
    } else {
      this.uploadMedia();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.mediaTex);
      this.u1i(p, 'u_img', 0);
      this.u3f(p, 'u_frame', [0, 0, 1]);
    }
    const c = this.capture;
    gl.uniformMatrix3fv(this.loc(p, 'u_inMat'), false, mat3ToGl(captureMatrix(c)));
    this.u1f(p, 'u_inExp', Math.pow(2, c.exposure ?? 0));
    this.u1f(p, 'u_clip', c.clip ?? 60000);
    this.u1f(p, 'u_noise', c.noise ?? 0);
    this.u1f(p, 'u_seed', Math.floor(this.time * 24) % 97);
    this.u1i(p, 'u_pack', !this.floatTargets && !maskMode ? 1 : 0);
    this.u1i(p, 'u_maskMode', maskMode ? 1 : 0);
    this.draw();
  }

  private renderHalo() {
    const gl = this.gl;
    if (!this.src) return;
    const w = Math.max(8, Math.round(this.width / 4)), h = Math.max(8, Math.round(this.height / 4));
    this.haloA = this.target(this.haloA, w, h, this.floatTargets);
    this.haloB = this.target(this.haloB, w, h, this.floatTargets);
    const p = this.program('halo', haloFrag);
    gl.useProgram(p.prog);
    gl.activeTexture(gl.TEXTURE0);
    this.u1i(p, 'u_tex', 0);
    // stage 0: threshold
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.haloA.fbo);
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.src.tex);
    this.u1i(p, 'u_stage', 0);
    this.u1i(p, 'u_pack', this.floatTargets ? 0 : 1);
    this.u2f(p, 'u_texel', 1 / this.src.w, 1 / this.src.h);
    gl.uniformMatrix3fv(this.loc(p, 'u_wb'), false, mat3ToGl(wbMatrix(this.params)));
    this.u1f(p, 'u_exposure', Math.pow(2, this.params.exposure));
    this.u1f(p, 'u_thresh', 0.9);
    this.draw();
    // stage 1: separable blur, twice for a wide glow
    this.u1i(p, 'u_stage', 1);
    this.u1i(p, 'u_pack', 0);
    this.u2f(p, 'u_texel', 1 / w, 1 / h);
    for (let k = 0; k < 2; k++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.haloB.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.haloA.tex);
      this.u2f(p, 'u_dir', 1, 0);
      this.draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.haloA.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.haloB.tex);
      this.u2f(p, 'u_dir', 0, 1);
      this.draw();
    }
    this.haloDirty = false;
  }

  private ensureCurves(p: GradeParams) {
    const key = JSON.stringify(p.curves);
    if (key === this.curvesKey) return;
    this.curvesKey = key;
    const r = bakeCurve(p.curves.r), g = bakeCurve(p.curves.g), b = bakeCurve(p.curves.b), m = bakeCurve(p.curves.master);
    const data = new Float32Array(1024 * 4);
    for (let i = 0; i < 1024; i++) { data[i * 4] = r[i]; data[i * 4 + 1] = g[i]; data[i * 4 + 2] = b[i]; data[i * 4 + 3] = m[i]; }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1024, 1, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  private renderGrade(target: Target | null, params: GradeParams, view: ViewSpec) {
    const gl = this.gl;
    const p = this.program('grade', gradeFrag);
    gl.useProgram(p.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : this.width, target ? target.h : this.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.src!.tex);
    this.u1i(p, 'u_src', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.haloA?.tex ?? this.src!.tex);
    this.u1i(p, 'u_halo', 1);
    this.ensureCurves(params);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    this.u1i(p, 'u_curves', 2);
    gl.activeTexture(gl.TEXTURE0);

    this.u1i(p, 'u_pack', this.floatTargets ? 0 : 1);
    this.u1f(p, 'u_aspect', this.width / Math.max(1, this.height));
    this.u1i(p, 'u_mode', view.mode === 'graded' ? 0 : view.mode === 'before' ? 1 : 2);
    this.u1f(p, 'u_split', view.split);
    this.u1i(p, 'u_clipWarn', view.clipWarn && !target ? 1 : 0);
    this.u1i(p, 'u_showLost', view.showLost && !target ? 1 : 0);
    const log = view.signal?.log;
    this.u1i(p, 'u_logOn', log ? 1 : 0);
    this.u1i(p, 'u_logSrc', log?.src ?? 0);
    this.u1i(p, 'u_logDst', log?.dst ?? 0);
    this.u1i(p, 'u_logView', log?.viewRaw ? 1 : 0);
    this.u1i(p, 'u_debugTransfer', view.signal?.debugTransfer ?? 0);

    gl.uniformMatrix3fv(this.loc(p, 'u_wb'), false, mat3ToGl(wbMatrix(params)));
    this.u1f(p, 'u_exposure', Math.pow(2, params.exposure));
    this.u1f(p, 'u_contrast', contrastFactor(params.contrast));
    this.u1f(p, 'u_hl', params.highlights * 1.5);
    this.u1f(p, 'u_sh', params.shadows * 1.6);
    this.u1f(p, 'u_knee', kneeFor(params.rolloff));
    this.u1f(p, 'u_beforeKnee', kneeFor(this.beforeRolloff ?? params.rolloff));
    this.u1f(p, 'u_whites', params.whites);
    this.u1f(p, 'u_blacks', params.blacks);
    this.u1f(p, 'u_gammaPow', 1 / Math.max(0.05, params.gamma));
    this.u3f(p, 'u_lift', liftVec(params.lift));
    this.u3f(p, 'u_gainV', gainVec(params.gain));
    this.u3f(p, 'u_gammaV', gammaVec(params.gammaW));
    this.u1i(p, 'u_curvesOn', curvesActive(params.curves) ? 1 : 0);
    this.u1i(p, 'u_colorOn', colorActive(params) ? 1 : 0);
    gl.uniform3fv(this.loc(p, 'u_hsl'), new Float32Array(params.hsl.flatMap((b) => [b.h, b.s, b.l])));
    this.u1f(p, 'u_sat', params.saturation);
    this.u1f(p, 'u_vib', params.vibrance);
    this.u1f(p, 'u_density', params.density);
    this.u1f(p, 'u_halation', params.halation > 0 && this.haloA ? params.halation * 1.6 : 0);
    this.u3f(p, 'u_haloTint', [1.0, 0.32, 0.12]);
    this.u1f(p, 'u_grain', params.grain);
    this.u1f(p, 'u_grainSize', Math.max(0.5, params.grainSize * (target ? target.w / Math.max(1, this.width) : 1)));
    this.u1f(p, 'u_vignette', params.vignette);
    this.u1f(p, 'u_fade', params.fade);
    this.u1f(p, 'u_time', this.time);
    this.draw();
  }

  /** Roll-off used for the "before" view; lessons may pin it so before stays the untouched image. */
  beforeRolloff: number | null = null;

  private prepare(): boolean {
    if (this.contextLost || this.width < 2 || this.height < 2) return false;
    if (this.srcDirty || !this.src || this.source.kind === 'video') {
      this.src = this.target(this.src, this.width, this.height, this.floatTargets);
      this.renderSource(this.src);
      this.srcDirty = false;
      this.haloDirty = true;
    }
    if (this.params.halation > 0 && this.haloDirty) this.renderHalo();
    return true;
  }

  render() {
    if (!this.prepare()) return;
    this.renderGrade(null, this.params, this.view);
  }

  /** Render a small graded frame and read it back for scopes and scoring. */
  analyze(opts: { params?: GradeParams; before?: boolean; width?: number } = {}): Frame | null {
    if (!this.prepare()) return null;
    const gl = this.gl;
    const w = Math.min(opts.width ?? 320, this.width);
    const h = Math.max(1, Math.round((w * this.height) / this.width));
    this.analysis = this.target(this.analysis, w, h, false);
    this.renderGrade(this.analysis, opts.params ?? this.params, { ...this.view, mode: opts.before ? 'before' : 'graded', clipWarn: false, showLost: false });
    const raw = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.analysis.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const out = new Uint8Array(w * h * 4);
    const row = w * 4;
    for (let y = 0; y < h; y++) out.set(raw.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    return { data: out, width: w, height: h };
  }

  /** Average scene-linear value of the captured source around (u, v) — v from the top. Used by the white-balance eyedropper. */
  sampleSource(u: number, v: number, radius = 3): Vec3 | null {
    if (!this.prepare() || !this.src) return null;
    const gl = this.gl;
    const x = Math.round(u * (this.src.w - 1)), y = Math.round((1 - v) * (this.src.h - 1));
    const x0 = Math.max(0, x - radius), y0 = Math.max(0, y - radius);
    const w = Math.min(this.src.w - x0, radius * 2 + 1), h = Math.min(this.src.h - y0, radius * 2 + 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.src.fbo);
    const acc: Vec3 = [0, 0, 0];
    if (this.floatTargets) {
      const buf = new Float32Array(w * h * 4);
      gl.readPixels(x0, y0, w, h, gl.RGBA, gl.FLOAT, buf);
      for (let i = 0; i < w * h; i++) { acc[0] += buf[i * 4]; acc[1] += buf[i * 4 + 1]; acc[2] += buf[i * 4 + 2]; }
    } else {
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const dec = (b: number) => Math.pow(2, (b / 255) * 20 - 14) - 6.1035e-5;
      for (let i = 0; i < w * h; i++) { acc[0] += dec(buf[i * 4]); acc[1] += dec(buf[i * 4 + 1]); acc[2] += dec(buf[i * 4 + 2]); }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return acc.map((a) => a / (w * h)) as Vec3;
  }

  /** Render the full-resolution graded image and return it as a data URL. */
  snapshot(type = 'image/jpeg', quality = 0.9): string | null {
    if (!this.prepare()) return null;
    this.renderGrade(null, this.params, { ...this.view, mode: 'graded', clipWarn: false, showLost: false });
    try {
      return this.canvas.toDataURL(type, quality);
    } catch {
      return null;
    }
  }

  /** Subject mask for the current scene (white = subject), as an analysis-sized frame. */
  mask(width = 512): Frame | null {
    if (this.contextLost || this.width < 2) return null;
    const gl = this.gl;
    const w = Math.min(width, this.width);
    const h = Math.max(1, Math.round((w * this.height) / this.width));
    const t = this.target(null, w, h, false);
    this.renderSource(t, true);
    const raw = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(t.fbo);
    gl.deleteTexture(t.tex);
    this.srcDirty = true;
    const out = new Uint8Array(w * h * 4);
    const row = w * 4;
    for (let y = 0; y < h; y++) out.set(raw.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    return { data: out, width: w, height: h };
  }

  dispose() {
    const gl = this.gl;
    for (const p of this.programs.values()) gl.deleteProgram(p.prog);
    for (const t of [this.src, this.haloA, this.haloB, this.analysis]) if (t) { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); }
    if (this.mediaTex) gl.deleteTexture(this.mediaTex);
    gl.deleteTexture(this.curveTex);
    gl.deleteVertexArray(this.vao);
    this.programs.clear();
    this.src = this.haloA = this.haloB = this.analysis = null;
    // The context itself is released when the canvas is garbage-collected. (Calling loseContext here would
    // break React StrictMode, which re-mounts effects on the same canvas.)
  }
}
