export default function IntentPill({ intent }) {
  if (!intent) {
    return null;
  }

  const urgencyClass = {
    low: "bg-emerald-100/80 text-emerald-700",
    medium: "bg-amber-100/80 text-amber-700",
    high: "bg-rose-100/80 text-rose-700"
  }[intent.urgency || "medium"];

  return (
    <div className="mt-4 rounded-2xl border border-white/20 bg-white/20 p-3 text-sm text-slate-800/90">
      <p className="title-font text-xs uppercase tracking-[0.2em] text-cyan-900/70">Intent Snapshot</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">{intent.primary_intent}</p>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${urgencyClass}`}>
          {intent.urgency}
        </span>
      </div>
    </div>
  );
}
