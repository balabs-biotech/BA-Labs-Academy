import { PALETTE } from "./atlas-palette.js";

/**
 * Keep hierarchy junctions legible in screen space while preserving their
 * world-space proportions as the camera zooms in.
 */
const NODE_MINIMUM_SCREEN_RADII = Object.freeze([0, 3.4, 2.6, 2, 1.5, 1.2]);

export function getAtlasNodeScreenRadius(level, worldRadius, scale) {
  const safeLevel = Math.max(0, Math.floor(Number(level) || 0));
  const safeScale = Math.max(0.075, Number(scale) || 0.075);
  const minimumPixels = NODE_MINIMUM_SCREEN_RADII[
    Math.min(safeLevel, NODE_MINIMUM_SCREEN_RADII.length - 1)
  ] || 1.2;
  return Math.max(1.25, Number(worldRadius) || 0, minimumPixels / safeScale);
}

/**
 * Draws Atlas node geometry and selected/core states independently of connections and labels.
 * Coordinates remain in world space; the renderer owns the camera transform.
 */
export function renderAtlasNodes({junctions,nodes,selected,scale,alphaFor,activeBranch,lineage}) {
 for(const n of nodes){
 if(n.entity_type==="PATHWAY" && n.level===0 && selected?.entity_type!=="PATHWAY") continue;
 let alpha=alphaFor(n.level);if(alpha<.015)continue;
 if(selected&&!activeBranch.has(n.id)&&!lineage.has(n.id))alpha*=.34;
 const r=getAtlasNodeScreenRadius(n.level,n.r,scale),color=PALETTE[n.rootId]||0xd1d0c5;
 if(n.level===0){
 junctions.circle(n.x,n.y,r*1.9).fill({color,alpha:.055});
 junctions.circle(n.x,n.y,r).fill({color:0x111b1d,alpha}).stroke({color,alpha:.95,width:n.isAcademyCore?2.8:2});
 } else if(n.level===1){
 junctions.circle(n.x,n.y,r*1.45).fill({color,alpha:.1});
 junctions.circle(n.x,n.y,r*.72).fill({color,alpha:alpha*.88});
 } else {
 junctions.circle(n.x,n.y,Math.max(1.8,r*.62)).fill({color,alpha:alpha*.86});
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
