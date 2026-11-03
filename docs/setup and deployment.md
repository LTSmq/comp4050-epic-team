# Setup & Deployment Guide

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start (Local Development)](#2-quick-start-local-development)
3. [Database Setup](#3-database-setup)
4. [Environment Variables](#4-environment-variables)
   - [4.1 Website (`website/.env.local`)](#41-website-websiteenvlocal)
   - [4.2 Solver (shell environment)](#42-solver-shell-environment)
5. [First-Time Accounts](#5-first-time-accounts)
6. [Testing on a Phone](#6-testing-on-a-phone)
7. [Production Deployment](#7-production-deployment)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Used for |
| :--- | :--- | :--- |
| **Node.js** | 20 (the version CI uses) | The Next.js website |
| **npm** | Comes with Node | Installing website dependencies |
| **Rust** | Stable, 1.85 or newer (the crate uses edition 2024) | The Solver |
| **MongoDB** | 7 or newer, running as a replica set | All stored data |
| **Git** | Any recent version | Cloning the repository |

Install Rust with [rustup](https://rustup.rs). MongoDB can run locally (Docker requires the fewest steps) or on MongoDB Atlas.

---

## 2. Quick Start (Local Development)

Run the three parts in three terminals. Steps 3 and 4 share, `SOLVER_AUTH_TOKEN`; generate it once and use the same value in both.

```bash
# 1. Clone
git clone <repository-url> comp4050-epic-team
cd comp4050-epic-team

# 2. Generate a shared solver token (64 hex characters)
openssl rand -hex 32
```

**Terminal 1: MongoDB** (see [Database Setup](#3-database-setup) for details)

```bash
docker run -d --name perfectfit-mongo -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
docker exec perfectfit-mongo mongosh --eval \
  'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
```

**Terminal 2: Solver**

```bash
cd solver
SOLVER_AUTH_TOKEN=<your-token> cargo run
# → solver listening on http://127.0.0.1:8080
```

**Terminal 3: Website**

```bash
cd website
cp .env.example .env.local      # then add MONGODB_URI, JWT_SECRET etc. from section 4.1
npm ci
npm run dev
# → http://localhost:3000
```

Open <http://localhost:3000>, register an account, then follow [First-Time Accounts](#5-first-time-accounts) to create a supervisor and a packer.

---

## 3. Database Setup

The Portal uses multi-document transactions (storing a solution, assigning a packer, claiming an order, editing or deleting an order, changing roles). MongoDB only supports transactions on a replica set. A plain standalone `mongod` will start, and sign-in will work, but saving or packing an order will fail.

| Option | How |
| :--- | :--- |
| **Docker (recommended locally)** | The two commands in [Quick Start](#2-quick-start-local-development). A one-member replica set is enough |
| **Local install** | `mongod --replSet rs0 --dbpath <folder>`, then once: `mongosh --eval 'rs.initiate()'` |
| **MongoDB Atlas** | Every Atlas cluster, including the free tier, is already a replica set. Copy the connection string from *Connect → Drivers* |

Collections and indexes do not need to be created manually. On first start the website creates every index it needs (`ensureIndexes` in `website/src/lib/mongodb.ts`), and collections appear as data is written.

Connection strings:

```bash
# Local replica set
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0

# Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
```

---

## 4. Environment Variables

Do not commit real values. Every `.env*` file in `website/` except `.env.example` is git-ignored. The `.env.example` files show the solver settings; the full list is below.

### 4.1 Website (`website/.env.local`)

| Variable | Required | Example | Purpose |
| :--- | :---: | :--- | :--- |
| `MONGODB_URI` | ✓ | `mongodb://127.0.0.1:27017/?replicaSet=rs0` | Database connection. The app refuses to start without it |
| `MONGODB_DB` | | `fitvisualizer` | Database name. Defaults to `fitvisualizer` |
| `JWT_SECRET` | ✓ | output of `openssl rand -hex 32` | Signs login sessions. Changing it signs everyone out |
| `SOLVER_URL` | | `http://127.0.0.1:8080/solve` | Full solver address, including `/solve`. Must be `https://` unless it points at `localhost`/`127.0.0.1` |
| `SOLVER_AUTH_TOKEN` | ✓ | 64 hex characters | Bearer token sent to the solver. Must match the solver's value. 32 to 256 characters |
| `ORDER_INTAKE_API_KEY` | | random string | Enables `POST /api/orders/intake` for external systems. If unset, every intake request is refused |
| `SOLVER_API_KEY` | | random string | Enables the optional solver callback `POST /api/solutions`. Leave unset for the normal flow. Do not reuse `SOLVER_AUTH_TOKEN` |

Variables are server-only. None of them starts with `NEXT_PUBLIC_`, so none is ever sent to a browser.

### 4.2 Solver (shell environment)

The Solver reads its configuration from the process environment. It does not load a `.env` file by itself, so either set the variables on the command line (as in [Quick Start](#2-quick-start-local-development)) or export them in your shell first. `solver/.env.example` lists them.

| Variable | Required | Default | Purpose |
| :--- | :---: | :--- | :--- |
| `SOLVER_AUTH_TOKEN` | ✓ | none | The token `/solve` requires. The server does not start without a valid one. There is no unauthenticated mode |
| `LISTEN_ADDR` | | `127.0.0.1:8080` | Address and port to listen on. Use `0.0.0.0:<port>` inside a container |
| `VISUALIZER_URL` | | unset | Legacy push delivery of each solution. Leave unset |

---

## 5. First-Time Accounts

Registration creates a customer account. Staff roles can only be given by a supervisor, so the first supervisor account must be set directly in the database.

1. Register your own account at `/register`.
2. Promote it to supervisor:

   ```bash
   mongosh "<your MONGODB_URI>" --eval \
     'db.getSiblingDB("fitvisualizer").users.updateOne({ username: "<your-username>" }, { $set: { role: "supervisor" } })'
   ```

3. Reload the page. Your role is read from the database on every request, so you do not need to sign in again.
4. Have each packer register, then open **Portal → Manage roles** (`/admin/roles`) and set them to **team**.

> At least one `team` account is required. Every solved order is automatically assigned to a team member. With none, orders stop at *Awaiting assignment* (the API answers `503`) until a team member exists and a supervisor presses **Assign** on the packing list.

---

## 6. Testing on a Phone

The Visualiser is designed for phones. To open the development server from a phone on the same Wi-Fi network:

```bash
cd website
npm run hostNetwork        # next dev -H 0.0.0.0
```

Find your computer's local IP address (for example `192.168.1.20`) and open `http://192.168.1.20:3000` on the phone.

The Solver can stay on `127.0.0.1`, because only the website's server calls it; the phone does not.

---

## 7. Production Deployment

**Website**

```bash
cd website
npm ci
npm run build
npm start                  # serves on port 3000; set PORT to change it
```

- Set `NODE_ENV=production` (done by `npm start`). Session cookies are then marked `Secure`, so the site must be served over HTTPS.
- Set every required variable from [4.1](#41-website-websiteenvlocal) in the host's environment.
- The website can be hosted on any Node.js platform (e.g. Vercel, Google Cloud Run, a VM). It is stateless; several instances can share one database.

**Solver**

```bash
cd solver
cargo build --release
SOLVER_AUTH_TOKEN=<token> LISTEN_ADDR=0.0.0.0:8080 ./target/release/solver
```

- The Solver speaks plain HTTP. If it runs on a different host from the website, place it behind a service that terminates HTTPS (Cloud Run, a load balancer, or a reverse proxy such as Caddy or nginx), because the website will only send the token over HTTPS to a non-local address.
- Restrict network access to the Solver so that only the website can reach it.

**Checklist**

| Check | Why |
| :--- | :--- |
| MongoDB is a replica set | Transactions |
| `SOLVER_AUTH_TOKEN` identical on both services | Otherwise every solve gets `401` |
| `SOLVER_URL` ends in `/solve` and uses `https://` (unless same host) | The website validates this before calling |
| `JWT_SECRET` is long and random | It protects every session |
| Site served over HTTPS | `Secure` cookies are not sent over HTTP |
| One supervisor and at least one team account exist | Role administration and automatic assignment |

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Website fails to start: `Please define MONGODB_URI` | `.env.local` missing or not in `website/` | Copy `.env.example` to `website/.env.local` and fill it in |
| Sign-in works, but saving an order fails with a transaction error | MongoDB is standalone, not a replica set | See [Database Setup](#3-database-setup) |
| Solver exits on start: `invalid solver authentication configuration` | `SOLVER_AUTH_TOKEN` unset, shorter than 32 characters, or has invalid characters | Generate one with `openssl rand -hex 32` |
| Order goes to **Failed**; server log mentions `SOLVER_URL` | `SOLVER_URL` is not an absolute URL, or is `http://` to a non-local host | Use `http://127.0.0.1:8080/solve` locally, `https://…/solve` remotely |
| Order goes to **Failed**; server log shows `Solver failed: Unauthorized` | Tokens differ between website and solver | Set the same `SOLVER_AUTH_TOKEN` on both and restart both |
| Order goes to **Failed**; server log shows `fetch failed` | Solver not running or wrong port | Start the solver; check `curl http://127.0.0.1:8080/health` returns `ok` |
| Order goes to **Failed**; server log shows `Solver could not fit: … (TooLarge)` | An item is bigger than every carton in `website/src/lib/solver/boxTypes.ts` | Correct the item's dimensions, or add a larger carton type |
| Order stuck on **Awaiting assignment** | No user has the `team` role | Promote a packer, then press **Assign** on the packing list |
| Phone cannot reach the site | Dev server bound to localhost only | Use `npm run hostNetwork`, and check both devices are on the same network |
| `cargo run` fails: `could not bind 127.0.0.1:8080` | Port in use | `LISTEN_ADDR=127.0.0.1:9099 cargo run`, and update `SOLVER_URL` to match |
