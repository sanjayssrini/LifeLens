import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import VoiceOrb from "../components/VoiceOrb";
import { useSpeechPlayback } from "../hooks/useSpeechPlayback";
import { useSupportChat } from "../hooks/useSupportChat";
import { useVapiVoiceAgent } from "../hooks/useVapiVoiceAgent";

const starters = ["I lost my job and feel stuck", "I need help with hospital options", "I am stressed about money"];

export default function Dashboard({ session, onLogout }) {
  const [input, setInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [profile, setProfile] = useState({
    user_id: session?.user?.user_id || "",
    name: session?.user?.name || "",
    phone_or_email: session?.user?.phone_or_email || "",
    memory: session?.user?.memory || [],
  });
  const chatEndRef = useRef(null);

  const speech = useSpeechPlayback();
  const chat = useSupportChat({ onAssistantReply: speech.speak });
  const voice = useVapiVoiceAgent({
    userId: session?.user?.user_id || "",
    sessionToken: session?.session_token || "",
  });

  const isVoiceActive = voice.connected || voice.connecting || speech.speaking;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages, chat.isThinking]);

  const loadProfile = async () => {
    setSettingsLoading(true);
    setSettingsError("");
    try {
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session?.user?.user_id || "",
          session_token: session?.session_token || "",
        })
      });
      const data = await response.json();
      if (!response.ok || data.status !== "ok") {
        throw new Error(data.detail || "Unable to load settings.");
      }
      setProfile(data.user);
    } catch (error) {
      setSettingsError(error?.message || "Unable to load settings.");
    } finally {
      setSettingsLoading(false);
    }
  };

  const clearMemory = async () => {
    setSettingsLoading(true);
    setSettingsError("");
    try {
      const response = await fetch("/api/memory/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session?.user?.user_id || "",
          session_token: session?.session_token || "",
        })
      });
      const data = await response.json();
      if (!response.ok || data.status !== "ok") {
        throw new Error(data.detail || "Unable to clear memory.");
      }
      setProfile((current) => ({ ...current, memory: [] }));
    } catch (error) {
      setSettingsError(error?.message || "Unable to clear memory.");
    } finally {
      setSettingsLoading(false);
    }
  };

  const onSend = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) {
      return;
    }
    setInput("");
    chat.sendMessage(text, "text", {
      userId: session?.user?.user_id,
      sessionToken: session?.session_token,
    });
  };

  const quickSend = (text) => {
    chat.sendMessage(text, "quick-start", {
      userId: session?.user?.user_id,
      sessionToken: session?.session_token,
    });
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-8">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">LifeLens Voice Workspace</h1>
          <p className="mt-2 text-sm text-slate-300">
            Signed in as {session?.user?.name || "User"} • {session?.user?.phone_or_email || ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowSettings(true);
              loadProfile();
            }}
            className="rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 text-sm text-slate-200 backdrop-blur-xl hover:bg-white/[0.12]"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 text-sm text-slate-200 backdrop-blur-xl hover:bg-white/[0.12]"
          >
            Logout
          </button>
        </div>
      </motion.header>

      <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(8,47,73,0.35)] backdrop-blur-2xl sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.18),transparent_45%)]" />

        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 rounded-full border border-cyan-200/20 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-cyan-100">
            <span>Live</span>
            <motion.span
              className="inline-flex h-3 w-3 rounded-full border border-cyan-200/70"
              animate={isVoiceActive ? { scale: [1, 1.3, 1], opacity: [0.55, 1, 0.55] } : { scale: 1, opacity: 0.5 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <VoiceOrb active={isVoiceActive} />

          <motion.button
            type="button"
            onClick={voice.toggle}
            disabled={!voice.ready && !voice.connected && !voice.connecting}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className={`rounded-full px-10 py-4 text-lg font-semibold transition ${
              voice.connected || voice.connecting
                ? "bg-gradient-to-r from-rose-400 to-pink-500 text-slate-950"
                : "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950"
            }`}
          >
            {voice.connected || voice.connecting ? "End Voice" : "Start Voice"}
          </motion.button>

          <p className="text-sm text-slate-300">{voice.status}</p>
          {voice.error && <p className="text-xs text-rose-300">{voice.error}</p>}
        </div>

        <div className="absolute bottom-4 left-4 max-w-xs rounded-2xl border border-white/15 bg-white/[0.08] p-3 text-xs text-slate-200 backdrop-blur-xl">
          <p className="text-cyan-100">You</p>
          <p className="mt-1 line-clamp-3">{voice.userTranscript || "Your live transcript appears here."}</p>
        </div>

        <div className="absolute bottom-4 right-4 max-w-xs rounded-2xl border border-white/15 bg-white/[0.08] p-3 text-xs text-slate-200 backdrop-blur-xl">
          <p className="text-cyan-100">LifeLens</p>
          <p className="mt-1 line-clamp-3">{voice.assistantTranscript || "Assistant transcript appears here."}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowChat(true)}
          className="absolute right-6 top-6 rounded-full border border-white/20 bg-white/[0.08] px-4 py-2 text-sm text-slate-100 backdrop-blur-xl hover:bg-white/[0.16]"
        >
          Continue in chat
        </button>
      </div>

      {showChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md" onClick={() => setShowChat(false)}>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/[0.1] shadow-[0_24px_90px_rgba(2,8,23,0.5)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/15 px-6 py-4">
              <h2 className="text-2xl font-semibold text-white">Continue in chat</h2>
              <button type="button" onClick={() => setShowChat(false)} className="text-sm text-slate-300 hover:text-white">
                Close
              </button>
            </div>

            <div className="max-h-[50vh] flex-1 space-y-3 overflow-y-auto p-5">
              {chat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm ${
                    message.role === "user"
                      ? "ml-auto bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950"
                      : "border border-white/15 bg-white/[0.1] text-slate-100"
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {chat.isThinking && <p className="text-xs text-slate-300">LifeLens is thinking...</p>}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t border-white/15 px-5 py-3">
              <div className="mb-3 flex flex-wrap gap-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => quickSend(starter)}
                    className="rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-xs text-slate-200 hover:bg-white/[0.12]"
                  >
                    {starter}
                  </button>
                ))}
              </div>

              <form onSubmit={onSend} className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={2}
                  placeholder="Speak your mind. LifeLens is listening..."
                  className="w-full resize-none rounded-2xl border border-white/20 bg-white/[0.08] px-4 py-3 text-sm text-white outline-none ring-cyan-300/40 transition focus:ring"
                />
                <button
                  type="submit"
                  disabled={chat.isThinking}
                  className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  Send
                </button>
              </form>
              {(chat.error || speech.error) && <p className="mt-2 text-xs text-rose-300">{chat.error || speech.error}</p>}
            </div>
          </motion.div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md" onClick={() => setShowSettings(false)}>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/[0.1] shadow-[0_24px_90px_rgba(2,8,23,0.5)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/15 px-6 py-4">
              <h2 className="text-2xl font-semibold text-white">Settings</h2>
              <button type="button" onClick={() => setShowSettings(false)} className="text-sm text-slate-300 hover:text-white">
                Close
              </button>
            </div>

            <div className="max-h-[70vh] flex-1 space-y-6 overflow-y-auto p-6 text-slate-200">
              <section className="rounded-2xl border border-white/15 bg-white/[0.07] p-4">
                <h3 className="text-base font-semibold text-white">Personal Details</h3>
                <div className="mt-3 space-y-2 text-sm">
                  <p><span className="text-slate-400">Name:</span> {profile.name || "-"}</p>
                  <p><span className="text-slate-400">Phone/Email:</span> {profile.phone_or_email || "-"}</p>
                  <p><span className="text-slate-400">User ID:</span> {profile.user_id || "-"}</p>
                </div>
              </section>

              <section className="rounded-2xl border border-white/15 bg-white/[0.07] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">Memory Saved</h3>
                  <button
                    type="button"
                    onClick={loadProfile}
                    disabled={settingsLoading}
                    className="rounded-full border border-white/20 bg-white/[0.08] px-3 py-1 text-xs text-slate-200 hover:bg-white/[0.12] disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>

                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {(profile.memory || []).length === 0 && (
                    <p className="text-sm text-slate-400">No memory saved yet.</p>
                  )}
                  {(profile.memory || []).map((item, index) => (
                    <div key={`${index}-${item.content || "memory"}`} className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-xs">
                      <p className="text-slate-100">{item.content || "-"}</p>
                      <p className="mt-1 text-slate-400">Intent: {item.intent || "general"}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/15 bg-white/[0.07] p-4">
                <h3 className="text-base font-semibold text-white">Clear Memory</h3>
                <p className="mt-2 text-sm text-slate-400">This removes all saved memories linked to your account.</p>
                <button
                  type="button"
                  onClick={clearMemory}
                  disabled={settingsLoading}
                  className="mt-3 rounded-full bg-gradient-to-r from-rose-400 to-pink-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  Clear memory
                </button>
              </section>

              {settingsError && <p className="text-xs text-rose-300">{settingsError}</p>}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
