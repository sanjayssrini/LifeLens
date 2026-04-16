import GlassPanel from "./GlassPanel";

export default function TranscriptPanel({ text }) {
  return (
    <GlassPanel className="p-5" delay={0.1}>
      <p className="title-font text-xs uppercase tracking-[0.22em] text-cyan-900/70">Live Transcript</p>
      <p className="mt-3 min-h-16 text-sm text-slate-800/90">
        {text || "Waiting for voice input..."}
      </p>
    </GlassPanel>
  );
}
