"use client";
import { useState } from "react";

type Employee = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string | null;
};

type AttendanceRecord = {
  id: number;
  employeeId: number;
  status: string | null;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number | null;
} | null;

export default function AttendanceTable({
  employees,
  attendanceMap,
  date,
}: {
  employees: Employee[];
  attendanceMap: Record<number, any>;
  date: string;
}) {
  const [saving, setSaving] = useState<number | null>(null);
  const [records, setRecords] = useState<Record<number, any>>(attendanceMap);

  const markAttendance = async (employeeId: number, status: string, checkIn?: string, checkOut?: string) => {
    setSaving(employeeId);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, date, status, checkIn, checkOut }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(prev => ({ ...prev, [employeeId]: data }));
      }
    } finally {
      setSaving(null);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "present": return "bg-green-100 text-green-700";
      case "absent": return "bg-red-100 text-red-700";
      case "late": return "bg-yellow-100 text-yellow-700";
      case "half-day": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-500";
    }
  };

  return (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Employee</th>
          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Check In</th>
          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Check Out</th>
          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Mark As</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {employees.map((emp) => {
          const record = records[emp.id];
          return (
            <tr key={emp.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                <p className="text-xs text-gray-400">{emp.employeeId} · {emp.designation || "No designation"}</p>
              </td>
              <td className="px-6 py-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record?.status)}`}>
                  {record?.status || "Not Marked"}
                </span>
              </td>
              <td className="px-6 py-4">
                <input
                  type="time"
                  defaultValue={record?.checkIn || ""}
                  id={`checkin-${emp.id}`}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
                />
              </td>
              <td className="px-6 py-4">
                <input
                  type="time"
                  defaultValue={record?.checkOut || ""}
                  id={`checkout-${emp.id}`}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
                />
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-2 flex-wrap">
                  {saving === emp.id ? (
                    <span className="text-gray-400 text-sm">Saving...</span>
                  ) : (
                    <>
                      <button
                        onClick={() => markAttendance(emp.id, "present",
                          (document.getElementById(`checkin-${emp.id}`) as HTMLInputElement)?.value,
                          (document.getElementById(`checkout-${emp.id}`) as HTMLInputElement)?.value
                        )}
                        className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-600 transition-colors"
                      >✅ Present</button>
                      <button
                        onClick={() => markAttendance(emp.id, "absent")}
                        className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-600 transition-colors"
                      >❌ Absent</button>
                      <button
                        onClick={() => markAttendance(emp.id, "late",
                          (document.getElementById(`checkin-${emp.id}`) as HTMLInputElement)?.value
                        )}
                        className="bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-yellow-600 transition-colors"
                      >⏰ Late</button>
                      <button
                        onClick={() => markAttendance(emp.id, "half-day")}
                        className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors"
                      >🌗 Half Day</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
