import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["bg-pink-400", "bg-purple-400", "bg-cyan-400", "bg-emerald-400"];

export default function BubblePop() {
  const [bubbles, setBubbles] = useState([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    // Generate initial bubbles
    const initialBubbles = Array.from({ length: 24 }).map((_, i) => ({
      id: `bubble-${i}-${Date.now()}`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      popped: false,
    }));
    setBubbles(initialBubbles);
  }, []);

  const popBubble = (index) => {
    if (bubbles[index].popped) return;

    setBubbles(prev => {
      const newBubbles = [...prev];
      newBubbles[index].popped = true;
      return newBubbles;
    });
    setScore(s => s + 1);

    // Replenish bubble after a short delay
    setTimeout(() => {
      setBubbles(prev => {
        const newBubbles = [...prev];
        newBubbles[index] = {
          id: `bubble-${index}-${Date.now()}`,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          popped: false,
        };
        return newBubbles;
      });
    }, 800);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 relative overflow-hidden">
      <h3 className="text-2xl font-light text-pink-200 mb-2">Bubble Pop</h3>
      <p className="text-sm text-slate-300 mb-6">Score: <span className="font-bold text-white">{score}</span></p>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 sm:gap-4 max-w-md w-full">
        <AnimatePresence>
          {bubbles.map((bubble, idx) => (
            <div key={bubble.id} className="relative aspect-square">
              {!bubble.popped && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => popBubble(idx)}
                  className={`absolute inset-0 rounded-full shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.2),inset_4px_4px_10px_rgba(255,255,255,0.4)] ${bubble.color} flex items-center justify-center overflow-hidden border border-white/20`}
                >
                  <div className="absolute top-2 left-2 w-3 h-3 bg-white/40 rounded-full blur-[1px]"></div>
                </motion.button>
              )}
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
