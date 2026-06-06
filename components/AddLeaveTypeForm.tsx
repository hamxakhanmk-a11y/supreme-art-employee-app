"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddLeaveTypeForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", daysAllowed: "", carryForward: false, isPaid: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/leave/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: "", daysAllowed: "", carryForward: false, isPaid: true });
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type Name *</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
          placeholder="e.g. Annual Leave, Sick Leave"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Days Allowed Per Year *</label>
        <input type="number" value={form.daysAllowed} onChange={e => setForm({ ...form, daysAllowed: e.target.value })} required
          placeholder="e.g. 14"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isPaid} onChange={e => setForm({ ...form, isPaid: e.target.checked })}
            className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-gray-700">Paid Leave</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.carryForward} onChange={e => setForm({ ...form, carryForward: e.target.checked })}
            className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-gray-700">Carry Forward</span>
        </label>
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
        {loading ? "Saving..." : "Add Leave Type"}
      </button>
    </form>
  );
}
