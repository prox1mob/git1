import * as THREE from 'three';
import type { MaterialSpec } from './shapes';

export type MaterialCategory = 'Plastics' | 'Metals' | 'Rubber' | 'Glass' | 'Wood' | 'Ceramics' | 'Fabrics' | 'Composites';

export interface EngProps {
  density: number; // kg/m^3
  E: number; // Young's modulus, GPa
  strength: number; // tensile/yield strength, MPa (approximate)
  k: number; // thermal conductivity W/(m·K)
  maxTemp: number; // approx. max continuous service temp °C
  cost: 1 | 2 | 3 | 4 | 5; // relative raw-material cost
  brittle: boolean;
  notes: string;
}

export interface MaterialPreset {
  id: string;
  name: string;
  category: MaterialCategory;
  color: string;
  roughness: number;
  metalness: number;
  transmission?: number;
  opacity?: number;
  clearcoat?: number;
  sheen?: number;
  texture?: 'wood' | 'fabric' | 'carbon' | 'brushed';
  eng: EngProps;
}

/** Typical, rounded textbook values for teaching. Real grades vary widely. */
export const MATERIALS: MaterialPreset[] = [
  { id: 'abs', name: 'ABS plastic', category: 'Plastics', color: '#e9edf2', roughness: 0.45, metalness: 0, clearcoat: 0.2, eng: { density: 1050, E: 2.3, strength: 40, k: 0.17, maxTemp: 80, cost: 1, brittle: false, notes: 'Tough, easy to mould; common for electronics housings.' } },
  { id: 'pla', name: 'PLA (3D printing)', category: 'Plastics', color: '#f8961e', roughness: 0.55, metalness: 0, eng: { density: 1240, E: 3.5, strength: 50, k: 0.13, maxTemp: 55, cost: 1, brittle: true, notes: 'Easy to print; softens in a hot car.' } },
  { id: 'pc', name: 'Polycarbonate (clear)', category: 'Plastics', color: '#d8f1ff', roughness: 0.08, metalness: 0, transmission: 0.9, clearcoat: 1, eng: { density: 1200, E: 2.4, strength: 65, k: 0.2, maxTemp: 115, cost: 2, brittle: false, notes: 'Transparent and very impact-resistant (safety glasses).' } },
  { id: 'alu', name: 'Aluminium 6061', category: 'Metals', color: '#c9ced6', roughness: 0.32, metalness: 1, texture: 'brushed', eng: { density: 2700, E: 69, strength: 276, k: 167, maxTemp: 150, cost: 3, brittle: false, notes: 'Light, stiff for its weight, conducts heat very well.' } },
  { id: 'steel', name: 'Stainless steel 304', category: 'Metals', color: '#b7bcc4', roughness: 0.22, metalness: 1, eng: { density: 8000, E: 193, strength: 215, k: 16, maxTemp: 800, cost: 3, brittle: false, notes: 'Strong, corrosion-resistant, heavy.' } },
  { id: 'brass', name: 'Brass', category: 'Metals', color: '#d4a64a', roughness: 0.25, metalness: 1, eng: { density: 8500, E: 100, strength: 200, k: 109, maxTemp: 300, cost: 4, brittle: false, notes: 'Machines beautifully; decorative and low-friction.' } },
  { id: 'rubber', name: 'Natural rubber', category: 'Rubber', color: '#2b2d31', roughness: 0.9, metalness: 0, eng: { density: 930, E: 0.005, strength: 20, k: 0.13, maxTemp: 70, cost: 2, brittle: false, notes: 'Very flexible, grippy, absorbs vibration.' } },
  { id: 'silicone', name: 'Silicone', category: 'Rubber', color: '#e76f51', roughness: 0.7, metalness: 0, eng: { density: 1100, E: 0.003, strength: 8, k: 0.2, maxTemp: 200, cost: 3, brittle: false, notes: 'Flexible across a wide temperature range; food-safe grades.' } },
  { id: 'glass', name: 'Soda-lime glass', category: 'Glass', color: '#e8fbff', roughness: 0.02, metalness: 0, transmission: 1, eng: { density: 2500, E: 70, strength: 45, k: 1.0, maxTemp: 450, cost: 2, brittle: true, notes: 'Stiff, scratch-resistant, transparent, brittle.' } },
  { id: 'boro', name: 'Borosilicate glass', category: 'Glass', color: '#eafcff', roughness: 0.03, metalness: 0, transmission: 1, eng: { density: 2230, E: 64, strength: 40, k: 1.1, maxTemp: 500, cost: 3, brittle: true, notes: 'Low thermal expansion: survives hot/cold shocks (lab & ovenware).' } },
  { id: 'oak', name: 'Oak (along grain)', category: 'Wood', color: '#a9784a', roughness: 0.75, metalness: 0, texture: 'wood', eng: { density: 750, E: 11, strength: 90, k: 0.17, maxTemp: 120, cost: 2, brittle: false, notes: 'Anisotropic: much stronger along the grain than across it.' } },
  { id: 'bamboo', name: 'Bamboo', category: 'Wood', color: '#d8b779', roughness: 0.6, metalness: 0, texture: 'wood', eng: { density: 700, E: 15, strength: 150, k: 0.17, maxTemp: 120, cost: 2, brittle: false, notes: 'Fast-growing, strong in tension along fibres.' } },
  { id: 'porcelain', name: 'Porcelain', category: 'Ceramics', color: '#f4f4f0', roughness: 0.15, metalness: 0, clearcoat: 1, eng: { density: 2400, E: 70, strength: 40, k: 1.5, maxTemp: 1000, cost: 2, brittle: true, notes: 'Hard, heat-resistant, chemically inert, brittle.' } },
  { id: 'alumina', name: 'Alumina ceramic', category: 'Ceramics', color: '#f0ece2', roughness: 0.35, metalness: 0, eng: { density: 3900, E: 370, strength: 260, k: 30, maxTemp: 1500, cost: 4, brittle: true, notes: 'Extremely hard and stiff; electrical insulator.' } },
  { id: 'canvas', name: 'Cotton canvas', category: 'Fabrics', color: '#c8b99a', roughness: 1, metalness: 0, sheen: 1, texture: 'fabric', eng: { density: 1500, E: 0.5, strength: 30, k: 0.05, maxTemp: 150, cost: 1, brittle: false, notes: 'Flexible sheet; strong in tension, no stiffness in bending.' } },
  { id: 'polyester', name: 'Polyester knit', category: 'Fabrics', color: '#3a6ea5', roughness: 0.95, metalness: 0, sheen: 1, texture: 'fabric', eng: { density: 1380, E: 0.3, strength: 50, k: 0.05, maxTemp: 150, cost: 1, brittle: false, notes: 'Stretchy, breathable when knitted, quick-drying.' } },
  { id: 'cfrp', name: 'Carbon-fibre composite', category: 'Composites', color: '#1e2126', roughness: 0.3, metalness: 0.2, clearcoat: 1, texture: 'carbon', eng: { density: 1600, E: 70, strength: 600, k: 5, maxTemp: 120, cost: 5, brittle: true, notes: 'Exceptional stiffness and strength per weight; expensive.' } },
  { id: 'gfrp', name: 'Glass-fibre composite', category: 'Composites', color: '#d9e3c8', roughness: 0.4, metalness: 0, clearcoat: 0.6, eng: { density: 1900, E: 25, strength: 300, k: 0.3, maxTemp: 120, cost: 3, brittle: false, notes: 'Strong and cheaper than carbon: boats, helmets, PCBs.' } },
];

export const MATERIAL_CATEGORIES: MaterialCategory[] = ['Plastics', 'Metals', 'Rubber', 'Glass', 'Wood', 'Ceramics', 'Fabrics', 'Composites'];
export const materialById = (id: string) => MATERIALS.find((m) => m.id === id);

export function specFromPreset(id: string, color?: string): MaterialSpec {
  const m = materialById(id) ?? MATERIALS[0];
  return { preset: m.id, color: color ?? m.color, roughness: m.roughness, metalness: m.metalness, opacity: 1 };
}

/* --------- Procedural textures (generated locally, no downloads) --------- */
const texCache = new Map<string, THREE.Texture>();
export function proceduralTexture(kind: 'wood' | 'fabric' | 'carbon' | 'brushed'): THREE.Texture {
  const hit = texCache.get(kind);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  if (kind === 'wood') {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const y = Math.random() * 256;
      g.strokeStyle = `rgba(80,45,15,${0.08 + Math.random() * 0.22})`;
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 40 + i) * 4);
      g.stroke();
    }
  } else if (kind === 'fabric') {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 4) {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(i, 0, 2, 256);
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(0, i, 256, 2);
    }
  } else if (kind === 'carbon') {
    for (let y = 0; y < 256; y += 16)
      for (let x = 0; x < 256; x += 16) {
        const odd = ((x + y) / 16) % 2 === 0;
        const grd = odd ? g.createLinearGradient(x, y, x + 16, y) : g.createLinearGradient(x, y, x, y + 16);
        grd.addColorStop(0, '#9a9a9a');
        grd.addColorStop(0.5, '#ffffff');
        grd.addColorStop(1, '#8a8a8a');
        g.fillStyle = grd;
        g.fillRect(x, y, 16, 16);
      }
  } else {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
      g.fillRect(0, Math.random() * 256, 256, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(kind === 'carbon' ? 3 : 1, kind === 'carbon' ? 3 : 1);
  texCache.set(kind, t);
  return t;
}
