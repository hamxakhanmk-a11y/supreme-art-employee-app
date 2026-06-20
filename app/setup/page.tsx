"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/AuthShell";

export default function SetupPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.authenticated) { router.replace("/"); return; }
      if (!d.needsSetup) { router.replace("/login"); return; }
      setAllowed(true);
    }).catch(() => {});
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    const r = await fetch("/api/auth/setup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const d = await r.json().catch(() => ({}));
    setSubmitting(false);
    if (!r.ok) { setError(d.error || "Setup failed"); return; }
    router.replace("/");
  }

  if (allowed === null) return null;

  return (
    <AuthShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text)" }}>Create admin account</h1>
      <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>
        First-time setup — you'll be the first admin of this Supreme Art HR portal.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 22, display: "grid", gap: 12 }}>
        <label>
          <span className="auth-field-label">Your name</span>
          <input required value={name} onChange={e => setName(e.target.value)} autoFocus className="auth-input" />
        </label>
        <label>
          <span className="auth-field-label">Email</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="auth-input" />
        </label>
        <label>
          <span className="auth-field-label">Password (min 8 characters)</span>
          <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="auth-input" />
        </label>
        <label>
          <span className="auth-field-label">Confirm password</span>
          <input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className="auth-input" />
        </label>
        {error && <div style={{ color: "#7C1F1F", fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={submitting} className="auth-btn-primary">
          {submitting ? "Creating…" : "Create admin account"}
        </button>
      </form>
    </AuthShell>
  );
}
