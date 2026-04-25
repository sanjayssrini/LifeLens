import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function InsightCard({ session }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    // Only fetch once per session using session storage cache
    const cached = sessionStorage.getItem("lifelens_insight_cache");
    if (cached) {
      try {
        setInsight(JSON.parse(cached));
        setLoading(false);
        return;
      } catch (e) {
        // ignore
      }
    }

    if (!session?.user?.user_id && !session?.session_token) {
      setLoading(false);
      return;
    }

    fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: session?.user?.user_id || "",
        session_token: session?.session_token || "",
        limit: 20
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data?.status === "ok" && data.insights) {
            setInsight(data.insights);
            sessionStorage.setItem("lifelens_insight_cache", JSON.stringify(data.insights));
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session?.session_token, session?.user?.user_id]);

  if (loading || !insight) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      className="mb-4 mx-4 overflow-hidden rounded-2xl border border-indigo-200/20 bg-gradient-to-br from-indigo-900/40 to-slate-900/60 p-4 shadow-lg backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs shadow-inner">
            💡
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-200/80">
            Weekly Insight
          </p>
        </div>
        {insight.trend === "improving" && (
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
            🌱 Small Win
          </span>
        )}
        {insight.trend === "declining" && (
          <span className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
            🧭 Noticing a shift
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="text-sm font-medium leading-relaxed text-slate-100">
          {insight.summary}
        </p>
        {insight.light_feedback && (
          <p className="mt-2 text-xs italic leading-relaxed text-indigo-200/70 border-l-2 border-indigo-500/30 pl-2">
            "{insight.light_feedback}"
          </p>
        )}
      </div>
      
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-300">
          Dominant feeling: <span className="text-indigo-200">{insight.dominant_emotion}</span>
        </div>
        <div className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-300">
          Support pattern: <span className="text-indigo-200">{insight.support_style}</span>
        </div>
      </div>
    </motion.div>
  );
}
