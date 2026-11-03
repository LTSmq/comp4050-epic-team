# Software Quality & Testing

## Table of Contents

1. [Quality Approach](#1-quality-approach)
2. [Development Workflow](#2-development-workflow)
   - [2.1 Branches and Pull Requests](#21-branches-and-pull-requests)
   - [2.2 Pull Request Checklist](#22-pull-request-checklist)
3. [Coding Standards](#3-coding-standards)
4. [Continuous Integration](#4-continuous-integration)
5. [Automated Tests](#5-automated-tests)
   - [5.1 Solver Test Suites](#51-solver-test-suites)
   - [5.2 Load and Performance Testing](#52-load-and-performance-testing)
6. [Manual Test Plan (Website)](#6-manual-test-plan-website)
7. [Running the Checks Locally](#7-running-the-checks-locally)
8. [Known Gaps and Next Steps](#8-known-gaps-and-next-steps)

---

## 1. Quality Approach

Quality is a shared responsibility across the three teams, and is enforced in three layers:

| Layer | What it catches | Where |
| :--- | :--- | :--- |
| **Automated gates** | Type errors, lint violations, formatting, build failures, failing tests | GitHub Actions on every pull request ([section 4](#4-continuous-integration)) |
| **Peer review** | Design problems, unclear code, missed edge cases, contract changes between teams | Pull requests into `main` ([section 2](#2-development-workflow)) |
| **Runtime checks** | Bad data crossing a boundary between subsystems | Input validation on every API route; runtime parsing of every solver reply ([ADR-003](./architecture.md#adr-003-decoupled-solver-contract-with-runtime-wire-parsing)) |

---

## 2. Development Workflow

### 2.1 Branches and Pull Requests

- Changes are merged into `main` through pull requests rather than pushed directly.
- Each change is made on its own branch and merged through a pull request, which must pass CI and be reviewed by another team member (see the review responsibilities in [Team Roles](./roles.md)).
- Changes that touch another team's code or a shared contract (the API in [`api.md`](./api.md), or the solver schema in [`solver/docs/output_schema.md`](../solver/docs/output_schema.md)) should also be reviewed by that team, because both sides depend on them.
- Work is tracked on the project board and linked to a user story, so every feature can be traced back to a stakeholder need.

### 2.2 Pull Request Checklist

Before requesting review, the author confirms:

- [ ] CI is green: lint, typecheck and build for `website/`; format, clippy, build, tests and demo for `solver/`.
- [ ] New logic has a test, or the PR explains how it was tested manually (see [section 6](#6-manual-test-plan-website)).
- [ ] A fixed bug has a test that would have caught it.
- [ ] No secrets, `.env` files or generated data are committed.
- [ ] Any change to an endpoint, data shape or environment variable is reflected in the docs (`api.md`, `architecture.md`, `setup.md`).
- [ ] UI changes were checked at phone width as well as desktop.

---

## 3. Coding Standards

| Area | Standard | Enforced by |
| :--- | :--- | :--- |
| **TypeScript** | `strict` mode; no implicit `any`; types shared between server and client rather than duplicated | `tsc --noEmit` (`npm run typecheck`) |
| **Lint (website)** | Next.js Core Web Vitals and TypeScript rule sets | ESLint 9 (`eslint.config.mjs`, `npm run lint`) |
| **Rust formatting** | Standard `rustfmt` style | `cargo fmt --check` |
| **Rust lint** | Clippy with **all warnings treated as errors** | `cargo clippy -- -D warnings`, and `RUSTFLAGS=-D warnings` in CI |
| **Structure** | Business logic in `website/src/lib`, not in route files or components; UI split into small components; Visualiser state in one reducer | Code review |
| **Security** | Validate all input at the boundary; check permissions on every route; never expose secrets to the browser (no `NEXT_PUBLIC_` secrets; server-only modules marked `server-only`) | Code review; [ADR-004](./architecture.md#adr-004-stateless-jwt-authentication-with-http-only-cookies) |
| **Comments** | Explain *why*, not *what*: the reason for a rule, a limit or a workaround | Code review |

---

## 4. Continuous Integration

All workflows live in `.github/workflows/` and run on GitHub Actions.

| Workflow | File | Runs when | Steps |
| :--- | :--- | :--- | :--- |
| **Lint Code** | `lint.yaml` | Push or PR to `main` | `npm ci`, `npm run lint` in `website/` |
| **Typecheck** | `typecheck.yaml` | Push or PR to `main` | `npm ci`, `npm run typecheck` in `website/` |
| **Build** | `build.yaml` | Push or PR to `main` | `npm ci`, `npm run build` in `website/` (uses placeholder secrets, so no real credentials are required) |
| **Solver** | `solver.yaml` | Push or PR that changes `solver/**` | Three parallel jobs: **Format** (`cargo fmt --check`), **Clippy** (`-D warnings`), and **Build and test** (`cargo build --locked`, `cargo test --locked`, doc tests, and a full run of the `demo` binary) |

Design choices:

- The website and solver workflows are independent, so a change to one does not wait for the other's CI.
- The Solver workflow uses `--locked`, so CI fails if `Cargo.lock` does not match `Cargo.toml`.
- A newer push to the same branch cancels the older Solver run, to reduce CI time.
- None of the tests needs a database, a running website or a real network service.

---

## 5. Automated Tests

### 5.1 Solver Test Suites

The Solver has 79 automated tests, run with `cargo test`.

| Suite | Location | Tests | What it covers |
| :--- | :--- | :---: | :--- |
| **Unit tests** | `#[test]` modules in `packer.rs` (28), `constraints.rs` (11) and `types.rs` (8) | 47 | The packing algorithm and free-space tracking, the placement constraints (weight, support, load bearing, compatibility groups, supply caps), and the engine's geometry types |
| **API tests** | `solver/tests/api_tests.rs` | 17 | `/solve` and `/health` end to end: both input shapes, partial packs, empty orders, `Quantity` expansion, the size limits, the `400`, `413` and `422` error cases, and `/health` staying responsive while a 5,000-unit order solves |
| **Delivery tests** | `solver/tests/delivery_tests.rs` | 9 | Optional solution delivery, using a throw-away receiver started by the test: the copy matches the reply, order IDs carry through, and a rejecting or unreachable receiver never affects the caller's answer; rejected deliveries are retried |
| **Solver tests** | `solver/tests/solver_tests.rs` | 4 | Overweight items are rejected, the output matches the Visualiser's example shape, unpacked items carry a reason code, and every unit gets its own number |
| **Solution validation** | `solver/tests/solution_validation.rs` | 2 | An independent checker confirms solutions are physically valid (legal orientations, no overlaps, items inside their cartons), on a known exact pack and on randomised orders |

The `demo` binary (`cargo run --bin demo`) is also run in CI as a smoke test, so a failure on a realistic order is detected even if no test covers that path.

### 5.2 Load and Performance Testing

`solver/data_format_example/generated/` holds a repeatable load test (see its [README](../solver/data_format_example/generated/README.md)):

- `generate_orders.py` builds ten seeded mock orders in the Portal's shape, so every run uses identical data.
- `run_orders.py` sends each one through `/solve`, checks the answer, and writes a report of carton count against a lower bound, fill rate, solve time, unpacked items and any broken rule.
- `receiver.py` and `live.html` show each solution as it arrives.

These runs verified orders of up to 10,000 items, which is why the Solver's item limit is set there. Benchmark results for the `Simple`, `SemiRealistic` and `Chaotic` example sets are recorded in `solver/docs/example_data/solverExamples/*/RESULTS.md`.

---

## 6. Manual Test Plan (Website)

These scenarios are checked manually before a release, on a phone and a desktop browser. Record the date, tester and result for each run.

| # | Scenario | Steps | Expected result |
| :--- | :--- | :--- | :--- |
| W1 | Register and sign in | Register a new user; sign out; sign in with the username, then with the email | Both sign-ins work; new user is a customer |
| W2 | Duplicate account | Register again with the same email, then the same username in different case | `409`, "already exists" message |
| W3 | Route protection | As a customer, open `/packing`, `/visualiser` and `/admin/roles` directly | Redirected to `/portal` |
| W4 | Manual order | As a customer, create an order with two items | Order gets a `PF-` ID; shows *Submitted* |
| W5 | Import order | Import the CSV example from the [User Guide](./user-guide.md#32-importing-orders-from-a-file) | Two orders staged for review, then saved |
| W6 | Invalid item | Save an item with weight `0` | Error message names the item; nothing saved |
| W7 | Auto-solve and assign | With one team user, save an order | Within seconds, appears on that packer's list as *3D Ready* |
| W8 | No packers | Demote all team users; save an order | Order shows *Awaiting assignment*; after promoting a packer, **Retry assignment** makes it *3D Ready* |
| W9 | FIFO | Packer has two ready orders; try to start the newer one | Refused: "Pack order PF-… first." |
| W10 | One at a time | Start one order, then try to start another | Refused: "Finish order PF-… first." |
| W11 | 3D guide | Open 3D on a packed-in-progress order; step through items | Every item appears in order; side panel matches the order's items |
| W12 | Item unavailable | Flag an item unavailable while packing | Order moves to *On hold* and leaves the packer |
| W13 | Restore / re-solve | As supervisor, use **Item found** on one held order and **Re-solve without item** on another | First returns to *3D Ready*; second gets a new layout without the item |
| W14 | Edit lock | As supervisor, try to edit an order that is being packed | Refused with "being packed" message |
| W15 | Oversized item | Save an item larger than the largest carton (400 mm) | Order shows *Failed* |
| W16 | Roles | As supervisor, promote a user to team; try to demote yourself | Promotion applies without re-login; self-demotion refused |
| W17 | Live updates | Two browsers on the packing list; act in one | The other updates within a few seconds, without refresh |

---

## 7. Running the Checks Locally

Run the same checks as CI before pushing:

```bash
# Website
cd website
npm ci
npm run lint
npm run typecheck
npm run build      # needs MONGODB_URI and JWT_SECRET set; any placeholder value works

# Solver
cd solver
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo run --bin demo
```

---

## 8. Known Gaps and Next Steps

The following gaps are recorded.

| Gap | Risk | Planned response |
| :--- | :--- | :--- |
| **No automated website tests.** CI checks lint, types and build, but not behaviour | A regression in order, packing or permission logic is only caught by manual testing | Add unit tests for the pure logic first (`rbac.ts`, `orders.ts` validation, `solver/solution.ts` conversion, `visualiserState.ts`), then Playwright end-to-end tests for scenarios W1 to W17 |
| **Solver push delivery does not send the callback credentials.** `POST /api/solutions` requires `x-api-key` and `x-solve-generation`, which `solver/src/api/delivery.rs` does not send | Enabling `VISUALIZER_URL` against the website would have every delivery rejected | Leave `VISUALIZER_URL` unset (the default); the direct reply path does not use it |
| **Solver README partly out of date** | It describes permissive CORS, a `0.0.0.0` default address and no authentication, which the current code has replaced | Update `solver/README.md` to match `router.rs`, `main.rs` and `auth.rs` |
| **Solver authentication has no automated test.** `auth.rs` is not covered by a `401` test | A regression could open `/solve` without a token | Add API tests for a missing, wrong and duplicated `Authorization` header |
| **Fragile, maximum-load and this-way-up rules exist in the engine but cannot be set through the API** | Fragile items are packed like any other | Add fields to the order item and the solver request together |
| **Carton catalogue is hard-coded** (`website/src/lib/solver/boxTypes.ts`) | New carton sizes need a code change and a deploy | Move carton types into MongoDB with a supervisor screen |
