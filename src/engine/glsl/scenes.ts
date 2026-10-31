/**
 * Procedural "photographs". Every scene returns SCENE-LINEAR radiance with Rec.709 primaries,
 * scaled so that an 18% grey card under the key light reads ≈ 0.18. Highlights may exceed 1.0.
 * Because the scenes are generated, every lesson knows the ground truth (where the grey card is,
 * which pixels are skin, what colour the light was) and can measure your result honestly.
 *
 * Uniforms available: u_time, u_variant (int-ish), u_sp (vec4 scene params), PX (pixel size).
 * Scenes set g_mask = subject coverage (used for cut-outs, e.g. magazine covers).
 */

export const COAST = /* glsl */ `
const float HZ = -0.06;
vec3 coastSky(vec2 p, float t, vec2 sun) {
  float h = max(p.y - HZ, 0.0);
  vec3 c = mix(vec3(1.25, 0.46, 0.17), vec3(0.85, 0.32, 0.26), smoothstep(0.0, 0.09, h));
  c = mix(c, vec3(0.24, 0.15, 0.30), smoothstep(0.06, 0.27, h));
  c = mix(c, vec3(0.03, 0.055, 0.15), smoothstep(0.22, 0.6, h));
  float d = length((p - sun) * vec2(0.8, 1.0));
  c += vec3(1.0, 0.48, 0.18) * (1.1 * exp(-d * 10.0) + 0.35 * exp(-d * 3.2));
  // cloud banks, lit from below by the low sun
  vec2 q = vec2(p.x * 1.3 + t * 0.006, h * 6.5);
  float n = fbm(q * vec2(2.3, 4.6) + vec2(3.1, 0.7));
  float band = smoothstep(0.1, 0.2, h) * (1.0 - smoothstep(0.34, 0.5, h));
  float cl = smoothstep(0.48, 0.78, n) * band;
  float under = smoothstep(0.75, 0.45, n);
  float glow = exp(-length(p - sun) * 2.2);
  vec3 cloud = mix(vec3(0.07, 0.05, 0.10), vec3(1.6, 0.62, 0.30), sat(glow * 1.2 + 0.08) * (0.55 + 0.45 * under));
  c = mix(c, cloud, cl * 0.9);
  // thin streaks near the horizon
  float st = smoothstep(0.62, 0.8, fbm(vec2(p.x * 3.0 + t * 0.01, h * 60.0))) * smoothstep(0.012, 0.03, h) * (1.0 - smoothstep(0.05, 0.09, h));
  c = mix(c, vec3(0.55, 0.2, 0.18) + vec3(1.2, 0.5, 0.2) * glow, st * 0.6);
  float disc = 1.0 - smoothstep(0.024, 0.028, length(p - sun));
  c = mix(c, vec3(42.0, 24.0, 10.0), disc * smoothstep(-0.002, 0.004, p.y - HZ));
  return c;
}
float ridge(float x, float base, float amp, float freq, float seed) {
  return base + amp * (fbm3(vec2(x * freq + seed, seed)) - 0.35);
}
vec3 coastAbove(vec2 p, float t, vec2 sun, out float solid) {
  vec3 c = coastSky(p, t, sun);
  solid = 0.0;
  float fade = smoothstep(0.35, -0.55, p.x);
  float r1 = HZ + fade * ridge(p.x, 0.07, 0.16, 2.4, 1.3);
  if (p.y < r1) {
    vec3 haze = vec3(0.9, 0.36, 0.22);
    vec3 m = mix(vec3(0.16, 0.07, 0.11), haze, 0.42);
    m += vec3(1.0, 0.45, 0.2) * 0.35 * exp(-(r1 - p.y) * 70.0) * smoothstep(-0.6, 0.2, p.x);
    c = mix(c, m, cover(p.y - r1, PX));
    solid = 1.0;
  }
  float fade2 = smoothstep(0.0, -0.75, p.x);
  float r2 = HZ + fade2 * ridge(p.x, 0.035, 0.1, 4.1, 7.9);
  if (p.y < r2 + PX) {
    vec3 m = vec3(0.035, 0.018, 0.03) + vec3(0.9, 0.35, 0.15) * 0.18 * exp(-(r2 - p.y) * 120.0);
    c = mix(c, m, cover(p.y - r2, PX));
    solid = 1.0;
  }
  return c;
}
vec3 scene(vec2 p, float t) {
  vec2 sun = vec2(0.2, HZ + 0.055);
  vec3 c;
  float solid;
  if (p.y >= HZ) {
    c = coastAbove(p, t, sun, solid);
  } else {
    float depth = HZ - p.y;
    float persp = 1.0 / (depth + 0.02);
    vec2 wp = vec2(p.x * persp, persp);
    float w1 = vnoise(vec2(wp.x * 2.5, wp.y * 1.4 - t * 0.5));
    float w2 = vnoise(vec2(wp.x * 6.0 + 3.0, wp.y * 3.2 + t * 0.8));
    float wave = (w1 * 0.65 + w2 * 0.35) - 0.5;
    vec2 rp = vec2(p.x + wave * depth * 0.6, HZ + depth * 0.85 + wave * depth * 0.25);
    vec3 refl = coastAbove(rp, t, sun, solid);
    float fres = mix(0.75, 0.25, sat(depth * 2.2));
    vec3 water = vec3(0.006, 0.014, 0.024);
    c = water + refl * fres;
    float spread = 0.025 + depth * 0.55;
    float column = exp(-pow((p.x - sun.x) / spread, 2.0));
    float sparkle = pow(vnoise(vec2(wp.x * 9.0, wp.y * 7.0 + t * 1.3)) * vnoise(vec2(wp.x * 17.0 - t, wp.y * 13.0)), 3.0);
    c += vec3(1.0, 0.55, 0.22) * column * (sparkle * 55.0 + 0.4) * smoothstep(0.0, 0.01, depth);
    // foreground rocks
    float rock = -0.39 + 0.1 * fbm3(vec2(p.x * 3.0, 2.0)) + 0.1 * smoothstep(0.25, 0.8, p.x) - 0.25 * smoothstep(0.2, -0.3, p.x);
    if (p.y < rock + PX * 2.0) {
      float rim = exp(-(rock - p.y) * 90.0);
      vec3 rc = vec3(0.012, 0.009, 0.01) + vec3(1.0, 0.45, 0.2) * 0.25 * rim + vec3(0.02, 0.015, 0.012) * fbm(p * 18.0);
      c = mix(c, rc, cover(p.y - rock, PX * 1.5));
    }
  }
  g_mask = 0.0;
  return c;
}
`;

export const PORTRAIT = /* glsl */ `
vec3 skinAlbedo(int i) {
  if (i == 0) return s2l(vec3(0.953, 0.843, 0.776));
  if (i == 1) return s2l(vec3(0.910, 0.749, 0.627));
  if (i == 2) return s2l(vec3(0.831, 0.627, 0.478));
  if (i == 3) return s2l(vec3(0.686, 0.459, 0.314));
  if (i == 4) return s2l(vec3(0.494, 0.306, 0.200));
  return s2l(vec3(0.306, 0.184, 0.133));
}
vec3 wardrobe(int i) {
  if (i == 0) return s2l(vec3(0.69, 0.51, 0.33));
  if (i == 1) return s2l(vec3(0.17, 0.31, 0.64));
  if (i == 2) return s2l(vec3(0.62, 0.11, 0.2));
  if (i == 3) return s2l(vec3(0.1, 0.1, 0.105));
  if (i == 4) return s2l(vec3(0.91, 0.886, 0.83));
  return s2l(vec3(0.18, 0.36, 0.23));
}
struct Light { vec3 key; vec3 keyDir; vec3 fill; vec3 fillDir; vec3 rim; vec3 amb; };
Light lighting(int preset) {
  Light l;
  l.keyDir = normalize(vec3(-0.6, 0.45, 0.68));
  l.fillDir = normalize(vec3(0.8, 0.0, 0.6));
  if (preset == 1) { // golden-hour sunset
    l.key = vec3(1.0, 0.62, 0.34) * 1.75; l.fill = vec3(0.34, 0.44, 0.8) * 0.22; l.rim = vec3(1.0, 0.6, 0.3) * 1.6; l.amb = vec3(0.05, 0.05, 0.08);
  } else if (preset == 2) { // neon night
    l.key = vec3(0.95, 0.22, 0.75) * 1.25; l.fill = vec3(0.08, 0.62, 0.9) * 0.7; l.rim = vec3(0.1, 0.8, 1.0) * 1.2; l.amb = vec3(0.012, 0.015, 0.03);
  } else if (preset == 3) { // cool window daylight
    l.key = vec3(0.86, 0.93, 1.05) * 1.55; l.fill = vec3(1.0, 0.85, 0.7) * 0.18; l.rim = vec3(0.9, 0.95, 1.0) * 0.35; l.amb = vec3(0.05, 0.055, 0.06);
  } else { // studio
    l.key = vec3(1.0, 0.95, 0.88) * 1.6; l.fill = vec3(0.7, 0.75, 0.85) * 0.22; l.rim = vec3(1.0) * 0.7; l.amb = vec3(0.04);
  }
  return l;
}
vec3 backdrop(vec2 p, int preset, int bg, float t) {
  if (preset == 1) {
    float h = p.y + 0.1;
    vec3 c = mix(vec3(1.3, 0.55, 0.22), vec3(0.45, 0.25, 0.4), smoothstep(-0.3, 0.45, h));
    c = mix(c, vec3(0.08, 0.1, 0.22), smoothstep(0.3, 0.7, h));
    for (int i = 0; i < 9; i++) {
      vec2 o = hash22(vec2(float(i), 3.7)) * vec2(1.6, 0.7) - vec2(0.8, 0.45);
      float r = 0.03 + 0.04 * hash11(float(i) * 7.1);
      float b = cover(length(p - o) - r, 0.006);
      c += vec3(1.2, 0.6, 0.25) * b * 0.35 * (0.5 + hash11(float(i)));
    }
    return c * (0.9 + 0.2 * fbm3(p * 2.0));
  }
  if (preset == 2) {
    vec3 c = mix(vec3(0.012, 0.01, 0.03), vec3(0.04, 0.02, 0.06), smoothstep(-0.5, 0.5, p.y));
    for (int i = 0; i < 16; i++) {
      vec2 o = hash22(vec2(float(i), 9.1)) * vec2(1.8, 1.0) - vec2(0.9, 0.5);
      float r = 0.02 + 0.05 * hash11(float(i) * 3.3);
      float k = hash11(float(i) * 1.7);
      vec3 col = k < 0.33 ? vec3(0.1, 0.7, 1.0) : k < 0.66 ? vec3(1.0, 0.2, 0.7) : vec3(1.0, 0.6, 0.25);
      float flick = 0.85 + 0.15 * sin(t * 3.0 + float(i));
      c += col * cover(length(p - o) - r, 0.01) * 0.6 * flick;
    }
    return c;
  }
  vec3 base;
  if (preset == 3) base = s2l(vec3(0.72, 0.73, 0.72));
  else if (bg == 1) base = s2l(vec3(0.55, 0.42, 0.36));
  else if (bg == 2) base = s2l(vec3(0.82, 0.78, 0.7));
  else if (bg == 3) base = s2l(vec3(0.16, 0.17, 0.2));
  else base = s2l(vec3(0.37, 0.45, 0.47));
  float mottle = 0.78 + 0.42 * fbm(p * 2.6 + 4.0);
  float light = 0.45 + 0.75 * exp(-length(p - vec2(-0.45, 0.35)) * 1.4);
  return base * mottle * light;
}
float headSd(vec2 q) {
  // egg-shaped head: narrower toward the chin
  float taper = 1.0 - 0.2 * smoothstep(0.0, -0.13, q.y);
  return sdEllipse(q * vec2(1.0 / taper, 1.0), vec2(0.098, 0.128));
}
vec3 shadeSkin(vec3 alb, vec3 n, Light L, float occl) {
  float w = 0.4;
  float kd = max((dot(n, L.keyDir) + w) / (1.0 + w), 0.0);
  float fd = max((dot(n, L.fillDir) + 0.3) / 1.3, 0.0);
  float rim = pow(1.0 - max(n.z, 0.0), 3.0) * max(dot(normalize(n.xy + 1e-4), normalize(vec2(0.85, 0.35))), 0.0);
  vec3 c = alb * (L.key * kd * occl + L.fill * fd + L.amb);
  // subsurface: warm, reddish light bleeding at the terminator
  float term = smoothstep(0.0, 0.35, kd) * (1.0 - smoothstep(0.35, 0.8, kd));
  c += alb * vec3(0.55, 0.14, 0.06) * L.key * term * 0.45 * occl;
  c += L.rim * rim * 0.45 * (alb + 0.15);
  float spec = pow(max(dot(reflect(-L.keyDir, n), vec3(0, 0, 1)), 0.0), 28.0);
  c += L.key * spec * 0.07 * occl;
  return c;
}
vec3 scene(vec2 p, float t) {
  int skin = int(u_variant + 0.5);
  int preset = int(u_sp.x + 0.5);
  int ward = int(u_sp.y + 0.5);
  int bgi = int(u_sp.z + 0.5);
  Light L = lighting(preset);
  vec3 alb = skinAlbedo(skin);
  vec3 hairC = skin >= 4 ? s2l(vec3(0.07, 0.05, 0.045)) : skin == 0 ? s2l(vec3(0.42, 0.27, 0.15)) : s2l(vec3(0.16, 0.1, 0.07));
  float sway = 0.004 * sin(t * 0.9);
  vec2 H = vec2(0.0 + sway, 0.105);
  vec2 q = p - H;
  vec3 c = backdrop(p, preset, bgi, t);
  float mask = 0.0;

  // hair behind the head and over the shoulders
  float hairBack = smin(sdEllipse(q - vec2(0.0, 0.03), vec2(0.128, 0.16)), sdRoundBox(q - vec2(0.0, -0.13), vec2(0.15, 0.13), 0.06), 0.05);
  hairBack = max(hairBack, -(q.y + 0.27));
  float hb = cover(hairBack, PX);
  if (hb > 0.0) {
    float strands = fbm(vec2(q.x * 70.0 + sin(q.y * 20.0) * 2.0, q.y * 4.0));
    vec3 hc = hairC * (0.5 + 0.6 * strands);
    float lit = sat(0.5 - q.x * 3.0);
    hc = hc * (L.amb * 6.0 + L.key * 0.35 * lit) + L.rim * 0.25 * smoothstep(0.08, 0.14, q.x) * hairC * 4.0;
    c = mix(c, hc, hb);
    mask = max(mask, hb);
  }

  // torso and garment
  vec2 tq = p - vec2(0.0, -0.53);
  float torso = sdEllipse(tq, vec2(0.33, 0.33));
  float tc = cover(torso, PX);
  if (tc > 0.0) {
    vec3 g = wardrobe(ward);
    float nx = clamp(tq.x / 0.33, -1.0, 1.0);
    vec3 n = normalize(vec3(nx, 0.35, sqrt(max(1.0 - nx * nx, 0.0)) + 0.2));
    float folds = 0.8 + 0.35 * fbm(vec2(p.x * 9.0, p.y * 3.0 + p.x * 2.0));
    float kd = max((dot(n, L.keyDir) + 0.25) / 1.25, 0.0);
    vec3 gc = g * folds * (L.key * kd + L.fill * 0.6 + L.amb);
    gc += L.rim * pow(1.0 - n.z, 4.0) * 0.12;
    // V neckline reveals skin
    float v = abs(p.x) - (p.y + 0.29) * 0.55;
    float neckSkin = cover(max(v, -(p.y + 0.29)), PX * 1.5);
    vec3 chest = shadeSkin(alb, normalize(vec3(p.x * 3.0, 0.2, 1.0)), L, 0.75 + 0.25 * smoothstep(-0.12, -0.28, p.y));
    gc = mix(gc, chest, neckSkin);
    c = mix(c, gc, tc);
    mask = max(mask, tc);
  }

  // neck
  vec2 nq = p - vec2(H.x * 0.5, -0.065);
  float neck = sdRoundBox(nq, vec2(0.043, 0.09), 0.02);
  float nc = cover(neck, PX);
  if (nc > 0.0) {
    float nx = clamp(nq.x / 0.045, -1.0, 1.0);
    vec3 n = normalize(vec3(nx, -0.1, sqrt(max(1.0 - nx * nx, 0.0))));
    float chin = smoothstep(0.035, -0.02, nq.y + 0.0) * 0.55 + 0.45;
    vec3 nk = shadeSkin(alb, n, L, chin * 0.85);
    c = mix(c, nk, nc);
    mask = max(mask, nc);
  }

  // head
  float hd = headSd(q);
  float hcov = cover(hd, PX);
  if (hcov > 0.0) {
    vec2 e = q / vec2(0.1, 0.13);
    float z = sqrt(max(1.0 - dot(e, e), 0.0));
    vec3 n = normalize(vec3(e.x * 0.95, e.y * 0.8 + 0.05, z + 0.12));
    // nose bridge: a soft ridge down the middle
    float nose = exp(-pow(q.x / 0.012, 2.0)) * smoothstep(0.03, -0.0, q.y) * smoothstep(-0.055, -0.02, q.y);
    n = normalize(n + vec3(0.0, 0.0, nose * 0.25) + vec3(sign(q.x) * nose * 0.15, 0.0, 0.0));
    float occl = 1.0;
    // eye sockets and under-nose occlusion
    occl *= 1.0 - 0.18 * exp(-pow(length((q - vec2(-0.038, 0.012)) * vec2(1.0, 1.6)) / 0.026, 2.0));
    occl *= 1.0 - 0.18 * exp(-pow(length((q - vec2(0.038, 0.012)) * vec2(1.0, 1.6)) / 0.026, 2.0));
    occl *= 1.0 - 0.35 * exp(-pow(length((q - vec2(0.006, -0.05)) * vec2(1.0, 2.5)) / 0.018, 2.0));
    vec3 face = shadeSkin(alb, n, L, occl);
    // cheeks: slightly more blood
    float blush = exp(-pow(length(q - vec2(-0.052, -0.03)) / 0.03, 2.0)) + exp(-pow(length(q - vec2(0.052, -0.03)) / 0.03, 2.0));
    face *= mix(vec3(1.0), vec3(1.08, 0.92, 0.9), blush * 0.6);
    // lips
    vec2 lq = q - vec2(0.0, -0.082);
    float lips = cover(sdEllipse(lq, vec2(0.03, 0.012)), PX);
    vec3 lipC = face * vec3(1.05, 0.55, 0.55) * mix(0.7, 1.05, smoothstep(0.0, -0.008, lq.y));
    face = mix(face, lipC, lips);
    face *= 1.0 - 0.55 * cover(abs(lq.y + 0.001) - 0.0012, PX) * cover(abs(lq.x) - 0.026, PX);
    // closed eyes: lash lines and lids
    for (int s = -1; s <= 1; s += 2) {
      vec2 eq = q - vec2(float(s) * 0.038, 0.01);
      float lash = abs(length(eq * vec2(1.0, 2.2) + vec2(0.0, 0.03)) - 0.033);
      float lid = cover(lash - 0.0016, PX) * step(-0.004, eq.y) * cover(abs(eq.x) - 0.022, PX);
      face = mix(face, hairC * 0.4, lid * 0.95);
      vec2 bq = q - vec2(float(s) * 0.042, 0.047);
      float brow = abs(length(bq * vec2(1.0, 2.6) + vec2(0.0, 0.06)) - 0.06);
      float bc = cover(brow - 0.004, PX) * cover(abs(bq.x) - 0.028, PX) * step(-0.01, bq.y);
      face = mix(face, hairC * (L.key * 0.25 + 0.05), bc * 0.85);
    }
    // nostrils
    face *= 1.0 - 0.35 * (exp(-pow(length(q - vec2(-0.011, -0.052)) / 0.006, 2.0)) + exp(-pow(length(q - vec2(0.011, -0.052)) / 0.006, 2.0)));
    c = mix(c, face, hcov);
    mask = max(mask, hcov);
  }

  // hair fringe on top of the forehead (side parting)
  float part = q.y - (0.068 + 0.04 * smoothstep(-0.02, 0.1, q.x) - 0.025 * smoothstep(0.0, -0.1, q.x) + 0.012 * sin(q.x * 40.0));
  float hairTop = max(sdEllipse(q - vec2(0.0, 0.02), vec2(0.122, 0.152)), -part);
  float ht = cover(hairTop, PX);
  if (ht > 0.0) {
    float strands = fbm(vec2(q.x * 55.0 + q.y * 12.0, q.y * 6.0));
    vec3 hn = normalize(vec3(q.x * 7.0, (q.y - 0.05) * 6.0, 1.0));
    float kd = max(dot(hn, L.keyDir), 0.0);
    vec3 hc = hairC * (0.55 + 0.7 * strands) * (L.key * kd * 0.9 + L.amb * 4.0 + L.fill * 0.4);
    float sheen = exp(-pow((q.y - 0.12 + q.x * 0.4) / 0.012, 2.0)) * kd;
    hc += L.key * sheen * 0.08 * (0.5 + strands);
    c = mix(c, hc, ht);
    mask = max(mask, ht);
  }
  g_mask = mask;
  return c;
}
`;

export const STREET = /* glsl */ `
const float CAMH = 1.6;
const float FOC = 1.15;
const float WL = 1.9;
const float WR = 2.6;
vec3 lampPos(int i) { return vec3(WR - 0.45, 2.3, 5.0 + float(i) * 6.5); }
vec3 neon(vec2 w, float t) {
  // w = (z, Y) on the left wall, in metres
  vec2 c0 = vec2(6.6, 0.85);
  float ring = abs(length(w - c0) - 0.55);
  float bar = sdSegment(w, c0 + vec2(-0.32, -0.32), c0 + vec2(0.32, 0.32));
  float flick = step(0.06, fract(sin(floor(t * 7.0)) * 43758.5)) * 0.85 + 0.15;
  vec3 m = vec3(1.0, 0.12, 0.62) * (exp(-ring * 60.0) * 9.0 + exp(-ring * 6.0) * 0.7) * flick;
  m += vec3(1.0, 0.12, 0.62) * (exp(-bar * 60.0) * 9.0 + exp(-bar * 6.0) * 0.5) * flick;
  float bars = 1e3;
  for (int i = 0; i < 4; i++) bars = min(bars, sdSegment(w, vec2(8.0 + float(i) * 0.36, 0.35), vec2(8.0 + float(i) * 0.36, 1.25)));
  m += vec3(0.05, 0.75, 1.0) * (exp(-bars * 70.0) * 8.0 + exp(-bars * 7.0) * 0.45);
  return m;
}
vec3 windows(vec2 w, float side, float t) {
  vec2 cell = floor(vec2(w.x / 1.8, (w.y + CAMH) / 3.1));
  vec2 f = fract(vec2(w.x / 1.8, (w.y + CAMH) / 3.1));
  float inWin = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.82);
  float r = hash12(cell + side * 17.0);
  float on = step(0.45, r);
  vec3 col = r > 0.8 ? vec3(0.55, 0.75, 1.0) : vec3(1.0, 0.62, 0.3);
  float tv = r > 0.93 ? 0.6 + 0.4 * sin(t * 5.0 + r * 30.0) : 1.0;
  return inWin * on * col * (0.25 + 0.9 * hash12(cell + 3.1)) * tv * step(0.0, (w.y + CAMH) - 3.0);
}
float bHeight(float z, float side) { return 7.0 + 9.0 * hash11(floor(z / 7.0) + side * 13.0); }
vec3 skyNight(vec3 d) {
  float y = d.y / length(d);
  vec3 c = mix(vec3(0.07, 0.045, 0.04), vec3(0.008, 0.01, 0.025), smoothstep(-0.02, 0.35, y));
  return c;
}
vec3 lampLight(vec3 pos) {
  vec3 l = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec3 lp = lampPos(i);
    vec3 d = lp - pos;
    l += vec3(1.0, 0.5, 0.14) * 7.0 / (dot(d, d) + 0.6);
  }
  // shop window spill on the right
  float zs = clamp(pos.z, 6.0, 10.0);
  vec3 ds = vec3(WR, -0.6, zs) - pos;
  l += vec3(1.0, 0.7, 0.42) * 2.2 / (dot(ds, ds) + 0.8);
  return l;
}
/** Trace walls & sky; dir.y may be mirrored for wet-ground reflections. */
vec3 traceUpper(vec3 o, vec3 d, float t) {
  vec3 c = skyNight(d);
  float tl = d.x < 0.0 ? (-WL - o.x) / d.x : 1e9;
  float tr = d.x > 0.0 ? (WR - o.x) / d.x : 1e9;
  float th = min(tl, tr);
  if (th < 1e8) {
    vec3 h = o + d * th;
    float side = tl < tr ? 0.0 : 1.0;
    float top = bHeight(h.z, side) - CAMH;
    if (h.y < top) {
      vec2 w = vec2(h.z, h.y);
      vec3 wall = s2l(vec3(0.24, 0.2, 0.19)) * (0.6 + 0.5 * fbm3(w * vec2(1.0, 2.0)));
      vec3 lit = wall * (lampLight(h) * 0.5 + vec3(0.006, 0.007, 0.012));
      lit += windows(w, side, t);
      if (side < 0.5) lit += neon(w, t);
      else {
        float shop = step(6.0, h.z) * step(h.z, 10.0) * step(h.y, 0.6 - 0.0) * step(-CAMH + 0.2, h.y);
        lit = mix(lit, vec3(1.0, 0.68, 0.38) * (0.7 + 0.3 * fbm3(w * 3.0)), shop);
      }
      // distance haze
      float fog = 1.0 - exp(-th * 0.025);
      c = mix(lit, vec3(0.05, 0.035, 0.035), fog);
    }
  }
  return c;
}
vec3 glows(vec2 p, vec2 vp, float t, bool refl) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec3 lp = lampPos(i);
    float y = refl ? -2.0 * CAMH - lp.y : lp.y;
    vec2 s = vp + FOC * vec2(lp.x, y) / lp.z;
    vec2 d = p - s;
    if (refl) d *= vec2(1.0, 0.22);
    float r = 0.05 / lp.z;
    float dd = length(d);
    c += vec3(1.0, 0.52, 0.15) * (exp(-dd / r * 1.6) * 30.0 + exp(-dd / (r * 9.0)) * 0.9) * (refl ? 0.35 : 1.0);
  }
  // tail lights of a car driving away
  float zc = 5.0 + mod(t, 8.0) * 3.0;
  for (int k = -1; k <= 1; k += 2) {
    vec3 tp = vec3(-0.45 + float(k) * 0.65, -1.0, zc);
    float y = refl ? -2.0 * CAMH - tp.y : tp.y;
    vec2 s = vp + FOC * vec2(tp.x, y) / tp.z;
    vec2 d = (p - s) * (refl ? vec2(1.0, 0.25) : vec2(1.0));
    c += vec3(1.0, 0.04, 0.03) * (exp(-length(d) / (0.03 / zc)) * 12.0 + exp(-length(d) / (0.25 / zc)) * 0.6) * (refl ? 0.4 : 1.0);
  }
  return c;
}
vec3 scene(vec2 p, float t) {
  vec2 vp = vec2(0.06, 0.035);
  vec3 o = vec3(0.0);
  vec3 d = normalize(vec3(p - vp, FOC));
  vec3 c;
  float tg = d.y < 0.0 ? -CAMH / d.y : 1e9;
  float tl = d.x < 0.0 ? -WL / d.x : 1e9;
  float tr = d.x > 0.0 ? WR / d.x : 1e9;
  if (tg < min(tl, tr)) {
    vec3 h = d * tg;
    // asphalt, sidewalks, puddles
    float road = step(-WL + 0.9, h.x) * step(h.x, WR - 0.9);
    vec3 alb = mix(s2l(vec3(0.3, 0.3, 0.31)), s2l(vec3(0.17, 0.17, 0.18)), road) * (0.75 + 0.5 * fbm(h.xz * 2.5));
    float lane = road * step(abs(h.x - 0.35), 0.06) * step(0.5, fract(h.z * 0.18));
    alb = mix(alb, s2l(vec3(0.85, 0.82, 0.7)), lane);
    float wet = smoothstep(0.38, 0.62, fbm(h.xz * vec2(0.6, 0.35) + 2.0));
    vec3 diff = alb * (lampLight(h) * 0.45 + vec3(0.004, 0.005, 0.009)) * (1.0 - wet * 0.6);
    // mirrored ray, rippled by rain
    vec2 rip = (vec2(vnoise(h.xz * 6.0 + vec2(0.0, t * 2.0)), vnoise(h.xz * 6.0 + 4.0 - t)) - 0.5) * 0.035;
    vec3 rd = normalize(vec3(d.x + rip.x, -d.y, d.z + rip.y));
    vec3 refl = traceUpper(h, rd, t);
    float fres = 0.15 + 0.7 * pow(1.0 - abs(d.y), 5.0);
    c = diff + refl * fres * mix(0.35, 1.0, wet);
    c += glows(p + rip * 0.3, vp, t, true) * mix(0.25, 1.0, wet);
    c = mix(c, vec3(0.05, 0.035, 0.035), 1.0 - exp(-tg * 0.025));
  } else {
    c = traceUpper(o, d, t);
  }
  c += glows(p, vp, t, false);
  // rain streaks
  vec2 rp = vec2(p.x * 90.0 + p.y * 9.0, p.y * 6.0 + t * 14.0);
  float rain = step(0.97, hash12(vec2(floor(rp.x), floor(rp.y)))) * smoothstep(0.0, 0.5, fract(rp.y));
  c += vec3(0.25, 0.22, 0.2) * rain * 0.08;
  g_mask = 0.0;
  return c;
}
`;

export const FACADE = /* glsl */ `
vec3 scene(vec2 p, float t) {
  vec3 sun = vec3(1.0, 0.76, 0.52) * 2.4;
  vec3 skyL = vec3(0.32, 0.45, 0.78) * 0.32;
  // sky
  float h = p.y;
  vec3 c = mix(vec3(0.42, 0.5, 0.66), vec3(0.06, 0.15, 0.42), smoothstep(-0.3, 0.55, h));
  c += vec3(0.9, 0.6, 0.35) * 0.25 * exp(-length(p - vec2(-0.9, 0.0)) * 2.0);
  float cl = smoothstep(0.55, 0.8, fbm(vec2(p.x * 2.0 + t * 0.01, p.y * 7.0))) * smoothstep(0.1, 0.3, p.y);
  c = mix(c, vec3(1.0, 0.82, 0.68) * 0.9, cl * 0.6);

  // left building in shade: terracotta render, tall slit windows
  if (p.x < -0.3 && p.y < 0.24) {
    vec3 alb = s2l(vec3(0.74, 0.42, 0.3)) * (0.88 + 0.2 * fbm(p * 30.0));
    vec3 b = alb * (skyL * 1.6 + vec3(0.05, 0.04, 0.035));
    vec2 g = vec2(fract((p.x + 0.75) / 0.085), fract((p.y + 0.5) / 0.15));
    float win = step(0.35, g.x) * step(g.x, 0.65) * step(0.2, g.y) * step(g.y, 0.85);
    b = mix(b, vec3(0.02, 0.03, 0.05) + skyL * 0.15, win);
    float edge = cover(p.x + 0.3, PX);
    c = mix(c, b, edge * cover(p.y - 0.24, PX));
  }
  // main building: limestone grid with deep reveals and projecting slabs
  float bx0 = -0.3, btop = 0.36;
  if (p.x > bx0 - PX && p.y < btop + PX) {
    vec3 alb = s2l(vec3(0.86, 0.8, 0.7)) * (0.9 + 0.14 * fbm(p * 40.0));
    vec2 cs = vec2(0.115, 0.13);
    vec2 lp = vec2(p.x - bx0, p.y + 0.5);
    vec2 cell = floor(lp / cs);
    vec2 f = fract(lp / cs);
    // window opening (recessed glass)
    vec2 w0 = vec2(0.18, 0.28), w1 = vec2(0.82, 0.86);
    float inWin = step(w0.x, f.x) * step(f.x, w1.x) * step(w0.y, f.y) * step(f.y, w1.y);
    // sun from upper-left casts shadow inside the recess along the left and top reveals
    float sh = step(f.x, w0.x + 0.18) + step(w1.y - 0.22, f.y);
    vec3 glass = mix(vec3(0.05, 0.09, 0.2), vec3(0.35, 0.45, 0.62), smoothstep(0.0, 1.0, f.y)) * 0.45;
    glass += vec3(1.0, 0.85, 0.6) * 0.06 * hash12(cell);
    vec3 recess = glass * (sh > 0.0 ? 0.55 : 1.0);
    vec3 wall = alb * (sun * 0.5 + skyL);
    // slab shadow: each floor's slab throws a diagonal shadow downward
    float slab = step(0.9, f.y);
    float slabShadow = step(f.y, 0.9) * step(0.9 - 0.32 + f.x * 0.2, f.y);
    wall = mix(wall, alb * skyL * 1.3, slabShadow * 0.92);
    wall = mix(wall, alb * (sun * 0.62 + skyL), slab);
    vec3 b = mix(wall, recess, inWin);
    // ground floor: dark lobby and a red door
    if (p.y < -0.37) {
      b = mix(alb * skyL * 1.1, vec3(0.02, 0.022, 0.03), step(0.08, fract((p.x - bx0) / 0.23)));
      float door = step(abs(p.x - 0.16), 0.045) * step(p.y, -0.4);
      b = mix(b, s2l(vec3(0.78, 0.12, 0.08)) * (sun * 0.25 + skyL * 1.5), door);
    }
    // the building edge catches the sun; a cooler shadow at the base of the parapet
    float edge = cover(bx0 - p.x, PX) * cover(p.y - btop, PX);
    c = mix(c, b, edge);
  }
  // pavement
  if (p.y < -0.46) {
    vec3 alb = s2l(vec3(0.55, 0.52, 0.48)) * (0.85 + 0.25 * fbm(p * vec2(20.0, 60.0)));
    vec3 pav = alb * (sun * 0.35 + skyL);
    c = mix(c, pav, cover(p.y + 0.46, PX));
  }
  // olive tree in front of the shaded building
  vec2 tq = p - vec2(-0.48, -0.22);
  float crown = sdEllipse(tq, vec2(0.16, 0.13)) - 0.03 * (fbm(tq * 22.0) - 0.5);
  float trunk = sdBox(p - vec2(-0.48, -0.42), vec2(0.008, 0.12));
  float tc = cover(crown, PX * 1.5);
  vec3 leaf = s2l(vec3(0.36, 0.42, 0.22)) * (0.55 + 0.6 * fbm(tq * 30.0));
  vec3 leafLit = leaf * (sun * 0.35 * smoothstep(0.1, -0.12, tq.x) + skyL * 1.2);
  c = mix(c, s2l(vec3(0.25, 0.2, 0.15)) * skyL * 1.5, cover(trunk, PX));
  c = mix(c, leafLit, tc);
  g_mask = 0.0;
  return c;
}
`;

export const STILLLIFE = /* glsl */ `
uniform vec4 u_chart; // x0, y0, x1, y1 in scene coordinates
uniform vec4 u_card;  // grey card rectangle
vec3 chartPatch(int i) {
  vec3 v[24] = vec3[24](
    vec3(115, 82, 68), vec3(194, 150, 130), vec3(98, 122, 157), vec3(87, 108, 67), vec3(133, 128, 177), vec3(103, 189, 170),
    vec3(214, 126, 44), vec3(80, 91, 166), vec3(193, 90, 99), vec3(94, 60, 108), vec3(157, 188, 64), vec3(224, 163, 46),
    vec3(56, 61, 150), vec3(70, 148, 73), vec3(175, 54, 60), vec3(231, 199, 31), vec3(187, 86, 149), vec3(8, 133, 161),
    vec3(243, 243, 242), vec3(200, 200, 200), vec3(160, 160, 160), vec3(122, 122, 121), vec3(85, 85, 85), vec3(52, 52, 52));
  return v[i] / 255.0;
}
vec3 sphereShade(vec2 q, float r, vec3 alb, float gloss, vec3 key, vec3 Ld, vec3 amb, out float cov) {
  cov = cover(length(q) - r, PX);
  vec2 e = q / r;
  float z = sqrt(max(1.0 - dot(e, e), 0.0));
  vec3 n = normalize(vec3(e, z));
  float kd = max(dot(n, Ld), 0.0);
  float bounce = max(-n.y, 0.0) * 0.25;
  vec3 c = alb * (key * kd + amb + vec3(0.12, 0.08, 0.05) * bounce);
  c += key * pow(max(dot(reflect(-Ld, n), vec3(0, 0, 1)), 0.0), 40.0) * gloss;
  return c;
}
vec3 scene(vec2 p, float t) {
  vec3 key = vec3(1.0);
  vec3 Ld = normalize(vec3(-0.62, 0.5, 0.6));
  vec3 amb = vec3(0.07, 0.075, 0.085);
  float tableY = -0.1;
  vec3 c;
  // wall with window-light falloff and a soft shadow from the objects
  if (p.y > tableY) {
    vec3 alb = s2l(vec3(0.66, 0.63, 0.58)) * (0.92 + 0.12 * fbm(p * 8.0));
    float fall = 0.35 + 0.95 * exp(-length(p - vec2(-0.9, 0.4)) * 1.3);
    float shadow = 1.0 - 0.45 * exp(-pow(length((p - vec2(0.42, -0.02)) * vec2(1.0, 2.0)) / 0.14, 2.0));
    c = alb * (key * fall * shadow * 0.85 + amb);
  } else {
    vec2 tq = vec2(p.x, (p.y - tableY) * 3.0);
    float grain = fbm(vec2(tq.x * 2.0 + fbm(tq * 3.0) * 1.5, tq.y * 26.0));
    vec3 alb = mix(s2l(vec3(0.42, 0.26, 0.16)), s2l(vec3(0.58, 0.38, 0.24)), grain);
    float fall = 0.55 + 0.55 * exp(-length(p - vec2(-0.8, -0.1)) * 1.1);
    c = alb * (key * fall + amb);
    // contact shadows, cast to the right (light from the upper-left)
    float sh = 0.0;
    sh += exp(-pow(length((p - vec2(0.33, -0.27)) * vec2(0.8, 3.0)) / 0.09, 2.0));
    sh += exp(-pow(length((p - vec2(0.5, -0.29)) * vec2(0.9, 3.2)) / 0.07, 2.0));
    sh += exp(-pow(length((p - vec2(0.13, -0.28)) * vec2(0.7, 3.0)) / 0.08, 2.0));
    sh += exp(-pow(length((p - vec2(0.64, -0.33)) * vec2(0.9, 3.0)) / 0.05, 2.0));
    c *= 1.0 - 0.75 * clamp(sh, 0.0, 1.0);
  }
  // grey card (18% reflectance), evenly lit
  float gc = cover(sdBox(p - (u_card.xy + u_card.zw) * 0.5, (u_card.zw - u_card.xy) * 0.5), PX);
  c = mix(c, vec3(0.18) * key, gc);
  // blue ceramic cup
  {
    vec2 q = p - vec2(0.06, -0.165);
    float body = sdRoundBox(q, vec2(0.068, 0.085), 0.012);
    float handle = abs(sdEllipse(q - vec2(0.085, 0.01), vec2(0.035, 0.045))) - 0.009;
    float cov = cover(min(body, handle), PX);
    float nx = clamp(q.x / 0.068, -1.0, 1.0);
    vec3 n = normalize(vec3(nx, 0.0, sqrt(max(1.0 - nx * nx, 0.0))));
    vec3 alb = s2l(vec3(0.16, 0.32, 0.6));
    float kd = max(dot(n, Ld), 0.0);
    vec3 cc = alb * (key * kd + amb);
    cc += key * pow(max(dot(reflect(-Ld, n), vec3(0, 0, 1)), 0.0), 60.0) * 0.6;
    float rim = cover(abs(q.y - 0.085) - 0.006, PX) * cover(abs(q.x) - 0.066, PX);
    cc = mix(cc, alb * 0.5 * amb * 8.0, rim);
    c = mix(c, cc, cov);
  }
  float cov;
  // orange
  vec3 o = sphereShade(p - vec2(0.27, -0.2), 0.085, s2l(vec3(0.91, 0.46, 0.13)), 0.2, key, Ld, amb, cov);
  o *= 0.92 + 0.12 * vnoise((p - vec2(0.27, -0.2)) * 160.0);
  c = mix(c, o, cov);
  // leaves
  for (int i = 0; i < 3; i++) {
    float a = 0.6 + float(i) * 0.55;
    vec2 lq = p - vec2(0.22 + float(i) * 0.04, -0.105 + float(i) * 0.01);
    lq = mat2(cos(a), -sin(a), sin(a), cos(a)) * lq;
    float lc = cover(sdEllipse(lq, vec2(0.05, 0.016)), PX);
    vec3 leaf = s2l(vec3(0.28, 0.48, 0.18)) * (key * (0.55 + 0.4 * float(i == 1)) + amb);
    leaf *= 1.0 - 0.3 * cover(abs(lq.y) - 0.0015, PX);
    c = mix(c, leaf, lc);
  }
  // lemon
  {
    vec2 q = (p - vec2(0.45, -0.24)) / vec2(1.25, 1.0);
    vec3 l = sphereShade(q, 0.058, s2l(vec3(0.93, 0.8, 0.2)), 0.25, key, Ld, amb, cov);
    c = mix(c, l * (0.94 + 0.1 * vnoise(q * 200.0)), cov);
  }
  // plum
  vec3 pl = sphereShade(p - vec2(0.64, -0.3), 0.045, s2l(vec3(0.38, 0.14, 0.35)), 0.45, key, Ld, amb, cov);
  c = mix(c, pl, cov);
  // reference chart: black card, 6×4 patches, lit at exactly 1.0 so linear values = reflectance
  vec2 c0 = u_chart.xy, c1 = u_chart.zw;
  float card = cover(sdBox(p - (c0 + c1) * 0.5, (c1 - c0) * 0.5), PX);
  if (card > 0.0) {
    vec3 cc = vec3(0.02);
    vec2 uvc = (p - c0) / (c1 - c0);
    vec2 cell = vec2(uvc.x * 6.0, (1.0 - uvc.y) * 4.0);
    vec2 ci = floor(cell);
    vec2 cf = fract(cell);
    if (ci.x >= 0.0 && ci.x < 6.0 && ci.y >= 0.0 && ci.y < 4.0) {
      float inP = step(0.1, cf.x) * step(cf.x, 0.9) * step(0.1, cf.y) * step(cf.y, 0.9);
      int idx = int(ci.y) * 6 + int(ci.x);
      vec3 patchLin = pow(chartPatch(idx), vec3(2.2));
      cc = mix(cc, patchLin, inP);
    }
    c = mix(c, cc, card);
  }
  g_mask = 0.0;
  return c;
}
`;

export const SNEAKER = /* glsl */ `
vec3 colourway(int i, out vec3 accent, out vec3 bg) {
  if (i == 1) { accent = s2l(vec3(0.85, 0.66, 0.38)); bg = s2l(vec3(0.12, 0.12, 0.13)); return s2l(vec3(0.09, 0.09, 0.1)); }
  if (i == 2) { accent = s2l(vec3(0.95, 0.94, 0.9)); bg = s2l(vec3(0.62, 0.72, 0.78)); return s2l(vec3(0.17, 0.34, 0.68)); }
  if (i == 3) { accent = s2l(vec3(0.14, 0.14, 0.15)); bg = s2l(vec3(0.84, 0.36, 0.25)); return s2l(vec3(0.94, 0.92, 0.87)); }
  accent = s2l(vec3(0.75, 0.2, 0.15)); bg = s2l(vec3(0.82, 0.78, 0.71));
  return s2l(vec3(0.93, 0.91, 0.86));
}
vec3 scene(vec2 p, float t) {
  int cw = int(u_variant + 0.5);
  vec3 accent, bg;
  vec3 upperC = colourway(cw, accent, bg);
  vec3 key = vec3(1.0, 0.97, 0.93) * 1.5;
  vec3 amb = vec3(0.1, 0.105, 0.115);
  // seamless backdrop sweep with a soft floor
  float floorY = -0.23;
  float sweep = smoothstep(floorY - 0.05, floorY + 0.25, p.y);
  float light = 0.55 + 0.6 * exp(-length(p - vec2(-0.4, 0.4)) * 1.2);
  vec3 c = bg * mix(0.62, 1.0, sweep) * light;
  // plinth
  vec2 pq = p - vec2(0.0, -0.36);
  float plinth = sdBox(pq, vec2(0.46, 0.13));
  if (plinth < PX) {
    vec3 alb = s2l(vec3(0.78, 0.77, 0.74)) * (0.9 + 0.1 * fbm(p * 40.0));
    float top = smoothstep(0.115, 0.13, pq.y);
    vec3 pc = alb * (key * mix(0.42, 0.95, top) + amb);
    c = mix(c, pc, cover(plinth, PX));
  }
  // shoe, side view, toe to the left
  float s = 0.62;
  vec2 q = (p - vec2(0.0, -0.11)) / s;
  float spring = 0.07 * pow(smoothstep(-0.18, -0.5, q.x), 2.0);
  vec2 sq = q - vec2(0.0, spring);
  float sole = sdRoundBox(sq - vec2(0.02, -0.085), vec2(0.5, 0.045), 0.04);
  float upper = sdEllipse(sq - vec2(-0.28, 0.0), vec2(0.22, 0.085));
  upper = smin(upper, sdRoundBox(sq - vec2(0.05, 0.04), vec2(0.3, 0.1), 0.06), 0.06);
  upper = smin(upper, sdEllipse(sq - vec2(0.36, 0.07), vec2(0.15, 0.15)), 0.05);
  float opening = sdEllipse(sq - vec2(0.27, 0.19), vec2(0.2, 0.065));
  upper = max(upper, -opening);
  upper = max(upper, sq.y - 0.21);
  float shadow = exp(-pow(length((p - vec2(0.02, -0.235)) * vec2(1.0, 7.0)) / 0.3, 2.0));
  c *= 1.0 - 0.6 * shadow;
  float uc = cover(upper, PX / s);
  if (uc > 0.0) {
    float ny = clamp((sq.y + 0.04) / 0.22, 0.0, 1.0);
    float shade = 0.5 + 0.55 * ny;
    vec3 u = upperC * (key * shade + amb);
    // toe overlay and heel counter in accent
    float mud = step(sq.y, -0.015 + 0.06 * smoothstep(-0.05, -0.45, sq.x)) * step(sq.x, -0.02);
    float heel = step(0.3, sq.x + sq.y * 0.4) * step(sq.y, 0.12);
    float wave = abs(sq.y - (0.02 + 0.09 * smoothstep(-0.25, 0.3, sq.x) + 0.02 * sin(sq.x * 9.0))) - 0.018;
    float waveM = cover(wave, 0.004) * step(-0.25, sq.x) * step(sq.x, 0.28);
    u = mix(u, accent * (key * shade + amb), max(max(mud, heel), waveM));
    // stitching along the overlay edge
    float stitch = cover(abs(sq.y - (-0.015 + 0.06 * smoothstep(-0.05, -0.45, sq.x)) - 0.012) - 0.0025, 0.002) * step(0.5, fract(sq.x * 60.0)) * step(sq.x, -0.03);
    u = mix(u, u * 0.55, stitch);
    // laces
    for (int i = 0; i < 6; i++) {
      vec2 lp = vec2(-0.16 + float(i) * 0.055, 0.075 + float(i) * 0.02);
      float lace = sdRoundBox(sq - lp, vec2(0.022, 0.007), 0.006);
      u = mix(u, s2l(vec3(0.95)) * (key * 0.9 + amb), cover(lace, 0.003));
    }
    // edge light and soft occlusion where upper meets sole
    u += key * 0.18 * exp(-max(-upper, 0.0) * 90.0) * smoothstep(0.0, 0.1, sq.y);
    u *= 1.0 - 0.35 * exp(-(sq.y + 0.04) * 30.0);
    c = mix(c, u, uc);
  }
  float sc = cover(sole, PX / s);
  if (sc > 0.0) {
    float ny = clamp((sq.y + 0.13) / 0.09, 0.0, 1.0);
    vec3 sole = s2l(vec3(0.94, 0.93, 0.9)) * (key * (0.45 + 0.5 * ny) + amb);
    float out_ = step(sq.y, -0.112 + spring * 0.0);
    sole = mix(sole, s2l(vec3(0.55, 0.38, 0.24)) * (key * 0.4 + amb), out_);
    sole *= 1.0 - 0.25 * cover(abs(sq.y + 0.07) - 0.002, 0.002);
    c = mix(c, sole, sc);
  }
  g_mask = max(uc, sc);
  return c;
}
`;

export const BARS = /* glsl */ `
// Test pattern: 75% colour bars over a stepped and a smooth grey ramp. Values are display-referred,
// decoded here to linear so the pipeline (with roll-off disabled) reproduces them exactly.
vec3 scene(vec2 p, float t) {
  float a = u_res.x / u_res.y;
  vec2 uv = vec2(p.x / a + 0.5, p.y + 0.5);
  vec3 c;
  if (uv.y > 0.38) {
    int i = int(floor(uv.x * 7.0));
    vec3 bars[7] = vec3[7](vec3(0.75), vec3(0.75, 0.75, 0.0), vec3(0.0, 0.75, 0.75), vec3(0.0, 0.75, 0.0), vec3(0.75, 0.0, 0.75), vec3(0.75, 0.0, 0.0), vec3(0.0, 0.0, 0.75));
    c = bars[clamp(i, 0, 6)];
  } else if (uv.y > 0.2) {
    c = vec3(floor(uv.x * 11.0) / 10.0);
  } else {
    c = vec3(uv.x);
  }
  g_mask = 0.0;
  return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, step(c, vec3(0.04045)));
}
`;

export const SCENE_SOURCES: Record<string, string> = {
  coast: COAST,
  portrait: PORTRAIT,
  street: STREET,
  facade: FACADE,
  stilllife: STILLLIFE,
  sneaker: SNEAKER,
  bars: BARS,
};
