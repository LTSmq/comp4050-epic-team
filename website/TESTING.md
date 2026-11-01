# Portal unit tests

Run from `website/`:

```bash
npm test            # run once
npm run test:watch  # re-run on save
```

Tests sit next to the file they test (`foo.ts` → `foo.test.ts`) and use [Vitest](https://vitest.dev).
MongoDB, the solver, JWT, bcrypt and Next's `cookies()` / `redirect()` are mocked, so no database,
solver or `.env.local` is needed.

## What is covered

| Area | Files |
|---|---|
| Roles and access | `lib/rbac`, `lib/auth`, `lib/apiKey`, `app/settings/layout`, `app/visualiser/page` |
| Orders | `lib/orders`, `lib/orders/validateOrder`, `lib/orders/generateOrderId`, `components/orderForm/orderUtils` |
| Solving | `lib/solver/parser`, `orderAdapter`, `request`, `boxTypes`, `solution`, `server/runOrderSolve`, `app/lib/solutionStore` |
| Assignment and packing | `lib/orders/autoAssign`, `claimAssigned`, `packing`, `progress`, `markProgress` |
| API routes | login, register, logout, auth/me, users, users/[userId]/role, orders/saved, orders/saved/[orderId], orders/intake, orders/[orderId]/solve, packing, packing/[orderId], solutions |

React components (pages, forms, the packing screens) are not unit-tested here; they are better
covered by end-to-end tests (e.g. Playwright).

## Writing a new test

- Mock modules with `vi.mock("@/lib/...", () => ({ ... }))`. Values the factory needs must come
  from `vi.hoisted(...)`, because Vitest moves `vi.mock` calls to the top of the file.
- Anything importing `@/lib/mongodb` must mock it, or the import fails without `MONGODB_URI`.
- Route handlers are plain functions: call `POST(new Request(url, { method, body }))` and check
  `response.status` and `await response.json()`.
