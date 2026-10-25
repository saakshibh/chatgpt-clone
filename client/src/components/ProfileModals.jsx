import { useEffect, useState } from "react";
import { FiX, FiTrash2, FiDownload } from "react-icons/fi";
import "./ArchivedModal.css";
import "./ProfileModals.css";

const API = import.meta.env.VITE_API_URL;

export const initials = (name) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function Modal({ title, onClose, wide, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal ${wide ? "wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body pm-body">{children}</div>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      className={`switch ${on ? "on" : ""}`}
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}

/* ---------------- Try Plus ---------------- */
const PLANS = [
  {
    name: "Free",
    price: "₹0",
    current: true,
    features: [
      "Chat with memory",
      "Limited web search",
      "Image and file understanding",
    ],
  },
  {
    name: "Plus",
    price: "₹499",
    features: [
      "Higher message limits",
      "Longer thinking mode",
      "Priority when busy",
    ],
  },
  {
    name: "Pro",
    price: "₹1,999",
    features: [
      "Everything in Plus",
      "Largest file uploads",
      "Early access to new features",
    ],
  },
];

export function PlusModal({ onClose, onToast }) {
  return (
    <Modal title="Upgrade your plan" onClose={onClose} wide>
      <p className="muted">Demo plans only. No real payment is taken.</p>
      <div className="plans">
        {PLANS.map((p) => (
          <div className={`plan ${p.name === "Plus" ? "featured" : ""}`} key={p.name}>
            <h4>{p.name}</h4>
            <div className="plan-price">
              {p.price}<small> / month</small>
            </div>
            <ul>
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {p.current ? (
              <button className="btn-ghost" disabled>Your current plan</button>
            ) : (
              <button
                className="btn-primary"
                onClick={() => onToast("Payments are not enabled in this demo")}
              >
                Upgrade to {p.name}
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- Personalization ---------------- */
export function PersonalizationModal({ settings, onSave, onClose, onToast }) {
  const [on, setOn] = useState(settings.personalizationOn);
  const [name, setName] = useState(settings.displayName);
  const [about, setAbout] = useState(settings.aboutYou);
  const [instr, setInstr] = useState(settings.customInstructions);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ok = await onSave({
      personalizationOn: on,
      displayName: name.trim() || settings.displayName,
      aboutYou: about,
      customInstructions: instr,
    });
    setSaving(false);
    onToast(ok ? "Personalization saved" : "Could not save");
    if (ok) onClose();
  };

  return (
    <Modal title="Personalization" onClose={onClose}>
      <div className="row-between">
        <div>
          <b>Use my personalization</b>
          <p className="muted">Applied to every new message you send.</p>
        </div>
        <Toggle on={on} onChange={setOn} />
      </div>

      <div className="field top">
        <label>What should ChatBuddy call you?</label>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Anything else ChatBuddy should know about you?</label>
        <textarea
          rows={3}
          maxLength={1000}
          placeholder="Example: 4th year CSE student, learning the MERN stack"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
        <small>{about.length}/1000</small>
      </div>
      <div className="field">
        <label>Custom instructions</label>
        <textarea
          rows={4}
          maxLength={1500}
          placeholder="Example: Keep answers short. Explain code step by step."
          value={instr}
          onChange={(e) => setInstr(e.target.value)}
        />
        <small>{instr.length}/1500</small>
      </div>

      <div className="actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Profile ---------------- */
/* ---------------- Profile ---------------- */
export function ProfileModal({ settings, email, onSave, onClose, onToast }) {
  const [name, setName] = useState(settings.displayName);
  const [saving, setSaving] = useState(false);

  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [conf, setConf] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [recPw, setRecPw] = useState("");
  const [recCode, setRecCode] = useState("");
  const [recBusy, setRecBusy] = useState(false);

  const post = async (path, body) => {
    const res = await fetch(`${API}/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  };

  const save = async () => {
    if (!name.trim()) return onToast("Name cannot be empty");
    setSaving(true);
    const ok = await onSave({ displayName: name.trim() });
    setSaving(false);
    onToast(ok ? "Profile updated" : "Could not save");
    if (ok) onClose();
  };

  const changePassword = async () => {
    if (nw !== conf) return onToast("New passwords do not match");
    setPwBusy(true);
    try {
      await post("change-password", { currentPassword: cur, newPassword: nw });
      setCur(""); setNw(""); setConf("");
      onToast("Password changed");
    } catch (e) {
      onToast(e.message);
    } finally {
      setPwBusy(false);
    }
  };

  const makeCode = async () => {
    setRecBusy(true);
    try {
      const data = await post("recovery-code", { password: recPw });
      setRecCode(data.recoveryCode);
      setRecPw("");
    } catch (e) {
      onToast(e.message);
    } finally {
      setRecBusy(false);
    }
  };

  return (
    <Modal title="Profile" onClose={onClose}>
      <div className="profile-top">
        <div className="avatar big">{initials(name)}</div>
        <div>
          <b>{name || "Your name"}</b>
          <p className="muted">Free plan</p>
        </div>
      </div>

      <div className="field">
        <label>Display name</label>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Email</label>
        <input disabled value={email || ""} />
      </div>
      <div className="actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <h4 className="h-label" style={{ marginTop: 24 }}>Change password</h4>
      <div className="field">
        <input type="password" placeholder="Current password" value={cur}
          onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
      </div>
      <div className="field">
        <input type="password" placeholder="New password (min 8 characters)" value={nw}
          onChange={(e) => setNw(e.target.value)} autoComplete="new-password" />
      </div>
      <div className="field">
        <input type="password" placeholder="Confirm new password" value={conf}
          onChange={(e) => setConf(e.target.value)} autoComplete="new-password" />
      </div>
      <div className="actions">
        <button className="btn-primary" onClick={changePassword}
          disabled={pwBusy || !cur || !nw || !conf}>
          {pwBusy ? "Updating..." : "Update password"}
        </button>
      </div>

      <h4 className="h-label" style={{ marginTop: 24 }}>Recovery code</h4>
      <p className="muted">
        Needed to reset a forgotten password. Making a new code cancels the old one.
      </p>
      {recCode ? (
        <>
          <div className="field top">
            <input readOnly value={recCode}
              style={{ fontFamily: "Consolas, monospace", textAlign: "center" }} />
          </div>
          <p className="muted">Save this code now. It will not be shown again.</p>
        </>
      ) : (
        <>
          <div className="field top">
            <input type="password" placeholder="Enter your password to confirm" value={recPw}
              onChange={(e) => setRecPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="actions">
            <button className="btn-ghost" onClick={makeCode} disabled={recBusy || !recPw}>
              {recBusy ? "Creating..." : "Generate new recovery code"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
/* ---------------- Settings ---------------- */
export function SettingsModal({ theme, onThemeChange, onDeleteAll, onClose, onToast }) {
  const exportData = async () => {
    try {
      const res = await fetch(`${API}/export`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "chatbuddy-export.json";
      a.click();
      URL.revokeObjectURL(url);
      onToast("Export downloaded");
    } catch {
      onToast("Export failed");
    }
  };

  const deleteAll = async () => {
    if (!window.confirm("Delete ALL your chats? This cannot be undone.")) return;
    const ok = await onDeleteAll();
    onToast(ok ? "All chats deleted" : "Could not delete chats");
    if (ok) onClose();
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="row-between">
        <b>Theme</b>
        <select
          className="select"
          value={theme}
          onChange={(e) => onThemeChange(e.target.value)}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="row-between">
        <div>
          <b>Export data</b>
          <p className="muted">Download all your chats as a JSON file.</p>
        </div>
        <button className="btn-ghost" onClick={exportData}>
          <FiDownload /> Export
        </button>
      </div>

      <div className="row-between last">
        <div>
          <b>Delete all chats</b>
          <p className="muted">Removes every chat. Projects are kept.</p>
        </div>
        <button className="btn-danger" onClick={deleteAll}>
          <FiTrash2 /> Delete all
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Help ---------------- */
const FAQ = [
  [
    "How does ChatBuddy remember the conversation?",
    "Every message in a chat is saved and sent back to the model with your next message, so it can refer to earlier turns.",
  ],
  [
    "What do Web search and Think do?",
    "Web search lets the model look things up on Google and list its sources. Think gives it extra time to reason before answering, which helps with puzzles and tricky code.",
  ],
  [
    "Which files can I attach?",
    "Images, PDF, TXT and MD files, up to 5 files of 10 MB each. A file is only sent with the message it is attached to.",
  ],
  [
    "Who can see a shared chat?",
    "Anyone who has the link can read it, but not edit it. Shared chats are read-only copies of the conversation.",
  ],
];

export function HelpModal({ onClose }) {
  return (
    <Modal title="Help" onClose={onClose}>
      <h4 className="h-label">Keyboard shortcuts</h4>
      <div className="row-between"><span>Search chats</span><span><kbd>Ctrl</kbd> + <kbd>K</kbd></span></div>
      <div className="row-between"><span>Send message</span><kbd>Enter</kbd></div>
      <div className="row-between last"><span>Close a popup</span><kbd>Esc</kbd></div>

      <h4 className="h-label">Frequently asked questions</h4>
      <div className="faq">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>

      <p className="muted about">ChatBuddy is built with MongoDB, Express, React and Node, powered by Google Gemini.</p>
    </Modal>
  );
}