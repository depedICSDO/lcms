-- Controlled self-registration for the Leave Credits System.
-- Run once in the Supabase SQL Editor for an existing project.

alter table public.leave_allowed_users add column if not exists email text;
alter table public.leave_allowed_users add column if not exists full_name text;
alter table public.leave_allowed_users add column if not exists role text not null default 'aoii';
alter table public.leave_allowed_users add column if not exists school_id text not null default 'DEFAULT';
alter table public.leave_allowed_users add column if not exists school_name text not null default 'Default Organization';
alter table public.leave_allowed_users add column if not exists registered_user_id uuid unique;

create or replace function public.can_register_leave_user(uname text, user_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leave_allowed_users
    where lower(username) = lower(trim(uname))
      and registered_user_id is null
      and email is not null
      and lower(email) = lower(trim(user_email))
  );
$$;

revoke all on function public.can_register_leave_user(text, text) from public;
grant execute on function public.can_register_leave_user(text, text) to anon, authenticated;

create or replace function public.handle_leave_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed public.leave_allowed_users%rowtype;
  signup_username text := trim(new.raw_user_meta_data ->> 'username');
begin
  select * into allowed
  from public.leave_allowed_users
  where lower(username) = lower(signup_username)
    and registered_user_id is null
    and email is not null
    and lower(email) = lower(new.email)
  limit 1;

  if not found then
    raise exception 'Registration is not authorized for this user';
  end if;

  insert into public.leave_profiles (
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

  update public.leave_allowed_users
  set registered_user_id = new.id
  where id = allowed.id;

  return new;
end;
$$;

drop trigger if exists on_leave_auth_user_created on auth.users;
create trigger on_leave_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_leave_user_signup();
