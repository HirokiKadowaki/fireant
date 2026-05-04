-- =============================================
-- FIRE Tracker schema v1
-- =============================================

-- 1. Profiles: one row per user with FIRE settings
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  age int,
  target_retirement_expenses_jpy bigint,
  expected_pension_jpy_monthly bigint default 150000,
  swr_pct numeric(4,2) default 3.5,
  expected_return_real_pct numeric(4,2) default 4.0,
  emergency_fund_jpy bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Accounts: NISA, 特定口座, 企業型DC, 普通預金, etc.
create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('nisa', 'taxable', 'dc', 'savings', 'other')),
  is_locked_until_60 boolean default false,
  display_order int default 0,
  is_archived boolean default false,
  created_at timestamptz default now()
);

-- 3. Liabilities: mortgage, other loans
create table liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('mortgage', 'car_loan', 'student_loan', 'other')),
  principal_jpy bigint not null,
  interest_rate_pct numeric(5,3) not null,
  monthly_payment_jpy bigint not null,
  payoff_date date not null,
  rate_type text not null check (rate_type in ('variable', 'fixed')),
  is_archived boolean default false,
  created_at timestamptz default now()
);

-- 4. Categories: user-defined income/expense buckets
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  display_order int default 0,
  is_archived boolean default false,
  created_at timestamptz default now()
);

-- 5. Monthly snapshots: one per user per month
create table monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, snapshot_date)
);

-- 6. Snapshot balances: per-account balance for that snapshot
create table snapshot_balances (
  snapshot_id uuid not null references monthly_snapshots(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  balance_jpy bigint not null,
  primary key (snapshot_id, account_id)
);

-- 7. Snapshot amounts: per-category income/expense for that snapshot
create table snapshot_amounts (
  snapshot_id uuid not null references monthly_snapshots(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  amount_jpy bigint not null,
  primary key (snapshot_id, category_id)
);

-- =============================================
-- Row Level Security: users can only see their own data
-- =============================================

alter table profiles enable row level security;
alter table accounts enable row level security;
alter table liabilities enable row level security;
alter table categories enable row level security;
alter table monthly_snapshots enable row level security;
alter table snapshot_balances enable row level security;
alter table snapshot_amounts enable row level security;

-- Profiles: a user can read/write their own row
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Accounts, liabilities, categories, snapshots: same pattern
create policy "Users manage own accounts" on accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own liabilities" on liabilities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own categories" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own snapshots" on monthly_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Child tables: ownership inherited via parent snapshot
create policy "Users manage own balances" on snapshot_balances
  for all using (
    exists (
      select 1 from monthly_snapshots
      where monthly_snapshots.id = snapshot_balances.snapshot_id
      and monthly_snapshots.user_id = auth.uid()
    )
  );

create policy "Users manage own amounts" on snapshot_amounts
  for all using (
    exists (
      select 1 from monthly_snapshots
      where monthly_snapshots.id = snapshot_amounts.snapshot_id
      and monthly_snapshots.user_id = auth.uid()
    )
  );

-- =============================================
-- Auto-create profile on signup
-- =============================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

  -- AI insight cache (added in v1.1)
alter table monthly_snapshots add column ai_insight text;
alter table monthly_snapshots add column ai_insight_generated_at timestamptz;