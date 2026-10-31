import { useProgress } from '../store/progress';
import { Seg, Toggle } from './ui';
import type { Difficulty } from '../lib/types';

export function SettingsPanel({ compact }: { compact?: boolean }) {
  const settings = useProgress((s) => s.settings);
  const set = useProgress((s) => s.setSettings);
  return (
    <div className="card">
      <h3>Settings</h3>
      <div className="field">
        <span className="lbl">Mode (sets measurement tolerances and how strict scoring is)</span>
        <Seg<Difficulty>
          value={settings.difficulty}
          onChange={(d) => set({ difficulty: d })}
          options={[
            { v: 'beginner', label: 'Beginner ±8%' },
            { v: 'intermediate', label: 'Intermediate ±4%' },
            { v: 'advanced', label: 'Advanced ±2%' },
          ]}
        />
      </div>
      <Toggle checked={settings.tamil} onChange={(v) => set({ tamil: v })} label="Show Tamil explanations (தமிழ் விளக்கங்கள்)" />
      <Toggle checked={settings.hints} onChange={(v) => set({ hints: v })} label="Offer optional hints (clearing without hints earns +20% XP)" />
      <Toggle checked={settings.explorer} onChange={(v) => set({ explorer: v })} label="Explorer mode — unlock every playable level and tool (free building)" />
      {!compact && (
        <div className="field">
          <span className="lbl">Default length unit in the editor</span>
          <Seg value={settings.unit} onChange={(u) => set({ unit: u })} options={[{ v: 'mm', label: 'mm' }, { v: 'cm', label: 'cm' }, { v: 'm', label: 'm' }, { v: 'in', label: 'in' }]} />
        </div>
      )}
    </div>
  );
}
