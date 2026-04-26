import { motion, AnimatePresence } from "framer-motion";

export default function ActionPromptOverlay({ title, description, onConfirm, onCancel, confirmText = "Yes", cancelText = "No" }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1323]/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#121b2d] p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-4">
             <span className="text-2xl">✨</span>
          </div>
          <h3 className="text-xl font-medium text-white mb-2">{title}</h3>
          <p className="text-sm text-indigo-200/70 mb-6">{description}</p>
          
          <div className="flex w-full gap-3">
             <button
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors font-medium"
             >
                {cancelText}
             </button>
             <button
                onClick={onConfirm}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 transition-colors font-medium shadow-[0_0_20px_rgba(99,102,241,0.3)]"
             >
                {confirmText}
             </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
