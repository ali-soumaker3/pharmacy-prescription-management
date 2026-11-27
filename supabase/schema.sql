create extension if not exists pgcrypto;

create table if not exists public.medications (
  id text primary key,
  name text not null,
  active_ingredient text not null,
  dosage text not null,
  price_kzt integer not null check (price_kzt >= 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  requires_prescription boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  patient_name text not null,
  patient_phone text not null,
  allergies text not null default 'Не указаны',
  raw_prescription text not null default '',
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected', 'ready_for_pickup')),
  requires_pharmacist_approval boolean not null default true,
  total_kzt integer not null default 0 check (total_kzt >= 0),
  medications jsonb not null default '[]'::jsonb,
  safety_warnings jsonb not null default '[]'::jsonb,
  patient_instructions text not null default '',
  pharmacist_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_orders_status on public.orders (status);

insert into public.medications (id, name, active_ingredient, dosage, price_kzt, stock_qty, requires_prescription)
values
  ('med-amox-500', 'Амоксициллин 500 мг', 'Амоксициллин', '500 мг, капсулы №20', 1850, 24, true),
  ('med-augmentin-875', 'Аугментин 875/125 мг', 'Амоксициллин + клавулановая кислота', '875/125 мг, таблетки №14', 5200, 12, true),
  ('med-azithro-500', 'Азитромицин 500 мг', 'Азитромицин', '500 мг, таблетки №3', 1450, 18, true),
  ('med-ibuprofen-400', 'Ибупрофен 400 мг', 'Ибупрофен', '400 мг, таблетки №20', 980, 40, false),
  ('med-paracetamol-500', 'Парацетамол 500 мг', 'Парацетамол', '500 мг, таблетки №20', 420, 55, false),
  ('med-omeprazole-20', 'Омепразол 20 мг', 'Омепразол', '20 мг, капсулы №28', 1150, 31, false),
  ('med-cetirizine-10', 'Цетиризин 10 мг', 'Цетиризин', '10 мг, таблетки №10', 890, 27, false),
  ('med-nurofen-400', 'Нурофен Форте 400 мг', 'Ибупрофен', '400 мг, таблетки №12', 2650, 0, false)
on conflict (id) do nothing;
