# System Architecture

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture & System Diagram](#2-high-level-architecture--system-diagram)
3. [Subsystem Breakdown](#3-subsystem-breakdown)
   - [3.1 Portal & API Gateway (`website/src/app`)](#31-portal--api-gateway-websitesrcapp)
   - [3.2 3D Visualiser Subsystem (`website/src/components/visualiser-v2`)](#32-3d-visualiser-subsystem-websitesrccomponentsvisualiser-v2)
   - [3.3 Solver Subsystem (`solver/`)](#33-solver-subsystem-solver)
   - [3.4 Data Persistence Layer (`MongoDB`)](#34-data-persistence-layer-mongodb)
4. [End-to-End Data Flow & Sequence Diagram](#4-end-to-end-data-flow--sequence-diagram)
5. [Architectural Decision Records (ADRs)](#5-architectural-decision-records-adrs)
   - [ADR-001: Next.js App Router for Unified Fullstack Architecture](#adr-001-nextjs-app-router-for-unified-fullstack-architecture)
   - [ADR-002: Declarative 3D Graphics via React Three Fiber](#adr-002-declarative-3d-graphics-via-react-three-fiber)
   - [ADR-003: Decoupled Solver Contract with Runtime Wire Parsing](#adr-003-decoupled-solver-contract-with-runtime-wire-parsing)
   - [ADR-004: Stateless JWT Authentication with HTTP-Only Cookies](#adr-004-stateless-jwt-authentication-with-http-only-cookies)
6. [Non-Functional Attributes & Quality Standards](#6-non-functional-attributes--quality-standards)

---

## 1. System Overview

**Perfect Fit** is a warehouse packing assistant. It takes a customer order (a list of rectangular items with dimensions and weights), works out how to pack those items into as few cartons as possible, and shows warehouse staff a 3D, step-by-step view of where each item goes. The intended user is a warehouse worker on a phone, so the interface is mobile-first.

The system is made of three cooperating parts, each owned by a different team:

| Part | Team | Technology | Responsibility |
| :--- | :--- | :--- | :--- |
| **Portal** | Epic Portal | Next.js (App Router), TypeScript | Authentication, role-based access, order intake and management, packing workflow, data storage in MongoDB, and the API gateway to everything else |
| **Visualiser** | Epic Visualiser | React Three Fiber / three.js, TypeScript | Interactive 3D rendering of packing solutions for packers |
| **Solver** | Epic Solver | Rust (axum, tokio) | The 3D bin-packing engine: decides which carton each item goes in, and exactly where |

All saved data (user accounts, orders and packing solutions) is stored in a **MongoDB** database, which the Portal team owns. The Portal and Visualiser ship together as a single Next.js application in `website/`; the Solver is a separate Rust service in `solver/`.

---

## 2. High-Level Architecture & System Diagram

---

## 3. Subsystem Breakdown

### 3.1 Portal & API Gateway (`website/src/app`)

### 3.2 3D Visualiser Subsystem (`website/src/components/visualiser-v2`)

The Visualiser renders each carton of a solved order and animates items dropping into place in packing order.

| File | Responsibility |
| :--- | :--- |
| `visualiserClient.tsx` | Takes a solved `Order` and renders the package picker, canvas, controls and item side panel. Owns the zoom level and the reducer state |
| `visualiserCanvas.tsx` | The React Three Fiber `<Canvas>`: package grid, selected-package inspection, drop animation (`useFrame`) |
| `visualiserControls.tsx` | Step between packages and between items, switch between package and item inspection, reset the selection, and zoom |
| `itemInfoPanel.tsx` | Details for the item being inspected: SKU, reference, box group, weight, position, size and volume |
| `types.ts` | Shared types (`VisualiserCarton`, `packingItem`, `vector3Data`) |

The page itself is `website/src/app/visualiser/VisualiserClient.tsx`. It reads an optional `?orderId=` query parameter, fetches the solution (see `solutionPolling.ts` below) and hands the converted `Order` to the component above. Packers reach it from the *Open 3D* button on the packing screen.

Supporting logic lives in `website/src/lib/`:

- `visualiserState.ts`: a **reducer** (`visualiserReducer`, `initVisualiserState`, `getDisplayState`) that holds which package is selected and which item the user is on. Keeping this as a plain reducer separates state transitions from rendering.
- `visualiserGeometry.ts`: pure functions for scaling and camera framing (`fitScale`, `getPackageViewDiameter`).
- `visualiserConfig.ts`: a `Partial<VisualiserConfig>` of colours, opacities, grid layout and animation timings, so appearance is tunable without touching rendering code.
- `solutionPolling.ts`: polls `GET /api/solutions?orderId=…` (or `?latest=true` when no order is given) every 2 seconds with a 10 second timeout. Polls run one at a time so a slow response cannot overwrite newer data, and the last good solution stays on screen if a refresh fails. It validates the response and converts stored cartons to the Visualiser's `Order` model (`convertCartonsToV2Order` in `app/lib/responseParser.ts`).


### 3.3 Solver Subsystem (`solver/`)

### 3.4 Data Persistence Layer (`MongoDB`)

---

## 4. End-to-End Data Flow & Sequence Diagram

---

## 5. Architectural Decision Records (ADRs)

### ADR-001: Next.js App Router for Unified Fullstack Architecture

### ADR-002: Declarative 3D Graphics via React Three Fiber

### ADR-003: Decoupled Solver Contract with Runtime Wire Parsing

### ADR-004: Stateless JWT Authentication with HTTP-Only Cookies

---

## 6. Non-Functional Attributes & Quality Standards
