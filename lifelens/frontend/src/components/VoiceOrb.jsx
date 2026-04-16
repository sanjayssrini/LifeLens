import { motion } from "framer-motion";

export default function VoiceOrb({ active }) {
  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center sm:h-56 sm:w-56">
      <motion.div
        className="absolute h-full w-full rounded-full bg-cyan-300/25 blur-3xl"
        animate={{ scale: active ? [1, 1.24, 1] : [1, 1.1, 1], opacity: active ? [0.4, 0.92, 0.4] : [0.34, 0.6, 0.34] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-[72%] w-[72%] rounded-full border border-cyan-100/20 bg-gradient-to-br from-white/[0.22] to-white/[0.06] backdrop-blur-xl"
        animate={{ rotate: active ? [0, 8, -6, 0] : 0 }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan-100/35 bg-slate-900/40 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 sm:h-28 sm:w-28"
        animate={{ scale: active ? [1, 1.08, 1] : [1, 1.03, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        {active ? "Live" : "Idle"}
      </motion.div>
    </div>
  );
}
