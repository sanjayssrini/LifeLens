import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchVoiceConfig(retries = 2, delayMs = 100) {
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

function extractTranscriptEvent(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const toText = (value) => (typeof value === "string" ? normalizeTranscript(value) : "");

  const inferFinal = (obj) => {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const transcriptType = String(obj.transcriptType || obj.transcript_type || obj.kind || "").toLowerCase();
    const status = String(obj.status || "").toLowerCase();

    if (obj.isFinal === true || obj.final === true) {
      return true;
    }
    if (obj.isFinal === false || obj.final === false) {
      return false;
    }
    if (transcriptType === "final" || status === "final") {
      return true;
    }
    if (transcriptType === "partial" || transcriptType === "interim") {
      return false;
    }

    return isFinalTranscriptMessage(obj);
  };

  const directText = toText(message.transcript || message.text || message.content || message.message);
  if (directText) {
    return {
      role: String(message.role || message.speaker || "assistant").toLowerCase(),
      transcript: directText,
      isFinal: inferFinal(message),
    };
  }

  const nested = message.data && typeof message.data === "object" ? message.data : null;
  const nestedText = toText(nested?.transcript || nested?.text || nested?.content || nested?.message);
  if (nestedText) {
    return {
      role: String(nested?.role || nested?.speaker || message.role || "assistant").toLowerCase(),
      transcript: nestedText,
      isFinal: inferFinal(nested) || inferFinal(message),
    };
  }

  const candidates = Array.isArray(message.messages)
    ? message.messages
    : Array.isArray(message.conversation)
      ? message.conversation
      : [];

  if (candidates.length > 0) {
    const last = candidates[candidates.length - 1];
    if (last && typeof last === "object") {
      const lastText = toText(last.transcript || last.text || last.content || last.message);
      if (lastText) {
        return {
          role: String(last.role || last.speaker || "assistant").toLowerCase(),
          transcript: lastText,
          isFinal: inferFinal(last) || inferFinal(message),
        };
      }
    }
  }

  return null;
}

export function useVapiVoiceAgent({ onFinalTranscript, userId = "", sessionToken = "" } = {}) {
  const vapiRef = useRef(null);
  const transcriptDebounceRef = useRef(null);
  const interimSubmitTimerRef = useRef(null);
  const userUiTimerRef = useRef(null);
  const assistantUiTimerRef = useRef(null);
  const pendingUserTranscriptRef = useRef("");
  const pendingAssistantTranscriptRef = useRef("");
  const lastSubmittedTranscriptRef = useRef("");
  const lastInterimSubmittedRef = useRef("");
  const lastUserTranscriptRef = useRef("");
  const lastAssistantTranscriptRef = useRef("");
  const desiredConnectionRef = useRef(false);
  const micPermissionPromiseRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [assistantTranscript, setAssistantTranscript] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [status, setStatus] = useState("Loading voice configuration...");
  const [error, setError] = useState("");
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

  const submitTranscript = useCallback((text) => {
    const normalized = normalizeTranscript(text || "");
    if (!normalized) {
      return;
    }
    if (lastSubmittedTranscriptRef.current === normalized) {
      return;
    }
    lastSubmittedTranscriptRef.current = normalized;
    onFinalTranscript?.(normalized);
  }, [onFinalTranscript]);

  const scheduleUserTranscriptUpdate = useCallback((text, immediate = false) => {
    pendingUserTranscriptRef.current = text;
    if (immediate) {
      if (userUiTimerRef.current) {
        clearTimeout(userUiTimerRef.current);
        userUiTimerRef.current = null;
      }
      setUserTranscript(text);
      return;
    }

    if (userUiTimerRef.current) {
      return;
    }
    userUiTimerRef.current = setTimeout(() => {
      userUiTimerRef.current = null;
      setUserTranscript(pendingUserTranscriptRef.current);
    }, 90);
  }, []);

  const scheduleAssistantTranscriptUpdate = useCallback((text, immediate = false) => {
    pendingAssistantTranscriptRef.current = text;
    if (immediate) {
      if (assistantUiTimerRef.current) {
        clearTimeout(assistantUiTimerRef.current);
        assistantUiTimerRef.current = null;
      }
      setAssistantTranscript(text);
      return;
    }

    if (assistantUiTimerRef.current) {
      return;
    }
    assistantUiTimerRef.current = setTimeout(() => {
      assistantUiTimerRef.current = null;
      setAssistantTranscript(pendingAssistantTranscriptRef.current);
    }, 90);
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
      if (interimSubmitTimerRef.current) {
        clearTimeout(interimSubmitTimerRef.current);
      }
      if (userUiTimerRef.current) {
        clearTimeout(userUiTimerRef.current);
      }
      if (assistantUiTimerRef.current) {
        clearTimeout(assistantUiTimerRef.current);
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
      pendingUserTranscriptRef.current = "";
      pendingAssistantTranscriptRef.current = "";
      lastUserTranscriptRef.current = "";
      lastAssistantTranscriptRef.current = "";
      lastInterimSubmittedRef.current = "";
      if (transcriptDebounceRef.current) {
        clearTimeout(transcriptDebounceRef.current);
      }
      if (interimSubmitTimerRef.current) {
        clearTimeout(interimSubmitTimerRef.current);
      }
      if (userUiTimerRef.current) {
        clearTimeout(userUiTimerRef.current);
        userUiTimerRef.current = null;
      }
      if (assistantUiTimerRef.current) {
        clearTimeout(assistantUiTimerRef.current);
        assistantUiTimerRef.current = null;
      }
    });

    vapi.on("message", (message) => {
      const event = extractTranscriptEvent(message);
      if (!event) {
        return;
      }

      const role = event.role || "assistant";
      const transcript = event.transcript;
      const finalMessage = Boolean(event.isFinal);

      if (role === "user") {
        if (lastUserTranscriptRef.current === transcript) {
          return;
        }
        lastUserTranscriptRef.current = transcript;
        scheduleUserTranscriptUpdate(transcript, finalMessage);
        setActivity("processing");

        if (interimSubmitTimerRef.current) {
          clearTimeout(interimSubmitTimerRef.current);
        }
        if (transcriptDebounceRef.current) {
          clearTimeout(transcriptDebounceRef.current);
        }

        if (finalMessage) {
          transcriptDebounceRef.current = setTimeout(() => {
            submitTranscript(transcript);
          }, 90);
          return;
        }

        // Keep transcription lively and reduce perceived latency by submitting stable interim chunks.
        if (transcript.length >= 20) {
          interimSubmitTimerRef.current = setTimeout(() => {
            const stable = lastUserTranscriptRef.current;
            if (!stable || stable !== transcript) {
              return;
            }
            if (lastInterimSubmittedRef.current === stable) {
              return;
            }
            if (lastSubmittedTranscriptRef.current && stable.startsWith(lastSubmittedTranscriptRef.current)) {
              const delta = stable.length - lastSubmittedTranscriptRef.current.length;
              if (delta < 12) {
                return;
              }
            }
            lastInterimSubmittedRef.current = stable;
            submitTranscript(stable);
          }, 360);
        }
      } else if (role === "assistant" || role === "bot" || role === "agent") {
        if (lastAssistantTranscriptRef.current === transcript) {
          return;
        }
        lastAssistantTranscriptRef.current = transcript;
        scheduleAssistantTranscriptUpdate(transcript, finalMessage);
        setActivity("answering");
      }
    });
  }, [scheduleAssistantTranscriptUpdate, scheduleUserTranscriptUpdate, submitTranscript]);

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

  const continueWithPrompt = useCallback(
    async (prompt, options = {}) => {
      const normalized = normalizeTranscript(String(prompt || ""));
      if (!normalized) {
        return false;
      }

      try {
        if (!connected && !connecting) {
          await connect();
        }
      } catch {
        // Continue with fallback below.
      }

      let injected = false;
      const instance = vapiRef.current;
      if (instance) {
        const candidatePayload = {
          type: "add-message",
          message: {
            role: "system",
            content: normalized,
          },
        };

        const candidateCalls = [
          async () => {
            if (typeof instance.send === "function") {
              await instance.send(candidatePayload);
              return true;
            }
            return false;
          },
          async () => {
            if (typeof instance.sendText === "function") {
              await instance.sendText(normalized);
              return true;
            }
            return false;
          },
          async () => {
            if (typeof instance.say === "function") {
              await instance.say(normalized);
              return true;
            }
            return false;
          },
        ];

        for (const attempt of candidateCalls) {
          try {
            const didInject = await attempt();
            if (didInject) {
              injected = true;
              break;
            }
          } catch {
            // Try next available method.
          }
        }
      }

      if (!injected && options.submitTranscriptFallback !== false) {
        submitTranscript(normalized);
      }

      return injected;
    },
    [connect, connected, connecting, submitTranscript],
  );

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
      connect,
      disconnect,
      toggle,
      continueWithPrompt,
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
      connect,
      disconnect,
      toggle,
      continueWithPrompt,
    ]
  );
}
