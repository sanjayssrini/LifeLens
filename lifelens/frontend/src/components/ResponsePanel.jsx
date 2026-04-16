import GlassPanel from "./GlassPanel";

export default function ResponsePanel({ text }) {
  return (
    <GlassPanel className="p-5" delay={0.2}>
      <p className="title-font text-xs uppercase tracking-[0.22em] text-cyan-900/70">Voice AI Response</p>
      <p className="mt-3 min-h-16 text-sm text-slate-900/95">
        {text || "Intent cascade response will appear here."}
      </p>
    </GlassPanel>
  );
}
