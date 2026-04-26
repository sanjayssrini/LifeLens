import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function BreathingOverlay({ onClose, onVoicePause, onVoiceResume }) {
  const [phase, setPhase] = useState("Inhale...");

  const onVoicePauseRef = useRef(onVoicePause);
  const onVoiceResumeRef = useRef(onVoiceResume);

  useEffect(() => {
    onVoicePauseRef.current = onVoicePause;
    onVoiceResumeRef.current = onVoiceResume;
  }, [onVoicePause, onVoiceResume]);

  useEffect(() => {
    // Pause voice agent if active
    if (onVoicePauseRef.current) onVoicePauseRef.current();
    
    let phaseIndex = 0;
    const phases = ["Inhale...", "Hold...", "Exhale...", "Hold..."];
    
    // Cycle: 4s inhale, 4s hold, 4s exhale, 4s hold
    const interval = setInterval(() => {
      phaseIndex = (phaseIndex + 1) % phases.length;
      setPhase(phases[phaseIndex]);
    }, 4000);

    return () => {
      clearInterval(interval);
      if (onVoiceResumeRef.current) onVoiceResumeRef.current();
    };
  }, []);

  const getScale = () => {
    switch (phase) {
      case "Inhale...": return 1.5;
      case "Hold...": return phase === "Inhale..." ? 1.5 : 1; // It holds at the previous scale implicitly by css but let's animate to states
      case "Exhale...": return 1;
      default: return 1;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-sm"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/50 to-purple-50/50" />
        
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/80 shadow-sm text-gray-500 hover:bg-white hover:text-gray-800 transition-colors z-10"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative flex flex-col items-center justify-center z-10">
          <motion.div
            initial={{ scale: 1 }}
            animate={{ 
              scale: phase === "Inhale..." ? 1.5 : phase === "Hold..." ? (phase === "Hold..." && getScale() === 1.5 ? 1.5 : 1) : 1 
            }}
            transition={{ 
              duration: 4, 
              ease: "easeInOut" 
            }}
            className="w-48 h-48 rounded-full bg-indigo-200/50 flex items-center justify-center border-4 border-indigo-100 shadow-[0_0_40px_rgba(165,180,252,0.5)]"
          >
            <motion.div 
              className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-300 to-purple-300 shadow-inner"
              animate={{
                 scale: phase === "Inhale..." ? 1.2 : phase === "Exhale..." ? 0.8 : 1
              }}
              transition={{ duration: 4, ease: "easeInOut" }}
            />
          </motion.div>
          
          <div className="mt-16 h-12 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={phase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="text-2xl font-light text-indigo-900 tracking-widest"
              >
                {phase}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
