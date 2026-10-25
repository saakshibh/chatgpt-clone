import { useEffect, useState } from "react";
import {
  FiX, FiPlus, FiTrash2, FiPlay, FiClock, FiChevronDown, FiChevronRight,
  FiMessageSquare,
} from "react-icons/fi";
import Markdown from "./Markdown";
import "./ArchivedModal.css";
import "./ProfileModals.css";
import "./ScheduledModal.css";

const API = import.meta.env.VITE_API_URL;
const json = { "Content-Type": "application/json" };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const describe = (s) =>
  s.frequency === "weekly"
    ? `Every ${DAYS[s.dayOfWeek]} at ${s.time}`
    : `Every day at ${s.time}`;

const EMPTY = {
  name: "",
  prompt: "",
  frequency: "daily",
  time: "09:00",
  dayOfWeek: 1,
  webSearch: false,
};

export default function ScheduledModal({ onClose, onToast, onOpenChat, onRefresh }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [runningId, setRunningId] = useState(null);

  const load = async () => {
    try {
      const res = await fetch(`${API}/schedules`);
      setItems(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const create = async () => {
    if (!form.prompt.trim()) return onToast("Write what ChatBuddy should do");
    setSaving(true);
    try {
      const res = await fetch(`${API}/schedules`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          ...form,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create");
      setForm(EMPTY);
      setCreating(false);
      await load();
      onToast("Scheduled task created");
    } catch (e) {
      onToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s) => {
    const res = await fetch(`${API}/schedules/${s._id}`, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    if (res.ok)
      setItems((l) => l.map((x) => (x._id === s._id ? { ...x, enabled: !s.enabled } : x)));
  };

  const runNow = async (s) => {
    setRunningId(s._id);
    try {
      const res = await fetch(`${API}/schedules/${s._id}/run`, { method: "POST" });
      if (!res.ok) throw new Error();
      await load();
      onRefresh();
      setOpenId(s._id);
      onToast("Run finished");
    } catch {
      onToast("Run failed");
    } finally {
      setRunningId(null);
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete "${s.name}"?`)) return;
    const res = await fetch(`${API}/schedules/${s._id}`, { method: "DELETE" });
    if (res.ok) setItems((l) => l.filter((x) => x._id !== s._id));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Scheduled</h3>
          <div className="head-actions">
            {!creating && (
              <button className="btn-primary small" onClick={() => setCreating(true)}>
                <FiPlus /> New task
              </button>
            )}
            <button className="icon-btn" onClick={onClose}><FiX /></button>
          </div>
        </div>

        <div className="modal-body pm-body">
          {creating && (
            <div className="sched-form">
              <div className="field">
                <label>Name (optional)</label>
                <input
                  value={form.name}
                  maxLength={60}
                  placeholder="Morning tech news"
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="field">
                <label>What should ChatBuddy do?</label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  placeholder="Give me 5 important tech news headlines from today with one line each"
                  value={form.prompt}
                  onChange={(e) => set("prompt", e.target.value)}
                />
              </div>
              <div className="sched-grid">
                <div className="field">
                  <label>Repeat</label>
                  <select
                    className="select"
                    value={form.frequency}
                    onChange={(e) => set("frequency", e.target.value)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                {form.frequency === "weekly" && (
                  <div className="field">
                    <label>Day</label>
                    <select
                      className="select"
                      value={form.dayOfWeek}
                      onChange={(e) => set("dayOfWeek", Number(e.target.value))}
                    >
                      {DAYS.map((d, i) => (
                        <option key={d} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label>Time</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => set("time", e.target.value)}
                  />
                </div>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.webSearch}
                  onChange={(e) => set("webSearch", e.target.checked)}
                />
                Use web search (for news and live info)
              </label>
              <div className="actions">
                <button className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
                <button className="btn-primary" onClick={create} disabled={saving}>
                  {saving ? "Saving..." : "Create"}
                </button>
              </div>
            </div>
          )}

          {loading && <p className="modal-empty">Loading...</p>}
          {!loading && items.length === 0 && !creating && (
            <div className="modal-empty">
              <FiClock size={28} />
              <p>No scheduled tasks yet</p>
              <small>Tasks run only while the server is running.</small>
            </div>
          )}

          {items.map((s) => {
            const open = openId === s._id;
            const last = s.runs?.[0];
            return (
              <div className="sched-item" key={s._id}>
                <div className="sched-row">
                  <button className="icon-btn" onClick={() => setOpenId(open ? null : s._id)}>
                    {open ? <FiChevronDown /> : <FiChevronRight />}
                  </button>
                  <div className="sched-info">
                    <b>{s.name}</b>
                    <small>
                      {describe(s)}
                      {s.webSearch ? " · web search" : ""}
                      {last ? ` · last run ${new Date(last.ranAt).toLocaleString()}` : ""}
                    </small>
                  </div>
                  <button
                    className="icon-btn"
                    title="Run now"
                    disabled={runningId === s._id}
                    onClick={() => runNow(s)}
                  >
                    {runningId === s._id ? "…" : <FiPlay />}
                  </button>
                  <button
                    className={`switch ${s.enabled ? "on" : ""}`}
                    role="switch"
                    aria-checked={s.enabled}
                    title={s.enabled ? "Pause" : "Resume"}
                    onClick={() => toggle(s)}
                  >
                    <span />
                  </button>
                  <button className="icon-btn danger-icon" title="Delete" onClick={() => remove(s)}>
                    <FiTrash2 />
                  </button>
                </div>

                {open && (
                  <div className="sched-runs">
                    <p className="muted">Prompt: {s.prompt}</p>
                    {(!s.runs || s.runs.length === 0) && (
                      <p className="muted">No runs yet. Press ▶ to run it now.</p>
                    )}
                    {s.runs?.map((r) => (
                      <div className={`run ${r.ok ? "" : "failed"}`} key={r._id}>
                        <div className="run-head">
                          <span>{new Date(r.ranAt).toLocaleString()}</span>
                          {r.threadId && (
                            <button className="btn-ghost small" onClick={() => onOpenChat(r.threadId)}>
                              <FiMessageSquare /> Open as chat
                            </button>
                          )}
                        </div>
                        <div className="run-text msg model">
                          <Markdown>{r.text}</Markdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}