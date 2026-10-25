import { FiX, FiMic } from "react-icons/fi";
import "./VoiceMode.css";

const LABEL = {
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking... tap to interrupt",
  idle: "Tap to talk",
};

export default function VoiceMode({ state, text, onOrb, onClose }) {
  return (
    <div className="voice-overlay">
      <button className="icon-btn voice-close" onClick={onClose} title="End voice mode">
        <FiX />
      </button>

      <div className="voice-center">
        <button className={`orb ${state}`} onClick={onOrb} aria-label="Voice control">
          <FiMic />
        </button>
        <p className="voice-status">{LABEL[state]}</p>
        <p className="voice-text">{text}</p>
      </div>

      <button className="voice-end" onClick={onClose}>End</button>
    </div>
  );
}