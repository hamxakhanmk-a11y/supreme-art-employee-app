import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { guardWrite } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await guardWrite("employees");
  if (guard instanceof NextResponse) return guard;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    // Build safe filename
    const ts = Date.now();
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const pathname = `employees/${ts}-${safe}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({ url: blob.url });
  } catch (e: any) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 500 });
  }
}
