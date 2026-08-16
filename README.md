# Leave Credits System

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
git clone https://github.com/jaybhee84/leave-credits-system.git
cd leave-credits-system
npm install
```

### 2. Create Supabase project
1. Create a new project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Under **Auth → Settings**, disable email confirmation

### 3. Create `.env`
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Approve and register users

For an existing Supabase project, first run
`supabase/migrations/20260817_controlled_registration.sql` in the SQL Editor.
New projects can run the complete `supabase/schema.sql` instead.

Before a person can use the Register tab, the IECES dashboard manager must add
their username and email to the allowlist:

```sql
INSERT INTO leave_allowed_users (
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

### 5. Run in dev
```bash
npm run dev
```

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
| Forced Leave | Required if VL ≥ 10 days (5 days minimum) | CSC MC 41 s.1998 Sec. 25 |
| Monetization | Up to 50% of accumulated credits | CSC MC 2, s. 2016 |
| Wellness Leave | Up to 5 days yearly; non-cumulative and non-commutable | CSC MC 1, s. 2026 / DepEd DO 2, s. 2026 |

---

## Release
Tag a commit with `v*` to trigger the GitHub Actions build:
```bash
git tag v1.0.0
git push origin v1.0.0
```
