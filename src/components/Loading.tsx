export function Loading({ label = 'Preparing the lab…' }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center text-[13px] text-ink-400">
      <span className="animate-pulse">{label}</span>
    </div>
  );
}
