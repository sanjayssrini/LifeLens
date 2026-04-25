import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STEPS = [
  "Name one thing you can control right now.",
  "Let your attention rest on the breath for a few seconds.",
  "Imagine each thought floating by like a cloud.",
];

export default function RacingThoughtsOverlay({ onClose, onOpenChat }) {
  const [stepIndex, setStepIndex] = useState(0);

  const progress = Math.min((stepIndex / (STEPS.length - 1)) * 100, 100);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-indigo-950/70 to-slate-950/95" />
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
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/70">Calm racing thoughts</p>
              <h2 className="text-3xl font-semibold text-white">A gentle grounding game</h2>
              <p className="text-sm leading-6 text-slate-300/90">
                Use each tap to slow your mind and anchor your focus in the present.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.4)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-200/80">Step {stepIndex + 1} of {STEPS.length}</span>
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-100">
                  {Math.round(progress)}% complete
                </span>
              </div>
              <p className="text-lg font-medium leading-7 text-white">{STEPS[stepIndex]}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <motion.button
                  key={index}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setStepIndex(index)}
                  className={`rounded-3xl border px-4 py-4 text-left transition ${stepIndex === index ? "border-cyan-300/40 bg-cyan-400/10 text-white" : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"}`}
                >
                  <span className="text-sm uppercase tracking-[0.24em] text-cyan-100/70">Focus</span>
                  <p className="mt-2 text-sm leading-6">{STEPS[index]}</p>
                </motion.button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setStepIndex((current) => Math.min(current + 1, STEPS.length - 1))}
                className="rounded-xl bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
              >
                Next calming step
              </button>
              <button
                type="button"
                onClick={onOpenChat}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Talk it through
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
