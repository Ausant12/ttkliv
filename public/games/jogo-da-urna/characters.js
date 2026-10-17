export function characterScale(p){return p.kind?1.7:p.votes>=5000?2.3:p.votes>=500?1.78:p.votes===100?1.55:1.42;}
export function characterPosition(p){
  const scale=characterScale(p);
  const length=Math.min(16,Array.from(String(p.user||'Visitante')).length);
  const margin=Math.max(34*scale,length*3*scale)+8;
  const startX=p.team==='lula'?margin:540-margin;
  const targetX=p.team==='lula'?185:355;
  const topExtent=p.kind?114:p.votes>=5000?128:120;
  const targetY=Math.max(280+p.lane,50+topExtent*scale+8);
  const progress=Math.min(1,Math.max(0,p.age/2.4));
  return {x:startX+(targetX-startX)*progress,y:430+(targetY-430)*progress};
}
