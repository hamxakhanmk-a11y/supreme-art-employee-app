export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { leaveTypes } from "@/lib/schema";
import Link from "next/link";
import AddLeaveTypeForm from "@/components/AddLeaveTypeForm";

export default async function LeaveTypesPage() {
  const types = await db.select().from(leaveTypes);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/leave" className="text-blue-600 hover:text-blue-800 text-sm">← Back to Leave</Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Leave Types</h1>
          <p className="text-gray-500 mt-1">Configure leave types for your organization</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Leave Type Form */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">➕ Add Leave Type</h2>
          <AddLeaveTypeForm />
        </div>

        {/* Existing Leave Types */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">📋 Existing Leave Types</h2>
          {types.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-4xl mb-2">📅</p>
              <p>No leave types yet. Add one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {types.map(type => (
                <div key={type.id} className="flex justify-between items-center p-4 border border-gray-100 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-800">{type.name}</p>
                    <p className="text-sm text-gray-500">{type.daysAllowed} days/year · {type.isPaid ? '💰 Paid' : '🚫 Unpaid'} · {type.carryForward ? '↪️ Carry Forward' : 'No Carry Forward'}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                    {type.daysAllowed}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
