-- Create the product image bucket and limit writes to one Supabase Auth user.
-- Before running this script, replace every occurrence of
-- REPLACE_WITH_ADMIN_USER_UUID with the admin user's Auth > Users ID.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.product_gach_men enable row level security;
grant select on public.product_gach_men to anon, authenticated;
grant insert, update, delete on public.product_gach_men to authenticated;

do $$
declare
  id_sequence regclass := pg_get_serial_sequence('public.product_gach_men', 'id')::regclass;
begin
  if id_sequence is not null then
    execute format('grant usage, select on sequence %s to authenticated', id_sequence);
  end if;
end
$$;

-- Remove old product-table policies so a previous anon write rule cannot
-- accidentally remain permissive alongside the admin-only policies below.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'product_gach_men'
  loop
    execute format('drop policy %I on public.product_gach_men', policy_record.policyname);
  end loop;
end
$$;

create policy product_gach_men_public_read
  on public.product_gach_men
  for select
  to anon, authenticated
  using (true);

create policy product_gach_men_admin_insert
  on public.product_gach_men
  for insert
  to authenticated
  with check (auth.uid() = 'REPLACE_WITH_ADMIN_USER_UUID'::uuid);

create policy product_gach_men_admin_update
  on public.product_gach_men
  for update
  to authenticated
  using (auth.uid() = 'REPLACE_WITH_ADMIN_USER_UUID'::uuid)
  with check (auth.uid() = 'REPLACE_WITH_ADMIN_USER_UUID'::uuid);

create policy product_gach_men_admin_delete
  on public.product_gach_men
  for delete
  to authenticated
  using (auth.uid() = 'REPLACE_WITH_ADMIN_USER_UUID'::uuid);

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and auth.uid() = 'REPLACE_WITH_ADMIN_USER_UUID'::uuid
  );

-- In the Dashboard, also review existing storage.objects policies. Remove any
-- older anon upload or non-admin upload policy that grants writes to this bucket.
