/**
 * Draws the Atlas connection layer independently from node and label rendering.
 * Hierarchy, pathway transfers, shared-pathway bridges and evidence-backed
 * knowledge relations retain distinct visibility and styling rules.
 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const PALETTE = {
  mic: 0x80aeb8, myc: 0xc88773, bio: 0x79a991, agr: 0xc19b73,
  inf: 0x8da8b5, gen: 0x7eaaa3, bpr: 0xd4a36f, bmt: 0xb18a83,
  phy: 0xb5b58d, pathways: 0xa9a0d4
};
const hash = (value) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
};

export function renderAtlasConnections({
  filaments, junctions, edges, selected, scale, reduced, relationFilter,
  time, alphaFor, activeBranch
}) {
  for (const e of edges) {
    if ((e.a.entity_type === "PATHWAY" || e.b.entity_type === "PATHWAY") && selected?.entity_type !== "PATHWAY") continue;
    const knowledge=e.basis==="academy-knowledge-relation";
    if(knowledge&&relationFilter!=="all"&&e.relation_type!==relationFilter)continue;
    const depth=Math.max(e.a.level,e.b.level);let alpha=alphaFor(depth);if(alpha<.015)continue;
    if(knowledge)alpha*=clamp((scale-.12)/.55,0,1);
    if(selected&&!e.verified)alpha*=activeBranch.has(e.a.id)&&activeBranch.has(e.b.id)?1:.16;
    const a=point(e.a),b=point(e.b),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const seed=(e.seed??hash(e.a.id+e.b.id))>>>0,side=(seed&1)?1:-1;
    const bend=Math.min(16,len*.05)*side;
    const drift=(((seed>>>12)&255)/255-.5)*Math.min(4,len*.015);
    // Shared pathway participation makes declared cross-universe bridges visible in the overview.
    const sharedPathway=e.basis==="academy-pathway-network";
    const cx=sharedPathway?(a.x+b.x)*.36:(a.x+b.x)/2-dy/len*bend+dx/len*drift;
    const cy=sharedPathway?(a.y+b.y)*.36:(a.y+b.y)/2+dx/len*bend+dy/len*drift;
    const relationColors={PREREQUISITE:0x80aeb8,COMPLEMENTARY:0xa9a0d4,METHOD_TRANSFER:0xe8c99d,TECHNICAL_DEPENDENCY:0xc88773,APPLIED_IN:0x79a991,INTERDISCIPLINARY:0x7eaaa3};const color=PALETTE[e.a.rootId]||0x91a99b,widthBase=sharedPathway?2.2:knowledge?1.35:e.basis==="academy-pathway-flow"?1.05:e.verified?1.2:e.cross?.55:Math.max(.45,(e.depth===1?1.5:e.depth===2?1.15:.85));
    if((!e.cross&&depth<=2&&len>34)||sharedPathway)filaments.moveTo(a.x,a.y).quadraticCurveTo(cx,cy,b.x,b.y).stroke({color,alpha:alpha*(sharedPathway?.12:.12),width:widthBase*(sharedPathway?3.2:3.1),cap:"round"});
    filaments.moveTo(a.x,a.y).quadraticCurveTo(cx,cy,b.x,b.y).stroke({color:sharedPathway?0xb8a9df:knowledge?(relationColors[e.relation_type]||0x7eaaa3):e.basis==="academy-pathway-flow"?0xe8c99d:e.verified?(e.basis==="notion-link"?0xb96b4d:e.basis==="academy-pathway"?0xa9a0d4:e.basis==="academy-domain"?0xb5b58d:e.basis==="academy-hierarchy"?color:0x7eaaa3):e.cross?0xb96b4d:color,alpha:alpha*(sharedPathway?.52:knowledge?.88:e.basis==="academy-pathway-flow"?.72:e.verified?.82:e.cross?.34:depth>=3?.42:depth===2?.62:.78),width:widthBase,cap:"round"});
    if(e.verified&&!sharedPathway)junctions.circle(cx,cy,Math.max(1.25,1.8/Math.sqrt(scale))).fill({color:e.basis==="notion-link"?0xb96b4d:e.basis==="academy-pathway"?0xa9a0d4:e.basis==="academy-axis"?0xc88773:0x7eaaa3,alpha:.9});
    // Hierarchy stays clean; motion is reserved for explicit knowledge transfers.
    const transfer=e.basis==="academy-pathway-flow"||e.basis==="academy-knowledge-relation";
    if(!reduced&&alpha>.2&&transfer){
     const particleCount=transfer?3:depth<=2&&len>150?3:depth<=2&&len>72?2:1;
     for(let particle=0;particle<particleCount;particle++){
      const phase=time*(transfer?.000085:.00012)+(seed%100)*.013+particle/particleCount;
      const q=(phase*(transfer?.34:depth===1?.7:.48))%1,u=1-q;
      const x=u*u*a.x+2*u*q*cx+q*q*b.x,y=u*u*a.y+2*u*q*cy+q*q*b.y;
      const particleColor=knowledge?(relationColors[e.relation_type]||0x7eaaa3):transfer?0xe8c99d:0xdce5d9;
      const radius=transfer?Math.max(1.15,1.65*scale**.12):Math.max(.8,1.2*scale**.15);
      filaments.circle(x,y,radius*2.1).fill({color:particleColor,alpha:transfer?.16:.08});
      filaments.circle(x,y,radius).fill({color:particleColor,alpha:transfer?.94:particleCount===1?.82:.68});
     }
    }
  }
}
