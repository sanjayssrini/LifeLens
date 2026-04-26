import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as htmlToImage from "html-to-image";

// Custom SVG Radar Chart
const RadarChart = ({ data }) => {
  const size = 200;
  const center = size / 2;
  const radius = size * 0.4;
  const numAxes = data.length;
  
  const angleStep = (Math.PI * 2) / numAxes;

  // Calculate points for the data polygon
  const dataPoints = data.map((d, i) => {
    const value = d.value / 100;
    const x = center + radius * value * Math.cos(i * angleStep - Math.PI / 2);
    const y = center + radius * value * Math.sin(i * angleStep - Math.PI / 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="relative w-full aspect-square max-w-[280px] mx-auto flex items-center justify-center">
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Background grids */}
        {[0.25, 0.5, 0.75, 1].map((scale, gridIdx) => (
          <polygon
            key={gridIdx}
            points={data.map((_, i) => {
              const x = center + radius * scale * Math.cos(i * angleStep - Math.PI / 2);
              const y = center + radius * scale * Math.sin(i * angleStep - Math.PI / 2);
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        ))}

        {/* Axes */}
        {data.map((_, i) => {
          const x = center + radius * Math.cos(i * angleStep - Math.PI / 2);
          const y = center + radius * Math.sin(i * angleStep - Math.PI / 2);
          return (
            <line key={`axis-${i}`} x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          );
        })}

        {/* Data Polygon */}
        <motion.polygon
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          points={dataPoints}
          fill="rgba(99, 102, 241, 0.4)"
          stroke="rgba(129, 140, 248, 1)"
          strokeWidth="2"
          className="origin-center"
        />

        {/* Data Points */}
        {data.map((d, i) => {
          const value = d.value / 100;
          const x = center + radius * value * Math.cos(i * angleStep - Math.PI / 2);
          const y = center + radius * value * Math.sin(i * angleStep - Math.PI / 2);
          return (
            <circle key={`pt-${i}`} cx={x} cy={y} r="3" fill="#fff" />
          );
        })}
      </svg>
      
      {/* Labels overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {data.map((d, i) => {
           const x = center + (radius + 25) * Math.cos(i * angleStep - Math.PI / 2);
           const y = center + (radius + 20) * Math.sin(i * angleStep - Math.PI / 2);
           return (
             <div 
               key={`label-${i}`} 
               className="absolute text-[10px] sm:text-xs text-indigo-200 font-medium whitespace-nowrap transform -translate-x-1/2 -translate-y-1/2"
               style={{ left: `${(x/size)*100}%`, top: `${(y/size)*100}%` }}
             >
               {d.category}
             </div>
           );
        })}
      </div>
    </div>
  );
};

const Flashcard = ({ card, index }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 + index * 0.1 }}
      className="w-48 h-64 shrink-0 perspective-1000 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="w-full h-full relative preserve-3d transition-transform duration-500"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 p-4 flex flex-col items-center justify-center text-center shadow-lg">
           <span className="text-3xl mb-4">✨</span>
           <h4 className="text-indigo-100 font-bold leading-snug">{card.front}</h4>
           <p className="absolute bottom-4 text-[10px] text-indigo-300/70">Tap to flip</p>
        </div>
        {/* Back */}
        <div 
           className="absolute inset-0 backface-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 p-4 flex flex-col items-center justify-center text-center shadow-lg"
           style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
        >
           <p className="text-sm text-emerald-50 leading-relaxed">{card.back}</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function AssessmentPortal({ session, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    
    fetch("/api/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: session?.user?.user_id || "",
        session_token: session?.session_token || ""
      })
    })
    .then(res => res.json())
    .then(payload => {
       if (isMounted) {
         if (payload.status === "ok" && payload.assessment) {
           setData(payload.assessment);
         } else {
           setError(payload.detail || "Unknown error occurred");
         }
         setLoading(false);
       }
    })
    .catch((err) => {
       if (isMounted) {
         setError(err.message || "Network error");
         setLoading(false);
       }
    });

    return () => { isMounted = false; };
  }, [session?.user?.user_id, session?.session_token]);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      // Small delay to allow downloading state to render if needed
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = await htmlToImage.toPng(reportRef.current, {
        quality: 0.95,
        backgroundColor: '#0b1323', // Match dashboard bg
        style: { padding: '20px' }
      });
      const link = document.createElement('a');
      link.download = `LifeLens-Assessment-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download image", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/90 backdrop-blur-xl p-4 sm:p-8"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/10 shadow-sm text-gray-300 hover:bg-white/20 transition-colors z-50"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loading && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mb-6"></div>
            <p className="text-lg text-indigo-200 animate-pulse">Analyzing your journey...</p>
            <p className="text-xs text-indigo-400/60 mt-2">Processing conversational memories</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center max-w-md">
             <p className="text-red-400 mb-2">Unable to generate assessment at this time.</p>
             <p className="text-xs text-red-300/60 mb-6 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>
             <button onClick={onClose} className="px-6 py-2 bg-white/10 rounded-full text-white">Go Back</button>
          </div>
        )}

        {!loading && data && (
          <motion.div 
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full h-full max-w-5xl flex flex-col overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
               <div>
                 <h2 className="text-2xl sm:text-3xl font-light text-white tracking-wide">Your Reflection Profile</h2>
                 <p className="text-sm text-slate-400 mt-1">A deep dive into your recent emotional journey</p>
               </div>
               <button
                 onClick={handleDownload}
                 disabled={downloading}
                 className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 rounded-full hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
               >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                 </svg>
                 {downloading ? "Saving..." : "Download Report"}
               </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar pr-2" ref={reportRef}>
               {/* Top Section: Score & Chart */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
                     {/* Decorative background glow */}
                     <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 ${data.score >= 50 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                     
                     <p className="text-sm uppercase tracking-widest text-slate-400 mb-2 z-10">Resilience Score</p>
                     <div className="flex items-baseline gap-2 z-10">
                        <span className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">
                           {data.score}
                        </span>
                        <span className="text-2xl text-slate-500">/100</span>
                     </div>
                     <p className="mt-4 text-center text-sm text-slate-300 max-w-xs z-10">
                       {data.score >= 50 
                         ? "You've been showing strong coping mechanisms and stability recently." 
                         : "You've been navigating a heavy emotional load. It's okay to ask for help."}
                     </p>
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex flex-col items-center">
                     <p className="text-sm uppercase tracking-widest text-slate-400 mb-4 self-start">Psychological Metrics</p>
                     {data.metrics && data.metrics.length > 2 ? (
                        <RadarChart data={data.metrics} />
                     ) : (
                        <p className="text-sm text-slate-500 my-auto">Not enough data to generate chart.</p>
                     )}
                  </div>
               </div>

               {/* Middle Section: Positives & Negatives */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
                     <h3 className="text-emerald-300 font-medium mb-4 flex items-center gap-2">
                        <span className="p-1 bg-emerald-500/20 rounded-md">🌱</span> Observed Strengths
                     </h3>
                     <ul className="space-y-3">
                        {data.positives?.map((pos, i) => (
                           <li key={i} className="text-sm text-emerald-100/80 flex items-start gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                              <span className="leading-relaxed">{pos}</span>
                           </li>
                        ))}
                     </ul>
                  </div>

                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6">
                     <h3 className="text-rose-300 font-medium mb-4 flex items-center gap-2">
                        <span className="p-1 bg-rose-500/20 rounded-md">🧭</span> Areas of Friction
                     </h3>
                     <ul className="space-y-3">
                        {data.negatives?.map((neg, i) => (
                           <li key={i} className="text-sm text-rose-100/80 flex items-start gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                              <span className="leading-relaxed">{neg}</span>
                           </li>
                        ))}
                     </ul>
                  </div>
               </div>

               {/* Bottom Section: Flashcards */}
               {data.flashcards && data.flashcards.length > 0 && (
                 <div className="mb-8" data-html2canvas-ignore="true">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-medium text-white">Actionable Flashcards</h3>
                       <p className="text-xs text-slate-400">Tap cards to flip</p>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar snap-x snap-mandatory px-2">
                       {data.flashcards.map((card, i) => (
                          <div key={i} className="snap-center">
                             <Flashcard card={card} index={i} />
                          </div>
                       ))}
                    </div>
                 </div>
               )}
               
               {/* Mobile Download button (only shows on small screens, hidden from canvas) */}
               <button
                 onClick={handleDownload}
                 disabled={downloading}
                 data-html2canvas-ignore="true"
                 className="sm:hidden w-full flex justify-center items-center gap-2 px-4 py-3 bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 rounded-xl mt-4"
               >
                 {downloading ? "Saving..." : "Download Report"}
               </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
