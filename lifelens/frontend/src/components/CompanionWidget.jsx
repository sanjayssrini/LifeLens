import { useState, useEffect, useMemo } from "react";
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

const QUESTION_BANK = [
  {
    id: "q-now-feel",
    question: "Right now, what feels the heaviest?",
    choices: ["My mind is racing", "I feel mentally tired", "I am overthinking one thing", "I just feel off and low"],
  },
  {
    id: "q-day-vibe",
    question: "Which one sounds most like your day?",
    choices: ["Too many notifications, no peace", "Deadline pressure is draining me", "People around me, still lonely", "Everything looks okay, still heavy inside"],
  },
  {
    id: "q-relief",
    question: "Choose a tiny relief for the next 2 minutes:",
    choices: ["A grounding breath", "A kind reminder", "A quick laugh break", "A small game reset"],
  },
  {
    id: "q-energy",
    question: "What is your energy level right now?",
    choices: ["Almost empty", "Low but manageable", "Wavy and unstable", "Surprisingly okay"],
  },
  {
    id: "q-body",
    question: "Where do you feel stress in your body first?",
    choices: ["Chest", "Shoulders/neck", "Head", "Stomach"],
  },
  {
    id: "q-thought-loop",
    question: "What kind of thought loop is running?",
    choices: ["What if everything goes wrong", "I am not doing enough", "I cannot switch off", "I keep replaying one moment"],
  },
  {
    id: "q-social",
    question: "How connected do you feel to people today?",
    choices: ["Very disconnected", "A little distant", "Neutral", "Supported"],
  },
  {
    id: "q-pressure",
    question: "What pressure is loudest right now?",
    choices: ["Work/study pressure", "Family expectations", "Money worries", "Pressure from myself"],
  },
  {
    id: "q-sleep",
    question: "How has sleep been lately?",
    choices: ["Restless", "Not enough", "Okay-ish", "Good"],
  },
  {
    id: "q-self-talk",
    question: "Your inner voice lately feels like...",
    choices: ["Too critical", "Worried all the time", "Numb and blank", "Gentler than before"],
  },
  {
    id: "q-overwhelm",
    question: "When overwhelm hits, you usually...",
    choices: ["Shut down", "Overwork", "Scroll endlessly", "Reach out"],
  },
  {
    id: "q-win",
    question: "Pick one quiet win from today:",
    choices: ["I showed up", "I asked for help", "I took a pause", "I did not give up"],
  },
  {
    id: "q-need",
    question: "What do you need most right now?",
    choices: ["Calm", "Clarity", "Comfort", "Courage"],
  },
  {
    id: "q-trigger",
    question: "What triggered this mood shift today?",
    choices: ["One conversation", "A task pile-up", "Unexpected news", "It built up slowly"],
  },
  {
    id: "q-focus",
    question: "How focused can your mind be right now?",
    choices: ["Very scattered", "On and off", "Mostly focused", "Sharp"],
  },
  {
    id: "q-breath",
    question: "How does your breathing feel at this moment?",
    choices: ["Shallow", "Fast", "Tight", "Steady"],
  },
  {
    id: "q-gentle",
    question: "What would be the gentlest next step?",
    choices: ["One deep breath", "Drink water", "Text someone safe", "Step away for a minute"],
  },
  {
    id: "q-load",
    question: "If your mind had a load bar, it is at...",
    choices: ["95%", "80%", "60%", "40%"],
  },
  {
    id: "q-hope",
    question: "What feels possible in the next 10 minutes?",
    choices: ["I can settle a little", "I can finish one tiny thing", "I can ask for support", "I can rest my mind"],
  },
  {
    id: "q-kindness",
    question: "What would a kinder self-talk line be right now?",
    choices: ["I am doing my best", "This moment will pass", "I do not need to fix everything now", "One step is enough"],
  },
  {
    id: "q-reset-style",
    question: "What reset style helps you most today?",
    choices: ["Breathing", "Talking it out", "A playful distraction", "Quiet grounding"],
  },
];

const SESSION_QUESTION_COUNT = 3;

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

const SMILE_GIFTS = [
  {
    title: "Mini Smile Mission",
    line: "Soften your face, drop your shoulders, and whisper: I am safe in this minute.",
    wink: "Your nervous system heard that. It likes you already.",
  },
  {
    title: "Pocket Brightener",
    line: "Send one silly emoji to someone you trust, no explanation needed.",
    wink: "Yes, emotional recovery can begin with one random emoji.",
  },
  {
    title: "Kindness Cheat Code",
    line: "Place your hand on your heart and say: I am trying, and that is enough for today.",
    wink: "That is not cheesy. That is emotional strength.",
  },
  {
    title: "Tiny Plot Twist",
    line: "Name one thing that went less wrong than expected today.",
    wink: "See? Your day had at least one kind corner.",
  },
];

export default function CompanionWidget({ strategy = "companion", onClose, onOpenChat, onSelectSupport }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [phase, setPhase] = useState("warmup");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showSmileGift, setShowSmileGift] = useState(false);
  
  const messages = COMPANION_MESSAGES[strategy] || COMPANION_MESSAGES["companion"];
  const intervalTime = strategy === "calm" ? 6000 : 4000;
  const checkinQuestions = useMemo(
    () => shuffleArray(QUESTION_BANK).slice(0, SESSION_QUESTION_COUNT),
    [],
  );
  const currentQuestion = checkinQuestions[questionIndex];

  const closingLine = useMemo(() => {
    const first = answers[0] ? `You chose "${answers[0]}".` : "You checked in with yourself.";
    const second = answers[1] ? `You also noticed "${answers[1]}".` : "That awareness matters.";
    return `${first} ${second} You are doing better than you think.`;
  }, [answers]);

  const smileGift = useMemo(() => {
    const key = answers.join("").length;
    return SMILE_GIFTS[key % SMILE_GIFTS.length];
  }, [answers]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, intervalTime);
    return () => clearInterval(timer);
  }, [messages.length, intervalTime]);

  useEffect(() => {
    const warmupTimer = window.setTimeout(() => {
      setPhase("checkin");
    }, 2200);

    return () => window.clearTimeout(warmupTimer);
  }, []);

  const handleChoice = (choice) => {
    setAnswers((current) => [...current, choice]);
    if (questionIndex < checkinQuestions.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }
    setPhase("afterglow");
  };

  const openChatWithPrompt = () => {
    const summary = answers.length > 0 ? answers.join(" | ") : "I need some support right now";
    onOpenChat?.(`I used Sit with me. My check-in choices: ${summary}. Can we continue from here?`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0.5, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(251,191,36,0.18),transparent_36%),radial-gradient(circle_at_16%_86%,rgba(244,114,182,0.16),transparent_34%),radial-gradient(circle_at_88%_74%,rgba(125,211,252,0.18),transparent_32%),linear-gradient(135deg,rgba(120,53,15,0.72)_0%,rgba(136,19,55,0.62)_46%,rgba(15,23,42,0.9)_100%)]"
      />

      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.22, 0.44, 0.22] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 14px)",
        }}
      />

      <motion.div
        initial={{ x: "-110%", opacity: 0.6 }}
        animate={{ x: ["-110%", "120%"], opacity: [0.2, 0.62, 0.2] }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-y-0 w-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)] blur-2xl"
      />

      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 transition hover:bg-white/15"
      >
        Close
      </button>

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 w-[min(94vw,44rem)] rounded-[1.7rem] border border-white/20 bg-black/25 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-7"
      >
        <p className="text-[11px] uppercase tracking-[0.3em] text-amber-100/75">Sit with me</p>
        <h2 className="mt-2 text-3xl font-semibold text-white sm:text-[2rem]">I am here for you.</h2>
        <p className="mt-2 text-sm leading-6 text-amber-50/85">
          You matter in this moment. Let us take one gentle minute together and help your mind feel lighter.
        </p>

        <div className="mt-5 rounded-2xl border border-white/14 bg-white/10 p-4">
          <AnimatePresence mode="wait">
            {phase === "warmup" && (
              <motion.div
                key="warmup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                <p className="text-lg font-medium text-white">Take one slow breath with me...</p>
                <motion.p
                  key={messageIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-sm text-amber-50/90"
                >
                  {messages[messageIndex]}
                </motion.p>
                <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-300 to-rose-300"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2.1, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            )}

            {phase === "checkin" && (
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <p className="text-sm text-white/70">Question {questionIndex + 1} of {checkinQuestions.length}</p>
                <p className="mt-1 text-lg font-medium text-white">{currentQuestion.question}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {currentQuestion.choices.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => handleChoice(choice)}
                      className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-left text-sm text-white transition hover:-translate-y-0.5 hover:bg-white/20"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {phase === "afterglow" && (
              <motion.div
                key="afterglow"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <p className="text-lg font-medium text-white">That was beautiful. You checked in with yourself.</p>
                <p className="text-sm leading-6 text-amber-50/90">{closingLine}</p>

                <div className="rounded-xl border border-amber-200/25 bg-amber-100/10 p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-100/75">Smile gift</p>
                  <p className="mt-1 text-sm font-medium text-white">{smileGift.title}</p>
                  <p className="mt-1 text-sm text-amber-50/90">{smileGift.line}</p>
                  <button
                    type="button"
                    onClick={() => setShowSmileGift((current) => !current)}
                    className="mt-2 rounded-full border border-amber-200/30 bg-amber-300/15 px-3 py-1 text-xs text-amber-50 transition hover:bg-amber-300/25"
                  >
                    {showSmileGift ? "Hide smile boost" : "Reveal a tiny smile boost"}
                  </button>
                  <AnimatePresence>
                    {showSmileGift && (
                      <motion.p
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="mt-2 text-sm text-amber-100/90"
                      >
                        {smileGift.wink}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={openChatWithPrompt}
                    className="rounded-xl border border-amber-200/35 bg-amber-300/20 px-3 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-300/30"
                  >
                    Keep talking with me
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectSupport?.("breathing")}
                    className="rounded-xl border border-cyan-200/30 bg-cyan-400/20 px-3 py-2 text-sm text-cyan-50 transition hover:bg-cyan-400/30"
                  >
                    Do a calm breathing reset
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectSupport?.("play_game")}
                    className="rounded-xl border border-indigo-200/30 bg-indigo-400/20 px-3 py-2 text-sm text-indigo-50 transition hover:bg-indigo-400/30"
                  >
                    Light game break
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15"
                  >
                    Stay with this feeling
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
          className="mx-auto mt-5 h-12 w-12 rounded-full bg-amber-300/40 blur-md"
        />
        <div className="mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-gradient-to-br from-amber-300/60 to-rose-300/60 text-white shadow-lg">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      </motion.div>
    </motion.div>
  );
}
