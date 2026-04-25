import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MESSAGES = [
  "You are doing something brave by reaching out.",
  "This moment does not define you.",
  "It is okay to feel what you feel right now.",
  "Small kindness toward yourself matters.",
];

const HIGHLIGHTS = [
  "Take a moment to notice one good thing.",
  "You deserve patience and care.",
  "Your next breath can be a small reset.",
  "Comfort can begin with a gentle thought.",
];

export default function CheerUpOverlay({ onClose, onOpenChat }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % MESSAGES.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-orange-200/10 to-cyan-300/10" />
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="relative z-10 w-full max-w-2xl rounded-[1.5rem] border border-white/10 bg-slate-900/95 p-6 shadow-2xl"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/15"
          >
            Close
          </button>
          <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/70">Cheer-up space</p>
              <h2 className="text-3xl font-semibold text-white">Feeling anxious?</h2>
              <p className="text-sm leading-6 text-slate-200/90">
                You are not alone. Take a gentle break, notice what matters, and let this calm, friendly space hold you for a moment.
              </p>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100/85 shadow-[0_12px_30px_rgba(15,23,42,0.45)]">
                <p className="font-medium text-cyan-100">A little reminder:</p>
                <p className="mt-2">{MESSAGES[messageIndex]}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onOpenChat}
                  className="rounded-xl bg-cyan-400/15 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/25"
                >
                  Share more with LifeLens
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Take a gentle pause
                </button>
              </div>
            </div>
            <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-gradient-to-b from-rose-500/10 via-orange-300/5 to-cyan-300/10 p-5 text-slate-950 shadow-inner">
              <p className="text-sm font-semibold text-slate-900">Comfort boost</p>
              <div className="grid gap-3">
                {HIGHLIGHTS.map((highlight) => (
                  <div key={highlight} className="rounded-3xl bg-white/85 px-4 py-3 text-sm text-slate-900 shadow-sm">
                    {highlight}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
