import { db } from "@/lib/db";
import { leaveTypes } from "@/lib/schema";
import { asc } from "drizzle-orm";
import LeaveTypesClient from "./LeaveTypesClient";

export const dynamic = "force-dynamic";

export default async function LeaveTypesPage() {
  const types = await db.select().from(leaveTypes).orderBy(asc(leaveTypes.name));
  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Leave Types</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Configure types of leave available to employees.</p>
        </div>
      </div>
      <LeaveTypesClient initial={types} />
    </div>
  );
}
