import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { otherDocuments } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

// GET — list all documents for an employee (optionally filtered by category)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const empId = parseInt(id);
  const category = req.nextUrl.searchParams.get("category");
  const rows = await db.select().from(otherDocuments)
    .where(eq(otherDocuments.employeeId, empId))
    .orderBy(desc(otherDocuments.createdAt));
  const filtered = category ? rows.filter(r => r.category === category) : rows;
  return NextResponse.json(filtered);
}

// POST — append a single document. Used by the quick "File Form" upload flow.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const empId = parseInt(id);
    const body = await req.json();
    if (!body.url || !body.label) {
      return NextResponse.json({ error: "url and label required" }, { status: 400 });
    }
    const [row] = await db.insert(otherDocuments).values({
      employeeId: empId,
      label: body.label,
      url: body.url,
      category: body.category || null,
      formDate: body.formDate || null,
      notes: body.notes || null,
    }).returning();
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/employees/[id]/documents?docId=N — delete a single document
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ctx.params;
    const docId = parseInt(req.nextUrl.searchParams.get("docId") || "");
    if (!docId) return NextResponse.json({ error: "docId required" }, { status: 400 });
    await db.delete(otherDocuments).where(eq(otherDocuments.id, docId));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
