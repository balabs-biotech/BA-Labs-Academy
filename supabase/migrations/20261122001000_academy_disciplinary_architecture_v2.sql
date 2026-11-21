-- BA Labs Academy: disciplinary architecture v2
begin;

-- Rename and reposition the existing disciplinary pillars without changing their stable codes.
update public.departments set title='Microbiologie',
 summary='Bactéries, levures, biologie cellulaire, diversité microbienne, physiologie et interactions.',
 sort_order=10,color_token='blue',status='DRAFT',visibility='INTERNAL',updated_at=now() where code='MIC';
update public.departments set title='Sciences végétales',
 summary='Physiologie végétale, agronomie, propagation, multiplication, culture et systèmes de production végétale.',
 sort_order=20,color_token='green',status='DRAFT',visibility='INTERNAL',updated_at=now() where code='BIO';
update public.departments set title='Sols & écosystèmes',
 summary='Écologie, pédologie, substrats, fertilité, cycles biologiques, agroécologie et fonctionnement des écosystèmes.',
 sort_order=30,color_token='earth',status='DRAFT',visibility='INTERNAL',updated_at=now() where code='AGR';
update public.departments set title='Ingénierie & instrumentation',
 summary='Capteurs, métrologie, équipements, conception mécanique, automatisation, contrôle et maintenance.',
 sort_order=60,color_token='slate',status='DRAFT',visibility='INTERNAL',updated_at=now() where code='GEN';
update public.departments set title='Sciences numériques',
 summary='Programmation, ingénierie logicielle, données, statistiques, intelligence artificielle et modélisation.',
 sort_order=70,color_token='indigo',status='DRAFT',visibility='INTERNAL',updated_at=now() where code='INF';
update public.departments set title='MYCOLOGIE',
 summary='Sciences fongiques & mycologie appliquée : biologie fongique, culture, symbioses, écologie, applications et mycomatériaux. Pôle central et transversal relié aux huit autres disciplines.',
 sort_order=90,color_token='orange',status='DRAFT',visibility='INTERNAL',updated_at=now() where code='MYC';

-- The former animal-production pillar is retained as archived history, not shown as a ninth discipline.
update public.departments set title='Archives — Zootechnie et systèmes d’élevage',
 summary='Ancienne classification conservée pour préserver les références historiques. Non intégrée aux huit pôles disciplinaires actuels.',
 sort_order=999,status='ARCHIVED',visibility='INTERNAL',updated_at=now() where code='ZOO';
update public.domains set status='ARCHIVED',visibility='INTERNAL',updated_at=now() where department_code='ZOO';

insert into public.departments(code,slug,title,summary,color_token,sort_order,status,visibility)
values
('BPR','bioprocedes','Bioprocédés','Fermentation, cultures, bioconversion, procédés biologiques, montée en échelle et conduite des bioproductions.','teal',40,'DRAFT','INTERNAL'),
('BMT','biomateriaux','Biomatériaux','Mycomatériaux, fibres, matériaux biosourcés, composites, caractérisation et biofabrication.','amber',50,'DRAFT','INTERNAL'),
('PHY','sciences-physiques-chimiques','Sciences physiques & chimiques','Chimie, physique, thermodynamique, mathématiques, transferts et méthodes quantitatives appliquées.','violet',80,'DRAFT','INTERNAL')
on conflict(code) do update set slug=excluded.slug,title=excluded.title,summary=excluded.summary,color_token=excluded.color_token,sort_order=excluded.sort_order,status='DRAFT',visibility='INTERNAL',updated_at=now();

-- Move existing domains to their new conceptual home while preserving their stable domain codes.
update public.domains set department_code='BPR',updated_at=now() where code='GEN-D04';
update public.domains set department_code='PHY',updated_at=now() where code='GEN-D05';

-- Add domain scaffolding; these are classifications, not populated course content.
insert into public.domains(code,slug,department_code,title,summary,sort_order,status,visibility) values
('BPR-D01','bpr-d01-fermentation-et-cultures','BPR','Fermentation et cultures','Fermentations solides et liquides, cultures microbiennes et fongiques, milieux et cinétiques.',10,'DRAFT','INTERNAL'),
('BPR-D02','bpr-d02-bioconversion-et-valorisation','BPR','Bioconversion et valorisation','Transformation biologique de matières premières, coproduits et résidus en molécules et matériaux utiles.',20,'DRAFT','INTERNAL'),
('BPR-D03','bpr-d03-conduite-et-optimisation-des-procedes','BPR','Conduite et optimisation des procédés','Paramètres opératoires, bilans, transferts, rendement, reproductibilité et changement d’échelle.',30,'DRAFT','INTERNAL'),
('BPR-D04','bpr-d04-separation-purification-et-formulation','BPR','Séparation, purification et formulation','Opérations aval, concentration, stabilisation, formulation et conditionnement des bioproduits.',40,'DRAFT','INTERNAL'),
('BMT-D01','bmt-d01-mycomateriaux','BMT','Mycomatériaux','Matériaux composites à base de mycélium, croissance dirigée, moulage et post-traitement.',10,'DRAFT','INTERNAL'),
('BMT-D02','bmt-d02-fibres-et-materiaux-biosources','BMT','Fibres et matériaux biosourcés','Fibres végétales, lignocellulose, matrices naturelles et matériaux renouvelables.',20,'DRAFT','INTERNAL'),
('BMT-D03','bmt-d03-caracterisation-et-proprietes','BMT','Caractérisation et propriétés','Propriétés mécaniques, thermiques, hydriques, acoustiques et durabilité des biomatériaux.',30,'DRAFT','INTERNAL'),
('BMT-D04','bmt-d04-biofabrication-et-design-materiaux','BMT','Biofabrication et design matériaux','Mise en forme, biofabrication, conception de pièces et procédés de fabrication hybrides.',40,'DRAFT','INTERNAL'),
('PHY-D01','phy-d01-chimie-generale-et-analytique','PHY','Chimie générale et analytique','Structure de la matière, solutions, équilibres, analyses et méthodes physicochimiques.',10,'DRAFT','INTERNAL'),
('PHY-D02','phy-d02-physique-et-mesures','PHY','Physique et mesures','Grandeurs physiques, instrumentation de mesure, incertitudes et phénomènes physiques.',20,'DRAFT','INTERNAL'),
('PHY-D03','phy-d03-thermodynamique-et-transferts','PHY','Thermodynamique et transferts','Thermodynamique, chaleur, matière, fluides et transferts couplés.',30,'DRAFT','INTERNAL'),
('PHY-D04','phy-d04-mathematiques-et-modelisation','PHY','Mathématiques et modélisation','Mathématiques appliquées, calcul, équations, modélisation et résolution quantitative.',40,'DRAFT','INTERNAL')
on conflict(code) do update set slug=excluded.slug,department_code=excluded.department_code,title=excluded.title,summary=excluded.summary,sort_order=excluded.sort_order,status='DRAFT',visibility='INTERNAL',updated_at=now();

-- Keep old ZOO links intact; all other existing content links remain valid.
-- Ensure Atlas contains all nine visible disciplinary nodes.
insert into public.atlas_nodes(node_key,entity_type,entity_key,title_override,visibility,status)
select 'DEPARTMENT:'||d.code,'DEPARTMENT',d.code,d.title,'INTERNAL','DRAFT'
from public.departments d where d.code in ('MIC','BIO','AGR','BPR','BMT','GEN','INF','PHY','MYC')
on conflict(entity_type,entity_key) do update set title_override=excluded.title_override,visibility='INTERNAL',status='DRAFT',updated_at=now();

-- The mycology pillar is explicitly transversal to each of the eight disciplines.
insert into public.atlas_edges(source_node_id,target_node_id,relation_type,rationale,status)
select myco.id,discipline.id,'RELATED_TO',
 'MYCOLOGIE est un pôle central transversal : relation disciplinaire à double lecture, sans subordination hiérarchique.',
 'DRAFT'
from public.atlas_nodes myco
cross join public.atlas_nodes discipline
where myco.entity_type='DEPARTMENT' and myco.entity_key='MYC'
and discipline.entity_type='DEPARTMENT'
and discipline.entity_key in ('MIC','BIO','AGR','BPR','BMT','GEN','INF','PHY')
on conflict(source_node_id,target_node_id,relation_type) do update set rationale=excluded.rationale,status='DRAFT';

commit;