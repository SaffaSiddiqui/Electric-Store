-- =====================================================================
-- Electric Store — Supabase schema
-- Paste this whole file into Supabase > SQL Editor > Run.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- users ----------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  password      text not null,
  full_name     text,
  role          text not null check (role in ('admin','worker')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index if not exists users_username_lower on users (lower(username));

-- ---------- products (inventory) ----------
create table if not exists products (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  name                text not null,
  category            text,
  description         text,
  quality             text,
  usage               text,
  price               numeric(12,2) not null check (price >= 0),
  quantity            integer not null default 0 check (quantity >= 0),
  low_stock_threshold integer not null default 10,
  image_url           text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- discount rules ----------
create table if not exists discount_rules (
  id               uuid primary key default gen_random_uuid(),
  min_quantity     integer not null check (min_quantity > 1),
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 90),
  is_active        boolean not null default true
);
create unique index if not exists discount_rules_min on discount_rules (min_quantity);

-- ---------- sales database (separate from products) ----------
create table if not exists sales (
  id             uuid primary key default gen_random_uuid(),
  bill_no        bigint generated always as identity unique,
  sold_at        timestamptz not null default now(),
  worker_id      uuid references users(id),
  customer_name  text,
  subtotal       numeric(12,2) not null default 0,
  total_discount numeric(12,2) not null default 0,
  grand_total    numeric(12,2) not null default 0
);
create index if not exists sales_sold_at on sales (sold_at desc);

create table if not exists sale_items (
  id               uuid primary key default gen_random_uuid(),
  sale_id          uuid not null references sales(id) on delete cascade,
  product_id       uuid references products(id),
  product_code     text not null,   -- snapshot at time of sale
  product_name     text not null,   -- snapshot at time of sale
  quantity         integer not null check (quantity > 0),
  unit_price       numeric(12,2) not null,
  discount_percent numeric(5,2) not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  line_total       numeric(12,2) not null
);
create index if not exists sale_items_sale on sale_items (sale_id);
create index if not exists sale_items_code on sale_items (product_code);

-- ---------- audit trail ----------
create table if not exists stock_movements (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id),
  change       integer not null,
  reason       text not null check (reason in ('sale','restock','correction')),
  reference_id uuid,
  user_id      uuid references users(id),
  created_at   timestamptz not null default now()
);
create index if not exists stock_movements_product on stock_movements (product_id, created_at desc);

-- ---------- atomic sale ----------
create or replace function create_sale(p_worker_id uuid, p_customer text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid;
  v_item    jsonb;
  v_prod    products%rowtype;
  v_qty     int;
  v_pct     numeric;
  v_gross   numeric;
  v_disc    numeric;
  v_sub     numeric := 0;
  v_dis     numeric := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The bill is empty';
  end if;

  insert into sales (worker_id, customer_name)
  values (p_worker_id, nullif(trim(coalesce(p_customer, '')), ''))
  returning id into v_sale_id;

  -- lock rows in a stable order so two workers cannot deadlock
  for v_item in
    select value from jsonb_array_elements(p_items) order by value->>'product_id'
  loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;

    select * into v_prod from products where id = (v_item->>'product_id')::uuid for update;
    if not found or not v_prod.is_active then
      raise exception 'A product on the bill is no longer available';
    end if;
    if v_prod.quantity < v_qty then
      raise exception 'Not enough stock for % (only % left)', v_prod.code, v_prod.quantity;
    end if;

    -- discount is always decided on the server
    select coalesce((select discount_percent from discount_rules
                      where is_active and min_quantity <= v_qty
                      order by min_quantity desc limit 1), 0) into v_pct;
    v_gross := v_prod.price * v_qty;
    v_disc  := round(v_gross * v_pct / 100, 2);

    insert into sale_items (sale_id, product_id, product_code, product_name, quantity,
                            unit_price, discount_percent, discount_amount, line_total)
    values (v_sale_id, v_prod.id, v_prod.code, v_prod.name, v_qty,
            v_prod.price, v_pct, v_disc, v_gross - v_disc);

    update products set quantity = quantity - v_qty, updated_at = now() where id = v_prod.id;
    insert into stock_movements (product_id, change, reason, reference_id, user_id)
    values (v_prod.id, -v_qty, 'sale', v_sale_id, p_worker_id);

    v_sub := v_sub + v_gross;
    v_dis := v_dis + v_disc;
  end loop;

  update sales set subtotal = v_sub, total_discount = v_dis, grand_total = v_sub - v_dis
  where id = v_sale_id;

  return (select to_jsonb(s) || jsonb_build_object('items',
            (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from sale_items i where i.sale_id = s.id))
          from sales s where s.id = v_sale_id);
end $$;

-- ---------- atomic restock ----------
create or replace function restock_product(p_product_id uuid, p_qty int, p_user_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_new int;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be above 0'; end if;
  update products set quantity = quantity + p_qty, updated_at = now()
   where id = p_product_id and is_active returning quantity into v_new;
  if not found then raise exception 'Product not found'; end if;
  insert into stock_movements (product_id, change, reason, user_id)
  values (p_product_id, p_qty, 'restock', p_user_id);
  return v_new;
end $$;

-- ---------- reporting helpers ----------
create or replace function inventory_totals() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('total_products', count(*), 'total_quantity', coalesce(sum(quantity), 0))
  from products where is_active;
$$;

create or replace function dashboard_today(p_tz text) returns jsonb
language sql security definer set search_path = public as $$
  with start as (select date_trunc('day', now() at time zone p_tz) at time zone p_tz as t)
  select jsonb_build_object(
    'revenue', coalesce((select sum(grand_total) from sales, start where sold_at >= start.t), 0),
    'bills',   (select count(*) from sales, start where sold_at >= start.t),
    'units',   coalesce((select sum(si.quantity) from sale_items si
                          join sales s on s.id = si.sale_id, start
                         where s.sold_at >= start.t), 0));
$$;

create or replace function top_products(p_days int) returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(r), '[]'::jsonb) from (
    select si.product_code as code, si.product_name as name, sum(si.quantity)::int as units
    from sale_items si join sales s on s.id = si.sale_id
    where s.sold_at >= now() - make_interval(days => p_days)
    group by si.product_code, si.product_name order by units desc limit 5) r;
$$;

create or replace function daily_sales(p_days int, p_tz text) returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'DD Mon'), 'total', coalesce(t.total, 0)) order by d), '[]'::jsonb)
  from generate_series((now() at time zone p_tz)::date - (p_days - 1), (now() at time zone p_tz)::date, interval '1 day') d
  left join (select (sold_at at time zone p_tz)::date as day, sum(grand_total) as total from sales group by 1) t
         on t.day = d::date;
$$;

-- Only the backend (service role) may call these functions.
revoke all on function create_sale(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function restock_product(uuid, int, uuid) from public, anon, authenticated;
revoke all on function inventory_totals() from public, anon, authenticated;
revoke all on function dashboard_today(text) from public, anon, authenticated;
revoke all on function top_products(int) from public, anon, authenticated;
revoke all on function daily_sales(int, text) from public, anon, authenticated;

-- ---------- row level security: no public access, backend uses the service key ----------
alter table users           enable row level security;
alter table products        enable row level security;
alter table discount_rules  enable row level security;
alter table sales           enable row level security;
alter table sale_items      enable row level security;
alter table stock_movements enable row level security;

-- ---------- storage bucket for product photos (public read) ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ---------- default discount tiers ----------
insert into discount_rules (min_quantity, discount_percent) values (10, 5), (25, 8), (50, 12)
on conflict (min_quantity) do nothing;

-- ---------- sample electric products (photos: upload real ones from the admin panel) ----------
insert into products (code, name, category, description, quality, usage, price, quantity) values
 ('SW-001','2-Way Switch','Switches','Standard 2-way wall switch with fire-retardant body.','Premium','Staircase and corridor lighting control.',120,85),
 ('SW-002','Dimmer Switch','Switches','Rotary dimmer for LED-compatible lighting.','Standard','Bedrooms, lounges and dining areas.',650,30),
 ('SK-001','3-Pin Socket 13A','Sockets','Flush-mount 13A socket with safety shutter.','Premium','General appliances and wall outlets.',180,60),
 ('SK-002','USB Wall Socket','Sockets','Wall socket with 2 USB charging ports.','Standard','Bedside and office charging.',550,18),
 ('WR-001','Cable 3/29 (100 m)','Wires','Pure copper PVC insulated cable, 100 m coil.','ISI Certified','Lighting and light-load wiring.',4200,25),
 ('WR-002','Cable 7/44 (100 m)','Wires','Heavy-duty copper cable, 100 m coil.','ISI Certified','AC, geyser and heavy loads.',7800,12),
 ('BL-001','LED Bulb 12W','Bulbs','Energy saving warm-white LED bulb.','Standard','Rooms, kitchens and shops.',280,120),
 ('BL-002','Tube Light 18W','Bulbs','LED tube light, cool daylight.','Standard','Offices, garages and workshops.',450,7),
 ('FN-001','Ceiling Fan 56"','Fans','Low-noise copper winding ceiling fan.','Premium','Bedrooms and halls.',11500,9),
 ('FN-002','Exhaust Fan 8"','Fans','Compact ventilation fan.','Standard','Kitchens and bathrooms.',2800,14),
 ('CB-001','MCB 16A','Breakers','Single-pole miniature circuit breaker.','ISI Certified','Overload protection in distribution boards.',750,40),
 ('EX-001','Extension Board 4-Way','Extension','4-socket board with surge protection and 3 m cord.','Premium','Computers, TV and home appliances.',950,22)
on conflict (code) do nothing;
