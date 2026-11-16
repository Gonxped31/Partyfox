T-qr8x | 2 | - | S | devops | todo.test.ts migrate tests time out on Windows (5-6 s against the 5 s default), so check.mjs fails on main
created: 2026-11-16T06:23:01.209Z

Trigger: now (seen 2026-11-16 on main b0bd78c and on t-mke2-quiz-repeats). Do: give the two git-heavy migrate cases in tests/todo/todo.test.ts ("migrates an old branch mid-rebase..." and "keeps todos the old branch finished finished...") a longer timeout (e.g. 20 s as the it() third argument), or speed up their git setup. They take 5.1-6.6 s here, so node scripts/check.mjs reports FAIL on an untouched main. Why: a check that fails on clean main trains everyone to ignore it.
