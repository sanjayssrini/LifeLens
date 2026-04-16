import { useCallback, useMemo, useState } from "react";

export function useSpeechPlayback() {
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");

  const speak = useCallback(
    (text) => {
      if (!enabled || typeof window === "undefined" || !window.speechSynthesis || !text?.trim()) {
        return;
      }

      try {
        const synth = window.speechSynthesis;
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.04;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => {
          setSpeaking(true);
          setError("");
        };

        utterance.onend = () => {
          setSpeaking(false);
        };

        utterance.onerror = (event) => {
          setSpeaking(false);
          setError(event.error || "Unable to play voice response");
        };

        synth.speak(utterance);
      } catch (exception) {
        setSpeaking(false);
        setError(exception?.message || "Speech playback failed");
      }
    },
    [enabled],
  );

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      if (!next) {
        stop();
      }
      return next;
    });
  }, [stop]);

  return useMemo(
    () => ({ enabled, speaking, error, speak, stop, toggleEnabled }),
    [enabled, speaking, error, speak, stop, toggleEnabled],
  );
}