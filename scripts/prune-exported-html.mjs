import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = "out";
const ARTIFACT_DIR = "frontend-artifact";

async function copyArtifact(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(OUT_DIR, fullPath);
      const normalizedRelativePath = relativePath.split(path.sep).join("/");
      const artifactPath = path.join(ARTIFACT_DIR, relativePath);

      if (entry.isDirectory()) {
        await mkdir(artifactPath, { recursive: true });
        await copyArtifact(fullPath);
        return;
      }
      if (!entry.isFile()) {
        return;
      }
      if (entry.name.endsWith(".html") && normalizedRelativePath !== "index.html") {
        return;
      }
      await cp(fullPath, artifactPath);
    }),
  );
}

const outStats = await stat(OUT_DIR).catch(() => null);
if (outStats?.isDirectory()) {
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await copyArtifact(OUT_DIR);
}
