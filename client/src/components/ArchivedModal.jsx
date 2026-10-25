import { useEffect, useState } from "react";
import { FiX, FiTrash2, FiArchive } from "react-icons/fi";
import { MdOutlineUnarchive } from "react-icons/md";
import "./ArchivedModal.css";

const API = import.meta.env.VITE_API_URL;

export default function ArchivedModal({ onClose, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(`${API}/archived`);
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

  const unarchive = async (id) => {
    const res = await fetch(`${API}/thread/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    if (res.ok) {
      setItems((l) => l.filter((x) => x.threadId !== id));
      onChanged(); // refresh the sidebar
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.title}" permanently?`)) return;
    const res = await fetch(`${API}/thread/${t.threadId}`, { method: "DELETE" });
    if (res.ok) {
      setItems((l) => l.filter((x) => x.threadId !== t.threadId));
      onChanged();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Archived chats</h3>
          <button className="icon-btn" onClick={onClose}><FiX /></button>
        </div>

        <div className="modal-body">
          {loading && <p className="modal-empty">Loading...</p>}
          {!loading && items.length === 0 && (
            <div className="modal-empty">
              <FiArchive size={28} />
              <p>No archived chats</p>
            </div>
          )}
          {items.map((t) => (
            <div className="arch-row" key={t.threadId}>
              <div className="arch-text">
                <span className="arch-title">{t.title}</span>
                <small>{new Date(t.updatedAt).toLocaleDateString()}</small>
              </div>
              <button
                className="icon-btn"
                title="Unarchive"
                onClick={() => unarchive(t.threadId)}
              >
                <MdOutlineUnarchive />
              </button>
              <button
                className="icon-btn danger-icon"
                title="Delete"
                onClick={() => remove(t)}
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}