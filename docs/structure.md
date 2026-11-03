# Repository Directory Structure

```text
comp4050-epic-team/
├── README.md                            # Documentation index
├── archivedREADME.md                    # Original project brief & Sprint 1 data-flow proposals
├── .github/
│   └── workflows/                       # CI (see quality.md)
│       ├── build.yaml                   # Website: next build
│       ├── lint.yaml                    # Website: eslint
│       ├── typecheck.yaml               # Website: tsc --noEmit
│       └── solver.yaml                  # Solver: fmt, clippy, build, test, demo
├── docs/                                # Project documentation
│   ├── api.md                           # REST API & solver contract specification
│   ├── architecture.md                  # System design, data flow, & ADRs
│   ├── diagram.md                       # Sprint 2 data-flow proposal (historical)
│   ├── quality.md                       # Coding standards, CI, tests & manual test plan
│   ├── roles.md                         # Team organization, responsibilities & workflows
│   ├── setup.md                         # Installation, configuration & deployment
│   ├── structure.md                     # Repository directory structure
│   └── user-guide.md                    # How customers, packers & supervisors use the system
├── solver/                              # Bin-packing optimization module (Rust)
│   ├── Cargo.toml
│   ├── README.md                        # Solver team guide: running, endpoints, limitations
│   ├── src/
│   │   ├── main.rs                      # HTTP server entry point (`cargo run`)
│   │   ├── lib.rs                       # Crate root
│   │   ├── models.rs                    # Wire-format types
│   │   ├── types.rs                     # Types the packing engine works in
│   │   ├── packer.rs                    # The packing algorithm
│   │   ├── constraints.rs               # Placement legality rules
│   │   ├── bin/demo.rs                  # Packs a hard-coded order and prints it
│   │   └── api/
│   │       ├── auth.rs                  # Bearer-token check on /solve
│   │       ├── delivery.rs              # Optional push of solutions to another service
│   │       ├── handler.rs               # /solve and /health handlers, size limits
│   │       ├── router.rs                # URL → handler map, body limit
│   │       └── schema.rs                # Request & response JSON shapes
│   ├── tests/                           # Integration tests (api, delivery, solver, validation)
│   ├── docs/                            # Output schema, solver architecture, example data
│   ├── data_format_example/             # Portal/visualiser example payloads & load-test tools
│   └── viewer/                          # Stand-alone HTML pages for viewing raw solutions
└── website/                             # Full-stack Next.js web application
    ├── package.json                     # Scripts: dev, build, start, lint, typecheck, hostNetwork
    ├── public/                          # Assets
    └── src/
        ├── app/                         # App Router (pages & API routes)
        │   ├── api/                     # Backend API endpoints (see api.md)
        │   │   ├── auth/me/             # Current session
        │   │   ├── login/  logout/  register/
        │   │   ├── orders/              # saved/, intake/, [orderId]/solve/
        │   │   ├── packing/             # Packing list & packing actions
        │   │   ├── solutions/           # Stored layouts for the visualiser
        │   │   └── users/               # User list & role assignment
        │   ├── lib/                     # Solution store & solver response parsing
        │   ├── login/                   # /login route
        │   ├── register/                # /register route
        │   ├── portal/                  # Main /portal dashboard
        │   ├── orders/                  # /orders management page
        │   ├── packing/                 # /packing list & /packing/[orderId] screen
        │   ├── visualiser/              # 3D Visualizer page (/visualiser)
        │   ├── admin/roles/             # /admin/roles (supervisors)
        │   ├── account/                 # /account profile
        │   └── settings/                # /settings display preferences
        ├── components/                  # Reusable UI & Three.js components
        │   ├── authForm/                # Shared login/register form
        │   ├── orderForm/               # Manual entry, import, order inspector
        │   ├── visualiser-v2/           # 3D canvas, controls, item panel
        │   ├── topNavBar/  bottomBar/  sideMenu/
        │   └── settings/                # Settings context provider
        └── lib/                         # Helper functions & database drivers
            ├── auth.ts  rbac.ts  apiKey.ts   # Sessions, permissions, API keys
            ├── mongodb.ts               # Shared client & index creation
            ├── orders.ts                # Order types & validation
            ├── orders/                  # IDs, progress states, assignment, claiming, packing
            ├── solver/                  # Building requests, calling the solver, parsing replies
            └── visualiser*.ts  solutionPolling.ts   # Visualiser state, geometry, config, polling
```
