import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import SharedChat from "./components/SharedChat";
import AuthPage from "./components/AuthPage";
import { getToken, setToken, clearToken } from "./utils/auth";
import "./App.css";


const API = import.meta.env.VITE_API_URL;
const json = { "Content-Type": "application/json" };

const DEFAULT_SETTINGS = {
  displayName: "",
  aboutYou: "",
  customInstructions: "",
  personalizationOn: true,
};

// Theme: "system" | "light" | "dark", remembered in localStorage
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved = theme === "system" ? (mq.matches ? "light" : "dark") : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    try {
      localStorage.setItem("theme", theme);
    } catch {}
    if (theme !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return [theme, setTheme];
}

function ChatApp({ user, onLogout, theme, onThemeChange }) {
  const [threads, setThreads] = useState([]);
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, displayName: user.name });
  const [activeId, setActiveId] = useState(uuidv4());
  const [newMode, setNewMode] = useState("chat"); // mode of a not-yet-saved chat
  const [collapsed, setCollapsed] = useState(false);

  // Saved chats know their own mode; a brand-new chat uses newMode
  const activeThread = threads.find((t) => t.threadId === activeId);
  const mode = activeThread ? activeThread.mode || "chat" : newMode;

  const loadThreads = async () => {
    try {
      const res = await fetch(`${API}/thread`);
      if (res.ok) setThreads(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await fetch(`${API}/projects`);
      if (res.ok) setProjects(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API}/settings`);
      if (res.ok) setSettings(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadThreads();
    loadProjects();
    loadSettings();
  }, []);

  const newChat = (m = "chat") => {
    setActiveId(uuidv4());
    setNewMode(m === "codex" ? "codex" : "chat");
  };

  const selectThread = (id) => {
    setActiveId(id);
    setNewMode("chat");
  };

  const deleteThread = async (id) => {
    await fetch(`${API}/thread/${id}`, { method: "DELETE" });
    setThreads((t) => t.filter((x) => x.threadId !== id));
    if (id === activeId) newChat();
  };

  const patchThread = async (id, body) => {
    const res = await fetch(`${API}/thread/${id}`, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify(body),
    });
    if (res.ok) await loadThreads();
    return res.ok;
  };

  const renameThread = (id, title) => patchThread(id, { title });
  const pinThread = (id, pinned) => patchThread(id, { pinned });
  const archiveThread = async (id) => {
    if ((await patchThread(id, { archived: true })) && id === activeId) newChat();
  };

  const shareThread = async (id) => {
    const res = await fetch(`${API}/thread/${id}/share`, { method: "POST" });
    if (!res.ok) return null;
    const { shareId } = await res.json();
    return `${window.location.origin}/share/${shareId}`;
  };

  // ---- Projects ----
  const createProject = async (name) => {
    const res = await fetch(`${API}/projects`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const project = await res.json();
    await loadProjects();
    return project;
  };

  const renameProject = async (id, name) => {
    const res = await fetch(`${API}/projects/${id}`, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ name }),
    });
    if (res.ok) await loadProjects();
  };

  const deleteProject = async (id) => {
    const res = await fetch(`${API}/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadProjects();
      await loadThreads();
    }
  };

  const moveThread = async (threadId, projectId) => {
    const res = await fetch(`${API}/projects/move`, {
      method: "PUT",
      headers: json,
      body: JSON.stringify({ threadId, projectId }),
    });
    if (res.ok) await loadThreads();
    return res.ok;
  };

  // ---- Settings ----
  const saveSettings = async (patch) => {
    try {
      const res = await fetch(`${API}/settings`, {
        method: "PUT",
        headers: json,
        body: JSON.stringify(patch),
      });
      if (!res.ok) return false;
      setSettings(await res.json());
      return true;
    } catch {
      return false;
    }
  };

  const deleteAllChats = async () => {
    try {
      const res = await fetch(`${API}/all-chats`, { method: "DELETE" });
      if (!res.ok) return false;
      setThreads([]);
      newChat();
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="app">
      <Sidebar
        user={user}
        onLogout={onLogout}
        threads={threads}
        projects={projects}
        settings={settings}
        theme={theme}
        activeId={activeId}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        onNewChat={newChat}
        onSelect={selectThread}
        onDelete={deleteThread}
        onRename={renameThread}
        onPin={pinThread}
        onArchive={archiveThread}
        onShare={shareThread}
        onRefresh={loadThreads}
        onCreateProject={createProject}
        onRenameProject={renameProject}
        onDeleteProject={deleteProject}
        onMoveThread={moveThread}
        onSaveSettings={saveSettings}
        onThemeChange={onThemeChange}
        onDeleteAll={deleteAllChats}
      />
      <ChatWindow
        threadId={activeId}
        mode={mode}
        collapsed={collapsed}
        onToggle={() => setCollapsed(false)}
        onSent={loadThreads}
      />
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useTheme();
  const shareMatch = window.location.pathname.match(/^\/share\/(.+)$/);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!shareMatch && !!getToken());

  // Restore the session on page load
  useEffect(() => {
    if (shareMatch || !getToken()) return;
    (async () => {
      try {
        const res = await fetch(`${API}/auth/me`);
        if (res.ok) setUser((await res.json()).user);
        else clearToken();
      } catch (e) {
        console.error(e);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  // The server says the token is no longer valid
  useEffect(() => {
    const onExpired = () => {
      clearToken();
      setUser(null);
    };
    window.addEventListener("auth-expired", onExpired);
    return () => window.removeEventListener("auth-expired", onExpired);
  }, []);

  const onAuth = (token, u) => {
    setToken(token);
    setUser(u);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };
  
  if (shareMatch) return <SharedChat shareId={shareMatch[1]} />;
  if (checking) return <div className="auth-wrap">Loading...</div>;
  if (!user) return <AuthPage onAuth={onAuth} />;

  return (
    <ChatApp
      key={user.id}
      user={user}
      onLogout={logout}
      theme={theme}
      onThemeChange={setTheme}
    />
  );
}