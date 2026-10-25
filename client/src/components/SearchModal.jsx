import { useEffect, useState } from "react";
import { FiSearch, FiX, FiMessageSquare } from "react-icons/fi";
import "./ArchivedModal.css";
import "./SearchModal.css";

const API = import.meta.env.VITE_API_URL;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Wraps matches in <mark> for display
function Highlight({ text, query }) {
  if (!query.trim() || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query.trim())})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={i}>{p}</mark>
        ) : (
          p
        )
      )}
    </>
  );
}

export default function SearchModal({ onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search 300ms after the user stops typing
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (id) => {
    onSelect(id);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-top">
          <FiSearch />
          <input
            autoFocus
            placeholder="Search chats..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="icon-btn" onClick={onClose}><FiX /></button>
        </div>

        <div className="modal-body">
          {!query.trim() && !loading && results.length > 0 && (
            <p className="search-label">Recent</p>
          )}
          {loading && results.length === 0 && (
            <p className="modal-empty">Searching...</p>
          )}
          {!loading && results.length === 0 && (
            <div className="modal-empty">
              <FiSearch size={28} />
              <p>{query.trim() ? "No chats found" : "No chats yet"}</p>
            </div>
          )}
          {results.map((r) => (
            <div className="search-row" key={r.threadId} onClick={() => pick(r.threadId)}>
              <FiMessageSquare />
              <div className="search-text">
                <span className="search-title">
                  <Highlight text={r.title} query={query} />
                </span>
                {r.snippet && (
                  <small>
                    <Highlight text={r.snippet} query={query} />
                  </small>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}