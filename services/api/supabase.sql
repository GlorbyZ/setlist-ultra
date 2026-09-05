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

create policy orgs_read on public.orgs for select to authenticated using (
  created_by = auth.uid() or exists (
    select 1 from public.org_members m where m.org_id = orgs.id and m.user_id = auth.uid()
  )
);
create policy orgs_insert on public.orgs for insert to authenticated with check (created_by = auth.uid());

create policy org_members_read on public.org_members for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.org_members m where m.org_id = org_members.org_id and m.user_id = auth.uid()
  )
);
create policy org_members_insert on public.org_members for insert to authenticated with check (
  user_id = auth.uid() or exists (
    select 1 from public.org_members m where m.org_id = org_members.org_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  )
);

create policy library_personal on public.library_items for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy library_org on public.library_items for all to authenticated using (
  org_id is not null and exists (
    select 1 from public.org_members m where m.org_id = library_items.org_id and m.user_id = auth.uid()
  )
) with check (
  org_id is not null and exists (
    select 1 from public.org_members m where m.org_id = library_items.org_id and m.user_id = auth.uid()
  )
);

create policy setlists_personal on public.setlists for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy setlists_org on public.setlists for all to authenticated using (
  org_id is not null and exists (
    select 1 from public.org_members m where m.org_id = setlists.org_id and m.user_id = auth.uid()
  )
) with check (
  org_id is not null and exists (
    select 1 from public.org_members m where m.org_id = setlists.org_id and m.user_id = auth.uid()
  )
);

create policy setlist_items_access on public.setlist_items for all to authenticated using (
  exists (
    select 1 from public.setlists s
    where s.id = setlist_items.setlist_id
      and (
        s.user_id = auth.uid()
        or exists (select 1 from public.org_members m where m.org_id = s.org_id and m.user_id = auth.uid())
      )
  )
) with check (
  exists (
    select 1 from public.setlists s
    where s.id = setlist_items.setlist_id
      and (
        s.user_id = auth.uid()
        or exists (select 1 from public.org_members m where m.org_id = s.org_id and m.user_id = auth.uid())
      )
  )
);
