import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

export default function BikeRace() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [bikeY, setBikeY] = useState(50);
  const [velocity, setVelocity] = useState(0);
  const [obstacles, setObstacles] = useState([]);
  
  const gameLoopRef = useRef(null);
  
  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    setBikeY(50);
    setVelocity(0);
    setObstacles([]);
  };

  const jump = () => {
    if (!isPlaying) return;
    setVelocity(-2.2); // Upward velocity
  };

  useEffect(() => {
    if (!isPlaying || gameOver) return;

    let obsCounter = 0;
    let speed = 1.2;

    const gameLoop = () => {
      setScore(s => s + 1);

      // Physics update
      setBikeY(y => {
        const newY = y + velocity;
        if (newY > 95 || newY < 0) { // Hit floor or ceiling
          setGameOver(true);
          setIsPlaying(false);
        }
        return newY;
      });
      setVelocity(v => v + 0.12); // Gravity

      // Obstacle update
      setObstacles(prev => {
        let newObs = prev.map(obs => ({ ...obs, x: obs.x - speed }));
        newObs = newObs.filter(obs => obs.x > -20); // remove off screen

        obsCounter++;
        if (obsCounter > 120) { // spawn rate
          obsCounter = 0;
          const height = Math.random() * 40 + 20; // 20 to 60%
          const isTop = Math.random() > 0.5;
          newObs.push({ id: Date.now(), x: 100, height, isTop });
        }

        // Collision detection
        // Bike is roughly at x: 20%, width: 10%, height: 5%
        const bikeRect = { left: 20, right: 30, top: bikeY - 2.5, bottom: bikeY + 2.5 };
        
        const hit = newObs.some(obs => {
           const obsRect = {
              left: obs.x,
              right: obs.x + 8,
              top: obs.isTop ? 0 : 100 - obs.height,
              bottom: obs.isTop ? obs.height : 100
           };
           
           return (
              bikeRect.right > obsRect.left &&
              bikeRect.left < obsRect.right &&
              bikeRect.bottom > obsRect.top &&
              bikeRect.top < obsRect.bottom
           );
        });

        if (hit) {
          setGameOver(true);
          setIsPlaying(false);
        }

        return newObs;
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [isPlaying, gameOver, velocity, bikeY]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
         e.preventDefault();
         jump();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying]);

  return (
    <div 
      className="flex flex-col items-center justify-center w-full h-full p-4 select-none"
      onClick={jump} // click anywhere to jump
    >
      <h3 className="text-2xl font-light text-amber-300 mb-2 pointer-events-none">Bike Jump</h3>
      <p className="text-sm text-slate-300 mb-4 h-6 font-mono pointer-events-none">SCORE: {Math.floor(score / 10)}</p>

      <div className="relative w-full max-w-lg h-64 bg-gradient-to-b from-sky-900 to-sky-700 rounded-xl overflow-hidden border-2 border-slate-700/50 shadow-[0_0_30px_rgba(251,191,36,0.1)]">
         
         {!isPlaying && !gameOver && (
           <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-20">
             <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full shadow-lg transition pointer-events-auto">Start Ride</button>
             <p className="mt-4 text-xs text-amber-100/70">Tap or Press Space to jump</p>
           </div>
         )}

         {gameOver && (
           <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 pointer-events-none">
             <p className="text-amber-400 text-2xl font-black mb-4">WIPEOUT!</p>
             <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition pointer-events-auto">Try Again</button>
           </div>
         )}

         {/* Floor */}
         <div className="absolute bottom-0 w-full h-[5%] bg-amber-900/80 border-t border-amber-800 pointer-events-none"></div>

         {/* Bike */}
         <div 
           className="absolute w-8 h-6 flex items-center justify-center z-10 pointer-events-none"
           style={{ left: "20%", top: `${bikeY}%`, transform: `translateY(-50%) rotate(${velocity * 10}deg)` }}
         >
           <div className="w-full h-full bg-amber-400 rounded-sm relative">
             <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-slate-800 rounded-full border-2 border-slate-600"></div>
             <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-slate-800 rounded-full border-2 border-slate-600"></div>
             <div className="absolute top-0 right-1 w-2 h-2 bg-slate-200 rounded-sm"></div>
           </div>
         </div>

         {/* Obstacles */}
         {obstacles.map(obs => (
           <div 
             key={obs.id}
             className={`absolute w-8 bg-slate-800 border-x border-slate-600 pointer-events-none ${obs.isTop ? "top-0 border-b" : "bottom-0 border-t"}`}
             style={{ 
                left: `${obs.x}%`, 
                height: `${obs.height}%`
             }}
           ></div>
         ))}
      </div>
      <p className="mt-6 text-xs text-slate-500">Tap anywhere or press Space to jump</p>
    </div>
  );
}
