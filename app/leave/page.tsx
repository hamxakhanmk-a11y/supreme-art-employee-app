export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { leaveRequests, employees, leaveTypes } from "@/lib/schema";

export default async function LeavePage() {
  const requests = await db.select().from(leaveRequests);
  const types = await db.select().from(leaveTypes);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-500 mt-1">Manage employee leave requests</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Requests", value: requests.length, color: "bg-blue-500", icon: "📋" },
          { label: "Pending", value: requests.filter(r => r.status === "pending").length, color: "bg-yellow-500", icon: "⏳" },
          { label: "Approved", value: requests.filter(r => r.status === "approved").length, color: "bg-green-500", icon: "✅" },
          { label: "Rejected", value: requests.filter(r => r.status === "rejected").length, color: "bg-red-500", icon: "❌" },
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

      {/* Leave Types */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-800">Leave Types</h2>
        </div>
        {types.length === 0 ? (
          <p className="text-gray-400 text-sm">No leave types configured yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {types.map((t) => (
              <div key={t.id} className="border border-gray-100 rounded-lg p-3 text-center">
                <p className="font-medium text-gray-800">{t.name}</p>
                <p className="text-blue-600 font-bold text-lg">{t.daysAllowed} days</p>
                <p className="text-xs text-gray-400">{t.isPaid ? "Paid" : "Unpaid"}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Leave Requests</h2>
        </div>
        {requests.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📅</div>
            <p>No leave requests yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Employee</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Leave Type</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">From</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">To</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Days</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">Employee #{req.employeeId}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Type #{req.leaveTypeId}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{req.startDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{req.endDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{req.days}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      req.status === "approved" ? "bg-green-100 text-green-700" :
                      req.status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{req.status}</span>
                  </td>
                  <td className="px-6 py-4 flex gap-2">
                    <button className="text-green-600 hover:text-green-800 text-sm font-medium">Approve</button>
                    <button className="text-red-600 hover:text-red-800 text-sm font-medium">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
