"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";

const ERRORS: Record<string, string> = {
  not_allowed: "That Google account isn't authorized for this portal. Ask an admin to add your email.",
  disabled: "Your account has been disabled. Contact an administrator.",
  unverified: "Your Google email isn't verified. Verify it with Google and try again.",
  not_configured: "Google sign-in isn't set up yet. Ask the administrator to configure it.",
  denied: "Sign-in was cancelled.",
  state: "Your sign-in session expired. Please try again.",
  exchange: "Couldn't complete sign-in with Google. Please try again.",
  invalid: "Something went wrong with the sign-in request. Please try again.",
};

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const errorCode = params.get("error");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.authenticated) router.replace(next);
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [router, next]);

  const startUrl = `/api/auth/google/start?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text)" }}>Sign in</h1>
      <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>Supreme Art HR Portal</p>

      {errorCode && (
        <div style={{
          marginTop: 18, padding: "10px 14px", background: "#FEF2F2",
          border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 13, color: "#7C1F1F",
        }}>
          {ERRORS[errorCode] || "Sign-in failed. Please try again."}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        {checking ? (
          <div style={{ color: "var(--text2)", fontSize: 13 }}>Checking your session…</div>
        ) : (
          <a href={startUrl} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            width: "100%", padding: "12px 16px", borderRadius: 10,
            border: "1px solid var(--border)", background: "#fff", color: "#3c4043",
            fontWeight: 600, fontSize: 15, textDecoration: "none", cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          }}>
            <GoogleG />
            Sign in with Google
          </a>
        )}
      </div>

      <p style={{ color: "var(--text2)", fontSize: 12, marginTop: 18, lineHeight: 1.5 }}>
        Access is restricted to approved accounts. If you cannot get in, ask an administrator to add your Google email.
      </p>
    </AuthShell>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
