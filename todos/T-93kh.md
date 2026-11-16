T-93kh | 3 | - | S | devops | doctor.mjs reports .next/dev as a dead path in a checkout that ran next build but never next dev
created: 2026-11-16T08:50:24.793Z

Trigger: any time (seen 2026-11-16: the pre-commit hook failed in a fresh worktree after ./scripts/build). Do: in scripts/doctor.mjs's dead-path check, skip code-span paths under git-ignored folders (e.g. git check-ignore, or skip .next/ and node_modules/), so `.next/dev` named in .claude/skills/live-test/SKILL.md, live-test/reference.md and docs/architecture.md isn't reported when .next exists without dev/. Why: the hook then fails on build output, not on the change; the workaround is deleting .next.
