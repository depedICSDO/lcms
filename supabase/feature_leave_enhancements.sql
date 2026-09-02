-- LCMS feature upgrade: protected VL, 30-day monetization, and expiring CTO.
-- Run after schema.sql and LCMS_SQL_EDITOR_SETUP.sql in the Supabase SQL editor.

alter table public.leave_employees
  add column if not exists protected_vl_balance numeric(6,2) not null default 0
  check (protected_vl_balance >= 0);

alter table public.leave_requests
  add column if not exists monetization_option text
  check (monetization_option is null or monetization_option in ('VL25_SL5', 'VL30')),
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz;

alter table public.leave_transactions drop constraint if exists leave_transactions_txn_type_check;
alter table public.leave_transactions add constraint leave_transactions_txn_type_check check (txn_type in (
  'VL_DEBIT','SL_DEBIT','VSC_CREDIT','VSC_DEBIT','VL_ADJUST','SL_ADJUST',
  'MONETIZE','SPECIAL','CTO_CREDIT','CTO_DEBIT','VL_PROTECTED_CREDIT'
));

alter table public.leave_requests drop constraint if exists leave_requests_txn_type_check;
alter table public.leave_requests add constraint leave_requests_txn_type_check
  check (txn_type in ('VL_DEBIT','SL_DEBIT','VSC_DEBIT','SPECIAL','MONETIZE','CTO_DEBIT'));
alter table public.leave_requests drop constraint if exists leave_requests_status_check;
alter table public.leave_requests add constraint leave_requests_status_check
  check (status in ('pending','approved','rejected','cancelled'));

create table if not exists public.leave_cto_credits (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.leave_employees(id) on delete cascade,
  school_id text not null,
  granted_days numeric(5,2) not null check (granted_days > 0),
  remaining_days numeric(5,2) not null check (remaining_days >= 0 and remaining_days <= granted_days),
  granted_on date not null,
  expires_on date not null,
  remarks text,
  granted_by text not null,
  created_at timestamptz not null default now(),
  check (expires_on = (granted_on + interval '1 year')::date)
);
create index if not exists idx_cto_employee_expiry
  on public.leave_cto_credits(employee_id, expires_on) where remaining_days > 0;

-- Enforce the configured calendar-year limits for both direct HRMO entries and
-- leave-request approvals. Existing positive SPECIAL rows and newer negative
-- usage rows are both counted through abs(days).
create or replace function public.lcms_enforce_annual_leave_limit()
returns trigger language plpgsql set search_path = '' as $$
declare annual_limit numeric; annual_used numeric;
begin
  annual_limit := case new.leave_type
    when 'Mandatory / Forced Leave' then 5
    when 'Special Privilege Leave' then 3
    when 'Wellness Leave' then 3
    else null
  end;
  if annual_limit is null or new.date_from is null then return new; end if;

  select coalesce(sum(abs(days)), 0) into annual_used
  from public.leave_transactions
  where employee_id = new.employee_id
    and leave_type = new.leave_type
    and date_from >= date_trunc('year', new.date_from)::date
    and date_from < (date_trunc('year', new.date_from) + interval '1 year')::date;
  if annual_used + abs(new.days) > annual_limit then
    raise exception '% annual entitlement exceeded: % of % day(s) remain',
      new.leave_type, greatest(0, annual_limit - annual_used), annual_limit;
  end if;
  return new;
end $$;

drop trigger if exists lcms_enforce_annual_leave_limit on public.leave_transactions;
create trigger lcms_enforce_annual_leave_limit
before insert on public.leave_transactions
for each row execute function public.lcms_enforce_annual_leave_limit();
alter table public.leave_cto_credits enable row level security;
grant select on table public.leave_cto_credits to authenticated;
drop policy if exists "cto_select" on public.leave_cto_credits;
create policy "cto_select" on public.leave_cto_credits for select to authenticated
using ((select public.lcms_is_hrmo()) or school_id = (select public.lcms_current_school_id()));

drop policy if exists "requests_insert_aoii" on public.leave_requests;
create policy "requests_insert_aoii" on public.leave_requests for insert to authenticated
with check (
  requested_by_user = (select auth.uid()) and status = 'pending' and not form6_confirmed
  and school_id = (select public.lcms_current_school_id())
  and exists (select 1 from public."LCMS-profiles" p where p.id = (select auth.uid()) and p.role = 'aoii' and p.is_active)
  and exists (select 1 from public.leave_employees e where e.id = leave_requests.employee_id
    and e.school_id = leave_requests.school_id and e.is_active
    and ((e.emp_type = 'Teaching' and leave_requests.txn_type in ('VSC_DEBIT','CTO_DEBIT','SPECIAL'))
      or (e.emp_type = 'Non-Teaching' and leave_requests.txn_type in ('VL_DEBIT','SL_DEBIT','MONETIZE','CTO_DEBIT','SPECIAL'))))
);

create or replace function public.lcms_grant_cto(
  employee_uuid uuid, credit_days numeric, granted_date date, grant_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare employee public.leave_employees%rowtype; actor text; credit_id uuid;
begin
  if not public.lcms_is_hrmo() then raise exception 'Only an active HRMO account can grant CTO'; end if;
  if credit_days <= 0 then raise exception 'CTO days must be greater than zero'; end if;
  select * into employee from public.leave_employees where id = employee_uuid for update;
  if not found then raise exception 'Employee not found'; end if;
  select username into actor from public."LCMS-profiles" where id = (select auth.uid()) and is_active;
  insert into public.leave_cto_credits
    (employee_id, school_id, granted_days, remaining_days, granted_on, expires_on, remarks, granted_by)
  values (employee.id, employee.school_id, credit_days, credit_days, granted_date,
          (granted_date + interval '1 year')::date, grant_note, actor)
  returning id into credit_id;
  insert into public.leave_transactions
    (employee_id, school_id, txn_type, leave_type, days, date_from, date_to, remarks, recorded_by)
  values (employee.id, employee.school_id, 'CTO_CREDIT', 'Compensatory Time Off (CTO)', credit_days,
          granted_date, granted_date, grant_note, actor);
  return credit_id;
end $$;

create or replace function public.lcms_use_cto(
  employee_uuid uuid, used_days numeric, used_date date, use_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare employee public.leave_employees%rowtype; actor text; available numeric; remaining numeric; take_days numeric;
  credit record; transaction_uuid uuid;
begin
  if not public.lcms_is_hrmo() then raise exception 'Only an active HRMO account can deduct CTO'; end if;
  if used_days <= 0 then raise exception 'CTO days must be greater than zero'; end if;
  select * into employee from public.leave_employees where id = employee_uuid for update;
  if not found then raise exception 'Employee not found'; end if;
  select coalesce(sum(remaining_days), 0) into available from public.leave_cto_credits
    where employee_id = employee.id and remaining_days > 0 and expires_on > used_date;
  if used_days > available then raise exception 'Insufficient unexpired CTO balance'; end if;
  remaining := used_days;
  for credit in select id, remaining_days from public.leave_cto_credits
    where employee_id = employee.id and remaining_days > 0 and expires_on > used_date
    order by expires_on, granted_on for update
  loop
    exit when remaining <= 0;
    take_days := least(remaining, credit.remaining_days);
    update public.leave_cto_credits set remaining_days = remaining_days - take_days where id = credit.id;
    remaining := remaining - take_days;
  end loop;
  select username into actor from public."LCMS-profiles" where id = (select auth.uid()) and is_active;
  insert into public.leave_transactions
    (employee_id, school_id, txn_type, leave_type, days, date_from, date_to, remarks, recorded_by)
  values (employee.id, employee.school_id, 'CTO_DEBIT', 'Compensatory Time Off (CTO)', -used_days,
          used_date, used_date, use_note, actor) returning id into transaction_uuid;
  return transaction_uuid;
end $$;

create or replace function public.lcms_record_monetization(
  employee_uuid uuid, deduction_option text, monetization_date date, monetization_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare employee public.leave_employees%rowtype; actor text; vl_days numeric; sl_days numeric;
  regular_vl numeric; available_sl numeric; transaction_uuid uuid;
begin
  if not public.lcms_is_hrmo() then raise exception 'Only an active HRMO account can record monetization'; end if;
  if deduction_option = 'VL25_SL5' then vl_days := 25; sl_days := 5;
  elsif deduction_option = 'VL30' then vl_days := 30; sl_days := 0;
  else raise exception 'Invalid monetization option'; end if;
  select * into employee from public.leave_employees where id = employee_uuid for update;
  if not found or employee.emp_type <> 'Non-Teaching' then raise exception 'Monetization is only for non-teaching employees'; end if;
  regular_vl := coalesce(employee.vl_override,
    greatest(0, public.months_of_service(employee.hired_date) * 1.25 - coalesce(employee.vl_used, 0)));
  available_sl := coalesce(employee.sl_override,
    greatest(0, public.months_of_service(employee.hired_date) * 1.25 - coalesce(employee.sl_used, 0)));
  if regular_vl < vl_days then raise exception 'Insufficient monetizable VL balance'; end if;
  if available_sl < sl_days then raise exception 'Insufficient SL balance'; end if;
  select username into actor from public."LCMS-profiles" where id = (select auth.uid()) and is_active;
  update public.leave_employees set
    vl_used = coalesce(vl_used, 0) + vl_days, sl_used = coalesce(sl_used, 0) + sl_days,
    vl_override = case when vl_override is null then null else vl_override - vl_days end,
    sl_override = case when sl_override is null then null else sl_override - sl_days end,
    updated_at = now(), updated_by = actor where id = employee.id;
  insert into public.leave_transactions
    (employee_id, school_id, txn_type, leave_type, days, date_from, date_to, remarks, recorded_by)
  values (employee.id, employee.school_id, 'MONETIZE', 'Monetization of Leave Credits', -30,
          monetization_date, monetization_date,
          concat(deduction_option, case when monetization_note is null then '' else ': ' || monetization_note end), actor)
  returning id into transaction_uuid;
  return transaction_uuid;
end $$;

-- Replace request approval so monetization, protected VL, and CTO are enforced atomically.
create or replace function public.lcms_approve_leave_request(
  request_uuid uuid, form6_is_confirmed boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare requested public.leave_requests%rowtype; employee public.leave_employees%rowtype;
  regular_balance numeric; protected_used numeric; regular_used numeric;
  new_transaction_id uuid; approver_name text; remaining numeric; take_days numeric; credit record;
  annual_used numeric; annual_limit numeric;
begin
  if not public.lcms_is_hrmo() then raise exception 'Only an active HRMO account can approve leave requests'; end if;
  if not coalesce(form6_is_confirmed, false) then raise exception 'Approval requires confirmation of the signed and approved CS Form 6'; end if;
  select username into approver_name from public."LCMS-profiles" where id = (select auth.uid()) and is_active;
  select * into requested from public.leave_requests where id = request_uuid for update;
  if not found then raise exception 'Leave request not found'; end if;
  if requested.status <> 'pending' then raise exception 'Leave request has already been reviewed'; end if;
  select * into employee from public.leave_employees where id = requested.employee_id for update;
  if not found or employee.school_id <> requested.school_id then raise exception 'Employee and request school do not match'; end if;

  -- Calendar-year entitlements: mandatory leave is charged to VL; Special
  -- Privilege and Wellness Leave are recorded outside accumulated VL/SL.
  annual_limit := case requested.leave_category
    when 'mandatory_forced' then 5
    when 'special_privilege' then 3
    when 'wellness' then 3
    else null
  end;
  if annual_limit is not null then
    select coalesce(sum(abs(days)), 0) into annual_used
    from public.leave_transactions
    where employee_id = employee.id
      and leave_type = requested.leave_type
      and date_from >= date_trunc('year', requested.date_from)::date
      and date_from < (date_trunc('year', requested.date_from) + interval '1 year')::date;
    if annual_used + requested.days > annual_limit then
      raise exception '% annual entitlement exceeded: % of % day(s) remain',
        requested.leave_type, greatest(0, annual_limit - annual_used), annual_limit;
    end if;
  end if;

  if requested.txn_type = 'MONETIZE' then
    if requested.days <> 30 then raise exception 'Monetization must deduct exactly 30 days'; end if;
    select public.lcms_record_monetization(employee.id, requested.monetization_option,
      requested.date_from, requested.remarks) into new_transaction_id;
  elsif requested.txn_type = 'CTO_DEBIT' then
    select public.lcms_use_cto(employee.id, requested.days, requested.date_from,
      requested.remarks) into new_transaction_id;
  else
    if requested.txn_type = 'VL_DEBIT' then
      if employee.emp_type <> 'Non-Teaching' then raise exception 'VL deduction is not valid for this employee type'; end if;
      regular_balance := coalesce(employee.vl_override,
        greatest(0, public.months_of_service(employee.hired_date) * 1.25 - coalesce(employee.vl_used, 0)));
      if requested.days > regular_balance + employee.protected_vl_balance then raise exception 'Insufficient vacation leave balance'; end if;
      regular_used := least(requested.days, regular_balance);
      protected_used := requested.days - regular_used;
      update public.leave_employees set vl_used = coalesce(vl_used, 0) + regular_used,
        vl_override = case when vl_override is null then null else vl_override - regular_used end,
        protected_vl_balance = protected_vl_balance - protected_used,
        updated_at = now(), updated_by = approver_name where id = employee.id;
    elsif requested.txn_type = 'SL_DEBIT' then
      if employee.emp_type <> 'Non-Teaching' then raise exception 'SL deduction is not valid for this employee type'; end if;
      regular_balance := coalesce(employee.sl_override,
        greatest(0, public.months_of_service(employee.hired_date) * 1.25 - coalesce(employee.sl_used, 0)));
      if requested.days > regular_balance then raise exception 'Insufficient sick leave balance'; end if;
      update public.leave_employees set sl_used = coalesce(sl_used, 0) + requested.days,
        sl_override = case when sl_override is null then null else sl_override - requested.days end,
        updated_at = now(), updated_by = approver_name where id = employee.id;
    elsif requested.txn_type = 'VSC_DEBIT' then
      if employee.emp_type <> 'Teaching' or requested.days > coalesce(employee.vsc_balance, 0) then
        raise exception 'Insufficient or invalid VSC balance';
      end if;
      update public.leave_employees set vsc_used = coalesce(vsc_used, 0) + requested.days,
        vsc_balance = vsc_balance - requested.days, updated_at = now(), updated_by = approver_name
        where id = employee.id;
    end if;
    insert into public.leave_transactions
      (employee_id, school_id, txn_type, leave_type, days, date_from, date_to,
       reason, remarks, with_pay, approved_by, recorded_by)
    values (employee.id, employee.school_id, requested.txn_type, requested.leave_type,
      case when requested.txn_type in ('VL_DEBIT','SL_DEBIT','VSC_DEBIT','SPECIAL') then -requested.days else requested.days end,
      requested.date_from, requested.date_to, requested.reason, requested.remarks,
      requested.with_pay, approver_name, approver_name) returning id into new_transaction_id;
  end if;
  update public.leave_requests set status = 'approved', form6_confirmed = true,
    form6_confirmed_at = now(), reviewed_by = approver_name, reviewed_at = now(),
    transaction_id = new_transaction_id, updated_at = now() where id = requested.id;
  return new_transaction_id;
end $$;

create or replace function public.lcms_cancel_mandatory_leave(
  request_uuid uuid, cancellation_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare requested public.leave_requests%rowtype; employee public.leave_employees%rowtype; actor text; transaction_uuid uuid;
begin
  select * into requested from public.leave_requests where id = request_uuid for update;
  if not found or requested.status <> 'approved' or requested.leave_category <> 'mandatory_forced' then
    raise exception 'An approved mandatory/forced leave request is required';
  end if;
  if not (public.lcms_is_hrmo() or
    (requested.school_id = public.lcms_current_school_id() and requested.requested_by_user = (select auth.uid()))) then
    raise exception 'You cannot cancel this mandatory leave';
  end if;
  select * into employee from public.leave_employees where id = requested.employee_id for update;
  select username into actor from public."LCMS-profiles" where id = (select auth.uid()) and is_active;
  update public.leave_employees set protected_vl_balance = protected_vl_balance + requested.days,
    updated_at = now(), updated_by = actor where id = employee.id;
  insert into public.leave_transactions
    (employee_id, school_id, txn_type, leave_type, days, date_from, date_to, remarks, recorded_by)
  values (employee.id, employee.school_id, 'VL_PROTECTED_CREDIT', 'Cancelled Mandatory Leave (Protected VL)',
          requested.days, current_date, current_date, cancellation_note, actor)
  returning id into transaction_uuid;
  update public.leave_requests set status = 'cancelled', cancellation_reason = cancellation_note,
    cancelled_at = now(), updated_at = now() where id = requested.id;
  return transaction_uuid;
end $$;

revoke all on function public.lcms_grant_cto(uuid,numeric,date,text) from public;
revoke all on function public.lcms_use_cto(uuid,numeric,date,text) from public;
revoke all on function public.lcms_record_monetization(uuid,text,date,text) from public;
revoke all on function public.lcms_cancel_mandatory_leave(uuid,text) from public;
grant execute on function public.lcms_grant_cto(uuid,numeric,date,text) to authenticated;
grant execute on function public.lcms_use_cto(uuid,numeric,date,text) to authenticated;
grant execute on function public.lcms_record_monetization(uuid,text,date,text) to authenticated;
grant execute on function public.lcms_cancel_mandatory_leave(uuid,text) to authenticated;
