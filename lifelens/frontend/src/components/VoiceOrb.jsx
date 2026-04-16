import { motion } from "framer-motion";

const stateLabel = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

const ringVariants = {
  idle: { scale: [1, 1.05, 1], opacity: [0.32, 0.45, 0.32], rotate: 0 },
  listening: { scale: [1, 1.2, 1], opacity: [0.45, 0.9, 0.45], rotate: 0 },
  thinking: { scale: [1, 1.12, 1], opacity: [0.38, 0.7, 0.38], rotate: [0, 180, 360] },
  speaking: { scale: [1, 1.26, 1], opacity: [0.5, 0.95, 0.5], rotate: [0, 6, -6, 0] },
};

const coreVariants = {
  idle: { scale: [1, 1.02, 1], filter: "blur(0px)" },
  listening: { scale: [1, 1.08, 1], filter: "blur(0px)" },
  thinking: { scale: [1, 1.06, 1], filter: ["blur(0px)", "blur(1px)", "blur(0px)"] },
  speaking: { scale: [1, 1.14, 1], filter: "blur(0px)" },
};

export default function VoiceOrb({ state = "idle" }) {
  const resolvedState = stateLabel[state] ? state : "idle";

  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center sm:h-56 sm:w-56">
      <motion.div
        className="absolute h-full w-full rounded-full bg-cyan-300/25 blur-3xl"
        variants={ringVariants}
        animate={resolvedState}
        transition={{ duration: resolvedState === "thinking" ? 4.8 : 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-[72%] w-[72%] rounded-full border border-cyan-100/20 bg-gradient-to-br from-white/[0.22] to-white/[0.06] backdrop-blur-xl"
        animate={resolvedState === "thinking" ? { rotate: [0, 180, 360] } : { rotate: [0, 6, -6, 0] }}
        transition={{ duration: resolvedState === "thinking" ? 8 : 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan-100/35 bg-slate-900/40 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 sm:h-28 sm:w-28"
        variants={coreVariants}
        animate={resolvedState}
        transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
      >
        {stateLabel[resolvedState]}
      </motion.div>

      {resolvedState === "speaking" && (
        <div className="absolute -bottom-3 flex items-end gap-1">
          {[0, 1, 2, 3, 4].map((item) => (
            <motion.span
              key={`wave-${item}`}
              className="w-1 rounded-full bg-cyan-200/90"
              animate={{ height: [8, 20 - (item % 2) * 4, 8], opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: item * 0.1, ease: "easeInOut" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
