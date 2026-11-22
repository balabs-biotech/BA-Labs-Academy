const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

const overlapArea=(a,b,padding)=>{
 const width=Math.max(0,Math.min(a.right,b.right+padding)-Math.max(a.left,b.left-padding));
 const height=Math.max(0,Math.min(a.bottom,b.bottom+padding)-Math.max(a.top,b.top-padding));
 return width*height;
};

const CELL_SIZE=96;
const spatialIndexes=new WeakMap();

function cellRange(box,padding=0){
 return {
  left:Math.floor((box.left-padding)/CELL_SIZE),
  right:Math.floor((box.right+padding)/CELL_SIZE),
  top:Math.floor((box.top-padding)/CELL_SIZE),
  bottom:Math.floor((box.bottom+padding)/CELL_SIZE)
 };
}

function addToIndex(index,box){
 const range=cellRange(box);
 for(let x=range.left;x<=range.right;x++){
  for(let y=range.top;y<=range.bottom;y++){
   const key=x+":"+y;
   let bucket=index.cells.get(key);
   if(!bucket){bucket=[];index.cells.set(key,bucket);}
   bucket.push(box);
  }
 }
}

function getSpatialCandidates(occupied,box,padding){
 let index=spatialIndexes.get(occupied);
 if(!index||occupied.length<index.indexedLength){
  index={cells:new Map(),indexedLength:0};
  spatialIndexes.set(occupied,index);
 }
 // The layout pipeline appends accepted boxes during a frame. Index only the
 // new entries instead of rebuilding the spatial grid for every label.
 while(index.indexedLength<occupied.length){
  addToIndex(index,occupied[index.indexedLength]);
  index.indexedLength++;
 }
 const range=cellRange(box,padding);
 const found=new Set();
 for(let x=range.left;x<=range.right;x++){
  for(let y=range.top;y<=range.bottom;y++){
   const bucket=index.cells.get(x+":"+y);
   if(bucket)for(const candidate of bucket)found.add(candidate);
  }
 }
 return found;
}

/**
 * Places a label in screen space. A spatial hash narrows collision checks to
 * nearby labels while preserving the same overlap score and candidate order.
 * Nodes are never displaced; only their labels move.
 */
export function placeAtlasLabel({x,y,width,height,anchorX,anchorY,angle,bounds,occupied=[],padding=6,collisionStats}){
 const dx=Math.cos(angle),dy=Math.sin(angle),tx=-dy,ty=dx;
 const offsets=[[0,0],[dx*14,dy*14],[tx*16,ty*16],[-tx*16,-ty*16],[dx*28,dy*28],[tx*32,ty*32],[-tx*32,-ty*32],[dx*42,dy*42],[tx*48,ty*48],[-tx*48,-ty*48],[dx*18+tx*24,dy*18+ty*24],[dx*18-tx*24,dy*18-ty*24]];
 let best=null;
 for(let index=0;index<offsets.length;index++){
  const [ox,oy]=offsets[index];
  const px=clamp(x+ox,bounds.left+anchorX*width,bounds.right-(1-anchorX)*width);
  const py=clamp(y+oy,bounds.top+anchorY*height,bounds.bottom-(1-anchorY)*height);
  const box={left:px-anchorX*width,right:px+(1-anchorX)*width,top:py-anchorY*height,bottom:py+(1-anchorY)*height};
  const nearby=getSpatialCandidates(occupied,box,padding);
  let overlap=0;
  for(const item of nearby){
   if(collisionStats)collisionStats.comparisons=(collisionStats.comparisons||0)+1;
   overlap+=overlapArea(box,item,padding);
  }
  const displacement=Math.hypot(px-x,py-y);
  const score=overlap*100+displacement*0.35+index*0.001;
  if(!best||score<best.score)best={x:px,y:py,box,overlap,score};
  if(overlap===0)break;
 }
 return best;
}
