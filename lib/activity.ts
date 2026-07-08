import { db } from "@/lib/db";
import { activityLog, employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { SessionUser } from "@/lib/auth";

// Write one audit-trail row. Never throws — a logging failure must not break
// the write it describes. Pass employeeName when the caller already has it to
// avoid the extra lookup; otherwise it's resolved from employeeId.
export async function logActivity(opts: {
  user: SessionUser;
  action: string;          // e.g. "attendance.mark"
  summary: string;         // sentence WITHOUT the employee name; name is prefixed when known
  employeeId?: number | null;
  employeeName?: string | null;
}) {
  try {
    let name = opts.employeeName ?? null;
    if (!name && opts.employeeId) {
      const [e] = await db.select({ firstName: employees.firstName, lastName: employees.lastName })
        .from(employees).where(eq(employees.id, opts.employeeId));
      if (e) name = `${e.firstName} ${e.lastName}`;
    }
    const summary = name ? `${name} — ${opts.summary}` : opts.summary;
    await db.insert(activityLog).values({
      userId: opts.user.id,
      userName: opts.user.name,
      action: opts.action,
      employeeId: opts.employeeId ?? null,
      summary,
    });
  } catch (e) {
    console.error("activity log failed:", e);
  }
}
