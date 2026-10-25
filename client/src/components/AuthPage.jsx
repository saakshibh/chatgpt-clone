import { useState } from "react";
import "./AuthPage.css";

const API = import.meta.env.VITE_API_URL;

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // register result, waiting for "I saved it"
  const [newCode, setNewCode] = useState(""); // code shown after a password reset
  const [copied, setCopied] = useState(false);

  const switchTo = (m) => {
    setMode(m);
    setError("");
    setPassword("");
    setCode("");
    setNewCode("");
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const path = mode === "forgot" ? "forgot-reset" : mode;
      const res = await fetch(`${API}/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      if (mode === "register") setPending(data);
      else if (mode === "forgot") setNewCode(data.recoveryCode);
      else onAuth(data.token, data.user);
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Cannot reach the server" : err.message);
    } finally {
      setBusy(false);
    }
  };

  // After sign up: show the recovery code once
  if (pending) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Save your recovery code</h1>
          <p className="auth-sub">
            If you ever forget your password, this code is the only way to reset it.
            It is shown once, so save it now.
          </p>
          <div className="code-box">{pending.recoveryCode}</div>
          <button className="auth-ghost" onClick={() => copy(pending.recoveryCode)}>
            {copied ? "Copied" : "Copy code"}
          </button>
          <button
            className="auth-submit"
            onClick={() => onAuth(pending.token, pending.user)}
          >
            I have saved it, continue
          </button>
        </div>
      </div>
    );
  }

  // After a reset: show the new code
  if (newCode) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Password updated</h1>
          <p className="auth-sub">
            Your old recovery code has been used up. Save your new one:
          </p>
          <div className="code-box">{newCode}</div>
          <button className="auth-ghost" onClick={() => copy(newCode)}>
            {copied ? "Copied" : "Copy code"}
          </button>
          <button className="auth-submit" onClick={() => switchTo("login")}>
            Go to log in
          </button>
        </div>
      </div>
    );
  }

  const register = mode === "register";
  const forgot = mode === "forgot";

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>ChatBuddy</h1>
        <p className="auth-sub">
          {forgot ? "Reset your password" : register ? "Create your account" : "Welcome back"}
        </p>

        {register && (
          <input
            placeholder="Your name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        {forgot && (
          <input
            placeholder="Recovery code (A1B2C-D3E4F-...)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            required
          />
        )}
        <input
          type="password"
          placeholder={
            forgot ? "New password (min 8 characters)" : register ? "Password (min 8 characters)" : "Password"
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />

        {mode === "login" && (
          <button type="button" className="auth-link" onClick={() => switchTo("forgot")}>
            Forgot password?
          </button>
        )}

        {error && <div className="auth-error">{error}</div>}

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? "Please wait..." : forgot ? "Reset password" : register ? "Sign up" : "Log in"}
        </button>

        <p className="auth-switch">
          {forgot ? (
            <button type="button" onClick={() => switchTo("login")}>Back to log in</button>
          ) : (
            <>
              {register ? "Already have an account?" : "New here?"}{" "}
              <button type="button" onClick={() => switchTo(register ? "login" : "register")}>
                {register ? "Log in" : "Create an account"}
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}