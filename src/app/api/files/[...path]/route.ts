import { NextResponse } from "next/server";
import { readLocalFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: { path: string[] } },
) {
  const rel = params.path.join("/");
  const file = await readLocalFile(rel);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
