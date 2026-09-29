# API Specification

## Table of Contents

1. [Global Conventions](#1-global-conventions)
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
4. [Packing Solution & Visualizer Endpoints](#4-packing-solution--visualizer-endpoints)
   - [4.1 Ingest Solver Solution (`POST /api/solutions`)](#41-ingest-solver-solution)
   - [4.2 Query Packing Solutions (`GET /api/solutions`)](#42-query-packing-solutions)
