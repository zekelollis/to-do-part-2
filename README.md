# To-Do — revised

One task now. Two on deck. A place for everything you’re waiting on.

This revision keeps the original app’s paper-and-brass character and adds a calmer focus screen, readable dark mode, task inspection, recovery, and safer device-local saving.

## Run or deploy

Requires a current Node.js LTS release and npm.

```sh
npm ci
npm run dev
```

For a production build:

```sh
npm run build
```

Deploy to Vercel using the **Vite** preset. Build command: `npm run build`. Output directory: `dist`. No database account or environment variables are needed.

Upload the contents of this folder to your repository, including `src`, `public`, and `package-lock.json`. Do not upload `node_modules`. The included `dist` directory is also a ready-built static copy; serve it through a web host, rather than double-clicking the HTML file.

## Existing tasks

When deployed at the same address and opened in the same browser as the original Now app, the revised app automatically reads `now:state:v2` on first use. It saves the migrated tasks separately in IndexedDB and leaves the old localStorage copy untouched. Your old app can still read its original snapshot, but new changes are not written back to the old version.

A different hostname, browser, or device has a separate task store. Use **Your desk → Export backup** on the revised app to move tasks, then **Import backup** on the other device. Home-screen browser containers may also have separate stores.

Import accepts Now version 2 and version 3 JSON state backups. On an empty desk it restores the backup’s tasks, deck, flags, and focus. On an existing desk it adds new IDs and keeps existing records unchanged. It is a merge, not a cross-device synchronization service. Completed and trashed records also retain their IDs.

If the old saved data cannot be read, the app stops migration and provides a retry/export option rather than silently replacing it.

## What changed

- One large focus card, a two-slot deck, and a compact periphery.
- Task inspection and explicit save/cancel without changing the current focus.
- Five short notes per task, up to 120 characters per note.
- Dedicated owner field for waiting tasks, including clearing an owner.
- “Still working” renews the 90-minute focus check-in.
- Head-to-head shuffle, up to five choices. The winner of this round becomes NOW; old weights no longer overrule it. Least-recently-shown candidates get turns.
- Completed tasks and dropped tasks stay in History and can be restored.
- Undo protects against reverting intervening changes, including other tabs.
- IndexedDB read/write transactions serialize changes against the latest state. BroadcastChannel updates other open tabs; focus/visibility refresh provides a fallback. There is no polling or server synchronization.
- Edits to the same task detect conflicting changes and ask you to reopen it; unrelated task changes are preserved.
- Waiting tasks sort by follow-up time. Reminders are in-app only, not scheduled background notifications.
- Export/import, visible save failures, and explicit notices when flags or deck slots are displaced.
- Native modal dialogs provide keyboard focus containment and Escape handling.
- Ordinary capture preserves @mentions and email addresses. Waiting capture recognizes standalone @name tokens.
- Responsive lists, larger controls, and separate background/card text colors in dark mode.

## Keyboard shortcuts

`/` capture · `S` shuffle · `X` done · `N` not this · `F` flag · `E` edit · `D` notes · `W` waiting on · `Esc` back.

During shuffle, `1` or `2` chooses a task. Global shortcuts are suspended while typing or editing. Task completion shortcuts work on the focus view only.

## Screen privacy

**Hide screen** is a visual curtain with a return button. It does not secure or encrypt task data.

The original optional `VITE_NOW_PASSPHRASE` gate is retained. Its value is embedded in the client bundle and is not authentication. The passphrase lock action is shown only when the variable is configured. Device and browser security protect the locally stored data.

## Verification and code map

```sh
npm test
npm run build
```

`src/model.js` contains task transitions and shuffle selection. `src/storage.js` owns migration and atomic persistence. `src/useDesk.js` connects saving and cross-tab refresh to React. `src/components.jsx` owns task editing and dialogs. `src/App.jsx` composes the working surface. `src/styles.css` contains both themes and responsive layouts.

Tests cover parsing, deck advancement, task recovery, shuffle fairness, latest-round choice, import validation, same-task conflicts, migration, concurrent writes, rejected writes, and guarded undo. Storage tests use an IndexedDB implementation for Node. Browser/device end-to-end testing has not been performed in this revision.

Google Fonts enhance the typography when available; system fallbacks work without them. No service worker is included, so offline page loading is not guaranteed.

## September 10 layout update

Renamed the app to To-Do, removed the introductory heading above the focus card, and moved the date into the header. Task storage identifiers remain compatible with the previous release.
