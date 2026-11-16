// PreToolUse hook for Read: refuse files under node_modules, except Next's own docs.
// AGENTS.md (written by `next dev`) and CLAUDE.md send the agent to node_modules/next/dist/docs/
// before it uses a Next API. A deny rule can't make an exception, so this hook replaces
// Read(./node_modules/**): dependencies stay unread (tokens), and those docs can be read.
// Fails open: any error lets the call through.
import { readFileSync } from "node:fs";

try {
  const file = String(JSON.parse(readFileSync(0, "utf8")).tool_input?.file_path ?? "").replace(/\\/g, "/");
  if (/(^|\/)node_modules\//.test(file) && !/(^|\/)node_modules\/next\/dist\/docs(\/|$)/.test(file)) {
    console.error("Files under node_modules aren't read: they cost many tokens. The one exception is Next's docs, node_modules/next/dist/docs/.");
    process.exit(2);
  }
} catch {
  // fail open
}
