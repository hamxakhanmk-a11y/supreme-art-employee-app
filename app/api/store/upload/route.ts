import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { guardWrite } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/store/upload?filename=part.jpg
// Body: raw JPEG/PNG bytes (the browser resizes+compresses before posting).
// Response: { url, pathname }
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    const contentType = req.headers.get("content-type") || "image/jpeg";
    if (!/^image\//i.test(contentType)) {
      return NextResponse.json({ error: "Only image uploads are accepted" }, { status: 400 });
    }
    const rawName = req.nextUrl.searchParams.get("filename") || "part.jpg";
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const buf = Buffer.from(await req.arrayBuffer());
    if (!buf.length) return NextResponse.json({ error: "Empty upload" }, { status: 400 });
    if (buf.length > 5 * 1024 * 1024) return NextResponse.json({ error: "Image too large (5 MB max)" }, { status: 413 });

    const key = `store-parts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const blob = await put(key, buf, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 500 });
  }
}

// DELETE /api/store/upload?url=https://…blob…
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  try { await del(url); } catch { /* file may already be gone */ }
  return NextResponse.json({ ok: true });
}
