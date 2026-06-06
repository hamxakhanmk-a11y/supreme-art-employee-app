export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/schema";

export default async function AuditLogsPage() {
  const logs = await db.select().from(auditLogs).limit(100);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-500 mt-1">Track all system changes and activities</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">System Activity</h2>
          <span className="text-sm text-gray-400">{logs.length} records</span>
        </div>
        {logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p>No audit logs yet.</p>
            <p className="text-sm mt-1">Logs will appear here as the system is used.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Time</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">User</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Action</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Table</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Record ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm">User #{log.userId}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      log.action === "CREATE" ? "bg-green-100 text-green-700" :
                      log.action === "UPDATE" ? "bg-blue-100 text-blue-700" :
                      log.action === "DELETE" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{log.action}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{log.tableName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">#{log.recordId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
