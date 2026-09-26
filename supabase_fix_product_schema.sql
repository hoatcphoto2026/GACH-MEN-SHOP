-- Bổ sung các cột mà website cần đọc trong product_gach_men.
-- Chạy file này một lần trong Supabase SQL Editor.

alter table public.product_gach_men
  add column if not exists external_code text,
  add column if not exists name text,
  add column if not exists size text,
  add column if not exists usage text,
  add column if not exists price numeric(14, 2),
  add column if not exists image text,
  add column if not exists surface text,
  add column if not exists material text,
  add column if not exists origin text,
  add column if not exists per_box text,
  add column if not exists warranty text,
  add column if not exists description text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists product_gach_men_external_code_key
  on public.product_gach_men (external_code)
  where external_code is not null;

-- Kiểm tra các cột website sử dụng.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'product_gach_men'
order by ordinal_position;
