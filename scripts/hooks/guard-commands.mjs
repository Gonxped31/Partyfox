// PreToolUse hook for Bash and PowerShell: keeps the repo's safety nets in place.
// Refuses (exit 2; the reason goes to Claude):
//   --no-verify (and git commit -n), which skips the git hooks, and turning the hooks off
//   (core.hooksPath);
//   bulk staging (git add -A/./-u, git commit -a), which picks up changes that aren't yours.
// Long options count in any abbreviation git accepts (--no-veri, --al).
// Asks the user first: merging into main, pushing, and commands that discard work or move
// branches by hand.
// Messages are ignored (quoted text of several words, the value of -m or -F, heredocs and
// here-strings), so a commit message can mention any of this. A quoted flag or path still counts
// (git add ".", git commit "--no-verify"), and so does a command handed to another shell
// (bash -c "...", pwsh -Command "...", cmd /c "...", eval "...") or run in ( ) or { }.
// It stops reflexes, not intent: a command can always be spelled so that no pattern sees it. The
// git hooks are the gate.
// Fails open: unreadable input lets the command through.
import { readFileSync } from "node:fs";

let command;
try {
  command = String(JSON.parse(readFileSync(0, "utf8")).tool_input?.command ?? "");
} catch {
  process.exit(0);
}

const QUOTED = /"(?:[^"\\`]|[\\`].)*"|'[^']*'/g;
const STRING = `("(?:[^"\\\\\`]|[\\\\\`].)*"|'[^']*')`;
// A command handed to another shell: its string is code, not a message.
const INNER = new RegExp(
  `\\b(?:(?:ba|z|da)?sh|pwsh|powershell)(?:\\.exe)?\\b[^\\n;|&]*?\\s-(?:l?c|[Cc]ommand)\\s+${STRING}|\\bcmd(?:\\.exe)?\\s+/[cC]\\s+${STRING}|\\beval\\s+${STRING}`,
  "g",
);
// A quoted word that is a flag or one of the bulk paths: git reads it as if it weren't quoted.
const FLAG_OR_PATH = /^(?:--?[A-Za-z][\w-]*(?:=\S*)?|\.[\\/]?|\*|:\/\.?)$/;
// What comes just before the value of -m, -F, --message or --file: that value is never a flag.
const BEFORE_VALUE = /(?:^|\s)(?:-[a-zA-Z]*[mF]|--message|--file)[=\s]*$/;

/** The command without its messages, with the commands it hands to other shells added as lines. */
function codeOf(text, depth = 0) {
  const inner = depth < 3 ? [...text.matchAll(INNER)].map((m) => codeOf((m[1] ?? m[2] ?? m[3]).slice(1, -1), depth + 1)) : [];
  const outer = text.replace(QUOTED, (quoted, offset, whole) => {
    const word = quoted.slice(1, -1);
    return FLAG_OR_PATH.test(word) && !BEFORE_VALUE.test(whole.slice(0, offset)) ? word : '""';
  });
  return [outer, ...inner].join("\n");
}

const code = codeOf(
  command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, " ") // heredoc bodies
    .replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, '""'), // PowerShell here-strings
);

function refuse(reason) {
  console.error(reason);
  process.exit(2);
}

/** A simple command's git subcommand and its arguments, skipping git's own options (-C dir, -c k=v). */
function parseGit(segment) {
  const words = segment.trim().split(/\s+/);
  let i = words.findIndex((w) => /(^|[\\/])git(\.exe)?$/.test(w));
  if (i < 0) return null;
  for (i++; i < words.length && words[i].startsWith("-"); i++) if (words[i] === "-C" || words[i] === "-c") i++;
  return { sub: words[i], args: words.slice(i + 1) };
}
// ( ), $( ) and { } group commands, so they separate them too; a ref like stash@{0} is one word.
const gits = code.replace(/@\{[^}\n]*\}/g, "@").split(/&&|\|\||[;|\n(){}]/).map(parseGit).filter(Boolean);
const has = (args, ...flags) => args.some((a) => flags.includes(a));

/** The letters of a short-option group like -qnm, up to one that takes a value (m: -mfoo is a message). */
function shortFlags(arg, takesValue = "") {
  if (!/^-[a-zA-Z]+$/.test(arg)) return "";
  let flags = "";
  for (const ch of arg.slice(1)) {
    flags += ch;
    if (takesValue.includes(ch)) break;
  }
  return flags;
}
/** True for `name` or an abbreviation of it git would accept (git takes any unambiguous prefix). */
const long = (arg, name, shortest) => arg.length >= shortest && name.startsWith(arg.split("=")[0]);

// --no-veri is enough for git (--no-ve could also be --no-verbose).
if (/(^|\s)--no-veri/.test(code)) {
  refuse("--no-verify skips the git hooks (the checks, no commits on main). Fix what the hook reports instead.");
}
if (/core\.hooksPath[\s=]+(?!\.githooks\b)[^\s;&|]/i.test(code) || /\bunset(-all)?\s+core\.hooksPath\b/i.test(code)) {
  refuse("The git hooks stay on: core.hooksPath is .githooks.");
}
const BULK_PATHS = [".", "./", ".\\", "*", ":/", ":/."];
for (const { sub, args } of gits) {
  if (
    sub === "add" &&
    args.some(
      (a) =>
        BULK_PATHS.includes(a) ||
        /[Au]/.test(shortFlags(a)) ||
        long(a, "--all", 3) ||
        long(a, "--update", 3) ||
        long(a, "--no-ignore-removal", 6),
    )
  ) {
    refuse("Stage the files you changed by name (git skill): bulk staging picks up changes that aren't yours.");
  }
  if (sub === "commit") {
    // Options of git commit that take a value: -m msg, -F file, -C/-c commit, -t file, -S[key], -u[mode].
    const flags = args.map((a) => shortFlags(a, "mFCctSu")).join("");
    if (flags.includes("n")) {
      refuse("git commit -n is --no-verify: it skips the git hooks. Fix what the hook reports instead.");
    }
    if (flags.includes("a") || args.includes("--all")) {
      refuse("git commit -a stages every changed file. Stage yours by name, then commit (git skill).");
    }
  }
}

const reasons = [];
if (/\bnode(\.exe)?\s+\S*merge\.mjs\b/.test(code)) reasons.push("This merges into main: the user approves first.");
for (const { sub, args } of gits) {
  if (sub === "push") reasons.push("This pushes to a remote.");
  if (sub === "merge") reasons.push("main moves only through scripts/merge.mjs; merging by hand needs the user's OK.");
  if (sub === "reset" && has(args, "--hard")) reasons.push("reset --hard discards uncommitted work.");
  if (sub === "clean") reasons.push("git clean deletes untracked files.");
  if (sub === "checkout" && has(args, "--", ".")) reasons.push("This discards uncommitted changes.");
  if (sub === "restore" && !(has(args, "--staged", "-S") && !has(args, "--worktree", "-W"))) {
    reasons.push("git restore discards uncommitted changes.");
  }
  if (sub === "stash" && has(args, "drop", "clear")) reasons.push("This deletes stashed work.");
  if (sub === "branch" && has(args, "-D", "-f", "--force")) reasons.push("Force-deleting or moving a branch can lose commits.");
  if (sub === "update-ref") reasons.push("This moves a branch by hand.");
  if (sub === "worktree" && args[0] === "remove" && has(args, "-f", "--force")) {
    reasons.push("Removing a worktree by force deletes its uncommitted work.");
  }
}
if (reasons.length) {
  const output = { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: [...new Set(reasons)].join(" ") };
  console.log(JSON.stringify({ hookSpecificOutput: output }));
}
process.exit(0);
