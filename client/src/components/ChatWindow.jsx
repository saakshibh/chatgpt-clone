import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import VoiceMode from "./VoiceMode";
import { PulseLoader } from "react-spinners";
import {
  FiSidebar, FiPlus, FiMic, FiArrowUp, FiPaperclip, FiGlobe, FiX,
  FiSquare, FiTerminal, FiVolume2, FiVolumeX,
} from "react-icons/fi";
import { TbBrain } from "react-icons/tb";
import { BsSoundwave } from "react-icons/bs";
import {
  VOICE_LANG, speechRecognitionSupported, ttsSupported,
  createRecognizer, speak, stopSpeaking,
} from "../utils/speech";
import "./ChatWindow.css";

const API = import.meta.env.VITE_API_URL;
const MAX_FILES = 5;

const CODEX_STARTERS = [
  "Write a REST API in Express with JWT auth",
  "Explain this error and fix it",
  "Review my code for bugs and improvements",
  "Solve a LeetCode problem step by step",
];

export default function ChatWindow({ threadId, mode, collapsed, onToggle, onSent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState("");

  // Voice
  const [listening, setListening] = useState(false); // dictation (mic button)
  const [speakingIdx, setSpeakingIdx] = useState(null); // read-aloud message
  const [voiceOpen, setVoiceOpen] = useState(false); // voice mode overlay
  const [voiceState, setVoiceState] = useState("listening");
  const [voiceText, setVoiceText] = useState("");

  const bottomRef = useRef(null);
  const currentId = useRef(threadId);
  const fileInput = useRef(null);
  const abortRef = useRef(null);
  const dictRef = useRef(null);
  const baseInput = useRef("");
  const recRef = useRef(null);
  const voiceActive = useRef(false);
  const silentTurns = useRef(0);
  const sendRef = useRef(null);

  const isCodex = mode === "codex";

  const stopDictation = () => {
    const r = dictRef.current;
    if (!r) return;
    dictRef.current = null;
    setListening(false);
    try { r.abort(); } catch {}
  };

  // Load history whenever the active thread changes
  useEffect(() => {
    abortRef.current?.abort(); // cancel a running stream when switching chats
    stopDictation();
    stopSpeaking();
    setSpeakingIdx(null);
    currentId.current = threadId;
    let cancelled = false;
    setMessages([]);
    setInput("");
    setLoading(false);
    setFiles([]);
    (async () => {
      try {
        const res = await fetch(`${API}/thread/${threadId}`);
        if (res.ok && !cancelled) setMessages(await res.json());
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [threadId]);

  // Stop any speech or microphone when leaving the page
  useEffect(() => () => {
    stopSpeaking();
    voiceActive.current = false;
    try { recRef.current?.abort(); } catch {}
    try { dictRef.current?.abort(); } catch {}
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Close the + menu on any outside click
  useEffect(() => {
    if (!plusOpen) return;
    const close = () => setPlusOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [plusOpen]);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 3500);
    return () => clearTimeout(id);
  }, [note]);

  const onPickFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    const tooBig = picked.find((f) => f.size > 10 * 1024 * 1024);
    if (tooBig) setNote(`${tooBig.name} is larger than 10 MB`);
    const ok = picked.filter((f) => f.size <= 10 * 1024 * 1024);
    setFiles((f) => [...f, ...ok].slice(0, MAX_FILES));
    e.target.value = "";
  };

  // Sends a message. Pass a string to send it by voice. Returns the full reply.
  const send = async (override) => {
    const fromVoice = typeof override === "string";
    const text = (fromVoice ? override : input).trim();
    if (!text || loading) return "";

    stopDictation();
    stopSpeaking();
    setSpeakingIdx(null);

    const id = threadId;
    const sentFiles = fromVoice ? [] : files;
    if (!fromVoice) {
      setInput("");
      setFiles([]);
    }
    setMessages((m) => [
      ...m,
      {
        role: "user",
        content: text,
        attachments: sentFiles.map((f) => ({ name: f.name })),
      },
      { role: "model", content: "" }, // filled in as chunks arrive
    ]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const updateLast = (fn) =>
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });

    let reply = "";
    try {
      const form = new FormData();
      form.append("threadId", id);
      form.append("message", text);
      form.append("mode", mode);
      form.append("voice", String(fromVoice));
      form.append("webSearch", String(webSearch));
      form.append("thinking", String(thinking));
      sentFiles.forEach((f) => form.append("files", f));

      // No Content-Type header: the browser sets the multipart boundary
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) {
        let msg = "Something went wrong. Please try again.";
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        reply += chunk;
        if (currentId.current === id) {
          updateLast((last) => ({ ...last, content: last.content + chunk }));
        }
      }
    } catch (e) {
      if (e.name !== "AbortError" && currentId.current === id) {
        updateLast((last) => ({
          ...last,
          content: last.content || `⚠️ ${e.message}`,
        }));
      }
    } finally {
      if (currentId.current === id) {
        setLoading(false);
        abortRef.current = null;
        onSent();
        setTimeout(onSent, 3000); // refresh again once the generated title is saved
      }
    }
    return reply;
  };
  sendRef.current = send;

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ---------- Dictation (mic button) ----------
  const toggleDictation = () => {
    if (!speechRecognitionSupported) {
      return setNote("Voice input isn't supported in this browser. Try Chrome or Edge.");
    }
    if (listening) {
      dictRef.current?.stop(); // onEnd puts the final text in the input
      return;
    }
    baseInput.current = input ? input.trimEnd() + " " : "";
    const rec = createRecognizer({
      lang: VOICE_LANG,
      continuous: true,
      onInterim: (t) => {
        if (dictRef.current === rec) setInput(baseInput.current + t);
      },
      onError: (e) => {
        if (dictRef.current !== rec) return;
        if (e === "not-allowed" || e === "service-not-allowed")
          setNote("Microphone is blocked. Allow it in the browser address bar.");
        else if (e === "network") setNote("Voice input needs an internet connection");
        else if (e === "no-speech") setNote("Didn't hear anything");
      },
      onEnd: (t) => {
        if (dictRef.current !== rec) return;
        dictRef.current = null;
        setListening(false);
        if (t) setInput(baseInput.current + t);
      },
    });
    dictRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      dictRef.current = null;
      setListening(false);
    }
  };

  // ---------- Read aloud ----------
  const readAloud = (i, text) => {
    if (speakingIdx === i) {
      stopSpeaking();
      setSpeakingIdx(null);
      return;
    }
    setSpeakingIdx(i);
    speak(text, { lang: VOICE_LANG, onEnd: () => setSpeakingIdx(null) });
  };

  // ---------- Voice mode ----------
  const closeVoice = () => {
    voiceActive.current = false;
    const r = recRef.current;
    recRef.current = null;
    try { r?.abort(); } catch {}
    stopSpeaking();
    setVoiceOpen(false);
  };

  const handleVoiceTurn = async (text) => {
    setVoiceState("thinking");
    setVoiceText(text);
    const reply = await sendRef.current(text);
    if (!voiceActive.current) return;
    if (!reply) {
      setVoiceState("idle");
      setVoiceText("Something went wrong. Tap the orb to try again.");
      return;
    }
    setVoiceState("speaking");
    setVoiceText("");
    speak(reply, {
      lang: VOICE_LANG,
      onEnd: () => {
        if (voiceActive.current) startListening();
      },
    });
  };

  const startListening = () => {
    if (!voiceActive.current) return;
    setVoiceState("listening");
    setVoiceText("");
    let err = "";
    const rec = createRecognizer({
      lang: VOICE_LANG,
      continuous: false,
      onInterim: (t) => {
        if (voiceActive.current) setVoiceText(t);
      },
      onError: (e) => { err = e; },
      onEnd: (text) => {
        if (recRef.current !== rec) return; // replaced or aborted
        recRef.current = null;
        if (!voiceActive.current) return;

        if (err === "not-allowed" || err === "service-not-allowed") {
          closeVoice();
          setNote("Microphone is blocked. Allow it in the browser address bar.");
          return;
        }
        if (text) {
          silentTurns.current = 0;
          handleVoiceTurn(text);
          return;
        }
        if (err === "aborted") return;
        if (err === "network") {
          setVoiceState("idle");
          setVoiceText("Can't reach the speech service. Check your internet.");
          return;
        }
        silentTurns.current += 1;
        if (silentTurns.current >= 3) {
          setVoiceState("idle");
          setVoiceText("I didn't hear anything. Tap the orb to talk.");
          return;
        }
        startListening(); // quiet for a moment: listen again
      },
    });
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setVoiceState("idle");
    }
  };

  const startVoiceMode = () => {
    if (!speechRecognitionSupported) {
      return setNote("Voice mode needs Chrome or Edge.");
    }
    stopDictation();
    stopSpeaking();
    setSpeakingIdx(null);
    voiceActive.current = true;
    silentTurns.current = 0;
    setVoiceOpen(true);
    startListening();
  };

  const onOrb = () => {
    if (voiceState === "listening") {
      recRef.current?.stop(); // finish and send what was heard
    } else if (voiceState === "speaking") {
      stopSpeaking(); // interrupt the answer and talk again
      startListening();
    } else if (voiceState === "idle") {
      silentTurns.current = 0;
      startListening();
    }
  };

  const renderComposer = (openUp) => (
    <div className="composer-box">
      {files.length > 0 && (
        <div className="chips">
          {files.map((f, i) => (
            <div className="chip" key={f.name + i}>
              {f.type.startsWith("image/") ? (
                <img className="chip-thumb" src={URL.createObjectURL(f)} alt="" />
              ) : (
                <FiPaperclip />
              )}
              <span>{f.name}</span>
              <button
                className="icon-btn"
                onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
              >
                <FiX />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="composer">
        <button
          className="icon-btn plus-btn"
          onClick={(e) => {
            e.stopPropagation();
            setPlusOpen((o) => !o);
          }}
        >
          <FiPlus />
        </button>
        <input
          placeholder={
            listening
              ? "Listening..."
              : isCodex
              ? "Describe a coding task"
              : "Ask ChatBuddy"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {webSearch && (
          <button className="pill-on" onClick={() => setWebSearch(false)}>
            <FiGlobe /> Search <FiX />
          </button>
        )}
        <button
          className={`think ${thinking ? "on" : ""}`}
          onClick={() => setThinking((t) => !t)}
        >
          <TbBrain /> Think
        </button>
        <button
          className={`icon-btn ${listening ? "mic-on" : ""}`}
          title={listening ? "Stop dictation" : "Dictate"}
          onClick={toggleDictation}
        >
          <FiMic />
        </button>
        {loading ? (
          <button className="send-voice" onClick={() => abortRef.current?.abort()}>
            <FiSquare />
          </button>
        ) : input.trim() ? (
          <button className="send-voice" onClick={() => send()}>
            <FiArrowUp />
          </button>
        ) : (
          <button className="send-voice" title="Voice mode" onClick={startVoiceMode}>
            <BsSoundwave />
          </button>
        )}
      </div>

      {plusOpen && (
        <div className={`plus-menu ${openUp ? "up" : "down"}`}>
          <div className="pl-row" onClick={() => fileInput.current?.click()}>
            <FiPaperclip /> <b>Add photos & files</b>
            <span>Upload from computer</span>
          </div>
          <div className="pl-row" onClick={() => setWebSearch((w) => !w)}>
            <FiGlobe className={webSearch ? "blue" : "blue-dim"} />
            <b>Web search</b>
            <span>Find real-time news and info</span>
            {webSearch && <em>On</em>}
          </div>
          <div className="pl-row" onClick={() => setThinking((t) => !t)}>
            <TbBrain /> <b>Thinking</b>
            <span>For detailed answers</span>
            {thinking && <em>On</em>}
          </div>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        accept="image/*,.pdf,.txt,.md"
        onChange={onPickFiles}
      />
    </div>
  );

  const empty = messages.length === 0;

  return (
    <main className="chat">
      <div className="chat-top">
        {collapsed ? (
          <button className="icon-btn" onClick={onToggle}><FiSidebar /></button>
        ) : <span />}
        {isCodex ? (
          <span className="mode-badge"><FiTerminal /> Codex</span>
        ) : <span />}
      </div>

      {empty ? (
        <div className="chat-center">
          <h1>{isCodex ? "What are we building?" : "What’s on the agenda today?"}</h1>
          {renderComposer(false)}
          {isCodex && (
            <div className="starters">
              {CODEX_STARTERS.map((s) => (
                <button className="starter" key={s} onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="messages">
            <div className="messages-inner">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="msg-user-wrap">
                    {m.attachments?.length > 0 && (
                      <div className="chips right">
                        {m.attachments.map((a, j) => (
                          <div className="chip sent" key={j}>
                            <FiPaperclip /> <span>{a.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="msg user"><p>{m.content}</p></div>
                  </div>
                ) : (
                  <div key={i} className="msg model">
                    {m.content ? (
                      <Markdown>{m.content}</Markdown>
                    ) : (
                      loading && <PulseLoader color="#888" size={8} />
                    )}
                    {m.content &&
                      ttsSupported &&
                      !(loading && i === messages.length - 1) && (
                        <div className="msg-actions">
                          <button
                            className="icon-btn"
                            title={speakingIdx === i ? "Stop reading" : "Read aloud"}
                            onClick={() => readAloud(i, m.content)}
                          >
                            {speakingIdx === i ? <FiVolumeX /> : <FiVolume2 />}
                          </button>
                        </div>
                      )}
                  </div>
                )
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="composer-wrap">{renderComposer(true)}</div>
        </>
      )}

      {voiceOpen && (
        <VoiceMode
          state={voiceState}
          text={voiceText}
          onOrb={onOrb}
          onClose={closeVoice}
        />
      )}

      {note && <div className="toast">{note}</div>}
    </main>
  );
}