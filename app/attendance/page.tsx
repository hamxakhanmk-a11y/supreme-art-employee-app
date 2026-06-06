export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { attendance, employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import AttendanceTable from "@/components/AttendanceTable";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const today = date || new Date().toISOString().split("T")[0];

  const allEmployees = await db.select().from(employees);
  const todayAttendance = await db.select().from(attendance).where(eq(attendance.date, today));

  // Map attendance by employeeId for easy lookup
  const attendanceMap = todayAttendance.reduce((acc, record) => {
    acc[record.employeeId] = record;
    return acc;
  }, {} as Record<number, typeof todayAttendance[0]>);

  const present = todayAttendance.filter(a => a.status === "present").length;
  const absent = todayAttendance.filter(a => a.status === "absent").length;
  const late = todayAttendance.filter(a => a.status === "late").length;
  const notMarked = allEmployees.length - todayAttendance.length;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-500 mt-1">{new Date(today).toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Present", value: present, color: "bg-green-500", icon: "✅" },
          { label: "Absent", value: absent, color: "bg-red-500", icon: "❌" },
          { label: "Late", value: late, color: "bg-yellow-500", icon: "⏰" },
          { label: "Not Marked", value: notMarked, color: "bg-gray-400", icon: "❓" },
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
          <h2 className="font-semibold text-gray-800">Mark Attendance</h2>
          <form method="GET">
            <input
              type="date"
              name="date"
              defaultValue={today}
              onChange={(e) => (e.target.form as HTMLFormElement).submit()}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </form>
        </div>

        {allEmployees.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">👥</div>
            <p>No employees found. Add employees first.</p>
          </div>
        ) : (
          <AttendanceTable employees={allEmployees} attendanceMap={attendanceMap} date={today} />
        )}
      </div>
    </div>
  );
}
