/**
 * Screen-space Atlas label layout, collision filtering and hit-box publication.
 * Label creation and Pixi containers are injected by the renderer.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function renderAtlasLabels({canvas,labels,labelPool,style,createLabel,nodes,selected,scale,offset,width,height,alphaFor,activeBranch,lineage,lang}) {
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
 let label=labelPool.get(n.id);if(!label){label=createLabel(n, style);labelPool.set(n.id,label);labels.addChild(label);}
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
}
