import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function AuthModal({ open, onClose, onAuthenticated }) {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return null;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const endpoint = mode === "signup" ? "/api/signup" : "/api/login";
      const body = mode === "signup"
        ? { name: name.trim(), phone_or_email: identifier.trim() }
        : { identifier: identifier.trim() };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Authentication failed");
      }

      const data = await response.json();
      onAuthenticated?.(data);
      onClose?.();
      setName("");
      setIdentifier("");
    } catch (authError) {
      setError(authError?.message || "Unable to authenticate right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.24 }}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-md rounded-3xl border border-white/20 bg-white/[0.08] p-7 shadow-[0_24px_90px_rgba(8,47,73,0.45)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Welcome to LifeLens</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 px-3 py-1 text-sm text-slate-200 hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <p className="mt-2 text-sm text-slate-300">
            Securely continue with your profile so LifeLens can personalize every conversation.
          </p>

          <div className="mt-5 grid grid-cols-2 rounded-full border border-white/20 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-full px-3 py-2 transition ${mode === "signup" ? "bg-cyan-300 text-slate-950" : "text-slate-200"}`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-full px-3 py-2 transition ${mode === "login" ? "bg-cyan-300 text-slate-950" : "text-slate-200"}`}
            >
              Login
            </button>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-300">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 text-sm text-white outline-none ring-cyan-300/40 transition focus:ring"
                  placeholder="Your name"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-300">Phone or Email</span>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
                className="w-full rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 text-sm text-white outline-none ring-cyan-300/40 transition focus:ring"
                placeholder="you@example.com or +91..."
              />
            </label>

            {error && <p className="text-xs text-rose-300">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_rgba(14,165,233,0.35)] transition hover:scale-[1.01] disabled:opacity-60"
            >
              {isSubmitting ? "Please wait..." : mode === "signup" ? "Create Account" : "Continue"}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
