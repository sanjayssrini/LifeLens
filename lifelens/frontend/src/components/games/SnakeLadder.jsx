import { useState } from "react";
import { motion } from "framer-motion";

const BOARD_SIZE = 100;
const SNAKES = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
const LADDERS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };

export default function SnakeLadder() {
  const [playerPosition, setPlayerPosition] = useState(1);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [message, setMessage] = useState("Roll the dice to start!");

  const rollDice = () => {
    if (playerPosition >= BOARD_SIZE || isRolling) return;
    
    setIsRolling(true);
    setMessage("Rolling...");
    
    setTimeout(() => {
      const roll = Math.floor(Math.random() * 6) + 1;
      setDiceValue(roll);
      
      let nextPos = playerPosition + roll;
      if (nextPos > BOARD_SIZE) {
        nextPos = playerPosition; // Must land exactly on 100
        setMessage(`Rolled a ${roll}. Need exact number to win!`);
      } else {
        if (SNAKES[nextPos]) {
          setMessage(`Rolled a ${roll}. Oh no! Bitten by a snake!`);
          nextPos = SNAKES[nextPos];
        } else if (LADDERS[nextPos]) {
          setMessage(`Rolled a ${roll}. Yay! Climbed a ladder!`);
          nextPos = LADDERS[nextPos];
        } else if (nextPos === BOARD_SIZE) {
          setMessage("🎉 You Win! 🎉");
        } else {
          setMessage(`Rolled a ${roll}. Moved to ${nextPos}.`);
        }
      }
      
      setPlayerPosition(nextPos);
      setIsRolling(false);
    }, 600);
  };

  const resetGame = () => {
    setPlayerPosition(1);
    setDiceValue(1);
    setMessage("Roll the dice to start!");
  };

  return (
    <div className="flex flex-col items-center w-full h-full p-4 overflow-y-auto">
      <h3 className="text-2xl font-light text-emerald-200 mb-2">Snake & Ladder</h3>
      <p className="text-sm text-slate-300 mb-4 h-6">{message}</p>

      <div className="flex flex-col sm:flex-row gap-8 items-center justify-center w-full max-w-3xl">
        <div className="relative w-full max-w-sm aspect-square bg-[#0b1323] border-4 border-emerald-500/30 rounded-lg overflow-hidden shadow-2xl">
           <div className="absolute inset-0 grid grid-cols-10 grid-rows-10 opacity-20 pointer-events-none">
             {Array.from({length: 100}).map((_, i) => (
               <div key={i} className="border border-emerald-500/50"></div>
             ))}
           </div>
           
           {/* Visual representation - highly simplified board */}
           <div className="absolute inset-0 flex items-center justify-center p-8 opacity-30 pointer-events-none">
              <svg viewBox="0 0 100 100" className="w-full h-full stroke-emerald-500 stroke-2 fill-none stroke-dasharray-[4,4]">
                 <path d="M 10 90 L 30 70 M 50 50 L 70 30 M 80 80 L 20 20 M 10 10 L 40 40" />
              </svg>
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full stroke-rose-500 stroke-2 fill-none">
                 <path d="M 90 10 Q 70 30 50 50 T 10 90" />
                 <path d="M 30 10 Q 50 40 70 70" />
              </svg>
           </div>
           
           <div className="absolute inset-0 p-4 flex items-center justify-center text-emerald-500/20 text-6xl font-black italic">
             {playerPosition}
           </div>

           <motion.div
             className="absolute bottom-2 left-2 w-6 h-6 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] border-2 border-emerald-400 z-10 flex items-center justify-center"
             animate={{
               // Approximate mapping to a 10x10 grid (bottom-left start, snaking up)
               x: ((playerPosition - 1) % 10) * (320 / 10),
               y: -Math.floor((playerPosition - 1) / 10) * (320 / 10),
             }}
             transition={{ type: "spring", stiffness: 60 }}
           >
             <div className="w-2 h-2 bg-emerald-500 rounded-full" />
           </motion.div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <motion.div 
             className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-xl border border-slate-200"
             animate={isRolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.1, 1] } : {}}
             transition={{ duration: 0.5 }}
          >
             <span className="text-6xl text-slate-800 font-bold">{diceValue}</span>
          </motion.div>

          <button
            onClick={rollDice}
            disabled={isRolling || playerPosition >= BOARD_SIZE}
            className="px-8 py-3 rounded-full bg-emerald-500 text-white font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Roll Dice
          </button>

          <button
            onClick={resetGame}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Restart Game
          </button>
        </div>
      </div>
    </div>
  );
}
