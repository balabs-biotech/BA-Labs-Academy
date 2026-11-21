/**
 * Draws Atlas node geometry and selected/core states independently of connections and labels.
 * Coordinates remain in world space; the renderer owns the camera transform.
 */
const PALETTE={mic:0x80aeb8,myc:0xc88773,bio:0x79a991,agr:0xc19b73,inf:0x8da8b5,gen:0x7eaaa3,bpr:0xd4a36f,bmt:0xb18a83,phy:0xb5b58d,pathways:0xa9a0d4};

export function renderAtlasNodes({junctions,nodes,selected,scale,alphaFor,activeBranch,lineage}) {
 for(const n of nodes){
 if(n.entity_type==="PATHWAY" && n.level===0 && selected?.entity_type!=="PATHWAY") continue;
 let alpha=alphaFor(n.level);if(alpha<.015)continue;
 if(selected&&!activeBranch.has(n.id)&&!lineage.has(n.id))alpha*=.34;
 const r=Math.max(1.25,n.r),color=PALETTE[n.rootId]||0xd1d0c5;
 if(n.level===0){
 junctions.circle(n.x,n.y,r*1.9).fill({color,alpha:.055});
 junctions.circle(n.x,n.y,r).fill({color:0x111b1d,alpha}).stroke({color,alpha:.95,width:n.isAcademyCore?2.8:2});
 } else if(n.level===1){
 junctions.circle(n.x,n.y,r*1.45).fill({color,alpha:.08});
 junctions.circle(n.x,n.y,r*.72).fill({color,alpha:alpha*.78});
 } else {
 junctions.circle(n.x,n.y,Math.max(1.8,r*.62)).fill({color,alpha:alpha*.72});
 }
 if(n.isAcademyCore){
 junctions.circle(n.x,n.y,r*2.05).stroke({color:0xc88773,alpha:alpha*.78,width:1.5});
 // Three arms echo the BA Labs Y mark inside the eight-spoke hub.
 junctions.moveTo(n.x,n.y+17).lineTo(n.x,n.y-1).stroke({color:0xe7d9c6,alpha,width:4,cap:"round"});
 junctions.moveTo(n.x,n.y-1).quadraticCurveTo(n.x-2,n.y-12,n.x-17,n.y-21).stroke({color:0xc88773,alpha,width:4,cap:"round"});
 junctions.moveTo(n.x,n.y-1).quadraticCurveTo(n.x+2,n.y-12,n.x+17,n.y-21).stroke({color:0x75c8bd,alpha,width:4,cap:"round"});
 junctions.circle(n.x-17,n.y-21,3.2).fill({color:0xe3a078,alpha});
 junctions.circle(n.x+17,n.y-21,3.2).fill({color:0x8bd9ce,alpha});
 junctions.circle(n.x,n.y+17,2.8).fill({color:0xe7d9c6,alpha});
 }
 if(selected?.id===n.id)junctions.circle(n.x,n.y,r+7/scale+5/scale).stroke({color:0xe4e7dd,alpha:.9,width:1/scale});
 }
}
