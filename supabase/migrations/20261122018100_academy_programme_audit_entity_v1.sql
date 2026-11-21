begin;
alter table public.academy_editorial_events
 drop constraint if exists academy_editorial_events_entity_type_check;
alter table public.academy_editorial_events
 add constraint academy_editorial_events_entity_type_check
 check (entity_type in ('CONTENT_ITEM','DEPARTMENT','DOMAIN','ATLAS_NODE','ATLAS_EDGE','MEMBERSHIP','ASSESSMENT','CERTIFICATE','PROGRAMME'));
commit;