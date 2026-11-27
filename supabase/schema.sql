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

alter table public.medications enable row level security;
alter table public.orders enable row level security;

grant usage on schema public to service_role;
grant all on table public.medications to service_role;
grant all on table public.orders to service_role;

insert into public.medications (id, name, active_ingredient, dosage, price_kzt, stock_qty, requires_prescription)
values
  ('med-amox-500', 'Амоксициллин 500 мг', 'Амоксициллин', '500 мг, капсулы №20', 1850, 24, true),
  ('med-augmentin-875', 'Аугментин 875/125 мг', 'Амоксициллин + клавулановая кислота', '875/125 мг, таблетки №14', 5200, 12, true),
  ('med-amoxiclav-875', 'Амоксиклав 875/125 мг', 'Амоксициллин + клавулановая кислота', '875/125 мг, таблетки №14', 5890, 0, true),
  ('med-azithro-500', 'Азитромицин 500 мг', 'Азитромицин', '500 мг, таблетки №3', 1450, 18, true),
  ('med-sumamed-500', 'Сумамед 500 мг', 'Азитромицин', '500 мг, таблетки №3', 4650, 0, true),
  ('med-cipro-500', 'Ципрофлоксацин 500 мг', 'Ципрофлоксацин', '500 мг, таблетки №10', 1120, 16, true),
  ('med-ceftriaxone-1000', 'Цефтриаксон 1 г', 'Цефтриаксон', '1 г, порошок для инъекций №1', 680, 35, true),
  ('med-ibuprofen-400', 'Ибупрофен 400 мг', 'Ибупрофен', '400 мг, таблетки №20', 980, 40, false),
  ('med-nurofen-400', 'Нурофен Форте 400 мг', 'Ибупрофен', '400 мг, таблетки №12', 2650, 0, false),
  ('med-paracetamol-500', 'Парацетамол 500 мг', 'Парацетамол', '500 мг, таблетки №20', 420, 55, false),
  ('med-panadol-500', 'Панадол Экстра 500 мг', 'Парацетамол', '500 мг, таблетки №12', 1950, 0, false),
  ('med-diclofenac-50', 'Диклофенак 50 мг', 'Диклофенак', '50 мг, таблетки №20', 760, 22, true),
  ('med-nimesil-100', 'Нимесил 100 мг', 'Нимесулид', '100 мг, гранулы саше №9', 2890, 19, true),
  ('med-aspirin-cardio-100', 'Аспирин Кардио 100 мг', 'Ацетилсалициловая кислота', '100 мг, таблетки №28', 2150, 29, false),
  ('med-omeprazole-20', 'Омепразол 20 мг', 'Омепразол', '20 мг, капсулы №28', 1150, 31, false),
  ('med-pantoprazole-40', 'Пантопразол 40 мг', 'Пантопразол', '40 мг, таблетки №28', 2340, 14, true),
  ('med-drotaverine-40', 'Дротаверин 40 мг', 'Дротаверин', '40 мг, таблетки №20', 540, 42, false),
  ('med-noshpa-40', 'Но-шпа 40 мг', 'Дротаверин', '40 мг, таблетки №24', 2420, 0, false),
  ('med-smecta-3', 'Смекта 3 г', 'Диосмектит', '3 г, порошок пакетики №10', 2580, 26, false),
  ('med-pancreatin-10000', 'Панкреатин 10000 ЕД', 'Панкреатин', '10000 ЕД, таблетки №20', 1290, 33, false),
  ('med-cetirizine-10', 'Цетиризин 10 мг', 'Цетиризин', '10 мг, таблетки №10', 890, 27, false),
  ('med-zyrtec-10', 'Зиртек 10 мг', 'Цетиризин', '10 мг, таблетки №10', 3150, 0, false),
  ('med-loratadine-10', 'Лоратадин 10 мг', 'Лоратадин', '10 мг, таблетки №10', 640, 38, false),
  ('med-warfarin-2-5', 'Варфарин 2.5 мг', 'Варфарин', '2.5 мг, таблетки №50', 1620, 11, true),
  ('med-enalapril-10', 'Эналаприл 10 мг', 'Эналаприл', '10 мг, таблетки №20', 720, 30, true),
  ('med-amlodipine-5', 'Амлодипин 5 мг', 'Амлодипин', '5 мг, таблетки №30', 1180, 25, true),
  ('med-metformin-850', 'Метформин 850 мг', 'Метформин', '850 мг, таблетки №30', 1540, 21, true),
  ('med-ambroxol-30', 'Амброксол 30 мг', 'Амброксол', '30 мг, таблетки №20', 830, 34, false)
on conflict (id) do nothing;
