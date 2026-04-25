import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ROUTINE_ITEMS = [
  "Wake slowly with a glass of water",
  "Stretch gently for 2 minutes",
  "Write one thing you are grateful for",
  "Choose a calm activity to enjoy",
];

export default function GentleRoutineOverlay({ onClose, onOpenChat }) {
  const [checked, setChecked] = useState(Array(ROUTINE_ITEMS.length).fill(false));

  const toggleItem = (index) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-cyan-950/80 to-purple-950/90" />
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="relative z-10 w-full max-w-xl rounded-[1.5rem] border border-white/10 bg-slate-900/95 p-6 shadow-2xl"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/15"
          >
            Close
          </button>
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/70">Gentle routine</p>
              <h2 className="text-3xl font-semibold text-white">Create a calm start</h2>
              <p className="text-sm leading-6 text-slate-300/90">
                Choose a few gentle actions to help your day feel slower and more steady.
              </p>
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.4)]">
              {ROUTINE_ITEMS.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem(index)}
                  className={`flex w-full items-start gap-4 rounded-3xl border px-4 py-4 text-left transition ${checked[index] ? "border-cyan-300/35 bg-cyan-500/10 text-white" : "border-white/10 bg-slate-950/70 text-slate-200 hover:bg-white/10"}`}
                >
                  <span className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border ${checked[index] ? "border-cyan-300 bg-cyan-400 text-slate-950" : "border-white/20 bg-slate-950 text-slate-400"}`}>
                    {checked[index] ? "✓" : ""}
                  </span>
                  <span className="text-sm leading-6">{item}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Save this gentle plan
              </button>
              <button
                type="button"
                onClick={onOpenChat}
                className="rounded-xl bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
              >
                Ask for a tailored plan
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
