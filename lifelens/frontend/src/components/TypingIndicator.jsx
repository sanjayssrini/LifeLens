import { motion } from "framer-motion";

export default function TypingIndicator({ label = "LifeLens is thinking" }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-xs text-slate-200">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={`typing-dot-${dot}`}
            className="h-1.5 w-1.5 rounded-full bg-cyan-200"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
            transition={{ duration: 0.9, delay: dot * 0.12, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}
