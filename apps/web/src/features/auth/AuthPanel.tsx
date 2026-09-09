import { useEffect, useRef, useState, type FormEvent } from "react";
import { HttpApiError } from "../../api/http-api";
import type { AuthErrorCode } from "../../api/schemawise-contracts";
import { useAuth } from "./auth-context";

const ERROR_COPY: Partial<Record<AuthErrorCode, string>> = {
  INVALID_AUTH_REQUEST: "Check your email and password, then try again.",
  EMAIL_ALREADY_EXISTS: "An account already exists for this email. Sign in instead.",
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  UNAUTHENTICATED: "Your session is no longer active. Sign in again.",
  AUTH_RATE_LIMITED: "Too many attempts. Please wait before trying again.",
  AUTH_INTERNAL_ERROR: "Authentication is temporarily unavailable. Try again.",
  INVALID_CSRF_TOKEN: "The security check failed. Please try again.",
};

function messageFor(error: unknown): string {
  if (error instanceof HttpApiError) {
    if (error.kind === "network") return "We couldn't reach SchemaWise. Check your connection and try again.";
    if (error.code) return ERROR_COPY[error.code as AuthErrorCode] ?? "Authentication failed. Try again.";
  }
  return "Authentication failed. Try again.";
}

export function AuthPanel({ onClose }: { onClose(): void }) {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(undefined);
    try {
      const response = mode === "login" ? await auth.api.login(email, password) : await auth.api.register(email, password);
      auth.setAuthenticated(response);
      onClose();
    } catch (caught) { setError(messageFor(caught)); }
    finally { setBusy(false); }
  }

  return (
    <section className="transient-panel auth-panel" aria-labelledby="auth-heading">
      <div className="panel-heading">
        <div><p className="eyebrow">Account</p><h2 id="auth-heading">{mode === "login" ? "Sign in to save" : "Create your account"}</h2></div>
        <button className="button button--quiet" type="button" onClick={onClose} aria-label="Close authentication">Close</button>
      </div>
      <p>Your workspace will stay exactly as it is.</p>
      <div className="button-row auth-mode" role="group" aria-label="Authentication mode">
        <button className={`button ${mode === "login" ? "button--primary" : "button--secondary"}`} type="button" onClick={() => { setMode("login"); setError(undefined); }}>Sign in</button>
        <button className={`button ${mode === "register" ? "button--primary" : "button--secondary"}`} type="button" onClick={() => { setMode("register"); setError(undefined); }}>Create account</button>
      </div>
      <form className="auth-form" onSubmit={submit} aria-busy={busy}>
        <label htmlFor="auth-email">Email</label>
        <input ref={emailRef} id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="auth-password">Password</label>
        <input id="auth-password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={mode === "register" ? "password-policy" : undefined} />
        {mode === "register" ? <p id="password-policy" className="field-help">Use 12–128 characters. No symbol or composition rules.</p> : null}
        {error ? <p className="panel-error" role="alert">{error}</p> : null}
        <button className="button button--primary" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
    </section>
  );
}
