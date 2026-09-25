/**
 * Dev and production builds share the same Next.js app but must not share `.next`.
 * This script clears a corrupted dev cache before `next dev` starts.
 */
import { existsSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const devDir = path.join(root, process.env.NEXT_DIST_DIR ?? ".next-dev");
const cssAppDir = path.join(devDir, "static/css/app");

function isCorruptedDevCache() {
  if (!existsSync(devDir)) return false;

  // Production artifacts in the dev output dir mean a previous run used the wrong distDir.
  if (existsSync(path.join(devDir, "BUILD_ID"))) {
    return true;
  }

  // Dev mode serves `static/css/app/layout.css`. An empty `app/` folder = broken styles.
  if (existsSync(cssAppDir)) {
    try {
      if (statSync(cssAppDir).isDirectory() && !existsSync(path.join(cssAppDir, "layout.css"))) {
        return true;
      }
    } catch {
      return true;
    }
  }

  return false;
}

if (isCorruptedDevCache()) {
  console.log(`[dev] Clearing corrupted cache at ${path.basename(devDir)}/`);
  rmSync(devDir, { recursive: true, force: true });
}
