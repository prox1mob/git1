import { useRef } from 'react';
import { add, headingDeg, polar, snap, sub, type Vec } from '../../../core/geometry';
import { Handle, useSvgDrag } from '../../../ui/svg';

export interface ProtractorState {
  c: Vec;
  /** rotation of the baseline, degrees counter-clockwise */
  rot: number;
}

/**
 * A real two-scale protractor: drag the body to move it, drag the round knob to rotate.
 * Outer (dark) scale counts counter-clockwise from the right-hand zero;
 * inner (red) scale counts clockwise from the left-hand zero — just like a plastic one.
 */
export function Protractor({ s, onChange, onStart, R = 170 }: {
  s: ProtractorState; onChange: (s: ProtractorState) => void; onStart?: () => void; R?: number;
}) {
  const startC = useRef<Vec>(s.c);
  const drag = useSvgDrag({
    onStart: () => {
      startC.current = s.c;
      onStart?.();
    },
    onMove: (p, start) => onChange({ ...s, c: add(startC.current, sub(p, start)) }),
  });
  const ticks = [];
  for (let t = 0; t <= 180; t++) {
    const long = t % 10 === 0 ? 16 : t % 5 === 0 ? 10 : 6;
    const a = polar({ x: 0, y: 0 }, R, t);
    const b = polar({ x: 0, y: 0 }, R - long, t);
    ticks.push(<line key={t} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1f2a44" strokeWidth={t % 10 === 0 ? 1.4 : 0.8} />);
    if (t % 10 === 0) {
      const o = polar({ x: 0, y: 0 }, R - 27, t);
      const i = polar({ x: 0, y: 0 }, R - 45, t);
      ticks.push(
        <text key={`o${t}`} x={o.x} y={o.y} fontSize={11} fontWeight={700} fill="#1f2a44" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${90 - t} ${o.x} ${o.y})`}>{t}</text>,
        <text key={`i${t}`} x={i.x} y={i.y} fontSize={10} fontWeight={600} fill="#c92a2a" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${90 - t} ${i.x} ${i.y})`}>{180 - t}</text>,
      );
    }
  }
  const knob = polar(s.c, R + 24, s.rot);
  return (
    <g className="protractor">
      <g transform={`translate(${s.c.x} ${s.c.y}) rotate(${-s.rot})`} className="draggable" {...drag}>
        <path d={`M${-R - 8} 0 A${R + 8} ${R + 8} 0 0 1 ${R + 8} 0 L${R + 8} 14 L${-R - 8} 14 Z`} fill="rgba(208,235,255,0.62)" stroke="#4dabf7" strokeWidth={1.5} />
        <path d={`M${-R + 62} 0 A${R - 62} ${R - 62} 0 0 1 ${R - 62} 0 Z`} fill="rgba(255,255,255,0.35)" stroke="#a5d8ff" />
        {ticks}
        <line x1={-R - 8} y1={0} x2={R + 8} y2={0} stroke="#1f2a44" strokeWidth={1.4} />
        <line x1={0} y1={-12} x2={0} y2={12} stroke="#1f2a44" strokeWidth={1.4} />
        <circle r={4} fill="none" stroke="#e5484d" strokeWidth={1.8} />
        <text x={0} y={-R + 82} fontSize={10} textAnchor="middle" fill="#1971c2" fontWeight={700} pointerEvents="none">drag me</text>
      </g>
      <line x1={polar(s.c, R + 8, s.rot).x} y1={polar(s.c, R + 8, s.rot).y} x2={knob.x} y2={knob.y} stroke="#4dabf7" strokeWidth={2} />
      <Handle x={knob.x} y={knob.y} r={10} color="#1971c2" title="rotate the protractor" onStart={onStart}
        onDrag={(p) => onChange({ ...s, rot: snap(headingDeg(s.c, p), 0.5) })}>
        <text y={4} fontSize={13} textAnchor="middle" fill="#fff" pointerEvents="none">⟳</text>
      </Handle>
    </g>
  );
}
