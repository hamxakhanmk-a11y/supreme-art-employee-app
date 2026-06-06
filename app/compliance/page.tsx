import { db } from "@/lib/db";
import { employees, contracts } from "@/lib/schema";

export default async function CompliancePage() {
  const allEmployees = await db.select().from(employees);
  const allContracts = await db.select().from(contracts);

  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // CNIC expiring in 30 days
  const cnicExpiring = allEmployees.filter(emp => {
    if (!emp.cnicExpiry) return false;
    const expiry = new Date(emp.cnicExpiry);
    return expiry <= in30Days && expiry >= today;
  });

  // Contracts expiring in 30 days
  const contractsExpiring = allContracts.filter(c => {
    if (!c.endDate) return false;
    const expiry = new Date(c.endDate);
    return expiry <= in30Days && expiry >= today;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compliance & Records</h1>
        <p className="text-gray-500 mt-1">Track expiry alerts and compliance records</p>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🪪</span>
            <h2 className="font-semibold text-red-800">CNIC Expiry Alerts</h2>
            <span className="ml-auto bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">{cnicExpiring.length}</span>
          </div>
          {cnicExpiring.length === 0 ? (
            <p className="text-red-600 text-sm">No CNIC expiring in next 30 days ✅</p>
          ) : (
            <div className="space-y-2">
              {cnicExpiring.map(emp => (
                <div key={emp.id} className="flex justify-between items-center bg-white rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-800">{emp.firstName} {emp.lastName}</p>
                    <p className="text-gray-400 text-xs">{emp.employeeId}</p>
                  </div>
                  <p className="text-red-600 text-sm font-medium">{emp.cnicExpiry}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📄</span>
            <h2 className="font-semibold text-orange-800">Contract Expiry Alerts</h2>
            <span className="ml-auto bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">{contractsExpiring.length}</span>
          </div>
          {contractsExpiring.length === 0 ? (
            <p className="text-orange-600 text-sm">No contracts expiring in next 30 days ✅</p>
          ) : (
            <div className="space-y-2">
              {contractsExpiring.map(c => (
                <div key={c.id} className="flex justify-between items-center bg-white rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-800">Employee #{c.employeeId}</p>
                    <p className="text-gray-400 text-xs">{c.contractType}</p>
                  </div>
                  <p className="text-orange-600 text-sm font-medium">{c.endDate}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All Contracts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">All Contracts</h2>
        </div>
        {allContracts.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p>No contracts added yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Employee</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Type</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Start Date</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">End Date</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {allContracts.map(c => (
                <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">Employee #{c.employeeId}</td>
                  <td className="px-6 py-4 text-sm">{c.contractType}</td>
                  <td className="px-6 py-4 text-sm">{c.startDate}</td>
                  <td className="px-6 py-4 text-sm">{c.endDate || "Permanent"}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
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
