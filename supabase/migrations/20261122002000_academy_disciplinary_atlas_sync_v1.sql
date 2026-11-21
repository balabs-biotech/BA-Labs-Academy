begin;
-- Synchronize Atlas DOMAIN nodes with the revised taxonomy, including the new BPR/BMT/PHY domains.
insert into public.atlas_nodes(node_key,entity_type,entity_key,title_override,visibility,status)
select 'DOMAIN:'||d.code,'DOMAIN',d.code,d.title,d.visibility,d.status
from public.domains d
on conflict(entity_type,entity_key) do update set
 node_key=excluded.node_key,title_override=excluded.title_override,
 visibility=excluded.visibility,status=excluded.status,updated_at=now();

-- Rebuild only the structural domain-to-department edges. Other semantic links remain untouched.
delete from public.atlas_edges e
using public.atlas_nodes source_node
where e.source_node_id=source_node.id
and source_node.entity_type='DOMAIN'
and e.relation_type='BELONGS_TO';

insert into public.atlas_edges(source_node_id,target_node_id,relation_type,rationale,status)
select domain_node.id,department_node.id,'BELONGS_TO',
 'Rattachement taxonomique du domaine à son pôle disciplinaire.',
 case when d.status='ARCHIVED' then 'ARCHIVED' else 'DRAFT' end
from public.domains d
join public.atlas_nodes domain_node on domain_node.entity_type='DOMAIN' and domain_node.entity_key=d.code
join public.atlas_nodes department_node on department_node.entity_type='DEPARTMENT' and department_node.entity_key=d.department_code
on conflict(source_node_id,target_node_id,relation_type) do update set rationale=excluded.rationale,status=excluded.status;

-- Keep the archived legacy zootechny nodes out of active Atlas exploration.
update public.atlas_nodes n set status='ARCHIVED',visibility='INTERNAL',updated_at=now()
where n.entity_type='DEPARTMENT' and n.entity_key='ZOO';
update public.atlas_nodes n set status='ARCHIVED',visibility='INTERNAL',updated_at=now()
where n.entity_type='DOMAIN' and n.entity_key like 'ZOO-%';
commit;