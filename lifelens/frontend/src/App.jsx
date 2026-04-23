import { Suspense, lazy, useEffect, useState } from "react";

import AmbientBackground from "./components/AmbientBackground";
import LandingPage from "./pages/LandingPage";

const AuthModal = lazy(() => import("./components/AuthModal"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const SESSION_KEY = "lifelens_session";

export default function App() {
  const [session, setSession] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

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
      {!session && <AmbientBackground />}
      {!session && <div className="noise-layer" />}
      {!session && <LandingPage onStartTalking={() => setAuthOpen(true)} />}
      {session && (
        <Suspense fallback={<div className="min-h-screen" />}>
          <Dashboard session={session} onLogout={logout} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />
      </Suspense>
    </>
  );
}
