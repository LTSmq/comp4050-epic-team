# Team Roles and Responsibilities

## Table of Contents

1. [Team Structure Overview](#1-team-structure-overview)
   - [Epic Solver Team Focus](#epic-solver-team-focus)
   - [Epic Portal Team Focus](#epic-portal-team-focus)
   - [Epic Visualiser Team Focus](#epic-visualiser-team-focus)
2. [Epic Solver Team](#2-epic-solver-team)
   - [Role Table](#21-role-table)
   - [Team Objectives](#22-team-objectives)
3. [Epic Portal Team](#3-epic-portal-team)
   - [Role Table](#31-role-table)
   - [Team Objectives](#32-team-objectives)
4. [Epic Visualiser Team](#4-epic-visualiser-team)
   - [Role Table](#41-role-table)
   - [Team Objectives](#42-team-objectives)

## 1. Team Structure Overview

### Epic Solver Team Focus
The Epic Solver team is responsible for developing the 3D bin-packing engine that receives order and carton data from the Portal, determines an appropriate packing solution, and provides the completed result for use by the Portal and Visualiser. The team focuses on packing optimisation, carton and item constraints, API communication, validation, testing, performance and reliable integration with the other project components.

The Solver is implemented in Rust and exposes HTTP endpoints for communication with the wider system. Throughout development, the team has also focused on automated testing, large-order performance and ensuring that packing results can be reliably transferred between the Portal, Solver and Visualiser.

### Epic Portal Team Focus
The Epic Portal team is responsible for the main user-facing workflow of the system, including authentication, order management, access control and the connection between the Portal, Solver and Visualiser. Our focus is making sure users can create, import and manage orders, then move those orders through the packing process in a simple and reliable way.

The Portal is built with Next.js and TypeScript and uses MongoDB for storing user, order and packing-related data. Throughout development, the team has focused on keeping the workflow consistent across different user roles, supporting automatic order solving, maintaining saved packing results, and making sure the Portal integrates cleanly with the other project components. We have also worked on keeping the interface consistent and easy to use, while making the codebase structured enough for future development and maintenance.

### Epic Visualiser Team Focus
The Epic Visualiser team is dedicated to presenting packing optimization results through a clear, interactive, mobile-first WebGL interface. Designed with warehouse workers usability and accessibility in mind, our focus is creating a frictionless and straightforward experience for warehouse picking, packing, and sorting, allowing operators to rotate, zoom, inspect bounding items, and follow optimal packing instructions across handheld and desktop devices.

We also plan to keep our work maintainable and readable for future devs to work on features or fix issues, enforcing component-based design in our codebase and strict types through TypeScript, with the potential for the addition of the TypeScript compiler for faster compile times during CI/CD.

## 2. Epic Solver Team

### 2.1 Role Table

| Name | Title | Jobs | Github account |
| :--- | :--- | :--- | :--- |
| Trystan Frederick | Team Lead / Scrum Master | Project setup and architecture, CI/CD pipelines, solver integration and data flow, security and dependency management, testing infrastructure, documentation | `@76Trystan` |
| Saim Muhammad| API Integration Engineer | Solver API integration, Portal/Visualiser communication, integration testing, performance/load testing, delivery reliability | `@msaim366` |
| Max Sharah | Lead Algorithm Engineer | Packing algorithm research, design and selection (anchor-point MVP, maximal-space packer, extreme-point heuristic), constraint design (support, weight, load bearing, compatibility), solution validation and packing tests, algorithm hand-over and review | `@maxsharah1` |
| Sidratul Muntaha | Assistant algorithm engineer | debugging and error handling, improving algorithm efficency, packing additional tests| `@Sidratul321` |

### 2.2 Team Objectives

The Solver team's overall objective is to develop a reliable 3D bin-packing service that processes orders received from the Portal, determines suitable carton placements while respecting packing constraints, and provides results to the wider system for use by the Portal and Visualiser. The team also aims to maintain reliable API communication, test packing behaviour at different scales, and improve Solver performance without compromising existing functionality.

| # | Objective | What it involves | How we measure it |
|---|---|---|---|
| 1 | **Develop the 3D bin-packing Solver** | Implement packing logic that assigns order items to suitable cartons while considering item and carton dimensions, weight limits and packing constraints. | Valid packing results are produced without violating the defined dimension and weight constraints. |
| 2 | **Provide a reliable Solver API** | Provide an HTTP interface that accepts packing requests, validates incoming data, invokes the packing process and returns appropriate results or errors. | Valid requests are processed successfully, while invalid or unpackable requests produce the expected API responses. |
| 3 | **Integrate with the Portal and Visualiser** | Support the complete flow of packing data from the Portal to the Solver and deliver generated solutions in a format that can be consumed by the Visualiser. | Packing requests can pass through the Portal → Solver → Visualiser workflow using the agreed request and solution formats. |
| 4 | **Validate Solver correctness** | Use automated API, integration and regression tests to check packing behaviour, request validation, error handling and communication between components. | Automated tests pass without regressions when Solver functionality is changed or extended. |
| 5 | **Support large orders** | Test the Solver using generated orders of increasing size to determine whether it remains functional and stable as the number of items increases. | Successfully process test orders containing up to **10,000 items**. |
| 6 | **Improve Solver performance** | Measure execution time, identify performance bottlenecks and make targeted changes while preserving existing behaviour where appropriate. | For the 10,000-item load test, execution time was reduced from approximately **35.7 seconds to 7.2 seconds**, around a **5× improvement**. |
| 7 | **Improve delivery reliability** | Handle temporary failures when sending generated solutions to the Visualiser by performing delivery in the background and retrying failed attempts with backoff. | Delivery failure tests confirm that unsuccessful attempts are retried without blocking the original Solver request. |
| 8 | **Handle partial and invalid requests** | Distinguish between successfully packed items, unpackable items and structurally invalid requests, and provide useful result or error information to other components. | API and integration tests verify expected behaviour for successful, partial, unpackable and invalid requests. |
| 9 | **Maintain integration stability** | Ensure changes to the packing engine, API and delivery functionality remain compatible with other Solver functionality and the wider EPIC system. | Existing regression and integration tests continue to pass after new features, fixes and performance changes are introduced. |

## 3. Epic Portal Team

### 3.1 Role Table

| Name | Title | Jobs | Github account |
| :--- | :--- | :--- | :--- |
| Garen Vartanian | Scrum Master / Lead Portal Developer | Team Coordination, Task Delegation, Portal Development, Order Management, Control Flow, Solver Integration, Testing & Debugging | `@garenvartanian32` |
| Muhammad Tayyab | Portal Developer | Portal Feature Development, Integration Support, Access Control, UI & Workflow Development, General Development Support, Testing Infrastructure | `@tayyabzian` |
| Rikita Shil | API Integration Engineer | API Integration, MongoDB Database Management, Data Handling, Portal Backend Integration | `@RikitaShil` |
| Navneet Warraich | Lead Tester & Communications Coordinator | Functional Testing, Regression Testing, Team Communications, Meeting Minutes, Documentation Support | `@nwarraich` |

### 3.2 Team Objectives

The Portal team's overall objective is to provide a reliable interface between users and the wider packing system, allowing orders to be created, managed, processed and passed between the Portal, Solver and Visualiser while maintaining appropriate access control and data persistence.

| # | Objective | What it involves | How we measure it |
| :--- | :--- | :--- | :--- |
| 1 | **Simple order creation and management** | Allow users to manually create orders, import order data and load external orders through a consistent interface | A user can create, load, edit and save an order without needing to interact directly with backend services |
| 2 | **Reliable order storage** | Store orders and their item data in MongoDB so they remain available between sessions and application restarts | Saved orders remain available after refreshing or restarting the application |
| 3 | **Automatic Solver integration** | Automatically send eligible saved orders through the Solver workflow and store the resulting packing solution | A valid order progresses from creation to a solved, 3D-ready state without requiring unnecessary manual steps |
| 4 | **Reliable integration with the Visualiser** | Make completed packing solutions available to the Visualiser and provide a clear hand-off from the order and packing workflow | A solved order can be opened in the Visualiser and displays the correct packing solution |
| 5 | **Role-based access control** | Support customer and internal user roles, including employees and supervisors, with permissions appropriate to their responsibilities | Users can only access actions permitted by their assigned role, such as packing, role management or order deletion |
| 6 | **Secure authentication and session handling** | Provide registration, login, logout and persistent user sessions while protecting restricted pages and API routes | Authenticated users remain signed in while navigating the system, and unauthorised users cannot access restricted functionality |
| 7 | **Consistent and usable Portal interface** | Maintain a clear visual style across Portal, Orders, Packing, Account and administration pages, with understandable labels and measurement units | Users can move between Portal functions without inconsistent layouts or unclear controls |
| 8 | **Safe order updates and cleanup** | Ensure changes to orders trigger the required updates to packing data, and remove associated stored solutions when orders are deleted | Edited orders generate updated solutions and deleted orders do not leave outdated packing data behind |
| 9 | **Testing and reliable delivery** | Test Portal workflows, API interactions, authentication, access control and integration with other components before changes are committed | Production builds pass successfully and key user workflows are tested before features are considered complete |
| 10 | **Maintainable team development** | Keep Portal functionality separated into appropriate components, API routes and helper modules while using Trello, Discord and version control to coordinate development | Changes remain understandable and manageable, with work tracked and integrated without unnecessarily increasing component complexity |

## 4. Epic Visualiser Team

### 4.1 Role Table

| Name | Title | Jobs | Github account |
| :--- | :--- | :--- | :--- |
| Max Maker | Lead Tester| Unit Testing, Playwright Testing, Regression Testing, Developer (Usability & Accessibility Requirements)| `@MxxMr` |
| Lachlan Scott | Product Owner| Meeting Minutes, Lead on SideBar UI/Features, In charge of adhering to User Stories & Stakeholders| `@LachlanScott49` |
| Lachlan Thomas-Smith | Lead Visualiser Dev| Lead Three.js Dev, UI/UX Design, Lead Visualiser Developer, Prototyping| `@LTSmq` |
| Leon Yousif | Scrum Master| Meeting allocation, PR Reviews, Visualiser codebase Architect, Intergration with Portal/Solver, Software Performance Reviewer| `@leonyousif` |

### 4.2 Team Objectives

The Visualiser team's overall objective is to turn a solved packing layout into a clear, interactive 3D guide that a warehouse worker can follow on a phone/computer, without having to interpret raw solver data.

| # | Objective | What it involves | How we measure it  |
| :--- | :--- | :--- | :---  |
| 1 | **Clear 3D view of each package** | Transparent cartons with items drawn in realistic proportions; drag to rotate and zoom to inspect; a counter showing which item is being viewed | A packer can see where every item sits without opening the carton; sizes match the solver's dimensions  |
| 2 | **Step-by-step packing guidance** | Step forwards and backwards through packages and items in packing order; an animated drop shows where each item goes; the packer controls the pace | A packer can follow an order from the first item to the last without outside instructions  |
| 3 | **Item details at a glance** | A side panel for the item being inspected: SKU, reference, box group, weight, position, size and volume | Every item shown in 3D can be identified and checked against the order  |
| 4 | **Reliable integration with the Portal and Solver** | Load a solved layout from the Portal's `/api/solutions` endpoint, convert solver coordinates (millimetres, z up) into scene coordinates, and show clear loading, waiting and error states | A valid solved order renders correctly; invalid or missing data shows a message instead of breaking the page  |
| 5 | **Mobile-first and accessible** | Usable on handheld and desktop devices; labelled controls; respects reduced-motion preferences; does not rely on colour alone to convey information | Accessibility review, contrast checks and user feedback; a new user completes a first packing task with minimal instruction  |
| 6 | **Responsive performance on a typical smartphone** | Fast start-up, smooth rendering and quick response to input | Targets from the plan: usable in under 1 second, over 60 Hz frame rate, input response under 5 ms, and a rendered carton in under 1 second after valid data arrives  |
| 7 | **Maintainable, readable code** | Component-based design; strict TypeScript; state changes through a single reducer; appearance driven by a typed config; legacy visualiser code retired | A small change or feature can be made safely, and a new developer can follow the structure  |
| 8 | **Automated testing and regression protection** | Unit tests for data conversion and state logic; React component tests for controls and states; Playwright end-to-end tests; all run automatically on every pull request | Tests run in CI and a test is added whenever a bug is fixed  |
| 9 | **Disciplined team delivery** | Meeting minutes, task tracking, pull-request review of every change, and work checked against user stories and stakeholder needs | Changes reach `main` only through reviewed pull requests; features trace back to a user story  |
