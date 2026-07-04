"use strict";
/* ============================================================
   我的小世界：台灣島物語 v2 — 遊戲引擎
   （資料定義在 data.js）
   ============================================================ */
const cv=document.getElementById('c'), ctx=cv.getContext('2d');
let VW=innerWidth, VH=innerHeight, DPR=Math.min(devicePixelRatio||1,2);
function resize(){VW=innerWidth;VH=innerHeight;cv.width=VW*DPR;cv.height=VH*DPR;
  cv.style.width=VW+'px';cv.style.height=VH+'px';ctx.setTransform(DPR,0,0,DPR,0,0);}
addEventListener('resize',resize);resize();
let rs=SEED;
function rand(){rs=(rs*1664525+1013904223)>>>0;return rs/4294967296;}
function hsh(x,y){let n=Math.sin(x*127.1+y*311.7+SEED*0.001)*43758.5453;return n-Math.floor(n);}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,s=t=>t*t*(3-2*t);
  const a=hsh(xi,yi),b=hsh(xi+1,yi),c=hsh(xi,yi+1),d=hsh(xi+1,yi+1);
  return a+(b-a)*s(xf)+(c-a)*s(yf)+(a-b-c+d)*s(xf)*s(yf);}
function clamp(v,a,b){return v<a?a:v>b?b:v;}
function dist(ax,ay,bx,by){return Math.hypot(ax-bx,ay-by);}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function fmt(n){return n.toLocaleString('zh-TW');}
function tint(hex,amt){ // 增亮(+)/壓暗(-) hex 顏色
  const p=parseInt(hex.slice(1),16);
  const r=clamp((p>>16)+amt,0,255),g=clamp(((p>>8)&255)+amt,0,255),b=clamp((p&255)+amt,0,255);
  return `rgb(${r},${g},${b})`;}

/* ================= 音效 / 音樂 ================= */
let AC=null, musicOn=true, nextNote=0, mstep=0;
function initAudio(){ if(AC)return; try{AC=new (window.AudioContext||window.webkitAudioContext)();
  setInterval(schedMusic,100);}catch(e){} }
function tone(f,t0,dur,type,vol){ if(!AC)return; const o=AC.createOscillator(),g=AC.createGain();
  o.type=type||'triangle';o.frequency.value=f;g.gain.setValueAtTime(vol||0.12,t0);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);o.connect(g);g.connect(AC.destination);
  o.start(t0);o.stop(t0+dur+0.05);}
const PENTA=[440,494,554,659,740,880];
function schedMusic(){ if(!AC||!musicOn)return; const ahead=AC.currentTime+0.35;
  if(nextNote<AC.currentTime)nextNote=AC.currentTime+0.05;
  while(nextNote<ahead){ const s=mstep%32;
    if(s%4===0)tone([220,165,185,147][(mstep>>2)%4],nextNote,0.5,'sine',0.06);
    if(hsh(s,Math.floor(mstep/32)%8)>0.35)tone(PENTA[Math.floor(hsh(s*3+1,mstep%64)*6)],nextNote,0.42,'triangle',0.05);
    nextNote+=0.3125;mstep++;}}
function sfx(name){ if(!AC)return; const t=AC.currentTime;
  if(name==='blip')tone(660+Math.random()*220,t,0.05,'square',0.03);
  else if(name==='pop'){tone(520,t,0.08,'triangle',0.1);tone(780,t+0.06,0.1,'triangle',0.1);}
  else if(name==='splash'){tone(300,t,0.15,'sine',0.12);tone(180,t+0.05,0.2,'sine',0.1);}
  else if(name==='jingle'){[523,659,784,1047].forEach((f,i)=>tone(f,t+i*0.09,0.25,'triangle',0.12));}
  else if(name==='cash'){[880,1109,1319].forEach((f,i)=>tone(f,t+i*0.06,0.15,'square',0.06));}
  else if(name==='dig'){tone(120,t,0.12,'sine',0.16);tone(90,t+0.08,0.12,'sine',0.12);}
  else if(name==='swing'){tone(500,t,0.06,'sawtooth',0.04);tone(300,t+0.04,0.06,'sawtooth',0.04);}
  else if(name==='sad'){tone(330,t,0.2,'triangle',0.1);tone(262,t+0.18,0.3,'triangle',0.1);}
  else if(name==='thud'){tone(150,t,0.1,'square',0.1);}
  else if(name==='train'){[392,523,659,784].forEach((f,i)=>tone(f,t+i*0.1,0.3,'triangle',0.1));}
  else if(name==='chime'){[660,880,1100].forEach((f,i)=>tone(f,t+i*0.15,0.5,'sine',0.08));}}

/* ================= 地圖生成 ================= */
const map=new Uint8Array(MW*MH);
const T=(x,y)=>(x<0||y<0||x>=MW||y>=MH)?SEA:map[y*MW+x];
function inPoly(x,y){let ins=false;for(let i=0,j=POLY.length-1;i<POLY.length;j=i++){
  const xi=POLY[i][0],yi=POLY[i][1],xj=POLY[j][0],yj=POLY[j][1];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)ins=!ins;}return ins;}
function distSeg(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;
  let t=L?((px-ax)*dx+(py-ay)*dy)/L:0;t=clamp(t,0,1);
  return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));}
function polylineDist(tx,ty,pts){let d=1e9;for(let i=0;i<pts.length-1;i++)
  d=Math.min(d,distSeg(tx,ty,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1]));return d;}
function genMap(){
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    const nx=(tx+0.5)/MW, ny=(ty+0.5)/MH;
    const j=(vnoise(tx*0.15,ty*0.15)-0.5)*0.012;
    let land=inPoly(nx+j,ny+j*0.7);
    if(!land)for(const is of ISLANDS){for(const [bx,by,r] of is.blobs)
      if(dist(tx,ty,bx,by)<r*(0.8+vnoise(tx*0.3,ty*0.3)*0.5)){land=true;break;} if(land)break;}
    let t=SEA;
    if(land){
      t=GRASS;
      for(const sp of SPINES){const d=polylineDist(tx,ty,sp.pts);
        if(d<sp.hw)t=HIGH; if(d<sp.mw&&vnoise(tx*0.3+50,ty*0.3)>0.45)t=MT;}
      const lv=((tx-LAKEC.x)/LAKEC.rx)**2+((ty-LAKEC.y)/LAKEC.ry)**2;
      if(lv<2.4&&t===MT)t=HIGH;
      if(lv<1)t=LAKE;
    }
    map[ty*MW+tx]=t;
  }
  // 稻田
  for(const [x0,y0,x1,y1] of FIELDS)
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++)
      if(T(tx,ty)===GRASS)map[ty*MW+tx]=FIELD;
  // 沙灘
  const sand=[];
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    const t=T(tx,ty);
    if(!WALKABLE[t]||t===LAKE)continue;
    let near=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(T(tx+dx,ty+dy)===SEA)near=true;
    if(near)sand.push(ty*MW+tx);}
  sand.forEach(i=>map[i]=SAND);
  const sand2=[];
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    const t=T(tx,ty); if(t!==GRASS&&t!==HIGH&&t!==FIELD)continue;
    let near=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(T(tx+dx,ty+dy)===SAND)near=true;
    if(near&&vnoise(tx*0.4,ty*0.4+20)>0.5)sand2.push(ty*MW+tx);}
  sand2.forEach(i=>map[i]=PLAZA*0+SAND);
  // 市鎮廣場（車站、夜市、商店周邊鋪石）
  const plazaAt=(cx,cy,r)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const t=T(cx+dx,cy+dy);
    if((t===GRASS||t===FIELD||t===SAND)&&dx*dx+dy*dy<=r*r)map[(cy+dy)*MW+cx+dx]=PLAZA;}};
  STATIONS.forEach(s=>plazaAt(s.tx+2,s.ty+2,4));
  LANDMARKS.forEach(L=>{if(L.t==='shop'||L.t==='market')plazaAt(L.tx+3,L.ty+2,4);});
  // 公路
  for(const hw of HIGHWAYS)for(let i=0;i<hw.pts.length-1;i++){
    const [ax,ay]=hw.pts[i],[bx,by]=hw.pts[i+1],L=Math.hypot(bx-ax,by-ay)||1;
    for(let s=0;s<=L;s+=0.4){
      const x=ax+(bx-ax)*s/L, y=ay+(by-ay)*s/L;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const tx=Math.round(x+dx),ty=Math.round(y+dy);
        if(Math.hypot(tx-x,ty-y)<=1.15){const t=T(tx,ty);
          if(t===GRASS||t===HIGH||t===SAND||t===FIELD||(hw.mt&&(t===MT)))map[ty*MW+tx]=PATH;}}}}
}
genMap();
function findWalk(tx,ty){ for(let r=0;r<25;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  const t=T(tx+dx,ty+dy); if(WALKABLE[t])return {x:(tx+dx+0.5)*TILE,y:(ty+dy+0.5)*TILE};}
  return {x:tx*TILE,y:ty*TILE}; }
function findWater(tx,ty){ for(let r=1;r<10;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  const t=T(tx+dx,ty+dy); if(t===SEA||t===LAKE)return {x:(tx+dx+0.5)*TILE,y:(ty+dy+0.5)*TILE};}
  return null; }
function findWalkSafe(tx,ty){ // 找可走且不撞建築/樹/岩的落點（傳送用）
  for(let r=0;r<25;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const t=T(tx+dx,ty+dy);
    if(WALKABLE[t]){const x=(tx+dx+0.5)*TILE,y=(ty+dy+0.5)*TILE;
      if(!hitObstacle(x,y))return {x,y};}}
  return findWalk(tx,ty); }

/* ================= 圖塊預繪 ================= */
const tileImgs={};
function makeTile(type){
  const c=document.createElement('canvas');c.width=c.height=TILE;const g=c.getContext('2d');
  const tri=(base,dark)=>{g.fillStyle=base;g.fillRect(0,0,TILE,TILE);g.fillStyle=dark;
    const s=12;for(let gy=0;gy<4;gy++)for(let gx=0;gx<4;gx++){if((gx+gy)%2)continue;
      const x=gx*s,y=gy*s;g.beginPath();g.moveTo(x,y+s);g.lineTo(x+s/2,y);g.lineTo(x+s,y+s);g.closePath();g.fill();}};
  if(type===GRASS)tri('#8fca5a','#86c052');
  else if(type===HIGH)tri('#6fae4d','#67a446');
  else if(type===FIELD){g.fillStyle='#b8d474';g.fillRect(0,0,TILE,TILE);
    g.strokeStyle='#a2c25e';g.lineWidth=3;
    for(let i=0;i<4;i++){g.beginPath();g.moveTo(0,6+i*12);g.lineTo(48,6+i*12);g.stroke();}
    g.fillStyle='#8fae52';for(let i=0;i<8;i++)g.fillRect(4+(i%4)*12,8+Math.floor(i/4)*24,2,4);}
  else if(type===SAND){g.fillStyle='#efe0a8';g.fillRect(0,0,TILE,TILE);g.fillStyle='#e3d194';
    for(let i=0;i<14;i++)g.fillRect(Math.floor(hsh(i,type)*44)+2,Math.floor(hsh(i+40,type)*44)+2,3,3);}
  else if(type===SEA||type===LAKE){g.fillStyle=type===SEA?'#4fa8c8':'#4f9fc0';g.fillRect(0,0,TILE,TILE);
    g.strokeStyle='rgba(255,255,255,0.10)';g.lineWidth=2;
    for(let i=0;i<3;i++){g.beginPath();const y=8+i*16;g.moveTo(0,y);
      g.quadraticCurveTo(12,y-4,24,y);g.quadraticCurveTo(36,y+4,48,y);g.stroke();}}
  else if(type===MT){g.fillStyle='#8b8f7c';g.fillRect(0,0,TILE,TILE);g.fillStyle='#7a7f6e';
    for(let i=0;i<5;i++){const x=hsh(i,9)*36,y=hsh(i+9,9)*36;g.beginPath();
      g.moveTo(x,y+10);g.lineTo(x+7,y);g.lineTo(x+14,y+10);g.closePath();g.fill();}
    g.fillStyle='#9aa08b';g.fillRect(0,0,TILE,3);}
  else if(type===PLAZA){g.fillStyle='#d8cba8';g.fillRect(0,0,TILE,TILE);
    g.strokeStyle='#c8b892';g.lineWidth=2;
    g.strokeRect(1,1,22,22);g.strokeRect(25,1,22,22);g.strokeRect(1,25,22,22);g.strokeRect(25,25,22,22);}
  else if(type===PATH){g.fillStyle='#d9b97e';g.fillRect(0,0,TILE,TILE);g.fillStyle='#cba96e';
    for(let i=0;i<10;i++)g.fillRect(Math.floor(hsh(i,7)*42)+2,Math.floor(hsh(i+7,7)*42)+2,4,3);}
  return c;
}
[SEA,SAND,GRASS,HIGH,MT,LAKE,PLAZA,PATH,FIELD].forEach(t=>tileImgs[t]=makeTile(t));
// 小地圖
const mini=document.createElement('canvas');mini.width=MW/2;mini.height=MH/2;
{ const g=mini.getContext('2d');
  const col={[SEA]:'#4fa8c8',[SAND]:'#efe0a8',[GRASS]:'#8fca5a',[HIGH]:'#6fae4d',
    [MT]:'#8b8f7c',[LAKE]:'#4f9fc0',[PLAZA]:'#d8cba8',[PATH]:'#d9b97e',[FIELD]:'#b8d474'};
  for(let ty=0;ty<MH;ty+=2)for(let tx=0;tx<MW;tx+=2){g.fillStyle=col[T(tx,ty)];g.fillRect(tx/2,ty/2,1,1);} }

/* ================= 建築 ================= */
function drawRoofSign(x,y,txt,bg){ if(!txt)return;
  ctx.font='bold 15px "Microsoft JhengHei"';
  const w=ctx.measureText(txt).width;
  ctx.fillStyle=bg||'#8a5a2b';rr(x-w/2-10,y-14,w+20,26,8);ctx.fill();
  ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(txt,x,y+5);ctx.textAlign='left';}
function bShadow(x,y,w){ctx.fillStyle='rgba(0,0,0,.15)';
  ctx.beginPath();ctx.ellipse(x+w/2,y,w/2,12,0,0,7);ctx.fill();}
const BUILDING_DRAWS={
 shop(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#e8c07a';rr(x,y-38,w,h+38,10);ctx.fill();
  ctx.fillStyle='#b5854e';ctx.fillRect(x,y+h-8,w,8);
  for(let i=0;i<6;i++){ctx.fillStyle=i%2?'#e2574c':'#fff7ea';
    ctx.beginPath();ctx.moveTo(x+i*w/6,y-38);ctx.lineTo(x+(i+1)*w/6,y-38);
    ctx.lineTo(x+(i+1)*w/6,y-14);ctx.arc(x+(i+0.5)*w/6,y-14,w/12,0,Math.PI);ctx.lineTo(x+i*w/6,y-14);ctx.fill();}
  ctx.fillStyle='#7a4a22';rr(x+w/2-22,y+h-56,44,56,6);ctx.fill();
  ctx.fillStyle='#ffe9b0';rr(x+16,y+6,34,30,6);ctx.fill();rr(x+w-50,y+6,34,30,6);ctx.fill();
  drawRoofSign(x+w/2,y-54,'雜 貨 店','#8a5a2b');},
 station(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#f3ead1';rr(x,y-36,w,h+36,8);ctx.fill();
  ctx.fillStyle='#4a6f8f';ctx.beginPath();ctx.moveTo(x-10,y-32);ctx.lineTo(x+w/2,y-62);ctx.lineTo(x+w+10,y-32);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+w/2,y-16,11,0,7);ctx.fill();
  ctx.strokeStyle='#4a3a28';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+w/2,y-16,11,0,7);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x+w/2,y-16);ctx.lineTo(x+w/2,y-24);ctx.moveTo(x+w/2,y-16);ctx.lineTo(x+w/2+6,y-14);ctx.stroke();
  ctx.fillStyle='#7a4a22';rr(x+w/2-20,y+h-50,40,50,5);ctx.fill();
  ctx.fillStyle='#cfe3f5';rr(x+12,y+4,30,26,5);ctx.fill();rr(x+w-42,y+4,30,26,5);ctx.fill();
  ctx.fillStyle='#9a9a9a';ctx.fillRect(x-8,y+h,w+16,6);
  drawRoofSign(x+w/2,y-76,'🚉 '+b.label,'#4a6f8f');},
 harbor(b){const x=b.x,y=b.y,w=b.w,h=b.h;
  ctx.fillStyle='#a5793f';ctx.fillRect(x,y,w,h);
  ctx.strokeStyle='#8a6234';ctx.lineWidth=3;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x,y+6+i*10);ctx.lineTo(x+w,y+6+i*10);ctx.stroke();}
  ctx.fillStyle='#7a5a2f';
  ctx.fillRect(x-3,y-8,8,14);ctx.fillRect(x+w-5,y-8,8,14);ctx.fillRect(x-3,y+h-8,8,14);ctx.fillRect(x+w-5,y+h-8,8,14);
  // 停泊的小船
  ctx.fillStyle='#c9803a';ctx.beginPath();ctx.ellipse(x+w/2,y+h+16,20,9,0,0,Math.PI);ctx.fill();
  ctx.fillStyle='#fff';ctx.fillRect(x+w/2-2,y+h+2,4,10);
  drawRoofSign(x+w/2,y-22,'⚓ '+b.label,'#3f6f8f');},
 market(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  const colors=['#8a5a3b','#c9803a','#4f9fc0'],foods=['珍奶','雞排','冰'];
  for(let s=0;s<3;s++){const sx=x+s*w/3+3,sw=w/3-6;
    ctx.fillStyle='#9c6b3d';ctx.fillRect(sx+3,y+h-36,5,36);ctx.fillRect(sx+sw-8,y+h-36,5,36);
    ctx.fillStyle=colors[s];rr(sx,y+h-52,sw,20,4);ctx.fill();
    for(let i=0;i<3;i++){ctx.fillStyle=i%2?'#fff':colors[s];
      ctx.beginPath();ctx.moveTo(sx+i*sw/3,y+h-74);ctx.lineTo(sx+(i+1)*sw/3,y+h-74);
      ctx.lineTo(sx+(i+1)*sw/3,y+h-58);ctx.arc(sx+(i+0.5)*sw/3,y+h-58,sw/6,0,Math.PI);ctx.closePath();ctx.fill();}
    ctx.fillStyle='#e2574c';ctx.beginPath();ctx.arc(sx+sw/2,y+h-82,6,0,7);ctx.fill();
    ctx.fillStyle='#5b4023';ctx.font='bold 12px "Microsoft JhengHei"';ctx.textAlign='center';
    ctx.fillText(foods[s],sx+sw/2,y+h-40);ctx.textAlign='left';}
  drawRoofSign(x+w/2,y-30,'🏮 '+b.label,'#c9500f');},
 t101(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w+16);
  ctx.fillStyle='#5e6a70';rr(x,y+h-26,w,26,4);ctx.fill();
  for(let i=0;i<8;i++){const sy=y+h-26-(i+1)*34,sw=w*(0.55+0.03*i);
    ctx.fillStyle=i%2?'#4b8f9f':'#549aab';
    ctx.beginPath();ctx.moveTo(cx2-sw/2*0.8,sy);ctx.lineTo(cx2+sw/2*0.8,sy);
    ctx.lineTo(cx2+sw/2,sy+34);ctx.lineTo(cx2-sw/2,sy+34);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=1;ctx.strokeRect(cx2-sw/2*0.8,sy,sw*0.8,34);}
  const topY=y+h-26-8*34;
  ctx.fillStyle='#44828f';rr(cx2-10,topY-26,20,26,3);ctx.fill();
  ctx.strokeStyle='#44828f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx2,topY-26);ctx.lineTo(cx2,topY-64);ctx.stroke();
  drawRoofSign(cx2,y+h+22,'台北101','#44828f');},
 temple(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#c94f43';rr(x,y-26,w,h+26,6);ctx.fill();
  ctx.fillStyle='#8f2f26';ctx.fillRect(x+10,y-26,14,h+18);ctx.fillRect(x+w-24,y-26,14,h+18);
  ctx.fillStyle='#e8a13a';ctx.beginPath();ctx.moveTo(x-20,y-22);ctx.quadraticCurveTo(cx2,y-64,x+w+20,y-22);
  ctx.quadraticCurveTo(cx2,y-40,x-20,y-22);ctx.fill();
  ctx.fillStyle='#7a4a22';rr(cx2-26,y+h-52,52,52,6);ctx.fill();
  ctx.fillStyle='#ffd23f';ctx.font='bold 15px "Microsoft JhengHei"';ctx.textAlign='center';
  ctx.fillText(b.label,cx2,y-30);ctx.textAlign='left';
  ctx.fillStyle='#e2574c';ctx.beginPath();ctx.arc(x+4,y-4,8,0,7);ctx.arc(x+w-4,y-4,8,0,7);ctx.fill();},
 teahouse(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#6a4a3a';rr(x,y-56,w,h+56,6);ctx.fill();
  ctx.fillStyle='#4a332a';ctx.fillRect(x-6,y-30,w+12,8);ctx.fillRect(x-6,y+4,w+12,8);
  ctx.fillStyle='#ffe9b0';rr(x+10,y-48,26,20,4);ctx.fill();rr(x+w-36,y-48,26,20,4);ctx.fill();
  rr(x+10,y-14,26,20,4);ctx.fill();rr(x+w-36,y-14,26,20,4);ctx.fill();
  for(let i=0;i<4;i++){ctx.fillStyle='#e2574c';ctx.beginPath();ctx.arc(x+14+i*(w-28)/3,y-62,7,0,7);ctx.fill();
    ctx.fillStyle='#ffd23f';ctx.fillRect(x+13+i*(w-28)/3,y-54,2,5);}
  ctx.fillStyle='#7a4a22';rr(x+w/2-18,y+h-44,36,44,5);ctx.fill();
  drawRoofSign(x+w/2,y-82,b.label,'#8f2f26');},
 lighthouse(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w+20);
  ctx.fillStyle='#f5f5f0';ctx.beginPath();
  ctx.moveTo(cx2-16,y+h);ctx.lineTo(cx2-10,y-70);ctx.lineTo(cx2+10,y-70);ctx.lineTo(cx2+16,y+h);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#d8d8d0';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#3a3a3a';ctx.fillRect(cx2-12,y-82,24,12);
  ctx.fillStyle='#ffe9b0';ctx.fillRect(cx2-8,y-78,16,8);
  ctx.fillStyle='#3a3a3a';ctx.beginPath();ctx.moveTo(cx2-12,y-82);ctx.lineTo(cx2,y-94);ctx.lineTo(cx2+12,y-82);ctx.closePath();ctx.fill();
  drawRoofSign(cx2,y+h+20,b.label,'#3f6f8f');},
 gate(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#c94f43';ctx.fillRect(x+4,y-40,12,h+40);ctx.fillRect(x+w-16,y-40,12,h+40);
  ctx.fillStyle='#e8a13a';ctx.beginPath();ctx.moveTo(x-14,y-38);ctx.quadraticCurveTo(x+w/2,y-66,x+w+14,y-38);
  ctx.quadraticCurveTo(x+w/2,y-50,x-14,y-38);ctx.fill();
  ctx.fillStyle='#8f2f26';ctx.fillRect(x-4,y-44,w+8,8);
  drawRoofSign(x+w/2,y-72,b.label,'#8f2f26');},
 opera(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#f0ede6';rr(x,y-30,w,h+30,26);ctx.fill();
  ctx.strokeStyle='#d8d4c8';ctx.lineWidth=2;rr(x,y-30,w,h+30,26);ctx.stroke();
  ctx.fillStyle='#7a8a9a';
  ctx.beginPath();ctx.ellipse(x+w*0.25,y+h*0.3,20,26,0,0,7);ctx.fill();
  ctx.beginPath();ctx.ellipse(x+w*0.65,y+h*0.1,16,20,0,0,7);ctx.fill();
  ctx.beginPath();ctx.ellipse(x+w*0.82,y+h*0.55,13,17,0,0,7);ctx.fill();
  drawRoofSign(x+w/2,y-46,b.label,'#7a8a9a');},
 windmill(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2,top=y-84;
  bShadow(x,y+h,w+8);
  ctx.fillStyle='#e8e8e4';ctx.beginPath();
  ctx.moveTo(cx2-7,y+h);ctx.lineTo(cx2-3,top);ctx.lineTo(cx2+3,top);ctx.lineTo(cx2+7,y+h);ctx.closePath();ctx.fill();
  ctx.fillStyle='#d0d0cc';ctx.beginPath();ctx.arc(cx2,top,6,0,7);ctx.fill();
  ctx.fillStyle='#f5f5f2';
  for(let i=0;i<3;i++){const a=tGlobal*1.6+i*Math.PI*2/3;
    ctx.save();ctx.translate(cx2,top);ctx.rotate(a);
    ctx.beginPath();ctx.ellipse(0,-22,4.5,24,0,0,7);ctx.fill();ctx.restore();}
  drawRoofSign(cx2,y+h+20,b.label,'#7a8a9a');},
 buddha(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#5a5a52';rr(x+4,y+h-16,w-8,16,4);ctx.fill();
  ctx.fillStyle='#4a4a44';
  ctx.beginPath();ctx.moveTo(cx2-34,y+h-16);ctx.quadraticCurveTo(cx2-38,y-20,cx2-16,y-30);
  ctx.lineTo(cx2+16,y-30);ctx.quadraticCurveTo(cx2+38,y-20,cx2+34,y+h-16);ctx.closePath();ctx.fill();
  ctx.fillStyle='#54544c';ctx.beginPath();ctx.arc(cx2,y-44,17,0,7);ctx.fill();
  ctx.fillStyle='#4a4a44';ctx.beginPath();ctx.arc(cx2,y-58,7,0,7);ctx.fill();
  ctx.fillStyle='#3a3a34';
  ctx.beginPath();ctx.arc(cx2-6,y-46,1.8,0,7);ctx.arc(cx2+6,y-46,1.8,0,7);ctx.fill();
  drawRoofSign(cx2,y+h+20,b.label,'#5a5a52');},
 fort(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#e8dcc0';rr(x,y-20,w,h+20,4);ctx.fill();
  ctx.fillStyle='#d8ccb0';for(let i=0;i<5;i++)ctx.fillRect(x+6+i*(w-16)/4,y-20,6,6);
  ctx.fillStyle='#f0e8d0';rr(x+w-46,y-58,36,44,4);ctx.fill();
  ctx.fillStyle='#c94f43';ctx.beginPath();ctx.moveTo(x+w-50,y-56);ctx.lineTo(x+w-28,y-72);ctx.lineTo(x+w-6,y-56);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#8a6b3a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+w-28,y-72);ctx.lineTo(x+w-28,y-88);ctx.stroke();
  ctx.fillStyle='#e2574c';ctx.beginPath();ctx.moveTo(x+w-28,y-88);ctx.lineTo(x+w-12,y-83);ctx.lineTo(x+w-28,y-78);ctx.fill();
  ctx.fillStyle='#7a4a22';rr(x+14,y+h-40,30,40,4);ctx.fill();
  drawRoofSign(x+w/2,y-100,b.label,'#8a6b3a');},
 redtower(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#e8dcc0';rr(x+6,y+h-20,w-12,20,3);ctx.fill();
  ctx.fillStyle='#c94f43';rr(x+12,y-4,w-24,h-20,4);ctx.fill();
  ctx.fillStyle='#8f2f26';ctx.beginPath();ctx.moveTo(x,y-2);ctx.quadraticCurveTo(cx2,y-18,x+w,y-2);
  ctx.quadraticCurveTo(cx2,y-8,x,y-2);ctx.fill();
  ctx.fillStyle='#c94f43';rr(x+20,y-40,w-40,32,4);ctx.fill();
  ctx.fillStyle='#8f2f26';ctx.beginPath();ctx.moveTo(x+8,y-38);ctx.quadraticCurveTo(cx2,y-56,x+w-8,y-38);
  ctx.quadraticCurveTo(cx2,y-44,x+8,y-38);ctx.fill();
  ctx.fillStyle='#ffe9b0';rr(cx2-8,y-32,16,14,3);ctx.fill();
  drawRoofSign(cx2,y-66,b.label,'#8f2f26');},
 pagodas(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  for(let p=0;p<2;p++){const px=x+w*0.25+p*w*0.5,pw=34;
    for(let f=0;f<3;f++){const fy=y+h-24-f*30;
      ctx.fillStyle='#f2c94c';rr(px-pw/2+f*4,fy-24,pw-f*8,24,3);ctx.fill();
      ctx.fillStyle='#c94f43';ctx.beginPath();
      ctx.moveTo(px-pw/2+f*4-6,fy-22);ctx.quadraticCurveTo(px,fy-36,px+pw/2-f*4+6,fy-22);
      ctx.quadraticCurveTo(px,fy-28,px-pw/2+f*4-6,fy-22);ctx.fill();}}
  ctx.fillStyle='#3f8f5a';ctx.beginPath();ctx.arc(x+w*0.25,y+h-12,10,0,7);ctx.fill();
  ctx.fillStyle='#e8a13a';ctx.beginPath();ctx.arc(x+w*0.75,y+h-12,10,0,7);ctx.fill();
  drawRoofSign(x+w/2,y-64,b.label,'#c94f43');},
 tower85(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#6a7a8a';rr(x,y+h-120,16,120,3);ctx.fill();rr(x+w-16,y+h-120,16,120,3);ctx.fill();
  ctx.fillStyle='#7a8a9a';rr(x,y+h-190,w,70,4);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=1;
  for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(x+4,y+h-184+i*11);ctx.lineTo(x+w-4,y+h-184+i*11);ctx.stroke();}
  ctx.strokeStyle='#7a8a9a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx2,y+h-190);ctx.lineTo(cx2,y+h-216);ctx.stroke();
  drawRoofSign(cx2,y+h+20,b.label,'#5a6a7a');},
 gianttree(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;
  ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(cx2,y+h,w/2+18,12,0,0,7);ctx.fill();
  ctx.fillStyle='#6a4a2a';ctx.beginPath();
  ctx.moveTo(cx2-26,y+h);ctx.quadraticCurveTo(cx2-20,y-30,cx2-14,y-60);
  ctx.lineTo(cx2+14,y-60);ctx.quadraticCurveTo(cx2+20,y-30,cx2+26,y+h);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#5a3d22';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(cx2-10,y+h-10);ctx.quadraticCurveTo(cx2-8,y-20,cx2-6,y-50);ctx.stroke();
  ctx.fillStyle='#3f6f3f';
  ctx.beginPath();ctx.arc(cx2-24,y-72,22,0,7);ctx.arc(cx2+24,y-72,22,0,7);ctx.arc(cx2,y-92,28,0,7);ctx.arc(cx2-8,y-64,18,0,7);ctx.arc(cx2+10,y-66,18,0,7);ctx.fill();
  ctx.fillStyle='#4f7f4a';ctx.beginPath();ctx.arc(cx2-8,y-86,14,0,7);ctx.fill();
  drawRoofSign(cx2,y+h+20,b.label,'#3f6f3f');},
 peak(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#7a7f6e';ctx.beginPath();
  ctx.moveTo(cx2-24,y+h);ctx.lineTo(cx2-6,y-26);ctx.lineTo(cx2+8,y-10);ctx.lineTo(cx2+24,y+h);ctx.closePath();ctx.fill();
  ctx.fillStyle='#f5f5f2';ctx.beginPath();ctx.moveTo(cx2-6,y-26);ctx.lineTo(cx2-12,y-8);ctx.lineTo(cx2,y-4);ctx.lineTo(cx2+8,y-10);ctx.closePath();ctx.fill();
  ctx.fillStyle='#8a6b3a';ctx.fillRect(cx2+14,y+2,5,h-4);
  ctx.fillStyle='#e8dcc0';rr(cx2+2,y-16,44,20,3);ctx.fill();
  ctx.fillStyle='#5b4023';ctx.font='bold 10px "Microsoft JhengHei"';
  ctx.fillText('玉山主峰',cx2+7,y-3);
  drawRoofSign(cx2,y+h+20,'⛰️ 3,952m','#5a5a52');},
 queenhead(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#c9a878';
  ctx.beginPath();ctx.moveTo(cx2-8,y+h);ctx.quadraticCurveTo(cx2-4,y+10,cx2-2,y-8);
  ctx.quadraticCurveTo(cx2-14,y-14,cx2-12,y-26);
  ctx.quadraticCurveTo(cx2-8,y-38,cx2+8,y-36);
  ctx.quadraticCurveTo(cx2+22,y-32,cx2+18,y-18);
  ctx.quadraticCurveTo(cx2+16,y-8,cx2+6,y-6);
  ctx.quadraticCurveTo(cx2+10,y+20,cx2+12,y+h);ctx.closePath();ctx.fill();
  ctx.fillStyle='#b8956a';ctx.beginPath();ctx.arc(cx2+2,y-24,4,0,7);ctx.fill();
  drawRoofSign(cx2,y+h+20,b.label,'#8a7458');},
 lantern(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#9c6b3d';ctx.fillRect(x+4,y+h-36,6,36);ctx.fillRect(x+w-10,y+h-36,6,36);
  ctx.fillStyle='#6a4a3a';rr(x,y+h-52,w,20,4);ctx.fill();
  ctx.fillStyle='#f2994a';rr(x+w/2-13,y-6,26,30,8);ctx.fill();
  ctx.fillStyle='#e2574c';ctx.font='bold 13px "Microsoft JhengHei"';ctx.textAlign='center';
  ctx.fillText('福',x+w/2,y+14);ctx.textAlign='left';
  drawRoofSign(x+w/2,y-24,'🏮 '+b.label,'#c9500f');},
 hotspring(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2,cy2=y+h/2;
  ctx.fillStyle='#9a9284';ctx.beginPath();ctx.ellipse(cx2,cy2,w/2,h/2,0,0,7);ctx.fill();
  ctx.fillStyle='#7fd4d4';ctx.beginPath();ctx.ellipse(cx2,cy2,w/2-8,h/2-8,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.4)';
  ctx.beginPath();ctx.ellipse(cx2-10,cy2-5,10,4,0,0,7);ctx.fill();
  for(let i=0;i<5;i++){ctx.fillStyle='#8a8274';
    const a=i*1.256;ctx.beginPath();ctx.arc(cx2+Math.cos(a)*(w/2-2),cy2+Math.sin(a)*(h/2-2),6,0,7);ctx.fill();}
  for(let i=0;i<3;i++){ // 蒸氣
    const ph=(tGlobal*0.5+i*0.33)%1;
    ctx.fillStyle=`rgba(255,255,255,${0.35*(1-ph)})`;
    ctx.beginPath();ctx.arc(cx2-14+i*14+Math.sin(tGlobal*2+i)*4,cy2-10-ph*36,7+ph*7,0,7);ctx.fill();}
  drawRoofSign(cx2,y-16,'♨️ '+b.label,'#3f8f8f');},
 balloon(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#8fae52';rr(x,y+h-14,w,14,4);ctx.fill();
  for(let i=0;i<2;i++){const bx=x+w*0.28+i*w*0.45, by=y-40+Math.sin(tGlobal*0.8+i*2)*7;
    const cols=i?['#e2574c','#f2c94c']:['#4f9fc0','#f2994a'];
    ctx.fillStyle=cols[0];ctx.beginPath();ctx.arc(bx,by-30,22,0,7);ctx.fill();
    ctx.fillStyle=cols[1];ctx.beginPath();ctx.arc(bx,by-30,22,-0.5,0.5);
    ctx.arc(bx,by-30,22,Math.PI-0.5,Math.PI+0.5);ctx.fill();
    ctx.strokeStyle='#8a6b3a';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(bx-10,by-12);ctx.lineTo(bx-6,by+2);ctx.moveTo(bx+10,by-12);ctx.lineTo(bx+6,by+2);ctx.stroke();
    ctx.fillStyle='#8a5a2b';rr(bx-8,by,16,11,3);ctx.fill();}
  drawRoofSign(x+w/2,y+h+20,'🎈 '+b.label,'#c9803a');},
 weir(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2,cy2=y+h/2;
  ctx.strokeStyle='#8a8274';ctx.lineWidth=7;ctx.lineCap='round';
  const heart=(hx,hy,s)=>{ctx.beginPath();ctx.moveTo(hx,hy+s*0.9);
    ctx.bezierCurveTo(hx-s*1.3,hy,hx-s*0.7,hy-s*0.9,hx,hy-s*0.25);
    ctx.bezierCurveTo(hx+s*0.7,hy-s*0.9,hx+s*1.3,hy,hx,hy+s*0.9);ctx.stroke();};
  heart(cx2-10,cy2-8,26);heart(cx2+14,cy2+14,26);
  ctx.lineCap='butt';
  drawRoofSign(cx2,y-14,'💕 '+b.label,'#3f6f8f');},
 house(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#c98a6a';rr(x,y-24,w,h+24,4);ctx.fill();
  ctx.strokeStyle='#b87a5a';ctx.lineWidth=1;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x,y-18+i*14);ctx.lineTo(x+w,y-18+i*14);ctx.stroke();}
  ctx.fillStyle='#8a8078';ctx.beginPath();
  ctx.moveTo(x-8,y-22);ctx.lineTo(x+w/2,y-44);ctx.lineTo(x+w+8,y-22);ctx.closePath();ctx.fill();
  ctx.fillStyle='#6a4a3a';rr(x+w/2-12,y+h-32,24,32,3);ctx.fill();
  ctx.fillStyle='#ffe9b0';rr(x+8,y-8,20,16,3);ctx.fill();rr(x+w-28,y-8,20,16,3);ctx.fill();},
 oldstreet(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  const cols=['#c98a6a','#d8a878','#b87a5a'];
  for(let i=0;i<3;i++){const sx=x+i*w/3,sw=w/3,lift=(i%2)*8;
    ctx.fillStyle=cols[i];rr(sx+1,y-32-lift,sw-2,h+32+lift,3);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=1;rr(sx+1,y-32-lift,sw-2,h+32+lift,3);ctx.stroke();
    ctx.fillStyle='#6a4534';ctx.beginPath();ctx.arc(sx+sw/2,y+h-4,sw/2-6,Math.PI,0);ctx.fill();
    ctx.fillRect(sx+6,y+h-4,sw-12,4);
    ctx.fillStyle='#f0e0c0';rr(sx+5,y-26-lift,sw-10,12,3);ctx.fill();
    ctx.fillStyle='#8a5a3a';ctx.beginPath();ctx.arc(sx+sw/2,y-32-lift,7,Math.PI,0);ctx.fill();}
  drawRoofSign(x+w/2,y-56,b.label,'#8a5a3a');},
 highheel(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='rgba(126,200,232,.8)';ctx.strokeStyle='#5f9fd8';ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(cx2-40,y+h-4);ctx.lineTo(cx2-34,y-40);
  ctx.quadraticCurveTo(cx2-10,y-58,cx2+18,y-34);
  ctx.quadraticCurveTo(cx2+44,y-14,cx2+42,y+h-4);ctx.lineTo(cx2+16,y+h-4);
  ctx.quadraticCurveTo(cx2+8,y-6,cx2-16,y-2);
  ctx.quadraticCurveTo(cx2-28,y+2,cx2-30,y+h-4);ctx.closePath();
  ctx.fill();ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=1;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(cx2-28+i*17,y-44+i*5);ctx.lineTo(cx2-20+i*17,y+h-8);ctx.stroke();}
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.beginPath();ctx.arc(cx2-2,y-42,5,0,7);ctx.fill();
  drawRoofSign(cx2,y+h+20,b.label,'#5f9fd8');},
 rockform(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  const g=ctx.createLinearGradient(x,y-34,x,y+h);
  g.addColorStop(0,'#c9b490');g.addColorStop(1,'#9a8668');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(x,y+h);ctx.quadraticCurveTo(x+w*0.15,y-26,x+w*0.42,y-18);
  ctx.quadraticCurveTo(x+w*0.6,y-14,x+w*0.7,y-32);ctx.quadraticCurveTo(x+w*0.92,y-42,x+w,y+h);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.arc(x+w*0.76,y-26,6,0,7);ctx.fill();
  drawRoofSign(x+w/2,y+h+20,b.label,'#8a7458');},
 archbridge(b){const x=b.x,y=b.y,w=b.w,h=b.h;
  ctx.fillStyle='#e8e8e2';ctx.fillRect(x-12,y+8,w+24,10);
  ctx.strokeStyle='#d0d0c8';ctx.lineWidth=3;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(x+w*(i+0.5)/4,y+18,w/8-5,0,Math.PI);ctx.stroke();}
  ctx.strokeStyle='#c8c8c0';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x-12,y+6);ctx.lineTo(x+w+12,y+6);ctx.stroke();
  for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(x-12+(w+24)*i/8,y+6);ctx.lineTo(x-12+(w+24)*i/8,y+10);ctx.stroke();}
  drawRoofSign(x+w/2,y-10,b.label,'#7a8a9a');},
 canoe(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2,cy2=y+h-8;bShadow(x,y+h,w);
  ctx.fillStyle='#f5f0e0';
  ctx.beginPath();ctx.moveTo(cx2-34,cy2-6);ctx.quadraticCurveTo(cx2-42,cy2-28,cx2-30,cy2-32);
  ctx.quadraticCurveTo(cx2,cy2,cx2+30,cy2-32);ctx.quadraticCurveTo(cx2+42,cy2-28,cx2+34,cy2-6);
  ctx.quadraticCurveTo(cx2,cy2+10,cx2-34,cy2-6);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#c94f43';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#c94f43';
  for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(cx2-14+i*14,cy2-9,4,0,7);ctx.fill();}
  ctx.fillStyle='#2f2f2f';
  ctx.beginPath();ctx.moveTo(cx2-26,cy2-4);ctx.lineTo(cx2-19,cy2-14);ctx.lineTo(cx2-12,cy2-4);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(cx2+12,cy2-4);ctx.lineTo(cx2+19,cy2-14);ctx.lineTo(cx2+26,cy2-4);ctx.closePath();ctx.fill();
  drawRoofSign(cx2,y-12,b.label,'#c94f43');},
 cablecar(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#f3ead1';rr(x,y-20,w,h+20,6);ctx.fill();
  ctx.fillStyle='#c9500f';ctx.beginPath();ctx.moveTo(x-8,y-16);ctx.lineTo(cx2,y-40);ctx.lineTo(x+w+8,y-16);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#6a5a4a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx2,y-40);ctx.lineTo(cx2,y-66);ctx.stroke();
  ctx.fillStyle='#6a5a4a';ctx.beginPath();ctx.arc(cx2,y-66,6,0,7);ctx.fill();
  ctx.fillStyle='#7a4a22';rr(cx2-16,y+h-38,32,38,5);ctx.fill();
  drawRoofSign(cx2,y-80,'🚡 '+b.label,'#c9500f');},
};
const BUILDINGS=[];
function addBuild(t,tx,ty,tw,th,label,extra){
  const b={t,tx,ty,tw,th,label,x:tx*TILE,y:ty*TILE,w:tw*TILE,h:th*TILE,...extra};
  BUILDINGS.push(b);return b;}
const SIZE={t101:[4,3],shop:[5,3],market:[8,2],teahouse:[4,3],queenhead:[2,2],lantern:[3,2],
  hotspring:[4,3],gate:[4,2],opera:[6,3],windmill:[2,2],buddha:[3,3],temple:[6,4],fort:[5,4],
  redtower:[4,3],pagodas:[6,3],tower85:[3,3],gianttree:[3,3],peak:[2,2],lighthouse:[2,2],
  balloon:[4,3],weir:[4,3],station:[5,3],harbor:[3,3],house:[3,2],
  oldstreet:[6,3],highheel:[3,3],rockform:[4,2],archbridge:[6,2],canoe:[3,2],cablecar:[3,3]};
LANDMARKS.forEach(L=>{const [tw,th]=SIZE[L.t];addBuild(L.t,L.tx,L.ty,tw,th,L.label,{lines:L.lines});});
STATIONS.forEach(s=>addBuild('station',s.tx,s.ty,5,3,s.n));
HARBORS.forEach(h2=>addBuild('harbor',h2.tx,h2.ty,3,3,h2.n,{routes:h2.routes}));
CABLECARS.forEach(c=>{
  addBuild('cablecar',Math.round(c.a[0])-1,Math.round(c.a[1])-1,3,3,c.a[2],{line:c,end:'a'});
  addBuild('cablecar',Math.round(c.b[0])-1,Math.round(c.b[1])-1,3,3,c.b[2],{line:c,end:'b'});
});
// 三合院民宅（各鄉鎮周邊）
{ rs=SEED+7;
  const offs=[[-7,-2],[6,-3],[-5,4],[7,3]];
  for(const tw of TOWNS){ let placed=0;
    for(const [ox,oy] of offs){ if(placed>=2)break;
      const hx=tw.tx+ox+Math.floor(rand()*3)-1, hy=tw.ty+oy+Math.floor(rand()*3)-1;
      let ok=true;
      for(let dy=-1;dy<=2;dy++)for(let dx=-1;dx<=3;dx++)if(T(hx+dx,hy+dy)!==GRASS)ok=false;
      for(const b of BUILDINGS)if(Math.abs(b.tx-hx)<6&&Math.abs(b.ty-hy)<5)ok=false;
      if(ok){addBuild('house',hx,hy,3,2,'');placed++;}
    }}}

/* ================= 世界物件 ================= */
const trees=[],rocks=[],weeds=[],flowers=[],drops=[],bugs=[],digs=[],teaBushes=[],cacti=[],strawberries=[],lamps=[],lanterns=[];
let bees=null;
function nearBuilding(tx,ty){ return BUILDINGS.some(b=>tx>=b.tx-1&&tx<=b.tx+b.tw&&ty>=b.ty-2&&ty<=b.ty+b.th); }
function inRectA(tx,ty,r){return tx>=r.x0&&tx<=r.x1&&ty>=r.y0&&ty<=r.y1;}
function fruitOf(tx,ty){
  if(inRectA(tx,ty,CACTUS_AREA))return null;
  const r=hsh(tx*3,ty*7);
  if(ty<MH*0.231)return '橘子';
  if(tx>MW*0.525&&ty>MH*0.212&&ty<MH*0.654)return '釋迦';
  if(ty<MH*0.519)return '香蕉';
  return r<0.5?'芒果':'蓮霧';
}
function genWorld(){
  rs=SEED;
  for(let ty=2;ty<MH-2;ty++)for(let tx=2;tx<MW-2;tx++){
    const t=T(tx,ty);
    if(t!==GRASS&&t!==HIGH&&t!==SAND)continue;
    const nearPath=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const q=T(tx+dx,ty+dy);return q===PATH||q===PLAZA;});
    if(nearPath)continue;
    if(t===SAND){
      if(rand()<0.006&&trees.length<1450&&!nearBuilding(tx,ty))
        trees.push({x:(tx+0.5)*TILE,y:(ty+0.8)*TILE,kind:'palm',fruit:'椰子',has:true,regrow:0,shake:0});
      continue;}
    const cluster=vnoise(tx*0.07+7,ty*0.07+3);
    if(cluster>0.66&&rand()<0.22&&trees.length<1400&&!nearBuilding(tx,ty)){
      if(t===HIGH){ const peach=rand()<0.3;
        trees.push({x:(tx+0.5)*TILE,y:(ty+0.8)*TILE,kind:peach?'fruit':'pine',
          fruit:peach?'水蜜桃':null,has:true,regrow:0,shake:0});}
      else{ const f=fruitOf(tx,ty);
        if(f)trees.push({x:(tx+0.5)*TILE,y:(ty+0.8)*TILE,kind:'fruit',fruit:f,has:true,regrow:0,shake:0});}
      continue;}
    if(rand()<0.005&&rocks.length<170&&!nearBuilding(tx,ty)){rocks.push({x:(tx+0.5)*TILE,y:(ty+0.6)*TILE,hit:0});continue;}
    if(rand()<0.0018&&weeds.length<240){weeds.push({x:(tx+0.5)*TILE,y:(ty+0.5)*TILE});continue;}
    if(rand()<0.006&&flowers.length<650)flowers.push({x:(tx+0.5)*TILE,y:(ty+0.5)*TILE,
      c:['#f26d7d','#f9c74f','#fff','#c77dff','#ff9e50'][Math.floor(rand()*5)]});
  }
  // 茶園
  for(const [x0,y0,x1,y1] of TEA_PATCHES)
    for(let ty=y0;ty<=y1;ty+=2)for(let tx=x0;tx<=x1;tx++){
      const t=T(tx,ty); if(t===GRASS||t===HIGH)
        teaBushes.push({x:(tx+0.5)*TILE,y:(ty+0.5)*TILE,ready:true,t:0});}
  // 澎湖仙人掌
  for(let ty=CACTUS_AREA.y0;ty<=CACTUS_AREA.y1&&cacti.length<30;ty++)
    for(let tx=CACTUS_AREA.x0;tx<=CACTUS_AREA.x1&&cacti.length<30;tx++)
      if(T(tx,ty)===GRASS&&hsh(tx*5,ty*3)>0.8&&!nearBuilding(tx,ty))
        cacti.push({x:(tx+0.5)*TILE,y:(ty+0.5)*TILE,ready:true,t:0});
  // 大湖草莓園
  for(let ty=STRAWBERRY_AREA[1];ty<=STRAWBERRY_AREA[3];ty+=2)
    for(let tx=STRAWBERRY_AREA[0];tx<=STRAWBERRY_AREA[2];tx++){
      const t=T(tx,ty); if(t===GRASS||t===FIELD)
        strawberries.push({x:(tx+0.5)*TILE,y:(ty+0.5)*TILE,ready:true,t:0});}
  // 花海（金針花、花園）
  for(const ff of FLOWER_FIELDS){
    const [x0,y0,x1,y1,col]=ff;
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
      const t=T(tx,ty); if(t!==GRASS&&t!==HIGH&&t!==FIELD)continue;
      for(let k=0;k<2;k++)flowers.push({x:(tx+hsh(tx+k,ty)*0.9+0.05)*TILE,
        y:(ty+hsh(tx,ty+k*3)*0.9+0.05)*TILE,c:col});}}
  // 路燈（市鎮）
  for(const tw of TOWNS){
    for(const [ox,oy] of [[-2,2],[2,-2]]){
      const t=T(tw.tx+ox,tw.ty+oy);
      if(t===PATH||t===PLAZA)lamps.push({x:(tw.tx+ox+0.5)*TILE,y:(tw.ty+oy+0.5)*TILE});}}
}

/* ================= 乘坐系統（火車 / 纜車） ================= */
function railPath(i0,i1){ // 環島鐵路：取較短方向的節點序列
  const N=RAILS.length-1; // 首尾同點（閉環）
  const segLen=[]; let tot=0;
  for(let i=0;i<N;i++){segLen.push(Math.hypot(RAILS[(i+1)%N][0]-RAILS[i][0],RAILS[(i+1)%N][1]-RAILS[i][1]));tot+=segLen[i];}
  let fwd=0; for(let i=i0;i!==i1;i=(i+1)%N)fwd+=segLen[i];
  const pts=[];
  if(fwd<=tot-fwd){ for(let i=i0;;i=(i+1)%N){pts.push(RAILS[i]);if(i===i1)break;} }
  else { for(let i=i0;;i=(i-1+N)%N){pts.push(RAILS[i]);if(i===i1)break;} }
  return pts.map(([x,y])=>({x:x*TILE,y:y*TILE}));
}
function startRide(pts,kind,speed,onEnd){
  let len=0; const segs=[];
  for(let i=0;i<pts.length-1;i++){const l=dist(pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y);segs.push(l);len+=l;}
  player.riding={pts,segs,len:len||1,d:0,kind,speed,onEnd};
  player.fishing=null; player.sailing=false; ui=null; menu=null;
}

/* ================= 玩家 / NPC ================= */
const spawn=findWalkSafe(294,70); // 台北車站前
const player={x:spawn.x,y:spawn.y,face:0,walk:0,moving:false,tool:0,
  buffSpd:0,buffLuck:0,swing:0,show:null,fishing:null,name:'小島民',shirt:'#e74c3c',
  boat:false,sailing:false};
const TOOLS=[{n:'手',e:'🖐️'},{n:'捕蟲網',e:'🦋'},{n:'釣竿',e:'🎣'},{n:'鏟子',e:'⛏️'},{n:'斧頭',e:'🪓'}];
const DIRV=[[0,1],[-1,0],[1,0],[0,-1]];
let money=800, inv={}, dex={}, questState={};
function addItem(n,c){inv[n]=(inv[n]||0)+(c||1);}
function caught(n,verb){ addItem(n); dex[n]=(dex[n]||0)+1;
  const it=ITEMS[n]; player.show={emoji:it.e,text:verb+'了 '+n+'！',t:2.2};
  sfx('jingle'); save(); }
let NPCS=[];
function genNpcs(){ NPCS=NPC_DEFS.map(d=>{ const p=findWalkSafe(d.tx,d.ty);
  return {name:d.name,species:d.species,x:p.x,y:p.y,hx:p.x,hy:p.y,homeR:d.homeR*TILE,
    face:0,walk:0,vx:0,vy:0,ai:0,lines:d.lines,pal:d.pal,quest:d.quest!=null?d.quest:null};});}

/* ================= 碰撞 ================= */
function solidAt(px,py){
  const t=T(Math.floor(px/TILE),Math.floor(py/TILE));
  if(!WALKABLE[t])return true;
  for(const b of BUILDINGS)
    if(px>b.x-4&&px<b.x+b.w+4&&py>b.y-4&&py<b.y+b.h)return true;
  return false;
}
function hitObstacle(px,py){
  if(solidAt(px-12,py)||solidAt(px+12,py)||solidAt(px,py-8)||solidAt(px,py+10))return true;
  for(const tr of trees)if(dist(px,py,tr.x,tr.y-4)<20)return true;
  for(const r of rocks)if(dist(px,py,r.x,r.y)<24)return true;
  return false;
}
function waterAt(px,py){const t=T(Math.floor(px/TILE),Math.floor(py/TILE));return t===SEA||t===LAKE;}
function hitWater(px,py){ // 船隻碰撞：四角都要在水上，且不可駛出地圖
  if(px<24||py<24||px>MW*TILE-24||py>MH*TILE-24)return true;
  return !(waterAt(px-14,py)&&waterAt(px+14,py)&&waterAt(px,py-10)&&waterAt(px,py+12));}
function moveActor(a,dx,dy,spd,dt){
  const L=Math.hypot(dx,dy); if(!L)return false;
  dx/=L;dy/=L;
  const test=a.sailing?hitWater:hitObstacle;
  const nx=a.x+dx*spd*dt, ny=a.y+dy*spd*dt; let moved=false;
  if(!test(nx,a.y)){a.x=nx;moved=true;}
  if(!test(a.x,ny)){a.y=ny;moved=true;}
  if(Math.abs(dx)>Math.abs(dy))a.face=dx<0?1:2;else a.face=dy<0?3:0;
  return moved;
}

/* ================= UI 狀態 ================= */
let ui=null, menu=null, dialog=null, toasts=[], banner=null, lastRegion='', uiHits=[], flash=0;
let zoom=1, zoomT=1;
function camPos(){ const VWz=VW/zoom, VHz=VH/zoom;
  return {cx:clamp(player.x-VWz/2,0,MW*TILE-VWz),cy:clamp(player.y-VHz/2,0,MH*TILE-VHz),VWz,VHz};}
function toast(t){toasts.push({t,life:3});}
function dlg(name,lines,onDone){ ui='dialog';
  dialog={name,lines:lines.map(l=>l.replace(/\{name\}/g,player.name)),i:0,ch:0,onDone,npc:null}; }
function openMenu(title,opts){ui='menu';menu={title,opts,sel:0};}
function sellValue(filter){ let v=0;
  for(const n in inv){const it=ITEMS[n];if(!it)continue;
    if(!filter||filter.includes(it.cat))v+=it.p*inv[n];} return v;}
function doSell(filter){ let v=0;
  for(const n of Object.keys(inv)){const it=ITEMS[n];if(!it)continue;
    if(!filter||filter.includes(it.cat)){v+=it.p*inv[n];delete inv[n];}}
  if(v>0){money+=v;sfx('cash');toast('💰 賣出獲得 '+fmt(v)+' 元！');save();}
  ui=null;}
function openShop(){
  const all=sellValue(null), fb=sellValue(['fish','bug']);
  openMenu('阿吉雜貨店：歡迎光臨！要做什麼呢？',[
    {label:'全部賣掉（'+fmt(all)+'元）',cb(){ all>0?doSell(null):dlg('雜貨店',['你身上沒有可以賣的東西喔！汪！']);}},
    {label:'只賣漁獲和昆蟲（'+fmt(fb)+'元）',cb(){ fb>0?doSell(['fish','bug']):dlg('雜貨店',['咦？你還沒抓到魚或蟲吧！']);}},
    {label:'離開',cb(){ui=null;}}]);
}
/* ---------- 任務 ---------- */
function questMenuFor(npc){
  const qi=npc.quest, q=QUESTS[qi], st=questState[qi]||0;
  if(st===0){
    openMenu(npc.name+'：'+q.ask,[
      {label:'接受任務！（獎勵 '+fmt(q.reward)+'元）',cb(){questState[qi]=1;save();
        toast('📋 接受了 '+npc.name+' 的任務！按 J 查看');sfx('blip');}},
      {label:'以後再說',cb(){ui=null;}}]);
    return true;}
  if(st===1){
    const have=inv[q.need]||0;
    if(have>=q.n){
      inv[q.need]-=q.n; if(inv[q.need]<=0)delete inv[q.need];
      money+=q.reward; questState[qi]=2; sfx('jingle'); save();
      dlg(npc.name,[q.done,'（獲得了 '+fmt(q.reward)+' 元！）']);
      toast('✅ 完成任務！+'+fmt(q.reward)+'元');
    } else dlg(npc.name,[q.ask,'（目前 '+ITEMS[q.need].e+' '+q.need+'：'+have+'／'+q.n+'）']);
    return true;}
  return false; // 已完成 → 一般對話
}
function talkTo(npc){ if(!npc)return;
  if(npc.name==='阿吉'){openShop();return;}
  const dx=player.x-npc.x,dy=player.y-npc.y;
  npc.face=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);
  if(npc.quest!=null&&questMenuFor(npc))return;
  const line=npc.lines[Math.floor(Math.random()*npc.lines.length)];
  ui='dialog';
  dialog={name:npc.name,lines:[line.replace(/\{name\}/g,player.name)],i:0,ch:0,onDone:null,npc};
}

/* ================= 建築互動 ================= */
function buildAct(b){
  const L={t101(){ dlg('觀景台',b.lines,()=>{ui='map';}); },
   shop(){openShop();},
   market(){ openMenu('🏮 '+b.label+'：想吃點什麼？',[
     {label:'珍珠奶茶（80元）移動加速60秒',cb(){buyFood(80,()=>{player.buffSpd=60;toast('🧋 移動速度UP 60秒！');});}},
     {label:'香雞排（100元）稀有度UP 90秒',cb(){buyFood(100,()=>{player.buffLuck=90;toast('🍗 稀有度UP 90秒！');});}},
     {label:'芒果冰（120元）兩種效果小UP',cb(){buyFood(120,()=>{player.buffSpd=Math.max(player.buffSpd,30);player.buffLuck=Math.max(player.buffLuck,30);toast('🍧 透心涼！');});}},
     {label:'離開',cb(){ui=null;}}]);},
   temple(){ openMenu(b.label+'：要參拜媽祖婆嗎？',[
     {label:'參拜（香油錢 100元）',cb(){ if(money>=100){money-=100;sfx('cash');save();
         dlg(b.label,['你誠心地擲了筊……','「'+FORTUNES[Math.floor(Math.random()*FORTUNES.length)]+'」']);}
       else dlg(b.label,['身上的錢不夠呢…','媽祖婆微笑著說：心誠則靈，保重身體喔。']);}},
     {label:'離開',cb(){ui=null;}}]);},
   station(){ const here=STATIONS.find(s=>s.n===b.label);
     const opts=STATIONS.filter(s=>s.n!==b.label).map(s=>{
       const fee=Math.round((50+dist(here.tx,here.ty,s.tx,s.ty)*1.3)/10)*10;
       return {label:s.n.replace('車站','')+'（'+fmt(fee)+'元）',cb(){
         if(money<fee){dlg(b.label,['車票錢不夠喔！','去賣點東西再來吧。']);return;}
         money-=fee; sfx('train');
         startRide(railPath(here.railIdx,s.railIdx),'train',920,()=>{
           const p=findWalkSafe(s.tx+2,s.ty+4);
           player.x=p.x;player.y=p.y;
           toast('🚉 抵達 '+s.n+'！'); save();});
         toast('🚂 火車出發！沿著鐵軌前進…（點擊/空白鍵加速）');}};});
     opts.push({label:'離開',cb(){ui=null;}});
     openMenu('🚉 '+b.label+'：要搭車去哪裡呢？',opts);},
   cablecar(){ const c=b.line, from=b.end==='a'?c.a:c.b, to=b.end==='a'?c.b:c.a;
     openMenu('🚡 '+c.n+'・'+from[2]+'：要搭纜車嗎？',[
       {label:'搭到 '+to[2]+'（'+c.fee+'元）',cb(){
         if(money<c.fee){dlg(c.n,['搭一次 '+c.fee+' 元喔。']);return;}
         money-=c.fee; sfx('chime'); save();
         startRide([{x:from[0]*TILE,y:from[1]*TILE-40},{x:to[0]*TILE,y:to[1]*TILE-40}],'gondola',180,()=>{
           const p=findWalkSafe(Math.round(to[0]),Math.round(to[1])+3);
           player.x=p.x;player.y=p.y;toast('🚡 抵達 '+to[2]+'！');save();});
         toast('🚡 纜車出發！從空中看風景～');}},
       {label:'不搭了',cb(){ui=null;}}]);},
   harbor(){ const opts=[];
     if(!player.boat)opts.push({label:'買一艘小船（3,000元・永久）',cb(){
       if(money>=3000){money-=3000;player.boat=true;sfx('cash');save();
         dlg(b.label,['小船到手！⛵','站在岸邊面向大海按空白鍵就能出海，','靠近沙灘或淺灘再按空白鍵就能上岸囉！']);}
       else dlg(b.label,['一艘船要 3,000 元…','努力賺錢再來吧！釣魚和做任務都很好賺喔。']);}});
     if(player.boat)opts.push({label:'出海！⛵',cb(){ const w=findWater(b.tx+1,b.ty+1);
       if(w){player.x=w.x;player.y=w.y;player.sailing=true;player.fishing=null;
         sfx('splash');toast('出海囉！⛵ 在船上也可以釣魚（深海魚！）');ui=null;save();}
       else dlg(b.label,['附近找不到可以下水的地方…']);}});
     for(const [to,fee] of (b.routes||[]))opts.push({label:'渡輪 → '+to+'（'+fmt(fee)+'元）',cb(){
       if(money<fee){dlg(b.label,['船票錢不夠喔！']);return;}
       const target=HARBORS.find(h2=>h2.n===to); if(!target)return;
       money-=fee; sfx('train'); flash=1;
       const p=findWalkSafe(target.tx,target.ty+3);
       player.x=p.x;player.y=p.y;player.sailing=false;player.fishing=null;
       toast('⛴️ 抵達 '+to+'！'); save();}});
     opts.push({label:'離開',cb(){ui=null;}});
     openMenu('⚓ '+b.label,opts);},
   lantern(){ openMenu('🏮 天燈小舖：要放一盞天燈嗎？',[
     {label:'放天燈許願（50元）',cb(){ if(money<50){dlg('天燈小舖',['錢不夠喔，天燈一盞 50 元。']);return;}
       money-=50; sfx('chime'); save(); ui=null;
       lanterns.push({x:player.x,y:player.y-40,t:0});
       const wishes=['希望天天開心！','希望釣到超大的魚！','希望世界和平！','希望發大財！','希望朋友們都健康平安！'];
       toast('🏮 「'+wishes[Math.floor(Math.random()*wishes.length)]+'」天燈飛起來了…');}},
     {label:'不用了',cb(){ui=null;}}]);},
   hotspring(){ openMenu('♨️ '+b.label+'：要泡個湯嗎？',[
     {label:'泡湯（50元）速度+運氣UP 60秒',cb(){ if(money<50){dlg(b.label,['泡湯一次 50 元喔。']);return;}
       money-=50; sfx('chime'); save(); ui=null;
       player.buffSpd=Math.max(player.buffSpd,60);player.buffLuck=Math.max(player.buffLuck,60);
       toast('♨️ 泡完湯全身暖呼呼！速度＆運氣UP 60秒');}},
     {label:'不用了',cb(){ui=null;}}]);},
   balloon(){ openMenu('🎈 '+b.label+'：要搭熱氣球嗎？',[
     {label:'搭熱氣球升空鳥瞰（100元）',cb(){ if(money<100){dlg(b.label,['搭一次 100 元喔。']);return;}
       money-=100; sfx('chime'); save(); ui=null;
       player.balloonRide={t:0,dur:16,cx:player.x,cy:player.y};
       player.fishing=null;
       toast('🎈 熱氣球緩緩升空…鳥瞰花東縱谷！');}},
     {label:'不用了',cb(){ui=null;}}]);},
  };
  if(L[b.t]){L[b.t]();return true;}
  if(b.lines){dlg(b.label,b.lines);return true;}
  return false;
}
function actNearestBuilding(){
  let best=null,bd=1e9;
  for(const b of BUILDINGS){ if(b.t==='house')continue;
    const bx=b.x+b.w/2, by=b.y+b.h;
    const d=dist(player.x,player.y,bx,by);
    if(d<b.w/2+80&&d<bd){bd=d;best=b;}}
  if(best)return buildAct(best);
  return false;
}
function buyFood(price,eff){ if(money>=price){money-=price;sfx('cash');eff();ui=null;save();}
  else dlg('夜市',['哎呀，錢不夠喔！','去賣點魚或水果再來吧～']);}

/* ================= 時間 / 天氣 / 區域 ================= */
function hourNow(){const d=new Date();return d.getHours()+d.getMinutes()/60;}
function isNight(){const h=hourNow();return h>=19||h<5;}
function isRainy(){return hsh(Math.floor(Date.now()/1800000)%99999,3)>0.72;}
function skyTint(){ const h=hourNow();
  const K=[[0,15,25,60,.50],[5,15,25,60,.50],[6.5,255,170,110,.16],[8,0,0,0,0],
           [16.5,0,0,0,0],[18.2,255,150,80,.20],[19.8,15,25,60,.50],[24,15,25,60,.50]];
  for(let i=0;i<K.length-1;i++){ if(h>=K[i][0]&&h<=K[i+1][0]){
    const t=(h-K[i][0])/(K[i+1][0]-K[i][0]||1), L=(a,b)=>a+(b-a)*t;
    return [L(K[i][1],K[i+1][1]),L(K[i][2],K[i+1][2]),L(K[i][3],K[i+1][3]),L(K[i][4],K[i+1][4])];}}
  return [0,0,0,0];}
function nearestTown(tx,ty){ let best=null,bd=1e9;
  for(const t of TOWNS){const d=(t.tx-tx)**2+(t.ty-ty)**2;if(d<bd){bd=d;best=t;}}
  return {t:best,d:Math.sqrt(bd)};}
function regionOf(){ const tx=player.x/TILE, ty=player.y/TILE;
  const tile=T(Math.floor(tx),Math.floor(ty));
  const nt=nearestTown(tx,ty);
  if(player.sailing){ if(tile===LAKE)return '日月潭';
    return nt.t.c+'外海';}
  if(tile===LAKE||dist(tx,ty,LAKEC.x,LAKEC.y)<7)return '南投・日月潭';
  if((tile===HIGH||tile===MT)&&nt.d>16)return '中央山脈';
  return nt.t.c+'・'+nt.t.n;}

/* ================= 互動 ================= */
function frontPoint(d){ d=d||44; return {x:player.x+DIRV[player.face][0]*d, y:player.y+DIRV[player.face][1]*d}; }
function frontTile(mult){ const p=frontPoint(mult*TILE);
  const tx=Math.floor(p.x/TILE), ty=Math.floor(p.y/TILE);
  return {t:T(tx,ty), x:(tx+0.5)*TILE, y:(ty+0.5)*TILE}; }
function pickWeighted(list){ let s=0; for(const e of list)s+=e.w2;
  let r=Math.random()*s; for(const e of list){r-=e.w2;if(r<=0)return e;} return list[0];}
function tryFish(){
  if(player.fishing){ const f=player.fishing;
    if(f.state==='bite'){
      const lake=T(Math.floor(f.bx/TILE),Math.floor(f.by/TILE))===LAKE;
      const night=isNight();
      const cands=FISHES.filter(x=>{
        if(x.loc==='any')return true;
        if(lake)return x.loc==='lake';
        if(x.loc==='sea')return true;
        if(x.loc==='deep')return player.sailing;
        return false;})
        .map(x=>({...x,w2:x.w*(x.night&&night?3:1)*(player.buffLuck>0&&x.p>=600?2.5:1)}));
      const got=pickWeighted(cands);
      player.fishing=null; caught(got.n,'釣到');
    } else { player.fishing=null; toast('收竿了。'); }
    return true;
  }
  for(const d of [1.2,2.2]){ const p=frontPoint(d*TILE);
    const t=T(Math.floor(p.x/TILE),Math.floor(p.y/TILE));
    if(t===SEA||t===LAKE){ const bx=(Math.floor(p.x/TILE)+0.5)*TILE, by=(Math.floor(p.y/TILE)+0.5)*TILE;
      let bt=3+Math.random()*9; if(isRainy())bt*=0.6;
      player.fishing={state:'wait',t:0,biteAt:bt,bx,by}; sfx('splash'); return true;} }
  toast('要面向水邊才能釣魚喔。'); return true;
}
function tryNet(){ if(player.sailing){toast('船上抓不到蟲喔！');return true;}
  player.swing=0.28; sfx('swing');
  const p=frontPoint(40);
  for(let i=bugs.length-1;i>=0;i--){ const b=bugs[i];
    if(dist(b.x,b.y,p.x,p.y)<62||dist(b.x,b.y,player.x,player.y)<48){
      bugs.splice(i,1); caught(b.spec.n,'抓到'); return true;} }
  return true;}
function tryDig(){ const p=frontPoint(30);
  for(let i=digs.length-1;i>=0;i--){ const d=digs[i];
    if(dist(d.x,d.y,p.x,p.y)<42||dist(d.x,d.y,player.x,player.y)<36){
      digs.splice(i,1); sfx('dig');
      const r=Math.random();
      if(r<0.25)caught('化石','挖到');
      else if(r<0.45)caught('陶器','挖到');
      else if(r<0.62)caught('礦石','挖到');
      else if(r<0.82){const v=300+Math.floor(Math.random()*1500);money+=v;sfx('cash');
        toast('💰 挖到錢袋！獲得 '+fmt(v)+' 元');save();}
      else caught('蕃薯','挖到');
      return true;} }
  toast('這裡沒有可以挖的痕跡。附近找找 ✕ 記號吧。'); return true;}
function tryAxe(){ const p=frontPoint(40);
  for(const r of rocks){ if(dist(r.x,r.y,p.x,p.y)<50){ r.hit=0.3; sfx('thud');
    const q=Math.random();
    if(q<0.5)caught('礦石','敲出');
    else if(q<0.8){const v=100+Math.floor(Math.random()*200);money+=v;sfx('cash');toast('💰 敲出 '+v+' 元！');save();}
    else toast('鏘…什麼都沒有。');
    return true;} }
  for(const tr of trees){ if(dist(tr.x,tr.y-4,p.x,p.y)<50){ tr.shake=0.4;
    if(Math.random()<0.4)caught('木材','砍下'); else toast('咚…只削下一點樹皮。');
    return true;} }
  toast('附近沒有岩石或樹木。'); return true;}
function tryShake(tr){ tr.shake=0.5;
  if(tr.kind==='pine'){toast('松針掉了一地…沒有果實。');return;}
  if(tr.has&&tr.fruit){ tr.has=false; tr.regrow=180;
    for(let i=0;i<3;i++)drops.push({x:tr.x-30+i*30,y:tr.y+14+((i%2)*14),item:tr.fruit});
    sfx('pop');
  } else if(Math.random()<0.08&&!bees){ bees={x:tr.x,y:tr.y-40,t:4}; toast('🐝 有蜂窩掉下來了！快跑！'); sfx('sad');
  } else toast('搖了搖…什麼都沒掉下來。');
}
function interact(){
  if(ui)return;
  if(player.riding){player.riding.speed=Math.max(player.riding.speed,2400);return;}
  if(player.balloonRide)return;
  const p=frontPoint(44);
  if(!player.sailing)
    for(const n of NPCS) if(dist(n.x,n.y,p.x,p.y)<52||dist(n.x,n.y,player.x,player.y)<50){talkTo(n);return;}
  if(player.sailing){
    if(player.fishing){tryFish();return;} // 咬餌中優先收竿
    const ft=frontTile(1.2);
    if(WALKABLE[ft.t]&&!hitObstacle(ft.x,ft.y)){ // 面向岸邊：任何工具都能上岸
      player.x=ft.x;player.y=ft.y;player.sailing=false;sfx('pop');toast('上岸了！');return;}
    if(player.tool===2){tryFish();return;}
    if(actNearestBuilding())return;
    toast('這裡不能上岸，找找沙灘或平緩的岸邊吧。');return;}
  if(player.tool===2){tryFish();return;}
  if(player.fishing){player.fishing=null;toast('收竿了。');}
  if(player.tool===1){tryNet();return;}
  if(player.tool===3){tryDig();return;}
  if(player.tool===4){tryAxe();return;}
  // 徒手
  if(actNearestBuilding())return;
  for(const tr of trees) if(dist(tr.x,tr.y-4,p.x,p.y)<52||dist(tr.x,tr.y-4,player.x,player.y)<50){tryShake(tr);return;}
  for(const tb of teaBushes) if(tb.ready&&dist(tb.x,tb.y,player.x,player.y)<50){
    tb.ready=false;tb.t=120;caught('茶葉','採到');return;}
  for(const sb of strawberries) if(sb.ready&&dist(sb.x,sb.y,player.x,player.y)<50){
    sb.ready=false;sb.t=150;caught('草莓','採到');return;}
  for(const ca of cacti) if(ca.ready&&dist(ca.x,ca.y,player.x,player.y)<50){
    ca.ready=false;ca.t=180;
    if(Math.random()<0.12){toast('哎呀！被仙人掌刺到了！好痛！');sfx('sad');}
    else caught('仙人掌果','摘到');return;}
  for(let i=weeds.length-1;i>=0;i--){ const w=weeds[i];
    if(dist(w.x,w.y,player.x,player.y)<46){weeds.splice(i,1);addItem('雜草');sfx('pop');
      player.show={emoji:'🌿',text:'拔掉了雜草',t:1.2};save();return;} }
  // 上船
  if(player.boat){ const ft=frontTile(1.3);
    if(ft.t===SEA||ft.t===LAKE){player.x=ft.x;player.y=ft.y;player.sailing=true;
      sfx('splash');toast('出海囉！⛵');return;} }
}

/* ================= 輸入 ================= */
const keys={};
let started=false;
addEventListener('keydown',e=>{
  if(!started)return;
  const c=e.code;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(c))e.preventDefault();
  if(e.repeat&&(c==='Space'||c==='Enter'||c==='KeyE'))return; // 長按不重複觸發互動
  keys[c]=true;
  if(ui==='dialog'){
    if(c==='Space'||c==='Enter'||c==='KeyE'){
      const d=dialog, full=d.lines[d.i];
      if(d.ch<full.length)d.ch=full.length;
      else if(d.i<d.lines.length-1){d.i++;d.ch=0;}
      else {ui=null;const f=d.onDone;dialog=null;if(f)f();}
    } else if(c==='Escape'){ui=null;dialog=null;}
    return;
  }
  if(ui==='menu'){
    if(c==='ArrowUp'||c==='KeyW')menu.sel=(menu.sel+menu.opts.length-1)%menu.opts.length;
    else if(c==='ArrowDown'||c==='KeyS')menu.sel=(menu.sel+1)%menu.opts.length;
    else if(c==='Space'||c==='Enter'||c==='KeyE'){const o=menu.opts[menu.sel];ui=null;o.cb();}
    else if(c==='Escape')ui=null;
    sfx('blip');return;
  }
  if(ui){
    if(c==='Escape'||(c==='KeyB'&&ui==='bag')||(c==='KeyM'&&ui==='map')||(c==='KeyP'&&ui==='dex')
      ||(c==='KeyH'&&ui==='help')||(c==='KeyJ'&&ui==='quest'))ui=null;
    return;
  }
  if(c==='Space'||c==='KeyE')interact();
  else if(c>='Digit1'&&c<='Digit5'){player.tool=+c.slice(5)-1;sfx('blip');}
  else if(c==='KeyB')ui='bag';
  else if(c==='KeyM')ui='map';
  else if(c==='KeyP')ui='dex';
  else if(c==='KeyH')ui='help';
  else if(c==='KeyJ')ui='quest';
  else if(c==='KeyN'){musicOn=!musicOn;toast(musicOn?'🎵 音樂開啟':'🔇 音樂關閉');save();}
});
addEventListener('keyup',e=>keys[e.code]=false);

/* ---------- 觸控 / 滑鼠（虛擬搖桿、點按移動、雙指縮放） ---------- */
let touchUI=('ontouchstart' in window)||navigator.maxTouchPoints>0;
const pointers=new Map();
let joy=null, moveHold=null, pinch0=null, tapInfo=null;
cv.style.touchAction='none';
cv.addEventListener('contextmenu',e=>e.preventDefault());
function uiHitAt(mx,my){ for(let i=uiHits.length-1;i>=0;i--){const h2=uiHits[i];
  if(mx>=h2.x&&mx<=h2.x+h2.w&&my>=h2.y&&my<=h2.y+h2.h)return h2;} return null;}
function advanceDialog(){ if(!dialog)return; const full=dialog.lines[dialog.i];
  if(dialog.ch<full.length)dialog.ch=full.length;
  else if(dialog.i<dialog.lines.length-1){dialog.i++;dialog.ch=0;}
  else{ui=null;const f=dialog.onDone;dialog=null;if(f)f();}}
cv.addEventListener('pointerdown',e=>{
  if(!started)return;
  if(e.pointerType==='touch')touchUI=true;
  try{cv.setPointerCapture(e.pointerId);}catch(err){}
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){ const ps=[...pointers.values()];
    pinch0={d:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)||1,z:zoomT}; joy=null; moveHold=null; return;}
  const mx=e.clientX,my=e.clientY;
  const hit=uiHitAt(mx,my);
  if(hit){hit.cb();return;}
  if(ui==='dialog'){advanceDialog();return;}
  if(ui)return;
  if(player.riding){ player.riding.speed=Math.max(player.riding.speed,2400); return;}
  if(player.balloonRide)return;
  if(touchUI&&mx<VW*0.45&&my>VH*0.35){ joy={id:e.pointerId,bx:mx,by:my,dx:0,dy:0}; return;}
  moveHold={id:e.pointerId,x:mx,y:my};
  tapInfo={t:performance.now(),x:mx,y:my};
});
cv.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch0&&pointers.size===2){ const ps=[...pointers.values()];
    const d=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);
    zoomT=clamp(pinch0.z*d/pinch0.d,0.45,1.8); return;}
  if(joy&&joy.id===e.pointerId){ let jx=(e.clientX-joy.bx)/52, jy=(e.clientY-joy.by)/52;
    const L=Math.hypot(jx,jy); if(L>1){jx/=L;jy/=L;} joy.dx=jx;joy.dy=jy; return;}
  if(moveHold&&moveHold.id===e.pointerId){moveHold.x=e.clientX;moveHold.y=e.clientY;}
});
function endPointer(e){
  pointers.delete(e.pointerId);
  if(pointers.size<2)pinch0=null;
  if(joy&&joy.id===e.pointerId)joy=null;
  if(moveHold&&moveHold.id===e.pointerId){
    if(tapInfo&&performance.now()-tapInfo.t<260&&Math.hypot(e.clientX-tapInfo.x,e.clientY-tapInfo.y)<10){
      const cam=camPos();
      const wx=cam.cx+e.clientX/zoom, wy=cam.cy+e.clientY/zoom;
      if(dist(wx,wy,player.x,player.y)<110)interact();
    }
    moveHold=null; tapInfo=null;}
}
cv.addEventListener('pointerup',endPointer);
cv.addEventListener('pointercancel',endPointer);
addEventListener('wheel',e=>{ if(!started)return;
  zoomT=clamp(zoomT*(e.deltaY<0?1.12:0.89),0.45,1.8);},{passive:true});

/* ================= 更新 ================= */
let bugSpawnT=0, digSpawnT=0, shellSpawnT=0, firefly=[];
function update(dt){
  const night=isNight();
  zoom+=(zoomT-zoom)*Math.min(1,dt*8);
  // 乘坐中（火車/纜車）
  if(player.riding){ const r=player.riding;
    r.d+=r.speed*((keys.Space||keys.KeyE)?3:1)*dt;
    if(r.d>=r.len){ const e=r.pts[r.pts.length-1]; player.x=e.x;player.y=e.y;
      const f=r.onEnd; player.riding=null; if(f)f(); }
    else { let d=r.d,i=0; while(i<r.segs.length-1&&d>r.segs[i]){d-=r.segs[i];i++;}
      const a=r.pts[i],bb=r.pts[i+1],t2=r.segs[i]?d/r.segs[i]:0;
      player.x=a.x+(bb.x-a.x)*t2; player.y=a.y+(bb.y-a.y)*t2;
      player.face=Math.abs(bb.x-a.x)>Math.abs(bb.y-a.y)?(bb.x<a.x?1:2):(bb.y<a.y?3:0);} }
  // 熱氣球
  if(player.balloonRide){ const bR=player.balloonRide; bR.t+=dt;
    const ph=bR.t/bR.dur;
    player.x=bR.cx+Math.sin(ph*6.283)*70; player.y=bR.cy+Math.cos(ph*6.283)*40-20;
    zoomT=ph<0.25?1-(ph/0.25)*0.55:(ph>0.78?0.45+((ph-0.78)/0.22)*0.55:0.45);
    if(bR.t>=bR.dur){player.balloonRide=null;zoomT=1;player.x=bR.cx;player.y=bR.cy;
      toast('🎈 回到地面了！剛剛的景色真美～');}}
  let dx=0,dy=0;
  if(!ui&&!player.riding&&!player.balloonRide){
    if(keys.KeyW||keys.ArrowUp)dy-=1; if(keys.KeyS||keys.ArrowDown)dy+=1;
    if(keys.KeyA||keys.ArrowLeft)dx-=1; if(keys.KeyD||keys.ArrowRight)dx+=1;
    if(!dx&&!dy){
      if(joy){dx=joy.dx;dy=joy.dy;}
      else if(moveHold){ const cam=camPos();
        const wx=cam.cx+moveHold.x/zoom, wy=cam.cy+moveHold.y/zoom;
        if(dist(wx,wy,player.x,player.y)>16){dx=wx-player.x;dy=wy-player.y;}}
    }
  }
  const run=keys.ShiftLeft||keys.ShiftRight;
  let spd=player.sailing?420:(run?385:255)*(player.buffSpd>0?1.25:1);
  player.moving=false;
  if(dx||dy){ if(player.fishing)player.fishing=null;
    player.moving=moveActor(player,dx,dy,spd,dt);
    if(player.moving)player.walk+=dt*(run?13:9); }
  player.buffSpd=Math.max(0,player.buffSpd-dt);
  player.buffLuck=Math.max(0,player.buffLuck-dt);
  player.swing=Math.max(0,player.swing-dt);
  flash=Math.max(0,flash-dt*1.2);
  if(ui==='dialog'&&dialog){ // 打字機效果（36 字/秒，與更新率無關）
    dialog.ch=Math.min(dialog.lines[dialog.i].length,dialog.ch+36*dt);
    if(Math.floor(dialog.ch)!==dialog._pc){dialog._pc=Math.floor(dialog.ch);if(dialog._pc%2)sfx('blip');}}
  if(player.show){player.show.t-=dt;if(player.show.t<=0)player.show=null;}
  if(player.fishing){ const f=player.fishing; f.t+=dt;
    if(f.state==='wait'&&f.t>=f.biteAt){f.state='bite';f.t=0;sfx('splash');}
    else if(f.state==='bite'&&f.t>0.9){player.fishing=null;toast('啊…魚跑掉了。');}}
  for(let i=drops.length-1;i>=0;i--){ const d=drops[i];
    if(dist(d.x,d.y,player.x,player.y)<32){ drops.splice(i,1); addItem(d.item);
      dex[d.item]=(dex[d.item]||0)+1; sfx('pop');
      player.show={emoji:ITEMS[d.item].e,text:'撿到了 '+d.item,t:1.4}; save(); } }
  for(const tr of trees){ tr.shake=Math.max(0,tr.shake-dt);
    if(!tr.has&&tr.fruit){tr.regrow-=dt;if(tr.regrow<=0)tr.has=true;} }
  for(const r of rocks)r.hit=Math.max(0,(r.hit||0)-dt);
  for(const tb of teaBushes)if(!tb.ready){tb.t-=dt;if(tb.t<=0)tb.ready=true;}
  for(const ca of cacti)if(!ca.ready){ca.t-=dt;if(ca.t<=0)ca.ready=true;}
  for(const sb of strawberries)if(!sb.ready){sb.t-=dt;if(sb.t<=0)sb.ready=true;}
  for(let i=lanterns.length-1;i>=0;i--){const L=lanterns[i];L.t+=dt;
    L.y-=32*dt;L.x+=Math.sin(L.t*1.5)*12*dt;
    if(L.t>12)lanterns.splice(i,1);}
  // NPC
  for(const n of NPCS){
    if(ui==='dialog'&&dialog&&dialog.npc===n)continue;
    n.ai-=dt;
    if(n.ai<=0){ n.ai=1.5+Math.random()*3;
      if(Math.random()<0.55){n.vx=0;n.vy=0;}
      else{const a=Math.random()*6.283;n.vx=Math.cos(a);n.vy=Math.sin(a);
        if(dist(n.x,n.y,n.hx,n.hy)>n.homeR){n.vx=(n.hx-n.x);n.vy=(n.hy-n.y);}}}
    if(n.vx||n.vy){ if(moveActor(n,n.vx,n.vy,55,dt))n.walk+=dt*5; else {n.vx=0;n.vy=0;} }
  }
  // 昆蟲生成（含區域限定）
  bugSpawnT-=dt;
  if(bugSpawnT<=0){ bugSpawnT=2;
    const ptx=player.x/TILE, pty=player.y/TILE;
    if(bugs.length<(isRainy()?3:7)){ const a=Math.random()*6.283, r=350+Math.random()*400;
      const bx=player.x+Math.cos(a)*r, by=player.y+Math.sin(a)*r;
      const t=T(Math.floor(bx/TILE),Math.floor(by/TILE));
      if(t===GRASS||t===HIGH||t===SAND||t===FIELD){
        const cands=BUGSPECS.filter(s=>{
          if(s.t!=='all'&&(night?s.t!=='night':s.t!=='day'))return false;
          if(s.rect&&!(ptx>=s.rect[0]&&pty>=s.rect[1]&&ptx<=s.rect[2]&&pty<=s.rect[3]))return false;
          return true;})
          .map(s=>({...s,w2:s.w*(player.buffLuck>0&&s.p>=500?2.5:1)}));
        if(cands.length)bugs.push({x:bx,y:by,spec:pickWeighted(cands),vx:0,vy:0,rt:0,ph:Math.random()*6,life:75});}}}
  for(let i=bugs.length-1;i>=0;i--){ const b=bugs[i]; b.life-=dt; b.ph+=dt*4; b.rt-=dt;
    if(b.rt<=0){b.rt=1+Math.random()*2;const a=Math.random()*6.283;
      const sp=b.spec.fly?40:14; b.vx=Math.cos(a)*sp;b.vy=Math.sin(a)*sp;}
    const nx=b.x+b.vx*dt, ny=b.y+b.vy*dt;
    const t=T(Math.floor(nx/TILE),Math.floor(ny/TILE));
    if(WALKABLE[t]){b.x=nx;b.y=ny;}else{b.vx*=-1;b.vy*=-1;}
    if(b.life<=0||dist(b.x,b.y,player.x,player.y)>1100)bugs.splice(i,1); }
  // 蜜蜂
  if(bees){ bees.t-=dt;
    const a=Math.atan2(player.y-bees.y,player.x-bees.x);
    bees.x+=Math.cos(a)*300*dt; bees.y+=Math.sin(a)*300*dt;
    if(dist(bees.x,bees.y,player.x,player.y)<24){toast('🐝 被蜜蜂螫了！好痛！！');sfx('sad');bees=null;}
    else if(bees.t<=0)bees=null; }
  // 挖掘點 / 貝殼（在玩家附近動態生成）
  digSpawnT-=dt;
  if(digSpawnT<=0){ digSpawnT=3;
    for(let i=digs.length-1;i>=0;i--)if(dist(digs[i].x,digs[i].y,player.x,player.y)>80*TILE)digs.splice(i,1);
    const near=digs.filter(d=>dist(d.x,d.y,player.x,player.y)<50*TILE).length;
    if(near<6&&digs.length<40){
      const a=Math.random()*6.283, r=(15+Math.random()*30)*TILE;
      const tx=Math.floor((player.x+Math.cos(a)*r)/TILE), ty=Math.floor((player.y+Math.sin(a)*r)/TILE);
      const t=T(tx,ty);
      if((t===GRASS||t===HIGH||t===SAND||t===FIELD)&&!nearBuilding(tx,ty))
        digs.push({x:(tx+0.5)*TILE,y:(ty+0.5)*TILE});}}
  shellSpawnT-=dt;
  if(shellSpawnT<=0){ shellSpawnT=4;
    for(let i=drops.length-1;i>=0;i--)if(drops[i].shell&&dist(drops[i].x,drops[i].y,player.x,player.y)>90*TILE)drops.splice(i,1);
    const near=drops.filter(d=>d.shell&&dist(d.x,d.y,player.x,player.y)<50*TILE).length;
    if(near<5){
      const a=Math.random()*6.283, r=(10+Math.random()*35)*TILE;
      const tx=Math.floor((player.x+Math.cos(a)*r)/TILE), ty=Math.floor((player.y+Math.sin(a)*r)/TILE);
      if(T(tx,ty)===SAND)drops.push({x:(tx+0.5)*TILE,y:(ty+0.5)*TILE,
        item:Math.random()<0.8?'貝殼':'海螺',shell:true});}}
  // 螢火蟲
  if(night&&!isRainy()){ while(firefly.length<26)firefly.push({x:player.x+(Math.random()-0.5)*VW,
      y:player.y+(Math.random()-0.5)*VH,ph:Math.random()*6});
    for(const f of firefly){f.ph+=dt*2;f.x+=Math.sin(f.ph*0.7)*18*dt;f.y+=Math.cos(f.ph*0.9)*14*dt;
      if(dist(f.x,f.y,player.x,player.y)>Math.max(VW,VH))
        {f.x=player.x+(Math.random()-0.5)*VW;f.y=player.y+(Math.random()-0.5)*VH;}}
  } else firefly.length=0;
  const rg=regionOf();
  if(rg!==lastRegion){ if(lastRegion)banner={t:2.6,text:rg}; lastRegion=rg; }
  if(banner){banner.t-=dt;if(banner.t<=0)banner=null;}
  for(let i=toasts.length-1;i>=0;i--){toasts[i].life-=dt;if(toasts[i].life<=0)toasts.splice(i,1);}
}

/* ================= 角色繪製（立體感） ================= */
function drawActor(x,y,face,walk,o){
  const sp=o.species, pal=o.pal||{fur:o.skin||'#f5c99b'};
  const fur=pal.fur, bob=Math.sin(walk)*1.8, step=Math.sin(walk);
  // 柔和陰影
  let g=ctx.createRadialGradient(x,y+2,2,x,y+2,18);
  g.addColorStop(0,'rgba(0,0,0,.26)');g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y+2,18,8,0,0,7);ctx.fill();
  if(!o.sailing){ // 腳＋鞋子
    ctx.fillStyle=sp==='human'?'#4a3428':tint(fur,-40);
    rr(x-9,y-9+Math.max(0,step*3.2),7,10,3);ctx.fill();
    rr(x+2,y-9+Math.max(0,-step*3.2),7,10,3);ctx.fill();
  }
  // 身體（上亮下暗漸層）
  const bodyC=o.shirt||fur;
  g=ctx.createLinearGradient(x,y-28+bob,x,y-5+bob);
  g.addColorStop(0,tint(bodyC,28));g.addColorStop(1,tint(bodyC,-16));
  ctx.fillStyle=g;rr(x-13,y-27+bob,26,21,9);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=1.5;rr(x-13,y-27+bob,26,21,9);ctx.stroke();
  // 手臂（走路擺動）
  const swA=o.sailing?0:Math.sin(walk)*4;
  ctx.fillStyle=tint(sp==='human'?'#f5c99b':fur,-8);
  ctx.beginPath();ctx.arc(x-14,y-17+bob+swA,4.5,0,7);ctx.arc(x+14,y-17+bob-swA,4.5,0,7);ctx.fill();
  // 身體特徵
  if(sp==='bear'){ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();
    ctx.moveTo(x-7,y-23+bob);ctx.lineTo(x,y-15+bob);ctx.lineTo(x+7,y-23+bob);ctx.stroke();}
  if(sp==='deer'){ctx.fillStyle='#fff';
    for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(x-8+i*4,y-19+bob+(i%2)*4,1.6,0,7);ctx.fill();}}
  if(sp==='clouded'){ctx.fillStyle='rgba(90,70,40,.55)';
    ctx.beginPath();ctx.ellipse(x-6,y-20+bob,4,3,0.4,0,7);ctx.ellipse(x+5,y-15+bob,4,3,-0.4,0,7);ctx.fill();}
  if(sp==='turtle'){ g=ctx.createLinearGradient(x,y-28+bob,x,y-5+bob);
    g.addColorStop(0,'#a5824a');g.addColorStop(1,'#6f5327');
    ctx.fillStyle=g;rr(x-13,y-28+bob,26,22,11);ctx.fill();
    ctx.strokeStyle='#5a431f';ctx.lineWidth=2;
    ctx.strokeRect(x-7,y-24+bob,6,6);ctx.strokeRect(x+1,y-24+bob,6,6);ctx.strokeRect(x-3,y-17+bob,6,5);}
  if(sp==='dolphin'){ctx.fillStyle=tint(fur,-20);
    ctx.beginPath();ctx.moveTo(x-2,y-30+bob);ctx.quadraticCurveTo(x+2,y-40+bob,x+9,y-33+bob);
    ctx.quadraticCurveTo(x+3,y-30+bob,x-2,y-30+bob);ctx.fill();}
  if(sp==='sheep'){ctx.fillStyle='#fff';
    for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(x-9+i*6,y-26+bob,5,0,7);ctx.fill();}}
  // 頭（球體光影）
  const hy=y-40+bob;
  g=ctx.createRadialGradient(x-5,hy-7,3,x,hy,19);
  g.addColorStop(0,tint(fur,36));g.addColorStop(0.65,fur);g.addColorStop(1,tint(fur,-24));
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,hy,17,0,7);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.14)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,hy,17,0,7);ctx.stroke();
  // 頭部特徵
  if(sp==='human'){ g=ctx.createRadialGradient(x-5,hy-12,2,x,hy-6,17);
    g.addColorStop(0,tint(o.hair,30));g.addColorStop(1,o.hair);
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,hy-3,17,Math.PI*1.03,Math.PI*1.97);ctx.fill();
    ctx.strokeStyle=o.hair;ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(x,hy-19);ctx.quadraticCurveTo(x+4,hy-26,x+9,hy-24);ctx.stroke();}
  else if(sp==='dog'){ctx.fillStyle=fur;
    ctx.beginPath();ctx.moveTo(x-16,hy-6);ctx.lineTo(x-10,hy-21);ctx.lineTo(x-3,hy-12);ctx.closePath();
    ctx.moveTo(x+16,hy-6);ctx.lineTo(x+10,hy-21);ctx.lineTo(x+3,hy-12);ctx.closePath();ctx.fill();
    ctx.fillStyle=pal.belly;ctx.beginPath();ctx.ellipse(x,hy+8,7,5,0,0,7);ctx.fill();}
  else if(sp==='cat'||sp==='leopardcat'){ctx.fillStyle=fur;
    ctx.beginPath();ctx.moveTo(x-16,hy-6);ctx.lineTo(x-10,hy-21);ctx.lineTo(x-3,hy-12);ctx.closePath();
    ctx.moveTo(x+16,hy-6);ctx.lineTo(x+10,hy-21);ctx.lineTo(x+3,hy-12);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f2a0a0';
    ctx.beginPath();ctx.moveTo(x-13,hy-9);ctx.lineTo(x-10,hy-17);ctx.lineTo(x-6,hy-11);ctx.closePath();
    ctx.moveTo(x+13,hy-9);ctx.lineTo(x+10,hy-17);ctx.lineTo(x+6,hy-11);ctx.closePath();ctx.fill();
    if(sp==='leopardcat'){ctx.fillStyle='rgba(90,70,40,.6)';
      for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(x-9+i*6,hy+9,1.6,0,7);ctx.fill();}
      ctx.strokeStyle='rgba(90,70,40,.6)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x-4,hy-16);ctx.lineTo(x-4,hy-10);ctx.moveTo(x+4,hy-16);ctx.lineTo(x+4,hy-10);ctx.stroke();}}
  else if(sp==='bear'){ctx.fillStyle=fur;
    ctx.beginPath();ctx.arc(x-13,hy-12,6,0,7);ctx.arc(x+13,hy-12,6,0,7);ctx.fill();
    ctx.fillStyle='#c9a06a';ctx.beginPath();ctx.ellipse(x,hy+7,7,5,0,0,7);ctx.fill();}
  else if(sp==='goat'){ctx.strokeStyle='#b8b0a0';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(x-9,hy-14);ctx.quadraticCurveTo(x-17,hy-23,x-11,hy-27);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+9,hy-14);ctx.quadraticCurveTo(x+17,hy-23,x+11,hy-27);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x,hy+14,4,6,0,0,7);ctx.fill();}
  else if(sp==='deer'){ctx.strokeStyle='#8a6b3a';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(x-8,hy-14);ctx.lineTo(x-12,hy-25);ctx.moveTo(x-10,hy-20);ctx.lineTo(x-15,hy-22);
    ctx.moveTo(x+8,hy-14);ctx.lineTo(x+12,hy-25);ctx.moveTo(x+10,hy-20);ctx.lineTo(x+15,hy-22);ctx.stroke();
    ctx.fillStyle=fur;ctx.beginPath();ctx.ellipse(x-15,hy-6,5,3,-.5,0,7);ctx.ellipse(x+15,hy-6,5,3,.5,0,7);ctx.fill();}
  else if(sp==='bird'||sp==='tern'){ctx.fillStyle=pal.beak||'#e2574c';
    ctx.beginPath();ctx.moveTo(x-4,hy+5);ctx.lineTo(x+4,hy+5);ctx.lineTo(x,hy+12);ctx.closePath();ctx.fill();
    if(sp==='bird'){ctx.strokeStyle=fur;ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(x+10,y-16);ctx.quadraticCurveTo(x+26,y-8,x+31,y+2);ctx.stroke();}
    if(sp==='tern'){ctx.fillStyle='#3a3a3a';
      ctx.beginPath();ctx.arc(x,hy-8,15,Math.PI*1.15,Math.PI*1.85);ctx.fill();}}
  else if(sp==='spoonbill'){ctx.fillStyle='#2f2f2f';
    ctx.beginPath();ctx.ellipse(x,hy+3,8,6,0,0,7);ctx.fill();
    rr(x-3,hy+6,6,16,3);ctx.fill();
    ctx.beginPath();ctx.ellipse(x,hy+24,5.5,4,0,0,7);ctx.fill();}
  else if(sp==='dolphin'){ctx.fillStyle=tint(fur,10);
    ctx.beginPath();ctx.ellipse(x,hy+8,8,5,0,0,7);ctx.fill();
    ctx.fillStyle=pal.belly;ctx.beginPath();ctx.ellipse(x,hy+10,6,3,0,0,7);ctx.fill();}
  else if(sp==='monkey'){ctx.fillStyle=fur;
    ctx.beginPath();ctx.arc(x-16,hy-2,6,0,7);ctx.arc(x+16,hy-2,6,0,7);ctx.fill();
    ctx.fillStyle='#e8c8a8';
    ctx.beginPath();ctx.arc(x-16,hy-2,3,0,7);ctx.arc(x+16,hy-2,3,0,7);ctx.fill();
    ctx.beginPath();ctx.ellipse(x,hy+4,10,8,0,0,7);ctx.fill();}
  else if(sp==='clouded'){ctx.fillStyle=fur;
    ctx.beginPath();ctx.arc(x-12,hy-13,5.5,0,7);ctx.arc(x+12,hy-13,5.5,0,7);ctx.fill();
    ctx.fillStyle='rgba(90,70,40,.55)';
    ctx.beginPath();ctx.ellipse(x-8,hy-8,3,2,0.4,0,7);ctx.ellipse(x+8,hy-8,3,2,-0.4,0,7);ctx.fill();}
  else if(sp==='pheasant'){ctx.fillStyle='#e2574c';
    ctx.beginPath();ctx.ellipse(x-7,hy+1,4,5,0,0,7);ctx.ellipse(x+7,hy+1,4,5,0,0,7);ctx.fill();
    ctx.fillStyle='#f2c94c';
    ctx.beginPath();ctx.moveTo(x-3,hy+6);ctx.lineTo(x+3,hy+6);ctx.lineTo(x,hy+11);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#4a5a8a';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(x+10,y-14);ctx.quadraticCurveTo(x+28,y-6,x+34,y+4);ctx.stroke();
    ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(x+16,y-11);ctx.lineTo(x+18,y-7);ctx.moveTo(x+24,y-6);ctx.lineTo(x+26,y-2);ctx.stroke();}
  else if(sp==='sheep'){ctx.fillStyle='#fff';
    for(let i=0;i<6;i++){const a=Math.PI*(1.05+i*0.18);
      ctx.beginPath();ctx.arc(x+Math.cos(a)*14,hy+Math.sin(a)*14,6,0,7);ctx.fill();}
    ctx.fillStyle='#d8c8b8';ctx.beginPath();ctx.ellipse(x-16,hy+2,4,2.5,-.4,0,7);ctx.ellipse(x+16,hy+2,4,2.5,.4,0,7);ctx.fill();}
  else if(sp==='buffalo'){ctx.strokeStyle='#c8c0b0';ctx.lineWidth=4;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x-8,hy-12);ctx.quadraticCurveTo(x-22,hy-16,x-24,hy-4);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+8,hy-12);ctx.quadraticCurveTo(x+22,hy-16,x+24,hy-4);ctx.stroke();ctx.lineCap='butt';
    ctx.fillStyle=tint(fur,20);ctx.beginPath();ctx.ellipse(x,hy+8,9,6,0,0,7);ctx.fill();
    ctx.fillStyle='#5a5048';ctx.beginPath();ctx.arc(x-3,hy+8,1.5,0,7);ctx.arc(x+3,hy+8,1.5,0,7);ctx.fill();}
  else if(sp==='owl'){ctx.fillStyle=fur;
    ctx.beginPath();ctx.moveTo(x-12,hy-12);ctx.lineTo(x-8,hy-22);ctx.lineTo(x-3,hy-14);ctx.closePath();
    ctx.moveTo(x+12,hy-12);ctx.lineTo(x+8,hy-22);ctx.lineTo(x+3,hy-14);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e8dcc8';
    ctx.beginPath();ctx.arc(x-6,hy+1,6,0,7);ctx.arc(x+6,hy+1,6,0,7);ctx.fill();
    ctx.fillStyle='#f2c94c';
    ctx.beginPath();ctx.moveTo(x-2,hy+5);ctx.lineTo(x+2,hy+5);ctx.lineTo(x,hy+9);ctx.closePath();ctx.fill();}
  // 臉（大眼睛＋高光＋腮紅）
  if(face!==3){ const ex=face===1?-6:face===2?6:0;
    ctx.fillStyle='#2e2620';
    ctx.beginPath();ctx.ellipse(x-6+ex,hy+1,2.6,3.4,0,0,7);ctx.ellipse(x+6+ex,hy+1,2.6,3.4,0,0,7);ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(x-6.8+ex,hy-0.5,1,0,7);ctx.arc(x+5.2+ex,hy-0.5,1,0,7);ctx.fill();
    if(sp!=='buffalo'&&sp!=='spoonbill'){ctx.fillStyle='rgba(255,120,120,.25)';
      ctx.beginPath();ctx.arc(x-10+ex,hy+6,3,0,7);ctx.arc(x+10+ex,hy+6,3,0,7);ctx.fill();}
    if(sp!=='spoonbill'&&sp!=='pheasant'&&sp!=='owl'&&sp!=='bird'&&sp!=='tern'){
      ctx.strokeStyle='#2e2620';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.arc(x+ex,hy+7,3.4,0.15*Math.PI,0.85*Math.PI);ctx.stroke();}
    if(sp==='cat'||sp==='leopardcat'){ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x-15+ex,hy+5);ctx.lineTo(x-6+ex,hy+6);
      ctx.moveTo(x+15+ex,hy+5);ctx.lineTo(x+6+ex,hy+6);ctx.stroke();}}
}
function drawTrain(x,y,face){
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(x,y+10,36,9,0,0,7);ctx.fill();
  const horiz=face===1||face===2;
  const w=horiz?76:38,h=horiz?30:64;
  let g=ctx.createLinearGradient(x,y-h/2-14,x,y+h/2);
  g.addColorStop(0,'#f8f8f4');g.addColorStop(1,'#d8d8d0');
  ctx.fillStyle=g;rr(x-w/2,y-h/2-14,w,h+14,10);ctx.fill();
  ctx.strokeStyle='#b0b0a8';ctx.lineWidth=2;rr(x-w/2,y-h/2-14,w,h+14,10);ctx.stroke();
  ctx.fillStyle='#e2574c';
  if(horiz)ctx.fillRect(x-w/2,y-2,w,8); else ctx.fillRect(x-6,y-h/2-14,8,h+14);
  ctx.fillStyle='#7ec8e8';
  if(horiz){for(let i=0;i<3;i++){rr(x-w/2+9+i*23,y-h/2-8,15,11,3);ctx.fill();}}
  else {for(let i=0;i<3;i++){rr(x-14,y-h/2-8+i*20,11,11,3);ctx.fill();}}
  ctx.fillStyle='#f5c99b';ctx.beginPath();ctx.arc(x+(horiz?-w/2+16:-8),y-h/2-3,4,0,7);ctx.fill();
  ctx.fillStyle='#5a5048';
  ctx.beginPath();ctx.arc(x-w/2+10,y+h/2+2,5,0,7);ctx.arc(x+w/2-10,y+h/2+2,5,0,7);ctx.fill();
}
function drawGondolaCabin(x,y){
  ctx.strokeStyle='#6a5a4a';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(x,y-48);ctx.lineTo(x,y-28);ctx.stroke();
  let g=ctx.createLinearGradient(x,y-28,x,y+8);
  g.addColorStop(0,'#f2726a');g.addColorStop(1,'#c94f43');
  ctx.fillStyle=g;rr(x-17,y-28,34,34,9);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=1.5;rr(x-17,y-28,34,34,9);ctx.stroke();
  ctx.fillStyle='#cfe8f5';rr(x-12,y-22,24,13,4);ctx.fill();
  ctx.fillStyle='#f5c99b';ctx.beginPath();ctx.arc(x-3,y-14,4.5,0,7);ctx.fill();
  ctx.fillStyle='#4a2f1d';ctx.beginPath();ctx.arc(x-3,y-17,4.5,Math.PI,0);ctx.fill();
}
function drawBalloonRideSprite(x,y,bR){
  const ph=bR.t/bR.dur;
  const alt=(ph<0.25?ph/0.25:(ph>0.78?Math.max(0,1-(ph-0.78)/0.22):1));
  const oy=alt*80;
  ctx.fillStyle='rgba(0,0,0,'+(0.24-alt*0.14)+')';
  ctx.beginPath();ctx.ellipse(x,y+12,30-alt*12,9-alt*4,0,0,7);ctx.fill();
  const by2=y-oy;
  let g=ctx.createRadialGradient(x-8,by2-72,6,x,by2-58,36);
  g.addColorStop(0,'#ff9d7a');g.addColorStop(1,'#e2574c');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,by2-58,32,0,7);ctx.fill();
  ctx.fillStyle='#f2c94c';ctx.beginPath();ctx.arc(x,by2-58,32,-0.45,0.45);
  ctx.arc(x,by2-58,32,Math.PI-0.45,Math.PI+0.45);ctx.fill();
  ctx.strokeStyle='#8a6b3a';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x-14,by2-32);ctx.lineTo(x-9,by2-8);ctx.moveTo(x+14,by2-32);ctx.lineTo(x+9,by2-8);ctx.stroke();
  ctx.fillStyle='#8a5a2b';rr(x-12,by2-8,24,16,4);ctx.fill();
  ctx.fillStyle='#f5c99b';ctx.beginPath();ctx.arc(x,by2-12,5,0,7);ctx.fill();
  ctx.fillStyle='#4a2f1d';ctx.beginPath();ctx.arc(x,by2-15,5,Math.PI,0);ctx.fill();
}
function drawBoat(x,y,face,moving){
  ctx.fillStyle='rgba(0,0,40,.2)';ctx.beginPath();ctx.ellipse(x,y+8,27,10,0,0,7);ctx.fill();
  if(moving){ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=2;
    const bx=-DIRV[face][0],by=-DIRV[face][1];
    for(let i=1;i<=2;i++){ctx.beginPath();ctx.arc(x+bx*i*18,y+6+by*i*12,5+i*4,0,7);ctx.stroke();}}
  let g=ctx.createLinearGradient(x,y-12,x,y+14);
  g.addColorStop(0,'#c98a4a');g.addColorStop(1,'#7a4e24');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(x-25,y-5);ctx.quadraticCurveTo(x,y+17,x+25,y-5);
  ctx.quadraticCurveTo(x+27,y-11,x+20,y-11);ctx.lineTo(x-20,y-11);
  ctx.quadraticCurveTo(x-27,y-11,x-25,y-5);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#5f3d1c';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#e8d8b8';ctx.beginPath();ctx.ellipse(x,y-9,17,4.5,0,0,7);ctx.fill();
  ctx.strokeStyle='#6a4520';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x+17,y-11);ctx.lineTo(x+17,y-28);ctx.stroke();
  ctx.fillStyle='#e2574c';ctx.beginPath();ctx.moveTo(x+17,y-28);ctx.lineTo(x+28,y-24);ctx.lineTo(x+17,y-20);ctx.fill();
}

/* ================= 樹木 / 岩石 / 小物 ================= */
function drawTree(tr){
  const sh=tr.shake>0?Math.sin(tr.shake*40)*3:0;
  ctx.fillStyle='rgba(0,0,0,.16)';ctx.beginPath();ctx.ellipse(tr.x,tr.y+3,22,8,0,0,7);ctx.fill();
  if(tr.kind==='palm'){
    ctx.strokeStyle='#a5793f';ctx.lineWidth=9;ctx.beginPath();
    ctx.moveTo(tr.x,tr.y);ctx.quadraticCurveTo(tr.x+8,tr.y-30,tr.x+2+sh,tr.y-58);ctx.stroke();
    ctx.strokeStyle='#4e9a3f';ctx.lineWidth=7;ctx.lineCap='round';
    for(let i=0;i<5;i++){const a=-2.6+i*1.05;
      ctx.beginPath();ctx.moveTo(tr.x+2+sh,tr.y-58);
      ctx.quadraticCurveTo(tr.x+2+sh+Math.cos(a)*24,tr.y-58+Math.sin(a)*18-8,
        tr.x+2+sh+Math.cos(a)*42,tr.y-58+Math.sin(a)*26);ctx.stroke();}
    ctx.lineCap='butt';
    if(tr.has){ctx.font='16px serif';ctx.fillText('🥥',tr.x-6+sh,tr.y-46);ctx.fillText('🥥',tr.x+8+sh,tr.y-42);}
  } else if(tr.kind==='pine'){
    ctx.fillStyle='#8a6b3a';ctx.fillRect(tr.x-5,tr.y-16,10,18);
    for(let i=0;i<3;i++){const w=42-i*10,yy=tr.y-14-i*20;
      const g=ctx.createLinearGradient(tr.x-w/2,yy,tr.x+w/2,yy);
      g.addColorStop(0,'#356b3c');g.addColorStop(0.5,'#4a8a50');g.addColorStop(1,'#2f5f36');
      ctx.fillStyle=g;
      ctx.beginPath();ctx.moveTo(tr.x-w/2+sh,yy);ctx.lineTo(tr.x+sh,yy-26);ctx.lineTo(tr.x+w/2+sh,yy);ctx.closePath();ctx.fill();}
  } else {
    ctx.fillStyle='#8a6b3a';ctx.fillRect(tr.x-6,tr.y-22,12,24);
    let g=ctx.createRadialGradient(tr.x-8+sh,tr.y-50,4,tr.x+sh,tr.y-40,30);
    g.addColorStop(0,'#7cc45e');g.addColorStop(0.6,'#5da645');g.addColorStop(1,'#4a8a3a');
    ctx.fillStyle=g;
    ctx.beginPath();ctx.arc(tr.x-14+sh,tr.y-34,17,0,7);ctx.arc(tr.x+14+sh,tr.y-34,17,0,7);
    ctx.arc(tr.x+sh,tr.y-48,20,0,7);ctx.fill();
    if(tr.has&&tr.fruit){ctx.font='15px serif';
      ctx.fillText(ITEMS[tr.fruit].e,tr.x-20+sh,tr.y-32);
      ctx.fillText(ITEMS[tr.fruit].e,tr.x+6+sh,tr.y-28);
      ctx.fillText(ITEMS[tr.fruit].e,tr.x-6+sh,tr.y-48);}
  }
}
function drawRock(r){
  const j=r.hit>0?Math.sin(r.hit*50)*2:0;
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.beginPath();ctx.ellipse(r.x,r.y+6,20,7,0,0,7);ctx.fill();
  let g=ctx.createRadialGradient(r.x-6+j,r.y-12,3,r.x+j,r.y-4,22);
  g.addColorStop(0,'#c2c8ce');g.addColorStop(1,'#8a9096');
  ctx.fillStyle=g;ctx.beginPath();
  ctx.moveTo(r.x-18+j,r.y+6);ctx.quadraticCurveTo(r.x-20+j,r.y-14,r.x-4+j,r.y-16);
  ctx.quadraticCurveTo(r.x+16+j,r.y-18,r.x+18+j,r.y-2);ctx.quadraticCurveTo(r.x+18+j,r.y+7,r.x+2+j,r.y+7);ctx.closePath();ctx.fill();
}
function drawTeaBush(tb){
  ctx.fillStyle='rgba(0,0,0,.12)';ctx.beginPath();ctx.ellipse(tb.x,tb.y+6,18,5,0,0,7);ctx.fill();
  let g=ctx.createRadialGradient(tb.x-4,tb.y-8,2,tb.x,tb.y-2,18);
  g.addColorStop(0,'#4a8a3f');g.addColorStop(1,'#2f6b2f');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(tb.x-10,tb.y-2,9,0,7);ctx.arc(tb.x,tb.y-6,10,0,7);ctx.arc(tb.x+10,tb.y-2,9,0,7);ctx.fill();
  if(tb.ready){ctx.fillStyle='#9fd45e';
    ctx.beginPath();ctx.arc(tb.x-8,tb.y-8,2.5,0,7);ctx.arc(tb.x+2,tb.y-12,2.5,0,7);ctx.arc(tb.x+9,tb.y-7,2.5,0,7);ctx.fill();}
}
function drawStrawberry(sb){
  ctx.fillStyle='rgba(0,0,0,.1)';ctx.beginPath();ctx.ellipse(sb.x,sb.y+5,14,4,0,0,7);ctx.fill();
  let g=ctx.createRadialGradient(sb.x-3,sb.y-6,2,sb.x,sb.y-2,14);
  g.addColorStop(0,'#5fa050');g.addColorStop(1,'#3a7a35');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(sb.x-8,sb.y-1,7,0,7);ctx.arc(sb.x,sb.y-5,8,0,7);ctx.arc(sb.x+8,sb.y-1,7,0,7);ctx.fill();
  if(sb.ready){ctx.fillStyle='#e2453c';
    ctx.beginPath();ctx.arc(sb.x-6,sb.y-2,3,0,7);ctx.arc(sb.x+2,sb.y-7,3,0,7);ctx.arc(sb.x+7,sb.y-1,3,0,7);ctx.fill();
    ctx.fillStyle='#fff';
    ctx.fillRect(sb.x-7,sb.y-3,1.2,1.2);ctx.fillRect(sb.x+1,sb.y-8,1.2,1.2);}
}
function drawCactus(ca){
  ctx.fillStyle='rgba(0,0,0,.12)';ctx.beginPath();ctx.ellipse(ca.x,ca.y+6,12,4,0,0,7);ctx.fill();
  let g=ctx.createLinearGradient(ca.x-6,ca.y,ca.x+6,ca.y);
  g.addColorStop(0,'#5fa050');g.addColorStop(0.5,'#4a8a3f');g.addColorStop(1,'#3a7030');
  ctx.fillStyle=g;rr(ca.x-6,ca.y-26,12,32,6);ctx.fill();
  rr(ca.x-16,ca.y-18,8,14,4);ctx.fill();rr(ca.x-16,ca.y-12,12,7,3);ctx.fill();
  rr(ca.x+8,ca.y-22,8,14,4);ctx.fill();rr(ca.x+4,ca.y-16,12,7,3);ctx.fill();
  if(ca.ready){ctx.fillStyle='#e2574c';
    ctx.beginPath();ctx.arc(ca.x-3,ca.y-26,3,0,7);ctx.arc(ca.x+4,ca.y-24,3,0,7);ctx.fill();}
}
function drawLamp(l){
  ctx.fillStyle='rgba(0,0,0,.12)';ctx.beginPath();ctx.ellipse(l.x,l.y+2,8,3,0,0,7);ctx.fill();
  ctx.fillStyle='#4a4a44';ctx.fillRect(l.x-2,l.y-42,4,44);
  ctx.fillStyle='#5a5a54';ctx.beginPath();ctx.arc(l.x,l.y-46,7,0,7);ctx.fill();
  ctx.fillStyle=isNight()?'#ffe9a0':'#c8d8e0';ctx.beginPath();ctx.arc(l.x,l.y-46,4.5,0,7);ctx.fill();
}
function drawLanternBody(L){
  const a=L.t>9?1-(L.t-9)/3:1;
  ctx.globalAlpha=a;
  let g=ctx.createLinearGradient(L.x,L.y-16,L.x,L.y+12);
  g.addColorStop(0,'#f2994a');g.addColorStop(1,'#e2574c');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(L.x-10,L.y+10);ctx.lineTo(L.x-13,L.y-10);
  ctx.quadraticCurveTo(L.x,L.y-20,L.x+13,L.y-10);ctx.lineTo(L.x+10,L.y+10);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ffd97a';ctx.beginPath();ctx.arc(L.x,L.y+9,4,0,7);ctx.fill();
  ctx.globalAlpha=1;
}

/* ================= 繪製主流程 ================= */
let tGlobal=0;
function draw(){
  const {cx,cy,VWz,VHz}=camPos();
  ctx.save();ctx.scale(zoom,zoom);ctx.translate(-cx,-cy);
  const x0=Math.floor(cx/TILE),y0=Math.floor(cy/TILE),
        x1=Math.ceil((cx+VWz)/TILE),y1=Math.ceil((cy+VHz)/TILE);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
    const t=T(tx,ty); ctx.drawImage(tileImgs[t],tx*TILE,ty*TILE);
    if(t===SEA||t===LAKE){
      const pulse=0.25+0.15*Math.sin(tGlobal*2+tx+ty);
      ctx.strokeStyle='rgba(255,255,255,'+pulse+')';ctx.lineWidth=3;
      if(WALKABLE[T(tx,ty-1)]){ctx.beginPath();ctx.moveTo(tx*TILE,ty*TILE+2);ctx.lineTo(tx*TILE+TILE,ty*TILE+2);ctx.stroke();}
      if(WALKABLE[T(tx,ty+1)]){ctx.beginPath();ctx.moveTo(tx*TILE,ty*TILE+TILE-2);ctx.lineTo(tx*TILE+TILE,ty*TILE+TILE-2);ctx.stroke();}
      if(WALKABLE[T(tx-1,ty)]){ctx.beginPath();ctx.moveTo(tx*TILE+2,ty*TILE);ctx.lineTo(tx*TILE+2,ty*TILE+TILE);ctx.stroke();}
      if(WALKABLE[T(tx+1,ty)]){ctx.beginPath();ctx.moveTo(tx*TILE+TILE-2,ty*TILE);ctx.lineTo(tx*TILE+TILE-2,ty*TILE+TILE);ctx.stroke();}
      if(hsh(tx,ty)>0.9){const a=0.3+0.3*Math.sin(tGlobal*3+tx*7);
        ctx.fillStyle='rgba(255,255,255,'+a+')';ctx.fillRect(tx*TILE+18,ty*TILE+22,4,4);}}
  }
  const inView=(x,y,m)=>x>cx-(m||80)&&x<cx+VWz+(m||80)&&y>cy-(m||80)&&y<cy+VHz+(m||80);
  // 環島鐵路軌道
  ctx.lineCap='round';
  for(let i=0;i<RAILS.length-1;i++){
    const ax=RAILS[i][0]*TILE,ay=RAILS[i][1]*TILE,bx=RAILS[i+1][0]*TILE,by=RAILS[i+1][1]*TILE;
    if(Math.max(ax,bx)<cx-100||Math.min(ax,bx)>cx+VWz+100||Math.max(ay,by)<cy-100||Math.min(ay,by)>cy+VHz+100)continue;
    const L=Math.hypot(bx-ax,by-ay)||1,ux=(bx-ax)/L,uy=(by-ay)/L,px2=-uy,py2=ux;
    ctx.strokeStyle='rgba(150,125,95,.5)';ctx.lineWidth=13;
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
    ctx.strokeStyle='#8a6b4a';ctx.lineWidth=2.5;
    for(let d=0;d<L;d+=16){const tx2=ax+ux*d,ty3=ay+uy*d;
      if(tx2<cx-20||tx2>cx+VWz+20||ty3<cy-20||ty3>cy+VHz+20)continue;
      ctx.beginPath();ctx.moveTo(tx2+px2*7,ty3+py2*7);ctx.lineTo(tx2-px2*7,ty3-py2*7);ctx.stroke();}
    ctx.strokeStyle='#5a5048';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(ax+px2*4,ay+py2*4);ctx.lineTo(bx+px2*4,by+py2*4);ctx.stroke();
    ctx.beginPath();ctx.moveTo(ax-px2*4,ay-py2*4);ctx.lineTo(bx-px2*4,by-py2*4);ctx.stroke();
  }
  ctx.lineCap='butt';
  // 纜車纜線與往返車廂
  for(const c of CABLECARS){
    const ax=c.a[0]*TILE,ay=c.a[1]*TILE-40,bx=c.b[0]*TILE,by=c.b[1]*TILE-40;
    if(Math.max(ax,bx)<cx-200||Math.min(ax,bx)>cx+VWz+200||Math.max(ay,by)<cy-200||Math.min(ay,by)>cy+VHz+200)continue;
    ctx.strokeStyle='#5a5048';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(ax,ay-24);ctx.lineTo(bx,by-24);ctx.stroke();
    for(let k=0;k<3;k++){ const f=((tGlobal*0.04)+k/3)%1;
      const gx=ax+(bx-ax)*f, gy=ay-24+(by-ay)*f;
      ctx.strokeStyle='#6a5a4a';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx,gy+8);ctx.stroke();
      ctx.fillStyle='#e2574c';rr(gx-8,gy+8,16,12,4);ctx.fill();
      ctx.fillStyle='#ffe9b0';rr(gx-5,gy+10,10,5,2);ctx.fill();}
  }
  // 地面裝飾
  for(const f of flowers)if(inView(f.x,f.y)){
    ctx.fillStyle=f.c;
    for(let i=0;i<5;i++){const a=i/5*6.283+0.5;
      ctx.beginPath();ctx.arc(f.x+Math.cos(a)*4,f.y+Math.sin(a)*4,3,0,7);ctx.fill();}
    ctx.fillStyle='#f9c74f';ctx.beginPath();ctx.arc(f.x,f.y,2.5,0,7);ctx.fill();}
  for(const w of weeds)if(inView(w.x,w.y)){
    ctx.strokeStyle='#4e8a3f';ctx.lineWidth=2.5;ctx.lineCap='round';
    for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(w.x+i*4,w.y+4);
      ctx.quadraticCurveTo(w.x+i*7,w.y-6,w.x+i*9,w.y-12);ctx.stroke();}ctx.lineCap='butt';}
  for(const d of digs)if(inView(d.x,d.y)){
    ctx.strokeStyle='#8a6b3a';ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(d.x-8,d.y-8);ctx.lineTo(d.x+8,d.y+8);
    ctx.moveTo(d.x+8,d.y-8);ctx.lineTo(d.x-8,d.y+8);ctx.stroke();ctx.lineCap='butt';}
  for(const d of drops)if(inView(d.x,d.y)){
    ctx.fillStyle='rgba(0,0,0,.12)';ctx.beginPath();ctx.ellipse(d.x,d.y+8,10,4,0,0,7);ctx.fill();
    ctx.font='20px serif';ctx.textAlign='center';
    ctx.fillText(ITEMS[d.item].e,d.x,d.y+6+Math.sin(tGlobal*3+d.x)*2);ctx.textAlign='left';}
  if(player.fishing){ const f=player.fishing;
    ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(player.x+DIRV[player.face][0]*10,player.y-30);
    ctx.quadraticCurveTo((player.x+f.bx)/2,player.y-60,f.bx,f.by-4);ctx.stroke();
    const bob=Math.sin(tGlobal*4)*2;
    ctx.fillStyle='#e2574c';ctx.beginPath();ctx.arc(f.bx,f.by+bob,6,Math.PI,0);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(f.bx,f.by+bob,6,0,Math.PI);ctx.fill();
    if(f.state==='bite'){ ctx.font='bold 30px sans-serif';ctx.fillStyle='#e2574c';
      ctx.textAlign='center';ctx.fillText('❗',f.bx,f.by-18);ctx.textAlign='left';
      ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(f.bx,f.by,10+f.t*30,0,7);ctx.stroke();}}
  // Y 排序
  const list=[];
  for(const tr of trees)if(inView(tr.x,tr.y,120))list.push({y:tr.y,f:()=>drawTree(tr)});
  for(const r of rocks)if(inView(r.x,r.y))list.push({y:r.y+6,f:()=>drawRock(r)});
  for(const tb of teaBushes)if(inView(tb.x,tb.y))list.push({y:tb.y+6,f:()=>drawTeaBush(tb)});
  for(const ca of cacti)if(inView(ca.x,ca.y))list.push({y:ca.y+6,f:()=>drawCactus(ca)});
  for(const sb of strawberries)if(inView(sb.x,sb.y))list.push({y:sb.y+5,f:()=>drawStrawberry(sb)});
  for(const l of lamps)if(inView(l.x,l.y))list.push({y:l.y,f:()=>drawLamp(l)});
  for(const b of BUILDINGS){const bx=b.x+b.w/2,by=b.y+b.h;
    if(inView(bx,by,400))list.push({y:by,f:()=>BUILDING_DRAWS[b.t](b)});}
  for(const n of NPCS)if(inView(n.x,n.y))
    list.push({y:n.y,f:()=>drawActor(n.x,n.y,n.face,n.walk,{species:n.species,pal:n.pal,shirt:n.pal.fur})});
  list.push({y:player.y,f:()=>{
    if(player.riding){
      if(player.riding.kind==='train')drawTrain(player.x,player.y,player.face);
      else drawGondolaCabin(player.x,player.y);
      return;}
    if(player.balloonRide){drawBalloonRideSprite(player.x,player.y,player.balloonRide);return;}
    if(player.sailing){
      const wob=Math.sin(tGlobal*2.2)*2;
      drawBoat(player.x,player.y+wob,player.face,player.moving);
      drawActor(player.x,player.y-8+wob,player.face,0,
        {species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},hair:'#4a2f1d',shirt:player.shirt,sailing:true});
    } else {
      drawActor(player.x,player.y,player.face,player.moving?player.walk:0,
        {species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},hair:'#4a2f1d',shirt:player.shirt});
    }
    if(player.swing>0){ const a0=player.face===1?Math.PI*0.7:player.face===2?-Math.PI*0.3:player.face===3?Math.PI*1.2:Math.PI*0.2;
      ctx.strokeStyle='#c9a06a';ctx.lineWidth=4;ctx.beginPath();
      ctx.arc(player.x,player.y-24,30,a0,a0+Math.PI*0.6);ctx.stroke();}
    if(player.show){ const s=player.show;
      ctx.font='26px serif';ctx.textAlign='center';
      ctx.fillText(s.emoji,player.x,player.y-74);
      ctx.font='bold 15px "Microsoft JhengHei"';
      const w=ctx.measureText(s.text).width;
      ctx.fillStyle='rgba(255,251,233,.95)';rr(player.x-w/2-10,player.y-66,w+20,24,10);ctx.fill();
      ctx.fillStyle='#5b4023';ctx.fillText(s.text,player.x,player.y-49);ctx.textAlign='left';}
  }});
  for(const b of bugs)if(inView(b.x,b.y))list.push({y:b.y+(b.spec.fly?60:0),f:()=>{
    const fy=b.spec.fly?Math.sin(b.ph)*6-14:0;
    ctx.fillStyle='rgba(0,0,0,.1)';ctx.beginPath();ctx.ellipse(b.x,b.y+4,7,3,0,0,7);ctx.fill();
    ctx.font='20px serif';ctx.textAlign='center';ctx.fillText(b.spec.e,b.x,b.y+fy);ctx.textAlign='left';}});
  if(bees)list.push({y:bees.y+100,f:()=>{ ctx.font='13px serif';
    for(let i=0;i<8;i++)ctx.fillText('🐝',bees.x+Math.sin(tGlobal*8+i*2)*14+(i%3)*8-8,
      bees.y+Math.cos(tGlobal*9+i*1.7)*10+(i%2)*8);}});
  list.sort((a,b)=>a.y-b.y);
  for(const e of list)e.f();
  // 天燈（世界層）
  for(const L of lanterns)if(inView(L.x,L.y,200))drawLanternBody(L);
  // 晝夜
  const [tr_,tg,tb2,ta]=skyTint();
  if(ta>0.005){ctx.fillStyle=`rgba(${tr_|0},${tg|0},${tb2|0},${ta})`;ctx.fillRect(cx,cy,VWz,VHz);}
  if(isRainy()){ctx.fillStyle='rgba(60,80,120,.14)';ctx.fillRect(cx,cy,VWz,VHz);}
  if(isNight()){
    ctx.globalCompositeOperation='lighter';
    for(const b of BUILDINGS){if(b.t==='house'&&hsh(b.tx,b.ty)>0.5)continue;
      const bx=b.x+b.w/2,by=b.y+b.h/2;
      if(!inView(bx,by,300))continue;
      const g=ctx.createRadialGradient(bx,by,10,bx,by,130);
      g.addColorStop(0,'rgba(255,190,90,.28)');g.addColorStop(1,'rgba(255,190,90,0)');
      ctx.fillStyle=g;ctx.fillRect(bx-130,by-130,260,260);}
    for(const l of lamps){if(!inView(l.x,l.y,200))continue;
      const g=ctx.createRadialGradient(l.x,l.y-46,4,l.x,l.y-30,90);
      g.addColorStop(0,'rgba(255,230,140,.5)');g.addColorStop(1,'rgba(255,230,140,0)');
      ctx.fillStyle=g;ctx.fillRect(l.x-90,l.y-130,180,190);}
    for(const L of lanterns){if(!inView(L.x,L.y,200))continue;
      const g=ctx.createRadialGradient(L.x,L.y,4,L.x,L.y,60);
      g.addColorStop(0,'rgba(255,180,80,.6)');g.addColorStop(1,'rgba(255,180,80,0)');
      ctx.fillStyle=g;ctx.fillRect(L.x-60,L.y-60,120,120);}
    for(const f of firefly){const a=0.4+0.4*Math.sin(f.ph*3);
      const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,12);
      g.addColorStop(0,`rgba(190,255,120,${a})`);g.addColorStop(1,'rgba(190,255,120,0)');
      ctx.fillStyle=g;ctx.fillRect(f.x-12,f.y-12,24,24);}
    ctx.globalCompositeOperation='source-over';}
  // 雨絲
  if(isRainy()){
    ctx.strokeStyle='rgba(190,210,255,.4)';ctx.lineWidth=1.5;
    for(let i=0;i<90;i++){
      const rx2=cx+((hsh(i,9)*VWz+tGlobal*60)%VWz), ry2=cy+((hsh(i,5)*VHz+tGlobal*860)%VHz);
      ctx.beginPath();ctx.moveTo(rx2,ry2);ctx.lineTo(rx2-4,ry2+14);ctx.stroke();}}
  ctx.restore();
  if(flash>0){ctx.fillStyle=`rgba(255,255,255,${Math.min(1,flash)})`;ctx.fillRect(0,0,VW,VH);}
  drawUI();
}

/* ================= UI ================= */
function panel(x,y,w,h,alpha){ ctx.fillStyle='rgba(255,251,233,'+(alpha||0.94)+')';
  rr(x,y,w,h,16);ctx.fill();ctx.strokeStyle='#c9a06a';ctx.lineWidth=3;rr(x,y,w,h,16);ctx.stroke();}
function drawUI(){
  uiHits=[];
  const F='"Microsoft JhengHei","PingFang TC",sans-serif';
  const d=new Date(), wd='日一二三四五六'[d.getDay()];
  panel(14,14,252,66);
  ctx.fillStyle='#6b4f2f';ctx.font='bold 19px '+F;
  ctx.fillText(`${d.getMonth()+1}月${d.getDate()}日（${wd}）`+(isRainy()?' 🌧️':''),30,41);
  ctx.font='bold 22px '+F;
  ctx.fillText(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,30,68);
  ctx.font='bold 15px '+F;ctx.fillStyle='#3f8f5a';
  ctx.fillText('📍 '+lastRegion,110,66);
  const mtxt='🍃 '+fmt(money)+' 元';
  ctx.font='bold 20px '+F;
  const mw2=ctx.measureText(mtxt).width;
  panel(VW-mw2-58,14,mw2+44,46);
  ctx.fillStyle='#6b4f2f';ctx.fillText(mtxt,VW-mw2-36,45);
  let by=70;
  ctx.font='bold 14px '+F;
  if(player.boat){panel(VW-158,by,144,30,.85);ctx.fillStyle='#3f6f8f';
    ctx.fillText('⛵ '+(player.sailing?'航行中':'擁有小船'),VW-146,by+21);by+=36;}
  if(player.buffSpd>0){panel(VW-158,by,144,30,.85);ctx.fillStyle='#3f7fd6';
    ctx.fillText('🧋 加速 '+Math.ceil(player.buffSpd)+'s',VW-146,by+21);by+=36;}
  if(player.buffLuck>0){panel(VW-158,by,144,30,.85);ctx.fillStyle='#c9803a';
    ctx.fillText('🍗 幸運 '+Math.ceil(player.buffLuck)+'s',VW-146,by+21);}
  // 工具列
  const hw2=TOOLS.length*66+16, hx=VW/2-hw2/2, hy=VH-86;
  panel(hx,hy,hw2,72,.92);
  for(let i=0;i<TOOLS.length;i++){
    const sx=hx+10+i*66;
    if(i===player.tool){ctx.fillStyle='#ffd97a';rr(sx,hy+8,58,56,10);ctx.fill();
      ctx.strokeStyle='#e8a13a';ctx.lineWidth=3;rr(sx,hy+8,58,56,10);ctx.stroke();}
    ctx.font='24px serif';ctx.textAlign='center';
    ctx.fillText(TOOLS[i].e,sx+29,hy+38);
    ctx.font='bold 12px '+F;ctx.fillStyle='#6b4f2f';
    ctx.fillText((i+1)+' '+TOOLS[i].n,sx+29,hy+58);ctx.textAlign='left';
    uiHits.push({x:sx,y:hy+8,w:58,h:56,cb:(k=>()=>{player.tool=k;sfx('blip');})(i)});
  }
  ctx.font='bold 13px '+F;ctx.fillStyle='rgba(255,251,233,.9)';
  const hint=touchUI?'雙指縮放地圖 · 點地面移動':
    (player.sailing?'空白鍵 靠岸/釣魚 · M地圖 · 滾輪縮放':'空白鍵 互動 · B背包 M地圖 P圖鑑 J任務 H說明');
  ctx.fillText(hint,VW-ctx.measureText(hint).width-16,VH-14);
  // ---- 觸控介面 ----
  if(touchUI){
    if(!ui&&!player.riding&&!player.balloonRide){
      // 虛擬搖桿
      const jbx=joy?joy.bx:110, jby=joy?joy.by:VH-130;
      ctx.globalAlpha=joy?0.55:0.22;
      ctx.fillStyle='#fffbe9';ctx.beginPath();ctx.arc(jbx,jby,56,0,7);ctx.fill();
      ctx.strokeStyle='#c9a06a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(jbx,jby,56,0,7);ctx.stroke();
      ctx.fillStyle='#c9a06a';ctx.beginPath();
      ctx.arc(jbx+(joy?clamp(joy.dx,-1,1)*34:0),jby+(joy?clamp(joy.dy,-1,1)*34:0),26,0,7);ctx.fill();
      ctx.globalAlpha=1;
      // A 互動鍵
      ctx.globalAlpha=0.85;
      ctx.fillStyle='#f0913a';ctx.beginPath();ctx.arc(VW-74,VH-124,40,0,7);ctx.fill();
      ctx.strokeStyle='#c76f22';ctx.lineWidth=4;ctx.beginPath();ctx.arc(VW-74,VH-124,40,0,7);ctx.stroke();
      ctx.fillStyle='#fff';ctx.font='bold 30px '+F;ctx.textAlign='center';
      ctx.fillText('A',VW-74,VH-113);ctx.textAlign='left';ctx.globalAlpha=1;
      uiHits.push({x:VW-118,y:VH-168,w:88,h:88,cb(){interact();}});
    }
    // 側邊功能圖示
    const icons=[['🎒','bag'],['🗺️','map'],['📖','dex'],['📋','quest'],['❓','help']];
    const step=Math.min(52,(VH*0.55)/icons.length), iy0=Math.max(96,VH*0.2);
    icons.forEach(([em,mode],i)=>{ const iy=iy0+i*step;
      ctx.globalAlpha=0.85;panel(VW-52,iy,42,42,.85);ctx.globalAlpha=1;
      ctx.font='20px serif';ctx.fillText(em,VW-45,iy+29);
      uiHits.push({x:VW-52,y:iy,w:42,h:42,cb:((m)=>()=>{ui=(ui===m?null:m);sfx('blip');})(mode)});});
  }
  let ty2=96;
  for(const t of toasts){ ctx.font='bold 16px '+F;
    const w=ctx.measureText(t.t).width;
    ctx.globalAlpha=Math.min(1,t.life);
    panel(VW/2-w/2-18,ty2,w+36,36,.92);
    ctx.fillStyle='#6b4f2f';ctx.fillText(t.t,VW/2-w/2,ty2+24);
    ctx.globalAlpha=1; ty2+=44;}
  if(banner){ ctx.globalAlpha=Math.min(1,banner.t,(2.6-banner.t)*2);
    ctx.font='bold 34px '+F;
    const w=ctx.measureText(banner.text).width;
    ctx.fillStyle='rgba(60,40,20,.55)';rr(VW/2-w/2-34,VH*0.2,w+68,60,30);ctx.fill();
    ctx.fillStyle='#fffbe9';ctx.fillText('～ '+banner.text+' ～',VW/2-w/2-24,VH*0.2+42);
    ctx.globalAlpha=1;}
  if(ui==='dialog'&&dialog){
    const dg=dialog, w=Math.min(760,VW-40), x=VW/2-w/2, y=VH-210, h=124;
    panel(x,y,w,h,0.97);
    ctx.font='bold 17px '+F;
    ctx.fillStyle='#f0913a';rr(x+22,y-16,ctx.measureText(dg.name).width+56,34,16);ctx.fill();
    ctx.fillStyle='#fff';ctx.fillText(dg.name,x+42,y+7);
    const text=dg.lines[dg.i].slice(0,Math.floor(dg.ch));
    ctx.fillStyle='#5b4023';ctx.font='20px '+F;
    let line='',ly=y+42;
    for(const chc of text){ if(ctx.measureText(line+chc).width>w-70){ctx.fillText(line,x+34,ly);line=chc;ly+=30;}
      else line+=chc;}
    ctx.fillText(line,x+34,ly);
    if(dg.ch>=dg.lines[dg.i].length&&Math.sin(tGlobal*6)>0){
      ctx.fillStyle='#f0913a';ctx.beginPath();
      ctx.moveTo(x+w-36,y+h-24);ctx.lineTo(x+w-20,y+h-24);ctx.lineTo(x+w-28,y+h-12);ctx.closePath();ctx.fill();}
    uiHits.push({x,y,w,h,cb(){ const full=dialog.lines[dialog.i];
      if(dialog.ch<full.length)dialog.ch=full.length;
      else if(dialog.i<dialog.lines.length-1){dialog.i++;dialog.ch=0;}
      else{ui=null;const f=dialog.onDone;dialog=null;if(f)f();}}});
  }
  if(ui==='menu'&&menu){
    const many=menu.opts.length>6, oh=many?40:52, fs=many?16:18;
    const w=Math.min(600,VW-60), x=VW/2-w/2;
    const h=66+menu.opts.length*oh, y=Math.max(20,VH-h-110);
    panel(x,y,w,h,0.97);
    ctx.fillStyle='#5b4023';ctx.font='bold 18px '+F;
    ctx.fillText(menu.title.length>34?menu.title.slice(0,34)+'…':menu.title,x+24,y+34);
    for(let i=0;i<menu.opts.length;i++){
      const oy=y+50+i*oh;
      if(i===menu.sel){ctx.fillStyle='#ffe9b0';rr(x+16,oy,w-32,oh-8,10);ctx.fill();}
      ctx.fillStyle=i===menu.sel?'#c9500f':'#6b4f2f';ctx.font='bold '+fs+'px '+F;
      ctx.fillText((i===menu.sel?'▶ ':'　 ')+menu.opts[i].label,x+28,oy+oh-15);
      uiHits.push({x:x+16,y:oy,w:w-32,h:oh-8,cb:(k=>()=>{menu.sel=k;const o=menu.opts[k];ui=null;o.cb();})(i)});
    }
  }
  if(ui==='bag'){
    const w=Math.min(720,VW-60),x=VW/2-w/2,y=70,h=VH-200;
    panel(x,y,w,h);
    ctx.fillStyle='#5b4023';ctx.font='bold 24px '+F;ctx.fillText('🎒 背包',x+28,y+42);
    ctx.font='15px '+F;ctx.fillStyle='#9a805c';
    ctx.fillText('到雜貨店可以賣出　(B 或 Esc 關閉)',x+140,y+42);
    const names=Object.keys(inv);
    let total=0; names.forEach(n=>total+=(ITEMS[n]?ITEMS[n].p:0)*inv[n]);
    ctx.font='bold 17px '+F;ctx.fillStyle='#3f8f5a';
    ctx.fillText('總價值：'+fmt(total)+' 元',x+w-200,y+42);
    const cols=Math.floor((w-40)/104);
    const rows=Math.max(1,Math.floor((h-54)/104));
    const hidden=names.length-cols*rows;
    if(hidden>0){ctx.font='13px '+F;ctx.fillStyle='#9a805c';
      ctx.fillText('…還有 '+hidden+' 種物品未顯示',x+24,y+h-14);}
    names.slice(0,cols*rows).forEach((n,i)=>{
      const gx=x+24+(i%cols)*104, gy=y+64+Math.floor(i/cols)*104;
      ctx.fillStyle='#fff3d6';rr(gx,gy,94,94,12);ctx.fill();
      ctx.font='30px serif';ctx.textAlign='center';ctx.fillText(ITEMS[n].e,gx+47,gy+40);
      ctx.font='bold 13px '+F;ctx.fillStyle='#5b4023';ctx.fillText(n,gx+47,gy+62);
      ctx.font='12px '+F;ctx.fillStyle='#9a805c';
      ctx.fillText('×'+inv[n]+'　'+ITEMS[n].p+'元',gx+47,gy+80);ctx.textAlign='left';});
    if(!names.length){ctx.font='17px '+F;ctx.fillStyle='#9a805c';
      ctx.fillText('背包空空的…去釣魚、抓蟲、搖樹吧！',x+34,y+100);}
  }
  if(ui==='map'){
    const mh=Math.min(VH-150,620), mw3=mh*(MW/MH), x=VW/2-mw3/2, y=60;
    panel(x-20,y-20,mw3+40,mh+70);
    ctx.drawImage(mini,x,y,mw3,mh);
    ctx.strokeStyle='#c9a06a';ctx.lineWidth=3;ctx.strokeRect(x,y,mw3,mh);
    ctx.font='bold 18px '+F;ctx.fillStyle='#5b4023';ctx.fillText('🗺️ 台灣島地圖　(M 或 Esc 關閉)',x,y+mh+34);
    const MKS=[['台北',202,44],['桃園',178,70],['新竹',163,98],['台中',158,174],['彰化',150,200],
      ['嘉義',156,258],['台南',159,328],['高雄',171,360],['墾丁',210,458],['宜蘭',242,74],
      ['花蓮',257,171],['台東',245,282],['日月潭',186,220],['玉山',206,262],['阿里山',184,260],
      ['澎湖',54,309],['金門',19,255],['馬祖',24,47],['綠島',328,415],['蘭嶼',339,477],
      ['小琉球',168,449],['龜山島',311,71]].map(([n,x2,y2])=>[n,x2*1.5,y2*1.5]);
    ctx.font='bold 11px '+F;
    for(const [nm,tx,ty3] of MKS){const px=x+tx/MW*mw3,py=y+ty3/MH*mh;
      ctx.fillStyle='#e2574c';ctx.beginPath();ctx.arc(px,py,3,0,7);ctx.fill();
      ctx.fillStyle='#5b4023';ctx.fillText(nm,px+5,py+4);}
    const px=x+player.x/(MW*TILE)*mw3, py=y+player.y/(MH*TILE)*mh;
    if(Math.sin(tGlobal*5)>-0.3){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py,7,0,7);ctx.fill();
      ctx.fillStyle='#f0913a';ctx.beginPath();ctx.arc(px,py,5,0,7);ctx.fill();}
  }
  if(ui==='dex'){
    const w=Math.min(900,VW-60),x=VW/2-w/2,y=60,h=VH-160;
    panel(x,y,w,h);
    ctx.fillStyle='#5b4023';ctx.font='bold 24px '+F;ctx.fillText('📖 生物圖鑑　(P 或 Esc 關閉)',x+28,y+44);
    const drawList=(title,arr,gx,gy)=>{
      ctx.font='bold 17px '+F;ctx.fillStyle='#3f8f5a';ctx.fillText(title,gx,gy);
      arr.forEach((s,i)=>{const yy=gy+26+i*28, got=dex[s.n];
        ctx.font='16px serif';ctx.fillText(got?s.e:'❓',gx,yy);
        ctx.font=(got?'bold ':'')+'14px '+F;ctx.fillStyle=got?'#5b4023':'#b8a888';
        ctx.fillText(got?s.n+'　'+fmt(s.p)+'元':'？？？',gx+28,yy);});};
    const fishGot=FISHES.filter(f=>dex[f.n]).length, bugGot=BUGSPECS.filter(b=>dex[b.n]).length;
    drawList('🐟 魚類（'+fishGot+'/'+FISHES.length+'）',FISHES.slice(0,9),x+40,y+84);
    drawList('　',FISHES.slice(9),x+w/3+30,y+84);
    drawList('🦋 昆蟲（'+bugGot+'/'+BUGSPECS.length+'）',BUGSPECS,x+w*2/3+20,y+84);
  }
  if(ui==='quest'){
    const w=Math.min(720,VW-60),x=VW/2-w/2,y=70;
    const h=90+QUESTS.length*56;
    panel(x,y,w,h);
    ctx.fillStyle='#5b4023';ctx.font='bold 24px '+F;ctx.fillText('📋 任務清單　(J 或 Esc 關閉)',x+28,y+44);
    QUESTS.forEach((q,i)=>{
      const st=questState[i]||0, yy=y+70+i*56;
      ctx.fillStyle=st===2?'#e8f5e0':(st===1?'#fff3d6':'#f5f0e0');
      rr(x+20,yy,w-40,48,10);ctx.fill();
      ctx.font='bold 16px '+F;
      ctx.fillStyle=st===2?'#3f8f5a':'#5b4023';
      const icon=st===2?'✅':(st===1?'⏳':'❔');
      const have=inv[q.need]||0;
      const prog=st===1?`（${ITEMS[q.need].e}${have}/${q.n}）`:'';
      ctx.fillText(`${icon} ${q.npc}：${ITEMS[q.need].e}${q.need} ×${q.n} ${prog}`,x+34,yy+22);
      ctx.font='13px '+F;ctx.fillStyle='#9a805c';
      ctx.fillText(st===2?'已完成！':(st===1?'收集完成後回去找 '+q.npc:'和 '+q.npc+' 對話接受任務')+'　獎勵 '+fmt(q.reward)+'元',x+34,yy+40);});
  }
  if(ui==='help'){
    const w=Math.min(660,VW-60),x=VW/2-w/2,y=50;
    const lines=['🏝️ 歡迎來到台灣島！','',
      '💻 電腦：WASD移動·Shift奔跑·空白鍵互動·滾輪縮放·滑鼠按住地面移動',
      '📱 手機：左下搖桿移動·右下Ⓐ互動·雙指縮放·右側圖示開功能',
      '工具：1 手　2 捕蟲網　3 釣竿　4 鏟子　5 斧頭',
      '',
      '🎣 拿釣竿面向水邊互動，「❗」出現時再按一次！',
      '⛵ 到港口買船（3,000元）出海，船上可釣黑鮪魚等深海魚！',
      '🚂 車站搭火車沿鐵軌環島（可看沿途風景）、港口搭渡輪去離島。',
      '🚡 貓空／日月潭有纜車、🎈鹿野高台熱氣球可以升空鳥瞰！',
      '📋 和動物朋友對話接任務（J 查看）。',
      '🌳 搖樹採果、⛏️挖寶、🍵採茶、🍓大湖採草莓、🌵澎湖摘仙人掌果。',
      '♨️ 溫泉、🏮平溪天燈、廟裡抽籤…115+ 個鄉鎮景點等你探索！',
      '',
      'B 背包　M 地圖　P 圖鑑　J 任務　N 音樂　(H 或 Esc 關閉)'];
    panel(x,y,w,lines.length*27+46);
    ctx.font='bold 15px '+F;
    lines.forEach((l,i)=>{ctx.fillStyle=i===0?'#c9500f':'#5b4023';
      ctx.fillText(l,x+30,y+38+i*27);});
  }
}

/* ================= 存檔 ================= */
const SAVEKEY='twisland_v3';
function save(){ try{ localStorage.setItem(SAVEKEY,JSON.stringify({
  name:player.name,shirt:player.shirt,money,inv,dex,quests:questState,boat:player.boat,
  x:player.x,y:player.y,sailing:player.sailing,music:musicOn}));}catch(e){} }
function load(){ try{ const s=JSON.parse(localStorage.getItem(SAVEKEY));
  if(!s)return false;
  player.name=s.name||'小島民';player.shirt=s.shirt||'#e74c3c';
  money=s.money??800;inv=s.inv||{};dex=s.dex||{};questState=s.quests||{};
  player.boat=!!s.boat;musicOn=s.music!==false;
  if(s.x!=null){ if(s.sailing&&!hitWater(s.x,s.y)){player.x=s.x;player.y=s.y;player.sailing=true;}
    else if(!hitObstacle(s.x,s.y)){player.x=s.x;player.y=s.y;} }
  return true;}catch(e){return false;} }
setInterval(()=>{if(started)save();},10000);
addEventListener('beforeunload',()=>{if(started)save();});

/* ================= 啟動 ================= */
genNpcs(); genWorld();
const hasSave=load();
const SHIRTS=['#e74c3c','#3f7fd6','#2ea36b','#f2b21c','#9b59b6','#f27ba0'];
const swd=document.getElementById('swatches');
SHIRTS.forEach(c=>{const el=document.createElement('div');el.className='sw'+(c===player.shirt?' sel':'');
  el.style.background=c;el.onclick=()=>{player.shirt=c;
    [...swd.children].forEach(e=>e.classList.remove('sel'));el.classList.add('sel');};
  swd.appendChild(el);});
document.getElementById('nameIn').value=player.name;
if(hasSave)document.getElementById('startBtn').textContent='繼續遊戲！';
document.getElementById('startBtn').onclick=()=>{
  player.name=(document.getElementById('nameIn').value.trim()||'小島民').slice(0,8);
  document.getElementById('intro').style.display='none';
  initAudio(); started=true; save();
  if(!hasSave) setTimeout(()=>{ dlg('里長伯',[
    player.name+'，歡迎來到台灣島！這裡是台北車站前的廣場。',
    '這座島超──級大：從基隆到墾丁、還有澎湖綠島蘭嶼等離島！',
    '走路太慢的話，到車站搭火車、到港口搭渡輪或買一艘自己的船吧！',
    '釣魚抓蟲賺錢、幫動物朋友完成任務，按 H 可以隨時看說明。',
    '那麼，開始你的環島大冒險吧！']);},600);
};
let lastT=performance.now();
function loop(now){ const dt=Math.min(0.05,(now-lastT)/1000); lastT=now; tGlobal+=dt;
  if(started)update(dt);
  draw();
  requestAnimationFrame(loop);}
requestAnimationFrame(loop);
