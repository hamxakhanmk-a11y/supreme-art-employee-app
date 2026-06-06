export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { leaveTypes, employees } from "@/lib/schema";
import Link from "next/link";
import ApplyLeaveForm from "@/components/ApplyLeaveForm";

export default async function ApplyLeavePage() {
  const types = await db.select().from(leaveTypes);
  const allEmployees = await db.select().from(employees);

  return (
    <div>
      <div className="mb-8">
        <Link href="/leave" className="text-blue-600 hover:text-blue-800 text-sm">← Back to Leave</Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Apply for Leave</h1>
        <p className="text-gray-500 mt-1">Submit a leave request</p>
      </div>

      {types.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800 font-medium">⚠️ No leave types configured yet!</p>
          <p className="text-yellow-600 text-sm mt-1">Please add leave types before applying.</p>
          <Link href="/leave/types">
            <button className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium">
              Setup Leave Types
            </button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 max-w-2xl">
          <ApplyLeaveForm employees={allEmployees} leaveTypes={types} />
        </div>
      )}
    </div>
  );
}
