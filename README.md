# To-Do — shared edition

The same focus desk, now with shared tasks and server-verified sign-in. Start with **SETUP.md** before deploying this version.

## Included

- One shared task list across signed-in computers and phones.
- Password checked by a Vercel server function. It is not embedded in the browser bundle.
- Remember this browser for 90 days; unchecked means a 12-hour session.
- Secure, HttpOnly, host-only cookies; server-side expiration and sign-out revocation.
- Sign-in rate limiting and same-origin checks on writes.
- Existing focus screen, deck, waiting lane, notes, flags, history, shuffle, and backup tools.
- A prompt to bring older browser tasks into the shared list; original browser copies are left intact.
- Changes refresh about every 20 seconds while visible, and when you return to the app.
- Concurrent saves use an atomic Redis compare-and-set. Interrupted saves can be retried with the same operation ID to avoid applying an action twice.
- Conflicting edits to the same task are rejected with a message; undo refuses to overwrite intervening changes.

This is a **single private desk with one shared password**, not separate accounts for multiple users. Everyone with the password sees and can edit the same tasks.

## Run locally

Use Node.js 22 LTS or later. Copy `.env.example` to `.env.local` and enter credentials for a separate development database and password. Never commit that file.

```sh
npm ci
npm run dev
```

The Vite development configuration serves `/api/session` and `/api/tasks` locally. Vercel runs `api/` as server functions in production.

```sh
npm test
npm run build
```

`npm run preview` serves the static build only; it does not run the shared-task APIs. The `dist` folder alone is no longer a working deployment. Deploy the entire source project to Vercel.

## Data and privacy

Tasks are stored in your dedicated Upstash Redis database under `{todo}:state`, with no expiration. Keep database eviction disabled so it acts as a durable store rather than a disposable cache. Export backups periodically. Sessions expire after 90 days (or 12 hours); sign-out deletes that browser’s session. Changing `TODO_PASSWORD` and redeploying invalidates existing sessions on the new deployment. Older deployments may still use their older configuration; see SETUP.md.

Cookies, passwords, and database tokens are never put in the task export. Server credentials do not use the `VITE_` prefix. New cloud tasks are not written to browser localStorage/IndexedDB; old local copies are retained for recovery. Those older copies remain accessible to someone with access to that browser profile.

An internet connection is needed to save. There is no background offline queue. If a save is unconfirmed, the app keeps the current draft open and asks you to retry before another change. Keep the tab open until the pending save resolves. Operation deduplication is retained for 24 hours; do not leave an unresolved save pending longer than that. Exported backups are plain JSON containing your tasks.

This app uses your Vercel and Upstash accounts. Provider pricing and storage/command limits apply. A visible app checks tasks every 20 seconds, so choose a plan based on actual use. There are no push notifications; waiting reminders appear inside the app.

## Code map

- `api/session.js`: sign-in, session validation, sign-out.
- `api/tasks.js`: authenticated shared reads and mutations.
- `server/core.js`: Redis REST access, cookies, origin checks, rate limiting, atomic saves.
- `src/AuthGate.jsx`: sign-in screen and session visibility.
- `src/cloud.js`: same-origin API client.
- `src/useDesk.js`: synchronization, pending-save retry, guarded undo.
- `src/storage.js`: retained local store, used only to recover/import older tasks.
- `src/model.js`: task transitions and shuffle selection.
- `src/components.jsx`, `src/App.jsx`, `src/styles.css`: the working surface.

## Verification

23 automated tests pass, covering model behavior, original local migration, API authorization, forged cookies, cookie flags/expiry, password changes, rate limiting, cross-origin refusal, shared reads, concurrent writes, deduplication, guarded undo, logout, and database failures.

The server tests use a Redis REST contract double. They do not substitute for a live Upstash/Vercel check. The production frontend build passes. Real database connectivity, Vercel function deployment, and browser/device end-to-end behavior must be checked after configuration using the short walkthrough in SETUP.md.
