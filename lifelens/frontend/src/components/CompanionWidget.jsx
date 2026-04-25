import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COMPANION_MESSAGES = {
  calm: [
    "I'm here with you.",
    "We can take this slow.",
    "Take your time.",
    "I am right here."
  ],
  energy: [
    "You've got this.",
    "One step at a time.",
    "I'm here for you.",
    "Let's figure this out together."
  ],
  companion: [
    "I'm here with you.",
    "You don't have to go through this alone.",
    "We're in this together.",
    "I'm listening."
  ],
  rational: [
    "I'm here to help.",
    "Let's break this down.",
    "We can handle this.",
    "One step at a time."
  ],
  visual: [
    "I'm here.",
    "You're doing great.",
    "Take a breath."
  ]
};

export default function CompanionWidget({ strategy = "companion", onClose }) {
  const [messageIndex, setMessageIndex] = useState(0);
  
  const messages = COMPANION_MESSAGES[strategy] || COMPANION_MESSAGES["companion"];
  const intervalTime = strategy === "calm" ? 6000 : 4000;

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, intervalTime);
    return () => clearInterval(timer);
  }, [messages.length, intervalTime]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-4"
    >
      <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-white/20">
        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-gray-700 font-medium whitespace-nowrap"
          >
            {messages[messageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="relative group cursor-pointer" onClick={onClose}>
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: strategy === "calm" ? 3 : 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 bg-indigo-400 rounded-full blur-md"
        />
        <div className="relative w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full shadow-lg flex items-center justify-center border-2 border-white">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center text-white text-xs shadow-md">
            ✕
          </div>
        </div>
      </div>
    </motion.div>
  );
}
