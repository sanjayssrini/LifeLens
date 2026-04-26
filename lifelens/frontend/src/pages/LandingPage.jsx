import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const labels = ["Problem", "Understanding", "Thinking", "Memory", "Action", "Resolution"];
const vfxOrbs = [
  { className: "left-[6%] top-[10%] h-80 w-80 bg-cyan-300/20", x: [0, 18, 0], y: [0, -14, 0], scale: [1, 1.08, 1], duration: 18, delay: 0 },
  { className: "right-[8%] top-[14%] h-[26rem] w-[26rem] bg-sky-400/18", x: [0, -22, 0], y: [0, 18, 0], scale: [1, 1.06, 1], duration: 24, delay: 0.7 },
  { className: "left-1/2 top-[42%] h-[38rem] w-[38rem] -translate-x-1/2 bg-teal-300/10", x: [0, 0], y: [0, -12, 0], scale: [1, 1.04, 1], duration: 28, delay: 1.2 },
];

const thoughtOrbits = [
  { size: 152, duration: 12, delay: 0 },
  { size: 210, duration: 16, delay: 0.8 },
  { size: 268, duration: 20, delay: 1.5 },
];

const thinkingPillarsLeft = ["Stability", "Support"];
const thinkingPillarsRight = ["Work", "Next step"];

const thoughtNodes = [
  { id: "stability", x: 74, y: 124 },
  { id: "work", x: 346, y: 124 },
  { id: "support", x: 98, y: 302 },
  { id: "next-step", x: 322, y: 302 },
];

const lifeParticles = Array.from({ length: 6 }).map((_, index) => ({
  id: `life-particle-${index}`,
  size: 3 + (index % 3),
  left: `${8 + ((index * 11) % 84)}%`,
  top: `${10 + ((index * 17) % 76)}%`,
  x: [0, index % 2 === 0 ? 18 : -14, 0],
  y: [0, -10 - (index % 4) * 4, 0],
  delay: index * 0.18,
  duration: 14 + (index % 5) * 2,
}));

const pulseRings = [
  { className: "h-[26rem] w-[26rem] border-cyan-100/20", duration: 18, delay: 0 },
  { className: "h-[34rem] w-[34rem] border-sky-200/14", duration: 24, delay: 0.8 },
];

function Stage({ opacity, children }) {
  return (
    <motion.div style={{ opacity }} className="pointer-events-none absolute inset-0 flex items-center justify-center px-5 sm:px-8">
      {children}
    </motion.div>
  );
}

export default function LandingPage({ onStartTalking }) {
  const containerRef = useRef(null);
  const [isLowPowerDevice, setIsLowPowerDevice] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    const cpuCores = Number(navigator.hardwareConcurrency || 8);
    const memoryGb = Number(navigator.deviceMemory || 8);
    const saveData = Boolean(navigator.connection?.saveData);

    if (saveData || cpuCores <= 10 || memoryGb <= 8) {
      setIsLowPowerDevice(true);
    }
  }, []);

  const allowLoopMotion = false;
  const renderedPulseRings = useMemo(
    () => (isLowPowerDevice ? pulseRings.slice(0, 1) : pulseRings),
    [isLowPowerDevice],
  );
  const renderedOrbs = useMemo(
    () => (isLowPowerDevice ? vfxOrbs.slice(0, 1) : vfxOrbs.slice(0, 2)),
    [isLowPowerDevice],
  );
  const renderedLifeParticles = useMemo(
    () => (isLowPowerDevice ? lifeParticles.slice(0, 3) : lifeParticles),
    [isLowPowerDevice],
  );

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const p = scrollYProgress;

  const bgFarY = useTransform(p, [0, 1], [0, -90]);
  const bgMidY = useTransform(p, [0, 1], [0, -150]);
  const bgNearY = useTransform(p, [0, 1], [0, -220]);
  const bgFarScale = useTransform(p, [0, 1], [1, 1.04]);
  const bgMidScale = useTransform(p, [0, 1], [1, 1.07]);
  const bgNearScale = useTransform(p, [0, 1], [1, 1.1]);

  const railFill = useTransform(p, [0, 1], ["0%", "100%"]);

  const s1 = useTransform(p, [0.0, 0.08, 0.18, 0.26], [1, 1, 0.25, 0]);
  const s2 = useTransform(p, [0.2, 0.26, 0.36, 0.42], [0, 1, 1, 0]);
  const s3 = useTransform(p, [0.36, 0.44, 0.58, 0.64], [0, 1, 1, 0]);
  const s4 = useTransform(p, [0.58, 0.64, 0.74, 0.8], [0, 1, 1, 0]);
  const s5 = useTransform(p, [0.76, 0.83, 0.92, 0.97], [0, 1, 1, 0]);
  const s6 = useTransform(p, [0.93, 0.98, 1], [0, 1, 1]);

  const l1 = useTransform(s1, [0, 1], [0.45, 1]);
  const l2 = useTransform(s2, [0, 1], [0.45, 1]);
  const l3 = useTransform(s3, [0, 1], [0.45, 1]);
  const l4 = useTransform(s4, [0, 1], [0.45, 1]);
  const l5 = useTransform(s5, [0, 1], [0.45, 1]);
  const l6 = useTransform(s6, [0, 1], [0.45, 1]);

  const timelineReveal = useTransform(p, [0, 1], [0.08, 1]);

  const arrowFade = useTransform(p, [0.0, 0.14, 0.24], [0.7, 1, 0]);

  const typed = useTransform(p, [0.22, 0.34], ["0ch", "31ch"]);
  const inputScale = useTransform(p, [0.2, 0.42], [0.98, 1.02]);
  const inputY = useTransform(p, [0.2, 0.42], [32, -20]);

  const thinkingY = useTransform(p, [0.4, 0.64], [10, 86]);
  const mA = useTransform(p, [0.6, 0.67, 0.74], [0, 1, 0.55]);
  const mB = useTransform(p, [0.64, 0.71, 0.78], [0, 1, 0.55]);
  const mC = useTransform(p, [0.68, 0.76], [0, 1]);

  const cardsY = useTransform(p, [0.79, 0.92], [28, 0]);
  const c1 = useTransform(p, [0.8, 0.86], [0, 1]);
  const c2 = useTransform(p, [0.84, 0.9], [0, 1]);
  const c3 = useTransform(p, [0.88, 0.94], [0, 1]);

  const endScale = useTransform(p, [0.94, 1], [0.97, 1]);

  return (
    <div
      ref={containerRef}
      style={{ height: isLowPowerDevice ? "340vh" : "460vh" }}
      className="relative overflow-x-clip bg-[#030712] text-white"
    >
      <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
        <motion.div
          style={{ y: bgFarY, scale: bgFarScale }}
          className="absolute inset-[-22%] will-change-transform bg-[radial-gradient(140%_90%_at_14%_8%,rgba(45,212,191,0.28),transparent_44%),radial-gradient(120%_110%_at_82%_22%,rgba(56,189,248,0.2),transparent_48%)]"
        />
        <motion.div
          style={{ y: bgMidY, scale: bgMidScale }}
          className="absolute inset-[-18%] will-change-transform bg-[radial-gradient(72%_72%_at_50%_24%,rgba(103,232,249,0.2),transparent_55%)]"
        />
        <motion.div
          aria-hidden="true"
          className="absolute left-1/2 top-[35%] h-[52rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(94,234,212,0.2)_0%,rgba(34,211,238,0.14)_18%,rgba(8,145,178,0.08)_34%,transparent_70%)] blur-2xl"
          animate={allowLoopMotion ? { scale: [1, 1.04, 1], opacity: [0.72, 1, 0.72] } : undefined}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute left-1/2 top-[35%] h-[52rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/10 [mask-image:radial-gradient(circle,black_48%,transparent_72%)]" />
        {renderedPulseRings.map((ring) => (
          <motion.div
            key={ring.className}
            aria-hidden="true"
            className={`absolute left-1/2 top-[35%] -translate-x-1/2 -translate-y-1/2 rounded-full border ${ring.className}`}
            animate={allowLoopMotion ? { scale: [0.92, 1.06, 0.92], opacity: [0.12, 0.32, 0.12], rotate: [0, 8, 0] } : undefined}
            transition={{ duration: ring.duration, delay: ring.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <motion.div
          aria-hidden="true"
          className="absolute left-1/2 top-[34%] h-[1px] w-[72vw] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.7),rgba(45,212,191,0.9),rgba(125,211,252,0.7),transparent)] opacity-55 blur-[0.5px]"
          animate={allowLoopMotion ? { opacity: [0.34, 0.72, 0.34], scaleX: [0.92, 1, 0.92] } : undefined}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35 mix-blend-soft-light"
          animate={allowLoopMotion ? { opacity: [0.18, 0.32, 0.18] } : undefined}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(3,7,18,0.2)_58%,rgba(3,7,18,0.82)_100%)]" />
        {renderedOrbs.map((orb) => (
          <motion.div
            key={orb.className}
            aria-hidden="true"
            className={`absolute rounded-full blur-3xl ${orb.className}`}
            animate={allowLoopMotion ? { x: orb.x, y: orb.y, scale: orb.scale, opacity: [0.45, 0.82, 0.45] } : undefined}
            transition={{ duration: orb.duration, delay: orb.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        {renderedLifeParticles.map((particle) => (
          <motion.span
            key={particle.id}
            aria-hidden="true"
            className="absolute rounded-full bg-cyan-100/40 shadow-[0_0_18px_rgba(103,232,249,0.35)]"
            style={{ width: `${particle.size}px`, height: `${particle.size}px`, left: particle.left, top: particle.top }}
            animate={allowLoopMotion ? { x: particle.x, y: particle.y, opacity: [0.18, 0.85, 0.18], scale: [1, 1.55, 1] } : undefined}
            transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <motion.div
          aria-hidden="true"
          className="absolute inset-[-10%] bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(45,212,191,0.1),transparent_26%)]"
          animate={allowLoopMotion ? { rotate: [0, 3, 0], scale: [1, 1.02, 1], x: [0, 8, 0] } : undefined}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_70%,rgba(52,211,153,0.08),transparent_22%),radial-gradient(circle_at_80%_72%,rgba(125,211,252,0.08),transparent_22%)] opacity-80"
          animate={allowLoopMotion ? { opacity: [0.45, 0.72, 0.45], scale: [1, 1.03, 1] } : undefined}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          style={{ y: bgNearY, scale: bgNearScale }}
          className="absolute inset-[-14%] will-change-transform bg-[linear-gradient(180deg,rgba(3,7,18,0.38),rgba(3,7,18,0.88)_68%)]"
        />
      </div>

      <div className="fixed right-4 top-4 z-20 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={onStartTalking}
          className="rounded-full border border-cyan-100/40 bg-slate-900/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-slate-800/90"
        >
          Login
        </button>
      </div>

      <section className="sticky top-0 h-screen overflow-hidden">
        <div className="relative mx-auto h-full w-full max-w-7xl">
          {!isLowPowerDevice && (
            <div className="pointer-events-none absolute inset-0 z-[1] hidden 2xl:block">
            <svg viewBox="0 0 1200 800" className="h-full w-full opacity-70">
              <defs>
                <linearGradient id="timelineTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(125,211,252,0.22)" />
                  <stop offset="60%" stopColor="rgba(45,212,191,0.24)" />
                  <stop offset="100%" stopColor="rgba(186,230,253,0.2)" />
                </linearGradient>
                <linearGradient id="timelineFlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(224,242,254,0.95)" />
                  <stop offset="55%" stopColor="rgba(45,212,191,0.95)" />
                  <stop offset="100%" stopColor="rgba(125,211,252,0.9)" />
                </linearGradient>
                <filter id="timelineGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <motion.path
                d="M 24 24 C 188 62 312 132 426 232 C 544 338 672 446 826 574 C 946 674 1048 736 1170 770"
                fill="none"
                stroke="url(#timelineTrack)"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ pathLength: timelineReveal }}
              />
              <motion.path
                d="M 24 24 C 188 62 312 132 426 232 C 544 338 672 446 826 574 C 946 674 1048 736 1170 770"
                fill="none"
                stroke="url(#timelineFlow)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeDasharray="3 13"
                style={{ pathLength: timelineReveal }}
                animate={allowLoopMotion ? { strokeDashoffset: [0, -180] } : undefined}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                filter="url(#timelineGlow)"
              />

              <motion.path
                d="M 426 232 C 356 286 282 354 216 444"
                fill="none"
                stroke="rgba(125,211,252,0.24)"
                strokeWidth="1.5"
                strokeDasharray="2 10"
                style={{ pathLength: timelineReveal }}
                animate={allowLoopMotion ? { strokeDashoffset: [0, -90] } : undefined}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
              <motion.path
                d="M 826 574 C 892 516 962 444 1038 352"
                fill="none"
                stroke="rgba(94,234,212,0.24)"
                strokeWidth="1.5"
                strokeDasharray="2 10"
                style={{ pathLength: timelineReveal }}
                animate={allowLoopMotion ? { strokeDashoffset: [0, -90] } : undefined}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
              <motion.path
                d="M 640 430 C 588 512 534 590 466 670"
                fill="none"
                stroke="rgba(186,230,253,0.22)"
                strokeWidth="1.4"
                strokeDasharray="2 10"
                style={{ pathLength: timelineReveal }}
                animate={allowLoopMotion ? { strokeDashoffset: [0, -86] } : undefined}
                transition={{ duration: 11.4, repeat: Infinity, ease: "linear" }}
              />

              {[{ x: 24, y: 24 }, { x: 426, y: 232 }, { x: 826, y: 574 }, { x: 1170, y: 770 }, { x: 216, y: 444 }, { x: 1038, y: 352 }, { x: 466, y: 670 }].map((node) => (
                <g key={`${node.x}-${node.y}`}>
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r="5.5"
                    fill="rgba(56,189,248,0.9)"
                    animate={allowLoopMotion ? { r: [5.5, 8, 5.5], opacity: [0.55, 1, 0.55] } : undefined}
                    transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <circle cx={node.x} cy={node.y} r="12" fill="none" stroke="rgba(125,211,252,0.2)" strokeWidth="1" />
                </g>
              ))}

              <motion.circle
                r="4"
                fill="rgba(224,242,254,0.95)"
                filter="url(#timelineGlow)"
                animate={allowLoopMotion ? { cx: [24, 196, 426, 640, 826, 1020, 1170], cy: [24, 88, 232, 430, 574, 706, 770], opacity: [0.1, 1, 0.1] } : undefined}
                transition={{ duration: 8.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.circle
                r="3"
                fill="rgba(45,212,191,0.95)"
                filter="url(#timelineGlow)"
                animate={allowLoopMotion ? { cx: [1170, 1020, 826, 640, 426, 196, 24], cy: [770, 706, 574, 430, 232, 88, 24], opacity: [0.1, 1, 0.1] } : undefined}
                transition={{ duration: 9.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>
            </div>
          )}

          <div className="pointer-events-none absolute left-4 top-1/2 hidden -translate-y-1/2 lg:block">
            <div className="relative h-[62vh] w-[3px] rounded-full bg-white/10">
              <motion.div style={{ height: railFill }} className="absolute left-0 top-0 w-full origin-top rounded-full bg-gradient-to-b from-cyan-300 via-blue-300 to-sky-300" />
            </div>
            <div className="mt-5 space-y-2.5 text-[10px] uppercase tracking-[0.24em]">
              <motion.div style={{ opacity: l1 }} className="text-cyan-100">{labels[0]}</motion.div>
              <motion.div style={{ opacity: l2 }} className="text-cyan-100">{labels[1]}</motion.div>
              <motion.div style={{ opacity: l3 }} className="text-cyan-100">{labels[2]}</motion.div>
              <motion.div style={{ opacity: l4 }} className="text-cyan-100">{labels[3]}</motion.div>
              <motion.div style={{ opacity: l5 }} className="text-cyan-100">{labels[4]}</motion.div>
              <motion.div style={{ opacity: l6 }} className="text-cyan-100">{labels[5]}</motion.div>
            </div>
          </div>

          <Stage opacity={s1}>
            <div className="text-center">
              <h1 className="mx-auto max-w-5xl text-balance text-4xl font-semibold leading-tight sm:text-6xl md:text-7xl">
                Life is not a single question.
              </h1>
              <p className="mt-6 text-lg text-cyan-100/90 sm:text-2xl">Problems come layered.</p>
              <motion.div
                style={{ opacity: arrowFade }}
                className="mt-9 flex flex-col items-center text-cyan-100/80"
                animate={allowLoopMotion ? { y: [0, 5, 0] } : undefined}
                transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="text-[11px] uppercase tracking-[0.24em]">Scroll</span>
                <span className="text-3xl leading-none">↓</span>
              </motion.div>
            </div>
          </Stage>

          <Stage opacity={s2}>
            <motion.div
              style={{ scale: inputScale, y: inputY }}
              className="w-full max-w-3xl rounded-3xl border border-cyan-100/30 bg-white/[0.07] p-6 will-change-transform sm:p-8"
            >
              <p className="mb-4 text-xs uppercase tracking-[0.24em] text-cyan-100/75">Understanding layer</p>
              <div className="flex items-center gap-1.5 text-2xl sm:text-4xl">
                <motion.span style={{ width: typed }} className="inline-block overflow-hidden whitespace-nowrap text-white">
                  I lost my job and I feel trapped.
                </motion.span>
                <motion.span
                  className="inline-block h-8 w-[2px] bg-cyan-200 sm:h-10"
                  animate={allowLoopMotion ? { opacity: [1, 0, 1] } : undefined}
                  transition={{ duration: 0.9, repeat: Infinity }}
                />
              </div>
            </motion.div>
          </Stage>

          <Stage opacity={s3}>
            <motion.div style={{ y: thinkingY }} className="relative h-[72vh] w-full max-w-6xl">
              <motion.div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 z-0 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.2)_0%,rgba(56,189,248,0.14)_28%,transparent_70%)] blur-2xl"
                animate={allowLoopMotion ? { scale: [1, 1.06, 1], opacity: [0.68, 1, 0.68] } : undefined}
                transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="relative z-10 flex h-full w-full flex-col justify-center">
                <motion.div
                  className="mx-auto w-[min(92vw,44rem)] rounded-[2rem] border border-cyan-100/20 bg-white/[0.06] px-6 py-5 text-center shadow-[0_30px_90px_rgba(4,12,24,0.45)] backdrop-blur-2xl"
                  animate={allowLoopMotion ? { y: [0, -5, 0] } : undefined}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/70">Thinking layer</p>
                  <p className="mt-3 text-balance text-2xl text-cyan-50 sm:text-4xl">
                    One line becomes a map. The map becomes momentum.
                  </p>
                </motion.div>

                <div className="mt-8 grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_420px_minmax(0,1fr)]">
                  <div className="hidden space-y-4 md:block">
                    {thinkingPillarsLeft.map((pillar, index) => (
                      <motion.div
                        key={pillar}
                        className="ml-auto w-fit rounded-full border border-cyan-100/25 bg-slate-950/55 px-4 py-2 text-sm text-cyan-50 shadow-[0_18px_40px_rgba(8,15,30,0.35)] backdrop-blur-xl"
                        animate={allowLoopMotion ? { x: [0, -4, 0], opacity: [0.72, 1, 0.72] } : undefined}
                        transition={{ duration: 5.4 + index, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {pillar}
                      </motion.div>
                    ))}
                  </div>

                  <div className="relative mx-auto h-[22rem] w-full max-w-[26rem]">
                    {thoughtOrbits.map((orbit, index) => (
                      <motion.div
                        key={`${orbit.size}`}
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 rounded-full border border-cyan-100/16"
                        style={{ width: orbit.size, height: orbit.size, marginLeft: -orbit.size / 2, marginTop: -orbit.size / 2 }}
                        animate={allowLoopMotion ? { rotate: [0, 10, 0], opacity: [0.16, 0.32, 0.16], scale: [0.96, 1.03, 0.96] } : undefined}
                        transition={{ duration: orbit.duration, delay: orbit.delay, repeat: Infinity, ease: "easeInOut" }}
                      />
                    ))}

                    <svg aria-hidden="true" viewBox="0 0 420 352" className="absolute inset-0 h-full w-full overflow-visible">
                      <motion.circle
                        cx="210"
                        cy="176"
                        r="52"
                        fill="rgba(45,212,191,0.12)"
                        stroke="rgba(165,243,252,0.3)"
                        strokeWidth="1.4"
                        animate={allowLoopMotion ? { r: [48, 56, 48], opacity: [0.55, 0.95, 0.55] } : undefined}
                        transition={{ duration: 7.6, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <motion.circle
                        cx="210"
                        cy="176"
                        r="12"
                        fill="rgba(165,243,252,0.95)"
                        animate={allowLoopMotion ? { opacity: [0.82, 1, 0.82], scale: [1, 1.12, 1] } : undefined}
                        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                      {thoughtNodes.map((node) => (
                        <g key={node.id}>
                          <motion.line
                            x1="210"
                            y1="176"
                            x2={node.x}
                            y2={node.y}
                            stroke="rgba(125,211,252,0.56)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray="10 12"
                            animate={allowLoopMotion ? { strokeDashoffset: [0, -40] } : undefined}
                            transition={{ duration: 4.8 + node.x / 160, repeat: Infinity, ease: "linear" }}
                          />
                          <motion.circle
                            cx={node.x}
                            cy={node.y}
                            r="8"
                            fill="rgba(8,145,178,0.9)"
                            stroke="rgba(224,242,254,0.6)"
                            strokeWidth="1.2"
                            animate={allowLoopMotion ? { r: [7, 10, 7], opacity: [0.82, 1, 0.82] } : undefined}
                            transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
                          />
                          <motion.circle
                            r="3"
                            fill="rgba(224,242,254,0.95)"
                            animate={allowLoopMotion ? { cx: [210, node.x, 210], cy: [176, node.y, 176], opacity: [0, 1, 0] } : undefined}
                            transition={{ duration: 3.8 + node.x / 180, repeat: Infinity, ease: "easeInOut" }}
                          />
                        </g>
                      ))}
                    </svg>
                  </div>

                  <div className="hidden space-y-4 md:block">
                    {thinkingPillarsRight.map((pillar, index) => (
                      <motion.div
                        key={pillar}
                        className="w-fit rounded-full border border-cyan-100/25 bg-slate-950/55 px-4 py-2 text-sm text-cyan-50 shadow-[0_18px_40px_rgba(8,15,30,0.35)] backdrop-blur-xl"
                        animate={allowLoopMotion ? { x: [0, 4, 0], opacity: [0.72, 1, 0.72] } : undefined}
                        transition={{ duration: 5.8 + index, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {pillar}
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="mx-auto mt-2 grid w-[min(92vw,28rem)] grid-cols-2 gap-2 md:hidden">
                  {[...thinkingPillarsLeft, ...thinkingPillarsRight].map((pillar) => (
                    <div key={`mobile-${pillar}`} className="rounded-full border border-cyan-100/20 bg-slate-950/55 px-3 py-2 text-center text-xs text-cyan-50 backdrop-blur-xl">
                      {pillar}
                    </div>
                  ))}
                </div>

                <motion.div
                  className="mx-auto mt-7 w-[min(88vw,34rem)] rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-center text-sm text-slate-200/90 backdrop-blur-xl sm:text-base"
                  animate={allowLoopMotion ? { opacity: [0.68, 1, 0.68] } : undefined}
                  transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                >
                  Every setback can be reframed into a clear next move.
                </motion.div>
              </div>
            </motion.div>
          </Stage>

          <Stage opacity={s4}>
            <div className="w-full max-w-3xl rounded-3xl border border-cyan-100/20 bg-white/5 px-6 py-10 text-center sm:px-10 sm:py-12">
              <motion.p style={{ opacity: mA }} className="text-xl text-cyan-100 sm:text-3xl">
                User: "I need help right now"
              </motion.p>
              <motion.p style={{ opacity: mB }} className="mt-6 text-lg text-sky-100 sm:text-2xl">
                Memory layer scans patterns in milliseconds...
              </motion.p>
              <motion.p style={{ opacity: mC }} className="mt-6 text-lg text-cyan-50 sm:text-2xl">
                You were focused on job stability last week. Lets continue from there.
              </motion.p>
            </div>
          </Stage>

          <Stage opacity={s5}>
            <motion.div style={{ y: cardsY }} className="relative w-full max-w-6xl">
              <div className="relative overflow-hidden rounded-[2.35rem] border border-cyan-100/24 bg-slate-950/88 px-5 py-7 shadow-[0_36px_96px_rgba(2,9,20,0.72)] backdrop-blur-2xl sm:px-8 sm:py-10">
                <motion.div
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.2)_0%,rgba(56,189,248,0.18)_26%,transparent_72%)] blur-3xl"
                  animate={allowLoopMotion ? { scale: [1, 1.08, 1], opacity: [0.2, 0.42, 0.2] } : undefined}
                  transition={{ duration: 9.6, repeat: Infinity, ease: "easeInOut" }}
                />

                <div className="relative z-10">
                  <div className="text-center">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/75">Action layer</p>
                    <h3 className="mx-auto mt-3 max-w-3xl text-balance text-2xl text-cyan-50 sm:text-4xl">
                      The plan becomes a living cinematic run.
                    </h3>
                  </div>

                  <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_560px_1fr]">
                    <motion.div style={{ opacity: c1 }} className="hidden items-center lg:flex">
                      <div className="w-full rounded-2xl border border-cyan-100/24 bg-slate-900/88 p-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/75">Trigger</p>
                        <p className="mt-2 text-sm text-slate-200">Context spike detected. Confidence gates open.</p>
                      </div>
                    </motion.div>

                    <div className="relative mx-auto h-[22.5rem] w-full max-w-[35rem]">
                      <svg aria-hidden="true" viewBox="0 0 560 360" className="absolute inset-0 h-full w-full overflow-visible">
                        <defs>
                          <linearGradient id="actionSpine" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="rgba(125,211,252,0.2)" />
                            <stop offset="50%" stopColor="rgba(45,212,191,0.95)" />
                            <stop offset="100%" stopColor="rgba(186,230,253,0.2)" />
                          </linearGradient>
                        </defs>

                        <motion.rect
                          x="52"
                          y="54"
                          width="456"
                          height="252"
                          rx="28"
                          fill="none"
                          stroke="rgba(148,163,184,0.22)"
                          strokeWidth="1.2"
                          animate={allowLoopMotion ? { opacity: [0.24, 0.58, 0.24] } : undefined}
                          transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
                        />

                        <motion.path
                          d="M 82 180 C 150 120 206 104 280 180 C 354 256 410 240 478 180"
                          fill="none"
                          stroke="url(#actionSpine)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray="4 14"
                          animate={allowLoopMotion ? { strokeDashoffset: [0, -160] } : undefined}
                          transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                        />

                        <motion.path
                          d="M 82 104 C 138 136 188 172 244 256"
                          fill="none"
                          stroke="rgba(125,211,252,0.5)"
                          strokeWidth="1.9"
                          strokeDasharray="3 12"
                          animate={allowLoopMotion ? { strokeDashoffset: [0, -120] } : undefined}
                          transition={{ duration: 8.6, repeat: Infinity, ease: "linear" }}
                        />
                        <motion.path
                          d="M 478 258 C 420 222 364 182 316 102"
                          fill="none"
                          stroke="rgba(45,212,191,0.52)"
                          strokeWidth="1.9"
                          strokeDasharray="3 12"
                          animate={allowLoopMotion ? { strokeDashoffset: [0, -120] } : undefined}
                          transition={{ duration: 8.2, repeat: Infinity, ease: "linear" }}
                        />

                        {[{ x: 82, y: 180 }, { x: 280, y: 180 }, { x: 478, y: 180 }, { x: 244, y: 256 }, { x: 316, y: 102 }].map((node) => (
                          <motion.circle
                            key={`${node.x}-${node.y}`}
                            cx={node.x}
                            cy={node.y}
                            r="7"
                            fill="rgba(56,189,248,0.88)"
                            animate={allowLoopMotion ? { r: [6, 9, 6], opacity: [0.55, 1, 0.55] } : undefined}
                            transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
                          />
                        ))}

                        <motion.circle
                          r="4"
                          fill="rgba(224,242,254,0.96)"
                          animate={allowLoopMotion ? { cx: [82, 168, 280, 392, 478], cy: [180, 138, 180, 222, 180], opacity: [0, 1, 0] } : undefined}
                          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <motion.circle
                          r="3"
                          fill="rgba(45,212,191,0.96)"
                          animate={allowLoopMotion ? { cx: [478, 392, 280, 168, 82], cy: [180, 222, 180, 138, 180], opacity: [0, 1, 0] } : undefined}
                          transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </svg>

                      <motion.div
                        className="absolute left-1/2 top-1/2 w-[14rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-100/35 bg-slate-900/95 px-4 py-3 text-center"
                        animate={allowLoopMotion ? { y: [0, -6, 0], opacity: [0.72, 1, 0.72], scale: [1, 1.03, 1] } : undefined}
                        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/75">Action Engine</p>
                        <p className="mt-1 text-sm text-cyan-50">Priority Conductor</p>
                      </motion.div>
                    </div>

                    <motion.div style={{ opacity: c3 }} className="hidden items-center lg:flex">
                      <div className="w-full rounded-2xl border border-cyan-100/24 bg-slate-900/88 p-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/75">Outcome</p>
                        <p className="mt-2 text-sm text-slate-200">Execution path adapts in real time until one next move is clear.</p>
                      </div>
                    </motion.div>
                  </div>

                  <motion.div
                    style={{ opacity: c2 }}
                    className="mx-auto mt-8 w-[min(92vw,36rem)] rounded-full border border-white/18 bg-slate-900/92 px-5 py-3 text-center text-sm text-slate-100/95"
                    animate={allowLoopMotion ? { opacity: [0.7, 1, 0.7] } : undefined}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  >
                    Cinematic flow: detect, align, execute, adapt.
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </Stage>

          <Stage opacity={s6}>
            <motion.div style={{ scale: endScale }} className="text-center">
              <h2 className="mx-auto max-w-4xl text-balance text-3xl font-semibold leading-tight sm:text-5xl md:text-6xl">
                You speak. LifeLens understands. LifeLens acts.
              </h2>
              <motion.button
                type="button"
                onClick={onStartTalking}
                style={{ opacity: s6 }}
                className="pointer-events-auto mt-10 rounded-full border border-cyan-200/50 bg-gradient-to-r from-cyan-300 to-sky-400 px-8 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950"
              >
                Start Talking
              </motion.button>
            </motion.div>
          </Stage>
        </div>
      </section>
    </div>
  );
}
