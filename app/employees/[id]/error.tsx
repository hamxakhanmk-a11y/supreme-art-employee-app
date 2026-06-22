"use client";
import { useEffect } from "react";

export default function EmployeeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{ padding: 40, fontFamily: "monospace" }}>
      <h2 style={{ color: "red" }}>Something went wrong on this page</h2>
      <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 13 }}>
        {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      <button onClick={reset} style={{ marginTop: 16, padding: "8px 20px", cursor: "pointer" }}>Try again</button>
    </div>
  );
}
