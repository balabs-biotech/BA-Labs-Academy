create table if not exists public.academy_content_assets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  asset_code text not null,
  asset_kind text not null check (asset_kind in ('DOCUMENT','VIDEO','AUDIO','IMAGE','DATASET','PROTOCOL','SIMULATION','PRACTICAL_ACTIVITY','PRESENTATION','EXTERNAL_LINK','OTHER')),
  delivery_type text not null check (delivery_type in ('EXTERNAL_URL','SUPABASE_STORAGE')),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '',
  external_url text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_name text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-fA-F0-9]{64}$'),
  language_code text not null default 'fr',
  license_code text,
  attribution text,
  asset_version integer not null check (asset_version > 0),
  previous_version_id uuid references public.academy_content_assets(id),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(content_id, asset_code, asset_version),
  check (
    (delivery_type='EXTERNAL_URL' and external_url ~ '^https?://' and storage_bucket is null and storage_path is null)
    or
    (delivery_type='SUPABASE_STORAGE' and external_url is null and storage_bucket is not null and storage_path is not null)
  )
);
create index if not exists academy_content_assets_content_idx on public.academy_content_assets(content_id, asset_code, asset_version desc);
alter table public.academy_content_assets enable row level security;
revoke all on public.academy_content_assets from anon, authenticated;
grant select on public.academy_content_assets to anon, authenticated;
drop policy if exists "Public can read published Academy assets" on public.academy_content_assets;
drop policy if exists "Academy editors can read editorial assets" on public.academy_content_assets;
create policy "Public can read published Academy assets" on public.academy_content_assets
for select to anon, authenticated using (
  exists (select 1 from public.content_items c where c.id=content_id and c.status='PUBLISHED' and c.editorial_status='PUBLISHED' and c.visibility in ('PUBLIC','DISCOVERABLE'))
);
create policy "Academy editors can read editorial assets" on public.academy_content_assets
for select to authenticated using (
  exists (select 1 from public.content_items c where c.id=content_id and (
    (c.status='PUBLISHED' and c.editorial_status='PUBLISHED' and c.visibility in ('PUBLIC','DISCOVERABLE'))
    or exists (select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER'))
  ))
);
create or replace function public.academy_save_content_assets(p_content_id uuid, p_assets jsonb)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_asset jsonb;
  v_code text;
  v_kind text;
  v_delivery text;
  v_title text;
  v_url text;
  v_bucket text;
  v_path text;
  v_version integer;
  v_previous uuid;
  v_count integer:=0;
begin
  perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
  if p_content_id is null or p_assets is null or jsonb_typeof(p_assets)<>'array' or jsonb_array_length(p_assets)>40 then
    raise exception 'Invalid content asset payload';
  end if;
  if not exists (select 1 from public.content_items c where c.id=p_content_id and c.status='DRAFT' and c.editorial_status in ('PLANNED','OUTLINE','DRAFT')) then
    raise exception 'Assets can only be attached to an editable content draft';
  end if;
  for v_asset in select value from jsonb_array_elements(p_assets)
  loop
    v_code:=nullif(btrim(v_asset->>'asset_code'),'');
    v_kind:=v_asset->>'asset_kind';
    v_delivery:=v_asset->>'delivery_type';
    v_title:=nullif(btrim(v_asset->>'title'),'');
    v_url:=nullif(btrim(v_asset->>'external_url'),'');
    v_bucket:=nullif(btrim(v_asset->>'storage_bucket'),'');
    v_path:=nullif(btrim(v_asset->>'storage_path'),'');
    if v_code is null or v_code !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$' or v_title is null then
      raise exception 'Each asset requires a valid asset_code and title';
    end if;
    if v_kind is null or v_kind not in ('DOCUMENT','VIDEO','AUDIO','IMAGE','DATASET','PROTOCOL','SIMULATION','PRACTICAL_ACTIVITY','PRESENTATION','EXTERNAL_LINK','OTHER') then
      raise exception 'Unsupported asset kind: %',v_kind;
    end if;
    if v_delivery='EXTERNAL_URL' then
      if v_url is null or v_url !~ '^https?://' or v_bucket is not null or v_path is not null then
        raise exception 'External assets require an HTTP(S) URL only';
      end if;
    elsif v_delivery='SUPABASE_STORAGE' then
      if v_url is not null or v_bucket is null or v_path is null then
        raise exception 'Storage assets require a bucket and object path only';
      end if;
      if not exists (select 1 from storage.buckets b where b.id=v_bucket and b.public=false) then
        raise exception 'Storage bucket must exist and remain private';
      end if;
    else
      raise exception 'Unsupported asset delivery type';
    end if;
    select coalesce(max(a.asset_version),0)+1 into v_version
      from public.academy_content_assets a where a.content_id=p_content_id and a.asset_code=v_code;
    select a.id into v_previous from public.academy_content_assets a
      where a.content_id=p_content_id and a.asset_code=v_code order by a.asset_version desc limit 1;
    insert into public.academy_content_assets(
      content_id,asset_code,asset_kind,delivery_type,title,description,external_url,storage_bucket,storage_path,
      mime_type,file_name,file_size_bytes,checksum_sha256,language_code,license_code,attribution,asset_version,previous_version_id,sort_order,created_by
    ) values (
      p_content_id,v_code,v_kind,v_delivery,v_title,coalesce(v_asset->>'description',''),v_url,v_bucket,v_path,
      nullif(v_asset->>'mime_type',''),nullif(v_asset->>'file_name',''),nullif(v_asset->>'file_size_bytes','')::bigint,
      nullif(v_asset->>'checksum_sha256',''),coalesce(nullif(v_asset->>'language_code',''),'fr'),
      nullif(v_asset->>'license_code',''),nullif(v_asset->>'attribution',''),v_version,v_previous,
      coalesce(nullif(v_asset->>'sort_order','')::integer,0),auth.uid()
    );
    v_count:=v_count+1;
  end loop;
  insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,action,new_data,note)
  values(auth.uid(),'CONTENT',p_content_id,'CONTENT_ASSETS_VERSIONED',jsonb_build_object('count',v_count),'Resource assets versioned');
  return v_count;
end;
$$;
revoke all on function public.academy_save_content_assets(uuid,jsonb) from public,anon;
grant execute on function public.academy_save_content_assets(uuid,jsonb) to authenticated;
