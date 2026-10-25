import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./ChatWindow.css";

const API = import.meta.env.VITE_API_URL;

export default function SharedChat({ shareId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API}/share/${shareId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, [shareId]);

  return (
    <div className="shared">
      <div className="messages-inner">
        {error && <p>This shared chat doesn't exist.</p>}
        {data && (
          <>
            <h2>{data.title}</h2>
            {data.messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="msg user"><p>{m.content}</p></div>
              ) : (
                <div key={i} className="msg model">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )
            )}
            <a className="shared-cta" href="/">Start your own chat →</a>
          </>
        )}
      </div>
    </div>
  );
}