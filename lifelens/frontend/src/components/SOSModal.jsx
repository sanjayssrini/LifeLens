import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SOSModal({ onClose, userId, sessionToken, onSOSTriggered }) {
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef(null);

  useEffect(() => {
    const fetchTrustedContacts = async () => {
      try {
        const response = await fetch("/api/sos/trusted-contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId || "",
            session_token: sessionToken || "",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setTrustedContacts(data.trusted_contacts || []);
        } else {
          setError("Could not load trusted contacts");
        }
      } catch (err) {
        setError("Network error while loading contacts");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrustedContacts();
  }, [userId, sessionToken]);

  // Trigger alarm sound
  useEffect(() => {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    audioRef.current = context;

    const playAlarm = async () => {
      try {
        if (context.state === "suspended") {
          await context.resume();
        }
      } catch (err) {
        // Ignore resume errors; some browsers may still allow playback.
      }

      const now = context.currentTime;
      const duration = 0.3;

      for (let i = 0; i < 6; i++) {
        const startTime = now + i * 0.4;

        const osc = context.createOscillator();
        const gain = context.createGain();

        osc.frequency.setValueAtTime(800 + i * 100, startTime);
        osc.frequency.exponentialRampToValueAtTime(600, startTime + duration);

        gain.gain.setValueAtTime(0.8, startTime);
        gain.gain.exponentialRampToValueAtTime(0.1, startTime + duration);

        osc.connect(gain);
        gain.connect(context.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      }
    };

    playAlarm();

    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.close();
        } catch (err) {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const toggleContact = (contactId) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleSendSOS = async () => {
    if (selectedContacts.size === 0) {
      setError("Please select at least one contact");
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const response = await fetch("/api/sos/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId || "",
          session_token: sessionToken || "",
          contact_ids: Array.from(selectedContacts),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (onSOSTriggered) {
          onSOSTriggered(data);
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError("Failed to send SOS alert");
      }
    } catch (err) {
      setError("Network error sending SOS");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-600/20 via-slate-950/80 to-slate-950/95" />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 280, damping: 25 }}
          className="relative z-10 w-full max-w-lg rounded-[1.5rem] border border-rose-500/30 bg-slate-900/98 p-6 shadow-2xl"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="h-3 w-3 rounded-full bg-rose-500"
                />
                <h2 className="text-2xl font-bold text-rose-100">SOS Alert</h2>
              </div>
              <p className="text-sm text-slate-300/90">
                Send an emergency alert to your trusted contacts
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
              >
                {error}
              </motion.div>
            )}

            {isLoading ? (
              <div className="space-y-3 py-4">
                <div className="h-12 rounded-lg bg-white/5 animate-pulse" />
                <div className="h-12 rounded-lg bg-white/5 animate-pulse" />
                <div className="h-12 rounded-lg bg-white/5 animate-pulse" />
              </div>
            ) : trustedContacts.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-300/80">
                <p className="mb-3">No trusted contacts added yet.</p>
                <p className="text-xs text-slate-400/70">
                  Add trusted contacts in your settings to use SOS alerts.
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 max-h-64 overflow-y-auto">
                {trustedContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => toggleContact(contact.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                      selectedContacts.has(contact.id)
                        ? "border-rose-400/40 bg-rose-500/15"
                        : "border-white/10 bg-slate-950 hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        selectedContacts.has(contact.id)
                          ? "border-rose-400 bg-rose-500"
                          : "border-white/30 bg-slate-950"
                      }`}
                    >
                      {selectedContacts.has(contact.id) && (
                        <span className="text-xs text-white font-bold">✓</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{contact.name}</p>
                      <p className="text-xs text-slate-400">{contact.contact}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendSOS}
                disabled={isSending || trustedContacts.length === 0}
                className="rounded-lg bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
              >
                {isSending ? "Sending..." : "Send SOS Now"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
