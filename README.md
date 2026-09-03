# Leave Credits Management System (LCMS)

Personnel leave records and credit management for HRMO and school-based users.

---

## Stack
- **Electron** + **React** + **Vite**
- **Supabase** (auth + database)
- **electron-updater** (auto-updates via GitHub Releases)

## Roles
| Role | Access |
|------|--------|
| `hrmo` | HRMO / administrator — full access: add/edit employees and input leave |
| `aoii` | Administrative Officer II / school-based — view, search, print only |

---

## Setup

### 1. Clone & install
```bash
git clone https://github.com/depedICSDO/lcms.git
cd lcms
npm install
```

### 2. Configure the IECES Dashboard Manager Supabase project
1. Use the existing IECES Dashboard Manager Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor to create the operational tables.
3. Run `supabase/LCMS_SQL_EDITOR_SETUP.sql` to create `LCMS-profiles`,
   `LCMS-allowed-users`, the registration functions, trigger, grants, and RLS policies.
4. Run `supabase/feature_leave_enhancements.sql` to enable protected VL,
   fixed 30-day monetization choices, one-year CTO expiry, and cancellation handling.
5. Keep the shared project's existing Auth/email-confirmation setting; LCMS
   supports either confirmed-email or immediate-session registration.

### 3. Create `.env`
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Approve and register users

Before a person can use the Register tab, the IECES dashboard manager must add
their username and email to the allowlist:

```sql
INSERT INTO public."LCMS-allowed-users" (
  username, email, full_name, role, school_id, school_name, added_by
) VALUES (
  'hrmo_admin', 'hrmo@example.com', 'HRMO Staff', 'hrmo',
  'DEFAULT', 'Default Organization', 'dashboard-manager'
);
```

The approved person can then open the app, select **Register**, and enter the
same username and email. Registration is checked and enforced by Supabase; the
database creates the corresponding profile automatically. Depending on the
Supabase Auth settings, the person may need to confirm their email before login.

The trigger is tagged with `app_id = LCMS`, so it does not interfere with Auth
registrations made by the IECES Dashboard Manager or other apps in the same
Supabase project. Keep the Supabase service-role key out of this Electron app;
only the public anon key belongs in `.env`.

### Leave request and approval workflow

1. An AOII selects an employee and submits a leave request. No balance changes
   while the request is pending.
2. HRMO receives the request in the Pending Leave Requests panel.
3. After the employee and authorizing official have signed and approved CS Form
   6, HRMO clicks **Approve** and confirms the warning prompt.
4. Supabase atomically checks the balance, deducts VL/SL/VSC/CTO when applicable,
   creates the leave transaction, and marks the request approved. Rejecting a
   request never changes the employee balance.

This cross-user workflow requires an online Supabase connection. For an existing
project, run `supabase/feature_leave_enhancements.sql` once after deploying this version.

### 5. Run in dev
```bash
npm run dev
```

Development builds provide a local diagnostic HRMO login (`admin` / `admin`)
for UI and offline bug checks. It is compiled out of production builds and does
not authenticate to Supabase.

### 6. Build for Windows
```bash
npm run dist
```

---

## Leave Rules Implemented
| Type | Rule | Basis |
|------|------|-------|
| Non-Teaching VL | 1.25 days/month (15 days/year) | CSC MC 41, s. 1998 |
| Non-Teaching SL | 1.25 days/month (15 days/year) | CSC MC 41, s. 1998 |
| Teaching VSC | HRMO-encoded; max 15/30/45 days by years of service | DepEd Order 013, s. 2024 |
| Teaching VL/SL | NOT entitled | CSC MC 41 s.1998 / RA 4670 |
| Mandatory / Forced Leave | Any VL usage counts toward the 5-day annual minimum; untaken required days are forfeited at year-end | CSC MC 41 s.1998 Sec. 25 |
| Special Privilege Leave | 3 days/year, outside accumulated VL/SL | EO 292, Rule XVI, Sec. 21 |
| Standard Monetization | 10–30 VL days/year; retain at least 5 VL days | CSC MC 41, s. 1998, Sec. 22 |
| Wellness Leave | 3 days/year, outside accumulated VL/SL | DepEd wellness leave policy |

The year-end mandatory-leave job runs through Supabase Cron every January 1.
A signing-authority cancellation due to exigency of service is documented and
the exact original VL deduction is restored. A documented retirement/resignation
date exempts the employee from that calendar year's automatic forfeiture and
creates an audit-history entry. Monetization remains visible in the same leave
transaction history and does not count as mandatory leave taken.

---

## Local SQLite and Backup

The Electron application keeps a local SQLite copy of employee and leave
transaction records. Changes made while Supabase is unavailable are queued and
retried automatically when the computer reconnects.

HRMO users can use **Backup** and **Restore** in the top bar:

- **Backup** exports the complete local SQLite database, including pending sync
  operations, to a `.sqlite` file selected by the user.
- **Restore** validates a selected backup, saves a safety copy of the active
  database, restores the selected file, and restarts the application.

Copy the exported `.sqlite` file to the new computer and use **Restore** after
installing and configuring the application. Supabase login credentials and the
`.env` configuration are intentionally not included in database backups.

SQLite backup files contain personnel information and are not encrypted. Store
them only in an access-controlled location or encrypted drive.

---

## Release
The installed app checks GitHub automatically after startup and every four
hours. **Check Updates** is also available in the dashboard. On Windows, when
an update has downloaded, pressing **OK** closes LCMS, installs the update, and
restarts the app automatically. On macOS, the update prompt opens the matching
GitHub Release page so the user can download the Intel or Apple Silicon DMG.

Before publishing, update the version in `package.json` and `package-lock.json`,
commit and push that change, then create a matching `v*` tag. For example:

```bash
npm version 1.0.1 --no-git-tag-version
git add package.json package-lock.json
git commit -m "Release v1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

The release workflow verifies that the tag matches the package version, runs
the tests, builds the Windows NSIS installer and both macOS DMGs, and creates
one GitHub Release after both builds succeed. The release contains the Windows
installer, blockmap, `latest.yml` updater metadata, and the Intel and Apple
Silicon macOS installers. Configure the repository Actions secrets
`VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` before creating a release tag.

GitHub-based automatic updates require the release assets to be accessible to
the installed clients. Keep the repository/releases public, or configure a
separate authenticated update provider for a private deployment.
