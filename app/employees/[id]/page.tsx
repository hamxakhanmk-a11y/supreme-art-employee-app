export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const [employee] = await db.select().from(employees).where(eq(employees.id, parseInt(params.id)));

  if (!employee) return notFound();

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/employees" className="text-blue-600 hover:text-blue-800 text-sm font-medium">← Back to Employees</Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{employee.firstName} {employee.lastName}</h1>
          <p className="text-gray-500 mt-1">{employee.employeeId} · {employee.designation || "No designation"}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/employees/${employee.id}/edit`}>
            <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Edit Employee
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              👤
            </div>
            <h2 className="text-xl font-bold text-gray-900">{employee.firstName} {employee.lastName}</h2>
            <p className="text-gray-500 text-sm mt-1">{employee.designation || "-"}</p>
            <span className={`mt-3 inline-block px-3 py-1 rounded-full text-xs font-medium ${
              employee.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              {employee.status}
            </span>
          </div>

          {/* Quick Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">Quick Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Employee ID</span>
                <span className="font-medium text-gray-800">{employee.employeeId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Employment Type</span>
                <span className="font-medium text-gray-800">{employee.employmentType || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Joining Date</span>
                <span className="font-medium text-gray-800">{employee.dateOfJoining || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">CNIC</span>
                <span className="font-medium text-gray-800">{employee.cnic || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">CNIC Expiry</span>
                <span className={`font-medium ${employee.cnicExpiry && new Date(employee.cnicExpiry) < new Date() ? "text-red-600" : "text-gray-800"}`}>
                  {employee.cnicExpiry || "-"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">👤 Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm">First Name</p>
                <p className="font-medium text-gray-900 mt-1">{employee.firstName}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Last Name</p>
                <p className="font-medium text-gray-900 mt-1">{employee.lastName}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Date of Birth</p>
                <p className="font-medium text-gray-900 mt-1">{employee.dateOfBirth || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Address</p>
                <p className="font-medium text-gray-900 mt-1">{employee.address || "-"}</p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">📞 Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm">Email</p>
                <p className="font-medium text-gray-900 mt-1">{employee.email}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Phone</p>
                <p className="font-medium text-gray-900 mt-1">{employee.phone || "-"}</p>
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">💼 Job Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm">Designation</p>
                <p className="font-medium text-gray-900 mt-1">{employee.designation || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Employment Type</p>
                <p className="font-medium text-gray-900 mt-1">{employee.employmentType || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Date of Joining</p>
                <p className="font-medium text-gray-900 mt-1">{employee.dateOfJoining || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Status</p>
                <p className="font-medium text-gray-900 mt-1">{employee.status}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
