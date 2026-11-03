# User Guide

## Table of Contents

1. [Who Does What](#1-who-does-what)
2. [Getting Started](#2-getting-started)
3. [Customers](#3-customers)
   - [3.1 Creating an Order](#31-creating-an-order)
   - [3.2 Importing Orders from a File](#32-importing-orders-from-a-file)
   - [3.3 Tracking Orders](#33-tracking-orders)
4. [Warehouse Team (Packers)](#4-warehouse-team-packers)
   - [4.1 The Packing List](#41-the-packing-list)
   - [4.2 Packing an Order](#42-packing-an-order)
   - [4.3 Using the 3D Visualiser](#43-using-the-3d-visualiser)
   - [4.4 When an Item Is Missing](#44-when-an-item-is-missing)
5. [Supervisors](#5-supervisors)
   - [5.1 Managing Orders](#51-managing-orders)
   - [5.2 Handling Exceptions on the Packing List](#52-handling-exceptions-on-the-packing-list)
   - [5.3 Managing Roles](#53-managing-roles)
6. [Order Status Reference](#6-order-status-reference)

---

## 1. Who Does What

Perfect Fit has three kinds of user. What you can see and do depends on your role.

| Role | Typical person | Main screens | Can do |
| :--- | :--- | :--- | :--- |
| **Customer** | Someone placing orders | Portal, Orders | Create and import orders; see their own orders and whether they are packed |
| **Team** | Warehouse packer | Portal, Orders (packing list), Visualiser, Settings | Create orders for customers; pack the orders assigned to them, following the 3D guide |
| **Supervisor** | Warehouse lead | Everything | Everything a packer can do, for every order, plus editing and deleting orders, resolving problems and managing roles |

Everyone signs up as a customer. A supervisor gives staff the team or supervisor role.

---

## 2. Getting Started

1. Open the site and choose **Register**.
2. Enter a **username** (3 to 32 letters, numbers, `.`, `_` or `-`), your **email**, and a **password** of at least 8 characters.
3. Sign in with either your username or your email.
4. The **Portal** opens and shows the quick actions available to your role.

The navigation bar at the top takes you between screens. Staff see **Portal**, **Visualiser**, **Settings** and **Orders**; customers see **Portal** and their account. Your account page (the person icon) shows who you are signed in as and lets you sign out.

Sessions last 24 hours, after which you are asked to sign in again.

---

## 3. Customers

### 3.1 Creating an Order

1. From the Portal, open the **Orders** desk.
2. Choose to create an order manually.
3. Add one row per item:

   | Field | Meaning | Example |
   | :--- | :--- | :--- |
   | Item code | Your product code | `ITM-001` |
   | Item reference | A name a packer will recognise | `Widget A` |
   | Box group | *Optional.* Items with different groups are never packed in the same carton (e.g. `chemicals` and `food`) | `fragile` |
   | Width, Length, Depth | Size in millimetres | `200`, `100`, `100` |
   | Weight | Weight in grams | `450` |

4. Save the order. It receives an ID such as `PF-000042` and is packed into cartons automatically within a few seconds.

> Dimensions are entered in millimetres and weights in grams. Values entered in centimetres or kilograms produce incorrect carton sizes.

### 3.2 Importing Orders from a File

You can load one or many orders at once from a CSV or JSON file. Imported orders are shown for review first; nothing is saved until you save them.

**CSV.** One row per item. Rows with the same `OrderID` become one order. If the file has no `OrderID` column, type an order reference in the box before importing.

```csv
OrderID,ItemCode,ItemReference,Width,Length,Depth,Weight,BoxGroup
WEB-1001,ITM-001,Widget A,200,100,100,450,
WEB-1001,ITM-002,Glass jar,120,120,180,600,fragile
WEB-1002,ITM-003,Toolbox,400,250,180,3200,
```

**JSON.** Either a single order, a list of orders, or a plain list of items (with an order reference typed in first).

```json
[
  {
    "orderId": "WEB-1001",
    "items": [
      { "ItemCode": "ITM-001", "ItemReference": "Widget A", "Width": 200, "Length": 100, "Depth": 100, "Weight": 450 }
    ]
  }
]
```

Lower-case field names (`itemCode`, `width`, …) are also accepted. The reference in your file is only used to group items; each saved order still gets its own **PF-** number.

### 3.3 Tracking Orders

Your orders are listed on the Orders desk, newest first. Customers see two states:

| Status | Meaning |
| :--- | :--- |
| **Submitted** | Received and being prepared by the warehouse |
| **Packed** | Packed and ready to go |

---

## 4. Warehouse Team (Packers)

### 4.1 The Packing List

Open **Orders** in the top bar. The list shows the orders assigned to you and updates every few seconds without a manual refresh.

- Orders are assigned automatically to whichever packer has the fewest orders waiting.
- Orders are listed oldest first and must be packed in that order. If you try to start a later one, you are told which order to pack first.
- Each packer can have one order in progress at a time.
- Packed orders stay on the list for 12 hours, then drop off.

### 4.2 Packing an Order

1. Tap the order at the top of your list. You see its items and their sizes.
2. Tap **Start packing**. The order is now claimed by you, and other packers can see who is packing it.
3. Tap **Open 3D** to see which carton to use and where each item goes (see [4.3](#43-using-the-3d-visualiser)).
4. Pack the items in the order the guide shows.
5. Tap **Mark packed**.

If you need to stop before finishing, tap **Release**. The order goes back to your list. If an order is left in progress for more than 30 minutes, it can be taken over (the button reads **Take over**).

### 4.3 Using the 3D Visualiser

The Visualiser shows each carton as a see-through box with the items inside, drawn to scale.

| Control | What it does |
| :--- | :--- |
| **Previous package / Next package** | Move between cartons in the order |
| **Inspect package items** | Zoom in on the selected carton and start stepping through its items |
| **Previous item / Next item** | Step through items **in packing order**. Each new item drops into place, so you can see where it goes |
| **Inspect package** / **Back to all packages** | Switch between looking at one carton and the overview of all cartons |
| **Zoom in / Zoom out** | Change the zoom level |
| **Drag** on the 3D view | Rotate the carton to look from another side |

The side panel shows the current item's code, name, box group, weight, position, size and volume, so you can check you have the right item before placing it.

Pack from the bottom up, following the item order. Sizes in the side panel show the item as it should be placed, which may be rotated from how it was listed.

On **Settings** you can turn the isometric grid background on or off.

### 4.4 When an Item Is Missing

If an item cannot be found or is damaged:

1. On the packing screen, tap **Unavailable** next to that item.
2. The order is put **On hold** and released from you. It appears under the *On hold* tab of the supervisor's packing list.

Continue with the next order. The supervisor will either find the item or have the order re-packed without it.

---

## 5. Supervisors

Supervisors can do everything a packer can, for every order, plus the following.

### 5.1 Managing Orders

- **Create an order for a customer:** on the Orders desk, pick the customer in *Create order for*, then add items as in [3.1](#31-creating-an-order).
- **Edit an order:** change its items before packing starts. Changing items discards the existing packing plan and generates a new one automatically. Orders being packed or already packed are locked.
- **Delete an order:** removes it and its packing plan permanently. You can delete from the Orders desk or from the order's packing screen.

### 5.2 Handling Exceptions on the Packing List

| Situation | Status shown | Button | What happens |
| :--- | :--- | :--- | :--- |
| A packer flagged an item, and it has now been found | On hold | **Item found** | The item is restored. The existing plan is reused if it still fits, otherwise a new one is made |
| A packer flagged an item, and it cannot be supplied | On hold | **Re-solve without item** | A new packing plan is made for the remaining items |
| A packer left the order mid-pack | Packing | **Force release** | The order goes back to *3D Ready* |
| An order was marked packed by mistake | Packed | **Undo packed** | The order goes back to *3D Ready* |
| No packer was available when the order was solved | Awaiting assignment | **Retry assignment** | The order is assigned to the least busy team member |
| The solver could not fit every item | Failed | Edit the order | Check for wrong units or an oversized item, fix it, and save to re-solve |

Supervisors are not bound by the oldest-first rule, and can start packing any ready order.

### 5.3 Managing Roles

Open **Portal → Manage roles**. Search for a user by name or email and set their role to **customer**, **team** or **supervisor**. The change applies on their next click; they do not need to sign in again.

Two safeguards apply: you cannot remove your own supervisor role, and the last supervisor cannot be demoted.

---

## 6. Order Status Reference

| Status (staff view) | Customer sees | Meaning | Next step |
| :--- | :--- | :--- | :--- |
| **Submitted** | Submitted | Saved, waiting to be planned | Automatic |
| **Solving** | Submitted | The packing plan is being worked out | Automatic, a few seconds |
| **Awaiting assignment** | Submitted | Planned, but no packer was free to assign | Supervisor: **Retry assignment** |
| **3D Ready** | Submitted | Planned and assigned; ready to pack | Packer: **Start packing** |
| **Packing** | Submitted | A packer is working on it | Packer: **Mark packed** |
| **On hold** | Submitted | An item is unavailable | Supervisor: **Item found** or **Re-solve without item** |
| **Packed** | Packed | Complete | None |
| **Failed** | Submitted | Not every item fits the available cartons | Supervisor: correct the order |
