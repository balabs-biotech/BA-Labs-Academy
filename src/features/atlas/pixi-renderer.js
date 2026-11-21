import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { renderAtlasConnections } from "./atlas-connections.js";
import { renderAtlasNodes } from "./atlas-nodes.js";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export async function createPixiRenderer(canvas){
 const app=new Application();
 await app.init({canvas,backgroundAlpha:0,antialias:true,autoDensity:true,resolution:Math.min(window.devicePixelRatio||1,1.75),powerPreference:"high-performance",preference:"webgl",clearBeforeRender:true,autoStart:false});
 app.stage.eventMode="none";
 canvas.dataset.renderer="pixijs-webgl";
 const field=new Graphics(),filaments=new Graphics(),junctions=new Graphics(),labels=new Container();
 app.stage.addChild(field,filaments,junctions,labels);
 const labelPool=new Map();
 const style=new TextStyle({fontFamily:"Inter, system-ui, sans-serif",fontSize:12,fill:0xf2f1e9,fontWeight:"600",stroke:{color:0x07100f,width:4.5},align:"center"});
 let lastWidth=0,lastHeight=0;
 function resize(width,height){lastWidth=width;lastHeight=height;app.renderer.resize(width,height);}
 const alphaFor=level=>{const thresholds=[0,.10,.16,.24,.4,.7,1.1],t=thresholds[Math.min(level,thresholds.length-1)];return level===0?1:clamp((cameraScale-t*.72)/(t*.42),0,1);};
 let cameraScale=1;
 function render({nodes,edges,selected,scale,offset,width,height,reduced,relationFilter="all",lang="fr",time=performance.now()}){
  cameraScale=scale;
  field.clear().rect(0,0,width,height).fill({color:0x111b1d});
  field.circle(width*.5,height*.48,Math.max(width,height)*.78).fill({color:0x172925,alpha:.22});
  filaments.clear();junctions.clear();
  // Eight quiet spokes and two rings establish a wheel before any detail is revealed.
  filaments.circle(0,0,820).stroke({color:0x91a99b,alpha:.075,width:2});
  filaments.circle(0,0,1600).stroke({color:0x91a99b,alpha:.055,width:2});
  const departmentRoots = nodes.filter((node) => node.level === 0 && node.entity_type === "DEPARTMENT" && node.entity_key !== "MYC");
  for (const root of departmentRoots) {
    filaments.moveTo(0,0).lineTo(root.x,root.y).stroke({color:PALETTE[root.rootId]||0x91a99b,alpha:.12,width:2.2});
  }
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
  const shortRoots={
   fr:{bio:"BIOTECH",myco:"MYCO",soil:"TECHNOSOIL",lab:"LABO",products:"PRODUITS",iot:"IOT",work:"R&D",evidence:"PREUVES"},
   en:{bio:"BIOTECH",myco:"MYCOLOGY",soil:"TECHNOSOIL",lab:"LAB",products:"PRODUCTS",iot:"IOT",work:"PROJECTS",evidence:"EVIDENCE"},
   ar:{bio:"حيوية",myco:"فطريات",soil:"تربة",lab:"مختبر",products:"منتجات",iot:"إنترنت",work:"مشاريع",evidence:"الأدلة"},
   pt:{bio:"BIOTECH",myco:"MICO",soil:"TECHNOSOIL",lab:"LAB",products:"PRODUTOS",iot:"IOT",work:"PROJETOS",evidence:"EVIDÊNCIAS"}
  };
  const candidates=[];
  for(const n of nodes){
   if(n.entity_type==="PATHWAY" && n.level===0 && selected?.entity_type!=="PATHWAY") continue;
   let alpha=alphaFor(n.level);if(alpha<.015)continue;
   if(selected&&!activeBranch.has(n.id)&&!lineage.has(n.id))alpha*=.22;
   const sx=width/2+offset.x+n.x*scale,sy=height/2+offset.y+n.y*scale;
   if(sx < -80 || sx > width+80 || sy < 45 || sy > height+45)continue;
   const threshold=n.level===0?0:n.level===1?.72:n.level===2?1.3:n.level===3?2.55:4.3;
   const show=n.level===0||(alpha>.5&&scale>threshold)||lineage.has(n.id);
   if(show)candidates.push({n,alpha,priority:selected?.id===n.id?0:lineage.has(n.id)?1:n.level===0?2:3,distance:selected?Math.hypot(n.x-selected.x,n.y-selected.y):Math.hypot(n.x,n.y)});
  }
  candidates.sort((a,b)=>a.priority-b.priority||a.distance-b.distance);
  const rootCount=candidates.filter(c=>c.n.level===0).length;
  const labelBudget=rootCount+Math.min(52,Math.max(12,Math.round(14+scale*6)));
  const occupied=[];const hitBoxes={};let drawn=0;
  for(const {n,alpha} of candidates){
   if(n.level!==0&&drawn>=labelBudget)continue;
   const sx=width/2+offset.x+n.x*scale,sy=height/2+offset.y+n.y*scale;
   let label=labelPool.get(n.id);if(!label){label=new Text({text:n.title,style:style.clone()});labelPool.set(n.id,label);labels.addChild(label);}
   const title=n.level===0&&scale<1.2?(n.shortTitle||(shortRoots[lang]||shortRoots.fr)[n.rootId]||n.title):n.title;
   let fontSize=n.level===0?clamp(11.5+Math.log2(Math.max(.5,scale))*1.25,10.5,15):clamp(10.2+Math.log2(Math.max(.7,scale))*.92,9.5,13.5);if(selected&&activeBranch.has(n.id))fontSize+=.7;if(selected?.id===n.id)fontSize+=1;
   label.text=title;label.style.fontSize=fontSize;label.style.fontWeight=n.level===0?"650":"500";
   // Wrap long names to the available phone width before positioning the label.
   label.style.wordWrap=true;label.style.breakWords=true;label.style.align="center";
   label.style.wordWrapWidth=Math.max(100,Math.min(width*.46,220));
   const angle=Number.isFinite(n.angle)?n.angle:Math.atan2(n.y,n.x),dx=Math.cos(angle),dy=Math.sin(angle);
   const anchorX=dx>.32?0:dx<-.32?1:.5,anchorY=dy>.48?0:dy<-.48?1:.5;
   const radius=n.level===0?Math.max(15,n.r*scale+10):Math.max(7,n.r*scale+5);
   label.anchor.set(anchorX,anchorY);
   const rawX=sx+dx*radius,rawY=sy+dy*radius;
   const x=clamp(rawX,8+anchorX*label.width,width-8-(1-anchorX)*label.width);
   const y=clamp(rawY,56+anchorY*label.height,height-14-(1-anchorY)*label.height);
   label.position.set(x,y);label.alpha=Math.max(alpha,selected?0.76:0.88);label.visible=true;
   const box={left:x-anchorX*label.width,right:x+(1-anchorX)*label.width,top:y-anchorY*label.height,bottom:y+(1-anchorY)*label.height};
   hitBoxes[n.id]=box;
   const collides=occupied.some(o=>box.left<o.right+7&&box.right>o.left-7&&box.top<o.bottom+5&&box.bottom>o.top-5);
   if(collides&&selected?.id!==n.id&&n.level!==0){label.visible=false;continue;}
   occupied.push(box);live.add(n.id);drawn++;
  }
  for(const [id,label] of labelPool){if(!live.has(id))label.visible=false;}
  canvas.dataset.visibleNodeIds=JSON.stringify([...live]);
  canvas.dataset.visibleNodeHitBoxes=JSON.stringify(hitBoxes);
  app.render();
 }
 return{render,resize,destroy:()=>app.destroy({removeView:false,children:true})};
}
