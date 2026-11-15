# Easy-Ink Job Order System

React client with a Node.js and Express API. The application is ready to run as
a single local development service and does **not** use MongoDB.

## Run locally

1. Install Node.js 20 or newer.
2. In this project folder, run `npm install`.
3. Optionally copy `.env.example` to `.env` and adjust `PORT` or `DATA_DIR`.
4. Run `npm run dev`. The development server automatically reloads when server or interface code changes.
5. Open http://localhost:3000.

The first run creates `data/easyink-db.json` with sample users and job orders.
It is ignored by Git and is intended only for local testing. When the final
database is chosen, the Express data adapter can be swapped while preserving
the existing `/api` endpoints and React UI.

## Test accounts

| Role | Username | Password |
| --- | --- | --- |
| Admin | `mark` | `easyink123` |
| Attendant | `ana` | `branch123` |
| Attendant | `rico` | `branch223` |
| Viewer | `kevin` | `intern123` |

## Commands

- `npm run dev` — run the React interface and Express API locally.
- `npm run build` — build the React client for production.
- `npm run start` — serve the app and API (run `npm run build` first for production assets).
- `npm run lint` — run the TypeScript type check.
