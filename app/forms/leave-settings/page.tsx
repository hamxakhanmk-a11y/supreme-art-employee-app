import LeaveSettingsClient from "./LeaveSettingsClient";

export const dynamic = "force-dynamic";

export default function LeaveSettingsPage() {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Leave Settings</h1>
        <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>
          Configure the leave types employees can request. Edit days allowed, mark as paid / unpaid, or add custom types.
        </p>
      </div>
      <LeaveSettingsClient />
    </div>
  );
}
