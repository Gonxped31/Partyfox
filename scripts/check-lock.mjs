// Checks that package-lock.json is complete: every package's dependencies and required peers
// have an entry the package can reach (its own node_modules, or one further up).
// Why: npm on Windows drops entries only Linux needs (the @emnapi packages, T-054), and then
// `npm ci` fails on Linux, so CI and Vercel fail while everything passes here. This finds the
// gap on any OS, before the commit.
// Prints one line per missing entry, then OK or FAIL.
// Usage: node scripts/check-lock.mjs [path to a lockfile]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2] ?? path.join(ROOT, "package-lock.json");
const packages = JSON.parse(fs.readFileSync(file, "utf8")).packages ?? {};

/** True if `name` has an entry in `from`'s node_modules, or in a folder above it. */
function reaches(from, name) {
  for (let base = from; ; base = base.slice(0, Math.max(0, base.lastIndexOf("/node_modules/")))) {
    if (packages[`${base ? `${base}/` : ""}node_modules/${name}`]) return true;
    if (!base) return false;
  }
}

const missing = [];
for (const [where, entry] of Object.entries(packages)) {
  if (entry.link) continue;
  const optionalPeers = Object.entries(entry.peerDependenciesMeta ?? {}).filter(([, meta]) => meta.optional).map(([name]) => name);
  const needed = [
    ...Object.keys(entry.dependencies ?? {}),
    ...(where === "" ? Object.keys(entry.devDependencies ?? {}) : []),
    ...Object.keys(entry.peerDependencies ?? {}).filter((name) => !optionalPeers.includes(name)),
  ];
  for (const name of needed) {
    if (!reaches(where, name)) missing.push(`${where.replace(/^node_modules\//, "") || "the project"} needs ${name}, which has no entry`);
  }
}

for (const line of missing) console.log(`package-lock.json: ${line}`);
if (missing.length) console.log("To fix: node scripts/fix-lock.mjs (needs Docker), then commit the lockfile.");
console.log(missing.length ? "FAIL" : "OK");
process.exit(missing.length ? 1 : 0);
