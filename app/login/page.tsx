"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.authenticated) router.replace(next);
      else if (d.needsSetup) router.replace("/setup");
      setEmailConfigured(!!d.emailConfigured);
    }).catch(() => {});
  }, [router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const r = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json().catch(() => ({}));
    setSubmitting(false);
    if (!r.ok) { setError(d.error || "Login failed"); return; }
    router.replace(next);
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/auth/forgot-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail }),
    });
    setForgotSent(true);
  }

  return (
    <AuthShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text)" }}>Sign in</h1>
      <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>Supreme Art HR Portal</p>

      <form onSubmit={onSubmit} style={{ marginTop: 22, display: "grid", gap: 12 }}>
        <label>
          <span className="auth-field-label">Email</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            autoComplete="email" autoFocus className="auth-input" />
        </label>
        <label>
          <span className="auth-field-label">Password</span>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" className="auth-input" />
        </label>
        {error && <div style={{ color: "#7C1F1F", fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={submitting} className="auth-btn-primary">
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <button type="button" onClick={() => setForgotOpen(true)}
          style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 4 }}>
          Forgot password?
        </button>
      </form>

      {forgotOpen && (
        <div style={{ marginTop: 18, padding: 14, border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg2)" }}>
          {forgotSent ? (
            <div style={{ fontSize: 13, color: "var(--text)" }}>
              If an account with that email exists{emailConfigured === false ? " (and email is configured)" : ""},
              a reset link has been sent. Check your inbox.
            </div>
          ) : (
            <form onSubmit={onForgot} style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, color: "var(--text)" }}>Enter your email to receive a reset link.</div>
              <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                placeholder="you@example.com" className="auth-input" />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="auth-btn-primary" style={{ flex: 1 }}>Send reset link</button>
                <button type="button" onClick={() => setForgotOpen(false)} className="auth-btn-secondary">Cancel</button>
              </div>
              {emailConfigured === false && (
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  Note: email delivery isn't set up yet. Ask your admin to send you a reset link directly.
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </AuthShell>
  );
}
