import { useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Segmented, Slider, Toggle, cx } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { useElementWidth } from '../../lib/hooks';
import { clampWeight, fontById, FONTS } from '../../lib/fonts';
import { rangeScore } from '../../lib/color';

type ElId = 'title' | 'headline' | 'subtitle' | 'body' | 'caption';
type Align = 'left' | 'center' | 'right' | 'justify';
type Ink = 'ink' | 'grey' | 'accent';
interface Style { font: string; size: number; weight: number; align: Align; caps: boolean; tracking: number; leading: number; space: number; ink: Ink }
type Layout = Record<ElId, Style>;

const LABEL: Record<ElId, string> = { title: 'Section title', headline: 'Headline', subtitle: 'Subtitle (standfirst)', body: 'Body text', caption: 'Caption' };
const ORDER: ElId[] = ['title', 'headline', 'subtitle', 'caption', 'body'];
const INK: Record<Ink, string> = { ink: '#141414', grey: '#6b6b6b', accent: '#b8432f' };
const INK_WEIGHT: Record<Ink, number> = { ink: 1, grey: 0.78, accent: 0.95 };
const PAGE_FONTS = ['playfair', 'bodoni', 'garamond', 'sourceserif', 'fraunces', 'inter', 'dmsans', 'montserrat', 'spacegrotesk'];

const TEXT: Record<ElId, string> = {
  title: 'Perception',
  headline: 'The Quiet Power of Grey',
  subtitle: 'Why the most useful colour in a designer’s palette is the one nobody notices — and how neutrals make every other colour sing.',
  caption: 'Fig. 1 — The two inner squares are the same grey. The surround changes what you see.',
  body: 'Place a mid-grey square on black and it glows; move it onto white and it sinks. Nothing about the square has changed, yet your visual system has recalculated it against its neighbours. Painters have exploited this for centuries; Josef Albers built an entire course around it. For designers the lesson is practical. A neutral ground does not compete for attention, so the colour you place on it is read with full force. Greys also absorb the casts of the light around them, which is why a photographer carries a grey card and a colourist checks the neutrals before anything else. When a layout feels noisy, the fix is rarely another colour. It is usually more grey, more space and a clearer order of importance — one thing first, then the next, then the rest.',
};

const GOOD: Layout = {
  title: { font: 'inter', size: 10, weight: 600, align: 'left', caps: true, tracking: 160, leading: 1.2, space: 0, ink: 'accent' },
  headline: { font: 'playfair', size: 54, weight: 700, align: 'left', caps: false, tracking: -10, leading: 1.0, space: 14, ink: 'ink' },
  subtitle: { font: 'sourceserif', size: 17, weight: 400, align: 'left', caps: false, tracking: 0, leading: 1.35, space: 12, ink: 'grey' },
  caption: { font: 'inter', size: 8.5, weight: 400, align: 'left', caps: false, tracking: 10, leading: 1.35, space: 8, ink: 'grey' },
  body: { font: 'sourceserif', size: 10.5, weight: 400, align: 'left', caps: false, tracking: 0, leading: 1.5, space: 26, ink: 'ink' },
};
const BROKEN: Layout = {
  title: { font: 'montserrat', size: 26, weight: 800, align: 'center', caps: false, tracking: 0, leading: 1.1, space: 0, ink: 'ink' },
  headline: { font: 'inter', size: 18, weight: 400, align: 'left', caps: false, tracking: 0, leading: 1.2, space: 30, ink: 'grey' },
  subtitle: { font: 'playfair', size: 21, weight: 800, align: 'right', caps: false, tracking: 0, leading: 1.1, space: 4, ink: 'ink' },
  caption: { font: 'inter', size: 15, weight: 600, align: 'center', caps: false, tracking: 0, leading: 1.2, space: 4, ink: 'ink' },
  body: { font: 'inter', size: 12.5, weight: 700, align: 'center', caps: false, tracking: 0, leading: 1.1, space: 6, ink: 'ink' },
};

/** Prominence model: size dominates, then weight, colour contrast and capitals. A simplification of eye-tracking findings. */
export function prominence(s: Style) {
  return s.size * Math.sqrt(s.weight / 400) * INK_WEIGHT[s.ink] * (s.caps ? 1.08 : 1);
}
function predictedOrder(l: Layout): ElId[] {
  return [...ORDER].sort((a, b) => prominence(l[b]) - prominence(l[a]) || ORDER.indexOf(a) - ORDER.indexOf(b));
}

export default function HierarchyPuzzle({ level }: LevelProps) {
  return <LessonShell level={level} observe={<Observe />} experiment={<Experiment />} discover={<Discover />} challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

// ------------------------------------------------------------------ the page

function Page({ layout, selected, onSelect, showOrder, width }: { layout: Layout; selected?: ElId | null; onSelect?: (e: ElId) => void; showOrder?: boolean; width: number }) {
  const scale = width / 600;
  const order = predictedOrder(layout);
  const style = (id: ElId): CSSProperties => {
    const s = layout[id];
    const f = fontById(s.font);
    return {
      fontFamily: f.css,
      fontSize: s.size,
      fontWeight: clampWeight(f, s.weight),
      textAlign: s.align,
      textTransform: s.caps ? 'uppercase' : 'none',
      letterSpacing: `${s.tracking / 1000}em`,
      lineHeight: s.leading,
      marginTop: s.space,
      color: INK[s.ink],
      hyphens: id === 'body' ? 'auto' : 'manual',
    };
  };
  const el = (id: ElId, as: 'div' | 'h2' | 'p', children: string) => {
    const Tag = as;
    const rank = order.indexOf(id) + 1;
    return (
      <Tag
        style={style(id)}
        className={cx('relative rounded-[2px] transition-[outline-color]', onSelect && 'cursor-pointer outline outline-1 outline-transparent hover:outline-[#b8432f]/40', selected === id && 'outline-2 !outline-[#b8432f]', id === 'body' && 'columns-2 gap-[22px]')}
        onClick={onSelect ? () => onSelect(id) : undefined}
        role={onSelect ? 'button' : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-label={onSelect ? `Select ${LABEL[id]}` : undefined}
        key={id}
        onKeyDown={onSelect ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } } : undefined}
      >
        {showOrder && (
          <span className="absolute -left-9 top-0 grid h-6 w-6 place-items-center rounded-full bg-[#b8432f] font-sans text-[12px] font-semibold not-italic text-white normal-case tracking-normal" style={{ lineHeight: 1 }}>{rank}</span>
        )}
        {children}
      </Tag>
    );
  };
  return (
    <div style={{ width, height: 780 * scale }} className="relative overflow-hidden rounded-[3px] bg-paper shadow-2xl shadow-black/50">
      <div style={{ width: 600, height: 780, transform: `scale(${scale})`, transformOrigin: '0 0', padding: '52px 52px 40px 56px' }} className="overflow-hidden">
        {el('title', 'div', TEXT.title)}
        {el('headline', 'h2', TEXT.headline)}
        {el('subtitle', 'p', TEXT.subtitle)}
        <figure style={{ marginTop: 22 }}>
          <div className="grid h-[150px] grid-cols-2" aria-hidden>
            <div className="grid place-items-center bg-[#1b1b1b]"><div className="h-14 w-14 bg-[#7d7d7d]" /></div>
            <div className="grid place-items-center bg-[#ececec]"><div className="h-14 w-14 bg-[#7d7d7d]" /></div>
          </div>
          {el('caption', 'div', TEXT.caption)}
        </figure>
        {el('body', 'p', TEXT.body)}
      </div>
    </div>
  );
}

function StyleControls({ id, s, onChange }: { id: ElId; s: Style; onChange: (s: Style) => void }) {
  const f = fontById(s.font);
  const set = (p: Partial<Style>) => onChange({ ...s, ...p });
  const weights = [300, 400, 500, 600, 700, 900].filter((w) => clampWeight(f, w) === w || (f.steps && f.steps.includes(w)));
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">Editing</p>
        <p className="font-display text-[24px] text-ink-50">{LABEL[id]}</p>
      </div>
      <label className="block text-[13px] text-ink-200">Typeface
        <select value={s.font} onChange={(e) => set({ font: e.target.value, weight: clampWeight(fontById(e.target.value), s.weight) })} className="mt-1 h-11 w-full rounded-lg bg-ink-800 px-3 text-[14px] text-ink-50 ring-1 ring-ink-650">
          {PAGE_FONTS.map((fid) => <option key={fid} value={fid}>{FONTS.find((x) => x.id === fid)!.label}</option>)}
        </select>
      </label>
      <Slider label="Size (pt)" value={s.size} min={6} max={72} step={0.5} onChange={(v) => set({ size: v })} format={(v) => v.toFixed(1)} />
      <div>
        <p className="mb-1.5 text-[13px] text-ink-200">Weight</p>
        <Segmented size="sm" value={clampWeight(f, s.weight)} onChange={(v) => set({ weight: v })} options={(weights.length ? weights : [400]).map((w) => ({ value: w, label: String(w) }))} label="Weight" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented size="sm" value={s.align} onChange={(v) => set({ align: v })} label="Alignment"
          options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }, ...(id === 'body' ? [{ value: 'justify' as Align, label: 'Justify' }] : [])]} />
        <Toggle checked={s.caps} onChange={(v) => set({ caps: v })} label="Capitals" />
      </div>
      <Segmented size="sm" value={s.ink} onChange={(v) => set({ ink: v })} label="Colour" options={[{ value: 'ink', label: 'Ink' }, { value: 'grey', label: 'Grey' }, { value: 'accent', label: 'Accent' }]} />
      <Slider label="Tracking (‰ em)" value={s.tracking} min={-50} max={250} step={5} onChange={(v) => set({ tracking: v })} format={(v) => (v > 0 ? `+${v}` : String(v))} defaultValue={0} />
      <Slider label="Leading (line height)" value={s.leading} min={0.85} max={2} step={0.01} onChange={(v) => set({ leading: v })} format={(v) => `${v.toFixed(2)}×`} />
      <Slider label="Space above (pt)" value={s.space} min={0} max={60} step={1} onChange={(v) => set({ space: v })} format={(v) => String(v)} />
    </div>
  );
}

function Editor({ initial, showOrderDefault, children, onLayout }: { initial: Layout; showOrderDefault: boolean; children?: (l: Layout) => ReactNode; onLayout?: (l: Layout) => void }) {
  const [layout, setLayout] = useState<Layout>(initial);
  const [sel, setSel] = useState<ElId>('headline');
  const [showOrder, setShowOrder] = useState(showOrderDefault);
  const [ref, w] = useElementWidth<HTMLDivElement>();
  const update = (l: Layout) => { setLayout(l); onLayout?.(l); };
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div ref={ref} className="rounded-2xl bg-ink-800 p-4 pl-12 ring-1 ring-ink-750 sm:p-8 sm:pl-14">
          {w > 0 && <Page layout={layout} selected={sel} onSelect={setSel} showOrder={showOrder} width={Math.min(560, w - (w < 500 ? 56 : 112))} />}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Toggle checked={showOrder} onChange={setShowOrder} label="Show predicted reading order" />
          <Button size="sm" variant="ghost" onClick={() => update(initial)}>Reset page</Button>
          <span className="text-[12px] text-ink-500">Tap any text block to edit it.</span>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {ORDER.map((id) => (
            <button key={id} onClick={() => setSel(id)} className={cx('h-9 rounded-full px-3 text-[12px] ring-1', sel === id ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-300 ring-ink-600')}>{LABEL[id].split(' (')[0]}</button>
          ))}
        </div>
        <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <StyleControls id={sel} s={layout[sel]} onChange={(s) => update({ ...layout, [sel]: s })} />
        </div>
        {children?.(layout)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ observe

function Observe() {
  const [ref, w] = useElementWidth<HTMLDivElement>();
  const pw = Math.max(200, Math.min(380, (w - 48) / 2));
  return (
    <div className="space-y-5">
      <div ref={ref} className="flex flex-wrap justify-center gap-6 rounded-2xl bg-ink-800 p-6 ring-1 ring-ink-750">
        {w > 0 && <><figure><Page layout={BROKEN} width={pw} /><figcaption className="mt-2 text-center text-[12px] text-ink-400">Page A</figcaption></figure>
          <figure><Page layout={GOOD} width={pw} /><figcaption className="mt-2 text-center text-[12px] text-ink-400">Page B</figcaption></figure></>}
      </div>
      <ObserveQuestion
        question="Glance at Page A for two seconds. What did your eye land on first?"
        options={['The section title', 'The headline', 'The subtitle', 'The caption', 'Nowhere — it bounced around']}
        reveal={(i) => (
          <div className="space-y-2">
            <p>{i === 1 ? 'Interesting — many people land elsewhere first.' : i === 4 ? 'Exactly: nothing clearly wins, so the eye wanders.' : 'That is what most people report.'} On Page A the section label is the biggest, boldest thing, the subtitle outweighs the headline, and the caption shouts as loudly as the body. Every element competes.</p>
            <p>Page B uses the same words. Size, weight, colour and space now agree on one order: headline, then standfirst, then the story, with the label and caption quietly in support.</p>
          </div>
        )}
      />
    </div>
  );
}

function Experiment() {
  return (
    <Editor initial={GOOD} showOrderDefault>
      {(l) => (
        <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <Eyebrow>Prominence model</Eyebrow>
          <ul className="mt-2 space-y-1 text-[12.5px]">
            {predictedOrder(l).map((id, i) => (
              <li key={id} className="flex justify-between text-ink-300"><span>{i + 1}. {LABEL[id]}</span><span className="num font-mono text-ink-500">{prominence(l[id]).toFixed(1)}</span></li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-400">Score = size × √(weight/400) × colour contrast × capitals. A deliberately simple model of what eye-tracking studies show; real attention also depends on images, faces and position. Try breaking the page and watch the numbers reorder.</p>
        </div>
      )}
    </Editor>
  );
}

function Discover() {
  return (
    <Concepts
      items={[
        { title: 'Size leads', body: 'The biggest element is read first. Steps between levels must be decisive — at least about 1.5× — or they read as mistakes rather than decisions.' },
        { title: 'Weight and colour', body: 'Bold type and high contrast pull attention; grey and light weights recede. Use them to rank elements that share a size, or to keep supporting text quiet.' },
        { title: 'Proximity groups', body: 'Things that belong together sit closer together. A headline and its standfirst should be nearer to each other than to the body, so they read as one unit.' },
        { title: 'Alignment builds order', body: 'A shared left edge creates an invisible line the eye follows. Centring long text breaks that line and makes every line start somewhere new.' },
        { title: 'Readable body', body: 'Body text works at about 9–12 pt in print, regular weight, line-height around 1.4–1.6×. Heavy, tightly spaced body text tires the eye within a paragraph.' },
        { title: 'Signposts, not shouts', body: 'Section labels and captions guide without competing: small capitals with generous tracking, a colour accent, or grey. Distinct, but low in the order.' },
      ]}
    />
  );
}

// ------------------------------------------------------------------ challenge

export function evaluateHierarchy(l: Layout, difficulty: string) {
  const P = (id: ElId) => prominence(l[id]);
  const strict = difficulty === 'advanced' ? 1.5 : difficulty === 'intermediate' ? 1.4 : 1.3;
  const pairs: [ElId, ElId, number][] = [['headline', 'subtitle', 2], ['headline', 'title', 2], ['subtitle', 'body', 1], ['headline', 'caption', 1], ['body', 'caption', 1], ['subtitle', 'caption', 1]];
  let got = 0, tot = 0;
  const failed: string[] = [];
  for (const [a, b, w] of pairs) {
    tot += w;
    if (P(a) > P(b) * (b === 'caption' && a === 'body' ? 1.0 : 1.05)) got += w;
    else failed.push(`${LABEL[a]} should outrank ${LABEL[b].toLowerCase()}`);
  }
  const order: Criterion = { label: 'Reading order', score: Math.round((got / tot) * 100), weight: 4, detail: `Predicted order: ${predictedOrder(l).map((x) => LABEL[x].split(' (')[0]).join(' → ')}` };
  const r1 = P('headline') / P('subtitle'), r2 = P('subtitle') / P('body');
  const contrast: Criterion = {
    label: 'Decisive steps between levels',
    score: Math.round((Math.min(1, Math.max(0, (r1 - 1) / (strict - 1))) * 0.6 + Math.min(1, Math.max(0, (r2 - 1) / 0.25)) * 0.4) * 100),
    weight: 2,
    detail: `Headline is ${r1.toFixed(2)}× the subtitle (aim ≥ ${strict}); subtitle is ${r2.toFixed(2)}× the body (aim ≥ 1.25).`,
  };
  const b = l.body;
  const bodyScores = [rangeScore(b.size, 9, 12, 4), rangeScore(b.weight, 300, 500, 300), rangeScore(b.leading, 1.35, 1.7, 0.4), b.align === 'left' || b.align === 'justify' ? 100 : 25, rangeScore(b.tracking, -10, 20, 60)];
  const body: Criterion = { label: 'Body readability', score: Math.round(bodyScores.reduce((a, x) => a + x, 0) / bodyScores.length), weight: 2, detail: `${b.size}pt, weight ${b.weight}, leading ${b.leading.toFixed(2)}×, ${b.align}, tracking ${b.tracking}.` };
  const sameAlign = l.headline.align === l.subtitle.align ? 100 : 30;
  const titleAlign = l.title.align === l.headline.align ? 100 : 50;
  const grouping = l.subtitle.space <= 16 && l.subtitle.space < l.body.space ? 100 : l.subtitle.space < l.body.space ? 70 : 25;
  const capsTracking = [l.title, l.headline, l.subtitle, l.caption].every((s) => !s.caps || s.tracking >= 40) ? 100 : 40;
  const captionOk = rangeScore(l.caption.size, 7, 9.5, 4);
  const align: Criterion = { label: 'Alignment, grouping & finish', score: Math.round(sameAlign * 0.3 + titleAlign * 0.15 + grouping * 0.3 + capsTracking * 0.1 + captionOk * 0.15), weight: 2, detail: `Headline/subtitle ${l.headline.align === l.subtitle.align ? 'share' : 'do not share'} an edge; space above subtitle ${l.subtitle.space}pt vs above body ${l.body.space}pt; caption ${l.caption.size}pt.` };
  const criteria = [order, contrast, body, align];
  const worked: string[] = [];
  const improve: string[] = [...failed.slice(0, 3)];
  if (order.score === 100) worked.push('The prominence order now matches the editorial order — one thing first, then the next.');
  if (contrast.score >= 85) worked.push('Steps between levels are decisive, so the hierarchy reads as intentional.');
  else improve.push(`Make the headline at least ${strict}× more prominent than the subtitle — bigger or bolder.`);
  if (body.score >= 85) worked.push('Body text sits in the comfortable reading range.');
  else improve.push('Body: aim for 9–12 pt, regular weight, 1.35–1.7× leading, left-aligned or justified.');
  if (sameAlign === 100) worked.push('Headline and subtitle share an alignment, forming one unit.');
  if (grouping < 100) improve.push('Pull the subtitle closer to the headline than the body is to the subtitle (proximity groups them).');
  if (capsTracking < 100) improve.push('Capitals need extra tracking (+40‰ or more) to breathe.');
  return { criteria, worked, improve };
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [layout, setLayout] = useState<Layout>(BROKEN);
  const live = useMemo(() => evaluateHierarchy(layout, ctx.difficulty), [layout, ctx.difficulty]);
  const submit = () => {
    const { criteria, worked, improve } = live;
    ctx.submit({
      score: weighted(criteria),
      criteria,
      worked,
      improve,
      subjective: true,
      why: 'Readers decide in about a second whether a page is worth their time. A clear hierarchy answers “what is this and where do I start?” before they have read a word. The measured parts here — size ratios, readable body settings — are industry rules of thumb; the prominence model is a simplification of how attention really works.',
    });
  };
  return (
    <div>
      <ChallengeBrief title="This feature page has no clear entry point. Fix it.">
        Make the reading order unmistakable: <b>headline → subtitle → body</b>, with the section title and caption as quiet signposts. You can change typeface, size, weight, alignment, case, colour, tracking, leading and spacing. Text cannot be rewritten.
      </ChallengeBrief>
      <Editor initial={BROKEN} showOrderDefault={ctx.difficulty === 'beginner'} onLayout={setLayout}>
        {() => (
          <div className="space-y-3 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
            {ctx.difficulty === 'beginner' && (
              <div className="space-y-1.5">
                {live.criteria.map((c) => (
                  <div key={c.label} className="flex items-center justify-between text-[12.5px]"><span className="text-ink-300">{c.label}</span><Badge tone={c.score >= 85 ? 'ok' : c.score >= 50 ? 'warn' : 'bad'}>{c.score}</Badge></div>
                ))}
              </div>
            )}
            <Hint>Start with sizes only: make the headline huge (40–60 pt), the subtitle mid-size (15–20 pt) and the body small (9–11 pt). Then calm the section title with small capitals and tracking.</Hint>
            <Button variant="primary" className="w-full" onClick={submit}>Submit layout</Button>
          </div>
        )}
      </Editor>
    </div>
  );
}
