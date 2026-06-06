export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { attendance, employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export default async function AttendanceHistoryPage({ searchParams }: { searchParams: Promise<{ employeeId?: string, month?: string, year?: string }> }) {
  const params = await searchParams;
  const currentMonth = params.month || String(new Date().getMonth() + 1);
  const currentYear = params.year || String(new Date().getFullYear());
  const selectedEmployeeId = params.employeeId;

  const allEmployees = await db.select().from(employees);
  const allAttendance = await db.select().from(attendance);

  // Filter attendance by month and year
  const filtered = allAttendance.filter(record => {
    if (!record.date) return false;
    const d = new Date(record.date);
    const matchMonth = d.getMonth() + 1 === parseInt(currentMonth);
    const matchYear = d.getFullYear() === parseInt(currentYear);
    const matchEmployee = selectedEmployeeId ? record.employeeId === parseInt(selectedEmployeeId) : true;
    return matchMonth && matchYear && matchEmployee;
  });

  // Get employee name by id
  const getEmployee = (id: number) => allEmployees.find(e => e.id === id);

  const statusColor = (status: string | null) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'late': return 'bg-yellow-100 text-yellow-700';
      case 'half-day': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  // Summary per employee
  const employeeSummary = allEmployees.map(emp => {
    const empRecords = filtered.filter(r => r.employeeId === emp.id);
    return {
      employee: emp,
      present: empRecords.filter(r => r.status === 'present').length,
      absent: empRecords.filter(r => r.status === 'absent').length,
      late: empRecords.filter(r => r.status === 'late').length,
      halfDay: empRecords.filter(r => r.status === 'half-day').length,
      total: empRecords.length,
    };
  });

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance History</h1>
          <p className="text-gray-500 mt-1">View all attendance records</p>
        </div>
        <Link href="/attendance">
          <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            ⏰ Mark Attendance
          </button>
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mb-6 flex gap-4 flex-wrap items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
          <select name="employeeId" defaultValue={selectedEmployeeId || ''}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Employees</option>
            {allEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <select name="month" defaultValue={currentMonth}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {months.map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <select name="year" defaultValue={currentYear}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </div>
        <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Filter
        </button>
      </form>

      {/* Employee Summary Cards */}
      {!selectedEmployeeId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {employeeSummary.map(({ employee, present, absent, late, halfDay, total }) => (
            <div key={employee.id} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{employee.firstName} {employee.lastName}</p>
                  <p className="text-gray-400 text-xs">{employee.employeeId}</p>
                </div>
                <Link href={`/attendance/history?employeeId=${employee.id}&month=${currentMonth}&year=${currentYear}`}>
                  <button className="text-blue-600 text-xs hover:underline">View Details</button>
                </Link>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-green-700 font-bold text-lg">{present}</p>
                  <p className="text-green-600 text-xs">Present</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="text-red-700 font-bold text-lg">{absent}</p>
                  <p className="text-red-600 text-xs">Absent</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2">
                  <p className="text-yellow-700 font-bold text-lg">{late}</p>
                  <p className="text-yellow-600 text-xs">Late</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-2">
                  <p className="text-orange-700 font-bold text-lg">{halfDay}</p>
                  <p className="text-orange-600 text-xs">Half</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">
            Detailed Records — {months[parseInt(currentMonth) - 1]} {currentYear}
          </h2>
          <span className="text-sm text-gray-400">{filtered.length} records</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p>No attendance records found for this period.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Employee</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Check In</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Check Out</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Late (mins)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime()).map(record => {
                const emp = getEmployee(record.employeeId);
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{emp?.firstName} {emp?.lastName}</p>
                      <p className="text-xs text-gray-400">{emp?.employeeId}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {record.date ? new Date(record.date).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' }) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.checkIn || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.checkOut || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.lateMinutes || 0} mins</td>
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
