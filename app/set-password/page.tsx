"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";

function SetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [state, setState] = useState<"checking" | "valid" | "invalid">("checking");
  const [info, setInfo] = useState<{ purpose?: string; name?: string; email?: string; error?: string }>({});

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setState("invalid"); setInfo({ error: "Missing token" }); return; }
    fetch(`/api/auth/set-password?token=${encodeURIComponent(token)}`)
      .then(async r => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (!ok || !body.valid) { setState("invalid"); setInfo({ error: body.error || "Invalid link" }); }
        else { setState("valid"); setInfo({ purpose: body.purpose, name: body.name, email: body.email }); }
      })
      .catch(() => { setState("invalid"); setInfo({ error: "Failed to validate link" }); });
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    const r = await fetch("/api/auth/set-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const d = await r.json().catch(() => ({}));
    setSubmitting(false);
    if (!r.ok) { setError(d.error || "Failed to set password"); return; }
    router.replace("/");
  }

  return (
    <AuthShell>
      {state === "checking" && <div style={{ color: "var(--text2)", fontSize: 14 }}>Validating link…</div>}

      {state === "invalid" && (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>Link not valid</h1>
          <p style={{ color: "#7C1F1F", fontSize: 13, marginTop: 8 }}>{info.error}</p>
          <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 16 }}>
            Ask your admin for a fresh invite, or request a new reset link.
          </p>
          <button onClick={() => router.replace("/login")} className="auth-btn-primary" style={{ marginTop: 14 }}>
            Go to sign in
          </button>
        </>
      )}

      {state === "valid" && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text)" }}>
            {info.purpose === "invite" ? "Welcome to Supreme Art HR" : "Reset your password"}
          </h1>
          <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>
            {info.purpose === "invite"
              ? <>Hi <b>{info.name}</b> — set a password to finish creating your account.</>
              : <>Set a new password for <b>{info.email}</b>.</>}
          </p>

          <form onSubmit={onSubmit} style={{ marginTop: 22, display: "grid", gap: 12 }}>
            <label>
              <span className="auth-field-label">Password (min 8 characters)</span>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" autoFocus className="auth-input" />
            </label>
            <label>
              <span className="auth-field-label">Confirm password</span>
              <input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className="auth-input" />
            </label>
            {error && <div style={{ color: "#7C1F1F", fontSize: 13 }}>{error}</div>}
            <button type="submit" disabled={submitting} className="auth-btn-primary">
              {submitting ? "Saving…" : info.purpose === "invite" ? "Set password & sign in" : "Set new password"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordInner />
    </Suspense>
  );
}
