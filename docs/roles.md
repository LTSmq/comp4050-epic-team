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
