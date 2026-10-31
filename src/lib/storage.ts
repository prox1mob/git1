import { createStore, del, entries, get, set } from 'idb-keyval';
import type { SceneObject } from './shapes';

export interface ProjectVersion {
  at: string;
  note: string;
  thumb: string;
  objects: SceneObject[];
}
export interface Project {
  id: string;
  name: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  versions: ProjectVersion[];
}
export interface PortfolioEntry {
  id: string;
  title: string;
  levelId?: string;
  score?: number;
  at: string;
  thumb?: string;
  notes?: string;
  rubric?: { criterion: string; points: number; max: number }[];
}

const projDb = createStore('the-3d-lab-projects', 'projects');
const portDb = createStore('the-3d-lab-portfolio', 'entries');

export async function listProjects(): Promise<Project[]> {
  const all = (await entries<string, Project>(projDb)).map(([, v]) => v);
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export const getProject = (id: string) => get<Project>(id, projDb);
export const putProject = (p: Project) => set(p.id, p, projDb);
export const deleteProject = (id: string) => del(id, projDb);

/** Save a new version of a project (creating it if needed). Returns the project. */
export async function saveVersion(opts: { id?: string; name: string; source: string; objects: SceneObject[]; thumb: string; note?: string }): Promise<Project> {
  const now = new Date().toISOString();
  const prev = opts.id ? await getProject(opts.id) : undefined;
  const p: Project = prev ?? { id: `p${Date.now().toString(36)}`, name: opts.name, source: opts.source, createdAt: now, updatedAt: now, versions: [] };
  p.name = opts.name;
  p.updatedAt = now;
  p.versions = [...p.versions, { at: now, note: opts.note ?? `Version ${p.versions.length + 1}`, thumb: opts.thumb, objects: JSON.parse(JSON.stringify(opts.objects)) }].slice(-20);
  await putProject(p);
  return p;
}

export async function listPortfolio(): Promise<PortfolioEntry[]> {
  const all = (await entries<string, PortfolioEntry>(portDb)).map(([, v]) => v);
  return all.sort((a, b) => b.at.localeCompare(a.at));
}
export const putPortfolio = (e: PortfolioEntry) => set(e.id, e, portDb);
export const deletePortfolio = (id: string) => del(id, portDb);

/* Lightweight hand-off between screens (e.g. Sketch-to-3D → Editor). */
const INCOMING = 'the-3d-lab-incoming';
export function sendToEditor(objs: SceneObject[]) {
  localStorage.setItem(INCOMING, JSON.stringify(objs));
}
export function takeIncoming(): SceneObject[] | null {
  const raw = localStorage.getItem(INCOMING);
  if (!raw) return null;
  localStorage.removeItem(INCOMING);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
