import { AnimatePresence, motion } from "framer-motion";

export default function LifeInsightCard({ insight, pending }) {
  return (
    <div className="relative w-full max-w-2xl">
      <AnimatePresence mode="wait">
        {pending ? (
          <motion.div
            key="pending-insight"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-3xl border border-cyan-100/20 bg-white/[0.08] p-5 backdrop-blur-2xl"
          >
            <p className="title-font text-xs uppercase tracking-[0.24em] text-cyan-100/90">Life Insight</p>
            <p className="mt-3 text-sm text-slate-200">Analyzing your pattern and preparing next steps...</p>
          </motion.div>
        ) : (
          insight?.summary && (
            <motion.div
              key={insight.summary}
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="rounded-3xl border border-cyan-200/25 bg-white/[0.12] p-5 shadow-[0_18px_50px_rgba(14,116,144,0.24)] backdrop-blur-2xl"
            >
              <p className="title-font text-xs uppercase tracking-[0.24em] text-cyan-100/90">Life Insight</p>
              <p className="mt-3 text-base text-white">
                <span className="bg-gradient-to-r from-cyan-100 via-white to-cyan-200 bg-clip-text text-transparent">
                  {insight.summary}
                </span>
              </p>
              {!!(insight.recommended_actions || []).length && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Suggested next steps</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-100">
                    {(insight.recommended_actions || []).map((item, index) => (
                      <li key={`${item}-${index}`}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
