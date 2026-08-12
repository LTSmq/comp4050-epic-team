# Repository Directory Structure

```text
comp4050-epic-team/
├── README.md
├── structure.md
├── solver/                              
└── website/                             # Full-stack Next.js web application
    ├── public/                          # Assets
    └── src/
        ├── app/                         # App Router (pages & layout)
        │   ├── api/                     # Backend API endpoints
        │   ├── login/                   # /login route
        │   ├── register/                # /register route
        │   └── visualiser/              # 3D Visualizer page (/visualiser)
        ├── components/                  # Reusable UI components
        └── lib/                         # Helper functions & JSON parsers
```
