import Link from "next/link";

const stats = [
  { label: "Total Employees", value: "0", icon: "👥", color: "bg-blue-500", href: "/employees" },
  { label: "Present Today", value: "0", icon: "✅", color: "bg-green-500", href: "/attendance" },
  { label: "Absent Today", value: "0", icon: "❌", color: "bg-red-500", href: "/attendance" },
  { label: "On Leave", value: "0", icon: "📅", color: "bg-yellow-500", href: "/leave" },
  { label: "Pending Leaves", value: "0", icon: "⏳", color: "bg-orange-500", href: "/leave" },
  { label: "Late Today", value: "0", icon: "⏰", color: "bg-purple-500", href: "/attendance" },
];

const quickLinks = [
  { href: "/employees/new", label: "Add Employee", icon: "➕", desc: "Register a new employee" },
  { href: "/attendance", label: "Mark Attendance", icon: "⏰", desc: "Record today's attendance" },
  { href: "/leave", label: "Approve Leaves", icon: "📋", desc: "Review pending leave requests" },
  { href: "/employees", label: "View All Employees", icon: "👥", desc: "Browse employee records" },
];

export default function Dashboard() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome to Supreme Art HR Management System</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <Link href={stat.href} key={stat.label}>
            <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer border border-gray-100">
              <div className={`${stat.color} text-white text-2xl w-14 h-14 rounded-xl flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-gray-500 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              <div className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer border border-gray-100 text-center">
                <div className="text-3xl mb-2">{link.icon}</div>
                <p className="font-semibold text-gray-800">{link.label}</p>
                <p className="text-gray-400 text-xs mt-1">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">📋 Recent Activity</h2>
        <div className="text-gray-400 text-center py-8">
          No recent activity yet. Start by adding employees!
        </div>
      </div>
    </div>
  );
}
