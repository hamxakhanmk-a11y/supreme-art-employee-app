"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Employee = { id: number; firstName: string; lastName: string; employeeId: string; };
type LeaveType = { id: number; name: string; daysAllowed: number; };

export default function ApplyLeaveForm({ employees, leaveTypes }: { employees: Employee[]; leaveTypes: LeaveType[]; }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    employeeId: "", leaveTypeId: "", startDate: "", endDate: "", reason: "",
  });
  const [days, setDays] = useState(0);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  };

  const handleDateChange = (field: string, value: string) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    setDays(calculateDays(updated.startDate, updated.endDate));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/leave/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, days }),
      });
      if (res.ok) {
        router.push("/leave");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
        <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} required
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select Employee</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeId})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
        <select value={form.leaveTypeId} onChange={e => setForm({ ...form, leaveTypeId: e.target.value })} required
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select Leave Type</option>
          {leaveTypes.map(type => (
            <option key={type.id} value={type.id}>{type.name} ({type.daysAllowed} days/year)</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date *</label>
          <input type="date" value={form.startDate} onChange={e => handleDateChange("startDate", e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date *</label>
          <input type="date" value={form.endDate} onChange={e => handleDateChange("endDate", e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {days > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <p className="text-blue-700 font-semibold">📅 Total Leave Days: <span className="text-2xl">{days}</span></p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
        <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
          rows={3} placeholder="Reason for leave..."
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading || days === 0}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? "Submitting..." : "Submit Leave Request"}
        </button>
        <button type="button" onClick={() => router.push("/leave")}
          className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
