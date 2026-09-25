# System Architecture

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture & System Diagram](#2-high-level-architecture--system-diagram)
3. [Subsystem Breakdown](#3-subsystem-breakdown)
   - [3.1 Portal & API Gateway (`website/src/app`)](#31-portal--api-gateway-websitesrcapp)
   - [3.2 3D Visualizer Subsystem (`website/src/components/visualiser`)](#32-3d-visualizer-subsystem-websitesrccomponentsvisualiser)
   - [3.3 Solver Subsystem (`solver/`)](#33-solver-subsystem-solver)
   - [3.4 Data Persistence Layer (`MongoDB`)](#34-data-persistence-layer-mongodb)
4. [End-to-End Data Flow & Sequence Diagram](#4-end-to-end-data-flow--sequence-diagram)
5. [Architectural Decision Records (ADRs)](#5-architectural-decision-records-adrs)
   - [ADR-001: Next.js App Router for Unified Fullstack Architecture](#adr-001-nextjs-app-router-for-unified-fullstack-architecture)
   - [ADR-002: Declarative 3D Graphics via React Three Fiber](#adr-002-declarative-3d-graphics-via-react-three-fiber)
   - [ADR-003: Decoupled Solver Contract with Runtime Wire Parsing](#adr-003-decoupled-solver-contract-with-runtime-wire-parsing)
   - [ADR-004: Stateless JWT Authentication with HTTP-Only Cookies](#adr-004-stateless-jwt-authentication-with-http-only-cookies)
6. [Non-Functional Attributes & Quality Standards](#6-non-functional-attributes--quality-standards)
