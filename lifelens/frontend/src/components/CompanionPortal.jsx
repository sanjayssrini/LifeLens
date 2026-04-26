import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CompanionPortal({ chat, onClose, onIntentTrigger }) {
  const { messages, sendMessage, isThinking } = chat;
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef(null);

  const handleSend = (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isThinking) return;
    
    if (onIntentTrigger && onIntentTrigger(text)) {
      setInputValue("");
      return;
    }
    
    sendMessage(text, "text", { mode: "companion" });
    setInputValue("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-50 flex flex-col bg-[#0b1323] overflow-hidden"
      >
        {/* Deeply blurred ambient background */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: "url('/companion_avatar.png')", backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(40px)' }}></div>
        
        {/* Header */}
        <div className="relative z-10 w-full pt-10 pb-4 px-6 flex items-center bg-gradient-to-b from-[#0b1323] to-transparent shrink-0">
           <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors mr-4"
           >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
             </svg>
           </button>
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-500/50 overflow-hidden shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                 <img src="/companion_avatar.png" alt="Companion" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                 <h2 className="text-lg font-medium text-white tracking-wide leading-tight">Your Companion</h2>
                 <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></span>
                    Active Now
                 </p>
              </div>
           </div>
        </div>

        {/* Chat Section */}
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden min-h-0">
           <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar pb-2">
              <div className="flex flex-col space-y-4 max-w-3xl mx-auto w-full">
                 
                 {messages?.map((msg, i) => {
                   const isUser = msg.role === "user";
                   return (
                     <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        key={i} 
                        className={`flex ${isUser ? 'justify-end' : 'justify-start items-end gap-2'}`}
                     >
                        {!isUser && (
                           <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/10 mb-1">
                              <img src="/companion_avatar.png" alt="avatar" className="w-full h-full object-cover" />
                           </div>
                        )}
                        <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm
                          ${isUser ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white/10 text-indigo-50 rounded-bl-sm border border-white/5 backdrop-blur-md'}
                        `}>
                           {msg.content}
                        </div>
                     </motion.div>
                   )
                 })}
                 
                 {isThinking && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start items-end gap-2 mt-4">
                       <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.3)] z-20">
                          <img src="/companion_avatar.png" alt="typing" className="w-full h-full object-cover" />
                       </div>
                       <div className="max-w-[80%] px-4 py-4 rounded-2xl bg-white/10 rounded-bl-sm border border-white/10 flex gap-1.5 items-center mb-4 backdrop-blur-md">
                          <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                          <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                          <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                       </div>
                    </motion.div>
                 )}
                 <div ref={messagesEndRef} className="h-4" />
              </div>
           </div>
           
           {/* Input Area */}
           <div className="p-4 bg-transparent shrink-0 z-20 pb-8">
              <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-center">
                 <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Message..."
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-full pl-6 pr-14 py-3.5 text-white placeholder-white/50 focus:outline-none focus:border-indigo-400 transition-colors shadow-lg"
                 />
                 <button 
                    type="submit" 
                    disabled={!inputValue.trim() || isThinking}
                    className="absolute right-2 p-2 rounded-full bg-indigo-500 text-white disabled:opacity-50 disabled:bg-indigo-500/50 transition-all hover:bg-indigo-400"
                 >
                    <svg className="w-5 h-5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                 </button>
              </form>
           </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
