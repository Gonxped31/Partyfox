// Repairs package-lock.json with npm on Linux, in Docker: it adds the entries npm on Windows
// drops (see scripts/check-lock.mjs) and changes no version. Needs Docker running.
// Usage: node scripts/fix-lock.mjs   (then: node scripts/check-lock.mjs, and commit the lockfile)
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Work on copies inside the container: npm must not see the Windows node_modules.
const steps = [
  "mkdir /work && cd /work",
  "cp /repo/package.json /repo/package-lock.json .",
  "npm install --package-lock-only --ignore-scripts --no-audit --no-fund > /tmp/npm.log 2>&1 || { tail -20 /tmp/npm.log; exit 1; }",
  "cp package-lock.json /repo/package-lock.json",
].join(" && ");
const run = spawnSync("docker", ["run", "--rm", "-v", `${ROOT}:/repo`, "node:24", "sh", "-c", steps], { encoding: "utf8" });
if (run.error || run.status !== 0) {
  console.log((run.stdout + run.stderr).trim() || String(run.error?.message ?? "docker failed"));
  console.log("FAIL (is Docker running?)");
  process.exit(1);
}
console.log("OK (package-lock.json repaired by npm on Linux)");
