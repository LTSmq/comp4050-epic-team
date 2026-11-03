# EPIC Portal — API and Database Technical Documentation

## 1. Purpose and Scope

This document describes my individual contributions to the EPIC Portal project, focusing on MongoDB database integration, user authentication, role-based access control, order management APIs, and integration with the Rust packing solver.

The purpose is to explain how these components were implemented, why they were required, and how they support the overall system.

This document distinguishes my individual contributions from features developed by other team members.

## 2. Technology Stack

| Technology | Purpose |
|---|---|
| Next.js | Web application and server-side API routes |
| TypeScript | Application and API implementation |
| MongoDB | Persistent database for users, orders, and solutions |
| MongoDB Node.js Driver | Database connection and queries |
| bcrypt | Password hashing and verification |
| JSON Web Token (JWT) | User authentication and session management |
| Rust | Packing optimisation solver |
| Vitest | Unit testing |

## 3. MongoDB Database Integration

### 3.1 Database Connection

**Implementation file:** `website/src/lib/mongodb.ts`

I implemented the MongoDB connection to allow the EPIC Portal to store and retrieve application data.

The connection uses environment variables:

- `MONGODB_URI` — MongoDB connection string.
- `MONGODB_DB` — Database name, defaulting to `fitvisualizer`.

The implementation reuses the MongoDB client and connection promise to avoid unnecessary connections during development reloads.

The connection pool is configured with a maximum size of 10.

### 3.2 Database Collections

| Collection | Purpose |
|---|---|
| `users` | Stores registered users, password hashes, and roles |
| `orders` | Stores customer orders, items, ownership, and processing progress |
| `solutions` | Stores packing solutions associated with orders |
| `counters` | Maintains sequential order ID generation |

### 3.3 Database Indexes

The database implementation includes indexes for:

- Unique user email addresses.
- Unique usernames with case-insensitive matching.
- User roles.
- Unique order IDs.
- Customer orders and update timestamps.
- Order progress and solving timestamps.
- Unique solution order IDs.

These indexes help improve query efficiency and protect data integrity.

Index-creation errors are logged by the current implementation, so database connection success alone does not guarantee that every index was created.

## 4. User Registration API

**Endpoint:** `POST /api/register`

**Implementation file:** `website/src/app/api/register/route.ts`

I implemented the registration API to allow customers to create accounts.

The registration process:

1. Receives the username, email, and password.
2. Validates the submitted information.
3. Checks whether the username or email already exists.
4. Hashes the password using bcrypt.
5. Stores the user record in MongoDB.
6. Assigns the default `customer` role.
7. Returns a successful registration response.

### Validation

- Username must contain 3–32 permitted characters.
- Email must follow the required email format.
- Password must contain at least eight characters and must not exceed 72 UTF-8 bytes.
- Duplicate usernames and emails are rejected.

Passwords are hashed using bcrypt with a cost factor of 12.

The API does not return password hashes to the client.

### HTTP Responses

| Status | Meaning |
|---|---|
| 201 | Registration successful |
| 400 | Invalid or missing input |
| 409 | Username or email already exists |
| 500 | Registration failure |

## 5. Login and Authentication

**Endpoint:** `POST /api/login`

**Implementation file:** `website/src/app/api/login/route.ts`

I implemented the login API to authenticate registered users.

Users can log in using either their username or email address.

The authentication process:

1. Receives login credentials.
2. Finds the matching user in MongoDB.
3. Compares the submitted password with the stored bcrypt hash.
4. Generates a signed JWT after successful authentication.
5. Stores the JWT in an HTTP-only cookie.
6. Returns the authenticated user's basic account information.

### JWT Configuration

The JWT uses the HS256 signing algorithm and expires after one day.

The authentication cookie is named `auth_token`.

Cookie security settings include:

- HTTP-only access.
- Secure transmission in production.
- SameSite `lax`.
- One-day maximum age.

### Session Validation

**Implementation file:** `website/src/lib/auth.ts`

The `getAuthUser()` function validates the JWT and retrieves the current user role from MongoDB.

This ensures that permission changes can take effect without relying on potentially outdated role information stored in the token.

If the role lookup fails, the function defaults to the least-privileged customer role.

## 6. Role-Based Access Control

**Implementation file:** `website/src/lib/rbac.ts`

I implemented role-based access control to restrict system operations according to the user's role.

The system defines three roles:

| Role | Permissions |
|---|---|
| Customer | Create orders and read permitted orders |
| Team | Create and read orders, perform packing operations, and read user information |
| Supervisor | Manage orders, supervise packing, and assign roles |

The RBAC implementation includes:

- `can()` — checks permissions.
- `requireUser()` — checks authentication.
- `requirePermission()` — verifies permission for an action.
- `orderScope()` — restricts order queries according to the user's role.

Unauthenticated requests return HTTP 401.

Authenticated users without the required permission receive HTTP 403.

Customer order retrieval is restricted to their own orders.

## 7. Saved Order API

**Implementation file:** `website/src/app/api/orders/saved/route.ts`

### GET /api/orders/saved

This endpoint retrieves saved orders from MongoDB.

The endpoint:

1. Checks user authentication.
2. Verifies the `order:read` permission.
3. Applies role-based order filtering.
4. Retrieves matching orders from MongoDB.
5. Sorts orders by the most recent update.
6. Returns the order list.

Customers can retrieve their own orders.

Team members and supervisors can retrieve broader order lists, with optional customer filtering.

### POST /api/orders/saved

This endpoint creates a new saved order.

The process:

1. Authenticates the user.
2. Checks the `order:create` permission.
3. Validates the order data.
4. Generates a unique system-controlled order ID.
5. Associates the order with the appropriate customer.
6. Saves the order in MongoDB.
7. Sets the initial progress to `submitted`.
8. Calls the solver workflow.
9. Retrieves the saved order and returns the response.

The implementation stores ownership information and creation/update timestamps.

**Current limitation:** The route calls `runOrderSolve()` but does not check the returned `ok` value. Therefore, an HTTP 201 response confirms order creation but does not independently prove successful solving.

## 8. External Order Intake API

**Endpoint:** `POST /api/orders/intake`

**Implementation file:** `website/src/app/api/orders/intake/route.ts`

I worked on the external order intake API to support orders submitted by external systems.

This endpoint uses machine-to-machine authentication through the `x-api-key` header.

The API key is checked against the configured `ORDER_INTAKE_API_KEY`.

### Workflow

1. Verify the external API key.
2. Validate the submitted order items.
3. Optionally associate the order with an existing customer.
4. Generate a system-controlled order ID.
5. Store the order in MongoDB.
6. Set the source to `External`.
7. Set the status to `Available`.
8. Set the initial progress to `submitted`.
9. Invoke the solver.
10. Return the saved order.

External systems cannot directly control internal fields such as order progress, ownership, or packing assignment through the submitted request body.

**Current limitation:** The endpoint does not inspect the solver's returned success status before returning HTTP 201.

## 9. System-Generated Order IDs

**Implementation file:** `website/src/lib/orders/generateOrderId.ts`

I implemented automatic order ID generation so users and external systems do not need to provide their own identifiers.

Example:

`PF-000001`

The implementation uses a MongoDB counter and an atomic `$inc` operation to generate sequential numbers.

When the counter is first initialised, the implementation checks existing order IDs to determine the starting sequence.

The generated order ID is used throughout the order-management and solver workflows.

A unique MongoDB index provides an additional safeguard against duplicate order IDs.

## 10. Rust Solver Integration

**Implementation file:** `website/src/lib/solver/server/runOrderSolve.ts`

I worked on connecting the EPIC Portal's order APIs to the Rust packing solver.

The solver is accessed through an HTTP POST request.

The endpoint is configured using `SOLVER_URL`, with the local default:

`http://127.0.0.1:8080/solve`

The configured request timeout is 15 seconds.

### Solver Workflow

1. Retrieve the saved order from MongoDB.
2. Check whether the order is locked.
3. Validate the available items.
4. Convert the saved order into the solver's expected input format.
5. Update order progress to `solving`.
6. Send the request to the Rust solver.
7. Process the solver response.
8. Convert the response for the visualizer.
9. Save the packing solution.
10. Invoke the team's automatic worker-assignment functionality.
11. Continue the order progress workflow.

### Solver Response Adapter

**Implementation file:** `website/src/lib/solver/server/solverResponseAdapter.ts`

During integration, I identified a mismatch between the Rust solver response and the format expected by the portal's response parser.

I introduced a response adapter to transform the solver output before passing it to the existing parser.

This helped connect the latest solver implementation with the portal's order-management workflow.

The Next.js production build passed after integration, but complete end-to-end runtime verification remains outstanding.

The Rust solver algorithm and automatic worker-assignment feature were developed by other team members.

## 11. Testing and Verification

I contributed to the project's testing setup and wrote unit tests for selected portal functionality.

| Test area | Evidence | Status |
|---|---|---|
| Order ID generation | Vitest unit tests | Passed in previous test run |
| Order validation | Vitest unit tests | Passed in previous test run |
| Worker assignment access | Unit test | Previously reported passing |
| Website integration | Next.js production build | Passed |
| Rust solver | 79 tests executed during integration | Passed |
| Authentication and RBAC | Code implementation and review | Further integration testing required |
| Solver response adaptation | Adapter implementation and successful build | Runtime verification pending |
| Complete order-to-solution workflow | End-to-end testing | Not fully verified |

The Rust solver tests were written by other team members. I executed them as part of integration verification and do not claim authorship.

## 12. Git Commit Evidence

The following commits provide evidence of my individual development work.

| Contribution | Commit |
|---|---|
| MongoDB database connection | `f41562f` |
| User registration API | `3d39b3f` |
| User registration form | `2d9bc47` |
| Login and JWT authentication | `d015f49` |
| Session checking and logout | `634b7c3` |
| Portal authentication protection | `8489a6c` |
| Order parser and solver request API | `d189a5a` |
| Rust solver API connection | `2dc8ea4` |
| System-generated order IDs | `0aa3995` |
| Vitest configuration | `41ce1a9` |
| Order ID unit tests | `f510129` |
| Order validation unit tests | `0e2f516` |
| Vitest path alias configuration | `0188a0a` |
| Worker assignment access test | `5662d36` |
| Integration with latest solver and visualizer | `1d7db9b` |

## 13. Contribution Boundaries

This document focuses on my individual contributions to the EPIC Portal, including:

- MongoDB database integration.
- Registration and login APIs.
- JWT authentication and session handling.
- Role-based access control.
- Order creation and retrieval APIs.
- System-generated order IDs.
- External order intake integration.
- Rust solver API integration and response adaptation.
- Unit testing and integration verification.

I do not claim ownership of the Rust packing algorithms, 3D visualizer, automatic worker-assignment implementation, packing interface, or other features developed by teammates.

My integration work involved connecting these existing components with the portal, checking compatibility, and documenting the remaining verification requirements.