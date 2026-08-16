-- ============================================================
-- Leave Credits System — Supabase Schema
-- ============================================================

-- -----------------------------------------------
-- PROFILES TABLE (login identity + role)
-- -----------------------------------------------
create table if not exists leave_profiles (
  id           uuid primary key default gen_random_uuid(),
  username     text unique not null,
  email        text unique not null,
  full_name    text not null,
  role         text not null check (role in ('hrmo', 'aoii')),
  -- 'hrmo' = HRMO / administrator (full access)
  -- 'aoii' = Administrative Officer II / school-based (view/print only)
  school_id    text not null default 'DEFAULT',
  school_name  text not null default 'Default Organization',
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- -----------------------------------------------
-- ALLOWED USERS WHITELIST
-- -----------------------------------------------
create table if not exists leave_allowed_users (
  id                 uuid primary key default gen_random_uuid(),
  username           text unique not null,
  email              text not null,
  full_name          text,
  role               text not null default 'aoii' check (role in ('hrmo', 'aoii')),
  school_id          text not null default 'DEFAULT',
  school_name        text not null default 'Default Organization',
  registered_user_id uuid unique,
  added_by           text,
  created_at         timestamptz default now()
);

-- Safe migration for databases created with an earlier schema version.
alter table leave_allowed_users add column if not exists email text;
alter table leave_allowed_users add column if not exists full_name text;
alter table leave_allowed_users add column if not exists role text not null default 'aoii';
alter table leave_allowed_users add column if not exists school_id text not null default 'DEFAULT';
alter table leave_allowed_users add column if not exists school_name text not null default 'Default Organization';
alter table leave_allowed_users add column if not exists registered_user_id uuid unique;

-- The IECES dashboard manager populates this table. No public registration
-- account is pre-approved by default.

-- -----------------------------------------------
-- EMPLOYEES TABLE
-- -----------------------------------------------
create table if not exists leave_employees (
  id           uuid primary key default gen_random_uuid(),
  school_id    text not null default 'DEFAULT',

  -- Personal info
  last_name    text not null,
  first_name   text not null,
  middle_name  text,
  employee_no  text unique,                   -- government employee number
  position     text not null,
  emp_type     text not null check (emp_type in ('Teaching', 'Non-Teaching')),
  emp_status   text not null default 'Permanent'
               check (emp_status in ('Permanent','Temporary','Casual','Substitute','Co-terminus')),
  hired_date   date not null,                 -- date of original appointment
  salary_grade text,
  monthly_salary numeric(10,2),

  -- Non-Teaching leave fields
  -- VL and SL auto-accrue at 1.25 days/month each (CSC MC 41 s.1998)
  vl_used      numeric(6,2) default 0,
  sl_used      numeric(6,2) default 0,
  vl_override  numeric(6,2),                 -- HRMO manual correction; null = use auto-computed
  sl_override  numeric(6,2),                 -- null = use auto-computed

  -- Teaching leave fields (VSC per DepEd Order 013, s. 2024)
  -- Teaching staff are NOT entitled to VL/SL
  vsc_balance  numeric(6,2) default 0,       -- current VSC balance (HRMO-encoded)
  vsc_used     numeric(6,2) default 0,       -- VSC used/offset total
  vsc_earned_this_sy numeric(6,2) default 0, -- earned in current school year
  vsc_max      integer default 15            -- 15 / 30 / 45 based on years of service

    check (vsc_max in (15, 30, 45)),

  -- Metadata
  is_active    boolean default true,
  notes        text,
  created_by   text,
  updated_by   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index idx_leave_employees_school on leave_employees (school_id);
create index idx_leave_employees_type   on leave_employees (emp_type);
create index idx_leave_employees_active on leave_employees (is_active);

-- -----------------------------------------------
-- LEAVE TRANSACTIONS TABLE
-- (Tracks each leave application / deduction / credit)
-- -----------------------------------------------
create table if not exists leave_transactions (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references leave_employees(id) on delete cascade,
  school_id      text not null,

  txn_type       text not null check (txn_type in (
                   'VL_DEBIT',      -- VL used
                   'SL_DEBIT',      -- SL used
                   'VSC_CREDIT',    -- VSC earned (HRMO input)
                   'VSC_DEBIT',     -- VSC used/offset
                   'VL_ADJUST',     -- HRMO manual VL adjustment
                   'SL_ADJUST',     -- HRMO manual SL adjustment
                   'MONETIZE',      -- Leave monetization
                   'SPECIAL'        -- Special leave (maternity, VAWC, emergency, etc.)
                 )),

  leave_type     text not null,               -- 'VL','SL','VSC','Maternity','VAWC', etc.
  days           numeric(5,2) not null,        -- positive = credit, negative = debit
  date_from      date,
  date_to        date,
  reason         text,                         -- illness / personal / official, etc.
  remarks        text,                         -- e.g. "VSC applied", "with pay"
  with_pay       boolean default true,

  -- For special leaves
  approved_by    text,
  order_no       text,                         -- Special Order number for VSC

  recorded_by    text not null,               -- username of HRMO who encoded
  created_at     timestamptz default now()
);

create index idx_leave_txn_employee on leave_transactions (employee_id);
create index idx_leave_txn_date     on leave_transactions (date_from);
create index idx_leave_txn_school   on leave_transactions (school_id);

-- -----------------------------------------------
-- ACCRUAL LOG TABLE
-- (Monthly auto-accrual log for Non-Teaching)
-- -----------------------------------------------
create table if not exists leave_accrual_log (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references leave_employees(id) on delete cascade,
  accrual_month  text not null,               -- e.g. '2026-08'
  vl_credited    numeric(4,2) default 1.25,
  sl_credited    numeric(4,2) default 1.25,
  run_by         text,
  run_at         timestamptz default now(),
  unique(employee_id, accrual_month)          -- prevent double accrual
);

-- -----------------------------------------------
-- SCHOOL YEAR CONFIG
-- -----------------------------------------------
create table if not exists leave_sy_config (
  id           uuid primary key default gen_random_uuid(),
  school_year  text not null unique,          -- e.g. '2026-2027'
  date_start   date not null,
  date_end     date not null,
  is_current   boolean default false,
  created_at   timestamptz default now()
);

insert into leave_sy_config (school_year, date_start, date_end, is_current)
values ('2026-2027', '2026-06-01', '2027-03-31', true)
on conflict do nothing;

-- -----------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------
alter table leave_profiles       enable row level security;
alter table leave_allowed_users  enable row level security;
alter table leave_employees      enable row level security;
alter table leave_transactions   enable row level security;
alter table leave_accrual_log    enable row level security;
alter table leave_sy_config      enable row level security;

-- Profiles: users can read all, update only their own
create policy "profiles_select" on leave_profiles for select using (true);
create policy "profiles_update" on leave_profiles for update using (auth.uid() = id);

-- Allowed users: readable by all authenticated users
create policy "allowed_select"  on leave_allowed_users for select using (auth.role() = 'authenticated');

-- Employees: all authenticated users can read; only HRMO can write
create policy "employees_select" on leave_employees for select using (auth.role() = 'authenticated');
create policy "employees_insert" on leave_employees for insert
  with check (
    exists (
      select 1 from leave_profiles
      where id = auth.uid() and role = 'hrmo'
    )
  );
create policy "employees_update" on leave_employees for update
  using (
    exists (
      select 1 from leave_profiles
      where id = auth.uid() and role = 'hrmo'
    )
  );
create policy "employees_delete" on leave_employees for delete
  using (
    exists (
      select 1 from leave_profiles
      where id = auth.uid() and role = 'hrmo'
    )
  );

-- Transactions: all authenticated can read; HRMO can insert
create policy "txn_select" on leave_transactions for select using (auth.role() = 'authenticated');
create policy "txn_insert"  on leave_transactions for insert
  with check (
    exists (
      select 1 from leave_profiles
      where id = auth.uid() and role = 'hrmo'
    )
  );

-- Accrual log: all authenticated can read; HRMO can insert
create policy "accrual_select" on leave_accrual_log for select using (auth.role() = 'authenticated');
create policy "accrual_insert" on leave_accrual_log for insert
  with check (
    exists (
      select 1 from leave_profiles
      where id = auth.uid() and role = 'hrmo'
    )
  );

-- SY config: readable by all
create policy "sy_select" on leave_sy_config for select using (true);

-- -----------------------------------------------
-- HELPER FUNCTIONS
-- -----------------------------------------------

-- Get email by username (for login lookup)
create or replace function get_leave_email_by_username(uname text)
returns text language sql security definer as $$
  select email from leave_profiles where username = uname limit 1;
$$;

-- Registration is available only to people pre-approved in the dashboard
-- manager's leave_allowed_users list. Optional allowlist emails must match.
create or replace function can_register_leave_user(uname text, user_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from leave_allowed_users
    where lower(username) = lower(trim(uname))
      and registered_user_id is null
      and email is not null
      and lower(email) = lower(trim(user_email))
  );
$$;

revoke all on function can_register_leave_user(text, text) from public;
grant execute on function can_register_leave_user(text, text) to anon, authenticated;

-- Enforce the same allowlist in the database so the browser check cannot be
-- bypassed. The trigger creates the application profile from manager data.
create or replace function handle_leave_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed leave_allowed_users%rowtype;
  signup_username text := trim(new.raw_user_meta_data ->> 'username');
begin
  select * into allowed
  from leave_allowed_users
  where lower(username) = lower(signup_username)
    and registered_user_id is null
    and email is not null
    and lower(email) = lower(new.email)
  limit 1;

  if not found then
    raise exception 'Registration is not authorized for this user';
  end if;

  insert into leave_profiles (
    id, username, email, full_name, role, school_id, school_name
  ) values (
    new.id,
    allowed.username,
    new.email,
    coalesce(nullif(allowed.full_name, ''), nullif(new.raw_user_meta_data ->> 'full_name', ''), allowed.username),
    allowed.role,
    allowed.school_id,
    allowed.school_name
  );

  update leave_allowed_users
  set registered_user_id = new.id
  where id = allowed.id;

  return new;
end;
$$;

drop trigger if exists on_leave_auth_user_created on auth.users;
create trigger on_leave_auth_user_created
  after insert on auth.users
  for each row execute function handle_leave_user_signup();

-- Months of service (for auto-computed balances in views)
create or replace function months_of_service(hired date, ref_date date default current_date)
returns integer language sql immutable as $$
  select greatest(0,
    (extract(year from age(ref_date, hired)) * 12 +
     extract(month from age(ref_date, hired)))::integer
  );
$$;

-- -----------------------------------------------
-- COMPUTED BALANCE VIEW (convenience for queries)
-- -----------------------------------------------
create or replace view leave_balances as
select
  e.id,
  e.school_id,
  e.last_name,
  e.first_name,
  e.middle_name,
  e.employee_no,
  e.position,
  e.emp_type,
  e.emp_status,
  e.hired_date,
  e.monthly_salary,
  e.is_active,

  -- Non-Teaching computed balances
  case when e.emp_type = 'Non-Teaching' then
    coalesce(e.vl_override,
      greatest(0, round((months_of_service(e.hired_date) * 1.25 - e.vl_used)::numeric, 2)))
  end as vl_balance,

  case when e.emp_type = 'Non-Teaching' then
    coalesce(e.sl_override,
      greatest(0, round((months_of_service(e.hired_date) * 1.25 - e.sl_used)::numeric, 2)))
  end as sl_balance,

  case when e.emp_type = 'Non-Teaching' then
    round((months_of_service(e.hired_date) * 1.25)::numeric, 2)
  end as vl_total_earned,

  e.vl_used,
  e.sl_used,

  -- Teaching VSC
  case when e.emp_type = 'Teaching' then e.vsc_balance end as vsc_balance,
  case when e.emp_type = 'Teaching' then e.vsc_used    end as vsc_used,
  case when e.emp_type = 'Teaching' then e.vsc_earned_this_sy end as vsc_earned_this_sy,
  case when e.emp_type = 'Teaching' then e.vsc_max     end as vsc_max,

  months_of_service(e.hired_date) as months_served,
  e.notes
from leave_employees e
where e.is_active = true;
