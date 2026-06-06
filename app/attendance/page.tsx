import { db } from "@/lib/db";
import { attendance, employees } from "@/lib/schema";

export default async function AttendancePage() {
  const today = new Date().toISOString().split("T")[0];
  const allEmployees = await db.select().from(employees);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-500 mt-1">Today: {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", value: allEmployees.length, color: "bg-blue-500", icon: "👥" },
          { label: "Present", value: 0, color: "bg-green-500", icon: "✅" },
          { label: "Absent", value: 0, color: "bg-red-500", icon: "❌" },
          { label: "Late", value: 0, color: "bg-yellow-500", icon: "⏰" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 flex items-center gap-3">
            <div className={`${s.color} text-white w-12 h-12 rounded-lg flex items-center justify-center text-xl`}>{s.icon}</div>
            <div>
              <p className="text-gray-500 text-sm">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Today&apos;s Attendance</h2>
          <input type="date" defaultValue={today}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {allEmployees.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">⏰</div>
            <p>No employees found. Add employees first.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Employee</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Check In</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Check Out</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Overtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-gray-400">{emp.employeeId}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">-</td>
                  <td className="px-6 py-4 text-sm text-gray-600">-</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Not Marked</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">0 hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
