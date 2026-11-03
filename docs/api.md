# API Specification

## Table of Contents

1. [Global Conventions](#1-global-conventions)
   - [1.1 Base URLs](#11-base-urls)
   - [1.2 Authentication Methods](#12-authentication-methods)
   - [1.3 Roles and Permissions](#13-roles-and-permissions)
   - [1.4 Data Formats and Units](#14-data-formats-and-units)
   - [1.5 Error Responses](#15-error-responses)
   - [1.6 Order Progress States](#16-order-progress-states)
2. [Authentication Endpoints](#2-authentication-endpoints)
   - [2.1 Register New User (`POST /api/register`)](#21-register-new-user)
   - [2.2 User Login (`POST /api/login`)](#22-user-login)
   - [2.3 User Logout (`POST /api/logout`)](#23-user-logout)
   - [2.4 Get Current Session / Profile (`GET /api/auth/me`)](#24-get-current-session--profile)
3. [Order Management Endpoints](#3-order-management-endpoints)
   - [3.1 List Saved Orders (`GET /api/orders/saved`)](#31-list-saved-orders)
   - [3.2 Create or Upsert Saved Order (`POST /api/orders/saved`)](#32-create-or-upsert-saved-order)
   - [3.3 Get Order by ID (`GET /api/orders/saved/[orderId]`)](#33-get-order-by-id)
   - [3.4 Delete Order (`DELETE /api/orders/saved/[orderId]`)](#34-delete-order)
   - [3.5 Update Order (`PUT /api/orders/saved/[orderId]`)](#35-update-order)
   - [3.6 Re-solve Order (`POST /api/orders/[orderId]/solve`)](#36-re-solve-order)
   - [3.7 External Order Intake (`POST /api/orders/intake`)](#37-external-order-intake)
4. [Packing Solution & Visualizer Endpoints](#4-packing-solution--visualizer-endpoints)
   - [4.1 Ingest Solver Solution (`POST /api/solutions`)](#41-ingest-solver-solution)
   - [4.2 Query Packing Solutions (`GET /api/solutions`)](#42-query-packing-solutions)
5. [Packing Workflow Endpoints](#5-packing-workflow-endpoints)
   - [5.1 Packing List (`GET /api/packing`)](#51-packing-list)
   - [5.2 Packing Order Detail (`GET /api/packing/[orderId]`)](#52-packing-order-detail)
   - [5.3 Packing Actions (`POST /api/packing/[orderId]`)](#53-packing-actions)
6. [User Administration Endpoints](#6-user-administration-endpoints)
   - [6.1 List Users (`GET /api/users`)](#61-list-users)
   - [6.2 Assign Role (`PATCH /api/users/[userId]/role`)](#62-assign-role)
7. [Solver Service Contract](#7-solver-service-contract)
   - [7.1 Health Check (`GET /health`)](#71-health-check)
   - [7.2 Solve Order (`POST /solve`)](#72-solve-order)

---

## 1. Global Conventions

### 1.1 Base URLs

| Service | Default address | Notes |
| :--- | :--- | :--- |
| **Portal API** (Next.js) | `http://localhost:3000/api` | Every endpoint in sections 2 to 6. Served by the same process as the web pages |
| **Solver service** (Rust) | `http://127.0.0.1:8080` | Section 7. Called only by the Portal's server, never by a browser. Set on the website with `SOLVER_URL` |

### 1.2 Authentication Methods

The API uses three kinds of credential, one for each kind of caller.

| Caller | Credential | Used by |
| :--- | :--- | :--- |
| **Signed-in user** (browser) | `auth_token` cookie: an HS256 JWT, HTTP-only, `SameSite=Lax`, valid for 24 hours, set by `POST /api/login` | All user-facing endpoints |
| **External order system** | `x-api-key` header, compared against `ORDER_INTAKE_API_KEY` | `POST /api/orders/intake` |
| **Solver callback** | `x-api-key` header, compared against `SOLVER_API_KEY`, plus an `x-solve-generation` header | `POST /api/solutions` |
| **Portal → Solver** | `Authorization: Bearer <SOLVER_AUTH_TOKEN>` | `POST /solve` on the solver |

API keys are compared in constant time (`website/src/lib/apiKey.ts`), so response timing does not leak the key.

The user's **role is always read from the database**, not from the token. A role change made by a supervisor therefore applies on the user's next request, without them signing in again (`website/src/lib/auth.ts`).

### 1.3 Roles and Permissions

There are three roles. New accounts are always `customer`; only a supervisor can promote someone (see [6.2](#62-assign-role)). Permissions are defined in one table in `website/src/lib/rbac.ts`.

| Permission | What it allows | `customer` | `team` | `supervisor` |
| :--- | :--- | :---: | :---: | :---: |
| `order:create` | Create orders | ✓ | ✓ | ✓ |
| `order:read` | Read orders and solutions within the caller's scope | ✓ | ✓ | ✓ |
| `order:update` | Edit an order's items, source or status | | | ✓ |
| `order:delete` | Delete an order | | | ✓ |
| `order:pack` | Claim, release, mark packed, flag an item unavailable | | ✓ | ✓ |
| `order:supervise` | See every order, override packers, resolve holds, re-solve, reopen | | | ✓ |
| `user:read` | List users | | ✓ | ✓ |
| `role:assign` | Change a user's role | | | ✓ |

**Scope** narrows what a permitted user can see:

- A **customer** only sees orders where they are the customer.
- A **team** member sees only orders **assigned to them** on packing and visualiser endpoints.
- A **supervisor** sees everything.

An order outside the caller's scope is reported as `404 Not Found` rather than `403 Forbidden`, so order IDs cannot be probed.

### 1.4 Data Formats and Units

- All bodies are JSON (`Content-Type: application/json`).
- Order items use **PascalCase** keys, matching the solver's wire format.
- **Dimensions are millimetres. Weights entered on orders are grams.** The Portal converts grams to kilograms before calling the solver (`website/src/lib/solver/orderAdapter.ts`).
- Order IDs are generated by the server in the form `PF-000123`. A client never chooses an order ID.
- Timestamps are ISO 8601 strings in UTC.

An **order item** has this shape:

| Field | Type | Required | Notes |
| :--- | :--- | :---: | :--- |
| `ItemCode` | string | ✓ | Product code, e.g. `ITM-001` |
| `ItemReference` | string | ✓ | Human-readable name |
| `Width` | number | ✓ | mm, greater than 0 |
| `Length` | number | ✓ | mm, greater than 0 |
| `Depth` | number | ✓ | mm, greater than 0 |
| `Weight` | number | ✓ | grams, greater than 0 |
| `BoxGroup` | string | | Compatibility group. Items only share a carton with items of the same group |

### 1.5 Error Responses

Errors are JSON with a single message field. The authentication endpoints (section 2) use `message`; every other endpoint uses `error`.

```json
{ "error": "Order not found" }
```

| Status | Meaning |
| :--- | :--- |
| `400` | The body is missing, malformed or fails validation. The message names the problem (e.g. `Item 2 requires ItemCode.`) |
| `401` | No valid session, or a missing/incorrect API key |
| `403` | Signed in, but the role does not have the permission |
| `404` | Not found, **or** outside the caller's scope |
| `409` | Conflict: the order is locked for packing, changed since it was read, or the solve was superseded. Refresh and retry |
| `422` | The solver could not fit every item. The message lists the items and reasons |
| `502` | The solver replied with something that is not a valid solution |
| `503` | The packing layout was saved, but no team member was available to assign it to |

### 1.6 Order Progress States

Every order carries a `progress` field. It drives the packing list and decides which actions are allowed.

| `progress` | Staff label | Meaning |
| :--- | :--- | :--- |
| `submitted` | Submitted | Saved, not yet solved |
| `solving` | Solving | A request to the solver is in flight |
| `awaiting_assignment` | Awaiting assignment | A layout is saved but no packer has been assigned yet |
| `ready` | 3D Ready | Solved and assigned; waiting for the packer to start |
| `packing` | Packing | Claimed by a packer |
| `on_hold` | On hold | A packer flagged an item as unavailable |
| `packed` | Packed | Finished |
| `failed` | Failed | The solver could not produce a complete layout |

Customers only ever see two labels: **Submitted** and **Packed**.

---

## 2. Authentication Endpoints

### 2.1 Register New User

`POST /api/register` · Public

Creates a `customer` account. Staff roles are never self-assigned.

**Request**

```json
{ "username": "jsmith", "email": "jsmith@example.com", "password": "correct-horse" }
```

| Field | Rule |
| :--- | :--- |
| `username` | 3 to 32 characters: letters, digits, `.`, `_`, `-`. No `@`, so a username can never look like an email |
| `email` | A valid email address. Stored lower-case |
| `password` | 8 to 72 bytes (bcrypt's limit). Hashed with bcrypt, cost 12 |

**Responses**

| Status | Body |
| :--- | :--- |
| `201` | `{ "message": "User registered successfully", "user": { "id", "username", "email", "role": "customer" } }` |
| `400` | Missing field or a rule above broken |
| `409` | The email or username is taken (usernames are compared case-insensitively) |

### 2.2 User Login

`POST /api/login` · Public

Signs in with **either** a username or an email in the `email` field. A value containing `@` is treated as an email, anything else as a username.

**Request**

```json
{ "email": "jsmith", "password": "correct-horse" }
```

**Responses**

| Status | Body |
| :--- | :--- |
| `200` | `{ "message": "Login successful", "user": { "id", "username", "email", "role" } }` and the `auth_token` cookie is set |
| `400` | Username/email or password missing |
| `401` | `Invalid username/email or password` (the same message for an unknown user and a wrong password) |

### 2.3 User Logout

`POST /api/logout` · Public

Clears the `auth_token` cookie. Always returns `200 { "message": "Logged out successfully" }`.

### 2.4 Get Current Session / Profile

`GET /api/auth/me` · Signed in

Returns the signed-in user, with the role as currently stored in the database. The client uses this to decide which navigation items to show (`website/src/lib/useRole.ts`).

| Status | Body |
| :--- | :--- |
| `200` | `{ "authenticated": true, "user": { "id", "username", "email", "role" } }` |
| `401` | `{ "authenticated": false, "message": "Invalid or expired session" }` |

---

## 3. Order Management Endpoints

### 3.1 List Saved Orders

`GET /api/orders/saved` · `order:read`

Returns the orders in the caller's scope, newest change first.

| Query parameter | Effect |
| :--- | :--- |
| `customerId` | Staff only: narrow the list to one customer. Ignored for customers, who always see only their own |

**Response** `200`

```json
{
  "orders": [
    {
      "orderId": "PF-000042",
      "source": "Manual",
      "status": "Available",
      "items": [ { "ItemCode": "ITM-001", "ItemReference": "Widget A", "Width": 200, "Length": 100, "Depth": 100, "Weight": 450 } ],
      "customerId": "665f…",
      "customerName": "jsmith",
      "progress": "ready",
      "createdAt": "2026-10-20T03:11:00.000Z",
      "updatedAt": "2026-10-20T03:11:02.000Z"
    }
  ]
}
```

### 3.2 Create or Upsert Saved Order

`POST /api/orders/saved` · `order:create`

Saves a new order, then **immediately sends it to the solver**. When the solve succeeds the order is automatically assigned to a packer. The order ID is generated by the server.

**Request**

```json
{
  "source": "Manual",
  "status": "Available",
  "customerId": "665f…",
  "items": [ { "ItemCode": "ITM-001", "ItemReference": "Widget A", "Width": 200, "Length": 100, "Depth": 100, "Weight": 450 } ]
}
```

| Field | Rule |
| :--- | :--- |
| `source` | `External`, `Manual` or `Imported` |
| `status` | `Available`, `Draft` or `Imported` |
| `items` | An array of order items (see [1.4](#14-data-formats-and-units)) |
| `customerId` | **Required for staff**, who create orders on a customer's behalf. Ignored for customers, who always create for themselves |

**Responses**

| Status | Body |
| :--- | :--- |
| `201` | The saved order, including its new `orderId` and the `progress` reached after solving |
| `400` | Validation failed, or `customerId` missing or invalid |
| `404` | `customerId` does not belong to a customer |

> A `201` means the order was **saved**. Check `progress` in the response: `failed` means the solver could not fit every item, and a supervisor can edit the order and re-solve it.

### 3.3 Get Order by ID

`GET /api/orders/saved/[orderId]` · `order:read`

| Status | Body |
| :--- | :--- |
| `200` | `{ "order": { … } }` |
| `404` | Not found, or not in the caller's scope |

### 3.4 Delete Order

`DELETE /api/orders/saved/[orderId]` · `order:delete` (supervisor)

Deletes the order and its stored solution in one transaction.

| Status | Body |
| :--- | :--- |
| `200` | `{ "success": true }` |
| `404` | Order not found |

### 3.5 Update Order

`PUT /api/orders/saved/[orderId]` · `order:update` (supervisor)

Replaces an order's `source`, `status` and `items`. **If the items change**, the old layout is wrong, so the order goes back to `submitted`, its solution and assignment are cleared, and a new solve starts automatically.

**Request** has the same `source`, `status` and `items` fields as [3.2](#32-create-or-upsert-saved-order).

| Status | Body |
| :--- | :--- |
| `200` | The updated order |
| `400` | Invalid `source`, `status` or items |
| `404` | Order not found |
| `409` | The order is `packing` or `packed` and is locked, or it changed after it was read (`Order changed. Refresh and try again.`) |

### 3.6 Re-solve Order

`POST /api/orders/[orderId]/solve` · `order:supervise` (supervisor)

Sends the order to the solver again. Items flagged unavailable are left out of the request.

| Status | Body |
| :--- | :--- |
| `200` | `{ "success": true, "orderId", "result": <solver solution> }` |
| `400` | The order has no available items, or is invalid |
| `404` | Order not found |
| `409` | The order is being packed, packed or on hold, or another solve replaced this one |
| `422` | The solver could not fit every item: `{ "success": false, "error": "Solver could not fit: …", "solverResult" }` |
| `502` | The solver's reply was not a valid solution |
| `503` | Layout saved, but no team member is available to assign it to |

### 3.7 External Order Intake

`POST /api/orders/intake` · API key (`x-api-key: <ORDER_INTAKE_API_KEY>`)

The machine-to-machine entry point for orders coming from another system (a web shop, an ERP). **Only `items` and an optional `customerId` are read from the body.** Everything else (ID, source, status, progress, assignment) is set by the Portal, so an external sender cannot place an order straight into a packer's queue.

**Request**

```json
{
  "customerId": "665f…",
  "items": [ { "ItemCode": "ITM-001", "ItemReference": "Widget A", "Width": 200, "Length": 100, "Depth": 100, "Weight": 450 } ]
}
```

Without a `customerId`, the order is saved with `customerName: "Unassigned"`.

| Status | Body |
| :--- | :--- |
| `201` | The saved order, with `source: "External"` and `status: "Available"` |
| `400` | Invalid items or `customerId` |
| `401` | Missing or wrong API key |
| `404` | `customerId` does not belong to a customer |

---

## 4. Packing Solution & Visualizer Endpoints

### 4.1 Ingest Solver Solution

`POST /api/solutions` · API key (`x-api-key: <SOLVER_API_KEY>`) and `x-solve-generation`

A callback for the solver to deliver a solution asynchronously. The normal flow does **not** need it, because the Portal reads the solution from the solver's direct reply (see [architecture §4](./architecture.md#4-end-to-end-data-flow--sequence-diagram)). It is kept for the solver's optional delivery feature.

`x-solve-generation` must match the solve currently in progress for that order. A solution from an older or replaced solve is rejected, so a slow reply can never overwrite a newer layout.

The body is the solver reply described in [7.2](#72-solve-order).

| Status | Body |
| :--- | :--- |
| `200` | `{ "success": true }`. The layout is stored and the order assigned |
| `400` | Not JSON, or not a valid solution (`path` names the bad field) |
| `401` | Missing or wrong API key |
| `409` | Missing generation, or the order/solve has changed since the request was sent |
| `422` | The solution has unpacked items. The order is marked `failed` |
| `503` | Stored, but no team member is available to assign it to |

### 4.2 Query Packing Solutions

`GET /api/solutions` · `order:read`

Used by the 3D Visualiser (`website/src/lib/solutionPolling.ts`). Only orders that have a layout (`awaiting_assignment`, `ready`, `packing`, `on_hold` or `packed`) are returned.

| Query | Who may use it | Returns |
| :--- | :--- | :--- |
| `?orderId=PF-000042` | Anyone, within their scope | That order's cartons |
| `?latest=true` | Staff | The most recently updated solved order in scope |
| *(none)* | Supervisors | A summary list of every stored solution |

**Response for `orderId` or `latest`** `200`

```json
{
  "orderId": "PF-000042",
  "receivedAt": "2026-10-20T03:11:02.000Z",
  "cartons": [
    {
      "boxIndex": 0,
      "boxReference": "MED",
      "containerSize": { "x": 0.4, "y": 0.4, "z": 0.4 },
      "items": [
        {
          "uuid": "0-ITM-001-0",
          "itemCode": "ITM-001",
          "itemReference": "Widget A",
          "position": { "x": 0, "y": 0, "z": 0 },
          "size": { "x": 0.2, "y": 0.1, "z": 0.1 },
          "weight": 0.45,
          "boxGroup": null
        }
      ]
    }
  ]
}
```

Carton coordinates here are **metres with y vertical**, ready for three.js. The conversion from the solver's millimetres with z vertical happens once, on the server, in `toVisualiserCartons` (`website/src/lib/solver/solution.ts`).

**Response for the full list** `200`

```json
{ "success": true, "solutions": [ { "orderId": "PF-000042", "receivedAt": "…", "cartonCount": 2, "itemCount": 14 } ] }
```

| Status | Meaning |
| :--- | :--- |
| `403` | A customer asked for `latest` or the list, or a team member asked for the list |
| `404` | No solution for that order in the caller's scope, or no solutions yet |

All responses are sent with `Cache-Control: no-store`.

---

## 5. Packing Workflow Endpoints

These endpoints back the warehouse packing screens (`/packing`). All require `order:pack`. Team members only see orders assigned to them; supervisors see all.

### 5.1 Packing List

`GET /api/packing` · `order:pack`

Returns every order that is `awaiting_assignment`, `ready`, `packing` or `on_hold`, plus orders `packed` in the last **12 hours**, oldest solve first (up to 500 rows). The screen polls this every 2 seconds.

| Query | Effect |
| :--- | :--- |
| `since=<cursor>` | Return only rows changed after the cursor. If there are too many changes, the full list is sent instead with `reset: true` |

**Response** `200`

```json
{
  "reset": false,
  "rows": [
    {
      "orderId": "PF-000042",
      "customerName": "Unassigned",
      "progress": "ready",
      "itemCount": 14,
      "assignedUserId": "6660…",
      "assignedUserName": "packer1",
      "assignedAt": "…",
      "packer": null,
      "claimedAt": null,
      "packedBy": null,
      "packedAt": null,
      "holdItemCode": null,
      "solvedAt": "…",
      "updatedAt": "…"
    }
  ],
  "cursor": "2026-10-20T03:12:58.000Z",
  "now": "2026-10-20T03:13:00.000Z"
}
```

Pass `cursor` back as `since` on the next poll. It is set 2 seconds before `now` so an update that lands during a request is not missed.

### 5.2 Packing Order Detail

`GET /api/packing/[orderId]` · `order:pack`

Returns one order with its items for the packing screen. Customer details are left out.

| Query | Effect |
| :--- | :--- |
| `since=<updatedAt>` | If the order has not changed, reply `204 No Content` instead of the full body |

| Status | Body |
| :--- | :--- |
| `200` | `{ "order": { …row fields, "items": [ … ] }, "now" }` |
| `204` | Unchanged since `since` |
| `404` | Not found, or not assigned to the caller |

### 5.3 Packing Actions

`POST /api/packing/[orderId]` · `order:pack`

Moves an order through the packing workflow.

**Request**

```json
{ "action": "unavailable", "itemIndex": 3 }
```

| `action` | Who | From → To | What it does |
| :--- | :--- | :--- | :--- |
| `claim` | Assigned packer, supervisor | `ready` → `packing` | Start packing. A packer may hold **one** order at a time and must take their orders **oldest first (FIFO)**. A claim left for over 30 minutes can be taken over |
| `release` | Packer (own claim), supervisor | `packing` → `ready` | Stop without finishing |
| `packed` | Packer (own claim), supervisor | `packing` → `packed` | Finish the order |
| `unavailable` | Packer (own claim), supervisor | `packing`/`ready` → `on_hold` | Flag the item at `itemIndex` as out of stock. **`itemIndex` is required** |
| `restore` | Supervisor | `on_hold` → `ready`, `awaiting_assignment` or `submitted` | Put the held item back. The old layout is reused if it still covers every item; otherwise the order is re-solved |
| `resolve` | Supervisor | `on_hold` → `submitted` → solved | Pack the order **without** the unavailable item: clear the layout and re-solve |
| `assign` | Supervisor | `awaiting_assignment` → `ready` | Retry automatic assignment, for example after adding a team member |
| `reopen` | Supervisor | `packed` → `ready` | Undo a mistaken "packed" |

| Status | Body |
| :--- | :--- |
| `200` | `{ "order": { … }, "now" }` with the updated order |
| `400` | Invalid JSON, unknown action, or a missing `itemIndex` |
| `403` | A team member tried a supervisor-only action |
| `404` | Not found, or not assigned to the caller |
| `409` | The action is not valid in the current state. The message explains why, e.g. `Pack order PF-000040 first.`, `Finish order PF-000039 first.` or `Being packed by packer2.` |
| `503` | `assign` found no team member to assign to |

---

## 6. User Administration Endpoints

### 6.1 List Users

`GET /api/users` · `user:read` (team, supervisor)

Supervisors see every account. **Team members only see customers**, which is all they need for the "Create order for" picker.

| Query | Effect |
| :--- | :--- |
| `q` | Case-insensitive search on username or email. Matched literally, never run as a regular expression |
| `role` | Supervisors only: `customer`, `team` or `supervisor` |
| `limit` | 1 to 100, default 50 |
| `skip` | Offset for paging, default 0 |

**Response** `200`

```json
{ "total": 37, "users": [ { "id": "665f…", "username": "jsmith", "email": "jsmith@example.com", "role": "customer" } ] }
```

### 6.2 Assign Role

`PATCH /api/users/[userId]/role` · `role:assign` (supervisor)

**Request**

```json
{ "role": "team" }
```

Two safety rules are enforced inside a transaction, so concurrent changes cannot break them:

- A supervisor **cannot remove their own** supervisor role.
- The **last supervisor** can never be demoted, so the system can never be left without one.

| Status | Body |
| :--- | :--- |
| `200` | `{ "success": true, "userId", "role" }` |
| `400` | Invalid ID or role, self-demotion, or last supervisor |
| `403` | The caller is no longer a supervisor |
| `404` | User not found |

---

## 7. Solver Service Contract

The solver is a separate Rust service (`solver/`). It is called only by the Portal's server, using `postSolverRequest` in `website/src/lib/solver/server/client.ts`. The full output contract is in [`solver/docs/output_schema.md`](../solver/docs/output_schema.md); this section summarises what the Portal relies on.

### 7.1 Health Check

`GET /health` · Public

Returns `200` with the text `ok`. It does no work: a reply just means the server is running.

### 7.2 Solve Order

`POST /solve` · `Authorization: Bearer <SOLVER_AUTH_TOKEN>`

**Request headers sent by the Portal**

| Header | Value |
| :--- | :--- |
| `Authorization` | `Bearer <SOLVER_AUTH_TOKEN>`. 32 to 256 characters, identical on both services |
| `Content-Type` | `application/json` |
| `X-Solve-Generation` | A random UUID identifying this solve attempt |

The Portal enforces **HTTPS** for `SOLVER_URL`; plain HTTP is only allowed to `localhost`, so the token is never sent unencrypted over a network. Requests time out after **15 seconds** and are never redirected.

**Request body** (built by `buildSolverRequest` in `website/src/lib/solver/request.ts`)

```json
{
  "OrderId": "PF-000042",
  "Items": [
    { "ItemCode": "ITM-001", "ItemReference": "Widget A", "Width": 200, "Length": 100, "Depth": 100, "Weight": 0.45, "BoxGroup": null }
  ],
  "BoxTypes": [
    { "Reference": "SML", "Width": 150, "Length": 150, "Depth": 150, "MaxWeight": 8.5,  "BoxWeight": 0.5,  "Active": true, "MaximumBoxes": 100 },
    { "Reference": "MED", "Width": 400, "Length": 400, "Depth": 400, "MaxWeight": 25.0, "BoxWeight": 0.75, "Active": true, "MaximumBoxes": null }
  ]
}
```

- `Weight` is in **kilograms** here (converted from the order's grams).
- The solver has no carton catalogue of its own. **The carton list is defined in `website/src/lib/solver/boxTypes.ts`**, and every order is offered those cartons.
- The solver also accepts the Portal's lowercase shape (`id`, `items`, `boxTypes`) and an optional `Quantity` per item. See [`solver/README.md`](../solver/README.md).

**Response** `200`

```json
{
  "id": "PF-000042",
  "packages": [
    {
      "size": { "x": 400, "y": 400, "z": 400 },
      "items": [
        { "itemCode": "ITM-001", "itemReference": "Widget A", "unit": 1,
          "position": { "x": 0, "y": 0, "z": 0 }, "size": { "x": 200, "y": 100, "z": 100 } }
      ]
    }
  ],
  "unpacked": []
}
```

- Each package is one carton. All numbers are **millimetres**, and **z is vertical**.
- An item's `size` is after rotation.
- `unpacked` is always present. **A `200` does not mean every item was packed.** The Portal treats any unpacked item as a failed solve and never shows packers a partial layout.

| `unpacked[].reason` | Meaning |
| :--- | :--- |
| `TooLarge` | Bigger than every carton, in every orientation |
| `TooHeavy` | Fits, but is heavier than any such carton may carry |
| `SupplyExhausted` | Would fit, but every suitable carton type hit its `MaximumBoxes` |
| `CartonLimitReached` | Would fit, but the run hit its ceiling on cartons opened |

**Error responses**

| Status | Meaning |
| :--- | :--- |
| `400` | Nothing at all could be packed, or the body was not JSON |
| `401` | Missing or wrong bearer token |
| `413` | Body over 4 MB, more than 10,000 items, or more than 100 carton types. Split the order |
| `415` | No `Content-Type: application/json` header |
| `422` | JSON, but not a usable order (e.g. a missing `Weight`, or a `Quantity` of 0). `{ "Error": "…" }` names the field |
| `500` | The packer crashed. This is a solver bug |
   - [3.4 Delete Order (`DELETE /api/orders/saved/[orderId]`)](#34-delete-order)
4. [Packing Solution & Visualizer Endpoints](#4-packing-solution--visualizer-endpoints)
   - [4.1 Ingest Solver Solution (`POST /api/solutions`)](#41-ingest-solver-solution)
   - [4.2 Query Packing Solutions (`GET /api/solutions`)](#42-query-packing-solutions)
