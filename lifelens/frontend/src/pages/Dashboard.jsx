import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";

import { useSupportChat } from "../hooks/useSupportChat";
import { useVapiVoiceAgent } from "../hooks/useVapiVoiceAgent";

import CompanionWidget from "../components/CompanionWidget";
import BreathingOverlay from "../components/BreathingOverlay";
import InsightCard from "../components/InsightCard";
import GamesPortal from "../components/GamesPortal";
import CheerUpOverlay from "../components/CheerUpOverlay";
import RacingThoughtsOverlay from "../components/RacingThoughtsOverlay";
import GentleRoutineOverlay from "../components/GentleRoutineOverlay";
import SOSModal from "../components/SOSModal";
import ActionPromptOverlay from "../components/ActionPromptOverlay";

const suggestionChips = [
  "I'm feeling anxious right now",
  "Guide me through breathing",
  "Help me calm racing thoughts",
  "Plan a gentle routine for today",
];

const suggestionChipSupportModes = [
  "anxious",
  "breathing",
  "calmingThoughts",
  "gentleRoutine",
];

function getLanguageName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
  } catch {
    return code;
  }
}

const LANGUAGE_OPTIONS = [
  { code: 'auto', label: 'Auto (detected)' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'ta', label: 'Tamil' },
  { code: 'bn', label: 'Bengali' },
];

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function extractMemoryText(item) {
  return String(item?.summary || item?.content || item?.transcript || item?.message || "").trim();
}

function summarizeMemoryThemes(memory) {
  const text = (memory || []).map(extractMemoryText).join(" ").toLowerCase();
  const themeMap = [
    { label: "staying calm", keywords: ["anxious", "anxiety", "stress", "stressed", "panic", "breathing", "calm"] },
    { label: "building a steadier routine", keywords: ["routine", "plan", "schedule", "habit", "sleep", "daily"] },
    { label: "work and life transitions", keywords: ["job", "work", "career", "interview", "boss", "school", "study"] },
    { label: "relationships and connection", keywords: ["family", "partner", "relationship", "friend", "lonely", "support"] },
    { label: "getting through a hard moment", keywords: ["overwhelmed", "sad", "down", "heavy", "cry", "tired", "burnout"] },
  ];

  return themeMap
    .filter((theme) => theme.keywords.some((keyword) => text.includes(keyword)))
    .map((theme) => theme.label)
    .slice(0, 2);
}

function summarizeProfile(memory, name) {
  const entries = (memory || []).map(extractMemoryText).filter(Boolean);
  const safeName = String(name || "there").trim() || "there";

  if (entries.length === 0) {
    return {
      title: safeName,
      summary: "I do not know much about you yet, but this space is ready when you are. Start with how you are feeling, what is on your mind, or what kind of help you want today.",
      prompt: "New here? Say one honest sentence and we will build from there.",
      isNewUser: true,
    };
  }

  const themes = summarizeMemoryThemes(memory);
  const recentNotes = entries.slice(-2).reverse().map((text) => (text.length > 92 ? `${text.slice(0, 92)}...` : text));

  let summary = "I have a few notes about you, and they point to what matters most right now.";
  if (themes.length > 0) {
    summary = `You seem focused on ${themes.join(" and ")}.`;
  } else if (recentNotes.length === 1) {
    summary = `You recently shared: ${recentNotes[0]}.`;
  } else if (recentNotes.length > 1) {
    summary = `You recently shared ${recentNotes[0]} and ${recentNotes[1]}.`;
  }

  return {
    title: safeName,
    summary,
    prompt: "What would you like to focus on next?",
    isNewUser: false,
  };
}

function createParticles() {
  return Array.from({ length: 8 }).map((_, index) => ({
    id: `particle-${index}`,
    size: 2 + (index % 4),
    left: `${4 + (index * 4.4) % 96}%`,
    top: `${6 + (index * 8.1) % 86}%`,
    drift: index % 2 === 0 ? 12 : -10,
    delay: index * 0.18,
    duration: 18 + index * 0.55,
  }));
}

function detectVoiceMetadata(transcript) {
  if (!transcript) {
    return {};
  }
  const text = String(transcript).trim();
  const lower = text.toLowerCase();
  const meta = {};

  if (/(\.\.\.|-{2,}|-\s|-$|\?\.\.|!!!)/m.test(text)) {
    meta.crack_detected = true;
  }

  const numExclamations = (text.match(/!/g) || []).length;
  const numAllCaps = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
  if (numExclamations >= 2 || numAllCaps >= 2) {
    meta.speed = "fast";
  }

  if (/\b(angry|anger|mad|furious|pissed|hate|damn|shit|fuck|bitch|asshole|rage|frustrated|irritated|outraged|resentful|screaming)\b/i.test(text)
      || numExclamations >= 2
      || numAllCaps >= 2) {
    meta.anger = true;
  }

  return meta;
}

function detectEmotionFromText(text) {
  if (!text) {
    return "neutral";
  }
  const lower = String(text).toLowerCase();
  
  if (/\b(angry|anger|mad|furious|pissed|hate|damn|shit|fuck|bitch|asshole|rage|frustrated|irritated|outraged|resentful|screaming|annoyed|unfair)\b/.test(lower)) {
    return "angry";
  }
  if (/\b(panic|panicking|anxious|anxiety|worried|nervous|overwhelmed|scared|fearful|tense|stressed|racing|breathless|hyperventilating|dread|can't breathe|freaking out)\b/.test(lower)) {
    return "anxious";
  }
  if (/\b(sad|depressed|broken|hopeless|down|tearful|lonely|hurt|grief|heartbroken|crying|upset|alone|lost|bad|terrible|awful|miserable|empty|hollow|nobody)\b/.test(lower)) {
    return "sad";
  }
  // Catch vague distress phrases
  if (lower.includes("idk") || lower.includes("don't know") || lower.includes("something happened") || lower.includes("tired of this")) {
    return "sad";
  }
  
  return "neutral";
}

function detectDanger(text) {
  if (!text) {
    return false;
  }
  const lower = String(text).toLowerCase();
  // Detect critical danger keywords and phrases
  return /\b(danger|emergency|danger|help|sos|hurt|injury|injured|bleeding|stabbed|shot|attacked|assault|rape|dying|dead|suicide|kill|myself|poison|overdose|crash|accident|fire|threat|threatened|abusive|abuse|violent|violence|someone is|i'm being|being attacked|being hurt|someone hurt|call police|call ambulance|911|police|hospital|urgent)\b/.test(lower);
}

function formatClock(ts) {
  const d = new Date(ts || Date.now());
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const thinkingLabels = ["Thinking...", "Understanding...", "Connecting ideas..."];

const thinkingNodes = [
  { left: "12%", top: "26%", lineWidth: "34%", rotate: "24deg", delay: 0 },
  { left: "78%", top: "21%", lineWidth: "30%", rotate: "148deg", delay: 0.14 },
  { left: "8%", top: "70%", lineWidth: "32%", rotate: "-28deg", delay: 0.28 },
  { left: "82%", top: "72%", lineWidth: "28%", rotate: "-154deg", delay: 0.42 },
  { left: "49%", top: "4%", lineWidth: "24%", rotate: "90deg", delay: 0.56 },
];

const orbWaveStrands = Array.from({ length: 5 }).map((_, index) => ({
  id: `orb-wave-${index}`,
  top: 18 + index * 4.2,
  opacity: 0.05 + (index % 4) * 0.025,
  delay: index * 0.1,
  skew: index % 2 === 0 ? -6 : 6,
}));

const orbDotLayers = Array.from({ length: 3 }).map((_, index) => ({
  id: `orb-dots-${index}`,
  inset: 6 + index * 5,
  size: 10 + index * 2,
  opacity: 0.12 - index * 0.018,
  duration: 14 + index * 3,
  reverse: index % 2 === 1,
}));

const orbScanRings = Array.from({ length: 3 }).map((_, index) => ({
  id: `orb-ring-${index}`,
  inset: 3 + index * 6,
  delay: index * 0.28,
}));

const orbSpeakerDots = Array.from({ length: 6 }).map((_, index) => {
  const angle = (index / 6) * Math.PI * 2;
  return {
    id: `speaker-dot-${index}`,
    x: Math.cos(angle) * 126,
    y: Math.sin(angle) * 126,
    delay: index * 0.08,
  };
});

const orbListeningDots = Array.from({ length: 4 }).map((_, index) => {
  const angle = (index / 4) * Math.PI * 2;
  return {
    id: `listen-dot-${index}`,
    x: Math.cos(angle) * 108,
    y: Math.sin(angle) * 108,
    delay: index * 0.12,
  };
});

const orbConnectionBands = [
  { id: "band-1", width: "74%", height: "24%", rotate: "-16deg", delay: 0 },
  { id: "band-2", width: "66%", height: "18%", rotate: "12deg", delay: 0.24 },
];

const DashboardBackground = memo(function DashboardBackground({ reduceMotion, particles, ambientMotionEnabled }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      <motion.div
        className="absolute inset-[-18%] bg-[radial-gradient(circle_at_48%_10%,rgba(64,139,229,0.16),transparent_34%),radial-gradient(circle_at_12%_22%,rgba(103,126,224,0.12),transparent_28%),radial-gradient(circle_at_82%_68%,rgba(94,146,220,0.1),transparent_26%),linear-gradient(120deg,#050d1c_0%,#07142c_48%,#040a17_100%)]"
        animate={ambientMotionEnabled ? { backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] } : { opacity: 1 }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute inset-0 opacity-55"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent 0px, transparent 16px, rgba(148,163,184,0.08) 17px, transparent 18px)",
        }}
        animate={ambientMotionEnabled ? { opacity: [0.16, 0.28, 0.16], y: [0, 6, 0] } : { opacity: 0.2 }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="absolute rounded-full bg-cyan-100/50 blur-[0.8px]"
          style={{ width: `${particle.size}px`, height: `${particle.size}px`, left: particle.left, top: particle.top }}
          animate={
            !ambientMotionEnabled || reduceMotion
              ? { opacity: 0.2 }
              : { y: [0, -12, 0], x: [0, particle.drift, 0], opacity: [0.08, 0.32, 0.08] }
          }
          transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
});

const humanizeEmotion = (emotion) => {
  const mapping = {
    sad: "You seem a bit low",
    anxious: "I'm sensing some tension",
    overwhelmed: "This feels heavy right now",
    frustrated: "I sense some frustration",
    tired: "You seem exhausted",
    lonely: "You might be feeling isolated",
    stressed: "I'm sensing some stress",
    angry: "I hear the frustration",
    happy: "You sound bright today",
    calm: "You seem grounded",
  };
  return mapping[emotion?.toLowerCase()] || `Sensing some ${emotion} feelings`;
};

const isNegativeEmotion = (emotion) => {
  return ["sad", "anxious", "overwhelmed", "lonely", "stressed", "angry", "tired", "frustrated"].includes(
    String(emotion || "").toLowerCase(),
  );
};

const strategyBadgeClass = (strategy) => {
  switch (String(strategy || "").toLowerCase()) {
    case "energy":
      return "border-orange-300/25 bg-orange-400/10 text-orange-100";
    case "calm":
      return "border-sky-300/25 bg-sky-400/10 text-sky-100";
    case "rational":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    case "companion":
      return "border-violet-300/25 bg-violet-400/10 text-violet-100";
    case "visual":
      return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
    default:
      return "border-slate-200/20 bg-white/5 text-slate-100";
  }
};

const ChatMessagesList = memo(function ChatMessagesList({ messages, isThinking, thinkingText, onFeedback, session }) {
  return (
    <div className="max-h-72 space-y-2 overflow-y-auto px-4 py-3">
      {messages.map((message) => (
        <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
          <div
            className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-6 ${
              message.role === "user"
                ? "bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950"
                : "border border-white/10 bg-white/[0.06] text-slate-100"
            }`}
          >
            {message.role === "assistant" && message.meta?.language && message.meta.language !== "en" && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 w-fit rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-cyan-200/70"
              >
                Detected: {String(message.meta.language).toUpperCase()}
              </motion.div>
            )}
            {message.role === "assistant" && message.meta?.strategy && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 w-fit rounded-full border border-slate-200/20 bg-slate-700/20 px-2.5 py-0.5 text-[10px] text-slate-100/80"
              >
                Strategy: {String(message.meta.strategy).toLowerCase()}
              </motion.div>
            )}
            {message.role === "assistant" && message.meta?.intensity > 0.5 && message.meta?.emotion && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 w-fit rounded-full border border-indigo-200/20 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] text-indigo-200/80"
              >
                {humanizeEmotion(message.meta.emotion)}
              </motion.div>
            )}
            {message.content}
            {message.role === "assistant" && message.id !== "welcome" && (
              <AnimatePresence>
                <FeedbackControls
                  status={message.meta?.feedbackStatus || "idle"}
                  hidden={message.meta?.feedbackHidden}
                  onFeedback={(feedback) =>
                    onFeedback(message.id, feedback, {
                      userId: session?.user?.user_id,
                      sessionToken: session?.session_token,
                      responseId: message.meta?.responseId || message.id,
                      metadata: {
                        source: "chat-ui",
                        message: message.content,
                      },
                    })
                  }
                />
              </AnimatePresence>
            )}
          </div>
        </div>
      ))}
      {isThinking && <p className="px-1 text-xs text-slate-200/60">{thinkingText}</p>}
    </div>
  );
});

const ChatComposer = memo(function ChatComposer({ session, initialDraft, onSubmit, onDraftConsumed }) {
  const [inputValue, setInputValue] = useState(initialDraft || "");

  useEffect(() => {
    setInputValue(initialDraft || "");
  }, [initialDraft]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const text = inputValue.trim();
      if (!text) {
        return;
      }
      onSubmit(text, {
        userId: session?.user?.user_id,
        sessionToken: session?.session_token,
      });
      setInputValue("");
      onDraftConsumed?.();
    },
    [inputValue, onDraftConsumed, onSubmit, session?.session_token, session?.user?.user_id],
  );

  return (
    <form onSubmit={handleSubmit} className="border-t border-white/10 p-3">
      <div className="flex gap-2">
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Type a thought..."
          className="h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.05] px-3 text-sm text-white outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          className="rounded-2xl bg-white px-4 text-sm font-medium text-slate-950 transition hover:-translate-y-0.5"
        >
          Send
        </button>
      </div>
    </form>
  );
});

function ContinuityPrompt({ memory, onContinue, onFresh, onDismiss }) {
  if (!memory) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed bottom-6 left-4 z-40 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-cyan-100/18 bg-[#0b1323]/92 px-4 py-3 shadow-[0_16px_34px_rgba(2,8,23,0.4)] backdrop-blur-md sm:left-6"
    >
      <div className="flex items-start justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 text-xs text-slate-200/80 hover:bg-white/[0.1]"
        >
          Close
        </button>
      </div>
      <p className="text-sm text-slate-100">Last time, you were focusing on {memory.last_topic}.</p>
      <p className="mt-1 text-xs leading-5 text-slate-300/78">Want to continue?</p>
      <div className="mt-3 flex justify-start gap-2">
        <button
          type="button"
          onClick={onFresh}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-100/78 transition hover:bg-white/[0.07]"
        >
          Start fresh
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-full bg-cyan-100 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:-translate-y-0.5"
        >
          Continue
        </button>
      </div>
    </motion.div>
  );
}

function FeedbackControls({ status, hidden, onFeedback }) {
  if (hidden) {
    return null;
  }

  if (status === "sent") {
    return (
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        className="mt-2 text-xs text-cyan-100/72"
      >
        Thanks for the feedback
      </motion.p>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="mt-2 flex flex-wrap gap-2"
    >
      <button
        type="button"
        disabled={status === "sending"}
        onClick={() => onFeedback("positive")}
        className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-100/78 transition hover:bg-white/[0.08] disabled:opacity-50"
      >
        👍 Helpful
      </button>
      <button
        type="button"
        disabled={status === "sending"}
        onClick={() => onFeedback("negative")}
        className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-100/78 transition hover:bg-white/[0.08] disabled:opacity-50"
      >
        👎 Not helpful
      </button>
    </motion.div>
  );
}

const ChatDrawer = memo(function ChatDrawer({
  visible,
  session,
  thinkingText,
  initialDraft,
  autoSendInitialDraft,
  resetToken,
  onClose,
  onDraftConsumed,
  onInitialDraftAutoSent,
  onSupportAction,
  onIntentTrigger,
  chat,
}) {
  const { resetChat, messages, isThinking, sendFeedback, sendMessage } = chat;
  const chatScrollRef = useRef(null);
  const processedMessageIdsRef = useRef(new Set());
  const autoSentDraftRef = useRef("");

  useEffect(() => {
    resetChat();
  }, [resetChat, resetToken]);

  useEffect(() => {
    if (!visible || !chatScrollRef.current) {
      return;
    }
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, isThinking, visible]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "assistant" && lastMessage.meta) {
      if (processedMessageIdsRef.current.has(lastMessage.id)) return;
      
      const { intensity, extra_action, strategy } = lastMessage.meta;
      
      if ((intensity > 0.6 && extra_action) || extra_action === "play_game") {
        onSupportAction?.({ extra_action, strategy });
      }
      
      processedMessageIdsRef.current.add(lastMessage.id);
    }
  }, [messages, onSupportAction]);

  const submitChat = useCallback(
    (text, options = {}) => {
      // Use the injected intent router for SOS, Games, Companion, Breathing, etc.
      if (onIntentTrigger) {
        const handled = onIntentTrigger(text);
        if (handled) return;
      }
      
      sendMessage(text, "text", {
        userId: options.userId || session?.user?.user_id,
        sessionToken: options.sessionToken || session?.session_token,
        demoMode: false,
        voiceMetadata: detectVoiceMetadata(text),
      });
    },
    [detectVoiceMetadata, sendMessage, session?.session_token, session?.user?.user_id],
  );

  useEffect(() => {
    if (!visible || !autoSendInitialDraft) {
      return;
    }

    const draft = String(initialDraft || "").trim();
    if (!draft) {
      return;
    }

    if (autoSentDraftRef.current === draft) {
      return;
    }

    autoSentDraftRef.current = draft;
    submitChat(draft, {
      userId: session?.user?.user_id,
      sessionToken: session?.session_token,
    });
    onDraftConsumed?.();
    onInitialDraftAutoSent?.();
  }, [
    autoSendInitialDraft,
    initialDraft,
    onDraftConsumed,
    onInitialDraftAutoSent,
    session?.session_token,
    session?.user?.user_id,
    submitChat,
    visible,
  ]);

  useEffect(() => {
    if (!initialDraft) {
      autoSentDraftRef.current = "";
    }
  }, [initialDraft]);

  if (!visible) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed bottom-24 right-5 z-40 w-[min(92vw,24rem)] overflow-hidden rounded-[1.2rem] border border-white/12 bg-[#0b1323]/95 shadow-[0_20px_52px_rgba(2,8,23,0.44)] backdrop-blur-md"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white">Continue in chat</p>
          <p className="text-xs text-slate-200/60">A quieter way to keep going</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-100/80 hover:bg-white/[0.08]"
        >
          Close
        </button>
      </div>

      <div className="mt-4">
        <InsightCard session={session} />
      </div>

      <div ref={chatScrollRef}>
        <ChatMessagesList
          messages={messages}
          isThinking={isThinking}
          thinkingText={thinkingText}
          onFeedback={sendFeedback}
          session={session}
        />
      </div>

      <ChatComposer
        session={session}
        initialDraft={initialDraft}
        onSubmit={submitChat}
        onDraftConsumed={onDraftConsumed}
      />
    </motion.div>
  );
});

export default function Dashboard({ session, onLogout }) {
  const prefersReducedMotion = useReducedMotion();
  const [ripples, setRipples] = useState([]);
  const [activeChipIndex, setActiveChipIndex] = useState(-1);
  const [showChat, setShowChat] = useState(false);
  const [forceReducedMotion, setForceReducedMotion] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [chatDraftSeed, setChatDraftSeed] = useState("");
  const [chatAutoSendSeed, setChatAutoSendSeed] = useState(false);
  const [chatResetToken, setChatResetToken] = useState(0);
  const [profileUser, setProfileUser] = useState(() => session?.user || {});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isClearingMemory, setIsClearingMemory] = useState(false);
  const [continuityMemory, setContinuityMemory] = useState(null);
  const [continuityVisible, setContinuityVisible] = useState(false);
  const [thinkingLabelIndex, setThinkingLabelIndex] = useState(0);
  const [voiceFeedback, setVoiceFeedback] = useState({ responseId: "", status: "idle", hidden: false });
  const [isPageVisible, setIsPageVisible] = useState(true);
  
  // Layer 3 Support States
  const [supportMode, setSupportMode] = useState(null);
  const [showSupportPopup, setShowSupportPopup] = useState(false);
  const [supportStrategy, setSupportStrategy] = useState("companion");
  const [isVisualBoost, setIsVisualBoost] = useState(false);
  const [showGamesPortal, setShowGamesPortal] = useState(false);
  const [showCompanionPortal, setShowCompanionPortal] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [languageSelection, setLanguageSelection] = useState({ mode: "detected", value: "en" });
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [actionPromptConfig, setActionPromptConfig] = useState(null);
  const languageMenuRef = useRef(null);
  const voiceTranscriptSentRef = useRef("");

  const chat = useSupportChat();
  const { resetChat, messages, isThinking, sendFeedback, sendMessage } = chat;

  const settingsMenuRef = useRef(null);
  const chipTimeoutRef = useRef(null);
  const particles = useMemo(() => createParticles(), []);

  const processIntentTriggers = useCallback((text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    
    // 1. SOS / Danger (Immediate Override)
    if (detectDanger(text)) {
      setShowSOSModal(true);
      return true; // handled
    }
    
    // 2. Play Games Prompt
    if (/\b(sad|bored|boredom|play games|game|sudoku|bubble|tic tac toe)\b/.test(lower) && /\b(play|game|bored)\b/.test(lower)) {
      setActionPromptConfig(prev => {
        if (prev) return prev;
        return {
          title: "Need a distraction?",
          description: "Would you like to play some casual games to take your mind off things?",
          confirmText: "Yes, play games",
          cancelText: "No thanks",
          onConfirm: () => {
            setActionPromptConfig(null);
            setShowGamesPortal(true);
          },
          onCancel: () => setActionPromptConfig(null)
        };
      });
      // We don't return true because we still want to send the message to the AI
      // Return true only if you want to swallow the message.
    }
    
    // 3. Companion / Sit with me
    else if (/\b(alone|lonely|sit with me|company|friend)\b/.test(lower)) {
      setActionPromptConfig(prev => {
        if (prev) return prev;
        return {
          title: "You are not alone",
          description: "Do you want me to sit with you for a while?",
          confirmText: "Yes, sit with me",
          cancelText: "I'm okay",
          onConfirm: () => {
            setActionPromptConfig(null);
            setSupportMode("companion");
          },
          onCancel: () => setActionPromptConfig(null)
        };
      });
    }
    
    // 4. Breathing / Anxious
    else if (/\b(breathless|anxious|panic|breathe|breathing|can't breathe|hyperventilating)\b/.test(lower)) {
      setActionPromptConfig(prev => {
        if (prev) return prev;
        return {
          title: "Let's take a breath",
          description: "Should we try a quick breathing exercise together?",
          confirmText: "Yes, breathe",
          cancelText: "No, keep talking",
          onConfirm: () => {
            setActionPromptConfig(null);
            setSupportMode("breathing");
          },
          onCancel: () => setActionPromptConfig(null)
        };
      });
    }
    
    return false; // let the message go to the backend
  }, []);

  const submitVoiceTranscript = useCallback(
    (transcript) => {
      if (!transcript || String(transcript).trim().length === 0) {
        return;
      }
      const normalized = String(transcript).trim();
      if (voiceTranscriptSentRef.current === normalized) {
        return;
      }
      voiceTranscriptSentRef.current = normalized;
      
      // Run keyword router before sending to backend
      const handled = processIntentTriggers(normalized);
      if (handled) return;
      
      // Note: We intentionally do NOT call setShowChat(true) or sendMessage() here.
      // The voice agent (Vapi) handles its own LLM communication directly.
      // Mirroring the voice transcripts to the manual text chat causes the chat drawer
      // to pop open aggressively and duplicates the conversation.
    },
    [processIntentTriggers]
  );

  const voice = useVapiVoiceAgent({
    onFinalTranscript: submitVoiceTranscript,
    userId: session?.user?.user_id || "",
    sessionToken: session?.session_token || "",
  });

  const userName = session?.user?.name || "Sanjay";
  const firstName = userName.split(" ").filter(Boolean)[0] || "Sanjay";
  const greeting = getTimeGreeting();

  const memoryItems = useMemo(() => {
    const list = profileUser?.memory;
    return Array.isArray(list) ? list : [];
  }, [profileUser]);

  const profileSummary = useMemo(
    () => summarizeProfile(memoryItems, profileUser?.name || session?.user?.name || "there"),
    [memoryItems, profileUser?.name, session?.user?.name],
  );

  const isListening = voice.activity === "listening";
  const isConnecting = voice.connecting;
  const isReasoning = voice.activity === "processing";
  const isVoiceThinking = isConnecting || isReasoning;
  const isSpeaking = voice.activity === "answering";
  const orbActive = isListening || isVoiceThinking || isSpeaking;
  const reduceMotion = Boolean(prefersReducedMotion || forceReducedMotion || !isPageVisible);
  const ambientMotionEnabled = Boolean(!reduceMotion && orbActive);
  const renderedParticles = useMemo(
    () => (ambientMotionEnabled ? particles : particles.slice(0, 4)),
    [ambientMotionEnabled, particles],
  );

  const assistantMeta = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.role === "assistant" && message.meta) {
        return message.meta;
      }
    }
    return {};
  }, [messages]);

  const assistantEmotion = String(assistantMeta?.emotion || "neutral").toLowerCase();
  const assistantStrategy = String(assistantMeta?.strategy || "companion").toLowerCase();
  const assistantLanguage = String(assistantMeta?.language || "en").toLowerCase();
  const assistantIntensity = Number(assistantMeta?.intensity || 0);
  const selectedLanguageCode =
    languageSelection.mode === "detected" ? assistantLanguage : languageSelection.value;
  const selectedLanguageOptionCode = languageSelection.mode === "detected" ? "auto" : languageSelection.value;

  useEffect(() => {
    if (languageSelection.mode === "detected" && assistantLanguage) {
      setLanguageSelection((current) => ({ ...current, value: assistantLanguage }));
    }
  }, [assistantLanguage, languageSelection.mode]);

  useEffect(() => {
    if (!languageMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (!languageMenuRef.current?.contains(event.target)) {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [languageMenuOpen]);

  const selectLanguage = useCallback((code) => {
    if (!code) {
      return;
    }

    if (code === "auto") {
      setLanguageSelection({ mode: "detected", value: assistantLanguage });
    } else {
      setLanguageSelection({ mode: "manual", value: code });
    }
    setLanguageMenuOpen(false);
  }, [assistantLanguage]);

  const latestUserMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        return String(messages[i].content || "");
      }
    }
    return "";
  }, [messages]);

  const userEmotion = detectEmotionFromText(voice.userTranscript || latestUserMessage || "");
  const currentMood = userEmotion !== "neutral" ? userEmotion : assistantEmotion;

  const shouldPromptSupport = !supportMode && !showSupportPopup && (
    assistantMeta?.extra_action ||
    (assistantIntensity > 0.65 && isNegativeEmotion(currentMood))
  );

  useEffect(() => {
    if (!shouldPromptSupport) {
      return;
    }
    setSupportStrategy(assistantStrategy || "companion");
    setShowSupportPopup(true);
  }, [shouldPromptSupport, assistantStrategy]);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    const cores = Number(navigator.hardwareConcurrency || 8);
    const memoryGb = Number(navigator.deviceMemory || 8);
    const saveData = Boolean(navigator.connection?.saveData);
    if (saveData || cores <= 4 || memoryGb <= 4) {
      setForceReducedMotion(true);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const syncVisibility = () => {
      setIsPageVisible(!document.hidden);
    };

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  const statusText = useMemo(() => {
    if (isConnecting) {
      return "Connecting";
    }
    if (isListening) {
      return "Listening";
    }
    if (isSpeaking) {
      return "Answering";
    }
    if (isVoiceThinking) {
      return "Understanding";
    }
    return "Tap to speak";
  }, [isConnecting, isListening, isSpeaking, isVoiceThinking]);

  const thinkingText = isReasoning ? thinkingLabels[thinkingLabelIndex % thinkingLabels.length] : "Thinking...";

  const liveTranscript = useMemo(
    () => ({
      user: voice.userTranscript?.trim() || "",
      assistant: voice.assistantTranscript?.trim() || "",
    }),
    [voice.assistantTranscript, voice.userTranscript],
  );

  useEffect(() => {
    if (!isReasoning) {
      setThinkingLabelIndex(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setThinkingLabelIndex((current) => (current + 1) % thinkingLabels.length);
    }, 650);

    return () => window.clearInterval(interval);
  }, [isReasoning]);

  useEffect(() => {
    if (voice.connected || voice.connecting || voice.activity !== "idle") {
      setHasInteracted(true);
    }
  }, [voice.activity, voice.connected, voice.connecting]);

  useEffect(() => {
    return () => {
      if (chipTimeoutRef.current) {
        window.clearTimeout(chipTimeoutRef.current);
      }
    };
  }, []);

  const handleSupportAction = useCallback(({ extra_action, strategy }) => {
    setSupportStrategy(strategy || "companion");

    if (extra_action === "visual_boost") {
      setIsVisualBoost(true);
      setTimeout(() => setIsVisualBoost(false), 2000);
      return;
    }

    if (extra_action === "companion" || extra_action === "breathing" || extra_action === "play_game") {
      if (!supportMode) {
        if (extra_action === "play_game") {
          setSupportMode("play_game");
        }
        setShowSupportPopup(true);
      }
      return;
    }
  }, [supportMode]);

  useEffect(() => {
    setProfileUser(session?.user || {});
  }, [session?.user]);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/conversation/continuity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: session?.user?.user_id || "",
        session_token: session?.session_token || "",
      }),
    })
      .then((response) => response.json())
      .then((payload) => {
        const memory = payload?.memory || (payload?.last_topic ? payload : null);
        if (!isMounted || !memory) {
          return;
        }
        setContinuityMemory(memory);
        setContinuityVisible(true);
      })
      .catch(() => {
        // Continuity is helpful, not required.
      });

    return () => {
      isMounted = false;
    };
  }, [session?.session_token, session?.user?.user_id]);

  useEffect(() => {
    const text = voice.assistantTranscript?.trim();
    if (!text) {
      return;
    }

    setVoiceFeedback((current) => {
      if (current.responseId && current.text === text) {
        return current;
      }
      return {
        responseId: `voice-${Date.now()}`,
        text,
        status: "idle",
        hidden: false,
      };
    });
  }, [voice.assistantTranscript]);

  useEffect(() => {
    if (!continuityVisible) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setContinuityVisible(false);
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [continuityVisible]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!settingsMenuRef.current) {
        return;
      }

      if (!settingsMenuRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    };

    if (settingsOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [settingsOpen]);

  const loadUserProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session?.user?.user_id || "",
          session_token: session?.session_token || "",
        }),
      });

      const payload = await response.json();
      if (response.ok && payload?.status === "ok" && payload?.user) {
        setProfileUser(payload.user);
      }
    } catch {
      // Keep existing profile data if refresh fails.
    }
  }, [session?.session_token, session?.user?.user_id]);

  useEffect(() => {
    if (settingsOpen) {
      loadUserProfile();
    }
  }, [loadUserProfile, settingsOpen]);

  const clearMemory = useCallback(async () => {
    if (isClearingMemory) {
      return;
    }

    const confirmed = window.confirm("Are you sure you want to clear all saved memory?");
    if (!confirmed) {
      return;
    }

    setIsClearingMemory(true);
    try {
      const response = await fetch("/api/memory/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session?.user?.user_id || "",
          session_token: session?.session_token || "",
        }),
      });
      const payload = await response.json();

      if (response.ok && payload?.status === "ok") {
        setProfileUser((current) => ({
          ...(current || {}),
          memory: [],
        }));
      }
    } catch {
      // Do not break the dashboard on network issues.
    } finally {
      setIsClearingMemory(false);
    }
  }, [isClearingMemory, session?.session_token, session?.user?.user_id]);

  const dismissContinuity = useCallback(() => {
    setContinuityVisible(false);
  }, []);

  const continueFromMemory = useCallback(() => {
    setContinuityVisible(false);
    setShowChat(true);
    setHasInteracted(true);
    const topic = String(continuityMemory?.last_topic || "your last conversation").trim();
    const summary = String(continuityMemory?.summary || "").trim();
    const seeded = summary
      ? `Can we continue from last time? We were focusing on ${topic}. Last note: ${summary}`
      : `Can we continue from last time? We were focusing on ${topic}.`;
    setChatDraftSeed(seeded);
    setChatAutoSendSeed(true);
  }, [continuityMemory?.last_topic, continuityMemory?.summary]);

  const startFreshFromMemory = useCallback(() => {
    setContinuityVisible(false);
    setChatResetToken((current) => current + 1);
    setShowChat(true);
    setHasInteracted(true);
    setChatDraftSeed("");
    setChatAutoSendSeed(false);
  }, []);

  const sendVoiceFeedback = useCallback(
    async (feedback) => {
      if (!voiceFeedback.responseId || voiceFeedback.status === "sending") {
        return;
      }

      const normalizedFeedback = feedback === "positive" ? "positive" : "negative";
      setVoiceFeedback((current) => ({ ...current, feedback: normalizedFeedback, status: "sending" }));

      try {
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: session?.user?.user_id || "",
            session_token: session?.session_token || "",
            response_id: voiceFeedback.responseId,
            feedback: normalizedFeedback,
            metadata: {
              source: "voice-transcript",
              transcript: voiceFeedback.text || voice.assistantTranscript || "",
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Feedback failed");
        }

        setVoiceFeedback((current) => ({ ...current, status: "sent" }));
        window.setTimeout(() => {
          setVoiceFeedback((current) =>
            current.responseId === voiceFeedback.responseId ? { ...current, hidden: true } : current,
          );
        }, 2600);
      } catch {
        setVoiceFeedback((current) => ({ ...current, status: "idle" }));
      }
    },
    [session?.session_token, session?.user?.user_id, voice.assistantTranscript, voiceFeedback],
  );

  const triggerVoice = useCallback(() => {
    setHasInteracted(true);
    const rippleId = Date.now() + Math.random();
    setRipples([rippleId]);
    voice.toggle();
  }, [voice]);

  const triggerSuggestion = useCallback(
    (index) => {
      setHasInteracted(true);
      setShowChat(true);
      setActiveChipIndex(index);
      setSupportMode(suggestionChipSupportModes[index] || null);
      const rippleId = Date.now() + Math.random();
      setRipples([rippleId]);

      if (chipTimeoutRef.current) {
        window.clearTimeout(chipTimeoutRef.current);
      }
      chipTimeoutRef.current = window.setTimeout(() => {
        setActiveChipIndex(-1);
      }, 180);

      const suggestionText = suggestionChips[index];
      // Check for danger keywords - if detected, trigger SOS immediately
      if (detectDanger(suggestionText)) {
        setShowSOSModal(true);
        return;
      }

      sendMessage(suggestionText, "text", {
        userId: session?.user?.user_id,
        sessionToken: session?.session_token,
      });
    },
    [sendMessage, session?.session_token, session?.user?.user_id],
  );

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
      <div 
        className={`relative min-h-screen overflow-hidden px-5 py-5 text-white sm:px-8 transition-all duration-1000 ${
          isVisualBoost ? "shadow-[inset_0_0_80px_rgba(165,180,252,0.3)] bg-indigo-900/10" : "bg-[#0b1323]"
        }`}
      >
      <DashboardBackground reduceMotion={reduceMotion} particles={renderedParticles} ambientMotionEnabled={ambientMotionEnabled} />

      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
        className="mx-auto flex w-full max-w-[1150px] items-start justify-between"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.44em] text-cyan-100/55">LifeLens</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-white sm:text-[2rem]">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-slate-200/72">I'm here for you.</p>
        </div>

        <div ref={settingsMenuRef} className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="rounded-full border border-white/14 bg-white/[0.05] px-3.5 py-1.5 text-sm text-slate-100/86 transition hover:-translate-y-0.5 hover:bg-white/[0.09]"
          >
            ⚙️
          </button>
          <motion.button
            type="button"
            onClick={() => setShowSOSModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-full border-2 border-rose-400/50 bg-rose-500/20 px-3.5 py-1.5 text-sm font-bold text-rose-100 transition hover:-translate-y-0.5 hover:bg-rose-500/30 shadow-[0_0_15px_rgba(220,38,38,0.3)]"
          >
            🆘 SOS
          </motion.button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-white/14 bg-white/[0.05] px-3.5 py-1.5 text-sm text-slate-100/86 transition hover:-translate-y-0.5 hover:bg-white/[0.09]"
          >
            Logout
          </button>
        </div>

        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-white/14 bg-[#0c172a]/95 p-3 shadow-[0_18px_40px_rgba(2,8,23,0.5)] backdrop-blur-md"
            >
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/70">User</p>
                <p className="mt-1 text-sm font-medium text-white">{profileUser?.name || session?.user?.name || "Unknown user"}</p>
                <p className="text-xs text-slate-300/80">{profileUser?.phone_or_email || session?.user?.phone_or_email || "No contact"}</p>
                <p className="mt-1 text-[11px] text-slate-300/70">ID: {profileUser?.user_id || session?.user?.user_id || "-"}</p>
              </div>

              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/70">Memory</p>
                  <span className="text-xs text-slate-300/80">{memoryItems.length} saved</span>
                </div>
                <div className="mt-1 max-h-24 space-y-1 overflow-y-auto pr-1">
                  {memoryItems.length === 0 && <p className="text-xs text-slate-300/70">No saved memory yet.</p>}
                  {memoryItems.slice(-3).reverse().map((item, index) => (
                    <p key={`memory-item-${index}`} className="text-xs text-slate-200/85">
                      {String(item?.content || item?.transcript || "").slice(0, 80) || "Memory item"}
                    </p>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowChat(true);
                  setSettingsOpen(false);
                }}
                className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100/90 transition hover:bg-white/[0.08]"
              >
                Open chat panel
              </button>
              <button
                type="button"
                disabled={isClearingMemory || memoryItems.length === 0}
                onClick={clearMemory}
                className="mt-1 w-full rounded-xl border border-rose-300/20 px-3 py-2 text-left text-sm text-rose-100/90 transition hover:bg-rose-300/[0.12] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isClearingMemory ? "Clearing memory..." : "Clear memory"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <main className="mx-auto mt-8 flex w-full flex-col items-center justify-center gap-8 pb-40">
        <section className="relative flex w-full flex-col items-center justify-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <motion.div
              className="h-[24rem] w-[24rem] rounded-full bg-cyan-300/8 blur-[78px]"
              animate={ambientMotionEnabled ? { opacity: [0.3, 0.56, 0.3], scale: [1, 1.04, 1] } : { opacity: 0.36 }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <motion.div
            className="pointer-events-none absolute left-[-8%] right-[-8%] top-[31%] h-[10.5rem] overflow-hidden"
            animate={ambientMotionEnabled ? { opacity: [0.08, 0.24, 0.08], x: [-10, 10, -10] } : { opacity: 0.12 }}
            transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
          >
            {orbWaveStrands.map((strand) => (
              <motion.span
                key={strand.id}
                className="absolute left-0 right-0 h-px rounded-full bg-[linear-gradient(90deg,transparent_0%,rgba(196,181,253,0.04)_16%,rgba(125,211,252,0.1)_32%,rgba(103,232,249,0.22)_44%,rgba(52,211,153,0.22)_50%,rgba(125,211,252,0.12)_64%,rgba(196,181,253,0.05)_80%,transparent_100%)]"
                style={{
                  top: `${strand.top}%`,
                  opacity: strand.opacity,
                  transform: `skewY(${strand.skew}deg)`,
                  filter: "drop-shadow(0 0 4px rgba(34,211,238,0.12))",
                }}
                animate={
                  reduceMotion
                    ? { scaleX: 1 }
                    : { scaleX: [0.92, 1.02, 0.95], y: [0, strand.skew > 0 ? -6 : 6, 0] }
                }
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: strand.delay * 0.7 }}
              />
            ))}
          </motion.div>

          <AnimatePresence>
            {(isThinking || isSpeaking) && (
              <motion.div
                key="live-lines"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                {[0, 1, 2].map((line) => (
                  <motion.span
                    key={`live-line-${line}`}
                    className="absolute h-px w-[64%] rounded-full bg-gradient-to-r from-transparent via-cyan-100/36 to-transparent"
                    style={{ top: `${46 + line * 5}%` }}
                    animate={
                      reduceMotion
                        ? { opacity: 0.14 }
                        : { scaleX: [0.86, 1.02, 0.86], opacity: [0.08, 0.28, 0.08] }
                    }
                    transition={{ duration: 0.72, repeat: Infinity, ease: "easeInOut", delay: line * 0.08 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={triggerVoice}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            animate={
              reduceMotion
                ? { scale: 1 }
                : isListening
                  ? { scale: [1, 1.014, 1], boxShadow: ["0 0 58px rgba(45,212,191,0.24)", "0 0 86px rgba(34,211,238,0.34)", "0 0 58px rgba(45,212,191,0.24)"] }
                  : isThinking
                    ? {
                        scale: [1, 1.012, 1],
                        boxShadow: [
                          "0 0 62px rgba(45,212,191,0.18)",
                          "0 0 98px rgba(34,211,238,0.28)",
                          "0 0 62px rgba(45,212,191,0.18)",
                        ],
                      }
                    : isSpeaking
                    ? {
                        scale: [1, 1.018, 1],
                        boxShadow: [
                          "0 0 72px rgba(45,212,191,0.24)",
                          "0 0 126px rgba(34,211,238,0.34)",
                          "0 0 72px rgba(16,185,129,0.28)",
                        ],
                      }
                    : { scale: 1, boxShadow: "0 0 44px rgba(34,211,238,0.16)" }
            }
            transition={orbActive ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.35, ease: "easeOut" }}
            className="group relative z-10 flex aspect-square h-80 w-80 items-center justify-center overflow-visible rounded-full border border-cyan-100/18 bg-transparent"
          >
            <motion.div
              className="absolute inset-[-18%] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.34),rgba(103,232,249,0.16)_32%,rgba(56,189,248,0.08)_52%,transparent_76%)] blur-3xl"
              animate={reduceMotion || !orbActive ? { opacity: 0.36, scale: 1 } : { opacity: [0.26, 0.6, 0.26], scale: [0.96, 1.08, 0.96] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.div
              className="absolute inset-[4%] rounded-full bg-[radial-gradient(circle_at_50%_38%,rgba(232,249,255,0.5)_0%,rgba(125,211,252,0.34)_18%,rgba(34,211,238,0.3)_34%,rgba(8,47,73,0.72)_64%,rgba(3,10,24,0.96)_100%)] shadow-[inset_0_0_26px_rgba(224,247,255,0.16),inset_0_0_74px_rgba(14,116,144,0.28)]"
              animate={reduceMotion || !orbActive ? { scale: 1, opacity: 0.95 } : { scale: [1, 1.018, 1], opacity: [0.94, 1, 0.94] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.div
              className="absolute inset-[9%] rounded-full bg-[radial-gradient(circle_at_42%_28%,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_68%_72%,rgba(34,211,238,0.18),transparent_24%),linear-gradient(180deg,rgba(186,230,253,0.08),rgba(8,47,73,0.1))]"
              animate={
                reduceMotion || !orbActive
                  ? { rotate: 0 }
                  : {
                      rotate: [0, 8, 0, -8, 0],
                      scale: [1, 1.008, 1, 1.01, 1],
                      borderRadius: [
                        "50% 50% 48% 52% / 50% 46% 54% 50%",
                        "48% 52% 50% 50% / 48% 52% 48% 52%",
                        "50% 50% 48% 52% / 50% 46% 54% 50%",
                      ],
                    }
              }
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />

            {orbConnectionBands.map((band) => (
              <motion.div
                key={band.id}
                className="absolute left-1/2 top-1/2 rounded-[999px] bg-[linear-gradient(90deg,rgba(34,211,238,0.02),rgba(103,232,249,0.18),rgba(34,211,238,0.02))]"
                style={{
                  width: band.width,
                  height: band.height,
                  marginLeft: `calc(${band.width} / -2)`,
                  marginTop: `calc(${band.height} / -2)`,
                  rotate: band.rotate,
                  filter: "blur(1px)",
                }}
                animate={reduceMotion || !orbActive ? { opacity: 0.1 } : { opacity: [0.06, 0.2, 0.06], scaleX: [0.98, 1.03, 0.98], y: [0, -4, 0, 4, 0] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: band.delay * 0.7 }}
              />
            ))}

            <motion.div
              className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,rgba(224,247,255,0.06)_24%,transparent_64%)]"
              animate={reduceMotion || !orbActive ? { opacity: 0.28 } : { opacity: [0.18, 0.34, 0.18], scale: [0.98, 1.03, 0.98] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            />

            <AnimatePresence>
              {isListening && (
                <motion.div
                  key="listening-dots"
                  className="pointer-events-none absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {orbListeningDots.map((dot) => (
                    <motion.span
                      key={dot.id}
                      className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.78)]"
                      style={{ x: dot.x, y: dot.y, marginLeft: "-0.25rem", marginTop: "-0.25rem" }}
                      animate={reduceMotion ? { opacity: 0.5 } : { opacity: [0.22, 1, 0.22], scale: [0.8, 1.3, 0.8] }}
                      transition={{ duration: 0.88, repeat: Infinity, ease: "easeInOut", delay: dot.delay * 0.7 }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isSpeaking && (
                <motion.div
                  key="speaking-orbit"
                  className="pointer-events-none absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, rotate: 360 }}
                  exit={{ opacity: 0 }}
                  transition={{ opacity: { duration: 0.2 }, rotate: { duration: 3.6, repeat: Infinity, ease: "linear" } }}
                >
                  {orbSpeakerDots.map((dot, index) => (
                    <motion.span
                      key={dot.id}
                      className="absolute left-1/2 top-1/2 rounded-full bg-cyan-100 shadow-[0_0_14px_rgba(103,232,249,0.9)]"
                      style={{
                        x: dot.x,
                        y: dot.y,
                        width: index % 3 === 0 ? "0.55rem" : "0.35rem",
                        height: index % 3 === 0 ? "0.55rem" : "0.35rem",
                        marginLeft: index % 3 === 0 ? "-0.275rem" : "-0.175rem",
                        marginTop: index % 3 === 0 ? "-0.275rem" : "-0.175rem",
                      }}
                      animate={reduceMotion ? { opacity: 0.7 } : { opacity: [0.3, 1, 0.3], scale: [0.85, 1.5, 0.85] }}
                      transition={{ duration: 0.72, repeat: Infinity, ease: "easeInOut", delay: dot.delay * 0.7 }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isThinking && (
                <motion.div
                  key="orb-shimmer"
                  className="pointer-events-none absolute inset-[4%] overflow-hidden rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.span
                    className="absolute -left-1/4 top-[18%] h-[26%] w-1/2 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)] blur-md"
                    animate={{ x: ["0%", "260%"] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_34%_28%,rgba(255,255,255,0.08),transparent_22%),radial-gradient(circle_at_68%_66%,rgba(103,232,249,0.12),transparent_26%),radial-gradient(circle_at_48%_52%,rgba(34,211,238,0.06),transparent_36%)] blur-md"
              animate={reduceMotion || !orbActive ? { opacity: 0.14 } : { opacity: [0.12, 0.28, 0.12], scale: [0.99, 1.02, 0.99], rotate: [0, -6, 0] }}
              transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
            />

            <AnimatePresence>
              {(isThinking || isSpeaking) && (
                <motion.div
                  key="wave-sweep"
                  className="absolute inset-[10%] rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {[0, 1, 2, 3].map((wave) => (
                    <motion.div
                      key={`wave-${wave}`}
                      className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(103,232,249,0.14),transparent_62%)] blur-md"
                      animate={{
                        scale: [0.82, 1.12, 1.36],
                        opacity: [0.22, 0.12, 0],
                      }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        ease: "easeOut",
                        delay: wave * 0.35,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isReasoning && (
                <motion.div
                  key="reasoning-scan"
                  className="pointer-events-none absolute inset-[12%] overflow-hidden rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.span
                    className="absolute inset-x-0 h-[18%] bg-[linear-gradient(180deg,transparent_0%,rgba(45,212,191,0.06)_30%,rgba(34,211,238,0.22)_50%,rgba(45,212,191,0.06)_70%,transparent_100%)] blur-sm"
                    animate={{ y: ["-15%", "470%"] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {ripples.map((ripple) => (
                <motion.span
                  key={ripple}
                  initial={{ opacity: 0.36, scale: 0.78 }}
                  animate={{ opacity: 0, scale: 1.16 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full border border-white/34"
                />
              ))}
            </AnimatePresence>

            <motion.div
              className="pointer-events-none absolute inset-[24%] rounded-full bg-[radial-gradient(circle,rgba(6,18,31,0.92)_0%,rgba(8,28,42,0.86)_54%,rgba(6,18,31,0.22)_100%)] shadow-[inset_0_0_22px_rgba(8,47,73,0.6)]"
              animate={reduceMotion || !orbActive ? { opacity: 0.92, scale: 1 } : { opacity: [0.88, 0.98, 0.88], scale: [1, 0.995, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative z-10 flex max-w-[13rem] flex-col items-center text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/82">Tap to speak</p>
              <h2 className="mt-3 text-[2.05rem] font-semibold leading-[1.03] text-white">
                Say anything.
                <span className="block">I'm listening.</span>
              </h2>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-cyan-50/85">
                <span>STATUS:</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={isReasoning ? thinkingText : statusText}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.45, ease: "easeInOut" }}
                    className="font-medium"
                  >
                    {isReasoning ? thinkingText : statusText}
                  </motion.span>
                </AnimatePresence>
                <motion.span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-200"
                  animate={reduceMotion ? { opacity: 0.7 } : { opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: "easeInOut" }}
            className="mt-5 flex flex-wrap items-center justify-center gap-3"
          >
            <span className={`rounded-full border px-3 py-1 text-[11px] ${strategyBadgeClass(assistantStrategy)}`}>
              Strategy: {assistantStrategy}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setLanguageMenuOpen((current) => !current)}
                className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] text-slate-100 transition hover:bg-white/10"
              >
                Language: {languageSelection.mode === "detected"
                  ? `Auto (${getLanguageName(assistantLanguage)})`
                  : getLanguageName(selectedLanguageCode)}
              </button>
              {languageMenuOpen && (
                <div
                  ref={languageMenuRef}
                  className="absolute left-0 z-50 mt-2 w-[13rem] rounded-[1rem] border border-white/10 bg-slate-950/95 p-2 shadow-[0_18px_52px_rgba(0,0,0,0.35)]"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => selectLanguage(option.code)}
                      className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                        selectedLanguageOptionCode === option.code ? "bg-cyan-500/15 text-cyan-100" : "text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          <div className="mt-8 grid w-full max-w-[600px] gap-3 sm:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1, ease: "easeInOut" }}
              className="rounded-[1rem] border border-cyan-200/30 bg-[linear-gradient(180deg,rgba(21,39,71,0.58),rgba(23,36,60,0.42))] px-3 py-2 shadow-[0_0_0_1px_rgba(125,211,252,0.16),0_0_18px_rgba(34,211,238,0.2),0_12px_24px_rgba(5,11,24,0.32)] backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/72">You</p>
                <span className="text-[10px] text-slate-300/65">{formatClock(Date.now())}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-white/86">
                {liveTranscript.user || "Your live transcript appears here..."}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16, ease: "easeInOut" }}
              className="rounded-[1rem] border border-emerald-200/28 bg-[linear-gradient(180deg,rgba(22,44,58,0.58),rgba(24,39,49,0.42))] px-3 py-2 shadow-[0_0_0_1px_rgba(74,222,128,0.14),0_0_18px_rgba(16,185,129,0.16),0_12px_24px_rgba(5,11,24,0.32)] backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/72">LifeLens</p>
                <div className="flex items-center gap-1">
                  {isThinking && (
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={`thinking-dot-${dot}`}
                          className="h-1 w-1 rounded-full bg-cyan-100/72"
                          animate={reduceMotion ? { opacity: 0.6 } : { opacity: [0.25, 0.9, 0.25], y: [0, -1, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: dot * 0.12 }}
                        />
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-slate-300/65">{formatClock(Date.now())}</span>
                </div>
              </div>
              <p className="mt-1 text-xs leading-5 text-white/86">
                {liveTranscript.assistant || (isConnecting ? "Connecting..." : isReasoning ? thinkingText : "Assistant transcript appears here...")}
              </p>
              <AnimatePresence>
                {liveTranscript.assistant && !isThinking && (
                  <FeedbackControls
                    status={voiceFeedback.status}
                    hidden={voiceFeedback.hidden}
                    onFeedback={sendVoiceFeedback}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18, ease: "easeInOut" }}
          className="w-full max-w-[1150px] grid gap-4 lg:grid-cols-[1.3fr_1fr]"
        >
          <div className="space-y-4">
            <div className="rounded-[1.3rem] border border-white/14 bg-white/[0.035] p-4 shadow-[0_16px_34px_rgba(3,7,18,0.32)] backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/64">About you</p>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-200/70">
                  {memoryItems.length > 0 ? `${memoryItems.length} memories` : "New here"}
                </span>
              </div>

              <div className="mt-4 rounded-[1.05rem] border border-white/10 bg-[linear-gradient(180deg,rgba(21,39,71,0.5),rgba(11,19,35,0.35))] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{profileSummary.title}</p>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${isNegativeEmotion(currentMood)
                      ? "border-rose-300/30 bg-rose-400/10 text-rose-100"
                      : "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"}`}
                  >
                    Your Mood (Live): {currentMood === "neutral" ? "Steady" : currentMood}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-100/84">{profileSummary.summary}</p>
                <p className="mt-3 text-xs leading-5 text-cyan-100/72">{profileSummary.prompt}</p>
              </div>

              <button
                type="button"
                onClick={() => setShowChat(true)}
                className="mt-3 w-full rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-slate-100/88 transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
              >
                Open chat and talk it through
              </button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.22, ease: "easeInOut" }}
              className="rounded-[1.3rem] border border-indigo-200/20 bg-[linear-gradient(140deg,rgba(30,41,59,0.62),rgba(23,37,84,0.42))] p-4 shadow-[0_16px_34px_rgba(3,7,18,0.32)] backdrop-blur-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-indigo-100/70">Games tab</p>
                <span className="rounded-full border border-indigo-200/20 bg-indigo-400/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-indigo-100/75">
                  Mood reset
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-white">So stressed? Try these to calm your mood.</p>
              <p className="mt-1 text-xs leading-5 text-indigo-100/75">
                One playful round can interrupt spiraling thoughts and give your mind a softer rhythm.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowGamesPortal(true)}
                  className="rounded-full border border-indigo-200/30 bg-indigo-400/20 px-4 py-2 text-sm font-medium text-indigo-50 transition hover:-translate-y-0.5 hover:bg-indigo-400/30"
                >
                  Open calming games
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSupportMode("companion");
                    setIsVisualBoost(true);
                    window.setTimeout(() => setIsVisualBoost(false), 2200);
                  }}
                  className="rounded-full border border-white/16 bg-white/8 px-4 py-2 text-sm text-white transition hover:-translate-y-0.5 hover:bg-white/12"
                >
                  Sit with me first
                </button>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22, ease: "easeInOut" }}
            className="rounded-[1.3rem] border border-cyan-200/20 bg-[linear-gradient(140deg,rgba(8,47,73,0.56),rgba(30,64,175,0.36))] p-4 shadow-[0_16px_34px_rgba(3,7,18,0.32)] backdrop-blur-md"
          >
            <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/70">Need support</p>
            <h3 className="mt-2 text-xl font-medium text-white">Choose your support lane</h3>
            <p className="mt-2 text-sm leading-6 text-cyan-50/82">
              Tiny steps create big emotional shifts. Pick one now and let this moment turn in your favor.
            </p>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("lifelens_support_pref", "companion");
                  setSupportMode("companion");
                  setShowSupportPopup(false);
                  setIsVisualBoost(true);
                  window.setTimeout(() => setIsVisualBoost(false), 2200);
                }}
                className="rounded-xl border border-amber-200/30 bg-amber-300/15 px-3 py-2 text-left text-sm font-medium text-amber-50 transition hover:-translate-y-0.5 hover:bg-amber-300/25"
              >
                Sit with me
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("lifelens_support_pref", "breathing");
                  setSupportMode("breathing");
                  setShowSupportPopup(false);
                }}
                className="rounded-xl border border-cyan-200/25 bg-cyan-400/15 px-3 py-2 text-left text-sm text-cyan-50 transition hover:-translate-y-0.5 hover:bg-cyan-400/25"
              >
                Try something calming
              </button>
              <button
                type="button"
                onClick={() => {
                  setSupportMode("anxious");
                  setShowSupportPopup(false);
                }}
                className="rounded-xl border border-rose-200/25 bg-rose-400/15 px-3 py-2 text-left text-sm text-rose-50 transition hover:-translate-y-0.5 hover:bg-rose-400/25"
              >
                Cheer me up
              </button>
              <button
                type="button"
                onClick={() => {
                  setSupportMode("calmingThoughts");
                  setShowSupportPopup(false);
                }}
                className="rounded-xl border border-violet-200/25 bg-violet-400/15 px-3 py-2 text-left text-sm text-violet-50 transition hover:-translate-y-0.5 hover:bg-violet-400/25"
              >
                Slow racing thoughts
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGamesPortal(true);
                  setSupportMode(null);
                  setShowSupportPopup(false);
                }}
                className="rounded-xl border border-indigo-200/25 bg-indigo-400/15 px-3 py-2 text-left text-sm text-indigo-50 transition hover:-translate-y-0.5 hover:bg-indigo-400/25"
              >
                Play a distraction game
              </button>
            </div>
          </motion.div>
        </motion.section>

        <div className="mt-6 w-full">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24, ease: "easeInOut" }}
            className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-3 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/58">Suggested ways to begin</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestionChips.map((chip, index) => (
                  <motion.button
                    key={chip}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.3 + index * 0.08, ease: "easeInOut" }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => triggerSuggestion(index)}
                    className="relative overflow-hidden rounded-full border border-white/12 bg-white/[0.045] px-3.5 py-1.5 text-sm text-slate-100/86 transition hover:bg-white/[0.085]"
                  >
                    <AnimatePresence>
                      {activeChipIndex === index && (
                        <motion.span
                          key={`chip-ripple-${index}`}
                          initial={{ opacity: 0.4, scale: 0.7 }}
                          animate={{ opacity: 0, scale: 1.12 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.45, ease: "easeInOut" }}
                          className="absolute inset-0 rounded-full border border-cyan-100/30"
                        />
                      )}
                    </AnimatePresence>
                    <span className="relative z-10">{chip}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <AnimatePresence>
        {continuityVisible && continuityMemory && (
          <ContinuityPrompt
            memory={continuityMemory}
            onContinue={continueFromMemory}
            onFresh={startFreshFromMemory}
            onDismiss={dismissContinuity}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!showChat && (
          <motion.button
            type="button"
            onClick={() => setShowChat(true)}
            initial={{ opacity: 0, y: 10, x: 10 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 10, x: 10 }}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="fixed bottom-6 right-6 z-30 rounded-full border border-cyan-100/20 bg-gradient-to-r from-cyan-300/90 to-sky-400/90 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_30px_rgba(34,211,238,0.35)]"
          >
            Continue in chat
          </motion.button>
        )}
      </AnimatePresence>

        <AnimatePresence>
          {(hasInteracted || showChat) && (
            <ChatDrawer
              visible={showChat}
              session={session}
              thinkingText={thinkingText}
              initialDraft={chatDraftSeed}
              autoSendInitialDraft={chatAutoSendSeed}
              resetToken={chatResetToken}
              onClose={() => setShowChat(false)}
              onDraftConsumed={() => {
                setChatDraftSeed("");
              }}
              onInitialDraftAutoSent={() => setChatAutoSendSeed(false)}
              onSupportAction={handleSupportAction}
              onIntentTrigger={processIntentTriggers}
              chat={chat}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSupportPopup && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm rounded-2xl border border-indigo-200/20 bg-indigo-900/40 p-4 shadow-2xl backdrop-blur-xl"
            >
              <p className="text-center text-sm text-indigo-50 font-medium mb-3">
                Do you want a little support right now?
              </p>
              <div className="flex flex-col gap-2">
                {supportMode === "play_game" && (
                  <button
                    onClick={() => {
                      setShowGamesPortal(true);
                      setShowSupportPopup(false);
                      setSupportMode(null);
                    }}
                    className="w-full rounded-lg bg-indigo-500/20 py-2 text-sm text-indigo-100 transition hover:bg-indigo-500/40 font-bold border border-indigo-400/30"
                  >
                    Play a Distraction Game
                  </button>
                )}
                {[
                  {
                    id: "companion",
                    label: "Sit with me",
                    action: () => {
                      localStorage.setItem("lifelens_support_pref", "companion");
                      setSupportMode("companion");
                      setShowSupportPopup(false);
                      setIsVisualBoost(true);
                      window.setTimeout(() => setIsVisualBoost(false), 2200);
                    }
                  },
                  {
                    id: "breathing",
                    label: "Try something calming",
                    action: () => {
                      localStorage.setItem("lifelens_support_pref", "breathing");
                      setSupportMode("breathing");
                      setShowSupportPopup(false);
                    }
                  }
                ]
                .sort((a, b) => {
                  const pref = localStorage.getItem("lifelens_support_pref");
                  if (pref === a.id) return -1;
                  if (pref === b.id) return 1;
                  return 0;
                })
                .map((btn) => (
                  <button
                    key={btn.id}
                    onClick={btn.action}
                    className="w-full rounded-lg bg-indigo-500/20 py-2 text-sm text-indigo-100 transition hover:bg-indigo-500/40"
                  >
                    {btn.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowSupportPopup(false)}
                  className="w-full rounded-lg py-1.5 text-xs text-indigo-200/60 transition hover:bg-white/5"
                >
                  No thanks
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {supportMode === "companion" && (
          <CompanionWidget
            strategy={supportStrategy}
            onClose={() => setSupportMode(null)}
            onOpenChat={(seedText) => {
              const normalizedSeed = String(seedText || "I need support continuing this conversation.").trim();
              setShowChat(true);
              setHasInteracted(true);
              setChatDraftSeed(normalizedSeed);
              // For Sit with me voice handoff, avoid firing chat + voice at the same time.
              // Keep the seed in chat input so user can send it manually if needed.
              setChatAutoSendSeed(false);
              void voice.continueWithPrompt(
                `The user wants to continue from chat context. Begin gently, acknowledge their emotional check-in, and invite them to speak naturally. Context: ${normalizedSeed}`,
                { submitTranscriptFallback: false },
              );
              setSupportMode(null);
            }}
            onSelectSupport={(mode) => {
              if (mode === "play_game") {
                setShowGamesPortal(true);
                setSupportMode(null);
                return;
              }
              if (mode === "breathing") {
                setSupportMode("breathing");
                return;
              }
              setSupportMode(null);
            }}
          />
        )}

        {supportMode === "anxious" && (
          <CheerUpOverlay
            onClose={() => setSupportMode(null)}
            onOpenChat={() => {
              setShowChat(true);
              setSupportMode(null);
            }}
          />
        )}

        {supportMode === "calmingThoughts" && (
          <RacingThoughtsOverlay
            onClose={() => setSupportMode(null)}
            onOpenChat={() => {
              setShowChat(true);
              setSupportMode(null);
            }}
          />
        )}

        {supportMode === "gentleRoutine" && (
          <GentleRoutineOverlay
            onClose={() => setSupportMode(null)}
            onOpenChat={() => {
              setShowChat(true);
              setSupportMode(null);
            }}
          />
        )}

        {supportMode === "breathing" && (
          <BreathingOverlay
            onClose={() => setSupportMode(null)}
            onVoicePause={() => {
               // Only pause if active
               if (voice.activity !== "idle") {
                  try {
                    voice.stop();
                  } catch (e) {}
               }
            }}
          />
        )}

        {showGamesPortal && (
          <GamesPortal onClose={() => setShowGamesPortal(false)} />
        )}

        {showCompanionPortal && (
          <CompanionPortal chat={chat} onClose={() => setShowCompanionPortal(false)} onIntentTrigger={processIntentTriggers} />
        )}

        {actionPromptConfig && (
          <ActionPromptOverlay
            {...actionPromptConfig}
          />
        )}

        <AnimatePresence>
          {showSOSModal && (
            <SOSModal
              userId={session?.user?.user_id}
              sessionToken={session?.session_token}
              onClose={() => setShowSOSModal(false)}
              onSOSTriggered={(data) => {
                // Toast notification - SOS sent successfully
                console.log("SOS alert sent successfully", data);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
