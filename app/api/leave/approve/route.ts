import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaveRequests, leaveBalances } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const id = parseInt(formData.get("id") as string);
    const status = formData.get("status") as string;

    const [updated] = await db.update(leaveRequests)
      .set({ status })
      .where(eq(leaveRequests.id, id))
      .returning();

    // If approved, update leave balance
    if (status === "approved" && updated) {
      const currentYear = new Date().getFullYear();
      const existing = await db.select().from(leaveBalances)
        .where(and(
          eq(leaveBalances.employeeId, updated.employeeId),
          eq(leaveBalances.leaveTypeId, updated.leaveTypeId),
          eq(leaveBalances.year, currentYear)
        ));

      if (existing.length > 0) {
        const bal = existing[0];
        const newUsed = (bal.usedDays || 0) + updated.days;
        const newRemaining = bal.totalDays - newUsed;
        await db.update(leaveBalances)
          .set({ usedDays: newUsed, remainingDays: newRemaining })
          .where(eq(leaveBalances.id, bal.id));
      }
    }

    return NextResponse.redirect(new URL("/leave", req.url));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/leave", req.url));
  }
}
