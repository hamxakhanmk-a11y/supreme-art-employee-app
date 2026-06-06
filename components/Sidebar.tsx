"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/employees", label: "Employees", icon: "👥" },
  { href: "/attendance", label: "Attendance", icon: "⏰" },
  { href: "/leave", label: "Leave Management", icon: "📅" },
  { href: "/payroll", label: "Payroll", icon: "💰" },
  { href: "/reports", label: "HR Reports", icon: "📊" },
  { href: "/compliance", label: "Compliance", icon: "📋" },
  { href: "/audit-logs", label: "Audit Logs", icon: "🔍" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">Supreme Art</h1>
        <p className="text-gray-400 text-sm mt-1">HR Management</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <p className="text-gray-400 text-xs text-center">© 2026 Supreme Art</p>
      </div>
    </aside>
  );
}
