<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Workflow

- Develop and run release gates locally; production is pull-only and must never be used as a development environment.
- Ship source through a pull request with passing CI. Production may only fast-forward from `origin/master`.

## Compact release standard

For routine “提交部署” requests, use this as the default release path:

1. Run `npm run release:check` exactly once for each unchanged source tree. Successful step logs stay quiet; only a failed step expands its log.
2. Push one feature branch and create one pull request. Branch pushes do not run a duplicate CI workflow; the pull request is the review gate.
3. Wait on the pull request checks once. Read detailed Actions logs only if a check fails.
4. Merge only after CI passes. Watch the single `master` workflow through deployment without repeated status polling.
5. Verify production once: deployed commit, `genilink-content` PM2 status, port 4002 response, recent error logs, disk and memory.
6. Report only meaningful transitions and the final verification result.

For a coordinated frontend and ContentOS change, gate both repositories once, use one PR per repository, deploy ContentOS first, then deploy the frontend, and perform one final production verification after both workflows finish.
