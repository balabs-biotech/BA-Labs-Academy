import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PALETTE={mic:0x80aeb8,myc:0xc88773,bio:0x79a991,agr:0xc19b73,inf:0x8da8b5,gen:0x7eaaa3,bpr:0xd4a36f,bmt:0xb18a83,phy:0xb5b58d,pathways:0xa9a0d4};
const hash=s=>{let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return n>>>0};

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
  const point=n=>({x:n.x,y:n.y});
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const lineage=new Set();let ancestor=selected;
  while(ancestor){lineage.add(ancestor.id);ancestor=ancestor.parent?byId.get(ancestor.parent):null;}
  const activeBranch=new Set();
  if(selected){
   activeBranch.add(selected.id);
   let grew=true;
   while(grew){grew=false;for(const n of nodes){if(n.parent&&activeBranch.has(n.parent)&&!activeBranch.has(n.id)){activeBranch.add(n.id);grew=true;}}}
  }
  for(const e of edges){
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
