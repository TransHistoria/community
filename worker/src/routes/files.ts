// File storage routes — upload to and serve from Cloudflare R2.

import { Hono } from "hono";
import type { Env, Variables } from "@/types";
import { requireAuth } from "@/middleware/auth";

const files = new Hono<{ Bindings: Env; Variables: Variables }>();

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_SIZE = 4 * 1024 * 1024; // 4 MB

// POST /api/files — upload a file to R2
files.post("/", requireAuth, async (c) => {
  const uploaderId = c.get("userId");

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "请求必须为 multipart/form-data" }, 400);
  }

  const fileEntry = form.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return c.json({ error: "缺少 file 字段" }, 400);
  }
  const file = fileEntry as Blob;

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return c.json({ error: "仅支持 JPG、PNG、WebP、GIF" }, 400);
  if (file.size > MAX_SIZE) return c.json({ error: "文件不能超过 4MB" }, 400);

  const purpose = ((form.get("purpose") as string | null) ?? "misc").replace(/[^a-z0-9_-]/gi, "");
  const key = `${purpose}/${uploaderId}/${Date.now()}.${ext}`;

  await c.env.FILES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { uploaderId, purpose },
  });

  return c.json({ ok: true, url: `${new URL(c.req.url).origin}/api/files/${key}` });
});

// GET /api/files/* — serve a file from R2
files.get("/*", async (c) => {
  // In Hono v4, c.req.param("*") is undefined for wildcard routes inside a
  // mounted sub-router.  Derive the R2 key from the full request path instead.
  const key = decodeURIComponent(c.req.path.replace(/^\/api\/files\//, "").replace(/^\/+/, ""));
  if (!key) return c.json({ error: "Not found" }, 404);

  const obj = await c.env.FILES.get(key);
  if (!obj) return c.json({ error: "Not found" }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(obj.body, { headers });
});

export default files;
