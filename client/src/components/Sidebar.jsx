import { useEffect, useState } from "react";
import {
  FiEdit, FiSearch, FiSidebar, FiClock, FiTerminal,
  FiStar, FiSliders, FiUser, FiSettings, FiHelpCircle, FiLogOut,
  FiChevronRight, FiChevronDown, FiTrash2, FiEdit2, FiUpload, FiArchive,
  FiFolder, FiPlus, FiX, FiCheck, FiMoreHorizontal,
} from "react-icons/fi";
import { BsPin, BsPinFill } from "react-icons/bs";
import ArchivedModal from "./ArchivedModal";
import SearchModal from "./SearchModal";
import ScheduledModal from "./ScheduledModal";
import {
  PlusModal, PersonalizationModal, ProfileModal, SettingsModal, HelpModal,
  initials,
} from "./ProfileModals";
import "./Sidebar.css";

export default function Sidebar({
  threads, projects, settings, theme, activeId, collapsed, onToggle,
  onNewChat, onSelect, onDelete, onRename, onPin, onArchive, onShare,
  onRefresh, onCreateProject, onRenameProject, onDeleteProject, onMoveThread,
  onSaveSettings, onThemeChange, onDeleteAll, user, onLogout,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menu, setMenu] = useState(null); // { thread, x, y }
  const [moveOpen, setMoveOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [expanded, setExpanded] = useState({});
  const [toast, setToast] = useState("");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modal, setModal] = useState(null); // plus | personalization | profile | settings | help | scheduled

  // Close the thread menu when clicking anywhere else
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  // Ctrl+K (or Cmd+K) opens search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (collapsed) return null;

  const openModal = (name) => {
    setMenuOpen(false);
    setModal(name);
  };
  const closeModal = () => setModal(null);

  const openMenu = (e, thread) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMoveOpen(false);
    setMenu({
      thread,
      x: r.left,
      y: Math.min(r.bottom + 6, window.innerHeight - 300),
    });
  };

  const startRename = (t) => {
    setRenamingId(t.threadId);
    setRenameValue(t.title);
    setMenu(null);
  };

  const commitRename = () => {
    const t = renamingId;
    setRenamingId(null);
    if (t && renameValue.trim()) onRename(t, renameValue.trim());
  };

  const share = async (t) => {
    setMenu(null);
    const link = await onShare(t.threadId);
    if (!link) return setToast("Could not create link");
    try {
      await navigator.clipboard.writeText(link);
      setToast("Link copied to clipboard");
    } catch {
      setToast(link);
    }
  };

  const remove = (t) => {
    setMenu(null);
    if (window.confirm(`Delete "${t.title}"?`)) onDelete(t.threadId);
  };

  // ---- Projects ----
  const newProject = async () => {
    const name = window.prompt("Project name");
    if (!name || !name.trim()) return null;
    const p = await onCreateProject(name.trim());
    if (!p) setToast("Could not create project");
    return p;
  };

  const moveTo = async (thread, project) => {
    setMenu(null);
    const ok = await onMoveThread(thread.threadId, project ? project._id : null);
    if (!ok) return setToast("Could not move chat");
    if (project) setExpanded((x) => ({ ...x, [project._id]: true }));
    setToast(project ? `Moved to ${project.name}` : "Removed from project");
  };

  const moveToNew = async (thread) => {
    setMenu(null);
    const p = await newProject();
    if (p) await moveTo(thread, p);
  };

  const renameProject = (p) => {
    const name = window.prompt("Rename project", p.name);
    if (name && name.trim()) onRenameProject(p._id, name.trim());
  };

  const deleteProject = (p) => {
    if (window.confirm(`Delete project "${p.name}"? Its chats will go back to Recents.`))
      onDeleteProject(p._id);
  };

  const recents = threads.filter((t) => !t.projectId);
  const userInitials = initials(settings.displayName);

  const renderThread = (t) => (
    <div
      key={t.threadId}
      className={`sb-thread ${t.threadId === activeId ? "active" : ""} ${
        menu?.thread.threadId === t.threadId ? "open" : ""
      }`}
      onClick={() => onSelect(t.threadId)}
    >
      {renamingId === t.threadId ? (
        <input
          className="rename-input"
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenamingId(null);
          }}
        />
      ) : (
        <>
          <span className="sb-thread-title">
            {t.mode === "codex" && <FiTerminal className="sb-mode" />}
            {t.title}
          </span>
          <div className="sb-thread-actions">
            <button
              className="icon-btn sb-dots"
              title="Options"
              onClick={(e) => openMenu(e, t)}
            >
              <FiMoreHorizontal />
            </button>
            {t.pinned && <BsPinFill className="sb-pin" />}
          </div>
        </>
      )}
    </div>
  );

  return (
    <aside className="sidebar">
      <div className="sb-header">
        <span className="sb-logo">ChatBuddy</span>
        <div className="sb-header-icons">
          <button
            className="icon-btn"
            title="Search (Ctrl+K)"
            onClick={() => setSearchOpen(true)}
          >
            <FiSearch />
          </button>
          <button className="icon-btn" title="Close sidebar" onClick={onToggle}>
            <FiSidebar />
          </button>
        </div>
      </div>

      <button className="sb-item sb-new" onClick={() => onNewChat("chat")}>
        <FiEdit /> <span>New chat</span>
      </button>
      <button className="sb-item" onClick={() => openModal("scheduled")}>
        <FiClock /> <span>Scheduled</span>
      </button>
      <button className="sb-item" onClick={() => onNewChat("codex")}>
        <FiTerminal /> <span>Codex</span>
      </button>

      <div className="sb-scroll">
        <div className="sb-section-head">
          <h4 className="sb-heading">Projects</h4>
          <button className="icon-btn" title="New project" onClick={newProject}>
            <FiPlus />
          </button>
        </div>

        {projects.length === 0 && <p className="sb-muted">No projects</p>}
        {projects.map((p) => {
          const chats = threads.filter((t) => t.projectId === p._id);
          const open = !!expanded[p._id];
          return (
            <div key={p._id}>
              <div
                className="proj-row"
                onClick={() => setExpanded((x) => ({ ...x, [p._id]: !open }))}
              >
                {open ? <FiChevronDown /> : <FiChevronRight />}
                <FiFolder />
                <span className="proj-name">{p.name}</span>
                <div className="proj-actions">
                  <button
                    className="icon-btn"
                    title="Rename project"
                    onClick={(e) => { e.stopPropagation(); renameProject(p); }}
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete project"
                    onClick={(e) => { e.stopPropagation(); deleteProject(p); }}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
              {open && (
                <div className="proj-chats">
                  {chats.length === 0 && <p className="sb-muted">No chats yet</p>}
                  {chats.map(renderThread)}
                </div>
              )}
            </div>
          );
        })}

        <h4 className="sb-heading">Recents</h4>
        {recents.map(renderThread)}
      </div>

      {menu && (
        <div className="thread-menu" style={{ top: menu.y, left: menu.x }}>
          <div className="tm-row" onClick={() => startRename(menu.thread)}>
            <FiEdit2 /> Rename
          </div>
          <div
            className="tm-row"
            onClick={() => {
              onPin(menu.thread.threadId, !menu.thread.pinned);
              setMenu(null);
            }}
          >
            {menu.thread.pinned ? <BsPinFill /> : <BsPin />}
            {menu.thread.pinned ? "Unpin" : "Pin"}
          </div>
          <hr />
          <div className="tm-row" onClick={() => share(menu.thread)}>
            <FiUpload /> Share
          </div>
          <hr />
          <div
            className="tm-row"
            onClick={() => {
              onArchive(menu.thread.threadId);
              setMenu(null);
            }}
          >
            <FiArchive /> Archive
          </div>
          <div className="tm-row danger" onClick={() => remove(menu.thread)}>
            <FiTrash2 /> Delete
          </div>
          <hr />
          <div
            className="tm-row tm-move"
            onClick={(e) => {
              e.stopPropagation();
              setMoveOpen((o) => !o);
            }}
          >
            <FiFolder /> Move to project <FiChevronRight className="pm-end" />
            {moveOpen && (
              <div className="submenu" onClick={(e) => e.stopPropagation()}>
                {projects.map((p) => (
                  <div
                    key={p._id}
                    className="tm-row"
                    onClick={() => moveTo(menu.thread, p)}
                  >
                    <FiFolder />
                    <span className="sub-name">{p.name}</span>
                    {menu.thread.projectId === p._id && <FiCheck className="pm-end" />}
                  </div>
                ))}
                {projects.length > 0 && <hr />}
                {menu.thread.projectId && (
                  <div className="tm-row" onClick={() => moveTo(menu.thread, null)}>
                    <FiX /> Remove from project
                  </div>
                )}
                <div className="tm-row" onClick={() => moveToNew(menu.thread)}>
                  <FiPlus /> New project
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onSelect={onSelect}
        />
      )}

      {archivedOpen && (
        <ArchivedModal
          onClose={() => setArchivedOpen(false)}
          onChanged={onRefresh}
        />
      )}

      {modal === "scheduled" && (
        <ScheduledModal
          onClose={closeModal}
          onToast={setToast}
          onRefresh={onRefresh}
          onOpenChat={(id) => {
            onSelect(id);
            closeModal();
          }}
        />
      )}
      {modal === "plus" && <PlusModal onClose={closeModal} onToast={setToast} />}
      {modal === "personalization" && (
        <PersonalizationModal
          settings={settings}
          onSave={onSaveSettings}
          onClose={closeModal}
          onToast={setToast}
        />
      )}
      {modal === "profile" && (
        <ProfileModal
          email={user?.email}
          settings={settings}
          onSave={onSaveSettings}
          onClose={closeModal}
          onToast={setToast}
        />
      )}
      {modal === "settings" && (
        <SettingsModal
          theme={theme}
          onThemeChange={onThemeChange}
          onDeleteAll={onDeleteAll}
          onClose={closeModal}
          onToast={setToast}
        />
      )}
      {modal === "help" && <HelpModal onClose={closeModal} />}

      {menuOpen && (
        <div className="profile-menu">
          <div className="pm-row pm-user" onClick={() => openModal("profile")}>
            <div className="avatar">{userInitials}</div>
            <div className="pm-user-text">
              <b>{settings.displayName}</b><small>Free</small>
            </div>
            <FiChevronRight />
          </div>
          <hr />
          <div className="pm-row" onClick={() => openModal("plus")}>
            <FiStar /> Try Plus free
          </div>
          <div className="pm-row" onClick={() => openModal("personalization")}>
            <FiSliders /> Personalization
          </div>
          <div className="pm-row" onClick={() => openModal("profile")}>
            <FiUser /> Profile
          </div>
          <div className="pm-row" onClick={() => openModal("settings")}>
            <FiSettings /> Settings
          </div>
          <div
            className="pm-row"
            onClick={() => {
              setMenuOpen(false);
              setArchivedOpen(true);
            }}
          >
            <FiArchive /> Archived chats
          </div>
          <hr />
          <div className="pm-row" onClick={() => openModal("help")}>
            <FiHelpCircle /> Help <FiChevronRight className="pm-end" />
          </div>
          <div
            className="pm-row"
            onClick={() => {
              setMenuOpen(false);
              onLogout();
            }}
          >
            <FiLogOut /> Log out
          </div>
        </div>
      )}

      <div className="sb-profile" onClick={() => setMenuOpen((o) => !o)}>
        <div className="avatar">{userInitials}</div>
        <div className="pm-user-text">
          <b>{settings.displayName}</b><small>Free</small>
        </div>
      </div>
    </aside>
  );
}