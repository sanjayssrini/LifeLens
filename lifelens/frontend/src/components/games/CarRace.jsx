import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

export default function CarRace() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [carLane, setCarLane] = useState(1); // 0: left, 1: center, 2: right
  const [obstacles, setObstacles] = useState([]);
  
  const gameLoopRef = useRef(null);
  
  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    setCarLane(1);
    setObstacles([]);
  };

  useEffect(() => {
    if (!isPlaying || gameOver) return;

    let speed = 5;
    let obstacleCounter = 0;

    const gameLoop = () => {
      setScore(s => s + 1);
      
      // Update speed based on score
      setScore(s => {
         if (s % 500 === 0 && speed < 15) speed += 1;
         return s;
      });

      setObstacles(prev => {
        let newObstacles = prev.map(obs => ({ ...obs, y: obs.y + speed }));
        
        // Remove off-screen obstacles
        newObstacles = newObstacles.filter(obs => obs.y < 100);

        // Add new obstacle
        obstacleCounter++;
        if (obstacleCounter > 40 - (speed * 1.5)) {
          obstacleCounter = 0;
          const lane = Math.floor(Math.random() * 3);
          // ensure we don't block all lanes
          if (!newObstacles.find(o => o.y < 20 && o.lane === lane)) {
             newObstacles.push({ id: Date.now(), lane, y: -10 });
          }
        }

        // Collision check
        const hit = newObstacles.some(obs => 
           obs.lane === carLane && obs.y > 75 && obs.y < 95
        );

        if (hit) {
          setGameOver(true);
          setIsPlaying(false);
        }

        return newObstacles;
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [isPlaying, gameOver, carLane]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPlaying) return;
      if (e.key === "ArrowLeft") setCarLane(l => Math.max(0, l - 1));
      if (e.key === "ArrowRight") setCarLane(l => Math.min(2, l + 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 select-none">
      <h3 className="text-2xl font-light text-red-300 mb-2">Car Dodger</h3>
      <p className="text-sm text-slate-300 mb-4 h-6 font-mono">SCORE: {Math.floor(score / 10)}</p>

      <div className="relative w-64 h-96 bg-[#1a1a2e] rounded-xl overflow-hidden border-2 border-slate-700/50 shadow-[0_0_30px_rgba(220,38,38,0.15)] flex">
         {/* Road lines */}
         <div className="absolute inset-y-0 left-1/3 w-px bg-white/10 border-l border-dashed border-white/30"></div>
         <div className="absolute inset-y-0 left-2/3 w-px bg-white/10 border-l border-dashed border-white/30"></div>

         {!isPlaying && !gameOver && (
           <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
             <button onClick={startGame} className="px-6 py-2 bg-red-500 hover:bg-red-400 text-white rounded-full font-bold shadow-lg transition">Start Race</button>
           </div>
         )}

         {gameOver && (
           <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
             <p className="text-red-400 text-2xl font-black mb-2">CRASH!</p>
             <button onClick={startGame} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition">Play Again</button>
           </div>
         )}

         {/* Car */}
         <motion.div 
           className="absolute bottom-[5%] w-10 h-16 bg-gradient-to-t from-red-600 to-red-400 rounded-lg shadow-lg z-10 before:content-[''] before:absolute before:top-2 before:left-1 before:right-1 before:h-4 before:bg-black/40 before:rounded-sm after:content-[''] after:absolute after:bottom-2 after:left-1 after:right-1 after:h-2 after:bg-black/60 after:rounded-sm"
           animate={{ left: `${(carLane * 33.33) + 16.66}%`, x: "-50%" }}
           transition={{ type: "spring", stiffness: 300, damping: 25 }}
         />

         {/* Obstacles */}
         {obstacles.map(obs => (
           <div 
             key={obs.id}
             className="absolute w-10 h-12 bg-slate-400 rounded-md z-0 shadow-md flex items-center justify-center"
             style={{ 
                left: `${(obs.lane * 33.33) + 16.66}%`, 
                transform: `translateX(-50%)`,
                top: `${obs.y}%` 
             }}
           >
             <div className="w-8 h-8 bg-slate-500 rounded-sm"></div>
           </div>
         ))}
      </div>
      
      {/* Mobile controls */}
      <div className="flex gap-4 mt-6 sm:hidden">
        <button onTouchStart={() => isPlaying && setCarLane(l => Math.max(0, l - 1))} className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center active:bg-white/20">◀</button>
        <button onTouchStart={() => isPlaying && setCarLane(l => Math.min(2, l + 1))} className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center active:bg-white/20">▶</button>
      </div>
      <p className="mt-4 text-xs text-slate-500 hidden sm:block">Use Left / Right arrow keys to steer</p>
    </div>
  );
}
