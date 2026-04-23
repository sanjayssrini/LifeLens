import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchVoiceConfig(retries = 3, delayMs = 250) {
  let lastError = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch("/api/config");
      if (!response.ok) {
        throw new Error("Unable to load voice configuration");
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        await delay(delayMs);
      }
    }
  }

  throw lastError || new Error("Unable to load voice configuration");
}

function normalizeTranscript(text) {
  if (!text) {
    return "";
  }

  return text
    .replace(/\blife\s*line\b/gi, "LifeLens")
    .replace(/\blifeline\b/gi, "LifeLens")
    .replace(/\blife\s*lens\b/gi, "LifeLens")
    .replace(/\s+/g, " ")
    .trim();
}

function isFinalTranscriptMessage(message) {
  if (!message || typeof message !== "object") {
    return false;
  }

  if (message.isFinal === false || message.final === false) {
    return false;
  }

  return true;
}

export function useVapiVoiceAgent({ onFinalTranscript, userId = "", sessionToken = "" } = {}) {
  const vapiRef = useRef(null);
  const transcriptDebounceRef = useRef(null);
  const lastSubmittedTranscriptRef = useRef("");
  const desiredConnectionRef = useRef(false);
  const micPermissionPromiseRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [assistantTranscript, setAssistantTranscript] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [status, setStatus] = useState("Loading voice configuration...");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [config, setConfig] = useState({ apiKey: "", assistantId: "" });
  const [mode] = useState("vapi");
  const [activity, setActivity] = useState("idle");

  const ensureMicrophoneAccess = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    if (!micPermissionPromiseRef.current) {
      micPermissionPromiseRef.current = navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
          return true;
        })
        .catch(() => false);
    }

    return micPermissionPromiseRef.current;
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchVoiceConfig()
      .then((data) => {
        if (!isMounted) {
          return;
        }
        setConfig({
          apiKey: data.vapi_public_key || "",
          assistantId: data.vapi_assistant_id || ""
        });
        setReady(Boolean(data.vapi_public_key && data.vapi_assistant_id));
        setStatus(data.vapi_public_key && data.vapi_assistant_id ? "Voice agent ready" : "Missing Vapi credentials");
      })
      .catch((fetchError) => {
        if (!isMounted) {
          return;
        }
        setError(fetchError.message || "Unable to load voice config");
        setStatus("Voice config unavailable");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      desiredConnectionRef.current = false;
      if (transcriptDebounceRef.current) {
        clearTimeout(transcriptDebounceRef.current);
      }
      if (vapiRef.current) {
        try {
          vapiRef.current.stop();
        } catch {
          // Ignore cleanup errors.
        }
      }
    };
  }, []);

  const wireEvents = useCallback((vapi) => {
    vapi.on("call-start", () => {
      setConnected(true);
      setConnecting(false);
      setActivity("listening");
      setStatus("Connected to LifeLens voice agent");
      setError("");
    });

    vapi.on("call-end", () => {
      setConnected(false);
      setConnecting(false);
      setActivity("idle");
      setStatus("Voice session ended");
      setUserTranscript("");
      setAssistantTranscript("");
      if (transcriptDebounceRef.current) {
        clearTimeout(transcriptDebounceRef.current);
      }
    });

    vapi.on("message", (message) => {
      if (message?.type !== "transcript") {
        return;
      }

      if (!isFinalTranscriptMessage(message)) {
        return;
      }

      const role = message.role || "assistant";
      const transcript = normalizeTranscript((message.transcript || "").trim());
      if (!transcript) {
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role,
          transcript,
          timestamp: Date.now()
        }
      ].slice(-30));

      if (role === "user") {
        setUserTranscript(transcript);
        setActivity("processing");

        if (transcriptDebounceRef.current) {
          clearTimeout(transcriptDebounceRef.current);
        }
        transcriptDebounceRef.current = setTimeout(() => {
          if (lastSubmittedTranscriptRef.current === transcript) {
            return;
          }
          lastSubmittedTranscriptRef.current = transcript;
          onFinalTranscript?.(transcript);
        }, 500);
      } else if (role === "assistant") {
        setAssistantTranscript(transcript);
        setActivity("answering");
      }
    });
  }, [onFinalTranscript]);

  useEffect(() => {
    if (!ready || !config.apiKey || vapiRef.current) {
      return;
    }

    try {
      const instance = new Vapi(config.apiKey);
      vapiRef.current = instance;
      wireEvents(instance);
    } catch {
      // Keep lazy init fallback in connect().
    }
  }, [config.apiKey, ready, wireEvents]);

  const connect = useCallback(async () => {
    if (connecting || connected) {
      return;
    }

    desiredConnectionRef.current = true;
    setError("");

    const micReady = await ensureMicrophoneAccess();
    if (!micReady) {
      setConnecting(false);
      setActivity("idle");
      setError("Microphone access is blocked. Allow microphone permission and try again.");
      return;
    }

    if (!ready) {
      setConnecting(false);
      setActivity("idle");
      setStatus("Vapi voice unavailable");
      setError("Vapi voice is not configured right now. Chat is available for Gemini text responses.");
      return;
    }

    try {
      setConnecting(true);
      setActivity("processing");
      setStatus("Connecting to voice agent...");
      setError("");

      if (!vapiRef.current) {
        vapiRef.current = new Vapi(config.apiKey);
        wireEvents(vapiRef.current);
      }

      try {
        await vapiRef.current.start(config.assistantId, {
          metadata: {
            user_id: userId,
            session_token: sessionToken
          }
        });
      } catch {
        await vapiRef.current.start(config.assistantId);
      }
    } catch (connectError) {
      setConnecting(false);
      setActivity("idle");
      setStatus("Voice session failed to start");
      setError(connectError?.message || "Unable to start Vapi call");
    }
  }, [config.assistantId, config.apiKey, connected, connecting, ensureMicrophoneAccess, ready, sessionToken, userId, wireEvents]);

  const disconnect = useCallback(async () => {
    desiredConnectionRef.current = false;
    if (!vapiRef.current) {
      return;
    }

    try {
      await vapiRef.current.stop();
    } catch (disconnectError) {
      setError(disconnectError?.message || "Unable to end voice session");
    }
  }, []);

  const toggle = useCallback(() => {
    if (connected || connecting) {
      disconnect();
      return;
    }

    connect();
  }, [connected, connecting, connect, disconnect]);

  return useMemo(
    () => ({
      ready,
      connected,
      connecting,
      status,
      error,
      mode,
      activity,
      assistantTranscript,
      userTranscript,
      messages,
      connect,
      disconnect,
      toggle
    }),
    [
      ready,
      connected,
      connecting,
      status,
      error,
      mode,
      activity,
      assistantTranscript,
      userTranscript,
      messages,
      connect,
      disconnect,
      toggle,
    ]
  );
}
