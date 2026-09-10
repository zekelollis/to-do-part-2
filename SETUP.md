# Set up your shared To-Do

This update needs one database connection and one password in your existing Vercel project. Complete these before the final redeploy. Your current browser tasks are not deleted.

## 1. Keep a backup first

In your currently deployed app, open **Shortcuts & backup → Export backup**. Keep that JSON file as a spare. Your existing browser store is also retained by this update.

## 2. Create and connect a dedicated database

Use the [official Upstash/Vercel integration guide](https://upstash.com/docs/redis/howto/vercelintegration).

In Vercel’s Marketplace, choose **Upstash Redis**, create a database for this To-Do app, and connect it to your existing To-Do project. Choose the plan that suits your usage. Use a dedicated database, not a database used by your calendar or another app. Keep eviction disabled.

The integration can add the REST connection variables to the project. In **Project → Settings → Environment Variables**, confirm one of these complete pairs is present for **Production**:

| Accepted pair | Value |
| --- | --- |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | The Redis HTTPS REST endpoint and read/write REST token |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | The same two values under Upstash’s native names |

Use one matching pair from the same database. Use the read/write token, not the read-only token. Do not use `REDIS_URL`, a TCP connection URL, or a `VITE_` variable for these values. If your integration adds a custom prefix, copy the values into one supported pair.

If you create the database directly in Upstash, copy its REST URL and token into the native pair above. The [REST API guide](https://upstash.com/docs/redis/features/restapi) shows where those credentials are located.

Connect the production database to Production only. Preview and local development should use separate databases and passwords if you need them. Do not reuse production task data for development.

## 3. Set your password

Add this environment variable to **Production** in Vercel:

| Name | Value |
| --- | --- |
| `TODO_PASSWORD` | A unique passphrase of at least 12 characters |

Enter the value directly in Vercel. Do not put it in GitHub, chat, the source files, or a variable starting with `VITE_`. Choose a long, unique passphrase; a password manager can generate and remember it.

Remove the old `VITE_NOW_PASSPHRASE` variable if you previously enabled it. This version does not use the old client-side gate.

## 4. Upload and redeploy

Replace your repository’s app files with the contents of this package. Keep the full source, particularly:

- `api/`
- `server/`
- `src/`
- `public/`
- `package.json` and `package-lock.json`
- `vite.config.js` and `vercel.json`
- `index.html`

Do not upload `node_modules` or any `.env.local` file. The package’s blank `.env.example` is safe to keep. Delete the old unused `src/Gate.jsx` if it remains in your repository.

Use Vercel’s **Vite** framework preset with build command `npm run build` and output directory `dist`. The included `vercel.json` sets these. Vercel must deploy both the frontend and the `api/` functions; uploading only `dist` will not work.

Commit to your production branch or redeploy in Vercel after the database and password variables are saved. Environment variable updates require a new deployment, as described in [Vercel’s documentation](https://vercel.com/docs/environment-variables).

## 5. Sign in and bring over your cards

Open your usual production address on the same computer/browser where you used the old app.

1. Enter your password. **Remember this browser for 90 days** is checked by default. Uncheck it on a less-trusted device for a 12-hour session.
2. If older local tasks are found, click **Add to shared tasks**. They upload to your database only when you choose that action. If the banner was dismissed, use **Your desk → Import older browser tasks**.
3. You can also use **Import backup** to load the spare JSON file. Imports add missing task IDs, keeping existing records unchanged. On an empty shared desk, they also restore flags, deck, and current focus.
4. Open the same production URL on your phone and sign in with the same password. The shared cards should appear.

Your old browser copy is kept, but this version does not keep updating it. New changes live in the shared database. Keep exporting backups when useful.

## 6. Quick live check

Create a temporary task on your computer. Open the app on your phone; it should appear immediately on loading, or within about 20 seconds if the app was already open. Edit it on the phone and confirm the change reaches your computer. Restore or complete it as you normally would.

Close and reopen the browser to confirm the remembered session. **Your desk → Sign out of this browser** should return that browser to the password screen while the other device stays signed in. In a private window, opening the app should require the password before showing tasks.

If something fails, share the error message and, if helpful, a screenshot with credential values concealed. Do not send passwords or database tokens.

## Troubleshooting

**“Setup is not finished”**: Confirm `TODO_PASSWORD` is at least 12 characters, one complete REST credential pair exists in Production, and a fresh deployment used those variables.

**“The server did not respond correctly”**: Confirm `api/` and `server/` were included, the project root is correct, and Vercel deployed server functions. A static-only host or `npm run preview` cannot serve them.

**“Shared task store is unavailable”**: Check that the REST token is read/write, the URL and token belong to the same active database, and the plan has available capacity.

**A save is unconfirmed**: Keep the tab open and use Retry. The same request ID is reused so a flag toggle or another action is not applied twice. Wait until that pending save resolves before continuing.

**My phone is empty**: Confirm you used the same production project/database and clicked Add to shared tasks on the original browser. The old browser data does not upload without that step. Different production/preview environments may intentionally use different databases.

**Too many attempts**: Wait 15 minutes before trying again. The limit is ten sign-in attempts per IP address per window.

**Change the password**: Update `TODO_PASSWORD` in Vercel and redeploy. Sessions created under the old password stop working on the new deployment. Vercel can retain older deployments with their older environment values; remove or protect obsolete deployment URLs if you are revoking a compromised password. Do not roll back to a deployment with an old password connected to your production database.

**Still seeing the old app**: Open the production URL and reload. Bookmarked immutable deployment URLs keep serving that specific older deployment.
