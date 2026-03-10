-- ============================================================
-- Orders table for Stripe checkout + event provisioning
-- ============================================================

create type order_status as enum ('pending', 'completed', 'expired', 'refunded', 'failed');

create table orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_customer_id         text,
  stripe_payment_intent_id   text,
  tier_id       text not null check (tier_id in ('essential', 'all-in')),
  addon_ids     text[] not null default '{}',
  amount_cents  integer not null,
  currency      text not null default 'usd',
  -- Event details stored at order time for provisioning
  event_name    text not null,
  event_slug    text not null,
  event_date    date,
  event_end_date date,
  venue_name    text,
  timezone      text not null default 'America/New_York',
  -- Status & linkage
  status        order_status not null default 'pending',
  event_id      uuid references events(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes
create index idx_orders_user_id on orders(user_id);
create index idx_orders_status on orders(status);
create index idx_orders_stripe_session on orders(stripe_checkout_session_id);
create index idx_orders_event_id on orders(event_id);

-- RLS
alter table orders enable row level security;

-- Users can read their own orders
create policy "Users can read own orders"
  on orders for select
  using (auth.uid() = user_id);

-- Only service role can insert/update (via API routes)
-- No insert/update policies for authenticated users

-- ============================================================
-- New columns on events
-- ============================================================

alter table events add column if not exists order_id uuid references orders(id) on delete set null;
alter table events add column if not exists stripe_customer_id text;
alter table events add column if not exists max_attendees integer not null default 500;
alter table events add column if not exists max_admins integer not null default 1;

-- ============================================================
-- New column on profiles
-- ============================================================

alter table profiles add column if not exists stripe_customer_id text;

-- ============================================================
-- Updated_at trigger for orders
-- ============================================================

create or replace function update_orders_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on orders
  for each row
  execute function update_orders_updated_at();
