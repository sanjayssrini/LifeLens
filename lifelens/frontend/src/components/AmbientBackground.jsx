import { useEffect, useMemo, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

function buildParticles() {
  return Array.from({ length: 8 }).map((_, index) => ({
    id: `particle-${index}`,
    size: 6 + (index % 5) * 2,
    x: ((index * 13) % 100) + "%",
    y: ((index * 17) % 100) + "%",
    delay: index * 0.35,
    duration: 12 + (index % 6) * 2,
  }));
}

export default function AmbientBackground() {
  const rafRef = useRef(0);
  const latestRef = useRef({ x: 0, y: 0 });
  const particles = useMemo(() => buildParticles(), []);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 40, damping: 20, mass: 0.8 });
  const springY = useSpring(pointerY, { stiffness: 40, damping: 20, mass: 0.8 });
  const xShift = useTransform(springX, (value) => value * 12);
  const yShift = useTransform(springY, (value) => value * 12);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const normalizedX = (event.clientX / window.innerWidth - 0.5) * 2;
      const normalizedY = (event.clientY / window.innerHeight - 0.5) * 2;
      latestRef.current = { x: normalizedX, y: normalizedY };
      if (rafRef.current) {
        return;
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        pointerX.set(latestRef.current.x);
        pointerY.set(latestRef.current.y);
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        className="absolute inset-[-20%] bg-[radial-gradient(circle_at_20%_20%,rgba(74,222,128,0.16),transparent_36%),radial-gradient(circle_at_80%_26%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_50%_85%,rgba(14,165,233,0.14),transparent_35%)]"
          style={{ x: xShift, y: yShift }}
          animate={{ scale: [1, 1.03, 1] }}
        transition={{
          scale: { duration: 18, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="absolute rounded-full bg-cyan-200/25 blur-[1px]"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: particle.x,
            top: particle.y,
          }}
          animate={{
            y: [0, -16, 0],
            opacity: [0.18, 0.48, 0.18],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
