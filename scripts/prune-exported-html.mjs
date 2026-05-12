import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = "out";
const keep = new Set([
  path.join(OUT_DIR, "index.html"),
  path.join(OUT_DIR, "404.html"),
]);

async function pruneHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await pruneHtml(fullPath);
        const remaining = await readdir(fullPath);
        if (remaining.length === 0) {
          await rm(fullPath, { recursive: true, force: true });
        }
        return;
      }
      if (!entry.isFile() || !fullPath.endsWith(".html") || keep.has(fullPath)) {
        return;
      }
      await rm(fullPath, { force: true });
    }),
  );
}

const outStats = await stat(OUT_DIR).catch(() => null);
if (outStats?.isDirectory()) {
  await pruneHtml(OUT_DIR);
}
