import { COLOR, COMMON, HEADER } from './common';

/** Source pass: renders a procedural scene (or decodes an image) into scene-linear light, then applies the capture problem. */
export const sourceFrag = (sceneCode: string) => `${HEADER}
in vec2 v_uv;
out vec4 o;
uniform float u_time;
uniform vec2 u_res;
uniform float u_variant;
uniform vec4 u_sp;
uniform vec3 u_frame;
uniform mat3 u_inMat;
uniform float u_inExp;
uniform float u_clip;
uniform float u_noise;
uniform float u_seed;
uniform int u_pack;
uniform int u_maskMode;
float PX;
float g_mask = 0.0;
${COMMON}
${COLOR}
${sceneCode}
${CAPTURE_MAIN('scene(p, u_time)')}
`;

export const imageFrag = `${HEADER}
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_img;
uniform vec2 u_res;
uniform mat3 u_inMat;
uniform float u_inExp;
uniform float u_clip;
uniform float u_noise;
uniform float u_seed;
uniform float u_time;
uniform int u_pack;
uniform int u_maskMode;
uniform vec3 u_frame;
float PX;
float g_mask = 0.0;
${COMMON}
${COLOR}
vec3 sampleImage(vec2 p) {
  // Uploaded photos are display-referred sRGB: decode to linear light (an approximation of scene light).
  return srgbDecode(texture(u_img, v_uv).rgb);
}
${CAPTURE_MAIN('sampleImage(p)')}
`;

function CAPTURE_MAIN(expr: string) {
  return /* glsl */ `
void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = (v_uv - 0.5) * vec2(aspect, 1.0);
  p = p * u_frame.z + u_frame.xy;
  PX = u_frame.z / u_res.y * 1.2;
  vec3 c = ${expr};
  if (u_maskMode == 1) { o = vec4(vec3(g_mask), 1.0); return; }
  c = u_inMat * c * u_inExp;
  if (u_noise > 0.0) {
    vec2 q = gl_FragCoord.xy + u_seed * 17.0;
    float g1 = hash12(q) + hash12(q + 31.7) + hash12(q + 63.1) - 1.5;
    float g2 = hash12(q + 11.3) + hash12(q + 47.9) - 1.0;
    // shot noise grows with the square root of the signal; read noise is constant
    c += (sqrt(max(c, 0.0)) * 0.05 * g1 + 0.004 * g2) * u_noise * vec3(1.0, 0.85, 1.25);
  }
  float lost = max(c.r, max(c.g, c.b)) > u_clip ? 1.0 : 0.0;
  c = clamp(c, 0.0, u_clip);
  if (u_pack == 1) {
    c = (log2(c + 6.1035e-5) + 14.0) / 20.0;
    c += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  }
  o = vec4(c, lost);
}`;
}

/** Halation helper: threshold the bright parts at 1/4 resolution, then blur separably. */
export const haloFrag = `${HEADER}
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_tex;
uniform int u_stage;
uniform int u_pack;
uniform vec2 u_texel;
uniform vec2 u_dir;
uniform mat3 u_wb;
uniform float u_exposure;
uniform float u_thresh;
vec3 fetch(vec2 uv) {
  vec3 c = texture(u_tex, uv).rgb;
  if (u_pack == 1) c = exp2(c * 20.0 - 14.0) - 6.1035e-5;
  return c;
}
void main() {
  if (u_stage == 0) {
    vec3 c = 0.25 * (fetch(v_uv + u_texel * vec2(-1.0, -1.0)) + fetch(v_uv + u_texel * vec2(1.0, -1.0)) + fetch(v_uv + u_texel * vec2(-1.0, 1.0)) + fetch(v_uv + u_texel * vec2(1.0, 1.0)));
    c = u_wb * c * u_exposure;
    o = vec4(max(c - u_thresh, 0.0), 1.0);
    return;
  }
  float w[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec3 s = texture(u_tex, v_uv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    vec2 off = u_dir * u_texel * float(i) * 2.0;
    s += texture(u_tex, v_uv + off).rgb * w[i];
    s += texture(u_tex, v_uv - off).rgb * w[i];
  }
  o = vec4(s, 1.0);
}`;

/**
 * THE GRADING PASS — processing order (documented for learners in the Lab Notes):
 *  0. decode source → scene-linear Rec.709/D65 (optionally via a simulated camera Log curve)
 *  1. white balance: Bradford chromatic adaptation (3×3 matrix)       [scene-linear]
 *  2. exposure: multiply by 2^EV                                       [scene-linear]
 *  3. halation: add blurred, tinted highlights                         [scene-linear]
 *  4. vignette: radial gain                                            [scene-linear]
 *  5. contrast around 18% grey, highlights/shadows by luminance        [log2 / stops]
 *  6. display transform: per-channel shoulder, then sRGB encode        [→ display-referred]
 *  7. whites / blacks endpoints                                        [display-referred]
 *  8. pure power-law gamma                                             [display-referred]
 *  9. lift / gamma / gain                                              [display-referred]
 * 10. RGB curves (master, then R, G, B)                                [display-referred]
 * 11. HSL mixer, saturation, vibrance, density                         [Oklab, from linear]
 * 12. fade, grain, clamp to the 0–1 display range                      [display-referred]
 */
export const gradeFrag = `${HEADER}
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_src;
uniform sampler2D u_halo;
uniform sampler2D u_curves;
uniform int u_pack;
uniform float u_aspect;
uniform int u_mode;
uniform float u_split;
uniform int u_clipWarn;
uniform int u_showLost;
uniform int u_logOn;
uniform int u_logSrc;
uniform int u_logDst;
uniform int u_logView;
uniform int u_debugTransfer;
uniform mat3 u_wb;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_hl;
uniform float u_sh;
uniform float u_knee;
uniform float u_beforeKnee;
uniform float u_whites;
uniform float u_blacks;
uniform float u_gammaPow;
uniform vec3 u_lift;
uniform vec3 u_gainV;
uniform vec3 u_gammaV;
uniform int u_curvesOn;
uniform int u_colorOn;
uniform vec3 u_hsl[8];
uniform float u_sat;
uniform float u_vib;
uniform float u_density;
uniform float u_halation;
uniform vec3 u_haloTint;
uniform float u_grain;
uniform float u_grainSize;
uniform float u_vignette;
uniform float u_fade;
uniform float u_time;
${COMMON}
${COLOR}
vec3 shoulder(vec3 x, float k) {
  if (k >= 0.999) return min(x, vec3(1.0));
  vec3 over = max(x - k, 0.0);
  vec3 soft = k + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
  return mix(x, soft, step(vec3(k), x));
}
vec4 lutAt(float x) {
  float fx = clamp(x, 0.0, 1.0) * 1023.0;
  int i = int(floor(fx));
  float f = fx - float(i);
  vec4 a = texelFetch(u_curves, ivec2(i, 0), 0);
  vec4 b = texelFetch(u_curves, ivec2(min(i + 1, 1023), 0), 0);
  return mix(a, b, f);
}
float hdelta(float a, float b) { return mod(b - a + 540.0, 360.0) - 180.0; }
const float HC[8] = float[8](29.0, 60.0, 105.0, 142.0, 195.0, 255.0, 295.0, 330.0);
vec3 fetchSrc(vec2 uv, out float lost) {
  vec4 s = texture(u_src, uv);
  lost = s.a;
  vec3 c = s.rgb;
  if (u_pack == 1) c = exp2(c * 20.0 - 14.0) - 6.1035e-5;
  return max(c, 0.0);
}
void main() {
  vec2 uv = v_uv;
  float lost;
  vec3 c = fetchSrc(uv, lost);

  if (u_logOn == 1) {
    vec3 L = logEnc3(c, u_logSrc);
    if (u_logView == 1) { o = vec4(clamp(L, 0.0, 1.0), 1.0); return; }
    c = max(logDec3(L, u_logDst), 0.0);
  }
  if (u_debugTransfer == 1) { o = vec4(clamp(shoulder(c, u_beforeKnee), 0.0, 1.0), 1.0); return; }
  if (u_debugTransfer == 2) { o = vec4(srgbEncode(srgbEncode(clamp(shoulder(c, u_beforeKnee), 0.0, 1.0))), 1.0); return; }

  bool before = u_mode == 1 || (u_mode == 2 && uv.x < u_split);
  if (before) {
    o = vec4(srgbEncode(clamp(shoulder(c, u_beforeKnee), 0.0, 1.0)), 1.0);
    return;
  }

  // 1–2. white balance and exposure in scene-linear light
  c = max(u_wb * c, 0.0) * u_exposure;
  // 3. halation
  if (u_halation > 0.0) c += texture(u_halo, uv).rgb * u_haloTint * u_halation;
  // 4. vignette
  if (u_vignette != 0.0) {
    vec2 d = (uv - 0.5) * vec2(u_aspect, 1.0);
    float r = length(d) / length(vec2(u_aspect, 1.0) * 0.5);
    float v = smoothstep(0.3, 1.05, r);
    c *= u_vignette > 0.0 ? 1.0 - u_vignette * v * 0.8 : 1.0 - u_vignette * v * 0.5;
  }
  // 5. tone shaping in stops around 18% grey
  if (u_contrast != 1.0) c = 0.18 * exp2(log2(max(c, 1e-6) / 0.18) * u_contrast);
  if (u_hl != 0.0 || u_sh != 0.0) {
    float s = log2(max(luma709(c), 1e-6) / 0.18);
    float hm = smoothstep(-0.5, 2.5, s);
    float sm = 1.0 - smoothstep(-3.5, 0.5, s);
    c *= exp2(u_hl * hm + u_sh * sm);
  }
  // 6. display transform
  c = srgbEncode(clamp(shoulder(c, u_knee), 0.0, 1.0));
  // 7. whites / blacks
  c += u_whites * 0.25 * c * c;
  vec3 ic = 1.0 - clamp(c, 0.0, 1.0);
  c += u_blacks * 0.12 * ic * ic * ic;
  // 8. pure power-law gamma
  if (u_gammaPow != 1.0) c = pow(max(c, 0.0), vec3(u_gammaPow));
  // 9. lift / gamma / gain
  c = c + u_lift * (1.0 - c);
  c *= u_gainV;
  c = sign(c) * pow(abs(c), u_gammaV);
  // 10. curves
  if (u_curvesOn == 1) {
    c = clamp(c, 0.0, 1.0);
    c = vec3(lutAt(c.r).a, lutAt(c.g).a, lutAt(c.b).a);
    c = vec3(lutAt(c.r).r, lutAt(c.g).g, lutAt(c.b).b);
  }
  // 11. colour in Oklab
  if (u_colorOn == 1) {
    vec3 lab = linToOklab(srgbDecode(clamp(c, 0.0, 1.0)));
    float C = length(lab.yz);
    float h = degrees(atan(lab.z, lab.y));
    float cm = smoothstep(0.012, 0.06, C);
    float dh = 0.0, ds = 0.0, dl = 0.0;
    for (int i = 0; i < 8; i++) {
      float d = hdelta(HC[i], h);
      float span = d >= 0.0 ? hdelta(HC[i], HC[(i + 1) % 8]) : hdelta(HC[(i + 7) % 8], HC[i]);
      float w = max(1.0 - abs(d) / abs(span), 0.0);
      dh += w * u_hsl[i].x; ds += w * u_hsl[i].y; dl += w * u_hsl[i].z;
    }
    h += dh * 30.0 * cm;
    C *= max(0.0, 1.0 + ds * cm);
    float L = lab.x + dl * 0.14 * cm;
    C *= 1.0 + u_vib * (1.0 - smoothstep(0.0, 0.16, C)) * 0.9;
    C *= u_sat;
    L -= u_density * C * 0.55;
    lab = vec3(L, C * cos(radians(h)), C * sin(radians(h)));
    c = srgbEncode(max(oklabToLin(lab), 0.0));
  }
  // 12. fade, grain
  float f = u_fade * 0.12;
  c = f + c * (1.0 - f);
  if (u_grain > 0.0) {
    vec2 gp = gl_FragCoord.xy / u_grainSize + floor(u_time * 24.0) * vec2(37.1, 71.7);
    float n = vnoise(gp) + vnoise(gp * 1.73 + 13.0) - 1.0;
    float Y = clamp(luma709(c), 0.0, 1.0);
    c += n * u_grain * 0.17 * (0.25 + 3.0 * Y * (1.0 - Y));
  }
  c = clamp(c, 0.0, 1.0);
  if (u_clipWarn == 1) {
    float mx = max(c.r, max(c.g, c.b));
    if (mx >= 0.996) c = vec3(1.0, 0.16, 0.16);
    else if (mx <= 0.006) c = vec3(0.16, 0.42, 1.0);
  }
  if (u_showLost == 1 && lost > 0.5) {
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 10.0));
    c = mix(c, vec3(1.0, 0.0, 1.0), 0.55 * stripe);
  }
  o = vec4(c, 1.0);
}`;
