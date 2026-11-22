const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

const overlapArea=(a,b,padding)=>{
 const width=Math.max(0,Math.min(a.right,b.right+padding)-Math.max(a.left,b.left-padding));
 const height=Math.max(0,Math.min(a.bottom,b.bottom+padding)-Math.max(a.top,b.top-padding));
 return width*height;
};

/**
 * Places a label in screen space. It searches outward/tangential alternatives
 * before accepting the least-overlapping position; nodes are never displaced.
 */
export function placeAtlasLabel({x,y,width,height,anchorX,anchorY,angle,bounds,occupied=[],padding=6}){
 const dx=Math.cos(angle),dy=Math.sin(angle),tx=-dy,ty=dx;
 const offsets=[[0,0],[dx*14,dy*14],[tx*16,ty*16],[-tx*16,-ty*16],[dx*28,dy*28],[tx*32,ty*32],[-tx*32,-ty*32],[dx*42,dy*42],[tx*48,ty*48],[-tx*48,-ty*48],[dx*18+tx*24,dy*18+ty*24],[dx*18-tx*24,dy*18-ty*24]];
 let best=null;
 for(let index=0;index<offsets.length;index++){
  const [ox,oy]=offsets[index];
  const px=clamp(x+ox,bounds.left+anchorX*width,bounds.right-(1-anchorX)*width);
  const py=clamp(y+oy,bounds.top+anchorY*height,bounds.bottom-(1-anchorY)*height);
  const box={left:px-anchorX*width,right:px+(1-anchorX)*width,top:py-anchorY*height,bottom:py+(1-anchorY)*height};
  const overlap=occupied.reduce((sum,item)=>sum+overlapArea(box,item,padding),0);
  const displacement=Math.hypot(px-x,py-y);
  const score=overlap*100+displacement*0.35+index*0.001;
  if(!best||score<best.score)best={x:px,y:py,box,overlap,score};
  if(overlap===0)break;
 }
 return best;
}
