# Frontend

Static site, no build step — plain HTML/CSS/JS, `@supabase/supabase-js`
loaded via an import map (see any page's `<head>`). Every page pairs one
`.html` file with one `.js` file of the same name (except `style.css` and
`nav.js`, which are shared).

Serve locally with `npx serve frontend` (or the `dog-park-static` launch
config, which does the same thing).

## Pages

| File | Purpose |
|---|---|
| `index.html` / `app.js` | Log in, sign up, forgot/reset password request, and a signed-in profile summary. The entry point for auth. |
| `reset-password.html` / `reset-password.js` | Where the password-reset email link lands; lets someone set a new password. |
| `browse.html` / `browse.js` | Public dog listing — filters (size/age/shelter/search), save/heart toggle, links out to `dog-detail.html`. |
| `dog-detail.html` / `dog-detail.js` | One dog's full listing: photos, shelter info, and the adoption application form (submit/withdraw). |
| `account.html` / `account.js` | An adopter's own applications and saved dogs. |
| `shelter-dashboard.html` / `shelter-dashboard.js` | A shelter's view of their own dogs: stats, add/edit a dog, and the in-app "still have this dog?" check-in prompt. |
| `admin.html` / `admin.js` | Moderation queue for duplicate-photo flags: hide/restore, delete, dismiss/undismiss, and merge two listings. Restricted to `platform_admin`. |

## Shared

| File | Purpose |
|---|---|
| `style.css` | The whole design system — colors, fonts, and every reusable component class (buttons, tags, cards, tables, modals). One file, no per-page overrides. |
| `nav.js` | Renders the top-right nav (email/login-link/logout, and role-aware links to Moderation / My dogs / Account) on every page except `index.html`, which has its own richer profile display. Call `initNav(supabase)` after creating the Supabase client. |

## Conventions

- Every `.js` file creates its own `supabase` client (same URL/anon key
  literal in each file — there's no bundler to share a module-level
  constant across a `<script type="module">` boundary without an extra
  build step, so it's just repeated).
- Internal links to `dog-detail.html` use the extensionless path
  (`dog-detail?id=...`) — `npx serve`'s clean-URL redirect drops query
  strings when redirecting `foo.html?query` to `foo`, so linking to the
  already-clean path avoids that redirect entirely.
