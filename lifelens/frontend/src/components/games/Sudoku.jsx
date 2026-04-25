import { useState } from "react";
import { motion } from "framer-motion";

// Simplified pre-filled Sudoku puzzle for the mini-game
const INITIAL_GRID = [
  [5, 3, null, null, 7, null, null, null, null],
  [6, null, null, 1, 9, 5, null, null, null],
  [null, 9, 8, null, null, null, null, 6, null],
  [8, null, null, null, 6, null, null, null, 3],
  [4, null, null, 8, null, 3, null, null, 1],
  [7, null, null, null, 2, null, null, null, 6],
  [null, 6, null, null, null, null, 2, 8, null],
  [null, null, null, 4, 1, 9, null, null, 5],
  [null, null, null, null, 8, null, null, 7, 9],
];

export default function Sudoku() {
  const [grid, setGrid] = useState(
    INITIAL_GRID.map(row => row.map(cell => ({ value: cell, isFixed: cell !== null })))
  );
  const [selectedCell, setSelectedCell] = useState(null);

  const handleCellClick = (rIndex, cIndex) => {
    if (grid[rIndex][cIndex].isFixed) return;
    setSelectedCell([rIndex, cIndex]);
  };

  const handleNumberInput = (num) => {
    if (!selectedCell) return;
    const [r, c] = selectedCell;
    const newGrid = [...grid];
    newGrid[r] = [...newGrid[r]];
    newGrid[r][c] = { ...newGrid[r][c], value: num };
    setGrid(newGrid);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 overflow-y-auto">
      <h3 className="text-2xl font-light text-indigo-200 mb-6 shrink-0">Sudoku</h3>

      <div className="flex flex-col sm:flex-row gap-8 items-center shrink-0">
        <div className="grid grid-cols-9 grid-rows-9 gap-0.5 bg-indigo-900 p-1 rounded-lg shadow-[0_0_20px_rgba(99,102,241,0.2)]">
          {grid.map((row, rIndex) =>
            row.map((cell, cIndex) => {
              const isSelected = selectedCell && selectedCell[0] === rIndex && selectedCell[1] === cIndex;
              // Add slight borders for 3x3 blocks
              const borderRight = cIndex === 2 || cIndex === 5 ? "border-r-2 border-indigo-900/50" : "";
              const borderBottom = rIndex === 2 || rIndex === 5 ? "border-b-2 border-indigo-900/50" : "";

              return (
                <button
                  key={`${rIndex}-${cIndex}`}
                  onClick={() => handleCellClick(rIndex, cIndex)}
                  className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center text-sm sm:text-base font-medium transition-colors
                    ${cell.isFixed ? "bg-[#1e293b] text-indigo-200 cursor-default" : "bg-[#0f172a] hover:bg-[#1e293b] text-white"}
                    ${isSelected ? "ring-2 ring-inset ring-indigo-400 bg-indigo-500/20" : ""}
                    ${borderRight} ${borderBottom}
                  `}
                >
                  {cell.value || ""}
                </button>
              );
            })
          )}
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-3 gap-2 shrink-0">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null].map((num, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNumberInput(num)}
              className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-lg font-light text-white hover:bg-indigo-500/30 transition-colors shadow-sm"
            >
              {num === null ? "⌫" : num}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
