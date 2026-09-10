-- Setlist Ultra hosted catalog (Supabase).
-- Charts are instance-wide and reused by hash / source id.
-- Library rows are per user or org (pointer + overrides).
-- Do not use this as a public UG scrape cache.

create extension if not exists "pgcrypto";

create table if not exists public.charts (
  id uuid primary key default gen_random_uuid(),
  content_hash text not null unique,
  source_provider text,
  source_external_id text,
  chordpro text not null default '',
  ast jsonb,
  title text,
  artist text,
  original_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists charts_source_idx
  on public.charts (source_provider, source_external_id)
  where source_provider is not null and source_external_id is not null;

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  org_id uuid references public.orgs (id) on delete cascade,
  chart_id uuid not null references public.charts (id),
  title text not null,
  artist text not null default '',
  capo int default 0,
  key_shift int default 0,
  duration_seconds int,
  extras jsonb,
  updated_at timestamptz not null default now(),
  constraint library_owner check (
    (user_id is not null and org_id is null) or
    (user_id is null and org_id is not null)
  )
);

create table if not exists public.setlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  org_id uuid references public.orgs (id) on delete cascade,
  title text not null,
  event_date date,
  extras jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.setlist_items (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists (id) on delete cascade,
  library_item_id uuid references public.library_items (id) on delete set null,
  sort_order int not null,
  key_offset int default 0,
  extras jsonb
);

alter table public.charts enable row level security;
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.library_items enable row level security;
alter table public.setlists enable row level security;
alter table public.setlist_items enable row level security;

-- Authenticated users may read the instance catalog (already-imported charts only).
create policy charts_read on public.charts for select to authenticated using (true);
create policy charts_insert on public.charts for insert to authenticated with check (true);

-- Bypass RLS so org_members policies can check membership without 42P17 recursion.
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid() and role = any(p_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.has_org_role(uuid, text[]) from anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

create policy orgs_read on public.orgs for select to authenticated using (
  created_by = auth.uid() or public.is_org_member(id)
);
create policy orgs_insert on public.orgs for insert to authenticated with check (created_by = auth.uid());

create policy org_members_read on public.org_members for select to authenticated using (
  user_id = auth.uid() or public.is_org_member(org_id)
);
create policy org_members_insert on public.org_members for insert to authenticated with check (
  user_id = auth.uid() or public.has_org_role(org_id, array['owner', 'admin'])
);
create policy org_members_delete on public.org_members for delete to authenticated using (
  user_id = auth.uid() or public.has_org_role(org_id, array['owner', 'admin'])
);
create policy orgs_delete on public.orgs for delete to authenticated using (
  created_by = auth.uid() or public.has_org_role(id, array['owner'])
);

create policy library_personal on public.library_items for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy library_org on public.library_items for all to authenticated using (
  org_id is not null and public.is_org_member(org_id)
) with check (
  org_id is not null and public.is_org_member(org_id)
);

create policy setlists_personal on public.setlists for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy setlists_org on public.setlists for all to authenticated using (
  org_id is not null and public.is_org_member(org_id)
) with check (
  org_id is not null and public.is_org_member(org_id)
);

create policy setlist_items_access on public.setlist_items for all to authenticated using (
  exists (
    select 1 from public.setlists s
    where s.id = setlist_items.setlist_id
      and (s.user_id = auth.uid() or public.is_org_member(s.org_id))
  )
) with check (
  exists (
    select 1 from public.setlists s
    where s.id = setlist_items.setlist_id
      and (s.user_id = auth.uid() or public.is_org_member(s.org_id))
  )
);

update public.charts
  set source_external_id = null
  where source_external_id is not null and btrim(source_external_id) = '';

update public.charts
  set source_provider = null
  where source_provider is not null and btrim(source_provider) = '';

create unique index if not exists library_items_user_chart_uidx
  on public.library_items (user_id, chart_id)
  where user_id is not null;

create unique index if not exists library_items_org_chart_uidx
  on public.library_items (org_id, chart_id)
  where org_id is not null;

-- Atomic setlist item replace (delete + insert in one transaction). SECURITY INVOKER so RLS applies.
create or replace function public.replace_setlist_items(p_setlist_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_setlist_id is null then
    raise exception 'setlist id required';
  end if;

  if not exists (select 1 from public.setlists where id = p_setlist_id) then
    raise exception 'setlist not found';
  end if;

  delete from public.setlist_items where setlist_id = p_setlist_id;

  insert into public.setlist_items (setlist_id, library_item_id, sort_order, key_offset, extras)
  select
    p_setlist_id,
    nullif(item->>'library_item_id', '')::uuid,
    coalesce((item->>'sort_order')::int, 0),
    coalesce((item->>'key_offset')::int, 0),
    case
      when item ? 'extras' then item->'extras'
      else null
    end
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item;
end;
$$;

revoke all on function public.replace_setlist_items(uuid, jsonb) from public;
revoke execute on function public.replace_setlist_items(uuid, jsonb) from anon;
grant execute on function public.replace_setlist_items(uuid, jsonb) to authenticated;

-- Phase 3: tombstones, revisions, idempotent operation claims, incremental pull indexes.
alter table public.library_items add column if not exists deleted_at timestamptz;
alter table public.library_items add column if not exists revision int not null default 1;
alter table public.setlists add column if not exists deleted_at timestamptz;
alter table public.setlists add column if not exists revision int not null default 1;

create index if not exists library_items_updated_idx on public.library_items (updated_at);
create index if not exists setlists_updated_idx on public.setlists (updated_at);

create table if not exists public.sync_ops (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text,
  entity_id text,
  applied_at timestamptz not null default now()
);

alter table public.sync_ops enable row level security;

create policy sync_ops_own on public.sync_ops for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.claim_sync_op(p_id uuid, p_entity_type text, p_entity_id text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed uuid;
begin
  if p_id is null then
    return true;
  end if;
  insert into public.sync_ops (id, user_id, entity_type, entity_id)
  values (p_id, auth.uid(), p_entity_type, p_entity_id)
  on conflict (id) do nothing
  returning id into claimed;
  return claimed is not null;
end;
$$;

revoke all on function public.claim_sync_op(uuid, text, text) from public;
revoke execute on function public.claim_sync_op(uuid, text, text) from anon;
grant execute on function public.claim_sync_op(uuid, text, text) to authenticated;

