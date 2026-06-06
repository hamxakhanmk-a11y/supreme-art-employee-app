export default function ReportsPage() {
  const reports = [
    { title: "Attendance Report", desc: "Daily, weekly and monthly attendance summary", icon: "📊", color: "bg-blue-50 border-blue-200" },
    { title: "Payroll Summary", desc: "Monthly payroll breakdown and totals", icon: "💰", color: "bg-green-50 border-green-200" },
    { title: "Employee Turnover", desc: "Hiring and resignation trends", icon: "👥", color: "bg-purple-50 border-purple-200" },
    { title: "Overtime Trends", desc: "Overtime hours and costs analysis", icon: "⏰", color: "bg-orange-50 border-orange-200" },
    { title: "Leave Summary", desc: "Leave usage per employee and department", icon: "📅", color: "bg-yellow-50 border-yellow-200" },
    { title: "CNIC Expiry Report", desc: "Employees with expiring CNICs", icon: "⚠️", color: "bg-red-50 border-red-200" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">HR Reports</h1>
        <p className="text-gray-500 mt-1">Generate and download HR reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <div key={report.title} className={`bg-white rounded-xl shadow-sm p-6 border ${report.color} hover:shadow-md transition-shadow cursor-pointer`}>
            <div className="text-3xl mb-3">{report.icon}</div>
            <h3 className="font-semibold text-gray-800 text-lg">{report.title}</h3>
            <p className="text-gray-500 text-sm mt-1">{report.desc}</p>
            <div className="mt-4 flex gap-2">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                View
              </button>
              <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                Export
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
