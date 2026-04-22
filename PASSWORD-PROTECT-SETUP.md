# Password Protect the Dashboard

The dashboard now requires visitors to enter a shared password before seeing
any of the site. This doc walks through the two things you need to do on
Vercel to finish turning it on.

Estimated time: **5 minutes**.

---

## What got added

- A `/login` page with a branded password prompt.
- A signed cookie that keeps visitors logged in for **7 days**.
- A gatekeeper (`src/proxy.ts`) that redirects anyone without a valid cookie
  to `/login`.
- Two API routes: `/api/auth/login` (validates the password) and
  `/api/auth/logout` (clears the cookie).

You don't need to touch any of those files. All you need to do is tell Vercel
what password to use.

---

## Step 1 — Pick a password and a secret

You need two values:

**1. The password itself** — what visitors will type to get in.
Pick something memorable but not trivial. Example: `BluebonnetRoadmap2026`.

**2. A session secret** — a long random string used to sign the login cookie.
Don't reuse the password here. Generate one by pasting the following into
**https://www.random.org/strings/** (35 characters, digits + letters + both
cases) or, if you have a terminal handy, run:

```bash
openssl rand -base64 32
```

You'll get something like `8K4v+Qh2pRgXJfMnLw7tAeZsDcBxYhVkNqPmRlTuSgE=`.

Keep both values somewhere safe (password manager, encrypted note). If you
lose the session secret nothing breaks — it just signs everyone out.

---

## Step 2 — Add them to Vercel

1. Open **https://vercel.com/dashboard** and click the `medicaid-dashboard`
   project.
2. Click **Settings** (top nav) → **Environment Variables** (left sidebar).
3. Add the first variable:
   - **Key:** `DASHBOARD_PASSWORD`
   - **Value:** the password you picked
   - **Environments:** check **Production** and **Preview**. Leave
     **Development** alone — Vercel locks it for sensitive variables, and
     you don't need it there.
   - Click **Save**.
4. Add the second variable:
   - **Key:** `SESSION_SECRET`
   - **Value:** the random string you generated
   - **Environments:** Production + Preview (same as above)
   - Click **Save**.

> **Why not Development?** Vercel treats these values as Sensitive by default,
> and Sensitive variables can't live in the Development environment — that's
> a Vercel-side rule for `vercel dev` CLI workflows, which you aren't using.
> The locked checkbox is expected. Production + Preview is all the live site
> needs.
5. Go to the **Deployments** tab → click the `⋯` on the latest deployment →
   **Redeploy**. (Vercel needs to rebuild the site with the new env vars —
   just saving them isn't enough.)

Wait ~60 seconds for the redeploy to finish.

---

## Step 3 — Test it

1. Open an **incognito / private window** (so no old session is cached).
2. Visit **https://texasmedicaiddashboard.net**.
3. You should land on a dark-themed login screen instead of the dashboard.
4. Type your password. You should be redirected to the dashboard.
5. Close the window. Open another incognito window and try a wrong
   password — you should see an "Incorrect password" message.

---

## Changing the password later

Just change the `DASHBOARD_PASSWORD` value in Vercel env vars and redeploy.
Anyone already logged in will stay logged in for up to 7 days. If you want
to force **everyone** to sign back in immediately (e.g. because the password
leaked), also change `SESSION_SECRET` — that invalidates every existing
session cookie instantly.

---

## Local development

If you run the dashboard locally (`npm run dev`), add both values to the
`.env` file in the `medicaid-dashboard/` folder. The `.env` file is already
in `.gitignore`, so it won't be committed.

```
DASHBOARD_PASSWORD=some-dev-password
SESSION_SECRET=some-long-random-string-at-least-32-chars
```

Restart the dev server after editing `.env`.

---

## Troubleshooting

**"Login is not configured on the server"**
One of the env vars is missing or empty. Double-check both `DASHBOARD_PASSWORD`
and `SESSION_SECRET` are set in Vercel, then redeploy.

**Redirect loop between `/` and `/login`**
Usually means `SESSION_SECRET` changed between the login request and the page
load — most often caused by different values in different Vercel environments
(Production vs Preview). Make sure both vars are set for all three
environments.

**The login page loads but shows "Network error"**
Confirm the deployment finished and that you're on the custom domain. The
login endpoint is at `/api/auth/login` — if it 404s, the latest build didn't
deploy.
