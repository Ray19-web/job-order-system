# Easy-Ink Job Order System

Easy-Ink is a local job-order management system for print-shop work. It helps staff record orders, follow production progress, manage payments and warnings, approve completed work, and manage staff access.

## Main features

- Create and manage job orders for Branch 1 and Branch 2.
- Track orders through approval, production, ready-for-release, confirmation, and completion.
- Highlight overdue, due-today, due-tomorrow, and warning-flagged orders.
- Search, filter, sort, and paginate orders and staff accounts.
- Show notifications for new order activity and deadlines.
- Manage staff roles, branches, permissions, passwords, and account activation.
- Use separate Active Orders, Approvals, Archive, and Staff Access pages.
- Retain completed work in Archive; administrators can also archive an unfinished order without deleting it.

## Roles

| Role | Access |
| --- | --- |
| Admin | Full access, including approvals, final completion, staff management, and account controls. |
| Attendant | Access based on the permissions assigned by an admin. |
| OJT | Starts with view-only access; an admin may enable individual permissions. |

## Order workflow

1. An order is created and submitted for approval.
2. An admin approves it and moves it into the active production workflow.
3. Staff update its status, payment, notes, and warnings according to their assigned permissions.
4. A completed production job is submitted for admin confirmation.
5. An admin confirms it, moving the order to Completed.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install` in the project folder.
3. Copy `.env.example` to `.env` if you want to change the port or local data location.
4. Run `npm run dev`.
5. Open [http://localhost:3000](http://localhost:3000).

The local server creates `data/easyink-db.json` automatically. This file is for development data and is ignored by Git.

## Test accounts

| Role | Username | Password |
| --- | --- | --- |
| Admin | `mark` | `easyink123` |
| Attendant | `ana` | `branch123` |
| Attendant | `rico` | `branch223` |
| OJT | `kevin` | `intern123` |

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local app and API with automatic reload for development changes. |
| `npm run start` | Start the app and API using the production build. |
| `npm run build` | Create a production client build. |
| `npm run lint` | Run the TypeScript type check. |

## Project structure

```text
src/                  React user interface
src/components/       Pages, cards, modals, and shared interface components
src/types/            Shared TypeScript types and workflow statuses
src/utils/            Order calculations and workflow rules
server.ts             Express API and local JSON data adapter
data/                 Local development data, created automatically
```

## Local API overview

The application uses the `/api` routes in `server.ts` for authentication, job orders, notes, and staff accounts. The current storage layer uses a local JSON file, so a production database can be introduced later while preserving the React interface and API contract.
