# Repository Directory Structure

```text
comp4050-epic-team/
├── README.md
├── structure.md
├── docs/                                # Project documentation
│   ├── README.md                        # Documentation index
│   ├── architecture.md                  # System design, data flow, & ADRs
│   ├── api.md                           # REST API & solver contract specification
│   └── roles.md                         # Team organization, responsibilities & workflows
├── solver/                              # Bin-packing optimization module
└── website/                             # Full-stack Next.js web application
    ├── public/                          # Assets
    └── src/
        ├── app/                         # App Router (pages & API routes)
        │   ├── api/                     # Backend API endpoints
        │   ├── login/                   # /login route
        │   ├── register/                # /register route
        │   ├── orders/                  # /orders management page
        │   ├── portal/                  # Main /portal dashboard
        │   └── visualiser/              # 3D Visualizer page (/visualiser)
        ├── components/                  # Reusable UI & Three.js components
        └── lib/                         # Helper functions & database drivers
```
