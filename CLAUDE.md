@AGENTS.md

## Deploy every finished change to production

The owner has authorized this for every session in this project: when a change is finished, commit it and push it to production without asking. A preview is not enough.

1. Run `npx tsc --noEmit`, `npx eslint`, `npx vitest run` and `npx next build`. If one fails, fix it or report it to the owner. Don't deploy a failing change.
2. Commit the change.
3. Run `git push origin HEAD:claude/focused-bardeen-qfop4m`. Vercel deploys production from this branch, and every other branch only gets a preview.
4. If the push is rejected as not fast-forward, rebase on that branch and run the checks again. Never force-push.
5. Check that the deployment reaches `READY` with target `production`, then tell the owner. If you can't check it, say so.

If a permission check blocks the push, tell the owner and stop. Don't look for another way to deploy.
