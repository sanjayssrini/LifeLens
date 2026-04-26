import { Suspense, lazy, useEffect, useState } from "react";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AuthModal = lazy(() => import("./components/AuthModal"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const SESSION_KEY = "lifelens_session";

function LandingFallback({ onStartTalking }) {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_14%_8%,rgba(45,212,191,0.28),transparent_44%),radial-gradient(110%_100%_at_82%_22%,rgba(56,189,248,0.2),transparent_48%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">Life is not a single question.</h1>
          <p className="mt-5 text-base text-cyan-100/90 sm:text-xl">Problems come layered.</p>
          <button
            type="button"
            onClick={onStartTalking}
            className="mt-10 rounded-full border border-cyan-200/50 bg-gradient-to-r from-cyan-300 to-sky-400 px-8 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-950"
          >
            Start Talking
          </button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const showLandingScene = !session && !authOpen;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) {
        setSession(JSON.parse(raw));
      }
    } catch {
      // Ignore invalid local storage data.
    }
  }, []);

  const handleAuthenticated = (data) => {
    setSession(data);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  };

  const logout = () => {
    setSession(null);
    window.localStorage.removeItem(SESSION_KEY);
  };

  return (
    <>
      {showLandingScene && <div className="noise-layer" />}
      {showLandingScene && (
        <Suspense fallback={<LandingFallback onStartTalking={() => setAuthOpen(true)} />}>
          <LandingPage onStartTalking={() => setAuthOpen(true)} />
        </Suspense>
      )}
      {session && (
        <Suspense fallback={<div className="min-h-screen" />}>
          <Dashboard session={session} onLogout={logout} />
        </Suspense>
      )}
      {authOpen && (
        <Suspense fallback={null}>
          <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />
        </Suspense>
      )}
    </>
  );
}
