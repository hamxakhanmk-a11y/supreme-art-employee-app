"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCanEdit } from "@/components/MeProvider";

export default function DeleteEmployeeButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const canDelete = useCanEdit("employees.delete");

  const handle = async () => {
    if (!confirm("Delete this employee permanently? This cannot be undone.")) return;
    setBusy(true);
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/employees");
      router.refresh();
    } else {
      alert("Delete failed");
      setBusy(false);
    }
  };

  if (!canDelete) return null;
  return (
    <button className="btn btn-danger-soft" disabled={busy} onClick={handle}>
      {busy ? "Deleting…" : "🗑 Delete"}
    </button>
  );
}
