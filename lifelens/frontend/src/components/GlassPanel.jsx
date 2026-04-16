import { motion } from "framer-motion";

export default function GlassPanel({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`rounded-3xl border border-white/30 bg-white/15 backdrop-blur-2xl shadow-glow ${className}`}
    >
      {children}
    </motion.div>
  );
}
