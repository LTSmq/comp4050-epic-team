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

### Epic Visualiser Team Focus
The Epic Visualiser team is dedicated to presenting packing optimization results through a clear, interactive, mobile-first WebGL interface. Designed with warehouse workers usability and accessibility in mind, our focus is creating a frictionless and straightforward experience for warehouse picking, packing, and sorting, allowing operators to rotate, zoom, inspect bounding items, and follow optimal packing instructions across handheld and desktop devices.

We also plan to keep our work maintainable and readable for future devs to work on features or fix issues, enforcing component-based design in our codebase and strict types through TypeScript, with the potential for the addition of the TypeScript compiler for faster compile times during CI/CD.

## 2. Epic Solver Team

### 2.1 Role Table

| Name | Title | Jobs | Github account |
| :--- | :--- | :--- | :--- |
| Saim Muhammad| API Integration Engineer | Solver API integration, Portal/Visualiser communication, integration testing, performance/load testing, delivery reliability | `@msaim366` |
| | | | `@github_handle` |
| | | | `@github_handle` |
| | | | `@github_handle` |

### 2.2 Team Objectives

## 3. Epic Portal Team

### 3.1 Role Table

| Name | Title | Jobs | Github account |
| :--- | :--- | :--- | :--- |
| | | | `@github_handle` |
| | | | `@github_handle` |
| | | | `@github_handle` |
| | | | `@github_handle` |

### 3.2 Team Objectives

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
