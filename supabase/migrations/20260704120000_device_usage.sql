-- Anonym pr.-enhed daglig rate limit for AI-proxyen.
create table if not exists public.device_usage (
  device_token text not null,
  usage_date   date not null default (now() at time zone 'utc')::date,
  count        int  not null default 0,
  primary key (device_token, usage_date)
);

alter table public.device_usage enable row level security;
-- Ingen policies: kun service_role (bypasser RLS) kan tilgå tabellen.

-- Atomisk tæl-og-tjek; returnerer true hvis kaldet er tilladt.
create or replace function public.check_rate_limit(p_device text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into device_usage (device_token, usage_date, count)
  values (p_device, (now() at time zone 'utc')::date, 1)
  on conflict (device_token, usage_date)
    do update set count = device_usage.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;
