import { motion, useScroll, useTransform } from "framer-motion";

const howSteps = [
  {
    title: "Speak Naturally",
    text: "Talk in your own words. LifeLens listens for context, urgency, and intent in real time."
  },
  {
    title: "Predictive Understanding",
    text: "The system maps your situation to likely needs and retrieves your prior context from memory."
  },
  {
    title: "Actionable Guidance",
    text: "Get practical next steps for health, work, and financial decisions with emotional support."
  }
];

const useCases = [
  {
    title: "Health Help",
    text: "From symptoms to care navigation, LifeLens helps you decide what to do next with confidence."
  },
  {
    title: "Job Loss",
    text: "When work is uncertain, LifeLens can recall your goals and guide you to support and opportunity."
  },
  {
    title: "Financial Support",
    text: "Understand urgent options, aid pathways, and realistic short-term decisions under pressure."
  }
];

const testimonials = [
  {
    quote: "It felt like talking to someone who truly remembered me and what I was going through.",
    author: "Priya, Bengaluru"
  },
  {
    quote: "I came in overwhelmed. I left with a clear plan and calm mind in under 10 minutes.",
    author: "Aman, Mumbai"
  },
  {
    quote: "LifeLens gave me practical help without judgment. That made all the difference.",
    author: "Riya, Delhi"
  }
];

function BreathingOrb() {
  return (
    <div className="relative mx-auto h-52 w-52 sm:h-64 sm:w-64">
      <motion.div
        className="absolute inset-0 rounded-full bg-cyan-400/20 blur-3xl"
        animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-5 rounded-full bg-gradient-to-br from-cyan-300/20 via-sky-400/20 to-blue-500/25 blur-2xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative z-10 flex h-full w-full items-center justify-center rounded-full border border-white/30 bg-white/[0.06] backdrop-blur-xl shadow-[0_0_80px_rgba(34,211,238,0.35)]"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-sm uppercase tracking-[0.34em] text-cyan-100/90">Voice AI</span>
      </motion.div>
    </div>
  );
}

function SectionCard({ title, text, delay = 0 }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-3xl border border-white/15 bg-white/[0.05] p-6 backdrop-blur-xl shadow-[0_18px_60px_rgba(2,8,23,0.28)]"
    >
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{text}</p>
    </motion.article>
  );
}

export default function LandingPage({ onStartTalking }) {
  const { scrollYProgress } = useScroll();
  const orbParallax = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <div className="relative overflow-hidden pb-20">
      <div className="pointer-events-none absolute inset-0 opacity-[0.25]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.12),transparent_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:26px_26px]" />
      </div>

      <section className="relative mx-auto flex min-h-[90vh] w-full max-w-6xl flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-1 text-xs uppercase tracking-[0.24em] text-cyan-100"
        >
          Predictive Voice AI for Real-World Decision Making
        </motion.div>

        <motion.div style={{ y: orbParallax }} className="mt-10 w-full">
          <BreathingOrb />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mt-12 max-w-4xl text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl"
        >
          LifeLens understands your life, not just your words
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="mt-6 max-w-2xl text-lg text-slate-300"
        >
          Speak naturally. Get real-world help instantly.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <button
            type="button"
            onClick={onStartTalking}
            className="rounded-full border border-cyan-200/30 bg-gradient-to-r from-cyan-400 to-blue-500 px-7 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_40px_rgba(14,165,233,0.45)] transition hover:scale-[1.02]"
          >
            Start Talking
          </button>
          <a
            href="#how"
            className="rounded-full border border-white/20 bg-white/[0.06] px-7 py-3 text-sm font-semibold text-slate-100 backdrop-blur-xl transition hover:bg-white/[0.12]"
          >
            Learn More
          </a>
        </motion.div>
      </section>

      <section id="how" className="relative mx-auto mt-8 w-full max-w-6xl px-6">
        <h2 className="text-center text-3xl font-semibold text-white">How It Works</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {howSteps.map((step, idx) => (
            <SectionCard key={step.title} title={`${idx + 1}. ${step.title}`} text={step.text} delay={idx * 0.08} />
          ))}
        </div>
      </section>

      <section className="relative mx-auto mt-20 w-full max-w-6xl px-6">
        <h2 className="text-center text-3xl font-semibold text-white">Real-Life Use Cases</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {useCases.map((item, idx) => (
            <SectionCard key={item.title} title={item.title} text={item.text} delay={idx * 0.08} />
          ))}
        </div>
      </section>

      <section className="relative mx-auto mt-20 w-full max-w-6xl px-6">
        <h2 className="text-center text-3xl font-semibold text-white">What Users Say</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {testimonials.map((item, idx) => (
            <SectionCard key={item.author} title={item.author} text={`“${item.quote}”`} delay={idx * 0.08} />
          ))}
        </div>
      </section>

      <section className="relative mx-auto mt-20 w-full max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          className="rounded-3xl border border-cyan-200/20 bg-gradient-to-r from-cyan-400/15 via-sky-500/10 to-blue-500/15 p-10 text-center backdrop-blur-xl"
        >
          <h3 className="text-3xl font-semibold text-white">Ready to be heard?</h3>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            LifeLens combines real-time voice understanding with persistent memory, so support gets better every time you speak.
          </p>
          <button
            type="button"
            onClick={onStartTalking}
            className="mt-8 rounded-full border border-cyan-200/30 bg-gradient-to-r from-cyan-400 to-blue-500 px-7 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_40px_rgba(14,165,233,0.45)] transition hover:scale-[1.02]"
          >
            Start Talking
          </button>
        </motion.div>
      </section>
    </div>
  );
}
