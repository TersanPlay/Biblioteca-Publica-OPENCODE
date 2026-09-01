### Task 7: Frontend — Add BlockList route and nav item

**Files:**
- Modify: `frontend/src/app/router/routes.tsx` (add route)
- Modify: `frontend/src/components/layout/admin-layout.tsx` (add nav item)

**Interfaces:**
- Produces: `/admin/blocklist` route, sidebar item in Comunidade section

- [ ] **Step 1: Add route**

In `frontend/src/app/router/routes.tsx`, add inside `<RequireAuth>` but outside `<RequireAdmin>`, after the `admin/leitores/:id` route:

```tsx
import { BlockListPage } from '../../pages/admin/blocklist';
```

And add the route:

```tsx
<Route path="admin/blocklist" element={<BlockListPage />} />
```

- [ ] **Step 2: Add nav item to sidebar**

In `frontend/src/components/layout/admin-layout.tsx`, add `Ban` to the lucide-react import:

```typescript
import { Ban, BarChart3, BookMarked, /* ...rest */ } from 'lucide-react';
```

Add item to the Comunidade section, after Leitores:

```typescript
{
  label: 'Comunidade',
  items: [
    { to: '/admin/leitores', label: 'Leitores', icon: Users, adminOnly: false },
    { to: '/admin/blocklist', label: 'BlockList', icon: Ban, adminOnly: false },
    // ...rest unchanged
  ],
},
```

- [ ] **Step 3: Create placeholder for BlockListPage**

Create a minimal placeholder at `frontend/src/pages/admin/blocklist.tsx`:

```tsx
export function BlockListPage() {
  return <div>BlockList (em construção)</div>;
}
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/router/routes.tsx frontend/src/components/layout/admin-layout.tsx frontend/src/pages/admin/blocklist.tsx
git commit -m "feat(blocklist): add route and sidebar nav item"
```
