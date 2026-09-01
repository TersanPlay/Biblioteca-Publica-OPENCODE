### Task 8: Frontend — BlockList page — Report

**Status:** DONE

**Files modified:**
- `frontend/src/pages/admin/blocklist.tsx` — replaced placeholder with full BlockList page

**Commands run:**
- `npm run build` (frontend) — first pass failed with 3 TS errors:
  - `Ban` imported but unused
  - `toast.success` / `toast.error` not on `useToast` return type (needed `useApiToast`)
- Fixed: removed unused import, changed `useToast` → `useApiToast`
- `npm run build` (frontend) — second pass: success (tsc + vite)
- `git commit -m "feat(blocklist): add BlockList page with search, checkboxes, batch unblock"` — committed as `d9a1006`

**Concerns:**
- The task brief's code snippet used `useToast` but the correct hook for `toast.success()`/`toast.error()` is `useApiToast`. This was a bug in the brief, fixed during implementation.
