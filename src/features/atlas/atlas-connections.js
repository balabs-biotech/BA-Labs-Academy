import { ATLAS_GOLDEN_RATIO, getAtlasGoldenConnectionProfile } from "./atlas-geometry.js";

/**
 * Draws the Atlas connection layer independently from node and label rendering.
 * Hierarchy, pathway transfers, shared-pathway bridges and evidence-backed
 * knowledge relations retain distinct visibility and styling rules.
 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const point = (node) => ({ x: node.x, y: node.y });
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
    if (e.cross) {
      const directlySelected = e.a.id === selected?.id || e.b.id === selected?.id;
      const insideSelection = activeBranch.has(e.a.id) && activeBranch.has(e.b.id);
      const pathwaySelected = selected?.entity_type === "PATHWAY" &&
        (e.pathwayCodes || []).includes(selected.entity_key);
      const relevantToSelection = directlySelected || insideSelection || pathwaySelected;
      alpha *= selected ? (relevantToSelection ? 1 : 0.14) : 0.38;
    } else if (selected && !e.verified) {
      alpha *= activeBranch.has(e.a.id) && activeBranch.has(e.b.id) ? 1 : .16;
    }
    const a=point(e.a),b=point(e.b),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const seed=(e.seed??hash(e.a.id+e.b.id))>>>0,side=(seed&1)?1:-1;
    const nx=-dy/len,ny=dx/len,tx=dx/len,ty=dy/len;
    // A restrained, deterministic lateral sweep gives branches a living rhythm
    // without implying relationships that are not present in the graph.
    const sharedPathway=e.basis==="academy-pathway-network";
    const golden=getAtlasGoldenConnectionProfile(len,depth);
    const bend=Math.min(sharedPathway?150:68,golden.bend)*side;
    const drift=(((seed>>>12)&255)/255-.5)*Math.min(sharedPathway?18:14,bend/ATLAS_GOLDEN_RATIO);
    const secondaryBend=(((seed>>>20)&127)/127-.5)*Math.min(sharedPathway?24:18,bend/(ATLAS_GOLDEN_RATIO**2));
    const c1={x:a.x+dx*golden.controlPointRatio+nx*bend+tx*drift,y:a.y+dy*golden.controlPointRatio+ny*bend+ty*drift};
    const c2={x:a.x+dx*(1-golden.controlPointRatio)+nx*(bend/ATLAS_GOLDEN_RATIO-secondaryBend)-tx*drift/ATLAS_GOLDEN_RATIO,y:a.y+dy*(1-golden.controlPointRatio)+ny*(bend/ATLAS_GOLDEN_RATIO-secondaryBend)-ty*drift/ATLAS_GOLDEN_RATIO};
    const relationColors={PREREQUISITE:0x80aeb8,COMPLEMENTARY:0xa9a0d4,METHOD_TRANSFER:0xe8c99d,TECHNICAL_DEPENDENCY:0xc88773,APPLIED_IN:0x79a991,INTERDISCIPLINARY:0x7eaaa3};
    const color=PALETTE[e.a.rootId]||0x91a99b;
    const widthScale=sharedPathway?1.25/1.5:knowledge?1.35/1.5:e.basis==="academy-pathway-flow"?1.05/1.5:1;
    const widthBase=golden.width*widthScale*(e.cross?1/ATLAS_GOLDEN_RATIO:1);
    const path=()=>filaments.moveTo(a.x,a.y).bezierCurveTo(c1.x,c1.y,c2.x,c2.y,b.x,b.y);
    if((!e.cross&&depth<=2&&len>34)||sharedPathway){
      path().stroke({color,alpha:alpha*(sharedPathway?.08:.105),width:widthBase*(sharedPathway?2.6:3.0),cap:"round"});
    }
    path().stroke({color:sharedPathway?0xb8a9df:knowledge?(relationColors[e.relation_type]||0x7eaaa3):e.basis==="academy-pathway-flow"?0xe8c99d:e.verified?(e.basis==="notion-link"?0xb96b4d:e.basis==="academy-pathway"?0xa9a0d4:e.basis==="academy-domain"?0xb5b58d:e.basis==="academy-hierarchy"?color:0x7eaaa3):e.cross?0xb96b4d:color,alpha:alpha*(sharedPathway?.24:knowledge?.88:e.basis==="academy-pathway-flow"?.72:e.verified?.82:e.cross?.34:depth>=3?.42:depth===2?.68:.82),width:widthBase,cap:"round"});
    const midpoint={x:(a.x+3*c1.x+3*c2.x+b.x)/8,y:(a.y+3*c1.y+3*c2.y+b.y)/8};
    if(e.verified&&!sharedPathway)junctions.circle(midpoint.x,midpoint.y,Math.max(1.25,1.8/Math.sqrt(scale))).fill({color:e.basis==="notion-link"?0xb96b4d:e.basis==="academy-pathway"?0xa9a0d4:e.basis==="academy-axis"?0xc88773:0x7eaaa3,alpha:.9});
    // Motion is reserved for explicit pedagogical transfers, never hierarchy.
    const transfer=e.basis==="academy-pathway-flow"||e.basis==="academy-knowledge-relation";
    if(!reduced&&alpha>.2&&transfer){
     const particleCount=3;
     for(let particle=0;particle<particleCount;particle++){
      const phase=time*.000085+(seed%100)*.013+particle/particleCount;
      const q=(phase*.34)%1,u=1-q;
      const x=u*u*u*a.x+3*u*u*q*c1.x+3*u*q*q*c2.x+q*q*q*b.x;
      const y=u*u*u*a.y+3*u*u*q*c1.y+3*u*q*q*c2.y+q*q*q*b.y;
      const particleColor=knowledge?(relationColors[e.relation_type]||0x7eaaa3):0xe8c99d;
      const radius=Math.max(1.15,1.65*scale**.12);
      filaments.circle(x,y,radius*2.1).fill({color:particleColor,alpha:.16});
      filaments.circle(x,y,radius).fill({color:particleColor,alpha:.94});
     }
    }
  }
}
