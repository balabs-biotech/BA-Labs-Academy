import { Application, Text } from "pixi.js";
import { createAtlasRenderStage } from "./atlas-renderer-stage.js";
import { renderAtlasConnections } from "./atlas-connections.js";
import { renderAtlasNodes } from "./atlas-nodes.js";
import { renderAtlasLabels } from "./atlas-labels.js";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export async function createPixiRenderer(canvas){
 const app=new Application();
 await app.init({canvas,backgroundAlpha:0,antialias:true,autoDensity:true,resolution:Math.min(window.devicePixelRatio||1,1.75),powerPreference:"high-performance",preference:"webgl",clearBeforeRender:true,autoStart:false});
 app.stage.eventMode="none";
 canvas.dataset.renderer="pixijs-webgl";
 const stage=createAtlasRenderStage(app);
 const {field,filaments,junctions,labels,style}=stage;
 const labelPool=new Map();
 let lastWidth=0,lastHeight=0;
 function resize(width,height){lastWidth=width;lastHeight=height;app.renderer.resize(width,height);}
 const alphaFor=level=>{const thresholds=[0,.10,.16,.24,.4,.7,1.1],t=thresholds[Math.min(level,thresholds.length-1)];return level===0?1:clamp((cameraScale-t*.72)/(t*.42),0,1);};
 let cameraScale=1;
 function render({nodes,edges,selected,scale,offset,width,height,reduced,relationFilter="all",lang="fr",time=performance.now()}){
  cameraScale=scale;
  stage.drawBackdrop({nodes,width,height});
  junctions.clear();
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const lineage=new Set();let ancestor=selected;
  while(ancestor){lineage.add(ancestor.id);ancestor=ancestor.parent?byId.get(ancestor.parent):null;}
  const activeBranch=new Set();
  if(selected){
   activeBranch.add(selected.id);
   let grew=true;
   while(grew){grew=false;for(const n of nodes){if(n.parent&&activeBranch.has(n.parent)&&!activeBranch.has(n.id)){activeBranch.add(n.id);grew=true;}}}
  }
  renderAtlasConnections({
    filaments,
    junctions,
    edges,
    selected,
    scale,
    reduced,
    relationFilter,
    time,
    alphaFor,
    activeBranch
  });
  renderAtlasNodes({ junctions, nodes, selected, scale, alphaFor, activeBranch, lineage });
  // One camera transform controls all biological geometry; labels remain screen-readable.
  filaments.position.set(width/2+offset.x,height/2+offset.y);filaments.scale.set(scale);
  junctions.position.copyFrom(filaments.position);junctions.scale.set(scale);
  const live=new Set();
  renderAtlasLabels({ canvas, labels, labelPool, style, createLabel: (node, labelStyle) => new Text({ text: node.title, style: labelStyle.clone() }), nodes, selected, scale, offset, width, height, alphaFor, activeBranch, lineage, lang });
  app.render();
 }
 return{render,resize,destroy:()=>app.destroy({removeView:false,children:true})};
}
