export const VERT = /* glsl */ `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
`;

/** Shared maths: hashing, noise, SDFs. */
export const COMMON = /* glsl */ `
const float PI = 3.14159265359;
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
float fbm3(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.07 + vec2(5.3, 1.1); a *= 0.5; } return s; }
/** Author colours in sRGB hex-ish values, render in linear light. */
vec3 s2l(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdRoundBox(vec2 p, vec2 b, float r) { return sdBox(p, b - r) - r; }
float sdEllipse(vec2 p, vec2 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
/** Antialiased coverage of an SDF (negative inside). */
float cover(float d, float w) { return 1.0 - smoothstep(-w, w, d); }
float luma709(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/** Colour-space maths used by the grading pass. */
export const COLOR = /* glsl */ `
vec3 srgbEncode(vec3 c) {
  vec3 a = abs(c);
  vec3 lo = a * 12.92;
  vec3 hi = 1.055 * pow(a, vec3(1.0 / 2.4)) - 0.055;
  return sign(c) * mix(hi, lo, step(a, vec3(0.0031308)));
}
vec3 srgbDecode(vec3 c) {
  vec3 a = abs(c);
  vec3 lo = a / 12.92;
  vec3 hi = pow((a + 0.055) / 1.055, vec3(2.4));
  return sign(c) * mix(hi, lo, step(a, vec3(0.04045)));
}
vec3 linToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = sign(l) * pow(abs(l), 1.0 / 3.0); m = sign(m) * pow(abs(m), 1.0 / 3.0); s = sign(s) * pow(abs(s), 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklabToLin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
             -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
             -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
// Camera log transfer functions (published formulas). 0 = S-Log3, 1 = LogC3 EI800, 2 = V-Log
float logEnc(float x, int id) {
  if (id == 0) return x >= 0.01125 ? (420.0 + log(max((x + 0.01) / 0.19, 1e-6)) / log(10.0) * 261.5) / 1023.0 : (x * (171.2102946929 - 95.0) / 0.01125 + 95.0) / 1023.0;
  if (id == 1) return x > 0.010591 ? 0.24719 * log(5.555556 * x + 0.052272) / log(10.0) + 0.385537 : 5.367655 * x + 0.092809;
  return x < 0.01 ? 5.6 * x + 0.125 : 0.241514 * log(x + 0.00873) / log(10.0) + 0.598206;
}
float logDec(float y, int id) {
  if (id == 0) return y >= 171.2102946929 / 1023.0 ? pow(10.0, (y * 1023.0 - 420.0) / 261.5) * 0.19 - 0.01 : (y * 1023.0 - 95.0) * 0.01125 / (171.2102946929 - 95.0);
  if (id == 1) return y > 5.367655 * 0.010591 + 0.092809 ? (pow(10.0, (y - 0.385537) / 0.24719) - 0.052272) / 5.555556 : (y - 0.092809) / 5.367655;
  return y < 0.181 ? (y - 0.125) / 5.6 : pow(10.0, (y - 0.598206) / 0.241514) - 0.00873;
}
vec3 logEnc3(vec3 c, int id) { return vec3(logEnc(c.r, id), logEnc(c.g, id), logEnc(c.b, id)); }
vec3 logDec3(vec3 c, int id) { return vec3(logDec(c.r, id), logDec(c.g, id), logDec(c.b, id)); }
`;
