import { useState } from "react";
import { motion } from "framer-motion";

export default function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);

  const calculateWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  };

  const winner = calculateWinner(board);
  const isDraw = !winner && board.every(s => s !== null);

  const handleClick = (index) => {
    if (board[index] || winner) return;
    const newBoard = [...board];
    newBoard[index] = isXNext ? "X" : "O";
    setBoard(newBoard);
    setIsXNext(!isXNext);
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4">
      <h3 className="text-2xl font-light text-cyan-200 mb-6">Tic Tac Toe</h3>
      
      <div className="mb-6 h-6">
        {winner ? (
          <p className="text-lg font-bold text-emerald-400">Winner: {winner}</p>
        ) : isDraw ? (
          <p className="text-lg text-amber-300">It's a draw!</p>
        ) : (
          <p className="text-slate-300">Next player: <span className="font-bold text-white">{isXNext ? "X" : "O"}</span></p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/20 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
        {board.map((cell, idx) => (
          <motion.button
            key={idx}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleClick(idx)}
            className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl flex items-center justify-center text-4xl font-light shadow-inner border border-white/5 hover:border-cyan-500/50 transition-colors"
          >
            {cell && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cell === "X" ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]"}
              >
                {cell}
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={resetGame}
        className="mt-8 px-6 py-2 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-sm"
      >
        Restart Game
      </motion.button>
    </div>
  );
}
