import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchVoiceConfig(retries = 6, delayMs = 600) {
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

export function useVapiVoiceAgent({ onFinalTranscript, userId = "", sessionToken = "" } = {}) {
  const vapiRef = useRef(null);
  const browserRecognitionRef = useRef(null);
  const transcriptDebounceRef = useRef(null);
  const lastSubmittedTranscriptRef = useRef("");
  const lastStoredVoiceMemoryRef = useRef({ text: "", ts: 0 });

  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [assistantTranscript, setAssistantTranscript] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [status, setStatus] = useState("Loading voice configuration...");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [config, setConfig] = useState({ apiKey: "", assistantId: "" });
  const [mode, setMode] = useState("vapi");
  const [browserSupported, setBrowserSupported] = useState(false);
  const [activity, setActivity] = useState("idle");

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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setBrowserSupported(Boolean(SpeechRecognition));

    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setConnected(true);
      setConnecting(false);
      setMode("browser");
      setActivity("listening");
      setStatus("Connected in browser voice mode");
      setError("");
    };

    recognition.onend = () => {
      setConnected(false);
      setConnecting(false);
      setActivity("idle");
      setStatus("Browser voice mode ended");
    };

    recognition.onerror = (event) => {
      setError(event.error || "Browser speech mode failed");
      setConnected(false);
      setConnecting(false);
      setActivity("idle");
    };

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = (event.results[index][0]?.transcript || "").trim();
        if (!transcript || !event.results[index].isFinal) {
          continue;
        }

        setUserTranscript(transcript);
        setActivity("listening");
        setMessages((current) => [
          ...current,
          {
            role: "user",
            transcript,
            timestamp: Date.now()
          }
        ].slice(-30));

        if (lastSubmittedTranscriptRef.current === transcript) {
          continue;
        }
        lastSubmittedTranscriptRef.current = transcript;
        onFinalTranscript?.(transcript);
      }
    };

    browserRecognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // Ignore teardown errors.
      }
      browserRecognitionRef.current = null;
    };
  }, [onFinalTranscript]);

  useEffect(() => {
    return () => {
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
      if (browserRecognitionRef.current) {
        try {
          browserRecognitionRef.current.stop();
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
      if (transcriptDebounceRef.current) {
        clearTimeout(transcriptDebounceRef.current);
      }
    });

    vapi.on("message", (message) => {
      if (message?.type !== "transcript") {
        return;
      }

      const role = message.role || "assistant";
      const transcript = (message.transcript || "").trim();
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
        setActivity("listening");

        const now = Date.now();
        const lastStored = lastStoredVoiceMemoryRef.current;
        const isDuplicateMemory = lastStored.text === transcript && now - lastStored.ts < 8000;
        if (userId && !isDuplicateMemory) {
          lastStoredVoiceMemoryRef.current = { text: transcript, ts: now };
          fetch("/api/memory/store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              content: transcript,
              intent: "voice_conversation",
              preferences: {},
              metadata: {
                source: "vapi-live-transcript",
                session_token: sessionToken || "",
              }
            })
          }).catch(() => {
            // Non-blocking write; voice session should continue even if memory write fails.
          });
        }

        if (transcriptDebounceRef.current) {
          clearTimeout(transcriptDebounceRef.current);
        }
        transcriptDebounceRef.current = setTimeout(() => {
          if (lastSubmittedTranscriptRef.current === transcript) {
            return;
          }
          lastSubmittedTranscriptRef.current = transcript;
          onFinalTranscript?.(transcript);
        }, 900);
      } else if (role === "assistant") {
        setAssistantTranscript(transcript);
        setActivity("speaking");
      }
    });
  }, [onFinalTranscript, sessionToken, userId]);

  const connect = useCallback(async () => {
    if (connecting || connected) {
      return;
    }

    if (!ready && browserSupported && browserRecognitionRef.current) {
      setConnecting(true);
      setActivity("thinking");
      setStatus("Starting browser voice mode...");
      try {
        browserRecognitionRef.current.start();
      } catch (browserError) {
        setConnecting(false);
        setError(browserError?.message || "Unable to start browser voice mode");
      }
      return;
    }

    if (!ready) {
      setError("Voice credentials not available and browser mode unsupported.");
      return;
    }

    try {
      setConnecting(true);
      setActivity("thinking");
      setStatus("Connecting to voice agent...");
      setError("");
      setMode("vapi");

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
      if (browserSupported && browserRecognitionRef.current) {
        try {
          setStatus("Vapi unavailable, switching to browser voice mode...");
          browserRecognitionRef.current.start();
          return;
        } catch {
          // Continue to hard failure below.
        }
      }
      setConnecting(false);
      setActivity("idle");
      setStatus("Voice session failed to start");
      setError(connectError?.message || "Unable to start Vapi call");
    }
  }, [browserSupported, config.assistantId, config.apiKey, connected, connecting, ready, sessionToken, userId, wireEvents]);

  const disconnect = useCallback(async () => {
    if (mode === "browser" && browserRecognitionRef.current) {
      try {
        browserRecognitionRef.current.stop();
        return;
      } catch (disconnectError) {
        setError(disconnectError?.message || "Unable to end browser voice mode");
      }
    }

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
