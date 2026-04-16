import { AnimatePresence, motion } from "framer-motion";
import GlassPanel from "./GlassPanel";

export default function ActionCards({ actions }) {
  return (
    <GlassPanel className="p-5" delay={0.3}>
      <p className="title-font text-xs uppercase tracking-[0.22em] text-cyan-900/70">Action Engine</p>
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
              No actions executed yet.
            </motion.p>
          ) : (
            actions.map((action, index) => (
              <motion.div
                key={`${action.action}-${index}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35 }}
                className="rounded-2xl border border-white/25 bg-white/20 p-3"
              >
                <p className="title-font text-sm font-semibold text-slate-900">{action.action}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-900/60">{action.status}</p>
                <p className="mt-1 text-sm text-slate-800/90">{action.details}</p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </GlassPanel>
  );
}
