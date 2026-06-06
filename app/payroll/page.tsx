import { db } from "@/lib/db";
import { payroll, employees } from "@/lib/schema";

export default async function PayrollPage() {
  const allPayroll = await db.select().from(payroll);
  const allEmployees = await db.select().from(employees);
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-500 mt-1">Manage employee salaries and payments</p>
        </div>
        <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
          Generate Payroll
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-gray-500 text-sm">Total Employees</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{allEmployees.length}</p>
          <p className="text-gray-400 text-xs mt-2">Active employees</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-gray-500 text-sm">This Month Payroll</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">PKR 0</p>
          <p className="text-gray-400 text-xs mt-2">{new Date().toLocaleString("default", { month: "long" })} {currentYear}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-gray-500 text-sm">Payroll Status</p>
          <p className="text-3xl font-bold text-yellow-500 mt-1">Pending</p>
          <p className="text-gray-400 text-xs mt-2">Not generated yet</p>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Payroll Records</h2>
          <div className="flex gap-3">
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i+1} value={i+1}>
                  {new Date(2026, i, 1).toLocaleString("default", { month: "long" })}
                </option>
              ))}
            </select>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>2026</option>
              <option>2025</option>
            </select>
          </div>
        </div>
        {allPayroll.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">💰</div>
            <p>No payroll records yet.</p>
            <p className="text-sm mt-1">Generate payroll to get started.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Employee</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Basic</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Allowances</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Deductions</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Net Salary</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {allPayroll.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 border-t border-gray-50">
                  <td className="px-6 py-4 text-sm">Employee #{p.employeeId}</td>
                  <td className="px-6 py-4 text-sm">PKR {p.basicSalary}</td>
                  <td className="px-6 py-4 text-sm">PKR {p.totalAllowances}</td>
                  <td className="px-6 py-4 text-sm text-red-600">-PKR {Number(p.taxDeduction) + Number(p.loanDeduction)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">PKR {p.netSalary}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      p.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>{p.status}</span>
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
