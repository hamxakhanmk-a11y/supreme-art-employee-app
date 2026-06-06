export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { leaveRequests, leaveTypes, employees, leaveBalances } from "@/lib/schema";
import Link from "next/link";

export default async function LeavePage() {
  const allRequests = await db.select().from(leaveRequests);
  const allTypes = await db.select().from(leaveTypes);
  const allEmployees = await db.select().from(employees);
  const allBalances = await db.select().from(leaveBalances);

  const getEmployee = (id: number) => allEmployees.find(e => e.id === id);
  const getLeaveType = (id: number) => allTypes.find(t => t.id === id);

  const pending = allRequests.filter(r => r.status === 'pending');
  const approved = allRequests.filter(r => r.status === 'approved');
  const rejected = allRequests.filter(r => r.status === 'rejected');

  const statusColor = (status: string | null) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-500 mt-1">Manage employee leaves and approvals</p>
        </div>
        <div className="flex gap-3">
          <Link href="/leave/types">
            <button className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm">
              ⚙️ Leave Types
            </button>
          </Link>
          <Link href="/leave/apply">
            <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              + Apply Leave
            </button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Requests", value: allRequests.length, color: "bg-blue-500", icon: "📋" },
          { label: "Pending", value: pending.length, color: "bg-yellow-500", icon: "⏳" },
          { label: "Approved", value: approved.length, color: "bg-green-500", icon: "✅" },
          { label: "Rejected", value: rejected.length, color: "bg-red-500", icon: "❌" },
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

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-yellow-800 mb-4">⏳ Pending Approvals ({pending.length})</h2>
          <div className="space-y-3">
            {pending.map(req => {
              const emp = getEmployee(req.employeeId);
              const type = getLeaveType(req.leaveTypeId);
              return (
                <div key={req.id} className="bg-white rounded-lg p-4 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-medium text-gray-800">{emp?.firstName} {emp?.lastName}</p>
                    <p className="text-sm text-gray-500">{type?.name} · {req.days} day(s) · {req.startDate} to {req.endDate}</p>
                    {req.reason && <p className="text-xs text-gray-400 mt-1">Reason: {req.reason}</p>}
                  </div>
                  <div className="flex gap-2">
                    <form action="/api/leave/approve" method="POST">
                      <input type="hidden" name="id" value={req.id} />
                      <input type="hidden" name="status" value="approved" />
                      <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600">
                        ✅ Approve
                      </button>
                    </form>
                    <form action="/api/leave/approve" method="POST">
                      <input type="hidden" name="id" value={req.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button type="submit" className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600">
                        ❌ Reject
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leave Balances */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">📊 Leave Balances</h2>
          <Link href="/leave/balances">
            <button className="text-blue-600 text-sm hover:underline">View All</button>
          </Link>
        </div>
        {allBalances.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No leave balances set up yet.</p>
            <Link href="/leave/balances">
              <button className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Setup Balances</button>
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Employee</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Leave Type</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Total</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Used</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allBalances.slice(0, 5).map(bal => {
                const emp = getEmployee(bal.employeeId);
                const type = getLeaveType(bal.leaveTypeId);
                return (
                  <tr key={bal.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{emp?.firstName} {emp?.lastName}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{type?.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{bal.totalDays}</td>
                    <td className="px-6 py-3 text-sm text-red-600">{bal.usedDays}</td>
                    <td className="px-6 py-3 text-sm text-green-600 font-semibold">{bal.remainingDays}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* All Leave Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">📋 All Leave Requests</h2>
        </div>
        {allRequests.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📅</div>
            <p>No leave requests yet.</p>
            <Link href="/leave/apply">
              <button className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium">Apply Leave</button>
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Employee</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Leave Type</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">From</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">To</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Days</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allRequests.map(req => {
                const emp = getEmployee(req.employeeId);
                const type = getLeaveType(req.leaveTypeId);
                return (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-gray-900">{emp?.firstName} {emp?.lastName}</p>
                      <p className="text-xs text-gray-400">{emp?.employeeId}</p>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{type?.name || '-'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{req.startDate}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{req.endDate}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{req.days} day(s)</td>
                    <td className="px-6 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
