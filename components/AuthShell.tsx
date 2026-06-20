"use client";
import Image from "next/image";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, justifyContent: "center" }}>
          <Image src="/logo.png" alt="Supreme Art" width={36} height={36} priority style={{ width: 36, height: 36, objectFit: "contain" }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
            Supreme Art <span style={{ color: "var(--brand)" }}>HR</span>
          </span>
        </div>
        <div style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 28,
          boxShadow: "var(--shadow-sm, 0 2px 10px rgba(0,0,0,0.05))",
        }}>
          {children}
        </div>
      </div>

      <style jsx global>{`
        .auth-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 14px;
          background: var(--bg);
          color: var(--text);
          box-sizing: border-box;
          outline: none;
        }
        .auth-input:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(163,45,45,0.15);
        }
        .auth-btn-primary {
          background: var(--brand);
          color: #fff;
          border: none;
          padding: 11px 16px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .auth-btn-primary:hover { background: #7C1F1F; }
        .auth-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-btn-secondary {
          background: var(--bg);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 11px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .auth-field-label {
          font-size: 12px;
          color: var(--text2);
          margin-bottom: 4px;
          font-weight: 600;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          display: block;
        }
      `}</style>
    </div>
  );
}
