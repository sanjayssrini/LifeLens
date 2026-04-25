import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import TicTacToe from "./games/TicTacToe";
import Sudoku from "./games/Sudoku";
import SnakeLadder from "./games/SnakeLadder";
import BubblePop from "./games/BubblePop";
import CarRace from "./games/CarRace";
import BikeRace from "./games/BikeRace";

export default function GamesPortal({ onClose }) {
  const [activeGame, setActiveGame] = useState(null);

  const games = [
    { id: "tictactoe", title: "Tic Tac Toe", icon: "❌⭕️", color: "from-cyan-500/20 to-blue-500/20", border: "border-cyan-500/30", component: TicTacToe },
    { id: "bubblepop", title: "Bubble Pop", icon: "🫧", color: "from-purple-500/20 to-pink-500/20", border: "border-pink-500/30", component: BubblePop },
    { id: "snakeladder", title: "Snake & Ladder", icon: "🐍🪜", color: "from-emerald-500/20 to-teal-500/20", border: "border-emerald-500/30", component: SnakeLadder },
    { id: "carrace", title: "Car Dodger", icon: "🏎️", color: "from-red-500/20 to-orange-500/20", border: "border-red-500/30", component: CarRace },
    { id: "bikerace", title: "Bike Jump", icon: "🏍️", color: "from-amber-500/20 to-yellow-500/20", border: "border-amber-500/30", component: BikeRace },
    { id: "sudoku", title: "Sudoku", icon: "🔢", color: "from-indigo-500/20 to-violet-500/20", border: "border-indigo-500/30", component: Sudoku },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/80 backdrop-blur-xl"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/10 shadow-sm text-gray-300 hover:bg-white/20 transition-colors z-50"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {!activeGame ? (
          <div className="flex flex-col items-center justify-center w-full max-w-4xl px-4">
            <h2 className="text-3xl font-light tracking-wide text-white mb-8">Choose a distraction</h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
              {games.map((game, index) => (
                <motion.button
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveGame(game.id)}
                  className={`flex flex-col items-center justify-center p-6 rounded-2xl border ${game.border} bg-gradient-to-br ${game.color} shadow-lg backdrop-blur-md transition-all`}
                >
                  <span className="text-4xl mb-3">{game.icon}</span>
                  <span className="text-sm font-medium text-white">{game.title}</span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <button
              onClick={() => setActiveGame(null)}
              className="absolute top-6 left-6 p-2 rounded-full bg-white/10 shadow-sm text-gray-300 hover:bg-white/20 transition-colors z-50 flex items-center gap-2 px-4"
            >
              <span>← Back to Games</span>
            </button>
            
            <div className="w-full max-w-2xl h-[80vh] bg-[#0b1323]/50 rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex items-center justify-center relative">
               {games.map(g => g.id === activeGame && <g.component key={g.id} />)}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
