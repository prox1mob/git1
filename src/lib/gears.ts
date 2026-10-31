import type { Vec2 } from './types';

const inv = (a: number) => Math.tan(a) - a;

export interface GearGeom {
  z: number;
  m: number;
  r: number; // pitch radius
  ra: number; // tip radius
  rf: number; // root radius
  rb: number; // base radius
}

export function gearGeom(z: number, m: number, pressureDeg = 20): GearGeom {
  const r = (m * z) / 2;
  return { z, m, r, ra: r + m, rf: r - 1.25 * m, rb: r * Math.cos((pressureDeg * Math.PI) / 180) };
}

/**
 * Involute spur-gear outline (standard full-depth teeth, 20° pressure angle).
 * Tooth 0 is centred on angle 0.
 */
export function gearOutline(z: number, m: number, pressureDeg = 20, flankPts = 8): Vec2[] {
  const g = gearGeom(z, m, pressureDeg);
  const alpha = (pressureDeg * Math.PI) / 180;
  const halfPitchAngle = Math.PI / (2 * z) + inv(alpha);
  const psi = (rr: number) => {
    const rc = Math.max(rr, g.rb);
    return halfPitchAngle - inv(Math.acos(g.rb / rc));
  };
  const polar = (rr: number, a: number): Vec2 => [rr * Math.cos(a), rr * Math.sin(a)];
  const rStart = Math.max(g.rf, Math.min(g.rb, g.ra));
  const radii = Array.from({ length: flankPts + 1 }, (_, i) => rStart + ((g.ra - rStart) * i) / flankPts);
  const out: Vec2[] = [];
  for (let k = 0; k < z; k++) {
    const c = (2 * Math.PI * k) / z;
    // root to base (radial) then involute up the right flank
    out.push(polar(g.rf, c - psi(rStart)));
    for (const rr of radii) out.push(polar(rr, c - psi(rr)));
    // tip land
    const tip = psi(g.ra);
    for (let i = 1; i < 3; i++) out.push(polar(g.ra, c - tip + (2 * tip * i) / 3));
    for (const rr of [...radii].reverse()) out.push(polar(rr, c + psi(rr)));
    out.push(polar(g.rf, c + psi(rStart)));
    // root land towards the next tooth
    const next = c + (2 * Math.PI) / z;
    const a0 = c + psi(rStart),
      a1 = next - psi(rStart);
    for (let i = 1; i < 4; i++) out.push(polar(g.rf, a0 + ((a1 - a0) * i) / 4));
  }
  return out;
}

/** Fractional tooth phase of a gear at a world direction β (0 = tooth centre, 0.5 = gap centre). */
export function phaseAt(beta: number, theta: number, z: number) {
  const p = (beta - theta) / ((2 * Math.PI) / z);
  return p - Math.floor(p);
}

/**
 * Initial angle for gear j meshing with gear i, where β is the direction from i to j.
 * Meshing requires a tooth of one gear to face a gap of the other: φi + φj ≡ 0.5.
 */
export function meshAngle(beta: number, thetaI: number, zI: number, zJ: number) {
  const phiI = phaseAt(beta, thetaI, zI);
  return beta + Math.PI - ((2 * Math.PI) / zJ) * (0.5 - phiI);
}
