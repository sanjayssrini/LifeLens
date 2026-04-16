import { AnimatePresence, motion } from "framer-motion";
import GlassPanel from "./GlassPanel";

const iconForAction = (text) => {
  const lowered = String(text || "").toLowerCase();
  if (lowered.includes("hospital") || lowered.includes("health")) return "🏥";
  if (lowered.includes("money") || lowered.includes("financial") || lowered.includes("aid")) return "💰";
  if (lowered.includes("job") || lowered.includes("career")) return "💼";
  if (lowered.includes("home") || lowered.includes("shelter")) return "🏠";
  return "✨";
};

export default function ActionCards({ actions, title = "Smart Actions" }) {
  return (
    <GlassPanel className="p-5" delay={0.3}>
      <p className="title-font text-xs uppercase tracking-[0.22em] text-cyan-900/70">{title}</p>
      <div className="mt-4 space-y-3">
        <AnimatePresence>
          {(actions || []).length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-slate-800/80"
            >
              No actions queued yet.
            </motion.p>
          ) : (
            actions.map((action, index) => (
              <motion.div
                key={`${action.action}-${index}`}
                initial={{ opacity: 0, x: 24, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.36, delay: index * 0.08, ease: "easeOut" }}
                className="rounded-2xl border border-white/25 bg-white/20 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.22)]"
              >
                <p className="title-font flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span>{iconForAction(action.action || action)}</span>
                  <span>{action.action || action}</span>
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-900/60">{action.status}</p>
                {action.details && <p className="mt-1 text-sm text-slate-800/90">{action.details}</p>}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </GlassPanel>
  );
}
