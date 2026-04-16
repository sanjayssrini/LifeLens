import { useEffect, useState } from "react";

import AuthModal from "./components/AuthModal";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";

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
      <div className="noise-layer" />
      {!session && <LandingPage onStartTalking={() => setAuthOpen(true)} />}
      {session && <Dashboard session={session} onLogout={logout} />}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />
    </>
  );
}
