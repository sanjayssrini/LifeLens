import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

const labels = ["Problem", "Understanding", "Thinking", "Memory", "Action", "Resolution"];

function Stage({ opacity, children }) {
  return (
    <motion.div style={{ opacity }} className="pointer-events-none absolute inset-0 flex items-center justify-center px-5 sm:px-8">
      {children}
    </motion.div>
  );
}

export default function LandingPage({ onStartTalking }) {
  const containerRef = useRef(null);
  const reduceMotion = useReducedMotion();

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

  const arrowFade = useTransform(p, [0.0, 0.14, 0.24], [0.7, 1, 0]);

  const typed = useTransform(p, [0.22, 0.34], ["0ch", "31ch"]);
  const inputScale = useTransform(p, [0.2, 0.42], [0.98, 1.02]);
  const inputY = useTransform(p, [0.2, 0.42], [32, -20]);

  const thinkingY = useTransform(p, [0.4, 0.64], [10, 86]);
  const trunkGrow = useTransform(p, [0.44, 0.54], [0.02, 1]);
  const branchGrow = useTransform(p, [0.48, 0.62], [0.02, 1]);
  const nodeA = useTransform(p, [0.5, 0.58], [0, 1]);
  const nodeB = useTransform(p, [0.53, 0.61], [0, 1]);
  const nodeC = useTransform(p, [0.56, 0.64], [0, 1]);

  const mA = useTransform(p, [0.6, 0.67, 0.74], [0, 1, 0.55]);
  const mB = useTransform(p, [0.64, 0.71, 0.78], [0, 1, 0.55]);
  const mC = useTransform(p, [0.68, 0.76], [0, 1]);

  const cardsY = useTransform(p, [0.79, 0.92], [28, 0]);
  const c1 = useTransform(p, [0.8, 0.86], [0, 1]);
  const c2 = useTransform(p, [0.84, 0.9], [0, 1]);
  const c3 = useTransform(p, [0.88, 0.94], [0, 1]);

  const endScale = useTransform(p, [0.94, 1], [0.97, 1]);

  return (
    <div ref={containerRef} className="relative h-[680vh] overflow-x-clip bg-[#030712] text-white">
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
                animate={reduceMotion ? undefined : { y: [0, 5, 0] }}
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
                  animate={reduceMotion ? undefined : { opacity: [1, 0, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                />
              </div>
            </motion.div>
          </Stage>

          <Stage opacity={s3}>
            <motion.div style={{ y: thinkingY }} className="relative h-[72vh] w-full max-w-5xl">
              <div className="absolute left-1/2 top-[15%] w-[280px] -translate-x-1/2 rounded-full border border-white/25 bg-white/5 px-6 py-3 text-center text-lg sm:w-[360px] sm:text-2xl">
                One line becomes a context map
              </div>

              <motion.div style={{ scaleY: trunkGrow }} className="absolute left-1/2 top-[28%] h-[20%] w-[3px] -translate-x-1/2 origin-top bg-cyan-200/90" />
              <motion.div style={{ scaleX: branchGrow }} className="absolute left-1/2 top-[48%] h-[3px] w-[27%] origin-left bg-cyan-200/90" />
              <motion.div style={{ scaleX: branchGrow }} className="absolute right-1/2 top-[48%] h-[3px] w-[27%] origin-right bg-cyan-200/90" />
              <motion.div style={{ scaleY: branchGrow }} className="absolute left-1/2 top-[48%] h-[16%] w-[3px] -translate-x-1/2 origin-top bg-cyan-200/90" />

              <motion.div style={{ opacity: nodeA }} className="absolute left-[9%] top-[50%] rounded-full border border-cyan-100/40 bg-cyan-200/15 px-4 py-2 text-sm text-cyan-50 sm:text-base">
                Job Opportunities
              </motion.div>
              <motion.div style={{ opacity: nodeB }} className="absolute left-1/2 top-[70%] -translate-x-1/2 rounded-full border border-cyan-100/40 bg-cyan-200/15 px-4 py-2 text-sm text-cyan-50 sm:text-base">
                Financial Support
              </motion.div>
              <motion.div style={{ opacity: nodeC }} className="absolute right-[9%] top-[50%] rounded-full border border-cyan-100/40 bg-cyan-200/15 px-4 py-2 text-sm text-cyan-50 sm:text-base">
                Daily Needs
              </motion.div>
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
            <motion.div style={{ y: cardsY }} className="grid w-full max-w-5xl gap-4 will-change-transform sm:grid-cols-3">
              <motion.article style={{ opacity: c1 }} className="rounded-2xl border border-white/20 bg-white/[0.07] p-6">
                <h3 className="text-lg">Finding jobs</h3>
                <p className="mt-2 text-sm text-slate-200">Searching role matches and shortlisting viable applications.</p>
              </motion.article>
              <motion.article style={{ opacity: c2 }} className="rounded-2xl border border-white/20 bg-white/[0.07] p-6">
                <h3 className="text-lg">Checking financial aid</h3>
                <p className="mt-2 text-sm text-slate-200">Prioritizing immediate assistance and support programs.</p>
              </motion.article>
              <motion.article style={{ opacity: c3 }} className="rounded-2xl border border-white/20 bg-white/[0.07] p-6">
                <h3 className="text-lg">Suggesting support</h3>
                <p className="mt-2 text-sm text-slate-200">Converting insights into a practical next-step action plan.</p>
              </motion.article>
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
