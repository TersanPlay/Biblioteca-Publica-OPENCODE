## Status: DONE

## Files modified
- `backend/src/modules/loan.routes.ts` (lines 249-280)

## Commands run and output
- `npx tsc --noEmit` → no errors
- `git commit` → `3e10497 feat(blocklist): auto-block readers with 2+ overdue loans on return`

## One-line test summary
TypeScript compiles cleanly; auto-block logic counts OVERDUE loans per reader and blocks ACTIVE readers with 2+.

## Concerns
None.
