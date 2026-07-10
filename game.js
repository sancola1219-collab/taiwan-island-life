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

/* ================= 地圖生成（v40：雙世界 台灣/大陸，可切換） ================= */
let world='tw';            // 目前所在世界
let map=new Uint8Array(MW*MH);
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
function findWalkSafe(tx,ty){ // 找可走、不撞建築、且至少一個方向能移動的落點（傳送用）
  for(let r=0;r<25;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const t=T(tx+dx,ty+dy);
    if(WALKABLE[t]){const x=(tx+dx+0.5)*TILE,y=(ty+dy+0.5)*TILE;
      if(!hitObstacle(x,y)&&(!hitObstacle(x+34,y)||!hitObstacle(x-34,y)||!hitObstacle(x,y+34)||!hitObstacle(x,y-34)))
        return {x,y};}}
  return findWalk(tx,ty); }

/* ================= 圖塊預繪 ================= */
const tileImgs={};
function makeTile(type){
  const c=document.createElement('canvas');c.width=c.height=TILE;const g=c.getContext('2d');
  const tri=(base,dark)=>{g.fillStyle=base;g.fillRect(0,0,TILE,TILE);g.fillStyle=dark;
    const s=12;for(let gy=0;gy<4;gy++)for(let gx=0;gx<4;gx++){if((gx+gy)%2)continue;
      const x=gx*s,y=gy*s;g.beginPath();g.moveTo(x,y+s);g.lineTo(x+s/2,y);g.lineTo(x+s,y+s);g.closePath();g.fill();}};
  if(type===GRASS)tri('#6fb257','#66a84f');
  else if(type===HIGH)tri('#559549','#4d8c42');
  else if(type===FIELD){g.fillStyle='#aacb6c';g.fillRect(0,0,TILE,TILE);
    g.strokeStyle='#93b957';g.lineWidth=3;
    for(let i=0;i<4;i++){g.beginPath();g.moveTo(0,6+i*12);g.lineTo(48,6+i*12);g.stroke();}
    g.fillStyle='#8fae52';for(let i=0;i<8;i++)g.fillRect(4+(i%4)*12,8+Math.floor(i/4)*24,2,4);}
  else if(type===SAND){g.fillStyle='#efe0a8';g.fillRect(0,0,TILE,TILE);g.fillStyle='#e3d194';
    for(let i=0;i<14;i++)g.fillRect(Math.floor(hsh(i,type)*44)+2,Math.floor(hsh(i+40,type)*44)+2,3,3);}
  else if(type===SEA||type===LAKE){g.fillStyle=type===SEA?'#3f8fbd':'#4694b4';g.fillRect(0,0,TILE,TILE);
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
function makeMini(mapArr){
  const c=document.createElement('canvas');c.width=MW/2;c.height=MH/2;const g=c.getContext('2d');
  const col={[SEA]:'#3f8fbd',[SAND]:'#efe0a8',[GRASS]:'#6fb257',[HIGH]:'#559549',
    [MT]:'#8b8f7c',[LAKE]:'#4694b4',[PLAZA]:'#d8cba8',[PATH]:'#d9b97e',[FIELD]:'#aacb6c'};
  for(let ty=0;ty<MH;ty+=2)for(let tx=0;tx<MW;tx+=2){g.fillStyle=col[mapArr[ty*MW+tx]]||'#3f8fbd';g.fillRect(tx/2,ty/2,1,1);}
  return c; }
let mini=makeMini(map);

/* ================= 建築 ================= */
function drawRoofSign(x,y,txt,bg){ if(!txt)return;
  ctx.font='bold 28px "Microsoft JhengHei"'; // v42 招牌字放大約2倍
  const w=ctx.measureText(txt).width;
  ctx.fillStyle=bg||'#8a5a2b';rr(x-w/2-14,y-24,w+28,44,12);ctx.fill();
  ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(txt,x,y+9);ctx.textAlign='left';}
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
  // 木棧板碼頭（參考東石漁人碼頭風格）
  ctx.fillStyle='#b8834a';ctx.fillRect(x-8,y,w+16,h);
  ctx.strokeStyle='#96682f';ctx.lineWidth=2.5;
  for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(x-8,y+5+i*9);ctx.lineTo(x+w+8,y+5+i*9);ctx.stroke();}
  ctx.fillStyle='#7a5a2f';
  for(const [px3,py3] of [[x-10,y-4],[x+w+2,y-4],[x-10,y+h-8],[x+w+2,y+h-8]]){
    ctx.fillRect(px3,py3,8,14);ctx.fillStyle='#8a6a3a';ctx.fillRect(px3+1,py3-3,6,4);ctx.fillStyle='#7a5a2f';}
  // 涼亭（藍屋頂）
  ctx.fillStyle='#8a6b3a';ctx.fillRect(x+2,y-4,4,16);ctx.fillRect(x+26,y-4,4,16);
  ctx.fillStyle='#3f5f8f';ctx.beginPath();
  ctx.moveTo(x-6,y-4);ctx.lineTo(x+16,y-22);ctx.lineTo(x+38,y-4);ctx.closePath();ctx.fill();
  ctx.fillStyle='#4a6f9f';ctx.beginPath();
  ctx.moveTo(x,y-6);ctx.lineTo(x+16,y-18);ctx.lineTo(x+32,y-6);ctx.closePath();ctx.fill();
  // 燈柱
  ctx.fillStyle='#5a4a3a';ctx.fillRect(x+w-6,y-14,3,16);
  ctx.fillStyle=isNight()?'#ffd97a':'#e8e0c8';ctx.beginPath();ctx.arc(x+w-4.5,y-16,4,0,7);ctx.fill();
  // 停泊漁船（白身紅線）
  const bob2=Math.sin(tGlobal*1.8+x)*2;
  ctx.fillStyle='rgba(0,0,40,.2)';ctx.beginPath();ctx.ellipse(x+w/2,y+h+22+bob2,24,7,0,0,7);ctx.fill();
  ctx.fillStyle='#f5f2ea';ctx.beginPath();
  ctx.moveTo(x+w/2-24,y+h+12+bob2);ctx.quadraticCurveTo(x+w/2,y+h+28+bob2,x+w/2+24,y+h+12+bob2);
  ctx.lineTo(x+w/2+20,y+h+6+bob2);ctx.lineTo(x+w/2-20,y+h+6+bob2);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#c94f43';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(x+w/2-22,y+h+11+bob2);ctx.lineTo(x+w/2+22,y+h+11+bob2);ctx.stroke();
  ctx.fillStyle='#7ec8e8';rr(x+w/2-8,y+h-2+bob2,16,9,3);ctx.fill();
  // 海鷗
  ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.lineCap='round';
  for(let i=0;i<2;i++){const gx=x+w/2-20+i*40+Math.sin(tGlobal+i*2)*8, gy=y-28-i*10+Math.cos(tGlobal*1.3+i)*4;
    ctx.beginPath();ctx.moveTo(gx-5,gy);ctx.quadraticCurveTo(gx-2,gy-4,gx,gy);
    ctx.quadraticCurveTo(gx+2,gy-4,gx+5,gy);ctx.stroke();}
  ctx.lineCap='butt';
  drawRoofSign(x+w/2,y-34,'⚓ '+b.label,'#3f6f8f');},
 giftshop(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#f5c8d8';rr(x,y-30,w,h+30,8);ctx.fill();
  ctx.fillStyle='#e88aa8';ctx.beginPath();
  ctx.moveTo(x-8,y-26);ctx.lineTo(cx2,y-50);ctx.lineTo(x+w+8,y-26);ctx.closePath();ctx.fill();
  // 條紋遮陽棚
  for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#e2574c':'#fff';
    ctx.beginPath();ctx.moveTo(x+i*w/4,y-6);ctx.lineTo(x+(i+1)*w/4,y-6);
    ctx.lineTo(x+(i+1)*w/4,y+6);ctx.arc(x+(i+0.5)*w/4,y+6,w/8,0,Math.PI);ctx.closePath();ctx.fill();}
  ctx.fillStyle='#fff0f5';rr(x+w/2-14,y+h-30,28,30,4);ctx.fill(); // 門
  ctx.font='15px serif';ctx.textAlign='center';
  ctx.fillText('💝',x+16,y-12);ctx.fillText('💍',x+w-16,y-12);ctx.textAlign='left';
  drawRoofSign(cx2,y-56,'💝 '+b.label,'#d84f8f');},
 salon(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#e8d0e8';rr(x,y-30,w,h+30,8);ctx.fill();
  ctx.fillStyle='#b06aa8';ctx.beginPath();ctx.moveTo(x-8,y-26);ctx.lineTo(cx2,y-48);ctx.lineTo(x+w+8,y-26);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff0fa';rr(x+w/2-14,y+h-30,28,30,4);ctx.fill();
  // 紅白藍旋轉燈
  ctx.fillStyle='#fff';rr(x+4,y-8,6,20,3);ctx.fill();
  ctx.fillStyle='#e2574c';for(let i=0;i<3;i++)ctx.fillRect(x+4,y-6+((i*7+tGlobal*20)%20),6,3);
  ctx.font='15px serif';ctx.textAlign='center';ctx.fillText('💇',x+w-16,y-10);ctx.textAlign='left';
  drawRoofSign(cx2,y-54,'💇 '+b.label,'#b06aa8');},
 accshop(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#f5e0c0';rr(x,y-30,w,h+30,8);ctx.fill();
  ctx.fillStyle='#d8a850';ctx.beginPath();ctx.moveTo(x-8,y-26);ctx.lineTo(cx2,y-48);ctx.lineTo(x+w+8,y-26);ctx.closePath();ctx.fill();
  for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#c94f8f':'#fff';
    ctx.beginPath();ctx.moveTo(x+i*w/4,y-6);ctx.lineTo(x+(i+1)*w/4,y-6);
    ctx.lineTo(x+(i+1)*w/4,y+6);ctx.arc(x+(i+0.5)*w/4,y+6,w/8,0,Math.PI);ctx.closePath();ctx.fill();}
  ctx.font='15px serif';ctx.textAlign='center';ctx.fillText('💍',x+14,y-10);ctx.fillText('👑',x+w-14,y-10);ctx.textAlign='left';
  drawRoofSign(cx2,y-54,'💝 '+b.label,'#c98a3a');},
 shoeshop(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#d8e4ec';rr(x,y-30,w,h+30,8);ctx.fill();
  ctx.fillStyle='#6a8aa8';ctx.beginPath();ctx.moveTo(x-8,y-26);ctx.lineTo(cx2,y-48);ctx.lineTo(x+w+8,y-26);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff';rr(x+8,y-12,20,16,3);ctx.fill();rr(x+w-28,y-12,20,16,3);ctx.fill();
  ctx.fillStyle='#e2574c';ctx.font='13px serif';ctx.fillText('👟',x+10,y);ctx.fillText('👠',x+w-24,y);
  drawRoofSign(cx2,y-54,'👟 '+b.label,'#4a6f8f');},
 clothshop(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#f0e0ec';rr(x,y-32,w,h+32,8);ctx.fill();
  ctx.fillStyle='#c06a9a';ctx.beginPath();ctx.moveTo(x-8,y-28);ctx.lineTo(cx2,y-52);ctx.lineTo(x+w+8,y-28);ctx.closePath();ctx.fill();
  // 櫥窗（兩個假人剪影）
  ctx.fillStyle='#fff6fb';rr(x+6,y-16,22,20,4);ctx.fill();rr(x+w-28,y-16,22,20,4);ctx.fill();
  ctx.fillStyle='#c06a9a';ctx.beginPath();ctx.arc(x+17,y-8,4,0,7);ctx.fill();ctx.fillRect(x+13,y-4,8,10);
  ctx.fillStyle='#7ec8e8';ctx.beginPath();ctx.arc(x+w-17,y-8,4,0,7);ctx.fill();
  ctx.beginPath();ctx.moveTo(x+w-21,y-4);ctx.lineTo(x+w-13,y-4);ctx.lineTo(x+w-11,y+6);ctx.lineTo(x+w-23,y+6);ctx.closePath();ctx.fill();
  ctx.fillStyle='#8a5a3a';rr(cx2-11,y+h-28,22,28,3);ctx.fill();
  ctx.font='14px serif';ctx.textAlign='center';ctx.fillText('👗',cx2,y-34);ctx.textAlign='left';
  drawRoofSign(cx2,y-58,'👗 '+b.label,'#c06a9a');},
 weaponshop(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#2b2b30';rr(x,y-34,w,h+34,6);ctx.fill(); // 黑色店面
  ctx.strokeStyle='#4a1f1f';ctx.lineWidth=2;rr(x,y-34,w,h+34,6);ctx.stroke();
  ctx.fillStyle='#1a1a1e';ctx.beginPath();ctx.moveTo(x-8,y-30);ctx.lineTo(cx2,y-52);ctx.lineTo(x+w+8,y-30);ctx.closePath();ctx.fill(); // 屋頂
  ctx.fillStyle='#8a1f1f';for(let i=0;i<Math.floor(w/14);i++){ctx.beginPath(); // 紅遮陽棚
    ctx.moveTo(x+i*14,y-18);ctx.lineTo(x+i*14+14,y-18);ctx.lineTo(x+i*14+7,y-10);ctx.closePath();ctx.fill();}
  ctx.fillStyle='#3a3a42';rr(x+6,y-14,20,16,2);ctx.fill(); // 鐵窗
  ctx.strokeStyle='#6a6a72';ctx.lineWidth=1;for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo(x+6+k*7,y-14);ctx.lineTo(x+6+k*7,y+2);ctx.stroke();}
  ctx.fillStyle='#111';rr(cx2+2,y+h-26,20,26,3);ctx.fill(); // 黑門
  ctx.font='15px serif';ctx.textAlign='center';ctx.fillText('🔫',x+w-16,y-2);ctx.textAlign='left';
  drawRoofSign(cx2,y-58,'🔫 '+b.label,'#8a1f1f');},
 airport(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#dfe6ee';rr(x,y-30,w,h+30,6);ctx.fill(); // 航廈
  ctx.fillStyle='#b9c4d0';ctx.beginPath();ctx.moveTo(x-6,y-30);ctx.quadraticCurveTo(cx2,y-52,x+w+6,y-30);ctx.lineTo(x+w+6,y-24);ctx.quadraticCurveTo(cx2,y-46,x-6,y-24);ctx.closePath();ctx.fill(); // 弧形屋頂
  ctx.fillStyle=isNight()?'#ffe6a0':'#cfe3f5';for(let i=0;i<5;i++)rr(x+7+i*(w-14)/5,y-10,(w-14)/5-4,14,2),ctx.fill(); // 玻璃帷幕
  ctx.fillStyle='#8a95a2';rr(x+w-14,y-64,7,34,2);ctx.fill(); // 塔台桿
  ctx.fillStyle='#4a5563';rr(x+w-20,y-74,19,14,3);ctx.fill();
  ctx.fillStyle=isNight()?'#ffd97a':'#bfe0ff';rr(x+w-17,y-71,13,7,2);ctx.fill();
  // 小飛機
  ctx.save();ctx.translate(x+16,y-52+Math.sin(tGlobal*1.5)*2);ctx.fillStyle='#eef2f6';
  ctx.beginPath();ctx.ellipse(0,0,13,4,0,0,7);ctx.fill();
  ctx.beginPath();ctx.moveTo(-2,0);ctx.lineTo(-9,-7);ctx.lineTo(-4,0);ctx.fill();
  ctx.fillStyle='#3f6fd6';ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(10,6);ctx.lineTo(6,0);ctx.fill();ctx.restore();
  drawRoofSign(cx2,y-88,'✈️ '+b.label,'#3f6f8f');},
 greatwall(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#b8ac96';ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x,y-6);ctx.lineTo(cx2,y-24);ctx.lineTo(x+w,y-6);ctx.lineTo(x+w,y+h);ctx.closePath();ctx.fill(); // 城牆隨山起伏
  ctx.fillStyle='#9c9078';for(let i=0;i<7;i++){const bx=x+2+i*(w-4)/7;rr(bx,y-8-Math.sin(i/6*Math.PI)*16,(w-4)/7-2,7,1);ctx.fill();} // 雉堞
  ctx.fillStyle='#8a7e68';rr(cx2-13,y-46,26,40,2);ctx.fill(); // 烽火台
  ctx.fillStyle='#6f6552';rr(cx2-13,y-52,26,7,1);ctx.fill();
  ctx.fillStyle='#3a3126';rr(cx2-5,y-20,10,14,2);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(x,y+i*h/4);ctx.lineTo(x+w,y+i*h/4);ctx.stroke();}
  drawRoofSign(cx2,y-66,b.label,'#8a6b3a');},
 tiananmen(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#b83b2e';rr(x,y-30,w,h+30,3);ctx.fill(); // 紅色城樓
  ctx.fillStyle='#e0b83a';ctx.beginPath();ctx.moveTo(x-8,y-30);ctx.lineTo(cx2,y-52);ctx.lineTo(x+w+8,y-30);ctx.closePath();ctx.fill(); // 金黃屋頂
  ctx.fillStyle='#c9a02a';ctx.beginPath();ctx.moveTo(x+4,y-40);ctx.lineTo(cx2,y-58);ctx.lineTo(x+w-4,y-40);ctx.closePath();ctx.fill();
  ctx.fillStyle='#7a1f18';for(let i=0;i<3;i++){rr(x+8+i*(w-16)/2.4,y-14,20,h+14,2);ctx.fill();} // 拱門
  ctx.fillStyle='#f2d98a';for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(x+8+i*(w-16)/4,y-22,2,0,7);ctx.fill();} // 燈籠/裝飾
  drawRoofSign(cx2,y-70,b.label,'#b83b2e');},
 orientalpearl(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.strokeStyle='#9aa6b6';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx2-6,y+h);ctx.lineTo(cx2-3,y-120);ctx.moveTo(cx2+6,y+h);ctx.lineTo(cx2+3,y-120);ctx.stroke(); // 三柱
  ctx.strokeStyle='#c0c9d6';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx2,y+h);ctx.lineTo(cx2,y-132);ctx.stroke();
  const g=ctx.createRadialGradient(cx2-5,y-58,3,cx2,y-52,20);g.addColorStop(0,'#f4a6c8');g.addColorStop(1,'#c0507f');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx2,y-52,19,0,7);ctx.fill(); // 大球
  const g2=ctx.createRadialGradient(cx2-3,y-102,2,cx2,y-98,12);g2.addColorStop(0,'#f4a6c8');g2.addColorStop(1,'#c0507f');
  ctx.fillStyle=g2;ctx.beginPath();ctx.arc(cx2,y-98,11,0,7);ctx.fill(); // 小球
  ctx.fillStyle='#e2574c';ctx.beginPath();ctx.arc(cx2,y-132,3,0,7);ctx.fill();
  drawRoofSign(cx2,y-150,b.label,'#c0507f');},
 terracotta(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#8a6b4a';rr(x-2,y-10,w+4,h+10,3);ctx.fill(); // 坑
  ctx.fillStyle='#c9a878';rr(x+3,y-4,w-6,h,2);ctx.fill(); // 土色地
  ctx.strokeStyle='#8a6b4a';ctx.lineWidth=2;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(x+3+i*(w-6)/4,y-4);ctx.lineTo(x+3+i*(w-6)/4,y+h-4);ctx.stroke();} // 隔道
  ctx.fillStyle='#a08258';for(let c=0;c<4;c++)for(let r2=0;r2<3;r2++){ // 兵馬俑
    const sx=x+9+c*(w-14)/4, sy=y+2+r2*(h-6)/3;
    ctx.beginPath();ctx.arc(sx,sy-4,2.4,0,7);ctx.fill();rr(sx-2.2,sy-2,4.4,7,1.5);ctx.fill();}
  drawRoofSign(cx2,y-24,b.label,'#8a6b4a');},
 pandabase(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#8fbf5a';rr(x,y-6,w,h+6,8);ctx.fill(); // 草地平台
  ctx.strokeStyle='#4e8a3f';ctx.lineWidth=3;ctx.lineCap='round'; // 竹林
  for(let i=0;i<5;i++){const bx=x+5+i*(w-10)/5;ctx.beginPath();ctx.moveTo(bx,y+h-4);ctx.lineTo(bx-2,y-30-i%2*6);ctx.stroke();
    ctx.fillStyle='#6ab04a';ctx.beginPath();ctx.ellipse(bx-4,y-28-i%2*6,5,2,-0.6,0,7);ctx.fill();}ctx.lineCap='butt';
  // 熊貓
  const px=cx2, py=y+h-12;
  ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(px,py,11,9,0,0,7);ctx.fill();ctx.beginPath();ctx.arc(px,py-11,8,0,7);ctx.fill();
  ctx.fillStyle='#2a2a2a';ctx.beginPath();ctx.arc(px-6,py-15,3,0,7);ctx.arc(px+6,py-15,3,0,7);ctx.fill(); // 耳
  ctx.beginPath();ctx.ellipse(px-4,py-11,2.4,3,0.3,0,7);ctx.ellipse(px+4,py-11,2.4,3,-0.3,0,7);ctx.fill(); // 黑眼圈
  ctx.beginPath();ctx.ellipse(px-9,py+1,3.5,4,0.5,0,7);ctx.ellipse(px+9,py+1,3.5,4,-0.5,0,7);ctx.fill(); // 手
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px-4,py-11,1,0,7);ctx.arc(px+4,py-11,1,0,7);ctx.fill();
  drawRoofSign(cx2,y-40,'🐼 '+b.label,'#3f8f5a');},
 petshop(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#ffe1ec';rr(x,y-30,w,h+30,7);ctx.fill(); // 粉色店面
  ctx.fillStyle='#f7a8c4';ctx.beginPath();ctx.moveTo(x-6,y-28);ctx.lineTo(cx2,y-50);ctx.lineTo(x+w+6,y-28);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(x+10+i*(w-20)/2,y-10,7,0,7);ctx.fill();} // 櫥窗
  ctx.fillStyle='#8a5a3a';rr(cx2-9,y+h-22,18,22,3);ctx.fill(); // 門
  // 貓狗招牌
  ctx.font='15px serif';ctx.textAlign='center';
  ctx.fillText('🐕',x+13,y-6+Math.sin(tGlobal*2)*1.5);ctx.fillText('🐈',x+w-13,y-6+Math.sin(tGlobal*2+1)*1.5);ctx.textAlign='left';
  drawRoofSign(cx2,y-56,'🐾 '+b.label,'#e0559b');},
 cityhall(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#f0ede4';rr(x,y-40,w,h+40,4);ctx.fill(); // 政府大樓
  ctx.fillStyle='#d5d0c2';ctx.fillRect(x-6,y-44,w+12,8);
  for(let i=0;i<5;i++){ctx.fillStyle='#e2ddd0';ctx.fillRect(x+5+i*(w-14)/4,y-36,6,h+36);} // 柱列
  ctx.fillStyle='#c4beac';ctx.beginPath(); // 三角楣
  ctx.moveTo(x-6,y-44);ctx.lineTo(cx2,y-62);ctx.lineTo(x+w+6,y-44);ctx.closePath();ctx.fill();
  ctx.fillStyle='#5a5548';ctx.fillRect(cx2-1.5,y-84,3,24); // 旗桿＋旗
  ctx.fillStyle='#c94f43';ctx.beginPath();const fw=Math.sin(tGlobal*3)*2;
  ctx.moveTo(cx2+1.5,y-84);ctx.lineTo(cx2+20,y-80+fw);ctx.lineTo(cx2+1.5,y-74);ctx.closePath();ctx.fill();
  ctx.fillStyle='#cfe3f5';for(let i=0;i<3;i++)rr(x+10+i*(w-30)/2,y-4,18,16,3),ctx.fill(); // 窗
  ctx.fillStyle='#7a6a52';rr(cx2-13,y+h-30,26,30,3);ctx.fill(); // 大門
  drawRoofSign(cx2,y-74,'🏛️ '+b.label,'#3f5f8f');},
 magicschool(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#8a8296';rr(x,y-30,w,h+30,5);ctx.fill(); // 石造塔身
  ctx.strokeStyle='#6a6478';ctx.lineWidth=1.5;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x,y-24+i*16);ctx.lineTo(x+w,y-24+i*16);ctx.stroke();} // 石縫
  ctx.fillStyle='#4a3a6a';ctx.beginPath(); // 高聳尖塔屋頂
  ctx.moveTo(x-10,y-26);ctx.lineTo(cx2,y-86);ctx.lineTo(x+w+10,y-26);ctx.closePath();ctx.fill();
  ctx.fillStyle='#3a2d55';ctx.beginPath(); // 小尖塔
  ctx.moveTo(x+w-18,y-24);ctx.lineTo(x+w-8,y-58);ctx.lineTo(x+w+2,y-24);ctx.closePath();ctx.fill();
  const gl=isNight()?0.9:0.55+0.25*Math.sin(tGlobal*2);
  ctx.fillStyle=`rgba(255,214,110,${gl})`; // 發光尖拱窗
  ctx.beginPath();ctx.moveTo(x+12,y+4);ctx.lineTo(x+12,y-10);ctx.arc(x+19,y-10,7,Math.PI,0);ctx.lineTo(x+26,y+4);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(x+w-26,y+4);ctx.lineTo(x+w-26,y-10);ctx.arc(x+w-19,y-10,7,Math.PI,0);ctx.lineTo(x+w-12,y+4);ctx.closePath();ctx.fill();
  ctx.fillStyle='#4a2f1d';ctx.beginPath(); // 木拱門
  ctx.moveTo(cx2-11,y+h);ctx.lineTo(cx2-11,y+h-20);ctx.arc(cx2,y+h-20,11,Math.PI,0);ctx.lineTo(cx2+11,y+h);ctx.closePath();ctx.fill();
  ctx.font='13px serif';ctx.textAlign='center'; // 漂浮星光
  for(let i=0;i<3;i++)ctx.fillText('✨',cx2-26+i*26,y-92+Math.sin(tGlobal*2+i*2.1)*4);
  ctx.fillText('🦉',x+w-8,y-60);ctx.textAlign='left';
  drawRoofSign(cx2,y-104,'🧙 '+b.label,'#4a3a6a');},
 farm(b){const x=b.x,y=b.y,w=b.w,h=b.h;
  const f=b.farm||{}; const now=gameDay*1440+gameMin;
  ctx.fillStyle='#8a6b3a';rr(x-3,y-3,w+6,h+6,4);ctx.fill(); // 田埂
  ctx.fillStyle='#a5824e';ctx.fillRect(x,y,w,h); // 土壤
  ctx.strokeStyle='#8f6d3d';ctx.lineWidth=3;ctx.lineCap='round';
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x+4,y+8+i*(h-16)/3);ctx.lineTo(x+w-4,y+8+i*(h-16)/3);ctx.stroke();}ctx.lineCap='butt';
  if(f.state==='grow'){ const gr=Math.min(1,(now-f.at)/FARM_GROW);
    ctx.textAlign='center';
    for(let r2=0;r2<4;r2++)for(let c2=0;c2<4;c2++){
      const px3=x+10+c2*(w-20)/3, py3=y+9+r2*(h-16)/3;
      if(gr>=1){ctx.font='15px serif';ctx.fillText('🌾',px3,py3+Math.sin(tGlobal*2+c2)*1.5);}
      else if(gr>0.5){ctx.font='12px serif';ctx.fillText('🌱',px3,py3);}
      else{ctx.strokeStyle='#4e8a3f';ctx.lineWidth=2;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(px3,py3);ctx.lineTo(px3-3,py3-5-gr*6);
        ctx.moveTo(px3,py3);ctx.lineTo(px3+3,py3-5-gr*6);ctx.stroke();ctx.lineCap='butt';}}
    ctx.textAlign='left';
    if(gr>=1){ctx.font='bold 13px "Microsoft JhengHei"';ctx.fillStyle='#c9803a';ctx.textAlign='center';
      ctx.fillText('🌾 可收割！',x+w/2,y-16);ctx.textAlign='left';} }
  // 木牌
  ctx.fillStyle='#7a5a2f';ctx.fillRect(x+w-8,y+h-2,4,10);
  ctx.fillStyle='#b8834a';rr(x+w-20,y+h-14,28,14,3);ctx.fill();
  ctx.font='9px serif';ctx.textAlign='center';ctx.fillText('🌾',x+w-6,y+h-3);ctx.textAlign='left';},
 registry(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#e8ecf0';rr(x,y-38,w,h+38,4);ctx.fill(); // 官方建築
  ctx.fillStyle='#c9ccd2';ctx.fillRect(x-6,y-42,w+12,8);
  for(let i=0;i<4;i++){ctx.fillStyle='#dfe4ea'; // 柱子
    ctx.fillRect(x+6+i*(w-16)/3,y-34,6,h+34);}
  ctx.fillStyle='#b8bdc4';ctx.beginPath(); // 三角楣
  ctx.moveTo(x-6,y-42);ctx.lineTo(cx2,y-60);ctx.lineTo(x+w+6,y-42);ctx.closePath();ctx.fill();
  ctx.fillStyle='#c94f43';ctx.font='11px serif';ctx.textAlign='center';
  ctx.fillText('💒',cx2,y-46);ctx.textAlign='left';
  ctx.fillStyle='#8a6b4a';rr(cx2-12,y+h-30,24,30,3);ctx.fill();
  drawRoofSign(cx2,y-72,'💒 '+b.label,'#4a6f8f');},
 bluetears(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  // 木造觀景台＋欄杆
  ctx.fillStyle='#b8834a';ctx.fillRect(x-4,y+4,w+8,h-4);
  ctx.strokeStyle='#96682f';ctx.lineWidth=2;
  for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x-4,y+10+i*10);ctx.lineTo(x+w+4,y+10+i*10);ctx.stroke();}
  ctx.strokeStyle='#8a6a3a';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(x-4,y+4);ctx.lineTo(x+w+4,y+4);ctx.stroke();
  for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(x-4+(w+8)*i/4,y+4);ctx.lineTo(x-4+(w+8)*i/4,y-8);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(x-4,y-8);ctx.lineTo(x+w+4,y-8);ctx.stroke();
  // 小燈籠
  ctx.fillStyle=isNight()?'#ffd97a':'#e8e0c8';ctx.beginPath();ctx.arc(x+w+6,y-12,4,0,7);ctx.fill();
  // 夜晚：掃描附近真正的海面格，湧現藍眼淚
  if(isNight()){
    if(!b.seaPts){ b.seaPts=[];
      for(let dy=-9;dy<=9;dy++)for(let dx=-9;dx<=9;dx++){
        const tx2=b.tx+1+dx, ty2=b.ty+1+dy;
        if(Math.hypot(dx,dy)<=9&&T(tx2,ty2)===SEA)
          b.seaPts.push([(tx2+0.5)*TILE,(ty2+0.5)*TILE,Math.hypot(dx,dy)]);}
      b.seaPts.sort((p,q)=>p[2]-q[2]); b.seaPts=b.seaPts.slice(0,16);}
    b.seaPts.forEach((pt2,k)=>{
      const gx=pt2[0]+Math.sin(tGlobal*0.7+k*2)*10, gy=pt2[1]+Math.cos(tGlobal*0.9+k)*8;
      const tw2=0.35+0.5*Math.abs(Math.sin(tGlobal*1.6+k*1.3));
      const g=ctx.createRadialGradient(gx,gy,1,gx,gy,11+4*Math.sin(tGlobal+k));
      g.addColorStop(0,`rgba(120,235,255,${tw2})`);g.addColorStop(1,'rgba(120,235,255,0)');
      ctx.fillStyle=g;ctx.fillRect(gx-16,gy-16,32,32);
      ctx.fillStyle=`rgba(210,250,255,${tw2})`;ctx.fillRect(gx-1.2,gy-1.2,2.4,2.4);});}
  drawRoofSign(cx2,y-26,'💧 '+b.label,'#2f6f9f');},
 person(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  // 溫馨的木牌＋花圃
  ctx.fillStyle='#8a6b3a';ctx.fillRect(cx2-3,y-18,6,h+18);
  ctx.fillStyle='#a5824a';rr(cx2-34,y-40,68,26,6);ctx.fill();
  ctx.strokeStyle='#7a5a2f';ctx.lineWidth=2;rr(cx2-34,y-40,68,26,6);ctx.stroke();
  ctx.fillStyle='#fff7e0';ctx.font='bold 12px "Microsoft JhengHei"';ctx.textAlign='center';
  ctx.fillText(b.label,cx2,y-22);ctx.textAlign='left';
  const fc=['#f26d7d','#f9c74f','#fff','#c77dff'];
  for(let i=0;i<5;i++){ctx.fillStyle=fc[i%4];
    ctx.beginPath();ctx.arc(x+6+i*((w-12)/4),y+h-6,4,0,7);ctx.fill();
    ctx.fillStyle='#f9c74f';ctx.beginPath();ctx.arc(x+6+i*((w-12)/4),y+h-6,1.6,0,7);ctx.fill();}
  ctx.fillStyle='#e2574c';ctx.font='13px serif';ctx.fillText('💗',cx2+26,y-44);},
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
 house(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  // 小巧民宅（約人高）：牆＋斜屋頂＋門窗＋小招牌
  ctx.fillStyle=b.wall||'#ecd6b2';rr(x,y-13,w,h+13,4);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.1)';ctx.lineWidth=1;rr(x,y-13,w,h+13,4);ctx.stroke();
  ctx.fillStyle=b.roof||'#c9705f';ctx.beginPath(); // 斜屋頂
  ctx.moveTo(x-6,y-11);ctx.lineTo(cx2,y-30);ctx.lineTo(x+w+6,y-11);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.12)';ctx.beginPath();ctx.moveTo(x-6,y-11);ctx.lineTo(cx2,y-30);ctx.lineTo(x+w+6,y-11);ctx.stroke();
  ctx.fillStyle='#7a4a22';rr(cx2-7,y+h-17,14,17,3);ctx.fill(); // 門
  ctx.fillStyle='#f2c94c';ctx.beginPath();ctx.arc(cx2+3,y+h-8,1.3,0,7);ctx.fill(); // 門把
  ctx.fillStyle=isNight()?'#ffe6a0':'#cfe3f5'; // 窗
  rr(x+5,y-7,11,10,2);ctx.fill();rr(x+w-16,y-7,11,10,2);ctx.fill();
  ctx.strokeStyle='#b88a5a';ctx.lineWidth=1;
  ctx.strokeRect(x+5,y-7,11,10);ctx.strokeRect(x+w-16,y-7,11,10);
  },  // v42 民宅不再顯示姓氏名牌
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
 waterfall(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;
  ctx.fillStyle='#8b8f7c';ctx.beginPath();
  ctx.moveTo(x-6,y+h);ctx.lineTo(x,y-40);ctx.lineTo(x+w,y-40);ctx.lineTo(x+w+6,y+h);ctx.closePath();ctx.fill();
  ctx.fillStyle='#7a7f6e';ctx.fillRect(x,y-40,w,6);
  const gold=b.label.includes('黃金');
  let g=ctx.createLinearGradient(cx2,y-36,cx2,y+h);
  g.addColorStop(0,gold?'rgba(240,200,120,.95)':'rgba(220,240,250,.95)');
  g.addColorStop(1,gold?'rgba(220,170,90,.8)':'rgba(160,210,235,.8)');
  ctx.fillStyle=g;ctx.fillRect(cx2-14,y-36,28,h+36);
  ctx.fillStyle='rgba(255,255,255,.7)';
  for(let i=0;i<4;i++){const fy=((tGlobal*90+i*30)% (h+36));
    ctx.fillRect(cx2-12+((i*7)%22),y-36+fy,3,10);}
  ctx.fillStyle=gold?'rgba(230,190,110,.6)':'rgba(190,225,245,.7)';
  ctx.beginPath();ctx.ellipse(cx2,y+h,w/2+8,10,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.5)';
  for(let i=0;i<3;i++){const ph=(tGlobal*0.8+i*0.33)%1;
    ctx.beginPath();ctx.arc(cx2-16+i*16,y+h-4-ph*14,4+ph*4,0,7);ctx.fill();}
  drawRoofSign(cx2,y+h+22,b.label,'#3f6f8f');},
 catvillage(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#c98a6a';rr(x,y-22,w,h+22,4);ctx.fill();
  ctx.fillStyle='#8a8078';ctx.beginPath();
  ctx.moveTo(x-8,y-20);ctx.lineTo(x+w/2,y-40);ctx.lineTo(x+w+8,y-20);ctx.closePath();ctx.fill();
  ctx.fillStyle='#6a4a3a';rr(x+w/2-11,y+h-28,22,28,3);ctx.fill();
  ctx.font='16px serif';
  ctx.fillText('🐱',x+4,y-24);ctx.fillText('🐱',x+w-20,y+2);ctx.fillText('🐈',x+w/2-8,y+h-32);
  drawRoofSign(x+w/2,y-52,b.label,'#8a5a3a');},
 ferris(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2,cy2=y-46;bShadow(x,y+h,w);
  ctx.strokeStyle='#8a8a94';ctx.lineWidth=5;
  ctx.beginPath();ctx.moveTo(cx2-20,y+h);ctx.lineTo(cx2,cy2);ctx.lineTo(cx2+20,y+h);ctx.stroke();
  const a0=tGlobal*0.25;
  ctx.strokeStyle='#b8b8c2';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(cx2,cy2,38,0,7);ctx.stroke();
  const cols=['#e2574c','#f2c94c','#4f9fc0','#3f8f5a','#c77dff','#f2994a'];
  for(let i=0;i<6;i++){const a=a0+i*Math.PI/3;
    ctx.strokeStyle='#b8b8c2';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(cx2,cy2);ctx.lineTo(cx2+Math.cos(a)*38,cy2+Math.sin(a)*38);ctx.stroke();
    ctx.fillStyle=cols[i];rr(cx2+Math.cos(a)*38-7,cy2+Math.sin(a)*38-4,14,14,5);ctx.fill();}
  ctx.fillStyle='#8a8a94';ctx.beginPath();ctx.arc(cx2,cy2,6,0,7);ctx.fill();
  drawRoofSign(cx2,y+h+20,'🎡 '+b.label,'#c9500f');},
 rainbowhouse(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#f0ead8';rr(x,y-24,w,h+24,4);ctx.fill();
  const cols=['#e2574c','#f2994a','#f2c94c','#3f8f5a','#4f9fc0','#c77dff'];
  for(let i=0;i<8;i++){ctx.fillStyle=cols[i%6];
    ctx.beginPath();ctx.arc(x+8+((i*23)%(w-16)),y-12+((i*17)%(h+8)),5,0,7);ctx.fill();}
  ctx.strokeStyle='#e2574c';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(x+w/2,y+h-6,16,Math.PI,0);ctx.stroke();
  ctx.strokeStyle='#f2c94c';ctx.beginPath();ctx.arc(x+w/2,y+h-6,11,Math.PI,0);ctx.stroke();
  ctx.strokeStyle='#4f9fc0';ctx.beginPath();ctx.arc(x+w/2,y+h-6,6,Math.PI,0);ctx.stroke();
  ctx.fillStyle='#8a8078';ctx.beginPath();
  ctx.moveTo(x-6,y-22);ctx.lineTo(x+w/2,y-38);ctx.lineTo(x+w+6,y-22);ctx.closePath();ctx.fill();
  drawRoofSign(x+w/2,y-50,b.label,'#c77dff');},
 saltmtn(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w+10);
  let g=ctx.createLinearGradient(cx2-30,y,cx2+30,y);
  g.addColorStop(0,'#ffffff');g.addColorStop(0.5,'#f0f0ea');g.addColorStop(1,'#d8d8d0');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(cx2-34,y+h);ctx.lineTo(cx2,y-44);ctx.lineTo(cx2+34,y+h);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.1)';ctx.lineWidth=2;ctx.stroke();
  ctx.strokeStyle='#c8c8c0';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(cx2,y-40);ctx.lineTo(cx2-10,y+h);ctx.moveTo(cx2+4,y-30);ctx.lineTo(cx2+16,y+h);ctx.stroke();
  drawRoofSign(cx2,y+h+20,b.label,'#8a8a80');},
 rockform(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  if(b.steam)for(let i=0;i<3;i++){const ph=(tGlobal*0.5+i*0.33)%1;
    ctx.fillStyle=`rgba(240,240,235,${0.4*(1-ph)})`;
    ctx.beginPath();ctx.arc(x+w*0.4+i*12+Math.sin(tGlobal*2+i)*4,y-30-ph*46,8+ph*9,0,7);ctx.fill();}
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
 prison(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#9a9a94';rr(x,y-34,w,h+34,4);ctx.fill(); // 灰色高牆
  ctx.fillStyle='#8a8a84';ctx.fillRect(x,y-34,w,6);
  ctx.strokeStyle='#7a7a74';ctx.lineWidth=1;
  for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(x,y-34+i*((h+34)/4));ctx.lineTo(x+w,y-34+i*((h+34)/4));ctx.stroke();}
  // 鐵窗
  ctx.fillStyle='#3a3a3a';
  for(const wx of [x+w*0.2,x+w*0.55]){rr(wx-10,y-22,20,16,2);ctx.fill();}
  ctx.strokeStyle='#6a6a64';ctx.lineWidth=1.5;
  for(const wx of [x+w*0.2,x+w*0.55]){for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo(wx-10+k*7,y-22);ctx.lineTo(wx-10+k*7,y-6);ctx.stroke();}}
  // 大鐵門
  ctx.fillStyle='#4a4a48';rr(x+w-30,y+h-32,24,32,3);ctx.fill();
  ctx.strokeStyle='#2a2a28';ctx.lineWidth=1.5;
  for(let k=1;k<4;k++){ctx.beginPath();ctx.moveTo(x+w-30+k*6,y+h-32);ctx.lineTo(x+w-30+k*6,y+h);ctx.stroke();}
  // 瞭望塔
  ctx.fillStyle='#8a8a84';rr(x-6,y-58,20,28,3);ctx.fill();
  ctx.fillStyle='#5a5a54';ctx.beginPath();ctx.moveTo(x-10,y-58);ctx.lineTo(x+4,y-70);ctx.lineTo(x+18,y-58);ctx.closePath();ctx.fill();
  ctx.fillStyle=isNight()?'#ffe9a0':'#cfe3f5';rr(x-2,y-52,12,10,2);ctx.fill();
  // 頂端鐵絲網
  ctx.strokeStyle='#b0b0aa';ctx.lineWidth=1;
  for(let k=0;k<Math.floor(w/8);k++){ctx.beginPath();ctx.arc(x+4+k*8,y-34,3,Math.PI,0);ctx.stroke();}
  drawRoofSign(x+w/2,y-84,'🚔 '+b.label,'#5a5a54');},
 eatery(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#e8d0a8';rr(x,y-26,w,h+26,5);ctx.fill();
  ctx.fillStyle='#c9503f';ctx.beginPath();
  ctx.moveTo(x-6,y-24);ctx.lineTo(x+w/2,y-40);ctx.lineTo(x+w+6,y-24);ctx.closePath();ctx.fill();
  ctx.fillStyle='#7a4a22';rr(x+w/2-10,y+h-26,20,26,4);ctx.fill();
  ctx.fillStyle='#ffe9b0';rr(x+6,y-14,20,16,3);ctx.fill();
  // 招牌食物大圖案（立牌）
  ctx.fillStyle='#fff7e0';ctx.beginPath();ctx.arc(x+w-14,y-4,13,0,7);ctx.fill();
  ctx.strokeStyle='#c9503f';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+w-14,y-4,13,0,7);ctx.stroke();
  ctx.font='16px serif';ctx.textAlign='center';
  ctx.fillText(b.icon||'🍜',x+w-14,y+2);
  ctx.font='15px serif';
  ctx.fillText(b.icon||'🍜',x+w/2,y-46+Math.sin(tGlobal*2+x)*2); // 屋頂招牌旁飄浮
  ctx.textAlign='left';
  ctx.fillStyle='#e2574c';ctx.beginPath();ctx.arc(x+2,y-20,5,0,7);ctx.fill();
  drawRoofSign(x+w/2,y-58,(b.icon||'')+b.label,'#c9503f');},
 hotel(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  ctx.fillStyle='#e8dcc8';rr(x,y-58,w,h+58,6);ctx.fill();
  ctx.strokeStyle='#c8b89a';ctx.lineWidth=1.5;rr(x,y-58,w,h+58,6);ctx.stroke();
  ctx.fillStyle='#6a8aa8';ctx.fillRect(x-5,y-62,w+10,8);
  for(let r2=0;r2<3;r2++)for(let c2=0;c2<3;c2++){
    ctx.fillStyle=isNight()&&hsh(r2,c2+b.tx)>0.4?'#ffe9a0':'#cfe3f5';
    rr(x+8+c2*(w-16)/3,y-48+r2*22,(w-16)/3-6,14,3);ctx.fill();}
  ctx.fillStyle='#7a4a22';rr(x+w/2-12,y+h-30,24,30,4);ctx.fill();
  ctx.font='12px serif';ctx.fillText('🛏️',x+w-20,y+h-8);
  drawRoofSign(x+w/2,y-74,'🏨 '+b.label,'#6a8aa8');},
 myhome(b){const x=b.x,y=b.y,w=b.w,h=b.h;bShadow(x,y+h,w);
  const wl=isNight()?'#ffe9a0':'#cfe3f5';
  if(b.htype==='courtyard'){ // 三合院
    ctx.fillStyle='#c98a6a';rr(x,y-22,w*0.3,h+22,4);ctx.fill();rr(x+w*0.7,y-22,w*0.3,h+22,4);ctx.fill();
    rr(x+w*0.2,y-30,w*0.6,h*0.6+30,4);ctx.fill();
    ctx.fillStyle='#8a5a4a';
    ctx.beginPath();ctx.moveTo(x+w*0.15,y-28);ctx.lineTo(x+w/2,y-48);ctx.lineTo(x+w*0.85,y-28);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#6a4534';ctx.lineWidth=2; // 燕尾脊
    ctx.beginPath();ctx.moveTo(x+w*0.15,y-28);ctx.quadraticCurveTo(x+w*0.1,y-38,x+w*0.08,y-42);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+w*0.85,y-28);ctx.quadraticCurveTo(x+w*0.9,y-38,x+w*0.92,y-42);ctx.stroke();
    ctx.fillStyle='#7a4a22';rr(x+w/2-11,y+h*0.6-26,22,26,3);ctx.fill();
    ctx.fillStyle=wl;rr(x+6,y-12,14,12,2);ctx.fill();rr(x+w-20,y-12,14,12,2);ctx.fill();
    ctx.fillStyle='#d8cba8';ctx.fillRect(x+w*0.28,y+h*0.62,w*0.44,h*0.3); // 埕
  } else if(b.htype==='villa'){ // 歐風別墅
    ctx.fillStyle='#f5f0e6';rr(x,y-46,w,h+46,6);ctx.fill();
    ctx.fillStyle='#e2884c';ctx.beginPath();
    ctx.moveTo(x-8,y-42);ctx.lineTo(x+w/2,y-66);ctx.lineTo(x+w+8,y-42);ctx.closePath();ctx.fill();
    ctx.fillStyle=wl;
    rr(x+8,y-36,18,14,3);ctx.fill();rr(x+w-26,y-36,18,14,3);ctx.fill();
    rr(x+8,y-10,18,14,3);ctx.fill();rr(x+w-26,y-10,18,14,3);ctx.fill();
    ctx.fillStyle='#8a5a3a';rr(x+w/2-12,y+h-34,24,34,10);ctx.fill();
    ctx.strokeStyle='#c8b89a';ctx.lineWidth=2; // 小圍籬
    for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(x-10+i*4,y+h-2);ctx.lineTo(x-10+i*4,y+h-10);ctx.stroke();}
    ctx.font='11px serif';ctx.fillText('🌹',x+2,y+h-4);ctx.fillText('🌹',x+w-14,y+h-4);
  } else if(b.htype==='tower'){ // 豪華高樓
    let g=ctx.createLinearGradient(x,y-110,x,y+h);
    g.addColorStop(0,'#8a9ab0');g.addColorStop(1,'#5f6f85');
    ctx.fillStyle=g;rr(x+4,y-110,w-8,h+110,5);ctx.fill();
    for(let r2=0;r2<6;r2++)for(let c2=0;c2<3;c2++){
      ctx.fillStyle=isNight()&&hsh(r2*3+c2,b.tx)>0.35?'#ffe9a0':'#cfe3f5';
      rr(x+10+c2*(w-20)/3,y-102+r2*20,(w-20)/3-5,12,2);ctx.fill();}
    ctx.fillStyle='#4a5a70';ctx.fillRect(x,y-116,w,8);
    ctx.fillStyle='#7a4a22';rr(x+w/2-11,y+h-30,22,30,3);ctx.fill();
  } else { // 小木屋（原版）
    ctx.fillStyle='#f2e2c8';rr(x,y-30,w,h+30,6);ctx.fill();
    ctx.fillStyle='#c9705f';ctx.beginPath();
    ctx.moveTo(x-8,y-26);ctx.lineTo(x+w/2,y-52);ctx.lineTo(x+w+8,y-26);ctx.closePath();ctx.fill();
    ctx.fillStyle='#7a4a22';rr(x+w/2-12,y+h-32,24,32,4);ctx.fill();
    ctx.fillStyle=wl;rr(x+8,y-16,20,16,3);ctx.fill();rr(x+w-28,y-16,20,16,3);ctx.fill();
    ctx.font='11px serif';ctx.fillText('🌼',x+4,y+h-4);ctx.fillText('🌼',x+w-16,y+h-4);
  }
  drawRoofSign(x+w/2,y-(b.htype==='tower'?128:b.htype==='villa'?78:64),'🏠 '+b.label,'#c9705f');},
 cablecar(b){const x=b.x,y=b.y,w=b.w,h=b.h,cx2=x+w/2;bShadow(x,y+h,w);
  ctx.fillStyle='#f3ead1';rr(x,y-20,w,h+20,6);ctx.fill();
  ctx.fillStyle='#c9500f';ctx.beginPath();ctx.moveTo(x-8,y-16);ctx.lineTo(cx2,y-40);ctx.lineTo(x+w+8,y-16);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#6a5a4a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx2,y-40);ctx.lineTo(cx2,y-66);ctx.stroke();
  ctx.fillStyle='#6a5a4a';ctx.beginPath();ctx.arc(cx2,y-66,6,0,7);ctx.fill();
  ctx.fillStyle='#7a4a22';rr(cx2-16,y+h-38,32,38,5);ctx.fill();
  drawRoofSign(cx2,y-80,'🚡 '+b.label,'#c9500f');},
};
let BUILDINGS=[];
function addBuild(t,tx,ty,tw,th,label,extra){
  const b={t,tx,ty,tw,th,label,x:tx*TILE,y:ty*TILE,w:tw*TILE,h:th*TILE,...extra};
  BUILDINGS.push(b);return b;}
// 建築整體縮放（維持美術比例；只縮小非豁免類型）；以底部中心為錨點
const BSCALE=0.62, SCALE_EXEMPT=new Set(['ferris','t101','cablecar','house','myhome']);
function drawBuild(b){ const d=BUILDING_DRAWS[b.t]; if(!d)return;
  const s=b.scale||1;
  if(s===1){ d(b); return; }
  const cx=b.x+b.w/2, by=b.y+b.h;
  ctx.save(); ctx.translate(cx,by); ctx.scale(s,s); ctx.translate(-cx,-by); d(b); ctx.restore(); }
const SIZE={t101:[4,3],shop:[5,3],market:[8,2],teahouse:[4,3],queenhead:[2,2],lantern:[3,2],
  hotspring:[4,3],gate:[4,2],opera:[6,3],windmill:[2,2],buddha:[3,3],temple:[6,4],fort:[5,4],
  redtower:[4,3],pagodas:[6,3],tower85:[3,3],gianttree:[3,3],peak:[2,2],lighthouse:[2,2],
  balloon:[4,3],weir:[4,3],station:[5,3],harbor:[3,3],house:[2,1],
  oldstreet:[6,3],highheel:[3,3],rockform:[4,2],archbridge:[6,2],canoe:[3,2],cablecar:[3,3],
  waterfall:[4,3],catvillage:[3,2],ferris:[4,3],rainbowhouse:[4,2],saltmtn:[3,3],person:[3,2],
  eatery:[3,2],hotel:[4,3],myhome:[4,3],prison:[6,4],bluetears:[2,2],giftshop:[3,3],registry:[4,3],
  salon:[3,3],accshop:[3,3],shoeshop:[3,3],clothshop:[4,3],weaponshop:[3,3],
  cityhall:[4,3],magicschool:[3,3],farm:[2,2],
  airport:[5,3],greatwall:[6,3],tiananmen:[5,3],orientalpearl:[3,4],terracotta:[5,3],pandabase:[4,3],petshop:[3,3]};
LANDMARKS.forEach(L=>{const [tw,th]=SIZE[L.t];addBuild(L.t,L.tx,L.ty,tw,th,L.label,{lines:L.lines,steam:L.steam,isLm:true});});
STATIONS.forEach(s=>addBuild('station',s.tx,s.ty,5,3,s.n));
// 港口自動貼齊海岸線（找最近的「臨陸海面」放置碼頭）
function coastSpot(tx,ty){ for(let r2=0;r2<22;r2++)for(let dy=-r2;dy<=r2;dy++)for(let dx=-r2;dx<=r2;dx++){
  const nx=tx+dx,ny=ty+dy,t=T(nx,ny);
  if((t===SEA||t===LAKE)&&(WALKABLE[T(nx+1,ny)]||WALKABLE[T(nx-1,ny)]||WALKABLE[T(nx,ny+1)]||WALKABLE[T(nx,ny-1)]))
    return [nx,ny];}
  return [tx,ty];}
HARBORS.forEach(h2=>{const [hx,hy]=coastSpot(h2.tx,h2.ty);h2.tx=hx;h2.ty=hy;
  addBuild('harbor',hx,hy,3,3,h2.n,{routes:h2.routes});});
// 美食小店與旅館（自動找平地擺放）
function fitSpot(tx,ty,tw,th){ for(let r=0;r<10;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  const nx=tx+dx,ny=ty+dy; let ok=true;
  for(let yy=0;yy<th&&ok;yy++)for(let xx=0;xx<tw&&ok;xx++){const t=T(nx+xx,ny+yy);
    if(!(t===GRASS||t===FIELD||t===PLAZA||t===PATH||t===SAND))ok=false;}
  if(ok)for(const b of BUILDINGS)if(nx<b.tx+b.tw+1&&nx+tw+1>b.tx&&ny<b.ty+b.th+2&&ny+th+2>b.ty){ok=false;break;}
  if(ok)return [nx,ny];}
  return [tx,ty];}
EATERIES.forEach(e2=>{const [ex,ey]=fitSpot(e2.tx,e2.ty,3,2);
  addBuild('eatery',ex,ey,3,2,e2.label,{food:e2.food,price:e2.price,icon:e2.icon});});
HOTELS.forEach(h3=>{const [hx,hy]=fitSpot(h3.tx,h3.ty,4,3);
  addBuild('hotel',hx,hy,4,3,h3.label);});
CABLECARS.forEach(c=>{
  addBuild('cablecar',Math.round(c.a[0])-1,Math.round(c.a[1])-1,3,3,c.a[2],{line:c,end:'a'});
  addBuild('cablecar',Math.round(c.b[0])-1,Math.round(c.b[1])-1,3,3,c.b[2],{line:c,end:'b'});
});
// 縣市政府（v37）：每縣市一座、設於縣治，可購買農地。座標取自「已放大」的 TOWNS，不經 data.js scale pass
{ const GOV_SEAT={'台北':'信義','新北':'板橋','基隆':'廟口','桃園':'桃園區','新竹':'城隍廟','台中':'逢甲',
    '彰化':'八卦山','雲林':'斗六','嘉義':'文化路','台南':'安平','高雄':'六合','花蓮':'東大門',
    '台東':'鐵花村','澎湖':'馬公','連江':'南竿','金門':'金城'};
  const GOV_FIX={'苗栗':[244,192],'宜蘭':[360,100],'南投':[260,315],'屏東':[288,558]}; // 縣治不在 TOWNS 裡，手放（已放大座標）
  const CITY_SET=new Set(['台北','新北','桃園','台中','台南','高雄','基隆','新竹','嘉義']);
  for(const c of [...new Set(TOWNS.map(t=>t.c))]){ let bx,by;
    if(GOV_FIX[c]){[bx,by]=GOV_FIX[c];}
    else{const tw=TOWNS.find(t=>t.n===GOV_SEAT[c])||TOWNS.find(t=>t.c===c);bx=tw.tx;by=tw.ty;}
    const [cw,ch2]=(c==='連江')?[3,3]:[4,3]; // 南竿島太小，連江縣政府用縮小版
    const [gx,gy]=fitSpot(Math.round(bx)+3,Math.round(by)-2,cw,ch2);
    addBuild('cityhall',gx,gy,cw,ch2,c+(CITY_SET.has(c)?'市政府':'縣政府'),{county:c});} }
// 綠島魔法屋（v37）：職業學習所
{ const gi=TOWNS.find(t=>t.n==='綠島');
  const [mx,my]=fitSpot(Math.round(gi.tx)+4,Math.round(gi.ty)-2,3,3);
  addBuild('magicschool',mx,my,3,3,'綠島魔法屋'); }
// 民宅（各鄉鎮周邊散佈多間小房子，約人身大小、附門牌招牌）
{ rs=SEED+7;
  const SURNAMES=['陳','林','黃','張','李','王','吳','劉','蔡','楊','許','鄭','謝','郭','洪','曾','廖','賴','周','徐'];
  const WALLS=['#ecd6b2','#e6dcc4','#e8cfa8','#f0e2c8','#dfe4d0','#efd9c4'];
  const ROOFS=['#c9705f','#b8604f','#a86a8a','#6f8a9a','#8a6a4a','#c98a3a'];
  const offs=[[-8,-3],[-6,3],[-3,-5],[3,-5],[7,-2],[8,3],[-8,2],[5,4],[-4,5],[2,5],[-9,-1],[9,0],
    [-10,-4],[-2,6],[6,-5],[10,2],[-6,-6],[4,6],[-10,4],[10,-3],[0,-7],[-7,6],[8,5],[-11,1],
    [-11,-3],[11,-1],[-3,7],[3,7],[-11,4],[11,4],[1,-8],[-8,-6],[8,-6],[-12,1],[12,1],[6,7]];
  for(const tw of TOWNS){ let placed=0;
    for(const [ox,oy] of offs){ if(placed>=8)break; // v37 民宅減半（原16間/鎮）
      const hx=tw.tx+ox+Math.floor(rand()*3)-1, hy=tw.ty+oy+Math.floor(rand()*3)-1;
      let ok=true;
      for(let dy=-1;dy<=1&&ok;dy++)for(let dx=-1;dx<=2&&ok;dx++){const t=T(hx+dx,hy+dy);
        if(!(t===GRASS||t===FIELD||t===PATH))ok=false;}
      if(ok)for(const b of BUILDINGS)if(hx<b.tx+b.tw+1&&hx+3>b.tx&&hy<b.ty+b.th+2&&hy+3>b.ty){ok=false;break;}
      if(ok){ const nm=SURNAMES[Math.floor(rand()*SURNAMES.length)];
        addBuild('house',hx,hy,2,1,'🏠 '+nm+'宅',
          {wall:WALLS[Math.floor(rand()*WALLS.length)],roof:ROOFS[Math.floor(rand()*ROOFS.length)]});
        placed++;}
    }}}
// 台灣機場（v40）：搭飛機去大陸
function coastLandSpot(tx,ty,tw,th){ // v42 找「靠近海邊」的可用平地（機場用）
  let best=null,bd=1e9;
  for(let r=0;r<18;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const nx=tx+dx,ny=ty+dy; let ok=true;
    for(let yy=0;yy<th&&ok;yy++)for(let xx=0;xx<tw&&ok;xx++){const t=T(nx+xx,ny+yy);if(!(t===GRASS||t===FIELD||t===PLAZA||t===PATH||t===SAND))ok=false;}
    if(!ok)continue;
    for(const b of BUILDINGS)if(nx<b.tx+b.tw+1&&nx+tw+1>b.tx&&ny<b.ty+b.th+2&&ny+th+2>b.ty){ok=false;break;}
    if(!ok)continue;
    let seaD=9; for(let s=1;s<=6&&seaD>s;s++)for(let a=0;a<8;a++){const q=T(nx+(tw>>1)+Math.round(Math.cos(a*0.785)*s),ny+(th>>1)+Math.round(Math.sin(a*0.785)*s));if(q===SEA){seaD=s;break;}}
    const score=seaD*12+r; if(score<bd){bd=score;best=[nx,ny];}
  }
  return best||fitSpot(tx,ty,tw,th);
}
AIRPORTS.filter(a=>a.w==='tw').forEach(a=>{const [ax,ay]=coastLandSpot(a.tx,a.ty,5,3);addBuild('airport',ax,ay,5,3,a.label,{airport:a});});
// 除了摩天輪/台北101/貓纜(與民宅/自宅)外，所有設施建設整體縮小
for(const b of BUILDINGS)if(!SCALE_EXEMPT.has(b.t))b.scale=BSCALE;

/* ===== v40 雙世界：大陸地區生成 ===== */
function genMapCN(m){
  // 依真實中國輪廓：西寬東窄、東岸有渤海灣內凹＋山東半島外突＋長三角外突、南岸漸縮＋海南島
  const N=v=>(vnoise(v*7.3+1.5,v*3.1+4.2)-0.5); // 隨 y 的海岸抖動
  const eastEdge=ty=>{ let e=498;
    if(ty<118) e=436+(118-ty)*0.35;                 // 東北往內收
    if(ty>=150&&ty<205) e=Math.min(e,392+Math.abs(ty-178)*2.1); // 渤海灣內凹
    if(ty>=224&&ty<262) e=Math.max(e,474+(19-Math.abs(ty-243))*2.2); // 山東半島外突
    if(ty>=330&&ty<362) e=Math.max(e,486);          // 長三角(上海)外突
    if(ty>=400) e=500-(ty-400)*0.30;                // 東南岸漸縮
    return e+N(ty)*20; };
  const westEdge=ty=> 86 + (ty<210?(210-ty)*0.16:0) + N(ty+40)*18;
  const northEdge=tx=> 48 + N(tx*0.9+7)*24;
  const southEdge=tx=> 706 - Math.max(0,(tx-360))*0.5 + N(tx*0.9+3)*20;
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    let land = tx>westEdge(ty)&&tx<eastEdge(ty)&&ty>northEdge(tx)&&ty<southEdge(tx);
    if(((tx-296)/23)**2+((ty-732)/17)**2<1) land=true;  // 海南島
    let t=SEA;
    if(land){ t=GRASS;
      if(tx<170&&vnoise(tx*0.06,ty*0.06)>0.40)t=HIGH;   // 青藏/橫斷山（西部）
      if(tx<148&&vnoise(tx*0.06+30,ty*0.06)>0.55)t=MT;
      if(tx>332&&ty<150&&vnoise(tx*0.08,ty*0.08)>0.55)t=HIGH; // 東北大興安嶺
      if(((tx-300)/20)**2+((ty-480)/13)**2<1)t=LAKE;    // 洞庭湖
      if(((tx-372)/15)**2+((ty-460)/11)**2<1)t=LAKE;    // 鄱陽湖
      if(t===GRASS&&vnoise(tx*0.05+80,ty*0.05)>0.74)t=FIELD; }
    m[ty*MW+tx]=t; }
  const sand=[];                                          // 海灘
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){ const t=m[ty*MW+tx];
    if(t===SEA||t===LAKE||!WALKABLE[t])continue; let near=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=tx+dx,ny=ty+dy;
      const nt=(nx<0||ny<0||nx>=MW||ny>=MH)?SEA:m[ny*MW+nx];if(nt===SEA)near=true;}
    if(near)sand.push(ty*MW+tx); }
  sand.forEach(i=>m[i]=SAND);
}
function genWorldCN(){ // 於 map=cnMap、BUILDINGS=cnB 的狀態下呼叫
  if(typeof CN_STATIONS!=='undefined')CN_STATIONS.forEach(s=>{const [sx,sy]=fitSpot(s.tx,s.ty,5,3);addBuild('station',sx,sy,5,3,s.n);}); // v42 高鐵站
  AIRPORTS.filter(a=>a.w==='cn').forEach(a=>{const [ax,ay]=fitSpot(a.tx,a.ty,5,3);addBuild('airport',ax,ay,5,3,a.label,{airport:a});});
  LANDMARKS_CN.forEach(L=>{const [tw,th]=SIZE[L.t];const [lx,ly]=fitSpot(L.tx,L.ty,tw,th);
    addBuild(L.t,lx,ly,tw,th,L.label,{lines:L.lines,county:L.county,isLm:true});});
  EATERIES_CN.forEach(e=>{const [ex,ey]=fitSpot(e.tx,e.ty,3,2);addBuild('eatery',ex,ey,3,2,e.label,{food:e.food,price:e.price,icon:e.icon});});
  HOTELS_CN.forEach(h=>{const [hx,hy]=fitSpot(h.tx,h.ty,4,3);addBuild('hotel',hx,hy,4,3,h.label);});
  { rs=SEED+99; const SUR=['王','李','張','劉','陳','楊','趙','黃','周','吳','徐','孫','胡','朱','高','林','何','郭','馬','羅'];
    const WALLS=['#ecd6b2','#e6dcc4','#e8cfa8','#dfe4d0','#efd9c4']; const ROOFS=['#b8604f','#8a6a4a','#6f8a9a','#a86a8a','#c98a3a'];
    const offs=[[-7,-3],[6,-3],[-5,4],[6,4],[-8,1],[8,1],[-3,6],[4,-6],[-6,-6],[7,-1]];
    for(const tw of TOWNS_CN){ let placed=0;
      for(const [ox,oy] of offs){ if(placed>=7)break;
        const hx=Math.round(tw.tx)+ox, hy=Math.round(tw.ty)+oy; let ok=true;
        for(let dy=-1;dy<=1&&ok;dy++)for(let dx=-1;dx<=2&&ok;dx++){const t=T(hx+dx,hy+dy);if(!(t===GRASS||t===FIELD||t===PATH))ok=false;}
        if(ok)for(const b of BUILDINGS)if(hx<b.tx+b.tw+1&&hx+3>b.tx&&hy<b.ty+b.th+2&&hy+3>b.ty){ok=false;break;}
        if(ok){const nm=SUR[Math.floor(rand()*SUR.length)];
          addBuild('house',hx,hy,2,1,'🏠 '+nm+'宅',{wall:WALLS[Math.floor(rand()*WALLS.length)],roof:ROOFS[Math.floor(rand()*ROOFS.length)]});placed++;}
      }}}
}
const SCENES={ tw:{map,buildings:BUILDINGS,mini,towns:TOWNS,name:'台灣'} };
let ACT_TOWNS=TOWNS, ACT_NPCDEFS=NPC_DEFS, ACT_STATIONS=STATIONS; // v45 鐵路改用 RAILNET 路網圖，ACT_RAILS 已移除
{ // 建立大陸世界（暫時把 map/BUILDINGS 指向大陸，生成後快照、還原台灣）
  const cnMap=new Uint8Array(MW*MH); genMapCN(cnMap);
  const _map=map,_b=BUILDINGS; map=cnMap; BUILDINGS=[]; world='cn';
  genWorldCN();
  for(const b of BUILDINGS)if(!SCALE_EXEMPT.has(b.t))b.scale=BSCALE;
  SCENES.cn={map:cnMap,buildings:BUILDINGS,mini:makeMini(cnMap),towns:TOWNS_CN,name:'大陸'};
  map=_map; BUILDINGS=_b; world='tw';
}
function setScene(w){ const S=SCENES[w]; if(!S)return; world=w; map=S.map; BUILDINGS=S.buildings; mini=S.mini;
  ACT_TOWNS=S.towns; ACT_NPCDEFS=(w==='cn')?CN_NPC_DEFS:NPC_DEFS;
  ACT_STATIONS=(w==='cn'&&typeof CN_STATIONS!=='undefined')?CN_STATIONS:STATIONS; }
function flyTo(destW,destLabel){
  setScene(destW);
  for(const a of [citizens,animals,sealife,bugs,digs,drops,puffs,groundToys,events,fx,campfires,strays,stars])a.length=0; // 清空舊世界動態物件
  player.wanted=null;player.riding=null;player.balloonRide=null;player.sailing=false;player.fishing=null;
  player.soak=null;player.pray=null;player.ferris=null;
  godz=null; godzT=240+Math.random()*300;
  genWorld(); genNpcs(); // 重新生成該世界的樹木/店主/特殊NPC（大陸：劉思思）
  const ap=BUILDINGS.find(b2=>b2.t==='airport'&&b2.label===destLabel)||BUILDINGS.find(b2=>b2.t==='airport');
  const q=findWalkSafe(ap.tx+2,ap.ty+ap.th+2); player.x=q.x; player.y=q.y; player.face=0;
  ui=null; menu=null; zoomT=1; flash=1; sfx('jingle'); flyAnim=2.8; flyLabel=destLabel; flyDestW=destW; typhoon=null; save();
}
// v43 脫困：清除卡住/占用狀態並傳送到最近城鎮的安全落點
const RESCUE_MIN_MOVE=8; // 落點至少要離現在位置這麼多格，否則等於沒被救到
function rescueSpots(tx,ty,max){ // 由內而外收集多個「可走、不卡建築、至少一邊走得動」的落點
  const out=[];
  for(let r=0;r<12&&out.length<(max||14);r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue; // 只取當前這一圈
    if(!WALKABLE[T(tx+dx,ty+dy)])continue;
    const x=(tx+dx+0.5)*TILE,y=(ty+dy+0.5)*TILE;
    if(!hitObstacle(x,y)&&(!hitObstacle(x+34,y)||!hitObstacle(x-34,y)||!hitObstacle(x,y+34)||!hitObstacle(x,y-34)))
      out.push({x,y});
  }
  return out;
}
function rescueTeleport(){ // v44 保證真的把玩家移到「另一座」最近城市，且每次落點不同
  player.riding=null;player.balloonRide=null;player.ferris=null;player.soak=null;player.pray=null;player.fishing=null;player.sailing=false;player.pet&&(player.pet.atk=null);
  zoomT=1; flyAnim=0;
  const px=player.x/TILE, py=player.y/TILE;
  const sorted=ACT_TOWNS.map(t=>({t,d:Math.hypot(t.tx-px,t.ty-py)})).sort((a,b)=>a.d-b.d);
  let dest=null,spot=null;
  for(const c of sorted){ // 由近到遠，跳過「你已經站在裡面」的那座city
    const cands=rescueSpots(Math.round(c.t.tx),Math.round(c.t.ty));
    if(!cands.length)continue;
    const pick=cands[Math.floor(Math.random()*cands.length)];
    if(Math.hypot(pick.x/TILE-px,pick.y/TILE-py)>=RESCUE_MIN_MOVE){dest=c.t;spot=pick;break;}
  }
  if(!spot&&sorted.length){dest=sorted[0].t;spot=findWalkSafe(Math.round(dest.tx),Math.round(dest.ty));}
  if(!spot)spot=findWalkSafe(Math.round(px),Math.round(py));
  player.x=spot.x; player.y=spot.y; player.face=0;
  ui=null; menu=null; sfx('pop'); flash=0.5; save();
  toast('🆘 已脫困！傳送到最近的城市「'+(dest?dest.n:'安全地點')+'」。');
}
let flyAnim=0, flyLabel='', flyDestW='tw';
function drawFlyAnim(){ // v42 飛機飛出去/降落動畫（螢幕層）
  const ph=1-flyAnim/2.8;
  ctx.fillStyle=`rgba(150,205,235,${Math.min(0.5,flyAnim*0.5)})`;ctx.fillRect(0,0,VW,VH); // 天空
  ctx.fillStyle='rgba(255,255,255,.9)'; // 雲
  for(let i=0;i<5;i++){const cxr=((i*180+tGlobal*120)%(VW+200))-100, cyr=90+i*70;
    for(let k=0;k<4;k++){ctx.beginPath();ctx.arc(cxr+k*22,cyr+(k%2)*8,16,0,7);ctx.fill();}}
  const px=-140+ph*(VW+280), py=VH*0.42+Math.sin(ph*Math.PI)*-40; // 飛機橫越
  ctx.save();ctx.translate(px,py);ctx.scale(2.4,2.4);
  ctx.fillStyle='#eef2f6';ctx.beginPath();ctx.ellipse(0,0,16,5,0,0,7);ctx.fill(); // 機身
  ctx.fillStyle='#cfd8e2';ctx.beginPath();ctx.moveTo(-2,0);ctx.lineTo(-11,-8);ctx.lineTo(-3,-1);ctx.fill(); // 尾翼
  ctx.fillStyle='#3f6fd6';ctx.beginPath();ctx.moveTo(3,1);ctx.lineTo(12,8);ctx.lineTo(6,1);ctx.fill(); // 主翼
  ctx.fillStyle='#3f6fd6';ctx.beginPath();ctx.moveTo(3,-1);ctx.lineTo(11,-7);ctx.lineTo(6,-1);ctx.fill();
  ctx.fillStyle='#8fd0ff';for(let i=-2;i<=3;i++){ctx.beginPath();ctx.arc(i*3.2,-1,1,0,7);ctx.fill();} ctx.restore(); // 窗
  ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2;ctx.setLineDash([6,8]); // 尾跡
  ctx.beginPath();ctx.moveTo(px-40,py+2);ctx.lineTo(-40,py+2);ctx.stroke();ctx.setLineDash([]);
  ctx.font='bold 22px "Microsoft JhengHei"';ctx.fillStyle='#2f4f7f';ctx.textAlign='center';
  ctx.fillText('✈️ 飛往「'+flyLabel+'」（'+(flyDestW==='cn'?'大陸':'台灣')+'）',VW/2,58);ctx.textAlign='left';
}

/* ================= 世界物件 ================= */
const trees=[],rocks=[],weeds=[],flowers=[],drops=[],bugs=[],digs=[],teaBushes=[],cacti=[],strawberries=[],lamps=[],lanterns=[];
const campfires=[],animals=[],citizens=[],sealife=[],puffs=[],owners=[],strays=[],stars=[];
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
  buildRailNet(); // v45 依當前世界重建鐵路路網圖
  for(const a of [trees,rocks,weeds,flowers,teaBushes,cacti,strawberries,lamps,lanterns,owners])a.length=0; // v40 換世界時重置靜態物件
  for(let ty=2;ty<MH-2;ty++)for(let tx=2;tx<MW-2;tx++){
    const t=T(tx,ty);
    if(t!==GRASS&&t!==HIGH&&t!==SAND)continue;
    const nearPath=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const q=T(tx+dx,ty+dy);return q===PATH||q===PLAZA;});
    if(nearPath)continue;
    if(t===SAND){
      if(rand()<0.003&&trees.length<830&&!nearBuilding(tx,ty))
        trees.push({x:(tx+0.5)*TILE,y:(ty+0.8)*TILE,kind:'palm',fruit:'椰子',has:true,regrow:0,shake:0});
      continue;}
    const cluster=vnoise(tx*0.07+7,ty*0.07+3);
    if(cluster>0.66&&rand()<0.11&&trees.length<800&&!nearBuilding(tx,ty)){
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
  if(world==='tw'){ // 台灣專屬：茶園/仙人掌/草莓/花海
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
  }
  // 路燈（市鎮）
  for(const tw of ACT_TOWNS){
    for(const [ox,oy] of [[-2,2],[2,-2]]){
      const t=T(tw.tx+ox,tw.ty+oy);
      if(t===PATH||t===PLAZA)lamps.push({x:(tw.tx+ox+0.5)*TILE,y:(tw.ty+oy+0.5)*TILE});}}
  // 店老闆（站在店門口迎接客人）
  { const sps=['dog','cat','bear','monkey','goat','leopardcat'];
    const pals=[{fur:'#e0a35a',belly:'#fff'},{fur:'#f2f2f2',belly:'#fff'},{fur:'#8a6b4a',belly:'#e8d0a8'},
      {fur:'#b08a5a',belly:'#e8cfa8'},{fur:'#e8e2d4',belly:'#fff'},{fur:'#d8b06a',belly:'#f5ecd8'}];
    for(const b of BUILDINGS){ if(!['shop','market','teahouse','lantern','eatery','hotel'].includes(b.t))continue;
      const k=Math.floor(hsh(b.tx,b.ty)*6);
      owners.push({x:b.x+b.w/2+(hsh(b.ty,b.tx)>0.5?38:-38),y:b.y+b.h+20,
        species:sps[k],pal:pals[(k+Math.floor(hsh(b.tx*3,b.ty)*3))%6]});}}
}

/* ================= 乘坐系統（火車 / 纜車） ================= */
/* v45 鐵路路網圖：節點=車站城市、邊=路線區間；搭車用 Dijkstra 找最短路徑自動轉乘 */
let RAILNET=null;
function buildRailNet(){
  const nodes={}, edges=[];
  if(world==='cn'&&typeof CN_RAIL_LINES!=='undefined'){
    CN_STATIONS.forEach(s=>{nodes[s.city]={x:s.tx,y:s.ty,st:s.n};});
    CN_RAIL_LINES.forEach(L=>{
      let prev=null, bends=[];
      L.s.forEach(el=>{
        if(Array.isArray(el)){bends.push(el);return;} // 轉彎點：只influences路徑不設站
        if(!nodes[el]){bends=[];prev=el;return;}
        if(prev&&nodes[prev]){
          const a=nodes[prev], b=nodes[el];
          const pts=[[a.x,a.y],...bends,[b.x,b.y]];
          let len=0; for(let i=0;i<pts.length-1;i++)len+=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);
          edges.push({a:prev,b:el,line:L.n,t:L.t,ferry:!!L.ferry,note:L.note,pts,len});
        }
        prev=el; bends=[];
      });
    });
  } else {
    // 台灣環島線：把 STATIONS 依 railIdx 串成閉環，區間沿原折線
    const st=[...STATIONS].sort((p,q)=>p.railIdx-q.railIdx), N=RAILS.length-1;
    st.forEach(s=>{nodes[s.n]={x:s.tx,y:s.ty,st:s.n};});
    for(let k=0;k<st.length;k++){ const A=st[k], B=st[(k+1)%st.length];
      const pts=[]; for(let i=A.railIdx;;i=(i+1)%N){pts.push(RAILS[i]);if(i===B.railIdx)break;}
      let len=0; for(let i=0;i<pts.length-1;i++)len+=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);
      edges.push({a:A.n,b:B.n,line:'環島鐵路',t:'hsr',pts,len});}
  }
  const adj={}; Object.keys(nodes).forEach(n=>adj[n]=[]);
  edges.forEach((e,i)=>{adj[e.a].push({to:e.b,e:i});adj[e.b].push({to:e.a,e:i});});
  RAILNET={nodes,edges,adj};
}
function railRoute(from,to){ // 最短路徑；回傳{pts(px),len(格),lines(依序經過線名),reg,ferry}
  if(!RAILNET||!RAILNET.nodes[from]||!RAILNET.nodes[to])return null;
  const {nodes,edges,adj}=RAILNET;
  const D={},prev={},Q=Object.keys(nodes);
  Q.forEach(n=>D[n]=1e18); D[from]=0;
  while(Q.length){
    Q.sort((a,b)=>D[a]-D[b]); const u=Q.shift();
    if(u===to||D[u]>=1e18)break;
    adj[u].forEach(({to:v,e})=>{const nd=D[u]+edges[e].len;
      if(nd<D[v]){D[v]=nd;prev[v]={u,e};}});
  }
  if(from!==to&&!prev[to])return null;
  const segs=[]; let cur=to;
  while(cur!==from){const p=prev[cur];segs.unshift({e:edges[p.e],from:p.u});cur=p.u;}
  const pts=[],lines=[]; let reg=false,ferry=false;
  segs.forEach(s=>{
    let ep=s.e.pts; if(s.e.a!==s.from)ep=[...ep].reverse();
    ep.forEach((p,i)=>{if(!(pts.length&&i===0))pts.push(p);});
    if(!lines.length||lines[lines.length-1]!==s.e.line)lines.push(s.e.line);
    if(s.e.t==='reg')reg=true; if(s.e.ferry)ferry=true;});
  return {pts:pts.map(([x,y])=>({x:x*TILE,y:y*TILE})),len:D[to],lines,reg,ferry};
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
  boat:false,sailing:false,hp:100,hunger:100,race:0,soak:null,tired:0,toy:null,wanted:null,jailed:false,love:null,wedding:null,
  crimes:0,notoriousUntil:0,patrolT:0,
  gender:'m',hairStyle:0,hair:'#4a2f1d',headAcc:null,bodyAcc:null,shoes:null,
  ownAcc:[],ownShoes:[],outfit:'tee',deco:null,tie:null,ownClothes:[],sparkle:0,honor:0,ownGuns:[],murderRap:false,
  pet:null,petFood:0,autographs:[]};
// ---- 服裝（男女各20套；col=主色, style=版型, deco=花紋/配件, tie=領帶色）----
const CLOTHES_M=[
 {n:'白T恤',col:'#eef2f6',style:'tee'},{n:'海軍條紋衫',col:'#3f6fd6',style:'shirt',deco:'stripe'},
 {n:'黑色西裝',col:'#2f3540',style:'suit',tie:'#c94f43'},{n:'商務襯衫',col:'#dce8f0',style:'office',tie:'#3f6fd6'},
 {n:'牛仔外套',col:'#4a6a9a',style:'top',deco:'zip'},{n:'紅色帽T',col:'#c94f43',style:'top',deco:'hood'},
 {n:'運動外套',col:'#2ea36b',style:'top',deco:'zip'},{n:'黃色POLO衫',col:'#f2b21c',style:'shirt',deco:'collar'},
 {n:'格紋襯衫',col:'#a0522d',style:'shirt',deco:'check'},{n:'藍色背心',col:'#7ec8e8',style:'tank'},
 {n:'皮夾克',col:'#2a2a2a',style:'top',deco:'zip'},{n:'駝色毛衣',col:'#c0925a',style:'top',deco:'knit'},
 {n:'廚師服',col:'#f2f2f2',style:'top',deco:'apron'},{n:'藍染和服',col:'#3a4a8a',style:'trad',deco:'trad'},
 {n:'機能外套',col:'#5a6a8a',style:'top',deco:'zip'},{n:'夏威夷花襯衫',col:'#3fb0a0',style:'shirt',deco:'dots'},
 {n:'工裝吊帶褲',col:'#5a4a3a',style:'top',deco:'overall'},{n:'學生制服',col:'#4a4a6a',style:'office',tie:'#8a2f2a'},
 {n:'消防制服',col:'#d84f2a',style:'top',deco:'belt'},{n:'紅色唐裝',col:'#8a2f2a',style:'trad',deco:'trad'},
 // 唐朝古裝（男10）
 {n:'唐圓領袍',col:'#3f6a8a',style:'robe',deco:'wuxia'},{n:'文官朝服',col:'#8a2f3a',style:'robe',deco:'goldtrim'},
 {n:'武將戰袍',col:'#7a2a24',style:'robe',deco:'wuxia'},{n:'書生青衫',col:'#5a7a6a',style:'robe',deco:'trad'},
 {n:'帝王龍袍',col:'#e0a824',style:'robe',deco:'goldtrim'},{n:'錦衣華服',col:'#c94f8f',style:'robe',deco:'goldtrim'},
 {n:'俠士勁裝',col:'#3a3a44',style:'robe',deco:'wuxia'},{n:'道士鶴氅',col:'#e8ecf0',style:'robe',deco:'trad'},
 {n:'將軍金甲',col:'#b8942a',style:'robe',deco:'armor'},{n:'紫袍官人',col:'#6a4a8a',style:'robe',deco:'goldtrim'},
 // 布袋戲風格戲服（男5・原創武俠造型）
 {n:'白衣刀客',col:'#f4f4ee',style:'robe',deco:'wuxia'},{n:'黑袍劍客',col:'#26262e',style:'robe',deco:'wuxia'},
 {n:'血衣魔尊',col:'#8a1f2a',style:'robe',deco:'wuxia'},{n:'青袍儒俠',col:'#2f6a5a',style:'robe',deco:'wuxia'},
 {n:'金甲戰神',col:'#d0a838',style:'robe',deco:'armor'},
];
const CLOTHES_F=[
 {n:'碎花洋裝',col:'#f27ba0',style:'dress',deco:'dots'},{n:'水藍洋裝',col:'#7ec8e8',style:'dress'},
 {n:'白色婚紗',col:'#f8f8ff',style:'dress',deco:'sparkle'},{n:'紅色連衣裙',col:'#e2574c',style:'dress'},
 {n:'橘條紋上衣',col:'#f0913a',style:'shirt',deco:'stripe'},{n:'紫針織衫',col:'#c98ab0',style:'top',deco:'knit'},
 {n:'學院背心裙',col:'#5a4a8a',style:'dress',deco:'collar'},{n:'紅色旗袍',col:'#c94f43',style:'trad',deco:'trad'},
 {n:'粉色和服',col:'#d86a9a',style:'trad',deco:'trad'},{n:'青綠運動服',col:'#3fb0a0',style:'top',deco:'zip'},
 {n:'吊帶裙',col:'#6a8a5a',style:'dress',deco:'overall'},{n:'粉蓬蓬裙',col:'#f5b8d0',style:'dress'},
 {n:'襯衫洋裝',col:'#e8ecf2',style:'dress',deco:'collar'},{n:'駝色大衣',col:'#a5744a',style:'top',deco:'belt'},
 {n:'黃色罩衫',col:'#ffcf40',style:'tank'},{n:'波點洋裝',col:'#9b59b6',style:'dress',deco:'dots'},
 {n:'護士服',col:'#f2f2f2',style:'dress',deco:'apron'},{n:'空姐制服',col:'#3a4a7a',style:'office',tie:'#c94f43'},
 {n:'民族風長裙',col:'#b06a2a',style:'dress',deco:'trad'},{n:'公主禮服',col:'#ffd0e8',style:'dress',deco:'sparkle'},
 // 唐朝古裝（女10）
 {n:'齊胸襦裙',col:'#f0a0c0',style:'robe',deco:'shawl'},{n:'貴妃華服',col:'#e0559b',style:'robe',deco:'goldtrim'},
 {n:'仕女羅裙',col:'#a0c0e0',style:'robe',deco:'shawl'},{n:'紅衣舞裙',col:'#e2453c',style:'robe',deco:'shawl'},
 {n:'綠衣襦裙',col:'#5aa06a',style:'robe',deco:'shawl'},{n:'宮裝鳳袍',col:'#e0a824',style:'robe',deco:'goldtrim'},
 {n:'青衣女俠',col:'#3f7a8a',style:'robe',deco:'wuxia'},{n:'紗衣霓裳',col:'#d0b8e8',style:'robe',deco:'shawl'},
 {n:'錦繡宮裙',col:'#c94f8f',style:'robe',deco:'goldtrim'},{n:'白衣仙裙',col:'#f4f4fa',style:'robe',deco:'shawl'},
 // 布袋戲風格戲服（女5・原創武俠造型）
 {n:'紅顏俠女',col:'#c9354a',style:'robe',deco:'wuxia'},{n:'白衣素女',col:'#f4f4ee',style:'robe',deco:'shawl'},
 {n:'紫衣仙子',col:'#8a5ab0',style:'robe',deco:'shawl'},{n:'墨衣刀姬',col:'#2a2a34',style:'robe',deco:'wuxia'},
 {n:'青衣劍女',col:'#2f8a7a',style:'robe',deco:'wuxia'},
];
const HAIR_COLORS=['#3a2a1e','#5a3a22','#7a4a28','#8a5a34','#a86e34','#c99150','#d8b46e','#6a3a2a','#2f2f38','#a83a56','#4a3560','#caa24a'];
const HAIR_COLOR_NAMES=['深棕黑','深棕','棕色','淺棕','栗子棕','亞麻棕','金色','紅棕','藍黑','玫瑰紅','紫羅蘭','金棕'];
// 產生一位路人（男短髮／女長髮、隨機服裝髮型髮色）
function makeCitizen(x,y){
  const gender=Math.random()<0.5?'m':'f';
  let outfit;
  if(gender==='f')outfit=['tee','shirt','dress','dress','office','skirt'][Math.floor(Math.random()*6)];
  else outfit=['tee','shirt','suit','office','jeans','tee'][Math.floor(Math.random()*6)];
  if(outfit==='skirt')outfit='dress';
  let shirt,pants=null,tie=null;
  if(outfit==='suit'){shirt=['#3a4458','#4a3a58','#2f3f4f','#3a2f2a'][Math.floor(Math.random()*4)];
    pants='#2f3a48';tie=['#c94f43','#3f6fd6','#c9a03a','#3f8f5a'][Math.floor(Math.random()*4)];}
  else if(outfit==='office'){shirt=['#e8ecf2','#dce8f0','#f0e8dc','#f5e0e8'][Math.floor(Math.random()*4)];
    tie=['#c94f43','#3f8f5a','#5a4a8a','#c98a3a'][Math.floor(Math.random()*4)];}
  else if(outfit==='dress')shirt=['#f27ba0','#c77dff','#f2c94c','#7ec8e8','#e2574c','#8fd48f','#ff9e50','#f5b8d0'][Math.floor(Math.random()*8)];
  else{shirt=['#3f7fd6','#2ea36b','#f2b21c','#9b59b6','#f27ba0','#e74c3c','#5a8a9a','#e8ecf2','#f0913a','#3fb0a0'][Math.floor(Math.random()*10)];
    if(outfit==='jeans')pants='#3f5f8a';}
  const pname=(gender==='m'?NAME_M:NAME_F)[Math.floor(Math.random()*(gender==='m'?NAME_M:NAME_F).length)];
  return {x,y,hx:x,hy:y,homeR:6*TILE,vx:0,vy:0,ai:0,walk:0,face:0,talk:0,chatCd:0,buddy:null,line:'',
    shirt,outfit,pants,tie,pname,gender,
    hairStyle:Math.floor(Math.random()*10),hair:HAIR_COLORS[Math.floor(Math.random()*HAIR_COLORS.length)],
    race:Math.random()<0.18?Math.floor(Math.random()*RACES.length):null};
}
// 路人聊天泡泡
function drawChatBubble(x,y,line){
  const t=line||'…'; ctx.font='11px "Microsoft JhengHei",sans-serif';
  const w=ctx.measureText(t).width+14, h=20, bx=x-w/2, by=y-66;
  ctx.fillStyle='rgba(255,255,255,.95)';ctx.strokeStyle='#c9a86a';ctx.lineWidth=2;
  rr(bx,by,w,h,8);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(x-4,by+h-1);ctx.lineTo(x+4,by+h-1);ctx.lineTo(x,by+h+6);ctx.closePath();
  ctx.fillStyle='rgba(255,255,255,.95)';ctx.fill();
  ctx.fillStyle='#5b4023';ctx.textAlign='center';ctx.fillText(t,x,by+14);ctx.textAlign='left';
}
// v40 直播主劉思思：自拍手機LIVE＋飄浮音符＋循環唱歌泡泡
const STREAM_SONGS=['啦啦啦～天氣真好呀～','嗯～哼著小曲兒～','星星對我眨眼睛～','心裡有個小夢想～','願你天天都開心～','微風吹過髮梢～','關注思思不迷路～'];
function drawStreamer(n){ const x=n.x,y=n.y;
  ctx.save();
  ctx.fillStyle='#222';rr(x+13,y-30,9,15,2);ctx.fill(); // 自拍手機
  ctx.fillStyle=isNight()?'#8fd0ff':'#bfe6ff';rr(x+14.5,y-28.5,6,10,1);ctx.fill();
  ctx.fillStyle='#e2453c';ctx.beginPath();ctx.arc(x+17.5,y-33,2.6,0,7);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 5px sans-serif';ctx.textAlign='center';ctx.fillText('LIVE',x+17.5,y-31.3);
  ctx.font='12px serif'; // 飄浮音符
  for(let i=0;i<3;i++){const t2=(tGlobal*0.8+i*0.9)%2.4, a=Math.max(0,1-t2/2.4);
    ctx.globalAlpha=a;ctx.fillText(i%2?'🎵':'🎶',x-16+i*9+Math.sin(tGlobal*3+i)*4,y-46-t2*14);}
  ctx.globalAlpha=1;ctx.restore();
  const s=STREAM_SONGS[Math.floor(tGlobal/3.4)%STREAM_SONGS.length];
  if((tGlobal%3.4)<2.6)drawChatBubble(x,y,'🎤 '+s);
}
function drawNamePlate(x,y,name,married){ // v46 劉思思專屬名牌（腳下，避開唱歌泡泡）
  ctx.save();ctx.font='bold 11px "Microsoft JhengHei",sans-serif';
  const t=(married?'💍 ':'🎤 ')+name, w=ctx.measureText(t).width+16, py=y+14;
  ctx.globalAlpha=.95;
  ctx.fillStyle='#fff';rr(x-w/2,py,w,17,8);ctx.fill();
  ctx.strokeStyle='#f06fa8';ctx.lineWidth=2;rr(x-w/2,py,w,17,8);ctx.stroke();
  ctx.fillStyle='#d13c86';ctx.textAlign='center';ctx.fillText(t,x,py+12.5);
  ctx.textAlign='left';ctx.globalAlpha=1;ctx.restore();
}
// ===== 寺廟祭典：舞獅／舞龍／圍觀群眾 =====
function drawLion(x,y,t){ const bob=Math.sin(t*6)*3, sway=Math.sin(t*3)*4;
  ctx.fillStyle='#c0392b';rr(x-2+sway*0.3,y-6,26,15,7);ctx.fill(); // 布身
  ctx.fillStyle='#f1c40f';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(x+6+i*7,y+2,3,0,7);ctx.fill();}
  const hx=x+sway, hy=y-14+bob;
  ctx.fillStyle='#f39c12';for(let i=0;i<10;i++){const a=i/10*6.283; // 鬃毛
    ctx.beginPath();ctx.arc(hx+Math.cos(a)*13,hy+Math.sin(a)*13,3.6,0,7);ctx.fill();}
  ctx.fillStyle='#e74c3c';ctx.beginPath();ctx.arc(hx,hy,12,0,7);ctx.fill(); // 獅頭
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx-5,hy-3,4,0,7);ctx.arc(hx+5,hy-3,4,0,7);ctx.fill();
  ctx.fillStyle='#222';ctx.beginPath();ctx.arc(hx-5,hy-3,2,0,7);ctx.arc(hx+5,hy-3,2,0,7);ctx.fill();
  ctx.fillStyle='#27ae60';ctx.fillRect(hx-9,hy-9,6,3);ctx.fillRect(hx+3,hy-9,6,3); // 眉
  ctx.fillStyle='#7a1f1f';ctx.beginPath();ctx.ellipse(hx,hy+7,7,3+Math.abs(Math.sin(t*6))*3,0,0,7);ctx.fill(); // 嘴
  ctx.fillStyle='#2c3e50';const lp=Math.sin(t*6)*3; // 舞者的腳
  rr(x+3,y+7,4,8+lp,2);ctx.fill();rr(x+10,y+7,4,8-lp,2);ctx.fill();
  rr(x+16,y+7,4,8+lp,2);ctx.fill();rr(x+22,y+7,4,8-lp,2);ctx.fill(); }
function drawDragon(x,y,t){ // 舞龍：龍頭＋數節身體隨波擺動、有舉桿
  for(let i=7;i>=1;i--){ const px=x-i*13, py=y+Math.sin(t*4-i*0.7)*7;
    if(i%2===0){ctx.strokeStyle='#8a5a2b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,py+16);ctx.stroke();}
    ctx.fillStyle=i%2?'#f1c40f':'#e67e22';ctx.beginPath();ctx.arc(px,py,7,0,7);ctx.fill();
    ctx.fillStyle='#c0392b';ctx.beginPath();ctx.arc(px,py-6,2.4,0,7);ctx.fill(); }
  const hx=x, hy=y+Math.sin(t*4)*7; // 龍頭
  ctx.fillStyle='#e67e22';ctx.beginPath();ctx.arc(hx,hy,10,0,7);ctx.fill();
  ctx.fillStyle='#f1c40f';ctx.beginPath();ctx.moveTo(hx+1,hy-9);ctx.lineTo(hx+5,hy-18);ctx.lineTo(hx+9,hy-8);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx+4,hy-4,3,0,7);ctx.fill();
  ctx.fillStyle='#222';ctx.beginPath();ctx.arc(hx+5,hy-4,1.5,0,7);ctx.fill();
  ctx.fillStyle='#c0392b';rr(hx+2,hy+4,12,4,2);ctx.fill();
  ctx.strokeStyle='#c0392b';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(hx+12,hy);ctx.quadraticCurveTo(hx+20,hy-4,hx+22,hy+2);ctx.stroke(); }
function drawSpectator(x,y,i){ const cols=['#3f7fd6','#e67e22','#8e44ad','#16a085','#c0392b','#f39c12','#2c3e50','#d35400'];
  const bob=Math.sin(tGlobal*3+i)*1;
  ctx.fillStyle='rgba(0,0,0,.14)';ctx.beginPath();ctx.ellipse(x,y+2,9,4,0,0,7);ctx.fill();
  ctx.fillStyle=cols[i%cols.length];rr(x-7,y-14+bob,14,16,5);ctx.fill();
  ctx.fillStyle='#f5c99b';ctx.beginPath();ctx.arc(x,y-18+bob,8,0,7);ctx.fill();
  ctx.fillStyle=['#3a2a1e','#5a3a22','#2f2f38'][i%3];ctx.beginPath();ctx.arc(x,y-20+bob,8,Math.PI,0);ctx.fill(); }
function drawFestival(f){ const b=f.b, gx=b.x+b.w/2, gy=b.y+b.h, top=gy-b.h*0.62;
  ctx.strokeStyle='#8a5a2b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(gx-72,top);ctx.lineTo(gx+72,top);ctx.stroke();
  for(let i=-3;i<=3;i++){ctx.fillStyle=i%2?'#e74c3c':'#f1c40f'; // 燈籠串
    ctx.beginPath();ctx.ellipse(gx+i*22,top+8,5,7,0,0,7);ctx.fill();
    ctx.fillStyle='#c0392b';ctx.fillRect(gx+i*22-1,top+14,2,3);}
  ctx.fillStyle='#c0392b';rr(gx-80,top-26,160,20,5);ctx.fill(); // 紅布條
  ctx.fillStyle='#ffe9a0';ctx.font='bold 12px "Microsoft JhengHei"';ctx.textAlign='center';
  ctx.fillText(f.emoji+' '+f.name,gx,top-12);ctx.textAlign='left';
  for(let i=0;i<7;i++)drawSpectator(gx-66+i*22, gy+30+(i%2)*10, i); // 圍觀群眾
  drawDragon(gx-24, gy+16, tGlobal); drawLion(gx+42, gy+14, tGlobal); }
// 被擊倒的路人（橫躺・XX眼・淡血泊，數秒後消失）
function drawCorpse(c){ const x=c.x,y=c.y;
  ctx.save(); if(c.deadT<1.2)ctx.globalAlpha=Math.max(0,c.deadT/1.2);
  ctx.fillStyle='rgba(0,0,0,.16)';ctx.beginPath();ctx.ellipse(x,y+4,20,7,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(150,20,20,.32)';ctx.beginPath();ctx.ellipse(x+2,y+3,17,6,0,0,7);ctx.fill(); // 血泊
  ctx.fillStyle=c.shirt||'#c0392b';rr(x-14,y-8,24,14,7);ctx.fill(); // 身體橫躺
  ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=1.5;rr(x-14,y-8,24,14,7);ctx.stroke();
  ctx.fillStyle=c.pants||'#3a3428';rr(x+8,y-6,12,5,2);ctx.fill();rr(x+8,y+1,12,5,2);ctx.fill(); // 腿
  ctx.fillStyle='#f5c99b';ctx.beginPath();ctx.arc(x-6,y-12,3.4,0,7);ctx.fill(); // 攤開的手
  ctx.fillStyle='#f5c99b';ctx.beginPath();ctx.arc(x-18,y-4,9,0,7);ctx.fill(); // 頭
  ctx.fillStyle=c.hair||'#3a2a1a';ctx.beginPath();ctx.arc(x-20,y-6,9,Math.PI*0.55,Math.PI*1.95);ctx.fill(); // 頭髮
  ctx.strokeStyle='#5a3020';ctx.lineWidth=1.6; // XX 眼
  for(const ox of [-3,3]){ctx.beginPath();ctx.moveTo(x-18+ox-2,y-6);ctx.lineTo(x-18+ox+2,y-2);
    ctx.moveTo(x-18+ox+2,y-6);ctx.lineTo(x-18+ox-2,y-2);ctx.stroke();}
  ctx.restore(); }
// v37 警察（包圍圈用）：制服藍＋警帽；被打倒＝躺平冒星星
function drawCop(cp){
  if(cp.down){
    ctx.save();ctx.translate(cp.x,cp.y);ctx.rotate(1.45);ctx.translate(-cp.x,-cp.y);
    drawActor(cp.x,cp.y,2,0,{species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},hair:'#1a1a1a',shirt:'#27406e',outfit:'tee'});
    ctx.restore();
    ctx.font='13px serif';ctx.textAlign='center';
    ctx.fillText('💫',cp.x,cp.y-24+Math.sin(tGlobal*4)*2);ctx.textAlign='left';return;}
  drawActor(cp.x,cp.y,cp.face||2,cp.walk||0,
    {species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},hair:'#1a1a1a',shirt:'#27406e',outfit:'tee'});
  ctx.fillStyle='#1f3050';ctx.beginPath();ctx.arc(cp.x,cp.y-42,7.5,Math.PI,0);ctx.fill(); // 警帽
  ctx.fillRect(cp.x-8.5,cp.y-43,17,3);
  ctx.fillStyle='#ffd97a';ctx.fillRect(cp.x-1.5,cp.y-46,3,2.5); // 帽徽
}
// v37 鋸齒閃電
function drawBolt(x1,y1,x2,y2,alpha,w){
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(x1,y1);
  const seg=6, fr=Math.floor(tGlobal*18);
  for(let i=1;i<seg;i++){const t2=i/seg;
    ctx.lineTo(x1+(x2-x1)*t2+(hsh(i,fr)-0.5)*34,y1+(y2-y1)*t2);}
  ctx.lineTo(x2,y2);
  ctx.strokeStyle=`rgba(255,235,110,${alpha})`;ctx.lineWidth=w;ctx.stroke();
  ctx.strokeStyle=`rgba(255,255,255,${alpha*0.85})`;ctx.lineWidth=w*0.4;ctx.stroke();
  ctx.lineCap='butt';}
// v37 哥吉拉：體型約人物10倍、會噴射雷電的海上巨獸
function drawGodzilla(g){
  const x=g.x, y=g.y, bob=Math.sin(tGlobal*1.1)*5, d2=g.dir;
  const body=g.hit>0?'#8aa07a':'#38503f', darker=g.hit>0?'#6f8560':'#2a3d30', belly='#b7c294', fin='#8fe0ea';
  // 海面波紋
  ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(x,y+8,150+Math.sin(tGlobal*2)*10,30,0,0,7);ctx.stroke();
  ctx.fillStyle='rgba(0,0,60,.22)';ctx.beginPath();ctx.ellipse(x,y+8,135,26,0,0,7);ctx.fill();
  ctx.save();ctx.translate(x,y+bob);if(d2<0){ctx.scale(-1,1);}
  // 尾巴（甩動）
  const tw2=Math.sin(tGlobal*1.6)*30;
  ctx.strokeStyle=body;ctx.lineCap='round';ctx.lineWidth=44;
  ctx.beginPath();ctx.moveTo(-60,-80);ctx.quadraticCurveTo(-170,-60+tw2*0.4,-235,-20+tw2);ctx.stroke();
  ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(-225,-22+tw2);ctx.quadraticCurveTo(-268,-8+tw2*1.2,-292,6+tw2*1.4);ctx.stroke();ctx.lineCap='butt';
  // 身體
  ctx.fillStyle=body;ctx.beginPath();
  ctx.moveTo(-95,4);ctx.quadraticCurveTo(-120,-140,-58,-236);
  ctx.quadraticCurveTo(-30,-278,18,-286);ctx.quadraticCurveTo(80,-286,96,-244);
  ctx.quadraticCurveTo(108,-190,84,-120);ctx.quadraticCurveTo(102,-60,88,4);ctx.closePath();ctx.fill();
  // 肚皮鱗甲
  ctx.fillStyle=belly;ctx.beginPath();
  ctx.moveTo(-18,0);ctx.quadraticCurveTo(-40,-120,4,-212);ctx.quadraticCurveTo(48,-206,58,-150);
  ctx.quadraticCurveTo(66,-70,54,0);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(90,100,60,.5)';ctx.lineWidth=2.5;
  for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(-24+i*1.5,-24-i*26);ctx.quadraticCurveTo(16,-34-i*26,56-i*1.5,-26-i*26);ctx.stroke();}
  // 背鰭（三排、發光）
  ctx.fillStyle=fin;
  for(let i=0;i<5;i++){const fy=-60-i*44, fs=26-i*3;
    ctx.beginPath();ctx.moveTo(-78+ i*-4,fy);ctx.lineTo(-100-i*6,fy-fs);ctx.lineTo(-64+i*-4,fy-fs*0.6);ctx.closePath();ctx.fill();}
  ctx.fillStyle=darker;
  for(let i=0;i<4;i++){const fy=-90-i*46;
    ctx.beginPath();ctx.moveTo(-60,fy);ctx.lineTo(-84,fy-30);ctx.lineTo(-48,fy-20);ctx.closePath();ctx.fill();}
  // 手臂
  ctx.strokeStyle=body;ctx.lineWidth=24;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(52,-170);ctx.quadraticCurveTo(92,-150,100,-118+Math.sin(tGlobal*2)*8);ctx.stroke();ctx.lineCap='butt';
  // 頭
  ctx.fillStyle=body;ctx.beginPath();
  ctx.moveTo(18,-286);ctx.quadraticCurveTo(50,-320,92,-312);ctx.quadraticCurveTo(140,-300,150,-278);
  ctx.quadraticCurveTo(150,-262,118,-258);ctx.quadraticCurveTo(96,-238,60,-244);ctx.quadraticCurveTo(24,-252,18,-286);ctx.closePath();ctx.fill();
  // 下顎（開口）
  const jaw=g.bolt>0?14:4+Math.sin(tGlobal*3)*2;
  ctx.fillStyle=darker;ctx.beginPath();
  ctx.moveTo(70,-244);ctx.quadraticCurveTo(120,-240,142,-252);
  ctx.lineTo(136,-236+jaw);ctx.quadraticCurveTo(100,-224+jaw,72,-236);ctx.closePath();ctx.fill();
  // 牙齒
  ctx.fillStyle='#f2f0e0';
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(88+i*14,-247);ctx.lineTo(92+i*14,-238);ctx.lineTo(96+i*14,-247);ctx.closePath();ctx.fill();}
  // 眼睛（兇）
  ctx.fillStyle='#ffdf60';ctx.beginPath();ctx.ellipse(84,-284,7,5,0,0,7);ctx.fill();
  ctx.fillStyle='#c0281e';ctx.beginPath();ctx.arc(86,-284,2.6,0,7);ctx.fill();
  ctx.strokeStyle=darker;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(72,-294);ctx.lineTo(96,-288);ctx.stroke();
  ctx.restore();
  // 噴射雷電（從嘴部往目標）
  if(g.bolt>0){ const mx=x+d2*130, my=y+bob-250;
    drawBolt(mx,my,g.btx,g.bty,Math.min(1,g.bolt*3),7);
    drawBolt(mx,my,(mx+g.btx)/2+18,(my+g.bty)/2+30,Math.min(1,g.bolt*2.4),3); // 分岔
    ctx.fillStyle=`rgba(180,240,255,${Math.min(1,g.bolt*2)})`;
    ctx.beginPath();ctx.arc(mx,my,12+Math.sin(tGlobal*30)*4,0,7);ctx.fill();
    ctx.fillStyle=`rgba(255,255,190,${Math.min(1,g.bolt*2)*0.7})`;
    ctx.beginPath();ctx.arc(g.btx,g.bty,18*(1-g.bolt)+8,0,7);ctx.fill(); }
  // 血條＋名牌
  const bw=160, hpw=bw*g.hp/GODZ_HP;
  ctx.fillStyle='rgba(20,20,30,.65)';rr(x-bw/2-4,y-386,bw+8,14,7);ctx.fill();
  ctx.fillStyle='#d8453a';rr(x-bw/2,y-383,hpw,8,4);ctx.fill();
  ctx.font='bold 15px "Microsoft JhengHei"';ctx.textAlign='center';
  ctx.fillStyle='#fff';ctx.fillText('🦖 哥吉拉',x,y-394);ctx.textAlign='left';
}
// ---- 飾品（20種；slot: head 戴頭上 / body 戴身上）----
const ACCESSORIES=[
 {id:'cap',n:'棒球帽',e:'🧢',slot:'head',price:400},
 {id:'crown',n:'皇冠',e:'👑',slot:'head',price:5000},
 {id:'strawhat',n:'草帽',e:'👒',slot:'head',price:350},
 {id:'tophat',n:'紳士帽',e:'🎩',slot:'head',price:1200},
 {id:'glasses',n:'眼鏡',e:'👓',slot:'head',price:300},
 {id:'sunglasses',n:'墨鏡',e:'🕶️',slot:'head',price:600},
 {id:'flower',n:'花朵髮飾',e:'🌸',slot:'head',price:250},
 {id:'bow',n:'蝴蝶結',e:'🎀',slot:'head',price:280},
 {id:'catears',n:'貓耳',e:'🐱',slot:'head',price:800},
 {id:'halo',n:'天使光環',e:'😇',slot:'head',price:3000},
 {id:'headphone',n:'耳機',e:'🎧',slot:'head',price:900},
 {id:'party',n:'派對帽',e:'🥳',slot:'head',price:200},
 {id:'necklace',n:'項鍊',e:'📿',slot:'body',price:1500},
 {id:'scarf',n:'圍巾',e:'🧣',slot:'body',price:500},
 {id:'bowtie',n:'領結',e:'🎗️',slot:'body',price:350},
 {id:'backpack',n:'背包',e:'🎒',slot:'body',price:700},
 {id:'cape',n:'披風',e:'🦸',slot:'body',price:2000},
 {id:'wings',n:'翅膀',e:'🦋',slot:'body',price:2500},
 {id:'medal',n:'獎牌',e:'🏅',slot:'body',price:600},
 {id:'lei',n:'花環',e:'💐',slot:'body',price:450},
];
// ---- 鞋款（男女各10；style 影響外觀）----
const SHOES_M=[
 {n:'運動鞋',col:'#e2574c',style:'sneaker'},{n:'皮鞋',col:'#3a2a1a',style:'dress'},
 {n:'帆布鞋',col:'#e8e0d0',style:'flat'},{n:'籃球鞋',col:'#3f6fd6',style:'sneaker'},
 {n:'登山靴',col:'#6a4a2a',style:'boot'},{n:'樂福鞋',col:'#5a3a24',style:'dress'},
 {n:'雨鞋',col:'#f2b21c',style:'boot'},{n:'拖鞋',col:'#3fb0a0',style:'sandal'},
 {n:'涼鞋',col:'#8a6a4a',style:'sandal'},{n:'黑帆布',col:'#2a2a2a',style:'flat'},
];
const SHOES_F=[
 {n:'高跟鞋',col:'#e0559b',style:'heel'},{n:'娃娃鞋',col:'#f27ba0',style:'flat'},
 {n:'長靴',col:'#5a3a4a',style:'boot'},{n:'涼鞋',col:'#f2c94c',style:'sandal'},
 {n:'球鞋',col:'#7ec8e8',style:'sneaker'},{n:'瑪莉珍',col:'#c94f43',style:'dress'},
 {n:'雪靴',col:'#e8ddd0','style':'boot'},{n:'楔型鞋',col:'#c98a4a',style:'heel'},
 {n:'夾腳拖',col:'#9b59b6',style:'sandal'},{n:'白球鞋',col:'#f5f5f0',style:'sneaker'},
];
const HAIR_NAMES_M=['短瀏海','刺蝟頭','西裝頭','旁分','圓短髮','中分','油頭後梳','莫西干','捲短髮','超短平頭'];
const HAIR_NAMES_F=['長直髮','波浪捲','妹妹頭','雙馬尾','側長髮','丸子頭','公主切','鮑伯頭','編髮','高馬尾'];
const TOOLS=[{n:'手',e:'🖐️'},{n:'捕蟲網',e:'🦋'},{n:'釣竿',e:'🎣'},{n:'鏟子',e:'⛏️'},{n:'斧頭',e:'🪓'},{n:'木矛',e:'🔱'}];
function hasSpear(){return (inv['木矛']||0)>0;}
function eatFood(n){ const it=ITEMS[n];
  if(!it||!it.hu){toast('這個不能吃啦！');return false;}
  if(!inv[n]){return false;}
  inv[n]--; if(inv[n]<=0)delete inv[n];
  player.hunger=Math.min(100,player.hunger+it.hu);
  player.hp=Math.min(100,player.hp+Math.floor(it.hu/4));
  sfx('pop'); toast(it.e+' 吃了'+n+'！飢餓度 +'+it.hu); save(); return true;}
const DIRV=[[0,1],[-1,0],[1,0],[0,-1]];
let money=800, inv={}, dex={}, questState={};
// 名譽值加成：名譽越高、任務酬勞越高（0→1x, 300→2x, 600→3x 封頂）
function honorMult(){ return 1+Math.min(player.honor||0,600)/300; }
function questPay(base){ return Math.round(base*honorMult()); }
// 參拜/慶典累積名譽值
function addHonor(n,reason){ player.honor=(player.honor||0)+n;
  player.show={emoji:'⭐',text:'名譽 +'+n,t:1.4};
  if(reason)toast('⭐ '+reason+'　名譽值 +'+n+'（目前 '+player.honor+'）'); save(); }
function addItem(n,c){inv[n]=(inv[n]||0)+(c||1);}
function caught(n,verb){ addItem(n); dex[n]=(dex[n]||0)+1;
  const it=ITEMS[n]; player.show={emoji:it.e,text:verb+'了 '+n+'！',t:2.2};
  sfx('jingle'); save(); }
let NPCS=[];
function genNpcs(defs){ NPCS=(defs||ACT_NPCDEFS||NPC_DEFS)
  .filter(d=>!(typeof player!=='undefined'&&player.love&&player.love.name===d.name)) // v44 已成為對象的NPC不再生成分身
  .map(d=>{ const p=findWalkSafe(d.tx,d.ty);
  return {name:d.name,species:d.species,x:p.x,y:p.y,hx:p.x,hy:p.y,homeR:d.homeR*TILE,
    face:0,walk:0,vx:0,vy:0,ai:0,lines:d.lines,pal:d.pal,quest:d.quest!=null?d.quest:null,sing:0,
    gender:d.gender,hair:d.hair,hairStyle:d.hairStyle,outfit:d.outfit,shirt:d.shirt,streamer:d.streamer,
    courtable:d.courtable,aff:d.aff};});} // v44 courtable/aff 之前漏了複製，導致劉思思沒有「認識一下」

/* ================= 碰撞 ================= */
function solidAt(px,py){
  const t=T(Math.floor(px/TILE),Math.floor(py/TILE));
  if(!WALKABLE[t])return true;
  for(const b of BUILDINGS){ const s=b.scale||1;
    if(s===1){ if(px>b.x-4&&px<b.x+b.w+4&&py>b.y-4&&py<b.y+b.h)return true; }
    else{ const cx=b.x+b.w/2, by=b.y+b.h, hw=b.w*s/2, hh=b.h*s;
      if(px>cx-hw-4&&px<cx+hw+4&&py>by-hh-4&&py<by)return true; } }
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
// 搭乘交通工具中（火車/纜車/熱氣球/摩天輪/船）——夥伴與配偶會一起同乘、不在地上飛
function boarding(){return player.riding||player.balloonRide||player.ferris||player.sailing;}
function toast(t){toasts.push({t,life:3});}
function dlg(name,lines,onDone){ ui='dialog';
  dialog={name,lines:lines.map(l=>l.replace(/\{name\}/g,player.name)),i:0,ch:0,onDone,npc:null}; }
function openMenu(title,opts){ui='menu';menu={title,opts,sel:0};}
function sellValue(filter){ let v=0;
  for(const n in inv){const it=ITEMS[n];if(!it||it.cat==='gear')continue;
    if(!filter||filter.includes(it.cat))v+=it.p*inv[n];} return v;}
function doSell(filter){ let v=0;
  for(const n of Object.keys(inv)){const it=ITEMS[n];if(!it||it.cat==='gear')continue;
    if(!filter||filter.includes(it.cat)){v+=it.p*inv[n];delete inv[n];}}
  if(v>0){money+=v;sfx('cash');toast('💰 賣出獲得 '+fmt(v)+' 元！');save();}
  ui=null;}
function guideOf(n){ // 物品怎麼取得（任務提示）
  if(ITEM_GUIDE[n])return ITEM_GUIDE[n];
  const f=FISHES.find(x=>x.n===n);
  if(f)return (f.loc==='lake'?'到日月潭湖邊用釣竿釣':
    f.loc==='deep'?'先到港口買船出海，在船上用釣竿釣（深海限定）':'到海邊用釣竿（工具3）釣')+
    (f.night?'，晚上機率較高':'');
  const b2=BUGSPECS.find(x=>x.n===n);
  if(b2)return (b2.t==='night'?'晚上':'白天')+'拿捕蟲網（工具2）抓'+
    (b2.rect?'（特定地區限定出沒）':'，草地樹林都有');
  return '到處逛逛找找看，或問問雜貨店';
}
function shopBuyMenu(){
  const opts=SHOP_BUY.map(([n,pr])=>({label:ITEMS[n].e+n+'（'+fmt(pr)+'元）',cb(){
    if(money<pr){dlg('雜貨店',['錢不夠喔！'+n+' 一個 '+fmt(pr)+' 元。','自己採集是免費的：'+guideOf(n)]);return;}
    money-=pr; addItem(n); sfx('cash'); save();
    toast(ITEMS[n].e+' 買到 '+n+'！（自己採集更省錢喔）');
    shopBuyMenu();}}));
  opts.push({label:'回上頁',cb(){openShop();}});
  openMenu('🛒 購買材料（任務缺什麼來這救急）',opts);
}
function openShop(){
  const all=sellValue(null), fb=sellValue(['fish','bug']);
  openMenu('阿吉雜貨店：歡迎光臨！要做什麼呢？',[
    {label:'全部賣掉（'+fmt(all)+'元）',cb(){ all>0?doSell(null):dlg('雜貨店',['你身上沒有可以賣的東西喔！汪！']);}},
    {label:'只賣漁獲和昆蟲（'+fmt(fb)+'元）',cb(){ fb>0?doSell(['fish','bug']):dlg('雜貨店',['咦？你還沒抓到魚或蟲吧！']);}},
    {label:'🛒 購買材料（芒果/木材/礦石…）',cb(){shopBuyMenu();}},
    {label:'離開',cb(){ui=null;}}]);
}
/* ---------- 結婚系統：路人→交往→結婚→離婚 ---------- */
// player.love = {name,gender,aff(0-100),stage:'courting'/'dating'/'married',ap:{...},x,y,face,walk}
function heShe(g){return g==='m'?'他':'她';}
function apOf(c){return {shirt:c.shirt,outfit:c.outfit,pants:c.pants,tie:c.tie,hair:c.hair||'#3a2a1a',race:c.race,hairStyle:c.hairStyle};}
function faceToward(c){const dx=player.x-c.x,dy=player.y-c.y;
  c.face=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);}
function citizenInteract(c){
  faceToward(c);
  if(player.love){ // 已有對象→只能閒聊
    dlg(c.pname,[CITIZEN_LINES[Math.floor(Math.random()*CITIZEN_LINES.length)]]);return;}
  const genderTxt=c.gender==='m'?'先生':'小姐';
  // 只有異性才能發展戀情（男找女、女找男）
  const canDate=c.gender!==player.gender;
  const opts=[];
  if(canDate)opts.push({label:'認識一下 💗（成為約會對象）',cb(){
      player.love={name:c.pname,gender:c.gender,aff:15,stage:'courting',ap:apOf(c),
        x:c.x,y:c.y,face:c.face,walk:0};
      const idx=citizens.indexOf(c); if(idx>=0)citizens.splice(idx,1); // 變成專屬對象、不再隨機消失
      sfx('chime'); save();
      dlg(c.pname,['「好呀，很高興認識你！」','（'+c.pname+' 成為你的約會對象💗）',
        '多聊天、送禮物提升好感度，好感度夠高就能告白成男女朋友！']);}});
  else opts.push({label:'（'+heShe(c.gender)+'跟你是同性，只能當朋友）',cb(){
      dlg(c.pname,[CITIZEN_LINES[Math.floor(Math.random()*CITIZEN_LINES.length)]]);}});
  opts.push({label:'聊聊',cb(){dlg(c.pname,[CITIZEN_LINES[Math.floor(Math.random()*CITIZEN_LINES.length)]]);}});
  openMenu(c.pname+' '+genderTxt+'（'+(c.race!=null?RACES[c.race].n.split('・')[0]:'路人')+'）',[...opts,
    {label:'離開',cb(){ui=null;}}]);
}
function courtNpc(npc){ // v41 追求固定NPC（劉思思）：認識→成為對象後沿用戀愛系統(送禮/告白/求婚/分手/帶著走)
  faceToward(npc);
  if(player.love){ dlg(npc.name,['「你已經有心上人啦～思思祝福你們♥」']); return; }
  openMenu(npc.name+'（湖南株洲・24歲・直播主）',[
   {label:'認識一下 💗（成為約會對象，會一直跟著你）',cb(){
     player.love={name:npc.name,gender:'f',aff:Math.max(15,npc.aff||0),stage:'courting',streamer:true,
       ap:{shirt:npc.shirt||'#f472b6',outfit:npc.outfit||'dress',pants:null,tie:null,hair:npc.hair||'#3a2a2a',race:null,hairStyle:npc.hairStyle||1},
       x:npc.x,y:npc.y,face:npc.face,walk:0};
     const idx=NPCS.indexOf(npc); if(idx>=0)NPCS.splice(idx,1);
     sfx('chime'); save();
     dlg(npc.name,['「呀…你這樣看著人家，思思會害羞的啦～♥」','（劉思思成為你的約會對象💗，會一直跟著你，連搭飛機也會一起走！）',
       '多送禮物、多陪陪她，好感夠高就能告白、求婚結婚！']);}},
   {label:'聽她唱歌／聊聊',cb(){dlg(npc.name,[npc.lines[Math.floor(Math.random()*npc.lines.length)]]);}},
   {label:'離開',cb(){ui=null;}}]);
}
function giftMenuForLove(){
  const owned=GIFTS.filter(g=>inv[g.n]>0);
  if(!owned.length){dlg(player.love.name,['你手上沒有禮物耶…','去「禮品店/珠寶店」買束花或戒指再來吧！']);return;}
  const L=player.love;
  const opts=owned.map(g=>({label:g.e+g.n+'（好感+'+g.aff+'）',cb(){
    inv[g.n]--; if(inv[g.n]<=0)delete inv[g.n];
    L.aff=Math.min(100,L.aff+g.aff); sfx('jingle'); save();
    dlg(L.name,['「'+g.e+' 哇…這是要送我的嗎？我好喜歡！」','（'+heShe(L.gender)+'的好感度提升到 '+L.aff+'/100）',
      L.stage==='courting'&&L.aff>=50?'你們的感情好像可以更進一步了…試試「告白」吧！':
      L.stage==='dating'&&L.aff>=80?'好感度很高了！到戶政事務所就能結婚囉💒':'']);}}));
  opts.push({label:'算了',cb(){ui=null;}});
  openMenu('💝 要送 '+player.love.name+' 什麼禮物？',opts);
}
function loveInteract(){
  const L=player.love; faceToward(L);
  const opts=[{label:'💝 送禮物',cb(){giftMenuForLove();}}];
  if(L.stage==='courting'){
    if(L.aff>=50)opts.push({label:'💗 告白（成為男女朋友）',cb(){
      L.stage='dating'; L.aff=Math.max(L.aff,55); sfx('jingle'); save();
      dlg(L.name,['「我願意！」'+L.name+'害羞地點了點頭♥','（你們正式成為男女朋友了！）',
        '感情再加溫到好感80，就能去戶政事務所💒結婚！']);}});
    else opts.push({label:'💗 告白（好感需50，目前'+L.aff+'）',cb(){
      dlg(L.name,['「我們…是不是還不夠了解彼此呀？」','再多送點禮物、多陪陪'+heShe(L.gender)+'吧！']);}});
  } else if(L.stage==='dating'){
    opts.push({label:L.aff>=80?'💒 去戶政事務所結婚吧！':'💒 結婚（好感需80，目前'+L.aff+'）',cb(){
      dlg(L.name,[L.aff>=80?'「我準備好了♥ 我們去登記結婚吧！」':'「再多陪陪我，感情更穩固一點嘛～」',
        L.aff>=80?'（到台北或台中的「戶政事務所」辦理結婚）':''].filter(Boolean));}});
  }
  opts.push({label:'聊聊',cb(){
    dlg(L.name,[(L.stage==='married'?SPOUSE_LINES:DATE_LINES)[Math.floor(Math.random()*(L.stage==='married'?SPOUSE_LINES:DATE_LINES).length)]]);}});
  { const married=L.stage==='married', word=married?'離婚':'分手'; // v41 隨時可分手/離婚
    opts.push({label:'💔 '+word+'（隨時解除關係）',cb(){
      openMenu('確定要和 '+L.name+' '+word+'嗎？',[
        {label:'狠心'+word+'…',cb(){
          dlg(L.name,['「為什麼…嗚嗚…」'+L.name+(married?'難過地在協議書上簽了字。':'哭著跑走了。'),'（你們'+word+'了）']);
          if(married&&inv['結婚證書'])delete inv['結婚證書'];
          player.love=null;sfx('sad');save();}},
        {label:'不，我還愛'+heShe(L.gender),cb(){ui=null;}}]);}}); }
  opts.push({label:'離開',cb(){ui=null;}});
  const badge=L.stage==='married'?'💍配偶':(L.stage==='dating'?'💗男女朋友':'💗約會中');
  openMenu(L.name+'（'+badge+'・好感'+L.aff+'/100）',opts);
}
/* ---------- 夥伴系統：每位動物朋友 3 個委託，完成後可結伴同行 ---------- */
let partnerState={}, followers=[], trail=[];
function npcIdx(name){ const i=NPC_DEFS.findIndex(d=>d.name===name); if(i>=0)return i; // v44 之前大陸NPC一律回-1，全都拿到同一組委託
  const j=(typeof CN_NPC_DEFS!=='undefined')?CN_NPC_DEFS.findIndex(d=>d.name===name):-1;
  return j>=0?NPC_DEFS.length+j:-1; }
function chatLine(npc){ dlg(npc.name,[npc.lines[Math.floor(Math.random()*npc.lines.length)]
  .replace(/\{name\}/g,player.name)]); }
function talkTo(npc){ if(!npc)return;
  if(npc.name==='阿吉'){openShop();return;}
  const ddx=player.x-npc.x,ddy=player.y-npc.y;
  npc.face=Math.abs(ddx)>Math.abs(ddy)?(ddx<0?1:2):(ddy<0?3:0);
  if(npc.name==='里長伯'){chatLine(npc);return;}
  if(npc.courtable){ courtNpc(npc); return; } // v41 可追求的NPC（劉思思）
  const st=partnerState[npc.name]||(partnerState[npc.name]={s:0,f:false});
  const chain=chainOf(npcIdx(npc.name));
  if(st.s<3){ const t=chain[st.s], have=inv[t[0]]||0, it=ITEMS[t[0]];
    const opts=[];
    if(have>=t[1])opts.push({label:'交付 '+it.e+t[0]+'×'+t[1]+'（獎勵 '+fmt(questPay(t[2]))+'元）',cb(){
      inv[t[0]]-=t[1]; if(inv[t[0]]<=0)delete inv[t[0]];
      const pay=questPay(t[2]); money+=pay; st.s++; sfx('jingle'); save();
      if(st.s>=3)dlg(npc.name,['三個委託都完成了，太感謝你！（獎勵 '+fmt(pay)+' 元）','我們現在是最好的夥伴——','隨時來找我「結伴同行」，一起環島吧！🎉']);
      else{const nt2=chain[st.s];
        dlg(npc.name,['謝謝你！獎勵 '+fmt(pay)+' 元請收下～'+(player.honor>0?'（名譽加成×'+honorMult().toFixed(1)+'）':''),'下一個委託：幫我帶 '+ITEMS[nt2[0]].e+nt2[0]+'×'+nt2[1]+'！']);}}});
    else opts.push({label:'我去準備！（還差 '+(t[1]-have)+' 個）',cb(){ui=null;}});
    opts.push({label:'❓ '+t[0]+' 要去哪拿？',cb(){
      dlg(npc.name,['「'+t[0]+'」的取得方式：',guideOf(t[0]),'（缺貨也可以到雜貨店🛒購買材料）']);}});
    opts.push({label:'聊聊',cb(){chatLine(npc);}});
    opts.push({label:'離開',cb(){ui=null;}});
    openMenu(npc.name+'（夥伴委託 '+(st.s+1)+'/3）：請幫我帶 '+it.e+t[0]+'×'+t[1],opts);
    return;}
  openMenu(npc.name+'：我們是最好的夥伴！',[
    {label:st.f?'先各自行動吧（解除同行）':'結伴同行！🎉',cb(){ st.f=!st.f;
      if(st.f){followers.push(npc.name);toast('🎉 '+npc.name+' 加入了你的隊伍！');}
      else{followers=followers.filter(n2=>n2!==npc.name);toast(npc.name+' 揮揮手，下次再一起玩！');}
      sfx('chime');save();ui=null;}},
    {label:'聊聊',cb(){chatLine(npc);}},
    {label:'離開',cb(){ui=null;}}]);
}

/* ================= 造型三店（髮型/飾品/鞋子） ================= */
function salonReopen(b){ buildAct(b); }
function accList(b,slot){
  const items=ACCESSORIES.filter(a=>a.slot===slot);
  const cur=slot==='head'?player.headAcc:player.bodyAcc;
  const opts=[];
  if(cur)opts.push({label:'❌ 脫下目前的'+(slot==='head'?'頭飾':'身上飾品'),cb(){
    if(slot==='head')player.headAcc=null;else player.bodyAcc=null;save();toast('脫下了');accList(b,slot);}});
  items.forEach(a=>{ const owned=player.ownAcc.includes(a.id), eq=cur===a.id;
    opts.push({label:a.e+a.n+(eq?' ✓配戴中':owned?' 已擁有·點配戴':'　'+fmt(a.price)+'元'),cb(){
      if(!owned){ if(money<a.price){dlg(b.label,['錢不夠！'+a.n+' 要 '+fmt(a.price)+' 元。']);return;}
        money-=a.price;player.ownAcc.push(a.id);sfx('cash');}
      if(slot==='head')player.headAcc=a.id;else player.bodyAcc=a.id;
      player.sparkle=5;save();toast(a.e+' 配戴了'+a.n+'！✨');accList(b,slot);}});});
  opts.push({label:'回上頁',cb(){shopEquipMenu(b,'acc');}});
  openMenu((slot==='head'?'👒 頭上飾品':'📿 身上飾品')+'（'+items.length+'種）',opts);
}
function shopEquipMenu(b,kind){
  if(kind==='acc'){
    const hn=ACCESSORIES.filter(a=>a.slot==='head').length, bn=ACCESSORIES.filter(a=>a.slot==='body').length;
    openMenu('💝 '+b.label+'：頭上＋身上各可戴一件（共'+ACCESSORIES.length+'種）',[
      {label:'👒 頭上飾品（'+hn+'種）',cb(){accList(b,'head');}},
      {label:'📿 身上飾品（'+bn+'種）',cb(){accList(b,'body');}},
      {label:'離開',cb(){ui=null;}}]);
  } else {
    const list=player.gender==='m'?SHOES_M:SHOES_F, PRICE=600;
    const opts=[];
    if(player.shoes)opts.push({label:'👣 打赤腳（脫鞋）',cb(){player.shoes=null;save();toast('脫鞋了');shopEquipMenu(b,'shoe');}});
    list.forEach((s,i)=>{ const key=player.gender+i;
      const owned=player.ownShoes.some(o=>o.key===key), eq=player.shoes&&player.shoes.key===key;
      opts.push({label:s.n+(eq?' ✓穿著中':owned?' 已擁有·點穿上':'　'+fmt(PRICE)+'元'),cb(){
        if(!owned){ if(money<PRICE){dlg(b.label,['錢不夠！鞋子一雙 '+fmt(PRICE)+' 元。']);return;}
          money-=PRICE;player.ownShoes.push({key,n:s.n,col:s.col,style:s.style});sfx('cash');}
        player.shoes={key,col:s.col,style:s.style};player.sparkle=5;save();toast('👟 穿上「'+s.n+'」！✨');shopEquipMenu(b,'shoe');}});});
    opts.push({label:'離開',cb(){ui=null;}});
    openMenu('👟 '+b.label+'：'+(player.gender==='m'?'男款':'女款')+' 10 種鞋（一雙'+fmt(PRICE)+'元）',opts);
  }
}
function clothMenu(b,page){
  const list=player.gender==='m'?CLOTHES_M:CLOTHES_F, PRICE=800;
  const per=10, pages=Math.ceil(list.length/per);
  page=((page||0)%pages+pages)%pages;
  const start=page*per, slice=list.slice(start,start+per);
  const opts=slice.map((c,j)=>{ const i=start+j, key=player.gender+i;
    const owned=player.ownClothes.includes(key);
    const worn=player.outfit===c.style&&player.shirt===c.col&&player.deco===(c.deco||null);
    return {label:(worn?'✓ ':'')+c.n+(worn?' 穿著中':owned?'（已擁有·點穿上）':'　'+fmt(PRICE)+'元'),cb(){
      if(!owned){ if(money<PRICE){dlg(b.label,['錢不夠！這套 '+fmt(PRICE)+' 元。']);return;}
        money-=PRICE;player.ownClothes.push(key);sfx('cash');}
      player.shirt=c.col;player.outfit=c.style;player.deco=c.deco||null;player.tie=c.tie||null;
      player.sparkle=5;save();toast('👗 換上「'+c.n+'」！✨');clothMenu(b,page);}};});
  opts.push({label:'▶ 下一頁',cb(){clothMenu(b,page+1);}});
  opts.push({label:'離開',cb(){ui=null;}});
  const catName=start<20?'現代裝':start<30?'唐朝古裝':'布袋戲戲服';
  openMenu('👗 '+b.label+'：'+(player.gender==='m'?'男裝':'女裝')+' '+list.length+'套（'+(page+1)+'/'+pages+'頁・'+catName+'・一套'+fmt(800)+'元）',opts);
}
/* ================= 建築互動 ================= */
function buildAct(b){
  if(b.isLm&&b.label)collectStamp(b.label);
  const L={t101(){ openMenu('台北101：全台最高樓！',[
     {label:'登上觀景台（50元）鳥瞰台北 🏙️',cb(){ if(money<50){dlg('台北101',['觀景台門票 50 元喔。']);return;}
       money-=50;sfx('chime');save();ui=null;
       player.balloonRide={t:0,dur:9,cx:player.x,cy:player.y,r:0,kind:'view'};
       toast('🛗 高速電梯咻──直達 89 樓觀景台！');}},
     {label:'看看介紹',cb(){dlg('台北101',b.lines,()=>{ui='map';});}},
     {label:'離開',cb(){ui=null;}}]);},
   shop(){openShop();},
   market(){ openMenu('🏮 '+b.label+'：想吃點什麼？',[
     {label:'珍珠奶茶（80元）🍗+15 加速60秒',cb(){buyFood(80,()=>{player.buffSpd=60;
       player.hunger=Math.min(100,player.hunger+15);toast('🧋 好喝！飢餓+15、移動速度UP！');});}},
     {label:'香雞排（100元）🍗+35 稀有度UP',cb(){buyFood(100,()=>{player.buffLuck=90;
       player.hunger=Math.min(100,player.hunger+35);toast('🍗 好吃！飢餓+35、稀有度UP！');});}},
     {label:'芒果冰（120元）🍗+20 雙效果UP',cb(){buyFood(120,()=>{player.buffSpd=Math.max(player.buffSpd,30);
       player.buffLuck=Math.max(player.buffLuck,30);
       player.hunger=Math.min(100,player.hunger+20);toast('🍧 透心涼！飢餓+20');});}},
     {label:'離開',cb(){ui=null;}}]);},
   temple(){ const fest=festival&&festival.b===b;
     openMenu((fest?'🎉'+festival.name+'　':'')+b.label+'：要參拜嗎？'+(fest?'（慶典中，名譽加倍！）':''),[
     {label:'參拜（香油錢 100元）🙏'+(fest?'　⭐名譽+6':'　⭐名譽+3'),cb(){ if(money>=100){money-=100;sfx('cash');ui=null;
         player.face=3; player.fishing=null;
         addHonor(fest?6:3, fest?('參加「'+festival.name+'」大型慶典'):('到「'+b.label+'」參拜'));
         player.pray={t:3,label:b.label,line:FORTUNES[Math.floor(Math.random()*FORTUNES.length)]};}
       else dlg(b.label,['身上的錢不夠呢…','神明微笑著說:心誠則靈，保重身體喔。']);}},
     {label:'離開',cb(){ui=null;}}]);},
   ferris(){ openMenu('🎡 '+b.label+'：要搭摩天輪嗎？',[
     {label:'搭一圈（60元）從空中看風景',cb(){ if(money<60){dlg(b.label,['搭一次 60 元喔。']);return;}
       money-=60;sfx('chime');save();ui=null;
       player.ferris={t:0,dur:13,rx:player.x,ry:player.y,cx:b.x+b.w/2,cy:b.y-46};
       player.fishing=null;
       toast('🎡 摩天輪緩緩轉動…');}},
     {label:'不用了',cb(){ui=null;}}]);},
   station(){ const here=ACT_STATIONS.find(s=>s.n===b.label); if(!here)return;
     const myKey=here.city||here.n;
     const rideTo=(s)=>{ const key=s.city||s.n, route=railRoute(myKey,key);
       if(!route){dlg(b.label,['這裡沒有鐵路可以到那邊耶…']);return;}
       const fee=Math.round((50+route.len*1.1)/10)*10;
       if(money<fee){dlg(b.label,['車票錢不夠喔！要 '+fmt(fee)+' 元。','去賣點東西再來吧。']);return;}
       money-=fee; sfx('train');
       startRide(route.pts,'train',route.reg?660:920,()=>{
         const p=findWalkSafe(s.tx+2,s.ty+4);
         player.x=p.x;player.y=p.y;
         toast('🚉 抵達 '+s.n+'！'+(s.sight?'附近名勝：'+s.sight:'')); save();});
       player.riding.tt=route.reg?'reg':'hsr';
       const via=route.lines.join('→');
       toast((route.ferry?'⛴️ 火車開上渡輪過海！':route.reg?'🚂 綠皮火車哐當哐當出發！':world==='cn'?'🚄 動車出發！':'🚂 火車出發！')+'經由：'+via);};
     const bento={label:'🍱 鐵路便當（80元）飢餓+40',cb(){
       if(money<80){dlg(b.label,['便當一個 80 元喔。']);return;}
       money-=80;player.hunger=Math.min(100,player.hunger+40);
       sfx('pop');save();ui=null;toast('🍱 火車便當就是香！飢餓+40');}};
     if(world==='cn'){ // v45 42站太多：先選地區再選城市；票價依實際路徑長度
       const regions={};
       ACT_STATIONS.filter(s=>s.n!==b.label).forEach(s=>{(regions[s.r]=regions[s.r]||[]).push(s);});
       const opts=Object.keys(regions).map(r=>({label:'🗺️ '+r+'（'+regions[r].length+' 站）',cb(){
         const o2=regions[r].map(s=>{ const route=railRoute(myKey,s.city);
           const fee=route?Math.round((50+route.len*1.1)/10)*10:0;
           return {label:s.city+(route&&route.reg?' 🚂':'')+'（'+(route?fmt(fee)+'元':'未通車')+'）',cb(){rideTo(s);}};});
         o2.push({label:'回上頁',cb(){buildAct(b);}});
         openMenu('🚄 前往 '+r+' 地區：',o2);}}));
       opts.unshift(bento); opts.push({label:'離開',cb(){ui=null;}});
       openMenu('🚄 '+b.label+'：要搭車去哪個地區？',opts);
     } else {
       const opts=ACT_STATIONS.filter(s=>s.n!==b.label).map(s=>{
         const route=railRoute(here.n,s.n), fee=route?Math.round((50+route.len*1.1)/10)*10:0;
         return {label:s.n.replace('車站','')+'（'+fmt(fee)+'元）',cb(){rideTo(s);}};});
       opts.unshift(bento); opts.push({label:'離開',cb(){ui=null;}});
       openMenu('🚉 '+b.label+'：要搭車去哪裡呢？',opts);
     }},
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
   hotspring(){ openMenu('♨️ '+b.label+'：要下水泡湯嗎？',[
     {label:'泡湯（50元）回血30＋速度運氣UP',cb(){ if(money<50){dlg(b.label,['泡湯一次 50 元喔。']);return;}
       money-=50; sfx('chime'); ui=null;
       player.soak={t:6,rx:player.x,ry:player.y};
       player.x=b.x+b.w/2; player.y=b.y+b.h/2+6; player.fishing=null;
       player.buffSpd=Math.max(player.buffSpd,60);player.buffLuck=Math.max(player.buffLuck,60);
       player.hp=Math.min(100,player.hp+30);
       save();}},
     {label:'不用了',cb(){ui=null;}}]);},
   balloon(){ openMenu('🎈 '+b.label+'：要搭熱氣球嗎？',[
     {label:'搭熱氣球升空鳥瞰（100元）',cb(){ if(money<100){dlg(b.label,['搭一次 100 元喔。']);return;}
       money-=100; sfx('chime'); save(); ui=null;
       player.balloonRide={t:0,dur:16,cx:player.x,cy:player.y,r:70,kind:'balloon'};
       player.fishing=null;
       toast('🎈 熱氣球緩緩升空…鳥瞰花東縱谷！');}},
     {label:'不用了',cb(){ui=null;}}]);},
   eatery(){ const t=TASK_POOL[Math.abs(Math.floor(Math.sin(b.tx*13.7+b.ty*7.3)*1e4))%TASK_POOL.length];
     const opts=[
      {label:'來一份'+b.food+'（'+b.price+'元）🍗+40',cb(){buyFood(b.price,()=>{
        player.hunger=Math.min(100,player.hunger+40);toast('🍜 '+b.food+'，讚！飢餓+40');});}}];
     if(eateryDone[b.label])opts.push({label:'（委託已完成，常來坐喔！）',cb(){ui=null;}});
     else opts.push({label:'老闆委託：'+ITEMS[t[0]].e+t[0]+'×'+t[1]+'（酬勞'+fmt(questPay(t[2]))+'元）',cb(){
        const have=inv[t[0]]||0;
        if(have>=t[1]){inv[t[0]]-=t[1];if(inv[t[0]]<=0)delete inv[t[0]];
          const pay=questPay(t[2]);money+=pay;eateryDone[b.label]=1;sfx('jingle');save();
          dlg(b.label,['就是這個！太感謝了！','這是酬勞 '+fmt(pay)+' 元'+(player.honor>0?'（名譽加成×'+honorMult().toFixed(1)+'）':'')+'，招牌菜算你半價！']);}
        else dlg(b.label,['老闆說：幫我帶 '+ITEMS[t[0]].e+t[0]+'×'+t[1]+' 來，','酬勞 '+fmt(t[2])+' 元！（目前 '+have+'/'+t[1]+'）','💡 取得方式：'+guideOf(t[0])]);}});
     opts.push({label:'離開',cb(){ui=null;}});
     openMenu('🍜 '+b.label+'：歡迎光臨！',opts);},
   giftshop(){ const opts=GIFTS.map(g=>({label:g.e+g.n+'（'+fmt(g.price)+'元）'+(g.ring?' 💍求婚用':' 好感+'+g.aff),cb(){
       if(money<g.price){dlg(b.label,['錢不夠喔！'+g.n+' 要 '+fmt(g.price)+' 元。']);return;}
       money-=g.price; addItem(g.n); sfx('cash'); save();
       toast(g.e+' 買了 '+g.n+'！送給心儀對象吧♥');}}));
     opts.push({label:'離開',cb(){ui=null;}});
     openMenu('💝 '+b.label+'：買禮物送給喜歡的人♥',opts);},
   salon(){ const names=player.gender==='m'?HAIR_NAMES_M:HAIR_NAMES_F;
     openMenu('💇 '+b.label+'：換造型（每次200元）',[
       {label:'⚧ 切換男女造型（目前：'+(player.gender==='m'?'男生・短髮':'女生・長髮')+'）',cb(){
         player.gender=player.gender==='m'?'f':'m'; player.hairStyle=0; sfx('chime'); save();
         toast('切換成「'+(player.gender==='m'?'男生・短髮':'女生・長髮')+'」造型！');salonReopen(b);}},
       {label:'✂️ 換髮型（'+names.length+'種）',cb(){
         const opts=names.map((nm,i)=>({label:(i===player.hairStyle?'✓ ':'')+nm,cb(){
           if(money<200){dlg(b.label,['剪髮 200 元喔！']);return;}
           money-=200;player.hairStyle=i;sfx('chime');save();toast('💇 換上「'+nm+'」！');salonReopen(b);}}));
         opts.push({label:'回上頁',cb(){buildAct(b);}});
         openMenu('選一個髮型（200元）',opts);}},
       {label:'🎨 換髮色（'+HAIR_COLORS.length+'色）',cb(){
         const opts=HAIR_COLORS.map((c,i)=>({label:(c===player.hair?'✓ ':'')+(HAIR_COLOR_NAMES[i]||('髮色'+(i+1))),cb(){
           if(money<200){dlg(b.label,['染髮 200 元喔！']);return;}
           money-=200;player.hair=c;sfx('chime');save();toast('🎨 換上「'+(HAIR_COLOR_NAMES[i]||'新')+'」髮色！');salonReopen(b);}}));
         opts.push({label:'回上頁',cb(){buildAct(b);}});
         openMenu('選一個髮色（200元）',opts);}},
       {label:'離開',cb(){ui=null;}}]);},
   accshop(){ shopEquipMenu(b,'acc'); },
   shoeshop(){ shopEquipMenu(b,'shoe'); },
   clothshop(){ clothMenu(b); },
   airport(){ // v40 機場：搭飛機往返台灣/大陸
     const dests=AIRPORTS.filter(a=>a.w!==world);
     const opts=dests.map(a=>({label:'✈️ 飛往「'+a.label+'」（'+(a.w==='cn'?'大陸':'台灣')+'）機票 '+fmt(1500)+'元',cb(){
       if(money<1500){dlg(b.label,['機票一張 '+fmt(1500)+' 元喔。','努力賺錢再來搭飛機吧！']);return;}
       money-=1500; flyTo(a.w,a.label); }}));
     opts.push({label:'看看航班資訊',cb(){dlg(b.label,['歡迎搭乘！本機場提供台灣⇌大陸航線。',
       world==='tw'?'飛去大陸可看長城、東方明珠、熊貓，還有株洲直播主劉思思～':'飛回台灣繼續環島冒險吧！','（機票每張 '+fmt(1500)+' 元）']);}});
     opts.push({label:'離開',cb(){ui=null;}});
     openMenu('✈️ '+b.label,opts); },
   petshop(){ // v41 寵物店：領養貓狗、買飼料
     openMenu('🐾 '+b.label,[
       {label:'🐕 領養狗狗（'+fmt(2000)+'元）忠心護主',cb(){ if(player.pet){dlg(b.label,['你已經養了一隻'+(player.pet.kind==='dog'?'狗':'貓')+'囉！']);return;}
         if(money<2000){dlg(b.label,['領養一隻要 '+fmt(2000)+' 元喔。']);return;} money-=2000; adoptPet('dog'); ui=null;}},
       {label:'🐈 領養貓咪（'+fmt(2000)+'元）優雅高冷',cb(){ if(player.pet){dlg(b.label,['你已經養了一隻'+(player.pet.kind==='dog'?'狗':'貓')+'囉！']);return;}
         if(money<2000){dlg(b.label,['領養一隻要 '+fmt(2000)+' 元喔。']);return;} money-=2000; adoptPet('cat'); ui=null;}},
       {label:'🍖 買寵物飼料 ×5（'+fmt(300)+'元）目前'+player.petFood+'包',cb(){
         if(money<300){dlg(b.label,['飼料 5 包 '+fmt(300)+' 元喔。']);return;} money-=300; player.petFood+=5; sfx('cash'); save();
         toast('🍖 買了 5 包寵物飼料！（共 '+player.petFood+' 包）面對寵物按互動鍵餵食。');}},
       {label:'看看介紹',cb(){dlg(b.label,['歡迎光臨寵物店！','領養的貓狗會跟著你、有好感度，好感高會冒愛心和音符🎵。','也可以在路上撿流浪貓狗免費領養喔！','寵物會慢慢長大變老…好好照顧牠、按時餵飼料吧！','⚠️ 面對寵物可指使牠去攻擊最近的路人（後果自負）。']);}},
       {label:'離開',cb(){ui=null;}}]); },
   weaponshop(){ const opts=GUNS.map(gun=>{ const owned=(player.ownGuns||[]).includes(gun.n), eq=(player.toy===gun.n);
       return {label:gun.e+gun.n+(eq?' ✓持用中':owned?' 已擁有·點裝備':'　'+fmt(gun.price)+'元'),cb(){
         if(!owned){ if(money<gun.price){dlg(b.label,['錢不夠…「'+gun.n+'」要 '+fmt(gun.price)+' 元。','這種東西可不便宜。']);return;}
           money-=gun.price; player.ownGuns=player.ownGuns||[]; player.ownGuns.push(gun.n); sfx('cash'); }
         player.toy=gun.n; player.tool=6; save(); ui=null;
         toast('🔫 裝備「'+gun.n+'」（切到第7格📱側邊「'+gun.n+'」對路人開火）。⚠️殺人是重罪：會被關，出獄後身上只剩5000元、名譽歸零！'); }}; });
     opts.push({label:'離開',cb(){ui=null;}});
     openMenu('🔫 '+b.label+'（黑市軍火・後果自負）',opts); },
   cityhall(){ // v37 縣市政府：購買農地
     openMenu('🏛️ '+b.label+'（農地承辦處）',[
       {label:'🌾 購買農地（'+fmt(FARM_PRICE)+'元）目前 '+myFarms.length+'/'+FARM_MAX+' 塊',cb(){
         if(myFarms.length>=FARM_MAX){dlg(b.label,['你名下已有 '+FARM_MAX+' 塊農地，不能再買了！','先把現有的田顧好吧～']);return;}
         if(money<FARM_PRICE){dlg(b.label,['農地一塊 '+fmt(FARM_PRICE)+' 元喔。','錢不夠…先去賺點錢吧！']);return;}
         const [fx2,fy2]=fitSpot(b.tx+6,b.ty+1,2,2);
         let bad=false; // fitSpot 失敗會原樣返回，需再驗證一次
         for(const bb of BUILDINGS)if(fx2<bb.tx+bb.tw+1&&fx2+3>bb.tx&&fy2<bb.ty+bb.th+2&&fy2+3>bb.ty){bad=true;break;}
         if(bad){dlg(b.label,['這附近的地都登記完了…','換一個縣市政府買買看吧！']);return;}
         money-=FARM_PRICE; const f={tx:fx2,ty:fy2,state:'empty',at:0,pay:0,w:world};
         myFarms.push(f); addFarmBuild(f); sfx('cash'); save(); ui=null;
         toast('🌾 買到農地了！就在'+b.label+'旁邊（小地圖附近找木牌）——過去播種吧！');}},
       {label:'看看介紹',cb(){dlg(b.label,['這裡是'+(b.county||'')+'的行政中心。','想當農夫嗎？我們有平價農地放領專案！','買農地→播種→等它長大，期間每小時還有補助金領喔。']);}},
       {label:'離開',cb(){ui=null;}}]); },
   farm(){ const f=b.farm; // v37 農地：播種／收割
     if(!f||!myFarms.includes(f)){dlg('農地',['這是別人家的田，不要亂踩喔！']);return;}
     if(f.state==='empty'){
       openMenu('🌾 你的農地（休耕中）',[
         {label:'🌱 播種（'+FARM_SEED+'元）',cb(){
           if(money<FARM_SEED){dlg('農地',['種子和肥料要 '+FARM_SEED+' 元喔。']);return;}
           money-=FARM_SEED; f.state='grow'; f.at=absMin(); f.pay=f.at; sfx('chime'); save(); ui=null;
           toast('🌱 播種完成！一個遊戲天(24分鐘)後可收割；生長期間每遊戲小時自動+'+FARM_TICK+'元補助。');}},
         {label:'離開',cb(){ui=null;}}]);
       return; }
     const el=absMin()-f.at;
     if(el>=FARM_GROW){
       openMenu('🌾 你的農地（稻穗金黃、可以收割了！）',[
         {label:'🌾 收割！（+'+fmt(FARM_HARVEST)+'元）',cb(){
           money+=FARM_HARVEST; f.state='empty'; sfx('cash'); save(); ui=null;
           for(let i=0;i<3;i++)puffs.push({x:b.x+10+i*24,y:b.y+20,t:0.5});
           toast('🌾💰 大豐收！賣出稻穀獲得 '+fmt(FARM_HARVEST)+' 元！可以再播種囉。');}},
         {label:'離開',cb(){ui=null;}}]);
     } else {
       const pc=Math.floor(el/FARM_GROW*100);
       dlg('🌾 你的農地',['稻子長到 '+pc+'% 了…（滿 100% 可收割）','生長期間每遊戲小時自動撥 '+FARM_TICK+' 元補助到你戶頭。','幫它澆澆水、說說好話吧～']); }
   },
   magicschool(){ // v37 綠島魔法屋：職業學習
     const opts=JOBS.map(j=>({label:(player.job===j.n?'✓ ':'')+j.e+' '+j.n+'（'+j.w+j.we+'・'+j.atk+'）'+(player.job===j.n?' 修習中':' 免費'),cb(){
       if(player.job===j.n){dlg(b.label,['你已經是'+j.n+'了！','裝備「'+j.w+'」（工具列第7格）就能施展'+j.atk+'。']);return;}
       player.job=j.n; player.toy=j.w; player.tool=6; sfx('jingle'); save(); ui=null;
       toast(j.e+' 你習得【'+j.n+'】了！已裝備'+j.w+j.we+'——按互動鍵對人施展'+j.atk+'。⚠️會擊斃路人，後果同槍枝！');}}));
     if(player.job)opts.push({label:'🚪 放棄職業（免費）',cb(){
       const jn=player.job; player.job=null;
       if(JOBS.some(j=>j.w===player.toy))player.toy=null;
       save(); ui=null; toast('你放下了'+jn+'的身分，回歸平凡島民。');}});
     opts.push({label:'看看介紹',cb(){dlg(b.label,['歡迎來到綠島魔法屋！（免費傳授）','（一隻貓頭鷹瞪著你看）','六大職業：魔法師/劍士/忍者/道士/風女/冰女。','招式全是範圍技——直線牆或周身爆發，一次掃倒一片！','⚠️ 職業攻擊威力極大，砸在路人身上是會出人命的…']);}});
     opts.push({label:'離開',cb(){ui=null;}});
     openMenu('🧙 '+b.label+'（職業學習所）',opts); },
   registry(){ const L=player.love;
     if(L&&L.stage==='married'){ openMenu('💒 '+b.label+'：'+L.name+' 是你的配偶',[
       {label:(inv['結婚證書']?'✓已有結婚證書':'補領結婚證書📜'),cb(){
         if(inv['結婚證書']){dlg(b.label,['你已經有結婚證書了。']);return;}
         addItem('結婚證書');sfx('jingle');save();dlg(b.label,['補發了一張結婚證書📜。']);}},
       {label:'💔 辦理離婚（贍養費 5000元）',cb(){
         openMenu('離婚要付 '+fmt(5000)+' 元贍養費，確定？',[
           {label:'確定離婚',cb(){ if(money<5000){dlg(b.label,['贍養費不夠…離不了婚喔。']);return;}
             money-=5000; delete inv['結婚證書']; const nm=L.name; player.love=null; sfx('sad'); save();
             dlg(b.label,['離婚手續辦好了…','你和 '+nm+' 從此各奔東西。','（婚姻關係已解除）']);}},
           {label:'再想想',cb(){ui=null;}}]);}},
       {label:'離開',cb(){ui=null;}}]);
       return;}
     if(L&&L.stage==='dating'){
       const ring=inv['鑽戒']?'鑽戒':inv['戒指']?'戒指':null;
       openMenu('💒 '+b.label+'：要和 '+L.name+' 結婚嗎？',[
         {label:(L.aff<80?'好感需80（目前'+L.aff+'）':!ring?'需要一枚戒指💍（去珠寶店買）':'💍 登記結婚（規費 1200元）'),cb(){
           if(L.aff<80){dlg(b.label,['你們的感情還需要再加溫…','好感度要達到 80 才能結婚喔。']);return;}
           if(!ring){dlg(b.label,['結婚要準備一枚戒指💍！','到「禮品店/珠寶店」買「戒指」或「鑽戒」再來。']);return;}
           if(money<1200){dlg(b.label,['登記規費 1200 元不夠喔。']);return;}
           money-=1200; delete inv[ring]; if((inv[ring]||0)<=0)delete inv[ring];
           addItem('結婚證書'); L.stage='married'; L.aff=100;
           if(L.streamer){ L.ap.shirt='#ffffff'; L.ap.outfit='gown'; L.sparkle=10; } // v46 劉思思換上白紗澎裙禮服＋頭紗＋閃亮10秒
           player.wedding={t:4}; sfx('jingle'); save();
           dlg(b.label,['🎉 恭喜！你和 '+L.name+' 正式結為連理！','（獲得結婚證書📜，'+L.name+' 成為你的配偶💍）',
             '婚後'+heShe(L.gender)+'會一直陪在你身邊，一起環島吧！']);}},
         {label:'還沒準備好',cb(){ui=null;}}]);
       return;}
     dlg(b.label,['這裡是辦理結婚/離婚的戶政事務所。','先在城鎮裡找路人「認識一下」、送禮物培養感情，',
       '成為男女朋友、好感度達80後，帶著戒指來這裡就能結婚！']);},
   hotel(){ openMenu('🏨 '+b.label+'：要休息嗎？',[
     {label:'住宿一晚（200元）睡到隔天 06:00，疲勞歸零',cb(){doSleep(200,b.label);}},
     {label:'離開',cb(){ui=null;}}]);},
   myhome(){ ui='home'; },
   bluetears(){ if(isNight())dlg(b.label,['哇——海面泛起夢幻的淡藍色螢光！','這是夜光蟲（渦鞭毛藻）受海浪擾動發出的光，','每年4～6月、無光害的夜晚最容易看見。','世界級的自然奇景，快拍下來！📸']);
     else dlg(b.label,['白天看只是普通的海面…','「藍眼淚」是夜光蟲受海浪或船隻擾動發出的藍光，','要等晚上（無光害的夜晚機率最高）再來，','就能看到海面發光的奇景喔！']);},
  };
  if(L[b.t]){L[b.t]();return true;}
  if(b.lines){ // 景點台詞：每次點擊隨機組合（專屬 2 句＋通用 1 句）
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    const ls=[pick(b.lines)];
    if(b.lines.length>1){let s2=pick(b.lines),g=0;
      while(s2===ls[0]&&g++<9)s2=pick(b.lines); ls.push(s2);}
    ls.push(pick(LM_POOL[b.t]||LM_POOL.default));
    dlg(b.label,ls); return true;}
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
let gameDay=1, gameMin=8*60; // 遊戲時鐘：1 現實秒 = 1 遊戲分鐘（一天 24 分鐘）
function hourNow(){return (gameMin/60)%24;}
function isNight(){const h=hourNow();return h>=19||h<5;}
function isRainy(){return hsh(gameDay*7+Math.floor(hourNow()/3),3)>0.75;}
function dayPeriod(){const h=hourNow();
  return h<5?['🌙','深夜']:h<8?['🌅','清晨']:h<16?['☀️','白天']:h<19?['🌇','傍晚']:['🌙','夜晚'];}
function skyTint(){ const h=hourNow();
  const K=[[0,15,25,60,.58],[5,15,25,60,.58],[6.5,255,170,110,.18],[8,0,0,0,0],
           [16.5,0,0,0,0],[18.2,255,150,80,.22],[19.8,15,25,60,.58],[24,15,25,60,.58]];
  for(let i=0;i<K.length-1;i++){ if(h>=K[i][0]&&h<=K[i+1][0]){
    const t=(h-K[i][0])/(K[i+1][0]-K[i][0]||1), L=(a,b)=>a+(b-a)*t;
    return [L(K[i][1],K[i+1][1]),L(K[i][2],K[i+1][2]),L(K[i][3],K[i+1][3]),L(K[i][4],K[i+1][4])];}}
  return [0,0,0,0];}
function nearestTown(tx,ty){ let best=null,bd=1e9;
  for(const t of ACT_TOWNS){const d=(t.tx-tx)**2+(t.ty-ty)**2;if(d<bd){bd=d;best=t;}}
  return {t:best,d:Math.sqrt(bd)};}
function regionOf(){ const tx=player.x/TILE, ty=player.y/TILE;
  const tile=T(Math.floor(tx),Math.floor(ty));
  const nt=nearestTown(tx,ty); if(!nt.t)return world==='cn'?'大陸':'台灣';
  if(player.sailing){ if(world==='tw'&&tile===LAKE)return '日月潭';
    return nt.t.c+'外海';}
  if(world==='tw'){ if(tile===LAKE||dist(tx,ty,LAKEC.x,LAKEC.y)<7)return '南投・日月潭';
    if((tile===HIGH||tile===MT)&&nt.d>16)return '中央山脈'; }
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
    if(r.left==null)r.left=3;
    if(r.left<=0){toast('這顆石頭已經敲空了…過一陣子再來吧。');return true;}
    r.left--; if(r.left<=0)r.regenT=240; // 敲空後4分鐘再生
    const q=Math.random();
    if(q<0.5)caught('礦石','敲出');
    else if(q<0.8){const v=100+Math.floor(Math.random()*200);money+=v;sfx('cash');toast('💰 敲出 '+v+' 元！');save();}
    else toast('鏘…什麼都沒有。');
    return true;} }
  for(const tr of trees){ if(dist(tr.x,tr.y-4,p.x,p.y)<50){ tr.shake=0.4;
    if(tr.woodLeft==null)tr.woodLeft=2;
    if(tr.woodLeft<=0){toast('這棵樹的樹皮都被削光了…讓它休息一下吧。');return true;}
    tr.woodLeft--; if(tr.woodLeft<=0)tr.woodT=240;
    if(Math.random()<0.5)caught('木材','砍下'); else toast('咚…只削下一點樹皮。');
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
const ATTACK_LOOT=['貝殼','木材','雜草','礦石','橘子'];
function isGun(n){ return typeof GUNS!=='undefined'&&GUNS.some(g=>g.n===n); }
function jobOfWeapon(n){ return typeof JOBS!=='undefined'?JOBS.find(j=>j.w===n):null; } // v37 職業武器
function heldEmoji(n){ if(!n)return '🎁'; if(ITEMS[n])return ITEMS[n].e; const g=isGun(n)&&GUNS.find(x=>x.n===n); if(g)return g.e; const j=jobOfWeapon(n); return j?j.we:'🎁'; }
function isWeapon(){return player.tool===3||player.tool===4||player.tool===5||(player.tool===6&&(['彈弓','水槍'].includes(player.toy)||isGun(player.toy)||!!jobOfWeapon(player.toy)));} // 鏟/斧/矛/彈弓水槍/槍枝/職業武器
// v41 槍枝開火特效：各槍不同（手槍單發/衝鋒槍連發/霰彈散射/步槍曳光/狙擊長曳光/次元砲光束）
function gunFxOf(n){ const g=isGun(n)&&GUNS.find(x=>x.n===n); return g?g.fx:'pistol'; }
function spawnGunFx(sub,tx,ty){
  const ox=player.x+DIRV[player.face][0]*16, oy=player.y-22, ang=Math.atan2(ty-oy,tx-ox);
  fx.push({kind:'gun',sub,x:ox,y:oy,x2:tx,y2:ty,ang,t:0,dur:sub==='sniper'?0.28:0.2});
}
// 路人倒地的視覺/狀態（不含犯罪通報）：倒地→數秒後移除→補生維持人數平衡
function markCitizenDead(c){
  puffs.push({x:c.x,y:c.y-20,t:0.5}); puffs.push({x:c.x+6,y:c.y-14,t:0.6});
  drops.push({x:c.x+(Math.random()*16-8),y:c.y+8,coin:80+Math.floor(Math.random()*220)});
  c.dead=true; c.deadT=6; c.vx=0; c.vy=0; c.flee=0; c.talk=0;
  if(c.buddy){ c.buddy.buddy=null; c.buddy.flee=6; c.buddy.talk=0; } c.buddy=null;
}
// 犯案後果：兇殺通緝＋火速派警
function crimeSpike(n){
  player.crimes=(player.crimes||0)+n; player.murderRap=true;
  player.notoriousUntil=Math.max(player.notoriousUntil||0,gameDay+2); player.patrolT=12+Math.random()*18;
  if(!player.wanted)startWanted(player.x,player.y);
  player.wanted.phase='grace'; player.wanted.t=Math.min(player.wanted.t,5); player.wanted.cops=null; save();
}
// 開槍擊殺單一路人（槍枝用）
function killCitizen(c,verb){
  player.swing=0.28; sfx('swing'); markCitizenDead(c);
  toast((verb||'🔫💥 你開槍')+'擊倒了'+(c.pname||'路人')+'！他倒在路上…目擊的路人驚慌報警！');
  crimeSpike(3);
}
// 打倒警察的視覺/狀態＋撤退判定
function knockCop(cp){ cp.down=true; puffs.push({x:cp.x,y:cp.y-16,t:0.5});
  const v=100+Math.floor(Math.random()*200); drops.push({x:cp.x+(Math.random()*16-8),y:cp.y+8,coin:v}); return v; }
function copsRetreatCheck(msg){
  const alive=(player.wanted&&player.wanted.cops)?player.wanted.cops.filter(c2=>!c2.down):[];
  if(!alive.length){ player.wanted=null; sfx('jingle');
    toast('👊 你打倒了所有警察！警方倉皇撤退…（襲警是重罪，小心變通緝犯）'); }
  else if(msg) toast(msg+'剩 '+alive.length+' 名還在圍捕你！');
  save();
}
function attackCop(cp){ // 近戰/槍：打倒單一警察
  player.swing=0.28; sfx('thud'); const v=knockCop(cp); player.crimes=(player.crimes||0)+1;
  copsRetreatCheck('👊 打倒一名警察！他掉了 '+v+' 元…');
}
// v39 職業範圍技：radius=以自身為圓心 / line=面向前方直線
function inJobAoE(job,tx,ty){
  const R=job.range*TILE;
  if(job.mode==='radius') return dist(tx,ty,player.x,player.y)<=R+8;
  const fv=DIRV[player.face], rx=tx-player.x, ry=ty-player.y;
  const along=rx*fv[0]+ry*fv[1], perp=Math.abs(rx*(-fv[1])+ry*fv[0]);
  return along>=-14 && along<=R && perp<=TILE*0.9;
}
function spawnJobFx(job){ const fv=DIRV[player.face];
  fx.push({kind:'job',job:job.fx,x:player.x,y:player.y,dx:fv[0],dy:fv[1],range:job.range*TILE,t:0,dur:0.6}); }
function doJobAttack(job){
  player.swing=0.32; spawnJobFx(job); sfx(job.mode==='radius'?'thud':'swing');
  let killed=0, copsHit=0;
  for(const c of citizens){ if(!c.dead && inJobAoE(job,c.x,c.y)){ markCitizenDead(c); killed++; } }
  if(player.wanted&&player.wanted.cops)for(const cp of player.wanted.cops){ if(!cp.down && inJobAoE(job,cp.x,cp.y)){ knockCop(cp); copsHit++; } }
  if(killed>0){ toast(job.we+'💥 '+job.atk+'！一次擊倒 '+killed+' 名路人…引發警方追捕！'); crimeSpike(2+killed); }
  if(copsHit>0){ player.crimes=(player.crimes||0)+copsHit; copsRetreatCheck('👊 '+job.atk+' 掃倒 '+copsHit+' 名警察！'); }
  if(!killed&&!copsHit) toast(job.we+' 你施展了'+job.atk+'…範圍內沒有目標。');
}
// v37 次元砲 vs 哥吉拉
function fireCannon(){
  if((player.cannonCd||0)>0)return;
  player.cannonCd=0.7; player.swing=0.3; sfx('swing');
  fx.push({kind:'beam',x:player.x+DIRV[player.face][0]*16,y:player.y-22,x2:godz.x,y2:godz.y-150,t:0,dur:0.3});
  godz.hp--; godz.hit=0.3;
  for(let i=0;i<2;i++)puffs.push({x:godz.x+Math.random()*80-40,y:godz.y-100-Math.random()*120,t:0.6});
  if(godz.hp<=0){
    for(let i=0;i<10;i++)puffs.push({x:godz.x+Math.random()*160-80,y:godz.y-Math.random()*260,t:0.6});
    money+=GODZ_PRIZE; sfx('cash'); godz=null; godzT=900+Math.random()*600; save();
    dlg('📢 全島緊急廣播',['轟隆──哥吉拉被次元砲擊中，沉入了深海！','全島居民歡聲雷動：「英雄 '+player.name+' 萬歲！」','（獲得賞金 '+fmt(GODZ_PRIZE)+' 元！）']); }
  else toast('🛸💥 次元砲命中！哥吉拉剩 '+godz.hp+'/'+GODZ_HP+' 格血——繼續射擊！');
}
function attackPerson(c){
  if(player.tool===6&&isGun(player.toy)&&citizens.includes(c)){ killCitizen(c); return; } // 持槍對路人→擊殺
  player.swing=0.28; sfx('swing'); c.flee=6;
  puffs.push({x:c.x,y:c.y-16,t:0.4});
  if(c.robAt!=null&&tGlobal-c.robAt<120){ // 同一人2分鐘內再打不掉東西（但照樣報警）
    toast('💢 他身上已經沒東西了…而且更生氣地報警！');
  }else{
    c.robAt=tGlobal;
    if(Math.random()<0.6)drops.push({x:c.x+(Math.random()*20-10),y:c.y+8,coin:60+Math.floor(Math.random()*200)});
    else drops.push({x:c.x+(Math.random()*20-10),y:c.y+8,item:ATTACK_LOOT[Math.floor(Math.random()*ATTACK_LOOT.length)]});
    toast('💥 攻擊了'+(c.name||'路人')+'！他嚇得掉了東西…但生氣地掏出手機報警！');
  }
  // 累計傷人次數；超過10次列為通緝犯，連續2天不定時派警車
  player.crimes=(player.crimes||0)+1;
  if(player.crimes>10&&player.notoriousUntil<gameDay+2){
    player.notoriousUntil=gameDay+2; player.patrolT=20+Math.random()*40;
    toast('🚨🚨 你已傷害路人超過10次，被列為【通緝犯】！未來2天警方將不定時派車追捕！');
  }
  if(!player.wanted)startWanted(c.x,c.y);
  else{player.wanted.phase='grace';player.wanted.t=Math.min(player.wanted.t,4);player.wanted.cops=null;}
}
function startWanted(rx,ry){
  player.wanted={phase:'grace',t:8,rx,ry,car:null};
  sfx('sad'); toast('🚨 路人報警了！警車約8秒後抵達——快逃或躲進屋裡！');
}
function arrest(){
  player.wanted=null; player.jailed=true; player.fishing=null;
  // 清除所有乘坐/占用狀態，避免被捕後卡死
  player.riding=null; player.balloonRide=null; player.ferris=null;
  player.soak=null; player.pray=null; player.sailing=false; zoomT=1;
  const pr=BUILDINGS.find(b=>b.t==='prison');
  if(pr){player.x=(pr.tx+pr.tw/2)*TILE;player.y=(pr.ty+pr.th/2)*TILE;}
  flash=1; sfx('sad'); ui='jail'; save();
}
function interact(){
  if(ui)return;
  if(player.riding){player.riding.speed=Math.max(player.riding.speed,2400);return;}
  if(player.balloonRide||player.soak||player.pray||player.ferris)return;
  const p=frontPoint(44);
  if(!player.sailing){
    if(isWeapon()){ // 持武器/道具時：對任何人（NPC／路人／店老闆／警察）都是攻擊，不對話
      const gun=(player.tool===6&&isGun(player.toy)); // 槍：射程更遠、只對路人
      const job=(player.tool===6)?jobOfWeapon(player.toy):null; // v37 職業武器
      if(player.tool===6&&player.toy==='次元砲'&&godz&&dist(godz.x,godz.y,player.x,player.y)<560){fireCannon();return;} // 次元砲優先打哥吉拉
      if(job){ doJobAttack(job); return; } // v39 職業＝範圍技能（不用瞄準單一目標）
      let best=null,bd=gun?190:56;
      const scan=arr=>{for(const c of arr){if(c.dead||c.down)continue;const d=Math.min(dist(c.x,c.y,p.x,p.y),dist(c.x,c.y,player.x,player.y));
        if(d<bd){bd=d;best=c;}}};
      scan(citizens);
      if(player.wanted&&player.wanted.cops)scan(player.wanted.cops); // v37 警察也可攻擊
      if(!gun){scan(NPCS.filter(n=>!followers.includes(n.name))); scan(owners);}
      if(best){
        const isCop=player.wanted&&player.wanted.cops&&player.wanted.cops.includes(best);
        if(gun)spawnGunFx(gunFxOf(player.toy),best.x,best.y-16); // v41 開火特效
        if(isCop){attackCop(best);return;}
        attackPerson(best);return;}
      if(gun){ spawnGunFx(gunFxOf(player.toy),player.x+DIRV[player.face][0]*190,player.y-16);
        player.swing=0.28; sfx('swing'); toast('🔫 砰！附近沒有路人可射擊——再靠近城鎮一點吧。'); return; }
    }
    // 男女朋友/配偶：只有「面向對方」才互動（TA 常跟在身後，避免背對時誤觸、蓋掉點任務）
    for(const st of stars){ if(dist(st.x,st.y,p.x,p.y)<54||dist(st.x,st.y,player.x,player.y)<50){starInteract(st);return;} } // v42 明星→索取簽名
    if(player.pet&&dist(player.pet.x,player.pet.y,p.x,p.y)<52){petInteract();return;} // v41 面對寵物→指使/照顧
    for(let i=strays.length-1;i>=0;i--){const s=strays[i]; // v41 面對流浪貓狗→免費領養
      if(dist(s.x,s.y,p.x,p.y)<52||dist(s.x,s.y,player.x,player.y)<48){
        if(player.pet){dlg('流浪'+(s.kind==='dog'?'狗':'貓'),['一隻流浪'+(s.kind==='dog'?'狗':'貓')+'…','你已經有寵物了，先照顧好牠吧！']);return;}
        openMenu('🐾 一隻流浪'+(s.kind==='dog'?'狗狗':'貓咪')+'眼巴巴看著你…',[
          {label:'❤️ 領養牠（免費）',cb(){strays.splice(i,1);adoptPet(s.kind);ui=null;}},
          {label:'先不要',cb(){ui=null;}}]);return;}}
    if(player.love&&dist(player.love.x,player.love.y,p.x,p.y)<58){loveInteract();return;}
    for(const n of NPCS) if(dist(n.x,n.y,p.x,p.y)<52||dist(n.x,n.y,player.x,player.y)<50){talkTo(n);return;}
    for(const c of citizens) if(dist(c.x,c.y,p.x,p.y)<48||dist(c.x,c.y,player.x,player.y)<46){citizenInteract(c);return;}
    for(const cf of campfires) if(dist(cf.x,cf.y,player.x,player.y)<70){openCook();return;}
    for(let i=events.length-1;i>=0;i--){const ev=events[i]; // 處理偶發事件
      if(dist(ev.x,ev.y,player.x,player.y)<95){
        if(ev.type==='quarrel'){events.splice(i,1);money+=300;sfx('jingle');save();
          dlg('排解糾紛',['你上前關心：「別吵別吵，有話好好說～」','兩人不好意思地握手和好，還請你喝飲料。','（獲得 300 元謝禮）']);}
        else if(ev.type==='dog'){events.splice(i,1);money+=400;sfx('jingle');save();
          puffs.push({x:ev.x,y:ev.y-14,t:0.5});
          dlg('趕走野狗',['你大喝一聲揮揮手，野狗夾著尾巴跑走了！','被追的路人不停向你道謝。','（獲得 400 元謝禮）']);}
        else if(ev.type==='fire'){ev.stage++;sfx('splash');
          if(ev.stage>=3){events.splice(i,1);money+=500;sfx('jingle');save();
            dlg('滅火英雄',['呼——火滅了！屋主感動得快哭出來。','消防隊長頒給你見義勇為獎金！','（獲得 500 元）']);}
          else toast('🧯 潑水滅火！（'+ev.stage+'/3）繼續按互動鍵！');}
        return;}}
  }
  if(player.sailing){
    if(player.fishing){tryFish();return;} // 咬餌中優先收竿
    if(player.tool===6&&player.toy==='次元砲'&&godz&&dist(godz.x,godz.y,player.x,player.y)<560){fireCannon();return;} // v37 海上迎戰哥吉拉
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
  if(player.tool===5){ // 木矛狩獵
    if(!hasSpear()){toast('先按 🔨製作（或 C 鍵）做一支木矛！（木材×3＋礦石×1）');return;}
    player.swing=0.28; sfx('swing');
    const p2=frontPoint(46);
    for(let i=animals.length-1;i>=0;i--){const a=animals[i];
      if(dist(a.x,a.y,p2.x,p2.y)<64||dist(a.x,a.y,player.x,player.y)<52){
        for(let k=0;k<a.spec.meat;k++)drops.push({x:a.x-10+k*20,y:a.y+6,item:'生肉'});
        puffs.push({x:a.x,y:a.y-14,t:0.5});
        animals.splice(i,1);sfx('thud');toast('捕到了'+a.spec.n+'！掉出了生肉 🥩');return;}}
    return;}
  if(player.tool===6){ // 玩具槽：按互動鍵遊玩（槍已在上面 isWeapon 分支處理）
    if(isGun(player.toy)){toast('🔫 面對路人、靠近一點再按開火！');return;}
    if(player.toy&&inv[player.toy])playToy(player.toy);
    else toast('打開背包🎒點一個玩具裝備到這格！（先按 C 到玩具工坊製作）');
    return;}
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
    if(ui==='jail')return; // 監獄必須選服刑或保釋，不能直接關閉
    if(c==='Escape'||(c==='KeyB'&&ui==='bag')||(c==='KeyM'&&ui==='map')||(c==='KeyP'&&ui==='dex')
      ||(c==='KeyH'&&ui==='help')||(c==='KeyJ'&&ui==='quest'))ui=null;
    return;
  }
  if(c==='Space'||c==='KeyE')interact();
  else if(c>='Digit1'&&c<='Digit7'){player.tool=+c.slice(5)-1;sfx('blip');}
  else if(c==='KeyC')openCraft();
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
      // 手機：右側功能列與底部工具列是 UI 保留區，該處輕點不觸發互動（交給 A 鍵）
      const inUIzone=touchUI&&(e.clientX>VW-64||e.clientY>VH-96);
      const cam=camPos();
      const wx=cam.cx+e.clientX/zoom, wy=cam.cy+e.clientY/zoom;
      if(!inUIzone&&dist(wx,wy,player.x,player.y)<110)interact();
    }
    moveHold=null; tapInfo=null;}
}
cv.addEventListener('pointerup',endPointer);
cv.addEventListener('pointercancel',endPointer);
addEventListener('wheel',e=>{ if(!started)return;
  zoomT=clamp(zoomT*(e.deltaY<0?1.12:0.89),0.45,1.8);},{passive:true});

/* ================= 更新 ================= */
let bugSpawnT=0, digSpawnT=0, shellSpawnT=0, animalT=0, citizenT=0, seaT=0, firefly=[];
let festival=null, festAnnouncedDay=-1; // 寺廟祭典狀態
// 寺廟祭典排程：每天輪一場（10:00–15:00），開始前10分鐘放送
function updateFestival(){
  if(world!=='tw'||typeof FESTIVALS==='undefined'||!FESTIVALS.length){festival=null;return;}
  const f=FESTIVALS[(gameDay-1)%FESTIVALS.length], START=10*60, END=15*60;
  if(gameMin>=START-10&&gameMin<START&&festAnnouncedDay!==gameDay){ festAnnouncedDay=gameDay;
    toast('📢 祭典放送：'+f.emoji+'『'+f.name+'』10分鐘後在「'+f.temple+'」熱鬧展開！有舞龍舞獅，快來參拜衝名譽值！'); sfx('jingle'); }
  if(gameMin>=START&&gameMin<END){
    if(!festival||festival.name!==f.name){ const b=BUILDINGS.find(x=>x.label===f.temple);
      festival=b?{name:f.name,emoji:f.emoji,b,temple:f.temple}:null;
      if(festival)toast('🎉 '+f.emoji+'「'+f.name+'」正在「'+f.temple+'」盛大舉行中——舞龍舞獅登場！'); }
  } else festival=null;
}
let stamps={}, townsV={};
const STAMP_TOTAL=LANDMARKS.filter(l=>l.label).length;
function collectStamp(label){ if(!label||stamps[label])return;
  stamps[label]=1;
  toast('📍 收集景點印章：'+label+'（'+Object.keys(stamps).length+'/'+STAMP_TOTAL+'）');
  sfx('chime');save();}
let myHomes=[], eateryDone={}, groundToys=[], projs=[], events=[], eventT=75;
/* ---- v37 務農 ---- */
const FARM_PRICE=8000, FARM_SEED=500, FARM_GROW=1440, FARM_TICK=40, FARM_HARVEST=2500, FARM_MAX=10;
let myFarms=[]; // {tx,ty,state:'empty'|'grow',at(播種時遊戲絕對分),pay(上次入帳)}
const absMin=()=>gameDay*1440+gameMin;
function addFarmBuild(f){ addBuild('farm',f.tx,f.ty,2,2,player.name+'的農地',{farm:f}); }
/* ---- v37 哥吉拉 ---- */
let godz=null, godzT=240+Math.random()*300; // {x,y,hp,t,boltT,bolt,dir,hit}
/* ---- v43 颱風（僅台灣；大雷雨/雷擊/淹水） ---- */
let typhoon=null, typhoonT=220+Math.random()*320; // {name,desc,phase,t,dur,flood,lightT,strike}
function updateTyphoon(dt){
  if(world!=='tw'||!started){ if(world!=='tw')typhoon=null; return; }
  if(!typhoon){ typhoonT-=dt;
    if(typhoonT<=0&&!player.jailed){ const T2=TYPHOONS[Math.floor(Math.random()*TYPHOONS.length)];
      typhoon={name:T2.n,desc:T2.d,phase:'in',t:0,dur:300,flood:0,lightT:2,strike:null};
      sfx('sad'); flash=0.4;
      dlg('🌀 中央氣象署 颱風警報',['強烈颱風『'+T2.name+'』來襲！','（'+T2.d+'）',
        '將帶來狂風、大雷雨、雷擊與淹水，','外出小心，也可躲進屋裡避風雨！']); }
    return; }
  const ty=typhoon; ty.t+=dt; const p=ty.t/ty.dur;
  ty.phase = p<0.25?'in':p<0.78?'peak':'out';
  const target = ty.phase==='out'?Math.max(0,(1-p)/0.22):Math.min(1,p/0.25);
  ty.flood += (target-ty.flood)*Math.min(1,dt*0.5);
  ty.lightT-=dt;
  if(ty.lightT<=0){ ty.lightT = ty.phase==='peak'?(0.7+Math.random()*1.6):(2.6+Math.random()*3.2);
    flash=Math.max(flash,0.55); sfx('thud');
    const a=Math.random()*6.283, r=(2.5+Math.random()*8)*TILE;
    ty.strike={x:player.x+Math.cos(a)*r,y:player.y+Math.sin(a)*r,t:0};
    if(r<3.4*TILE&&ty.phase!=='out'&&!(ui==='home')){ player.hp=Math.max(5,player.hp-8);
      toast('⚡ 落雷就打在你附近！HP-8——快躲進屋裡或搭交通工具避雷！'); } }
  if(ty.strike){ ty.strike.t+=dt; if(ty.strike.t>0.45)ty.strike=null; }
  if(ty.t>=ty.dur){ toast('🌤️ 颱風『'+ty.name+'』遠離了，天氣逐漸放晴～'); typhoon=null; typhoonT=420+Math.random()*520; }
}
const GODZ_HP=6, GODZ_PRIZE=1000000;
/* ---- v37 特效（雷擊/斬擊/光束） ---- */
let fx=[]; // {kind:'bolt'|'slash'|'beam',x,y,x2,y2,t,dur}
/* ---- v41 寵物系統 ---- */
let strayT=8+Math.random()*10; // 流浪貓狗生成計時
const PET_PALS={dog:{fur:'#d8a35a',belly:'#fff'},cat:{fur:'#8a8a8a',belly:'#fff'}};
const PET_NAMES=['小白','旺財','來福','咪咪','花花','阿黑','球球','奶茶','布丁','麻糬','妞妞','豆豆'];
function petAgeDays(){ return player.pet?((absMin()-player.pet.born)/1440):0; }
function petStage(){ const d=petAgeDays(); return d<3?'幼':d<16?'成':'老'; }
function makePetObj(kind,name){ return {kind,name:name||PET_NAMES[Math.floor(Math.random()*PET_NAMES.length)],
  born:absMin()-1440, aff:20,hunger:90, x:player.x,y:player.y+30, face:0,walk:0,vx:0,vy:0, sick:0, atk:null, note:0}; }
function adoptPet(kind,name){ if(player.pet){toast('你已經有一隻'+(player.pet.kind==='dog'?'狗狗':'貓咪')+'了！先放生或送養才能再養一隻。');return false;}
  const p=makePetObj(kind,name); p.x=player.x; p.y=player.y+30; player.pet=p; sfx('jingle'); save();
  toast('🐾 你領養了'+(kind==='dog'?'狗狗':'貓咪')+'「'+p.name+'」！面對牠按互動鍵可以摸摸/餵食/指使攻擊。'); return true; }
function petInteract(){ const p=player.pet;
  const heart=p.aff>=60?'💗':p.aff>=30?'🙂':'';
  const opts=[
   {label:'🤚 摸摸頭（好感+3）',cb(){p.aff=Math.min(100,p.aff+3);p.note=1.2;sfx('chime');save();
     dlg(p.name,[(p.kind==='dog'?'汪汪！':'喵～')+p.name+'開心地蹭了蹭你♥']);}},
   {label:'🍖 餵飼料（剩'+player.petFood+'包・飽食+40好感+4）',cb(){
     if(player.petFood<=0){dlg(p.name,['沒有寵物飼料了…','去寵物店買一些吧！']);return;}
     player.petFood--; p.hunger=Math.min(100,p.hunger+40); p.aff=Math.min(100,p.aff+4); p.sick=Math.max(0,p.sick-1); p.note=1.2; sfx('cash');save();
     toast('🍖 '+p.name+'吃得津津有味！飽食+40、好感+4');}},
   {label:'⚔️ 指使攻擊最近的路人',cb(){ ui=null;
     let best=null,bd=1e9; for(const c of citizens){if(c.dead)continue;const d=dist(c.x,c.y,p.x,p.y);if(d<bd){bd=d;best=c;}}
     if(!best||bd>360){toast(p.name+'四處張望…附近沒有可攻擊的路人。');return;}
     p.atk={c:best,t:0}; sfx('swing'); toast('🐾💢 '+p.name+'齜牙咧嘴地朝路人衝過去！');}},
   {label:'🏞️ 放生（送養）',cb(){openMenu('確定要放生「'+p.name+'」嗎？',[
     {label:'放生…',cb(){toast('你和'+p.name+'道別，牠回到了街上。');player.pet=null;sfx('sad');save();}},
     {label:'再想想',cb(){ui=null;}}]);}},
   {label:'離開',cb(){ui=null;}}];
  openMenu('🐾 '+p.name+' '+heart+'（'+petStage()+'齡・好感'+Math.floor(p.aff)+'/100・飽食'+Math.floor(p.hunger)+'）',opts);
}
function updatePet(dt){ const p=player.pet; if(!p)return;
  p.note=Math.max(0,p.note-dt);
  p.hunger=Math.max(0,p.hunger-dt*0.35);                         // 飽食下降
  if(p.hunger>40)p.aff=Math.min(100,p.aff+dt*0.12);             // 吃飽→好感緩增
  else{ p.aff=Math.max(0,p.aff-dt*0.18); p.sick=Math.min(100,p.sick+dt*0.05); } // 餓→好感降、易病
  const age=petAgeDays();
  if(age>16)p.sick=Math.min(100,p.sick+dt*(0.02+(age-16)*0.004)); // 老年漸病
  if(p.sick>=100){ toast('🌈 '+p.name+'年紀大了…在你懷裡安詳地離開了。謝謝牠這段日子的陪伴。'); player.pet=null; save(); return; }
  if(p.atk){ const c=p.atk.c;                                    // 指使攻擊
    if(!c||c.dead||!citizens.includes(c)){p.atk=null;}
    else{ const a=Math.atan2(c.y-p.y,c.x-p.x); p.x+=Math.cos(a)*270*dt; p.y+=Math.sin(a)*270*dt; p.walk+=dt*16;
      p.face=Math.abs(c.x-p.x)>Math.abs(c.y-p.y)?(c.x>p.x?2:1):(c.y>p.y?0:3);
      if(dist(p.x,p.y,c.x,c.y)<26){ markCitizenDead(c); puffs.push({x:c.x,y:c.y-14,t:0.5});
        toast('🐾💥 '+p.name+'把路人撲倒了！目擊者驚慌報警！'); crimeSpike(3); p.atk=null; } }
    return; }
  const tx2=player.x-DIRV[player.face][0]*22-10, ty2=player.y+22, d=dist(p.x,p.y,tx2,ty2); // 跟隨主人身後
  if(d>38){ const a=Math.atan2(ty2-p.y,tx2-p.x), sp=Math.min(d,(d>220?320:170)*dt);
    const nx=p.x+Math.cos(a)*sp, ny=p.y+Math.sin(a)*sp;
    if(!hitObstacle(nx,ny)){p.x=nx;p.y=ny;}else if(!hitObstacle(nx,p.y))p.x=nx;else if(!hitObstacle(p.x,ny))p.y=ny;
    p.walk+=dt*10; p.face=Math.abs(tx2-p.x)>Math.abs(ty2-p.y)?(tx2>p.x?2:1):(ty2>p.y?0:3); } }
function drawPetActor(kind,x,y,face,walk,s){ ctx.save();ctx.translate(x,y);ctx.scale(s||0.72,s||0.72);ctx.translate(-x,-y);
  drawActor(x,y,face,walk,{species:kind,pal:PET_PALS[kind],shirt:PET_PALS[kind].fur}); ctx.restore(); }
function drawPet(p){ drawPetActor(p.kind,p.x,p.y,p.face,p.walk);
  if(p.aff>=60||p.note>0){ ctx.font='12px serif';ctx.textAlign='center';ctx.globalAlpha=p.note>0?1:0.75;
    ctx.fillText('💗',p.x-8+Math.sin(tGlobal*3)*3,p.y-24-((tGlobal*22)%14));
    ctx.fillText('🎵',p.x+9+Math.sin(tGlobal*3+1)*3,p.y-28-((tGlobal*22+7)%14));ctx.globalAlpha=1;ctx.textAlign='left'; }
  if(p.sick>55){ctx.font='11px serif';ctx.textAlign='center';ctx.fillText('🤒',p.x,p.y-22);ctx.textAlign='left';} }
function drawStray(s){ drawPetActor(s.kind,s.x,s.y,s.face,s.walk,0.66);
  ctx.font='10px serif';ctx.textAlign='center';ctx.fillStyle='#fff';
  const w2=ctx.measureText('領養?').width+8;ctx.fillStyle='rgba(90,64,35,.8)';rr(s.x-w2/2,s.y-40,w2,15,7);ctx.fill();
  ctx.fillStyle='#ffe9a0';ctx.fillText('🐾領養?',s.x,s.y-29);ctx.textAlign='left'; }
function updateStrays(dt){ strayT-=dt;
  if(strayT<=0){ strayT=12+Math.random()*14;
    for(let i=strays.length-1;i>=0;i--)if(dist(strays[i].x,strays[i].y,player.x,player.y)>1400)strays.splice(i,1);
    if(strays.length<2&&!player.sailing){ const ntC=nearestTown(player.x/TILE,player.y/TILE);
      if(ntC.t&&ntC.d<11){ const sp=findWalkSafe(Math.round(ntC.t.tx)+Math.floor(Math.random()*10-5),Math.round(ntC.t.ty)+Math.floor(Math.random()*10-5));
        if(dist(sp.x,sp.y,player.x,player.y)>150)strays.push({x:sp.x,y:sp.y,kind:Math.random()<0.5?'dog':'cat',vx:0,vy:0,ai:0,walk:0,face:0}); } } }
  for(const s of strays){ s.ai-=dt;
    if(s.ai<=0){s.ai=1.5+Math.random()*2.5; if(Math.random()<0.5){s.vx=0;s.vy=0;}else{const a=Math.random()*6.283;s.vx=Math.cos(a);s.vy=Math.sin(a);}}
    if(s.vx||s.vy){if(moveActor(s,s.vx,s.vy,40,dt)){s.walk+=dt*8;s.face=s.vx<-0.1?1:s.vx>0.1?2:s.face;}else{s.vx=0;s.vy=0;}} } }
/* ---- v42 明星系統：路上隨機出現，可索取簽名+名譽 ---- */
let starT=35+Math.random()*40;
function updateStars(dt){ starT-=dt;
  if(starT<=0){ starT=55+Math.random()*70;
    for(let i=stars.length-1;i>=0;i--)if(dist(stars[i].x,stars[i].y,player.x,player.y)>1500)stars.splice(i,1);
    const pool=(world==='cn'&&typeof STARS_CN!=='undefined')?STARS_CN:STARS_TW;
    if(stars.length<1&&!player.sailing&&typeof pool!=='undefined'){ const ntC=nearestTown(player.x/TILE,player.y/TILE);
      if(ntC.t&&ntC.d<10){ const def=pool[Math.floor(Math.random()*pool.length)];
        const sp=findWalkSafe(Math.round(ntC.t.tx)+Math.floor(Math.random()*8-4),Math.round(ntC.t.ty)+Math.floor(Math.random()*8-4));
        if(dist(sp.x,sp.y,player.x,player.y)>160){ stars.push({...def,x:sp.x,y:sp.y,hx:sp.x,hy:sp.y,vx:0,vy:0,ai:0,walk:0,face:0,say:0});
          toast('🌟 聽說巨星「'+def.name+'」出現在'+ntC.t.n+'一帶！快去要簽名加名譽！'); } } } }
  for(const s of stars){ s.ai-=dt; if(s.say>0)s.say-=dt;
    if(s.ai<=0){s.ai=2+Math.random()*3; if(Math.random()<0.5){s.vx=0;s.vy=0;}else{const a=Math.random()*6.283;s.vx=Math.cos(a);s.vy=Math.sin(a);} if(Math.random()<0.4)s.say=2.2;}
    if(dist(s.x,s.y,s.hx,s.hy)>5*TILE){s.vx=s.hx-s.x;s.vy=s.hy-s.y;}
    if(s.vx||s.vy){if(moveActor(s,s.vx,s.vy,45,dt)){s.walk+=dt*5;s.face=s.vx<-0.1?1:s.vx>0.1?2:s.face;}else{s.vx=0;s.vy=0;}} } }
function drawStar(s){ drawActor(s.x,s.y,s.face,s.walk,{species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},shirt:s.shirt,hair:s.hair,gender:s.gender,hairStyle:s.hairStyle,outfit:'suit',headAcc:s.headAcc});
  ctx.font='13px serif';ctx.textAlign='center';ctx.fillText('🌟',s.x,s.y-58+Math.sin(tGlobal*3)*2);
  const nm='⭐'+s.name; ctx.font='bold 11px "Microsoft JhengHei"';const w2=ctx.measureText(nm).width;
  ctx.fillStyle='rgba(180,40,80,.82)';rr(s.x-w2/2-6,s.y-54,w2+12,16,8);ctx.fill();
  ctx.fillStyle='#ffe9a0';ctx.fillText(nm,s.x,s.y-42);ctx.textAlign='left';
  if(s.say>0)drawChatBubble(s.x,s.y,s.catch); }
function starInteract(s){ faceToward(s);
  const signed=(player.autographs||[]).includes(s.name);
  openMenu('🌟 '+s.name+'（大明星）',[
   {label:signed?'✅ 已有'+s.name+'的簽名':'✍️ 索取簽名（名譽+30）',cb(){
     if(signed){dlg(s.name,['「你已經有我的簽名啦～再次感謝支持！」']);return;}
     player.autographs=player.autographs||[]; player.autographs.push(s.name);
     addHonor(30,'獲得巨星「'+s.name+'」的親筆簽名'); ui=null;
     dlg(s.name,['「沒問題！這張簽名送給你♥」',s.lines[Math.floor(Math.random()*s.lines.length)],'（名譽值 +30！）']);}},
   {label:'聊聊 / 合照',cb(){dlg(s.name,[s.lines[Math.floor(Math.random()*s.lines.length)]]);}},
   {label:'離開',cb(){ui=null;}}]); }
const HOUSE_TYPES=[
 {id:'cabin',n:'小木屋',icon:'🛖',wood:30,ore:10,cash:10000,tw:4,th:3},
 {id:'courtyard',n:'三合院',icon:'🏡',wood:45,ore:20,cash:20000,tw:5,th:4},
 {id:'villa',n:'歐風別墅',icon:'🏘️',wood:60,ore:35,cash:35000,tw:5,th:4},
 {id:'tower',n:'豪華高樓',icon:'🏢',wood:40,ore:80,cash:60000,tw:4,th:3},
];
function doSleep(cost,place){
  if(money<cost){dlg(place,['住宿要 '+cost+' 元喔…','去賣點東西再來吧。']);return;}
  money-=cost; flash=1; sfx('chime');
  gameDay++; gameMin=6*60;
  player.tired=0; player.hp=Math.min(100,player.hp+40);
  player.hunger=Math.max(25,player.hunger-20);
  ui=null; save();
  toast('☀️ 第 '+gameDay+' 天早晨 06:00——睡飽精神好！疲勞歸零');
}
function buildHome(ht){
  if(myHomes.length>=2){dlg('蓋房子',['最多只能擁有兩間房子喔！','你的家分別在地圖上等著你回去。']);return;}
  const wood=inv['木材']||0, ore=inv['礦石']||0;
  if(wood<ht.wood||ore<ht.ore||money<ht.cash){
    dlg('蓋房子',[ht.icon+ht.n+' 需要：','木材×'+ht.wood+'（現有'+wood+'）＋礦石×'+ht.ore+'（現有'+ore+'）',
      '＋'+fmt(ht.cash)+'元（現有'+fmt(money)+'）','蓋房子是大工程，努力收集吧！']);return;}
  const ftx=Math.floor(player.x/TILE)+DIRV[player.face][0]*3-Math.floor(ht.tw/2),
        fty=Math.floor(player.y/TILE)+DIRV[player.face][1]*3-Math.floor(ht.th/2);
  let ok=true;
  for(let yy=0;yy<ht.th&&ok;yy++)for(let xx=0;xx<ht.tw&&ok;xx++){const t=T(ftx+xx,fty+yy);
    if(!(t===GRASS||t===FIELD||t===SAND||t===HIGH||t===PATH))ok=false;}
  if(ok)for(const b of BUILDINGS)if(ftx<b.tx+b.tw+1&&ftx+ht.tw+1>b.tx&&fty<b.ty+b.th+2&&fty+ht.th+2>b.ty){ok=false;break;}
  if(!ok){dlg('蓋房子',['這裡不夠平坦寬敞…','找一塊空曠的地，面向它再蓋一次！']);return;}
  inv['木材']-=ht.wood;if(inv['木材']<=0)delete inv['木材'];
  inv['礦石']-=ht.ore;if(inv['礦石']<=0)delete inv['礦石'];
  money-=ht.cash;
  myHomes.push({tx:ftx,ty:fty,type:ht.id,w:world});
  addBuild('myhome',ftx,fty,ht.tw,ht.th,player.name+'的'+ht.n,{htype:ht.id});
  sfx('jingle'); save(); ui=null;
  toast(ht.icon+' '+ht.n+'落成！走到門口就能進去睡覺（'+myHomes.length+'/2間）');
}
function homeMenu(){
  const opts=HOUSE_TYPES.map(ht=>({label:ht.icon+ht.n+'（木材'+ht.wood+'＋礦石'+ht.ore+'＋'+fmt(ht.cash)+'元）',
    cb(){buildHome(ht);}}));
  opts.push({label:'關閉',cb(){ui=null;}});
  openMenu('🏠 蓋房子（'+myHomes.length+'/2間）選一種房型：',opts);
}
const TOY_SHOT={ // throw 類玩具：手持玩具、只射出小東西（不是把整個玩具丟掉）
 '紙飛機':{e:'✈️',up:false,spd:200,grav:20},'竹蜻蜓':{e:'🚁',up:true,spd:0,grav:-10},
 '紙船':{e:'🛶',up:false,spd:120,grav:0,water:true},'彈弓':{e:'•',up:false,spd:340,grav:120},
 '水槍':{e:'💧',up:false,spd:300,grav:90}};
function playToy(n){
  const mode=ITEMS[n].toy, e=ITEMS[n].e; ui=null;
  if(mode==='self'){ player.playT={e,n,t:2.6}; sfx('chime'); toast(e+' 玩'+n+'玩得好開心！'); }
  else if(mode==='hold'){ player.holdToy={e,n,t:60}; sfx('pop'); toast(e+' 帶著'+n+'走吧！（60秒）'); }
  else if(mode==='throw'){ const s=TOY_SHOT[n]||{e:'•',up:false,spd:240,grav:60};
    player.playT={e,n,t:0.9,act:'shoot'}; // 手上拿著玩具做發射動作
    projs.push({x:player.x+DIRV[player.face][0]*16,y:player.y-24,e:s.e,t:s.water?2.4:1.6,
      vx:s.up?0:DIRV[player.face][0]*s.spd,vy:s.up?-220:DIRV[player.face][1]*s.spd-60,grav:s.grav});
    sfx('swing'); }
  else { groundToys.push({x:player.x+DIRV[player.face][0]*46,y:player.y+DIRV[player.face][1]*46,
      e,n,t:45}); sfx('pop'); toast(e+' 放在地上玩！'); }
}
function toyMenu(page){
  const list=TOYS.slice(page*10,page*10+10);
  const opts=list.map(t=>({label:(inv[t.n]?'✓ ':'')+t.e+t.n+'（'+t.mat.map(m=>m[0]+'×'+m[1]).join('＋')+'）',
    cb(){ if(inv[t.n]){dlg('玩具工坊',['你已經有'+t.n+'了！','打開背包點它就能玩～']);return;}
      for(const [m,c] of t.mat)if((inv[m]||0)<c){
        dlg('玩具工坊',['材料不夠！'+t.n+' 需要：',t.mat.map(x2=>x2[0]+'×'+x2[1]).join('＋')]);return;}
      for(const [m,c] of t.mat){inv[m]-=c;if(inv[m]<=0)delete inv[m];}
      addItem(t.n); sfx('jingle'); save();
      dlg('玩具工坊',['做好了 '+t.e+t.n+'！','打開背包點它就能玩，不會壞掉喔～']);}}));
  opts.push(page===0?{label:'下一頁 ▶',cb(){toyMenu(1);}}:{label:'◀ 上一頁',cb(){toyMenu(0);}});
  opts.push({label:'關閉',cb(){ui=null;}});
  openMenu('🧸 玩具工坊（'+(page+1)+'/2）用木材雜草貝殼做玩具！',opts);
}
function openCraft(){
  const wood=inv['木材']||0, ore=inv['礦石']||0;
  openMenu('🔨 製作（木材×'+wood+'　礦石×'+ore+'）',[
    {label:'🏠 蓋房子（4種房型・最多2間）',cb(){homeMenu();}},
    {label:'🧸 玩具工坊（20 種手工玩具）',cb(){toyMenu(0);}},
    {label:'木矛（木材×3＋礦石×1）'+(hasSpear()?'　✓已擁有':''),cb(){
      if(hasSpear()){dlg('製作',['你已經有木矛了！','按 6 或點工具列裝備，靠近動物揮矛捕獵。']);return;}
      if(wood>=3&&ore>=1){inv['木材']-=3;if(inv['木材']<=0)delete inv['木材'];
        inv['礦石']-=1;if(inv['礦石']<=0)delete inv['礦石'];
        addItem('木矛');sfx('jingle');save();
        dlg('製作',['做出了木矛！🔱','裝備後靠近山豬、野兔揮矛就能獲得生肉！','生肉用營火烤成烤肉，就能吃了。']);}
      else dlg('製作',['材料不夠！需要 木材×3（斧頭砍樹）','和 礦石×1（斧頭敲石頭）。']);}},
    {label:'營火（木材×2）可烤肉烤魚',cb(){
      if(player.sailing){dlg('製作',['船上不能生火啦！']);return;}
      if(wood>=2){inv['木材']-=2;if(inv['木材']<=0)delete inv['木材'];
        campfires.push({x:player.x+DIRV[player.face][0]*50,y:player.y+DIRV[player.face][1]*50,t:120});
        sfx('dig');save();ui=null;toast('🔥 生起營火！靠近按互動鍵烤東西（2分鐘後熄滅）');}
      else dlg('製作',['需要 木材×2，用斧頭砍樹取得。']);}},
    {label:'關閉',cb(){ui=null;}}]);
}
function openCook(){
  const meat=inv['生肉']||0;
  const fish=Object.keys(inv).filter(n=>ITEMS[n]&&ITEMS[n].cat==='fish');
  const opts=[];
  if(meat>0)opts.push({label:'烤肉（生肉×1 → 🍖 +45飢餓）',cb(){
    inv['生肉']--;if(inv['生肉']<=0)delete inv['生肉'];
    addItem('烤肉');sfx('pop');save();ui=null;toast('🍖 烤好了！香噴噴～打開背包點擊食用');}});
  if(fish.length)opts.push({label:'烤魚（'+fish[0]+'×1 → 🍢 +35飢餓）',cb(){
    inv[fish[0]]--;if(inv[fish[0]]<=0)delete inv[fish[0]];
    addItem('烤魚');sfx('pop');save();ui=null;toast('🍢 烤魚完成！');}});
  if(!opts.length)opts.push({label:'（沒有生肉或魚…先去打獵/釣魚吧）',cb(){ui=null;}});
  opts.push({label:'離開',cb(){ui=null;}});
  openMenu('🔥 營火：要烤什麼？',opts);
}
function update(dt){
  const night=isNight();
  gameMin+=dt;
  if(gameMin>=1440){gameMin-=1440;gameDay++;toast('🌅 第 '+gameDay+' 天開始了！');save();}
  updateFestival();
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
    const ph=bR.t/bR.dur, rr2=bR.r!=null?bR.r:70;
    player.x=bR.cx+Math.sin(ph*6.283)*rr2; player.y=bR.cy+Math.cos(ph*6.283)*rr2*0.57-(rr2?20:0);
    zoomT=ph<0.25?1-(ph/0.25)*0.55:(ph>0.78?0.45+((ph-0.78)/0.22)*0.55:0.45);
    if(bR.t>=bR.dur){player.balloonRide=null;zoomT=1;player.x=bR.cx;player.y=bR.cy;
      toast(bR.kind==='view'?'🏙️ 下樓了！101 的視野真棒～':'🎈 回到地面了！剛剛的景色真美～');}}
  let dx=0,dy=0;
  if(!ui&&!player.riding&&!player.balloonRide&&!player.soak&&!player.pray&&!player.ferris){
    if(keys.KeyW||keys.ArrowUp)dy-=1; if(keys.KeyS||keys.ArrowDown)dy+=1;
    if(keys.KeyA||keys.ArrowLeft)dx-=1; if(keys.KeyD||keys.ArrowRight)dx+=1;
    if(!dx&&!dy){
      if(joy){dx=joy.dx;dy=joy.dy;}
      else if(moveHold){ const cam=camPos();
        const wx=cam.cx+moveHold.x/zoom, wy=cam.cy+moveHold.y/zoom;
        if(dist(wx,wy,player.x,player.y)>16){dx=wx-player.x;dy=wy-player.y;}}
    }
  }
  // 生存：飢餓與血量
  if(!player.riding&&!player.balloonRide&&started){
    player.hunger=Math.max(0,player.hunger-dt*(player.moving?0.14:0.08));
    if(player.hunger<=0)player.hp=Math.max(0,player.hp-dt*1.5);
    else if(player.hunger>60)player.hp=Math.min(100,player.hp+dt*0.8);
    if(player.hp<=0){
      player.hp=50;player.hunger=50;money=Math.floor(money*0.9);
      player.x=spawn.x;player.y=spawn.y;player.sailing=false;player.fishing=null;player.soak=null;flash=1;
      toast('😵 你餓昏了…好心人把你送回台北車站（損失一成金錢）');sfx('sad');save();}}
  // 泡湯中
  if(player.soak){player.soak.t-=dt;
    if(player.soak.t<=0){player.x=player.soak.rx;player.y=player.soak.ry;player.soak=null;
      toast('♨️ 泡完湯神清氣爽！');}}
  // 拜拜中
  if(player.pray){player.pray.t-=dt;
    if(player.pray.t<=0){const pr=player.pray;player.pray=null;
      dlg(pr.label,['你雙手合十、誠心一拜……','擲筊「聖筊」！抽到了籤詩：','「'+pr.line+'」']);}}
  // 摩天輪
  if(player.ferris){const fe=player.ferris;fe.t+=dt;
    const a=tGlobal*0.25; // 與繪製的車廂同步
    player.x=fe.cx+Math.cos(a)*38; player.y=fe.cy+Math.sin(a)*38+10;
    zoomT=0.75;
    if(fe.t>=fe.dur){player.x=fe.rx;player.y=fe.ry;player.ferris=null;zoomT=1;
      toast('🎡 轉了一圈回到地面！風景真好～');}}
  const run=keys.ShiftLeft||keys.ShiftRight;
  let spd=player.sailing?420:(run?385:255)*(player.buffSpd>0?1.25:1);
  if(typhoon&&typhoon.flood>0.4&&!player.sailing&&!player.riding)spd*=(1-typhoon.flood*0.32); // v43 淹水涉水變慢
  if(player.hunger<20)spd*=0.7;
  if(player.tired>80)spd*=0.75; // 太累走不快，睡一覺吧
  player.moving=false;
  if(dx||dy){ if(player.fishing)player.fishing=null;
    player.moving=moveActor(player,dx,dy,spd,dt);
    if(player.moving)player.walk+=dt*(run?13:9); }
  // 疲勞：走動累積、休息恢復
  player.tired=clamp(player.tired+(player.moving?(run?0.9:0.5):-1.4)*dt,0,100);
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
    if(dist(d.x,d.y,player.x,player.y)<32){ drops.splice(i,1);
      if(d.coin){money+=d.coin;sfx('cash');player.show={emoji:'🪙',text:'撿到 '+d.coin+' 元',t:1.4};save();}
      else{addItem(d.item);dex[d.item]=(dex[d.item]||0)+1; sfx('pop');
        player.show={emoji:ITEMS[d.item].e,text:'撿到了 '+d.item,t:1.4}; save();} } }
  for(const tr of trees){ tr.shake=Math.max(0,tr.shake-dt);
    if(!tr.has&&tr.fruit){tr.regrow-=dt;if(tr.regrow<=0)tr.has=true;} }
  for(const r of rocks){r.hit=Math.max(0,(r.hit||0)-dt);
    if(r.regenT>0){r.regenT-=dt;if(r.regenT<=0)r.left=3;}}
  for(const tr of trees)if(tr.woodT>0){tr.woodT-=dt;if(tr.woodT<=0)tr.woodLeft=2;}
  for(const tb of teaBushes)if(!tb.ready){tb.t-=dt;if(tb.t<=0)tb.ready=true;}
  for(const ca of cacti)if(!ca.ready){ca.t-=dt;if(ca.t<=0)ca.ready=true;}
  for(const sb of strawberries)if(!sb.ready){sb.t-=dt;if(sb.t<=0)sb.ready=true;}
  for(let i=lanterns.length-1;i>=0;i--){const L=lanterns[i];L.t+=dt;
    L.y-=32*dt;L.x+=Math.sin(L.t*1.5)*12*dt;
    if(L.t>12)lanterns.splice(i,1);}
  // 玩具
  if(player.playT){player.playT.t-=dt;if(player.playT.t<=0)player.playT=null;}
  if(player.holdToy){player.holdToy.t-=dt;if(player.holdToy.t<=0){toast('把玩具收回背包了');player.holdToy=null;}}
  for(let i=projs.length-1;i>=0;i--){const p2=projs[i];p2.t-=dt;
    p2.x+=p2.vx*dt;p2.y+=p2.vy*dt;p2.vy+=(p2.grav!=null?p2.grav:60)*dt;
    if(p2.t<=0)projs.splice(i,1);}
  for(let i=groundToys.length-1;i>=0;i--){groundToys[i].t-=dt;if(groundToys[i].t<=0)groundToys.splice(i,1);}
  // 同行足跡記錄
  if(player.moving||player.sailing||player.riding){
    trail.unshift({x:player.x,y:player.y});
    if(trail.length>320)trail.length=320;}
  // 婚戀對象跟隨玩家（永不消失；搭乘交通工具時一起上車，緊跟不亂飛）
  if(player.love){ const L=player.love;
    if(boarding()){ L.x=player.x; L.y=player.y; } // 同乘：貼齊玩家、繪製時隱藏
    else{ const tp=trail[Math.min(trail.length-1,12)]||{x:player.x,y:player.y};
      const d2=dist(L.x,L.y,tp.x,tp.y);
      if(d2>28){ const k=Math.min(1,dt*(d2>400?12:5)), ox=L.x;
        L.x+=(tp.x-L.x)*k; L.y+=(tp.y-L.y)*k; L.walk+=dt*9;
        L.face=Math.abs(tp.x-ox)>Math.abs(tp.y-L.y)?(tp.x<ox?1:2):(tp.y<L.y?3:0);} }}
  if(player.wedding){player.wedding.t-=dt;if(player.wedding.t<=0)player.wedding=null;}
  if(player.sparkle>0)player.sparkle=Math.max(0,player.sparkle-dt);
  if(player.love&&player.love.sparkle>0)player.love.sparkle=Math.max(0,player.love.sparkle-dt); // v42 新娘閃亮
  // NPC
  for(const n of NPCS){
    const fi=followers.indexOf(n.name);
    if(fi>=0){ // 結伴同行：跟在玩家身後排成一列
      if(boarding()){ n.x=player.x; n.y=player.y; continue; } // 同乘交通工具：貼齊玩家、隱藏
      const tp=trail[Math.min(trail.length-1,(fi+1)*15)]||{x:player.x,y:player.y};
      const d2=dist(n.x,n.y,tp.x,tp.y);
      if(d2>30){ const k=Math.min(1,dt*(d2>400?12:5));
        const ox=n.x; n.x+=(tp.x-n.x)*k; n.y+=(tp.y-n.y)*k; n.walk+=dt*9;
        n.face=Math.abs(tp.x-ox)>Math.abs(tp.y-n.y)?(tp.x<ox?1:2):(tp.y<n.y?3:0);}
      continue;}
    if(ui==='dialog'&&dialog&&dialog.npc===n)continue;
    if(n.flee>0){ n.flee-=dt; // 被攻擊後逃跑，冷靜後走回原位
      const a=Math.atan2(n.y-player.y,n.x-player.x);
      if(moveActor(n,Math.cos(a),Math.sin(a),115,dt))n.walk+=dt*10; continue;}
    n.ai-=dt;
    if(n.ai<=0){ n.ai=1.5+Math.random()*3;
      if(Math.random()<0.55){n.vx=0;n.vy=0;}
      else{const a=Math.random()*6.283;n.vx=Math.cos(a);n.vy=Math.sin(a);
        if(dist(n.x,n.y,n.hx,n.hy)>n.homeR){n.vx=(n.hx-n.x);n.vy=(n.hy-n.y);}}}
    // 離家太遠時緩緩走回（被打逃跑後歸位）
    if(dist(n.x,n.y,n.hx,n.hy)>n.homeR*1.5){n.vx=(n.hx-n.x);n.vy=(n.hy-n.y);}
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
  // 野生動物
  animalT-=dt;
  if(animalT<=0){animalT=3;
    for(let i=animals.length-1;i>=0;i--)if(dist(animals[i].x,animals[i].y,player.x,player.y)>1400)animals.splice(i,1);
    if(animals.length<5&&!player.sailing){
      const a=Math.random()*6.283,r=420+Math.random()*420;
      const ax=player.x+Math.cos(a)*r, ay=player.y+Math.sin(a)*r;
      const t=T(Math.floor(ax/TILE),Math.floor(ay/TILE));
      const ntA=nearestTown(ax/TILE,ay/TILE);
      if((t===GRASS||t===HIGH)&&ntA.d>8&&!hitObstacle(ax,ay))
        animals.push({x:ax,y:ay,spec:ANIMALS[Math.floor(Math.random()*ANIMALS.length)],vx:0,vy:0,ai:0,walk:0,face:0});}}
  for(const a of animals){ a.ai-=dt;
    const pd=dist(a.x,a.y,player.x,player.y);
    if(pd<130&&player.tool===5&&hasSpear()){ // 看到武器逃跑
      const ang=Math.atan2(a.y-player.y,a.x-player.x);
      if(moveActor(a,Math.cos(ang),Math.sin(ang),a.spec.spd+40,dt))a.walk+=dt*8;
    } else {
      if(a.ai<=0){a.ai=1+Math.random()*2.5;
        if(Math.random()<0.5){a.vx=0;a.vy=0;}
        else{const g2=Math.random()*6.283;a.vx=Math.cos(g2);a.vy=Math.sin(g2);}}
      if(a.vx||a.vy){if(moveActor(a,a.vx,a.vy,a.spec.spd*0.5,dt))a.walk+=dt*6;else{a.vx=0;a.vy=0;}}}}
  // 市鎮民眾
  citizenT-=dt;
  if(citizenT<=0){citizenT=1.2;
    for(let i=citizens.length-1;i>=0;i--){ const c=citizens[i];
      if(c.dead&&c.deadT<=0){citizens.splice(i,1);continue;} // 屍體移除→之後自動補生維持人數
      if(dist(c.x,c.y,player.x,player.y)>1500)citizens.splice(i,1); }
    const ntC=nearestTown(player.x/TILE,player.y/TILE);
    // 路人數量×2以上（上限18），每次補幾個、有機率成雙結伴
    if(citizens.length<18&&ntC.d<11&&!player.sailing){
      const spawnN=Math.min(3,18-citizens.length);
      for(let s=0;s<spawnN;s++){
        const p2=findWalkSafe(ntC.t.tx+Math.floor(Math.random()*16-8),ntC.t.ty+Math.floor(Math.random()*16-8));
        if(dist(p2.x,p2.y,player.x,player.y)<180)continue;
        const c1=makeCitizen(p2.x,p2.y);
        citizens.push(c1);
        // 40% 機率生成一位結伴同行的夥伴（走在一起、會聊天）
        if(Math.random()<0.4&&citizens.length<18){
          const buddy=makeCitizen(p2.x+18,p2.y+6);
          buddy.buddy=c1; c1.buddy=buddy; citizens.push(buddy);
        }
      }
    }
  }
  for(const c of citizens){ if(c.dead){ c.deadT-=dt; continue; } // 已被擊倒（屍體）不再行動
    c.ai-=dt; if(c.talk>0)c.talk-=dt; if(c.chatCd>0)c.chatCd-=dt;
    if(c.flee>0){ c.flee-=dt; c.talk=0; // 被攻擊後驚慌逃跑
      const a=Math.atan2(c.y-player.y,c.x-player.x);
      if(moveActor(c,Math.cos(a),Math.sin(a),120,dt))c.walk+=dt*10; continue;}
    // 結伴：偶爾停下面對面聊天，冒出對話泡泡
    if(c.buddy&&citizens.includes(c.buddy)){
      const bd=c.buddy, dd=dist(c.x,c.y,bd.x,bd.y);
      if(c.talk>0){ c.vx=0;c.vy=0; c.face=bd.x<c.x?1:2; continue; } // 聊天中站定面對夥伴
      if(dd<64&&c.chatCd<=0&&Math.random()<0.03){ c.talk=bd.talk=2.4; c.chatCd=bd.chatCd=8;
        const pool=(world==='cn'&&typeof CN_CHAT_LINES!=='undefined')?CN_CHAT_LINES:CHAT_LINES; // v41 大陸路人方言口音
        c.line=bd.line=pool[Math.floor(Math.random()*pool.length)]; continue; }
      if(dd>80){ c.vx=bd.x-c.x; c.vy=bd.y-c.y; // 落後太多就靠向夥伴
        if(moveActor(c,c.vx,c.vy,50,dt))c.walk+=dt*5; continue; }
    }
    if(c.ai<=0){c.ai=1.5+Math.random()*3;
      if(Math.random()<0.5){c.vx=0;c.vy=0;}
      else{const g2=Math.random()*6.283;c.vx=Math.cos(g2);c.vy=Math.sin(g2);
        if(dist(c.x,c.y,c.hx,c.hy)>c.homeR){c.vx=c.hx-c.x;c.vy=c.hy-c.y;}}}
    if(c.vx||c.vy){if(moveActor(c,c.vx,c.vy,50,dt)){c.walk+=dt*5;c.face=c.vx<-0.1?1:c.vx>0.1?2:c.face;}else{c.vx=0;c.vy=0;}}}
  // 海上生物（鯨魚、飛魚、海豚）
  seaT-=dt;
  if(seaT<=0){seaT=1.6;
    for(let i=sealife.length-1;i>=0;i--)if(sealife[i].t>sealife[i].dur||dist(sealife[i].x,sealife[i].y,player.x,player.y)>1400)sealife.splice(i,1);
    if(player.sailing&&sealife.length<6){
      const a=Math.random()*6.283,r=200+Math.random()*500;
      const sx2=player.x+Math.cos(a)*r, sy2=player.y+Math.sin(a)*r;
      if(T(Math.floor(sx2/TILE),Math.floor(sy2/TILE))===SEA){
        const kind=['whale','fly','fly','dolphin'][Math.floor(Math.random()*4)];
        sealife.push({x:sx2,y:sy2,kind,t:0,dur:kind==='whale'?9:3.5,dir:Math.random()<0.5?1:-1});}}}
  for(const s of sealife){s.t+=dt; s.x+=s.dir*(s.kind==='whale'?12:s.kind==='dolphin'?60:90)*dt;}
  // 營火與煙霧
  for(let i=campfires.length-1;i>=0;i--){campfires[i].t-=dt;if(campfires[i].t<=0)campfires.splice(i,1);}
  for(let i=puffs.length-1;i>=0;i--){puffs[i].t-=dt;if(puffs[i].t<=0)puffs.splice(i,1);}
  // 通緝／警車追捕（v37：警車超車攔截→警察下車包圍→圍住才逮捕）
  if(player.wanted){ const wt=player.wanted; wt.t-=dt;
    const hidden=(ui==='home'); // 躲進自己家＝警察看不到
    if(wt.phase==='grace'){
      if(wt.t<=0){ const sp2=findWalkSafe(Math.round(wt.rx/TILE),Math.round(wt.ry/TILE));
        wt.car={x:sp2.x,y:sp2.y}; wt.phase='chase'; wt.t=14; sfx('sad');
        toast('🚓 警車來了！它會全速超車繞到你前面攔截——快跑！'); }
    } else if(wt.phase==='chase'){ // 警車追向玩家：接近就減速，到「6格距離」停車下車包圍
      const car=wt.car;
      const dxx=player.x-car.x, dyy=player.y-car.y, pd=Math.hypot(dxx,dyy)||1;
      if(!hidden){
        const spd = pd>12*TILE?460 : pd>8*TILE?300 : 160; // 接近6格逐漸減速，給玩家逃跑空間
        const nx=car.x+dxx/pd*spd*dt, ny=car.y+dyy/pd*spd*dt;
        if(!hitObstacle(nx,ny)){car.x=nx;car.y=ny;}       // 只走陸地：不會開進海裡、不穿牆
        else if(!hitObstacle(nx,car.y))car.x=nx;
        else if(!hitObstacle(car.x,ny))car.y=ny;
        if(pd<6*TILE){ // 離玩家約6格就停車、警察下車朝玩家包圍過來
          wt.phase='block'; wt.t=26; sfx('sad'); wt.cops=[];
          for(let i=0;i<5;i++){ const cx=car.x+Math.cos(i*1.257)*16, cy=car.y+Math.sin(i*1.257)*16;
            const ok=!hitObstacle(cx,cy); wt.cops.push({x:ok?cx:car.x,y:ok?cy:car.y,down:false,slot:i*1.257,walk:0,face:2}); }
          toast('🚔 警車停在離你約6格處，5名警察下車朝你包圍過來——趁機突圍或躲進屋裡！'); } }
      if(wt.t<=0){ if(hidden||pd>360){player.wanted=null;toast('🏃 甩掉警車了！以後別亂來囉～');}
        else wt.t=6; }
    } else if(wt.phase==='block'){ // 警察包圍圈：4人以上貼身＝逮捕
      const cops=wt.cops.filter(c2=>!c2.down);
      let near=0,minD=1e9;
      for(const cp of cops){
        const a=cp.slot+tGlobal*0.35; // 包圍點緩慢繞圈，堵住缺口
        const txp=player.x+Math.cos(a)*42, typ=player.y+Math.sin(a)*42;
        const dxx=txp-cp.x, dyy=typ-cp.y, d=Math.hypot(dxx,dyy)||1;
        if(!hidden){ const step=Math.min(300*dt,d);
          const nx=cp.x+dxx/d*step, ny=cp.y+dyy/d*step;
          if(!hitObstacle(nx,ny)){cp.x=nx;cp.y=ny;}
          else if(!hitObstacle(nx,cp.y))cp.x=nx; else if(!hitObstacle(cp.x,ny))cp.y=ny;
          cp.walk+=dt*8;
          cp.face=Math.abs(player.x-cp.x)>Math.abs(player.y-cp.y)?(player.x>cp.x?1:3):(player.y>cp.y?2:0); }
        const pdc=dist(cp.x,cp.y,player.x,player.y);
        if(pdc<62)near++; minD=Math.min(minD,pdc); }
      if(cops.length&&near>=Math.min(4,cops.length)&&!hidden){
        toast('👮 警察把你團團圍住，跑不掉了——束手就擒吧！'); arrest(); }
      else if(wt.t<=0){ if(hidden||minD>360){player.wanted=null;toast('🏃 警察追不上你，悻悻然收隊了！');}
        else wt.t=8; } // 還沒圍住就繼續纏鬥
    }
  }
  // v37 哥吉拉：不定時出現在玩家附近外海（廣播），會噴射雷電
  if(started&&!player.jailed){
    if(!godz){ godzT-=dt;
      if(godzT<=0){ let sp=null;
        for(let k=0;k<40&&!sp;k++){ const a=Math.random()*6.283, r=(22+Math.random()*14)*TILE;
          const gx2=player.x+Math.cos(a)*r, gy2=player.y+Math.sin(a)*r;
          const tx2=Math.floor(gx2/TILE), ty2=Math.floor(gy2/TILE);
          if(tx2<4||ty2<4||tx2>MW-5||ty2>MH-5)continue;
          let sea=true; for(let dy=-3;dy<=3&&sea;dy++)for(let dx=-3;dx<=3&&sea;dx++)if(T(tx2+dx,ty2+dy)!==SEA)sea=false;
          if(sea)sp={x:gx2,y:gy2}; }
        if(sp){ godz={x:sp.x,y:sp.y,hp:GODZ_HP,t:300,boltT:2,bolt:0,btx:0,bty:0,dir:Math.random()<0.5?1:-1,hit:0};
          sfx('sad');
          toast('📢【全島緊急廣播】怪獸「哥吉拉」出現在你附近的外海！🚨 擊敗可獲 '+fmt(GODZ_PRIZE)+' 元賞金（武器店有售次元砲・5分鐘內有效）'); }
        else godzT=30; } // 附近沒深海，稍後再試
    } else { godz.t-=dt; godz.hit=Math.max(0,godz.hit-dt); godz.bolt=Math.max(0,godz.bolt-dt);
      const nx=godz.x+godz.dir*20*dt; // 緩慢巡游（只走深海）
      if(T(Math.floor(nx/TILE),Math.floor(godz.y/TILE))===SEA)godz.x=nx; else godz.dir*=-1;
      godz.boltT-=dt;
      if(godz.boltT<=0){ godz.boltT=2.4+Math.random()*2; // 噴射雷電
        const pd=dist(godz.x,godz.y,player.x,player.y);
        if(pd<520){ godz.btx=player.x; godz.bty=player.y; godz.bolt=0.5; sfx('thud');
          if(pd<300){ player.hp=Math.max(5,player.hp-10); flash=0.5;
            toast('⚡ 哥吉拉朝你噴射雷電！HP-10——拉開距離再開砲！'); } }
        else { const a2=Math.random()*6.283; godz.btx=godz.x+Math.cos(a2)*320; godz.bty=godz.y+Math.sin(a2)*180+60; godz.bolt=0.45; } }
      if(godz.t<=0){ godz=null; godzT=600+Math.random()*600;
        toast('📢 哥吉拉潛回深海消失了…（賞金任務結束，等下次廣播吧）'); } }
  }
  // v37 農地：生長期間每遊戲小時自動入帳補助
  if(started&&myFarms.length){ let gain=0; const nowA=absMin();
    for(const f of myFarms){ if(f.state!=='grow')continue;
      while(nowA-f.pay>=60&&f.pay-f.at<FARM_GROW){f.pay+=60;gain+=FARM_TICK;} }
    if(gain){ money+=gain; sfx('cash'); toast('🌾 農地補助入帳 +'+gain+' 元'); save(); } }
  // v37 特效與次元砲冷卻
  for(let i=fx.length-1;i>=0;i--){fx[i].t+=dt;if(fx[i].t>fx[i].dur)fx.splice(i,1);}
  updatePet(dt); updateStrays(dt); updateStars(dt); updateTyphoon(dt); // v41 寵物/流浪貓狗、v42 明星、v43 颱風
  if(flyAnim>0){ flyAnim-=dt; if(flyAnim<=0){flyAnim=0;
    toast('✈️ 抵達「'+flyLabel+'」！歡迎來到'+(flyDestW==='cn'?'大陸'+(regionOf?'':''):'台灣')+'～'+(flyDestW==='cn'?'（湖南株洲有直播主劉思思）':'')); } }
  if((player.cannonCd||0)>0)player.cannonCd-=dt;
  // 通緝犯：2天內不定時自動派警車追捕（即使沒再犯案）
  if(player.notoriousUntil>gameDay&&!player.jailed&&started){
    player.patrolT-=dt;
    if(player.patrolT<=0&&!player.wanted&&!player.sailing&&!player.riding&&!player.balloonRide&&ui!=='home'){
      player.patrolT=45+Math.random()*75; // 下一次巡邏間隔
      startWanted(player.x,player.y);
      toast('🚨 通緝犯！警方巡邏發現你的行蹤——快逃！');
    }
  } else if(player.notoriousUntil&&player.notoriousUntil<=gameDay){
    player.notoriousUntil=0; player.crimes=0; // 刑期結束、洗白
    toast('✅ 通緝時效已過，你不再是通緝犯了（傷人紀錄歸零）。');
  }
  // 街頭偶發事件（吵架/野狗/失火）
  eventT-=dt;
  if(eventT<=0){ eventT=90+Math.random()*90;
    if(events.length<1&&!player.sailing&&!player.riding&&started){
      const roll=Math.random();
      if(roll<0.34){ // 失火：找附近民宅
        let hs2=null,hd=1e9;
        for(const b of BUILDINGS){if(b.t!=='house'&&b.t!=='myhome')continue;
          const d3=dist(b.x+b.w/2,b.y+b.h,player.x,player.y);
          if(d3<40*TILE&&d3>300&&d3<hd){hd=d3;hs2=b;}}
        if(hs2){events.push({type:'fire',x:hs2.x+hs2.w/2,y:hs2.y+hs2.h,house:hs2,t:80,stage:0});
          toast('🔥 附近有房子失火了！快去連按互動鍵滅火！');sfx('sad');}
      } else {
        const a=Math.random()*6.283, r=(8+Math.random()*14)*TILE;
        const ex=player.x+Math.cos(a)*r, ey=player.y+Math.sin(a)*r;
        const et=T(Math.floor(ex/TILE),Math.floor(ey/TILE));
        if(WALKABLE[et]&&!hitObstacle(ex,ey)){
          if(roll<0.67){events.push({type:'quarrel',x:ex,y:ey,t:70,stage:0});
            toast('💢 附近有人吵起來了…去關心一下吧！');}
          else{events.push({type:'dog',x:ex,y:ey,t:70,stage:0});
            toast('🐕 有野狗在追路人！快去幫忙！');sfx('sad');}}}}}
  for(let i=events.length-1;i>=0;i--){const ev=events[i];ev.t-=dt;
    if(ev.t<=0){events.splice(i,1);
      toast(ev.type==='fire'?'🔥 消防隊趕到把火滅了…下次快一點！':'路上的騷動平息了…');}}
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
  if(rg!==lastRegion){ if(lastRegion)banner={t:2.6,text:rg}; lastRegion=rg;
    if(started&&rg.includes('・')&&!townsV[rg]){townsV[rg]=1;
      const nV=Object.keys(townsV).length;
      if(nV>1&&nV%5===0)toast('🗺️ 已造訪 '+nV+' 個地區！');save();}}
  if(banner){banner.t-=dt;if(banner.t<=0)banner=null;}
  for(let i=toasts.length-1;i>=0;i--){toasts[i].life-=dt;if(toasts[i].life<=0)toasts.splice(i,1);}
}

/* ================= 角色繪製（立體感） ================= */
function drawSparkle(x,y,t){ // 換新裝：全身亮晶晶（t 為剩餘秒數，共5秒）
  const a=Math.min(1,t/1); // 最後1秒淡出
  ctx.save();
  // 柔和金色光暈
  const g=ctx.createRadialGradient(x,y-24,4,x,y-24,34);
  g.addColorStop(0,`rgba(255,240,180,${0.28*a})`);g.addColorStop(1,'rgba(255,240,180,0)');
  ctx.fillStyle=g;ctx.fillRect(x-40,y-64,80,80);
  // 環繞閃爍的星星（四角星＋圓點）
  for(let i=0;i<9;i++){
    const ang=tGlobal*2.2+i*(6.283/9);
    const rad=20+8*Math.sin(tGlobal*3+i*1.7);
    const sx=x+Math.cos(ang)*rad, sy=y-26+Math.sin(ang)*rad*0.9;
    const tw=Math.abs(Math.sin(tGlobal*5+i*2));
    const sz=(1.6+2.4*tw)*a;
    ctx.fillStyle=`rgba(255,255,${180+Math.floor(60*tw)},${(0.5+0.5*tw)*a})`;
    // 四角星
    ctx.beginPath();
    ctx.moveTo(sx,sy-sz*2);ctx.lineTo(sx+sz*0.5,sy-sz*0.5);ctx.lineTo(sx+sz*2,sy);
    ctx.lineTo(sx+sz*0.5,sy+sz*0.5);ctx.lineTo(sx,sy+sz*2);ctx.lineTo(sx-sz*0.5,sy+sz*0.5);
    ctx.lineTo(sx-sz*2,sy);ctx.lineTo(sx-sz*0.5,sy-sz*0.5);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
function drawShoe(cx,ty,s){ // s={col,style}
  const col=s.col||'#4a3428', hi=tint(col,34), dk=tint(col,-30);
  ctx.fillStyle=col;
  if(s.style==='boot'){ // 靴子：筒身＋鞋底＋光澤
    rr(cx-3,ty-3,7,15,3);ctx.fill();
    ctx.fillStyle=hi;rr(cx-2,ty-2,2,12,1);ctx.fill(); // 高光帶
    ctx.fillStyle=dk;rr(cx-4,ty+11,10,3,1.5);ctx.fill(); // 鞋底
    ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(cx-1,ty-1,1.4,4);}
  else if(s.style==='heel'){ // 高跟鞋：鞋身＋細跟＋鞋底紅
    ctx.fillStyle=col;rr(cx-3,ty,8,8,2);ctx.fill();
    ctx.fillStyle=hi;ctx.beginPath();ctx.moveTo(cx-2,ty+1);ctx.lineTo(cx+4,ty+1);ctx.lineTo(cx+3,ty+4);ctx.closePath();ctx.fill();
    ctx.fillStyle=dk;ctx.fillRect(cx+3,ty+8,2,6); // 跟
    ctx.fillStyle='#c94f43';rr(cx-3,ty+7,10,2,1);ctx.fill();} // 紅底
  else if(s.style==='sandal'){ // 涼鞋：鞋底＋交叉帶
    ctx.fillStyle=tint(col,-10);rr(cx-3,ty+7,11,3,1.5);ctx.fill();
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(cx-2,ty+7);ctx.lineTo(cx+3,ty+1);ctx.moveTo(cx+4,ty+7);ctx.lineTo(cx-1,ty+1);ctx.stroke();ctx.lineCap='butt';}
  else if(s.style==='sneaker'){ // 運動鞋：鞋身＋白鞋底＋鞋帶
    ctx.fillStyle=col;rr(cx-3,ty+2,11,8,3);ctx.fill();
    ctx.fillStyle=hi;rr(cx-2,ty+3,9,2,1);ctx.fill();
    ctx.fillStyle='#f5f5f5';rr(cx-4,ty+9,12,3,1.5);ctx.fill(); // 白鞋底
    ctx.strokeStyle='#fff';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(cx-1,ty+4);ctx.lineTo(cx+3,ty+4);ctx.moveTo(cx-1,ty+6);ctx.lineTo(cx+3,ty+6);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx+5,ty+7,1.4,0,7);ctx.fill();} // 標誌
  else if(s.style==='dress'){ // 皮鞋：亮面＋鞋底
    ctx.fillStyle=col;rr(cx-3,ty+3,12,7,3);ctx.fill();
    ctx.fillStyle=hi;ctx.beginPath();ctx.ellipse(cx+2,ty+5,5,2,0,0,7);ctx.fill(); // 亮面
    ctx.fillStyle=dk;rr(cx-3,ty+9,12,2,1);ctx.fill();}
  else { // 娃娃鞋/平底：圓頭＋小蝴蝶結
    ctx.fillStyle=col;rr(cx-3,ty+3,10,7,4);ctx.fill();
    ctx.fillStyle=hi;ctx.beginPath();ctx.ellipse(cx+1,ty+4.5,4,1.6,0,0,7);ctx.fill();
    ctx.fillStyle=tint(col,-20);ctx.beginPath();ctx.arc(cx+1,ty+4,1.6,0,7);ctx.fill();}
}
function drawAcc(id,x,hy,y,bob,face){ const A=ACCESSORIES.find(a=>a.id===id); if(!A)return;
  if(face===3&&['glasses','sunglasses','necklace','bowtie','medal','lei'].includes(id))return; // 正面才顯示的飾品
  const ex=face===1?-4:face===2?4:0;
  switch(id){
   case 'cap': ctx.fillStyle='#3f6fd6';ctx.beginPath();ctx.arc(x,hy-6,15,Math.PI,0);ctx.fill();
     ctx.fillStyle='#356bd0';ctx.fillRect(x+ex,hy-7,17,4); // 帽簷
     ctx.fillStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.arc(x-4,hy-9,9,Math.PI*1.1,Math.PI*1.55);ctx.fill(); // 高光
     ctx.fillStyle='#e8ecf2';ctx.beginPath();ctx.arc(x,hy-16,1.8,0,7);ctx.fill();break; // 頂鈕
   case 'strawhat': ctx.fillStyle='#e0c070';ctx.beginPath();ctx.ellipse(x,hy-6,22,7,0,0,7);ctx.fill();
     ctx.fillStyle='#d4b25a';ctx.beginPath();ctx.ellipse(x,hy-5,22,4,0,0,Math.PI);ctx.fill(); // 帽緣陰影
     ctx.fillStyle='#e6ca82';ctx.beginPath();ctx.arc(x,hy-9,11,Math.PI,0);ctx.fill();
     ctx.strokeStyle='#c9a84a';ctx.lineWidth=0.8;for(let k=-2;k<=2;k++){ctx.beginPath();ctx.ellipse(x,hy-6,8+k*3,3+k,0,Math.PI,0);ctx.stroke();} // 編織紋
     ctx.fillStyle='#c94f43';ctx.fillRect(x-11,hy-9,22,3);break;
   case 'tophat': ctx.fillStyle='#2a2a2a';ctx.fillRect(x-13,hy-8,26,4);
     const th=ctx.createLinearGradient(x-9,0,x+9,0);th.addColorStop(0,'#1a1a1a');th.addColorStop(.5,'#3a3a3a');th.addColorStop(1,'#1a1a1a');
     ctx.fillStyle=th;ctx.fillRect(x-9,hy-24,18,17);
     ctx.fillStyle='#c94f43';ctx.fillRect(x-9,hy-11,18,3);
     ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(x-6,hy-23,2,15);break;
   case 'party': ctx.fillStyle='#f2c94c';ctx.beginPath();ctx.moveTo(x-9,hy-8);ctx.lineTo(x,hy-26);ctx.lineTo(x+9,hy-8);ctx.closePath();ctx.fill();
     ctx.fillStyle='#e2574c';ctx.beginPath();ctx.arc(x,hy-26,3,0,7);ctx.fill();break;
   case 'crown': { const cg=ctx.createLinearGradient(x,hy-20,x,hy-8);cg.addColorStop(0,'#ffe89a');cg.addColorStop(1,'#e0a824');
     ctx.fillStyle=cg;ctx.beginPath();ctx.moveTo(x-12,hy-8);ctx.lineTo(x-12,hy-18);
     ctx.lineTo(x-6,hy-13);ctx.lineTo(x,hy-20);ctx.lineTo(x+6,hy-13);ctx.lineTo(x+12,hy-18);ctx.lineTo(x+12,hy-8);ctx.closePath();ctx.fill();
     ctx.fillStyle='#c98a1a';ctx.fillRect(x-12,hy-9,24,2); // 底環
     const jw=['#e2574c','#3f8fd6','#3f8f5a'];[[-8,-13],[0,-15],[8,-13]].forEach((p,i)=>{ // 三顆寶石
       ctx.fillStyle=jw[i];ctx.beginPath();ctx.arc(x+p[0],hy+p[1],1.8,0,7);ctx.fill();
       ctx.fillStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.arc(x+p[0]-0.6,hy+p[1]-0.6,0.7,0,7);ctx.fill();});
     ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-2,hy-19,0.9,0,7);ctx.fill();break; }
   case 'glasses': ctx.strokeStyle='#2a2a2a';ctx.lineWidth=1.8;
     ctx.strokeRect(x-11+ex,hy-1,8,7);ctx.strokeRect(x+3+ex,hy-1,8,7);
     ctx.beginPath();ctx.moveTo(x-3+ex,hy+2);ctx.lineTo(x+3+ex,hy+2);ctx.stroke();break;
   case 'sunglasses': ctx.fillStyle='#1a1a1a';
     rr(x-11+ex,hy-1,8,7,2);ctx.fill();rr(x+3+ex,hy-1,8,7,2);ctx.fill();
     ctx.fillRect(x-3+ex,hy,6,2);
     ctx.fillStyle='rgba(150,200,255,.6)';ctx.beginPath(); // 鏡面反光
     ctx.moveTo(x-10+ex,hy);ctx.lineTo(x-6+ex,hy);ctx.lineTo(x-9+ex,hy+4);ctx.closePath();
     ctx.moveTo(x+4+ex,hy);ctx.lineTo(x+8+ex,hy);ctx.lineTo(x+5+ex,hy+4);ctx.closePath();ctx.fill();break;
   case 'flower': ctx.fillStyle='#f27ba0';for(let i=0;i<5;i++){const a=i/5*6.28;
     ctx.beginPath();ctx.arc(x+13+Math.cos(a)*3,hy-11+Math.sin(a)*3,2.4,0,7);ctx.fill();}
     ctx.fillStyle='#f2c94c';ctx.beginPath();ctx.arc(x+13,hy-11,1.8,0,7);ctx.fill();break;
   case 'bow': ctx.fillStyle='#e0559b';ctx.beginPath();
     ctx.moveTo(x,hy-12);ctx.lineTo(x-8,hy-16);ctx.lineTo(x-8,hy-8);ctx.closePath();
     ctx.moveTo(x,hy-12);ctx.lineTo(x+8,hy-16);ctx.lineTo(x+8,hy-8);ctx.closePath();ctx.fill();
     ctx.fillStyle='#c94f43';ctx.beginPath();ctx.arc(x,hy-12,2,0,7);ctx.fill();break;
   case 'catears': ctx.fillStyle='#3a3a3a';
     ctx.beginPath();ctx.moveTo(x-13,hy-8);ctx.lineTo(x-9,hy-20);ctx.lineTo(x-3,hy-11);ctx.closePath();
     ctx.moveTo(x+13,hy-8);ctx.lineTo(x+9,hy-20);ctx.lineTo(x+3,hy-11);ctx.closePath();ctx.fill();
     ctx.fillStyle='#f2a0a0';ctx.beginPath();ctx.moveTo(x-10,hy-11);ctx.lineTo(x-8,hy-17);ctx.lineTo(x-5,hy-12);ctx.fill();
     ctx.moveTo(x+10,hy-11);ctx.lineTo(x+8,hy-17);ctx.lineTo(x+5,hy-12);ctx.fill();break;
   case 'halo': ctx.strokeStyle='#ffe066';ctx.lineWidth=2.5;
     ctx.beginPath();ctx.ellipse(x,hy-22,9,3,0,0,7);ctx.stroke();break;
   case 'headphone': ctx.strokeStyle='#2a2a2a';ctx.lineWidth=3;
     ctx.beginPath();ctx.arc(x,hy-4,15,Math.PI*1.15,Math.PI*1.85);ctx.stroke();
     ctx.fillStyle='#e2574c';ctx.fillRect(x-17,hy-5,5,8);ctx.fillRect(x+12,hy-5,5,8);break;
   // 身上飾品
   case 'necklace': ctx.strokeStyle='#e0b840';ctx.lineWidth=1.5;
     ctx.beginPath();ctx.arc(x,y-24+bob,8,0.2,Math.PI-0.2);ctx.stroke();
     ctx.fillStyle='#f2c94c';for(let k=-2;k<=2;k++){const ang=Math.PI/2+k*0.42; // 金珠鍊
       ctx.beginPath();ctx.arc(x+Math.cos(ang)*8,y-24+bob+Math.sin(ang)*8,1.3,0,7);ctx.fill();}
     const gm=ctx.createRadialGradient(x-1,y-19+bob,0.5,x,y-18+bob,3.2); // 墜飾寶石
     gm.addColorStop(0,'#bfeaff');gm.addColorStop(1,'#3f9fd6');
     ctx.fillStyle=gm;ctx.beginPath();ctx.arc(x,y-18+bob,3,0,7);ctx.fill();
     ctx.fillStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.arc(x-1,y-19+bob,0.9,0,7);ctx.fill();break;
   case 'scarf': ctx.fillStyle='#c94f43';ctx.fillRect(x-12,y-22+bob,24,5);
     ctx.fillRect(x+4,y-22+bob,5,12);break;
   case 'bowtie': ctx.fillStyle='#c94f43';ctx.beginPath();
     ctx.moveTo(x,y-22+bob);ctx.lineTo(x-6,y-25+bob);ctx.lineTo(x-6,y-19+bob);ctx.closePath();
     ctx.moveTo(x,y-22+bob);ctx.lineTo(x+6,y-25+bob);ctx.lineTo(x+6,y-19+bob);ctx.closePath();ctx.fill();break;
   case 'backpack': ctx.fillStyle='#3f8f5a';rr(x-14,y-24+bob,6,16,3);ctx.fill();
     ctx.strokeStyle='#2a6a3a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-9,y-22+bob);ctx.lineTo(x-4,y-20+bob);ctx.stroke();break;
   case 'cape': { const cp=ctx.createLinearGradient(x-16,0,x+16,0);
     cp.addColorStop(0,'#6a2038');cp.addColorStop(.5,'#a03a58');cp.addColorStop(1,'#6a2038');
     ctx.fillStyle=cp;ctx.beginPath();
     ctx.moveTo(x-13,y-25+bob);ctx.lineTo(x+13,y-25+bob);ctx.lineTo(x+16,y-4+bob);
     ctx.lineTo(x-16,y-4+bob);ctx.closePath();ctx.fill();
     ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=1; // 摺皺
     for(let k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(x+k*8,y-24+bob);ctx.lineTo(x+k*10,y-4+bob);ctx.stroke();}
     ctx.fillStyle='#e0c060';ctx.fillRect(x-13,y-26+bob,26,2);break; } // 金領邊
   case 'wings': for(const side of [-1,1]){
     const wg=ctx.createLinearGradient(x+side*10,y-26+bob,x+side*20,y-6+bob);
     wg.addColorStop(0,'rgba(255,255,255,.9)');wg.addColorStop(1,'rgba(150,200,255,.55)');
     ctx.fillStyle=wg;ctx.beginPath();ctx.ellipse(x+side*15,y-16+bob,7,12,side*0.5,0,7);ctx.fill();
     ctx.strokeStyle='rgba(120,170,220,.7)';ctx.lineWidth=1; // 羽紋
     for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo(x+side*12,y-22+bob+k*6);
       ctx.lineTo(x+side*20,y-18+bob+k*6);ctx.stroke();}}break;
   case 'medal': ctx.strokeStyle='#c94f43';ctx.lineWidth=2;
     ctx.beginPath();ctx.moveTo(x-4,y-25+bob);ctx.lineTo(x,y-18+bob);ctx.moveTo(x+4,y-25+bob);ctx.lineTo(x,y-18+bob);ctx.stroke();
     ctx.fillStyle='#f2c94c';ctx.beginPath();ctx.arc(x,y-15+bob,4,0,7);ctx.fill();break;
   case 'lei': ctx.fillStyle='#f27ba0';for(let i=0;i<7;i++){const a=0.2+i*0.4;
     ctx.beginPath();ctx.arc(x-9+Math.cos(a)*9,y-19+bob+Math.sin(a)*4,2,0,7);ctx.fill();}break;
  }
}
function drawActor(x,y,face,walk,o){
  const sp=o.species, pal=o.pal||{fur:o.skin||'#f5c99b'};
  const fur=pal.fur, bob=Math.sin(walk)*1.8, step=Math.sin(walk);
  const back=(face===3); // 面向後方（往上走）：顯示背面
  // 柔和陰影
  let g=ctx.createRadialGradient(x,y+2,2,x,y+2,18);
  g.addColorStop(0,'rgba(0,0,0,.26)');g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y+2,18,8,0,0,7);ctx.fill();
  if(!o.sailing){ // 腳＋鞋子（牛仔褲可換色；有買鞋子則套用鞋款）
    const ly1=y-9+Math.max(0,step*3.2), ly2=y-9+Math.max(0,-step*3.2);
    if(o.shoes){ drawShoe(x-6,ly1,o.shoes); drawShoe(x+5,ly2,o.shoes); }
    else{ ctx.fillStyle=sp==='human'?(o.pants||'#4a3428'):tint(fur,-40);
      rr(x-9,ly1,7,10,3);ctx.fill(); rr(x+2,ly2,7,10,3);ctx.fill(); }
  }
  // 身體（上亮下暗漸層；洋裝為裙襬造型）
  const bodyC=o.shirt||fur;
  g=ctx.createLinearGradient(x,y-28+bob,x,y-5+bob);
  g.addColorStop(0,tint(bodyC,28));g.addColorStop(1,tint(bodyC,-16));
  ctx.fillStyle=g;
  const isDress=(o.outfit==='dress'||o.outfit==='trad');
  if(o.outfit==='robe'){ // 古裝長袍：寬袖＋垂地曳裾
    ctx.beginPath(); // 主袍身（比洋裝更寬、更長）
    ctx.moveTo(x-10,y-27+bob);ctx.lineTo(x+10,y-27+bob);
    ctx.lineTo(x+18,y-2+bob);ctx.lineTo(x-18,y-2+bob);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=1.5;ctx.stroke();
    // 寬大廣袖（垂袖）
    ctx.fillStyle=tint(bodyC,-8);
    ctx.beginPath();ctx.moveTo(x-11,y-25+bob);ctx.quadraticCurveTo(x-24,y-20+bob,x-22,y-8+bob);
    ctx.lineTo(x-13,y-9+bob);ctx.quadraticCurveTo(x-13,y-18+bob,x-11,y-25+bob);ctx.fill();
    ctx.beginPath();ctx.moveTo(x+11,y-25+bob);ctx.quadraticCurveTo(x+24,y-20+bob,x+22,y-8+bob);
    ctx.lineTo(x+13,y-9+bob);ctx.quadraticCurveTo(x+13,y-18+bob,x+11,y-25+bob);ctx.fill();
    // 交領斜襟
    ctx.fillStyle=tint(bodyC,24);
    ctx.beginPath();ctx.moveTo(x-9,y-27+bob);ctx.lineTo(x+3,y-24+bob);ctx.lineTo(x-1,y-8+bob);
    ctx.lineTo(x-11,y-10+bob);ctx.closePath();ctx.fill();
  }else if(o.outfit==='gown'){ // v46 婚紗禮服：合身馬甲＋拖地澎裙（劉思思婚後）
    ctx.beginPath();ctx.moveTo(x-8,y-16+bob); // 澎裙（蓋過腿、微拖地）
    ctx.quadraticCurveTo(x-21,y-6+bob,x-19,y+4+bob);
    ctx.quadraticCurveTo(x,y+9+bob,x+19,y+4+bob);
    ctx.quadraticCurveTo(x+21,y-6+bob,x+8,y-16+bob);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.1)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.strokeStyle='rgba(190,190,210,.75)';ctx.lineWidth=1.2; // 裙襬層次紗
    ctx.beginPath();ctx.moveTo(x-15,y-2+bob);ctx.quadraticCurveTo(x,y+4+bob,x+15,y-2+bob);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-11,y-9+bob);ctx.quadraticCurveTo(x,y-4+bob,x+11,y-9+bob);ctx.stroke();
    ctx.fillStyle=g;ctx.beginPath(); // 上身合身馬甲
    ctx.moveTo(x-9,y-27+bob);ctx.lineTo(x+9,y-27+bob);
    ctx.lineTo(x+8,y-14+bob);ctx.lineTo(x-8,y-14+bob);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.1)';ctx.stroke();
    ctx.fillStyle='#e9e2f2';ctx.fillRect(x-8,y-16+bob,16,2.5); // 腰際緞帶
  }else if(isDress){
    ctx.beginPath();ctx.moveTo(x-9,y-27+bob);ctx.lineTo(x+9,y-27+bob);
    ctx.lineTo(x+15,y-5+bob);ctx.lineTo(x-15,y-5+bob);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=1.5;ctx.stroke();
  }else if(o.outfit==='tank'){ // 背心：窄肩帶
    rr(x-11,y-24+bob,22,18,7);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=1.5;rr(x-11,y-24+bob,22,18,7);ctx.stroke();
    ctx.fillStyle=tint(bodyC,-14);ctx.fillRect(x-9,y-27+bob,3,4);ctx.fillRect(x+6,y-27+bob,3,4);
  }else{
    rr(x-13,y-27+bob,26,21,9);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=1.5;rr(x-13,y-27+bob,26,21,9);ctx.stroke();}
  if(sp==='human'&&o.outfit&&!back){ // 一般服裝配件（正面才有領口/領帶）
    if(o.outfit==='suit'||o.outfit==='office'||o.outfit==='shirt'){ // 白領
      ctx.fillStyle='#fff';
      ctx.beginPath();ctx.moveTo(x-6,y-27+bob);ctx.lineTo(x,y-20+bob);ctx.lineTo(x+6,y-27+bob);ctx.closePath();ctx.fill();}
    if(o.outfit==='suit'||o.outfit==='office'){ // 領帶
      ctx.fillStyle=o.tie||'#c94f43';
      ctx.beginPath();ctx.moveTo(x-2,y-21+bob);ctx.lineTo(x+2,y-21+bob);
      ctx.lineTo(x+1,y-11+bob);ctx.lineTo(x-1,y-11+bob);ctx.closePath();ctx.fill();}
    if(o.outfit==='tee'){ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x-11,y-10+bob);ctx.lineTo(x+11,y-10+bob);ctx.stroke();}
  }
  // 衣料光澤（軀幹左上柔和高光，提升細膩度）
  if(sp==='human'){ ctx.save();
    ctx.fillStyle='rgba(255,255,255,.14)';
    ctx.beginPath();ctx.ellipse(x-6,y-22+bob,4,7,-0.3,0,7);ctx.fill();
    ctx.restore();}
  // 服裝花紋／配件（deco）
  if(sp==='human'&&o.deco){ const d=o.deco, top=y-27+bob;
    ctx.save();
    if(d==='stripe'){ctx.fillStyle=tint(bodyC,-34);
      for(let k=0;k<4;k++)ctx.fillRect(x-13,top+3+k*5,26,2);}
    else if(d==='dots'){ctx.fillStyle='rgba(255,255,255,.7)';
      for(let k=0;k<6;k++)ctx.beginPath(),ctx.arc(x-9+(k%3)*9,top+5+Math.floor(k/3)*8,1.8,0,7),ctx.fill();}
    else if(d==='check'){ctx.strokeStyle=tint(bodyC,-34);ctx.lineWidth=1.2;
      for(let k=-1;k<=2;k++){ctx.beginPath();ctx.moveTo(x-13,top+4+k*5);ctx.lineTo(x+13,top+4+k*5);ctx.stroke();}
      for(let k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(x+k*8,top);ctx.lineTo(x+k*8,top+21);ctx.stroke();}}
    else if(d==='zip'){ctx.strokeStyle=tint(bodyC,-40);ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x,top+1);ctx.lineTo(x,top+20);ctx.stroke();
      ctx.fillStyle='#d8d8d8';ctx.fillRect(x-1,top+3,2,3);}
    else if(d==='hood'){ctx.fillStyle=tint(bodyC,-18); // 帽子在後頸
      ctx.beginPath();ctx.arc(x,top-1,9,Math.PI*0.15,Math.PI*0.85);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-3,top+6);ctx.lineTo(x-3,top+13);
      ctx.moveTo(x+3,top+6);ctx.lineTo(x+3,top+13);ctx.stroke();}
    else if(d==='knit'){ctx.strokeStyle=tint(bodyC,-22);ctx.lineWidth=1;
      for(let k=0;k<5;k++){ctx.beginPath();
        for(let xx=-12;xx<=12;xx+=4)ctx.lineTo(x+xx,top+4+k*4+((xx/4)%2?1.5:-1.5));ctx.stroke();}}
    else if(d==='apron'){ctx.fillStyle='rgba(255,255,255,.85)';
      rr(x-8,top+3,16,18,3);ctx.fill();ctx.strokeStyle='#d8d8d8';ctx.lineWidth=1;ctx.strokeRect(x-8,top+3,16,18);}
    else if(d==='belt'){ctx.fillStyle=tint(bodyC,-45);ctx.fillRect(x-14,y-13+bob,28,4);
      ctx.fillStyle='#e0c060';ctx.fillRect(x-2,y-13+bob,4,4);}
    else if(d==='overall'){ctx.fillStyle=tint(bodyC,-30); // 吊帶
      ctx.fillRect(x-8,top,3,21);ctx.fillRect(x+5,top,3,21);ctx.fillStyle='#e0c060';
      ctx.fillRect(x-8,top+7,3,2);ctx.fillRect(x+5,top+7,3,2);}
    else if(d==='trad'){ctx.fillStyle=tint(bodyC,26); // 交領斜襟
      ctx.beginPath();ctx.moveTo(x-9,top);ctx.lineTo(x+2,top+3);ctx.lineTo(x-2,y-6+bob);ctx.lineTo(x-13,y-8+bob);ctx.closePath();ctx.fill();
      ctx.fillStyle='#e0554a';ctx.fillRect(x-2,top+2,4,y-6+bob-(top+2));}
    else if(d==='collar'){ctx.fillStyle='#fff';
      ctx.beginPath();ctx.moveTo(x-7,top);ctx.lineTo(x-2,top+6);ctx.lineTo(x-2,top);ctx.closePath();
      ctx.moveTo(x+7,top);ctx.lineTo(x+2,top+6);ctx.lineTo(x+2,top);ctx.closePath();ctx.fill();}
    else if(d==='sparkle'){ctx.fillStyle='rgba(255,255,255,.85)';
      for(let k=0;k<5;k++){const sx=x-10+((k*97)%20),sy=top+3+((k*53)%16);
        ctx.fillRect(sx,sy,1.5,1.5);ctx.fillRect(sx-1,sy+0.5,3.5,0.6);ctx.fillRect(sx+0.5,sy-1,0.6,3.5);}}
    else if(d==='wuxia'){ // 武俠戲服：斜襟＋腰帶＋垂綬
      ctx.fillStyle=tint(bodyC,30);ctx.beginPath(); // 斜襟
      ctx.moveTo(x-9,top);ctx.lineTo(x+3,top+2);ctx.lineTo(x-1,y-6+bob);ctx.lineTo(x-12,y-8+bob);ctx.closePath();ctx.fill();
      ctx.fillStyle='#3a2a20';ctx.fillRect(x-13,y-14+bob,26,4); // 腰帶
      ctx.fillStyle='#e0c060';ctx.fillRect(x-3,y-14+bob,6,4); // 帶扣
      ctx.fillStyle=tint(bodyC,-20);ctx.fillRect(x-2,y-10+bob,4,9); // 垂綬
      ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-8,top+2);ctx.lineTo(x-12,y-8+bob);ctx.stroke();}
    else if(d==='goldtrim'){ // 錦繡金邊
      ctx.strokeStyle='#f0d060';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(x-9,top);ctx.lineTo(x-1,y-4+bob);ctx.stroke(); // 前襟金線
      ctx.fillStyle='#f0d060';ctx.fillRect(x-18,y-4+bob,36,2); // 下擺金邊
      for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(x-6+k*6,top+6,1.2,0,7);ctx.fill();} // 金釦/紋飾
      ctx.fillStyle='#c0142a';ctx.fillRect(x-13,y-14+bob,26,3);} // 織帶腰
    else if(d==='armor'){ // 戰甲：胸甲＋肩吞＋鱗片
      ctx.fillStyle=tint(bodyC,-14);rr(x-11,top+2,22,15,3);ctx.fill();
      ctx.strokeStyle=tint(bodyC,-40);ctx.lineWidth=0.8;
      for(let r2=0;r2<3;r2++)for(let c2=0;c2<4;c2++)ctx.strokeRect(x-10+c2*5,top+4+r2*4,5,4); // 鱗甲
      ctx.fillStyle=tint(bodyC,34);ctx.beginPath();ctx.arc(x-11,top+3,4,0,7);ctx.arc(x+11,top+3,4,0,7);ctx.fill(); // 肩吞
      ctx.fillStyle='#c0142a';ctx.fillRect(x-13,y-13+bob,26,3);
      ctx.fillStyle='#e0c060';ctx.beginPath();ctx.arc(x,top+9,2,0,7);ctx.fill();} // 護心鏡
    else if(d==='shawl'){ // 披帛：肩上飄帶＋高腰裙線
      ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=3;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(x-14,y-18+bob);ctx.quadraticCurveTo(x,y-28+bob,x+14,y-18+bob);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+13,y-19+bob);ctx.quadraticCurveTo(x+18,y-6+bob,x+13,y+2+bob);ctx.stroke();ctx.lineCap='butt';
      ctx.fillStyle=tint(bodyC,-24);ctx.fillRect(x-15,y-16+bob,30,2);} // 高腰裙帶
    ctx.restore();
  }
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
    ctx.fillStyle=g; ctx.strokeStyle=o.hair;
    const long=o.gender==='f', hs=o.hairStyle||0;
    if(back){ // 背面：整顆頭覆蓋髮色（看不到臉）
      ctx.fillStyle=o.hair;ctx.beginPath();ctx.arc(x,hy,17,0,7);ctx.fill();
      if(long){ ctx.fillStyle=tint(o.hair,-8); // 長髮垂到上背
        ctx.beginPath();ctx.moveTo(x-16,hy-1);ctx.quadraticCurveTo(x-19,hy+18,x-13,y-2+bob);
        ctx.lineTo(x+13,y-2+bob);ctx.quadraticCurveTo(x+19,hy+18,x+16,hy-1);
        ctx.quadraticCurveTo(x,hy+9,x-16,hy-1);ctx.closePath();ctx.fill();
        if(hs===3){ctx.beginPath();ctx.ellipse(x-16,hy+9,5,15,0.2,0,7);ctx.ellipse(x+16,hy+9,5,15,-0.2,0,7);ctx.fill();} // 雙馬尾
        if(hs===9){ctx.beginPath();ctx.ellipse(x+2,hy+12,6,16,0,0,7);ctx.fill();} // 高馬尾
        if(hs===5){ctx.beginPath();ctx.arc(x,hy-15,6,0,7);ctx.fill();} // 丸子
      } else { ctx.fillStyle=tint(o.hair,-14); // 男生後腦髮際線
        ctx.beginPath();ctx.arc(x,hy+3,16,0.2,Math.PI-0.2);ctx.fill(); }
      ctx.strokeStyle=tint(o.hair,28);ctx.lineWidth=1.3; // 髮旋
      ctx.beginPath();ctx.arc(x-1,hy-2,4,0.4,4.6);ctx.stroke();
    } else if(long){ // 女生：長髮（垂到肩下），5種變化
      // 後方長髮（先畫，在頭後）
      ctx.fillStyle=tint(o.hair,-10);
      if(hs===0){ // 直長髮：兩側順直垂下、臉部保留
        ctx.beginPath();ctx.moveTo(x-15,hy-5);ctx.quadraticCurveTo(x-19,hy+8,x-16,y-2+bob);
        ctx.lineTo(x-9,y-2+bob);ctx.quadraticCurveTo(x-10,hy+4,x-9,hy+1);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(x+15,hy-5);ctx.quadraticCurveTo(x+19,hy+8,x+16,y-2+bob);
        ctx.lineTo(x+9,y-2+bob);ctx.quadraticCurveTo(x+10,hy+4,x+9,hy+1);ctx.closePath();ctx.fill();}
      else if(hs===1){ // 大波浪：兩側波浪垂下、臉部保留
        ctx.beginPath();ctx.moveTo(x-15,hy-3);ctx.quadraticCurveTo(x-23,hy+7,x-15,hy+14);
        ctx.quadraticCurveTo(x-22,hy+21,x-13,y+bob);ctx.lineTo(x-8,y-1+bob);
        ctx.quadraticCurveTo(x-12,hy+8,x-9,hy+1);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(x+15,hy-3);ctx.quadraticCurveTo(x+23,hy+7,x+15,hy+14);
        ctx.quadraticCurveTo(x+22,hy+21,x+13,y+bob);ctx.lineTo(x+8,y-1+bob);
        ctx.quadraticCurveTo(x+12,hy+8,x+9,hy+1);ctx.closePath();ctx.fill();}
      else if(hs===2){ctx.beginPath();ctx.ellipse(x,hy+6,18,15,0,0,Math.PI);ctx.fill(); // 妹妹頭/中長
        ctx.fillRect(x-17,hy-2,34,12);}
      else if(hs===3){ // 雙馬尾
        ctx.beginPath();ctx.ellipse(x-17,hy+8,5,14,0.2,0,7);ctx.ellipse(x+17,hy+8,5,14,-0.2,0,7);ctx.fill();}
      else if(hs===4){ // 側撥長髮：兩側垂簾，其一撥到肩前（臉部保留）
        ctx.beginPath();ctx.moveTo(x-15,hy-3);ctx.quadraticCurveTo(x-20,hy+16,x-16,y-3+bob);
        ctx.quadraticCurveTo(x-10,y+1+bob,x-8,hy+4);ctx.lineTo(x-8,hy-2);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(x+15,hy-3);ctx.quadraticCurveTo(x+21,hy+14,x+13,y+2+bob);
        ctx.quadraticCurveTo(x+7,y-2+bob,x+8,hy+2);ctx.lineTo(x+8,hy-2);ctx.closePath();ctx.fill();}
      else if(hs===5){ctx.beginPath();ctx.ellipse(x,hy+2,15,12,0,0,Math.PI);ctx.fill();} // 丸子頭(短後髮)
      else if(hs===6){ctx.beginPath();ctx.moveTo(x-16,hy-2);ctx.lineTo(x-15,y-6+bob); // 公主切
        ctx.lineTo(x-8,y-6+bob);ctx.lineTo(x-9,hy+4);ctx.lineTo(x+9,hy+4);ctx.lineTo(x+8,y-6+bob);
        ctx.lineTo(x+15,y-6+bob);ctx.lineTo(x+16,hy-2);ctx.closePath();ctx.fill();}
      else if(hs===7){ctx.beginPath();ctx.ellipse(x,hy+4,17,14,0,0,Math.PI);ctx.fill();ctx.fillRect(x-17,hy-4,34,10);} // 鮑伯頭
      else if(hs===8){ctx.beginPath();ctx.moveTo(x-15,hy);ctx.quadraticCurveTo(x-16,y+4+bob,x-9,y+4+bob); // 編髮(單側粗辮)
        ctx.lineTo(x-4,y+4+bob);ctx.quadraticCurveTo(x-10,hy+4,x-15,hy);ctx.closePath();ctx.fill();
        ctx.fillStyle=tint(o.hair,20);for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(x-9,hy+6+k*7,4,3,0,0,7);ctx.fill();}}
      else {ctx.beginPath();ctx.moveTo(x-6,hy-8);ctx.quadraticCurveTo(x+2,y+6+bob,x+10,y+8+bob); // 高馬尾
        ctx.quadraticCurveTo(x+14,y+2+bob,x+6,hy-6);ctx.closePath();ctx.fill();}
      if(hs===2||hs===5||hs===6||hs===7){ // v45 這幾款後髮原本整片蓋在臉上：重繪臉部，把頭髮墊回臉後面
        const gf=ctx.createRadialGradient(x-5,hy-7,3,x,hy,17);
        gf.addColorStop(0,tint(fur,36));gf.addColorStop(0.65,fur);gf.addColorStop(1,tint(fur,-24));
        ctx.fillStyle=gf;ctx.beginPath();ctx.arc(x,hy+0.5,13.5,0,7);ctx.fill();}
      // 頭頂瀏海
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,hy-3,17,Math.PI*0.98,Math.PI*2.02);ctx.fill();
      ctx.fillStyle=o.hair; // 瀏海分線
      if(hs===2||hs===7)ctx.fillRect(x-15,hy-8,30,5); // 平瀏海
      else{ctx.beginPath();ctx.moveTo(x-15,hy-6);ctx.quadraticCurveTo(x,hy-2,x-2,hy+2);
        ctx.quadraticCurveTo(x+2,hy-2,x+15,hy-6);ctx.lineTo(x+15,hy-12);ctx.lineTo(x-15,hy-12);ctx.closePath();ctx.fill();}
      if(hs===5){ctx.beginPath();ctx.arc(x,hy-16,6,0,7);ctx.fill();} // 丸子
      if(hs===9){ctx.fillStyle='#f27ba0';ctx.beginPath();ctx.arc(x+5,hy-9,2.5,0,7);ctx.fill();} // 高馬尾髮圈
      if(hs===3){ctx.fillStyle='#f27ba0'; // 雙馬尾髮圈
        ctx.beginPath();ctx.arc(x-15,hy-2,2.5,0,7);ctx.arc(x+15,hy-2,2.5,0,7);ctx.fill();}
    } else { // 男生：短髮，5種變化
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,hy-3,17,Math.PI*1.03,Math.PI*1.97);ctx.fill();
      ctx.fillStyle=o.hair;
      if(hs===0){ctx.beginPath();ctx.moveTo(x-15,hy-7);ctx.quadraticCurveTo(x,hy-18,x+15,hy-7); // 短瀏海
        ctx.lineTo(x+15,hy-13);ctx.lineTo(x-15,hy-13);ctx.closePath();ctx.fill();}
      else if(hs===1){for(let i=-2;i<=2;i++){ctx.beginPath(); // 刺蝟頭
        ctx.moveTo(x+i*7-3,hy-13);ctx.lineTo(x+i*7,hy-22);ctx.lineTo(x+i*7+3,hy-13);ctx.closePath();ctx.fill();}
        ctx.fillRect(x-16,hy-13,32,6);}
      else if(hs===2){ctx.fillRect(x-16,hy-14,32,8);ctx.fillStyle=g; // 平頭/西裝頭
        ctx.fillRect(x-3,hy-13,3,6);}
      else if(hs===3){ctx.beginPath();ctx.moveTo(x-16,hy-6);ctx.quadraticCurveTo(x-8,hy-20,x+4,hy-14); // 旁分
        ctx.quadraticCurveTo(x+14,hy-10,x+16,hy-4);ctx.lineTo(x+16,hy-14);ctx.lineTo(x-16,hy-14);ctx.closePath();ctx.fill();}
      else if(hs===4){ctx.beginPath();ctx.arc(x,hy-6,15,Math.PI,0);ctx.fill(); // 圓短髮
        ctx.fillRect(x-15,hy-6,30,4);}
      else if(hs===5){ctx.fillRect(x-15,hy-13,30,6); // 中分
        ctx.beginPath();ctx.moveTo(x-15,hy-7);ctx.lineTo(x-2,hy-4);ctx.lineTo(x-2,hy-13);ctx.closePath();
        ctx.moveTo(x+15,hy-7);ctx.lineTo(x+2,hy-4);ctx.lineTo(x+2,hy-13);ctx.closePath();ctx.fill();}
      else if(hs===6){ctx.beginPath();ctx.moveTo(x-15,hy-6);ctx.quadraticCurveTo(x,hy-20,x+15,hy-8); // 油頭後梳
        ctx.quadraticCurveTo(x+8,hy-15,x-15,hy-12);ctx.closePath();ctx.fill();
        ctx.strokeStyle=tint(o.hair,25);ctx.lineWidth=1;
        for(let k=-2;k<=2;k++){ctx.beginPath();ctx.moveTo(x+k*5,hy-14);ctx.lineTo(x+k*5+3,hy-7);ctx.stroke();}}
      else if(hs===7){ctx.fillRect(x-4,hy-22,8,12); // 莫西干
        ctx.beginPath();ctx.moveTo(x-4,hy-18);ctx.lineTo(x-2,hy-24);ctx.lineTo(x,hy-18);
        ctx.lineTo(x+2,hy-24);ctx.lineTo(x+4,hy-18);ctx.fill();ctx.fillRect(x-16,hy-9,32,4);}
      else if(hs===8){for(let k=0;k<7;k++){ctx.beginPath(); // 捲短髮
        ctx.arc(x-13+k*4.3,hy-11+(k%2?1:-1)*1.5,3.6,0,7);ctx.fill();}ctx.fillRect(x-15,hy-10,30,4);}
      else {ctx.fillRect(x-15,hy-12,30,5);} // 超短平頭
    }
    // 髮絲光澤（讓頭髮有亮面、不會糊成一坨）
    ctx.save();ctx.globalAlpha=.55;ctx.fillStyle=tint(o.hair,60);
    ctx.beginPath();ctx.ellipse(x-6,hy-9,4.6,2.3,-0.6,0,7);ctx.fill();
    ctx.globalAlpha=.3;
    ctx.beginPath();ctx.ellipse(x+4,hy-7,2.8,1.5,-0.5,0,7);ctx.fill();ctx.restore();
    if(o.veil){ // v46 白色頭紗（婚後劉思思）：珍珠冠＋垂肩薄紗
      ctx.save();
      ctx.fillStyle='rgba(255,255,255,.4)'; // 垂到肩後的薄紗
      ctx.beginPath();ctx.moveTo(x-15,hy-8);ctx.quadraticCurveTo(x-23,hy+12,x-14,y-10+bob);
      ctx.quadraticCurveTo(x,y-4+bob,x+14,y-10+bob);ctx.quadraticCurveTo(x+23,hy+12,x+15,hy-8);
      ctx.quadraticCurveTo(x,hy-3,x-15,hy-8);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.2;ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.9)'; // 頭頂紗帽
      ctx.beginPath();ctx.arc(x,hy-12,8,Math.PI*1.05,Math.PI*1.95);ctx.fill();
      ctx.fillStyle='#fff'; // 珍珠冠冕
      ctx.beginPath();ctx.arc(x-6,hy-15,1.7,0,7);ctx.arc(x,hy-17.5,2,0,7);ctx.arc(x+6,hy-15,1.7,0,7);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(x,hy-6,15.5,Math.PI*1.15,Math.PI*1.85);ctx.stroke(); // 髮箍線
      ctx.restore();
    }
    // 族群服飾（衣飾帶＋頭帶/花環）
    if(o.race!=null&&RACES[o.race]){ const R=RACES[o.race];
      ctx.fillStyle=R.acc;ctx.fillRect(x-13,y-19+bob,26,4);
      ctx.fillStyle='rgba(255,255,255,.5)';
      for(let i=0;i<4;i++)ctx.fillRect(x-10+i*7,y-18.5+bob,3,3);
      if(R.head!=='none'){ ctx.strokeStyle=R.acc;ctx.lineWidth=3.5;
        ctx.beginPath();ctx.arc(x,hy,15.5,Math.PI*1.12,Math.PI*1.88);ctx.stroke();
        if(R.head==='wreath'){const fc=['#fff','#f2c94c','#f27ba0'];
          for(let i=0;i<3;i++){ctx.fillStyle=fc[i];
            ctx.beginPath();ctx.arc(x-8+i*8,hy-14,2.8,0,7);ctx.fill();}}}}}
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
  else if(sp==='teacher'){ // 珊珊老師：黑色短髮＋大眼鏡
    ctx.fillStyle='#2a2a2a';
    ctx.beginPath();ctx.arc(x,hy-3,17,Math.PI*0.98,Math.PI*2.02);ctx.fill();
    ctx.fillRect(x-17,hy-4,5,10);ctx.fillRect(x+12,hy-4,5,10);
    ctx.strokeStyle='#4a3a5a';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(x-6,hy+1,6,0,7);ctx.stroke();
    ctx.beginPath();ctx.arc(x+6,hy+1,6,0,7);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-1,hy+1);ctx.lineTo(x+1,hy+1);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.25)';
    ctx.beginPath();ctx.arc(x-6,hy+1,5,0,7);ctx.fill();ctx.beginPath();ctx.arc(x+6,hy+1,5,0,7);ctx.fill();}
  else if(sp==='grandma'){ // 謝麗珠阿嬤：黑色捲髮＋紅潤笑容
    ctx.fillStyle='#2a2a2a';
    for(let i=0;i<7;i++){const a=Math.PI*(1.0+i*0.166);
      ctx.beginPath();ctx.arc(x+Math.cos(a)*13,hy-3+Math.sin(a)*13,6,0,7);ctx.fill();}
    ctx.fillStyle='#e8b8c8';ctx.beginPath();ctx.arc(x+11,hy-12,3,0,7);ctx.fill(); // 小髮飾
    ctx.fillStyle='rgba(255,120,120,.45)'; // 更紅潤的臉頰
    ctx.beginPath();ctx.arc(x-9,hy+6,3.5,0,7);ctx.arc(x+9,hy+6,3.5,0,7);ctx.fill();}
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
  // 穿戴的飾品（身上先畫、頭上後畫，蓋在最上層）
  if(o.bodyAcc)drawAcc(o.bodyAcc,x,hy,y,bob,face);
  if(o.headAcc)drawAcc(o.headAcc,x,hy,y,bob,face);
}
function drawCampfire(cf){
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.beginPath();ctx.ellipse(cf.x,cf.y+4,16,6,0,0,7);ctx.fill();
  ctx.strokeStyle='#8a6b3a';ctx.lineWidth=5;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(cf.x-12,cf.y+2);ctx.lineTo(cf.x+12,cf.y-4);
  ctx.moveTo(cf.x-12,cf.y-4);ctx.lineTo(cf.x+12,cf.y+2);ctx.stroke();ctx.lineCap='butt';
  for(let i=0;i<3;i++){const ph=(tGlobal*2+i*0.37)%1;
    ctx.fillStyle=`rgba(255,${140+i*35},60,${0.8*(1-ph)})`;
    ctx.beginPath();ctx.arc(cf.x-4+i*4+Math.sin(tGlobal*6+i)*3,cf.y-6-ph*22,7*(1-ph*0.5),0,7);ctx.fill();}
}
function drawAnimal(a){ const s=a.spec, step=Math.sin(a.walk);
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.beginPath();ctx.ellipse(a.x,a.y+2,14,5,0,0,7);ctx.fill();
  ctx.fillStyle=tint(s.fur,-20);
  rr(a.x-10,a.y-8+Math.max(0,step*2),4,8,2);ctx.fill();rr(a.x+6,a.y-8+Math.max(0,-step*2),4,8,2);ctx.fill();
  let g=ctx.createLinearGradient(a.x,a.y-22,a.x,a.y-4);
  g.addColorStop(0,tint(s.fur,22));g.addColorStop(1,tint(s.fur,-12));
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(a.x,a.y-13,15,10,0,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(a.x+12,a.y-18,8,0,7);ctx.fill();
  ctx.fillStyle='#2e2620';ctx.beginPath();ctx.arc(a.x+14,a.y-19,1.6,0,7);ctx.fill();
  if(s.n==='山豬'){ctx.fillStyle='#f0f0e8';ctx.beginPath();ctx.arc(a.x+18,a.y-14,2,0,7);ctx.fill();
    ctx.fillStyle=tint(s.fur,40);ctx.fillRect(a.x-8,a.y-23,14,3);}
  if(s.n==='野兔'){ctx.fillStyle=s.fur;
    ctx.beginPath();ctx.ellipse(a.x+8,a.y-29,3,8,0.2,0,7);ctx.ellipse(a.x+14,a.y-28,3,8,-0.1,0,7);ctx.fill();}
  if(s.n==='野雞'){ctx.fillStyle='#e2453c';ctx.beginPath();ctx.arc(a.x+12,a.y-27,3,0,7);ctx.fill();
    ctx.fillStyle='#f2c94c';
    ctx.beginPath();ctx.moveTo(a.x+19,a.y-19);ctx.lineTo(a.x+25,a.y-17);ctx.lineTo(a.x+19,a.y-15);ctx.fill();}
}
function drawSealife(s){
  if(s.kind==='whale'){
    ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(s.x,s.y+4,42,0.15,Math.PI-0.15);ctx.stroke();
    ctx.fillStyle='#4a5a68';
    ctx.beginPath();ctx.ellipse(s.x,s.y,34,13,0,Math.PI,0);ctx.fill();
    ctx.beginPath();ctx.moveTo(s.x-30*s.dir,s.y-2); // 尾巴在移動方向的後方
    ctx.quadraticCurveTo(s.x-46*s.dir,s.y-16,s.x-52*s.dir,s.y-5);
    ctx.quadraticCurveTo(s.x-46*s.dir,s.y-2,s.x-40*s.dir,s.y+1);ctx.fill();
    if((s.t%3)<1.2){const sp=(s.t%3)/1.2; // 噴氣孔在頭側（前方）
      ctx.strokeStyle=`rgba(255,255,255,${0.85*(1-sp)})`;ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(s.x+14*s.dir,s.y-10);ctx.lineTo(s.x+9*s.dir,s.y-27-sp*12);
      ctx.moveTo(s.x+14*s.dir,s.y-10);ctx.lineTo(s.x+20*s.dir,s.y-27-sp*12);ctx.stroke();}}
  else if(s.kind==='fly'){ const hop=Math.abs(Math.sin(s.t*3))*34;
    ctx.fillStyle='rgba(0,0,50,.15)';ctx.beginPath();ctx.ellipse(s.x,s.y+4,8,3,0,0,7);ctx.fill();
    ctx.fillStyle='#b8ccd8';ctx.beginPath();ctx.ellipse(s.x,s.y-hop,10,4,s.dir*0.2,0,7);ctx.fill();
    ctx.strokeStyle='#e0eef5';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(s.x-2,s.y-hop);ctx.lineTo(s.x-10,s.y-hop-9);
    ctx.moveTo(s.x+2,s.y-hop);ctx.lineTo(s.x+10,s.y-hop-9);ctx.stroke();}
  else { const hop=Math.abs(Math.sin(s.t*2))*26;
    ctx.fillStyle='rgba(0,0,50,.12)';ctx.beginPath();ctx.ellipse(s.x,s.y+4,10,3,0,0,7);ctx.fill();
    ctx.fillStyle='#7a9ab0';
    ctx.beginPath();ctx.ellipse(s.x,s.y-hop,16,7,s.dir*0.3*(Math.sin(s.t*2)>0?-1:1),0,7);ctx.fill();
    ctx.beginPath();ctx.moveTo(s.x,s.y-hop-5);ctx.lineTo(s.x+5*s.dir,s.y-hop-13);ctx.lineTo(s.x+9*s.dir,s.y-hop-4);ctx.fill();}
}
function pathPos(r,dd){ dd=clamp(dd,0,r.len); let d=dd,i=0;
  while(i<r.segs.length-1&&d>r.segs[i]){d-=r.segs[i];i++;}
  const a=r.pts[i],b=r.pts[i+1],t=r.segs[i]?d/r.segs[i]:0;
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,ang:Math.atan2(b.y-a.y,b.x-a.x)};}
function drawTrainCars(r){ // 長列列車：高鐵=白身飾帶(大陸藍/台灣橘)、普速=綠皮車黃帶；沿軌道轉向
  const reg=r.tt==='reg', CARS=4, GAP=58;
  const BAND=reg?'#f2d24a':(world==='cn'?'#2f6fd6':'#f28a2a');
  const H1=reg?'#5d8a60':'#fafaf8', H2=reg?'#365a3a':'#d6d6d2', EDGE=reg?'#2a4a2e':'#b4b4b0';
  for(let i=CARS-1;i>=0;i--){
    const p=pathPos(r,Math.max(0,r.d-i*GAP));
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.ang);
    ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(0,10,30,7,0,0,7);ctx.fill();
    if(i===0&&!reg){ // 高鐵流線車頭
      let g=ctx.createLinearGradient(0,-14,0,10);
      g.addColorStop(0,H1);g.addColorStop(1,H2);
      ctx.fillStyle=g;
      ctx.beginPath();ctx.moveTo(-28,-11);ctx.lineTo(10,-11);
      ctx.quadraticCurveTo(28,-10,34,1);ctx.quadraticCurveTo(29,8,10,9);ctx.lineTo(-28,9);ctx.closePath();ctx.fill();
      ctx.strokeStyle=EDGE;ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle=BAND; // 飾帶
      ctx.beginPath();ctx.moveTo(-28,-2);ctx.lineTo(14,-2);ctx.quadraticCurveTo(27,-1,31,2);
      ctx.lineTo(-28,3);ctx.closePath();ctx.fill();
      ctx.fillStyle='#3a4a58'; // 擋風玻璃
      ctx.beginPath();ctx.moveTo(12,-10);ctx.quadraticCurveTo(26,-8,31,-1);
      ctx.lineTo(20,-4);ctx.lineTo(10,-6);ctx.closePath();ctx.fill();
      ctx.fillStyle='#7ec8e8';
      for(let w2=0;w2<3;w2++){rr(-24+w2*11,-8,8,5,2);ctx.fill();}
    } else if(i===0){ // 綠皮車火車頭：方正車頭＋車燈
      let g=ctx.createLinearGradient(0,-14,0,10);
      g.addColorStop(0,H1);g.addColorStop(1,H2);
      ctx.fillStyle=g;rr(-28,-11,58,20,4);ctx.fill();
      ctx.strokeStyle=EDGE;ctx.lineWidth=1.5;rr(-28,-11,58,20,4);ctx.stroke();
      ctx.fillStyle=BAND;ctx.fillRect(-28,-2,58,4);
      ctx.fillStyle='#3a4a58';rr(16,-9,11,7,2);ctx.fill(); // 駕駛窗
      ctx.fillStyle='#ffe9a8';ctx.beginPath();ctx.arc(28,3,2.5,0,7);ctx.fill(); // 車頭燈
      ctx.fillStyle='#cfe3d0';
      for(let w2=0;w2<3;w2++){rr(-24+w2*12,-8,8,5,2);ctx.fill();}
    } else {
      let g=ctx.createLinearGradient(0,-12,0,10);
      g.addColorStop(0,reg?'#548257':'#f5f5f2');g.addColorStop(1,reg?'#335537':'#d0d0cc');
      ctx.fillStyle=g;rr(-26,-11,52,20,5);ctx.fill();
      ctx.strokeStyle=EDGE;ctx.lineWidth=1.5;rr(-26,-11,52,20,5);ctx.stroke();
      ctx.fillStyle=BAND;ctx.fillRect(-26,-2,52,reg?4:5);
      ctx.fillStyle=reg?'#cfe3d0':'#7ec8e8';
      for(let w2=0;w2<4;w2++){rr(-22+w2*12,-8,8,5,2);ctx.fill();}
      ctx.strokeStyle='#5a5048';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(26,0);ctx.lineTo(32,0);ctx.stroke();
    }
    ctx.restore();}
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
    g.addColorStop(0,'#66ab52');g.addColorStop(0.6,'#4a9142');g.addColorStop(1,'#3a7836');
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
  // 鐵路軌道（v45 路網圖：台灣環島線＋大陸八縱八橫；粵海鐵路輪渡段畫虛線）
  ctx.lineCap='round';
  if(RAILNET)for(const e of RAILNET.edges){ const P=e.pts;
    for(let i=0;i<P.length-1;i++){
      const ax=P[i][0]*TILE,ay=P[i][1]*TILE,bx=P[i+1][0]*TILE,by=P[i+1][1]*TILE;
      if(Math.max(ax,bx)<cx-100||Math.min(ax,bx)>cx+VWz+100||Math.max(ay,by)<cy-100||Math.min(ay,by)>cy+VHz+100)continue;
      if(e.ferry){ // 火車輪渡航線：海上虛線
        ctx.setLineDash([16,12]);ctx.strokeStyle='rgba(60,105,150,.6)';ctx.lineWidth=4;
        ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
        ctx.setLineDash([]); continue; }
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
  }
  ctx.lineCap='butt';
  // 纜車纜線與往返車廂（僅台灣）
  if(world==='tw')for(const c of CABLECARS){
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
    ctx.fillText(d.coin?'🪙':ITEMS[d.item].e,d.x,d.y+6+Math.sin(tGlobal*3+d.x)*2);ctx.textAlign='left';}
  for(const gt of groundToys)if(inView(gt.x,gt.y)){
    ctx.font='22px serif';ctx.textAlign='center';
    ctx.save();ctx.translate(gt.x,gt.y+Math.sin(tGlobal*3+gt.x)*2);
    if(gt.n==='陀螺')ctx.rotate(tGlobal*9);
    ctx.fillText(gt.e,0,0);ctx.restore();ctx.textAlign='left';}
  for(const p2 of projs)if(inView(p2.x,p2.y)){ctx.globalAlpha=Math.min(1,p2.t);
    ctx.font='20px serif';ctx.textAlign='center';ctx.fillText(p2.e,p2.x,p2.y);
    ctx.textAlign='left';ctx.globalAlpha=1;}
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
    if(inView(bx,by,400))list.push({y:by,f:()=>drawBuild(b)});}
  if(festival&&inView(festival.b.x+festival.b.w/2,festival.b.y+festival.b.h,500))
    list.push({y:festival.b.y+festival.b.h+42,f:()=>drawFestival(festival)});
  for(const n of NPCS)if(inView(n.x,n.y)){
    if(boarding()&&followers.includes(n.name))continue; // 同乘時隱藏夥伴（避免在地上飛）
    list.push({y:n.y,f:()=>{ drawActor(n.x,n.y,n.face,n.walk,{species:n.species,pal:n.pal,
        shirt:n.shirt||n.pal.fur,gender:n.gender,hair:n.hair,hairStyle:n.hairStyle,outfit:n.outfit});
      if(n.streamer){drawStreamer(n);drawNamePlate(n.x,n.y,n.name);} }});}
  for(const cf of campfires)if(inView(cf.x,cf.y))list.push({y:cf.y,f:()=>drawCampfire(cf)});
  for(const a of animals)if(inView(a.x,a.y))list.push({y:a.y,f:()=>drawAnimal(a)});
  for(const s of strays)if(inView(s.x,s.y))list.push({y:s.y,f:()=>drawStray(s)}); // v41 流浪貓狗
  for(const s of stars)if(inView(s.x,s.y))list.push({y:s.y,f:()=>drawStar(s)}); // v42 明星
  if(player.pet&&inView(player.pet.x,player.pet.y))list.push({y:player.pet.y,f:()=>drawPet(player.pet)}); // v41 寵物
  for(const c of citizens)if(inView(c.x,c.y))list.push({y:c.y,f:()=>{
     if(c.dead){ drawCorpse(c); return; }
     drawActor(c.x,c.y,c.face,c.walk,
    {species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},hair:c.hair||'#3a2a1a',shirt:c.shirt,race:c.race,
     outfit:c.outfit,pants:c.pants,tie:c.tie,gender:c.gender,hairStyle:c.hairStyle});
     if(c.talk>0)drawChatBubble(c.x,c.y,c.line); }});
  if(player.love&&!boarding()&&inView(player.love.x,player.love.y)){const L=player.love;
    list.push({y:L.y,f:()=>{ const ap=L.ap;
      const wed=L.streamer&&L.stage==='married'; // v46 婚後：白紗禮服(澎裙)＋頭紗（舊存檔也適用）
      drawActor(L.x,L.y,L.face,L.walk,{species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},
        hair:ap.hair,shirt:wed?'#ffffff':ap.shirt,race:ap.race,outfit:wed?'gown':ap.outfit,
        pants:ap.pants,tie:ap.tie,gender:L.gender,hairStyle:ap.hairStyle,veil:wed});
      if(L.streamer){drawStreamer({x:L.x,y:L.y});drawNamePlate(L.x,L.y,L.name,L.stage==='married');} // v41 劉思思當對象時仍會唱歌
      if(L.sparkle>0)drawSparkle(L.x,L.y,L.sparkle); // v42 新娘禮服閃亮
      // 頭上愛心／婚戒標記
      ctx.font='14px serif';ctx.textAlign='center';
      ctx.fillText(L.stage==='married'?'💍':'💗',L.x,L.y-52+Math.sin(tGlobal*3)*2);ctx.textAlign='left';}});}
  for(const ow of owners)if(inView(ow.x,ow.y))list.push({y:ow.y,f:()=>drawActor(ow.x,ow.y,0,0,
    {species:ow.species,pal:ow.pal,shirt:ow.pal.fur})});
  for(const s of sealife)if(inView(s.x,s.y,120))list.push({y:s.y,f:()=>drawSealife(s)});
  for(const pf of puffs)if(inView(pf.x,pf.y))list.push({y:pf.y+200,f:()=>{
    const ph=1-pf.t/0.5;
    ctx.fillStyle=`rgba(255,255,255,${0.7*(1-ph)})`;
    for(let i=0;i<4;i++){const a2=i*1.57+ph;
      ctx.beginPath();ctx.arc(pf.x+Math.cos(a2)*ph*20,pf.y+Math.sin(a2)*ph*14,8*(1-ph*0.4),0,7);ctx.fill();}}});
  list.push({y:player.y,f:()=>{
    if(player.riding){
      if(player.riding.kind==='train')drawTrainCars(player.riding);
      else drawGondolaCabin(player.x,player.y);
      return;}
    if(player.balloonRide){
      if(player.balloonRide.kind==='view'){ // 101 觀景台：人在原地，鏡頭拉高
        drawActor(player.x,player.y,0,0,{species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},
          hair:player.hair,shirt:player.shirt,race:player.race,gender:player.gender,hairStyle:player.hairStyle,headAcc:player.headAcc,bodyAcc:player.bodyAcc,shoes:player.shoes,outfit:player.outfit,deco:player.deco,tie:player.tie});
      } else drawBalloonRideSprite(player.x,player.y,player.balloonRide);
      return;}
    if(player.soak){ // 泡湯：只露出頭，冒蒸氣
      ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(player.x,player.y+4,16+Math.sin(tGlobal*3)*3,0,7);ctx.stroke();
      const g2=ctx.createRadialGradient(player.x-4,player.y-8,2,player.x,player.y-4,14);
      g2.addColorStop(0,tint('#f5c99b',30));g2.addColorStop(1,'#f5c99b');
      ctx.fillStyle=g2;ctx.beginPath();ctx.arc(player.x,player.y-4,13,0,7);ctx.fill();
      ctx.fillStyle='#4a2f1d';ctx.beginPath();ctx.arc(player.x,player.y-8,13,Math.PI*1.05,Math.PI*1.95);ctx.fill();
      ctx.strokeStyle='#2e2620';ctx.lineWidth=1.6; // 舒服閉眼
      ctx.beginPath();ctx.arc(player.x-5,player.y-3,2.5,0.2,Math.PI-0.2);
      ctx.moveTo(player.x+7.5,player.y-3);ctx.arc(player.x+5,player.y-3,2.5,0.2,Math.PI-0.2);ctx.stroke();
      for(let i=0;i<2;i++){const ph=(tGlobal*0.6+i*0.5)%1;
        ctx.fillStyle=`rgba(255,255,255,${0.4*(1-ph)})`;
        ctx.beginPath();ctx.arc(player.x-8+i*16,player.y-18-ph*26,5+ph*5,0,7);ctx.fill();}
      return;}
    if(player.pray){ // 雙手合十拜拜（微微鞠躬）
      const bow=Math.max(0,Math.sin(player.pray.t*2.5))*3;
      drawActor(player.x,player.y+bow,3,0,{species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},
        hair:player.hair,shirt:player.shirt,race:player.race,gender:player.gender,hairStyle:player.hairStyle,headAcc:player.headAcc,bodyAcc:player.bodyAcc,shoes:player.shoes,outfit:player.outfit,deco:player.deco,tie:player.tie});
      ctx.font='19px serif';ctx.textAlign='center';
      ctx.fillText('🙏',player.x,player.y-6+bow);ctx.textAlign='left';
      for(let i=0;i<2;i++){const ph=(tGlobal*0.7+i*0.5)%1; // 裊裊香煙
        ctx.fillStyle=`rgba(225,222,215,${0.45*(1-ph)})`;
        ctx.beginPath();ctx.arc(player.x-7+i*14+Math.sin(tGlobal*2+i)*3,player.y-56-ph*32,4+ph*5,0,7);ctx.fill();}
      return;}
    if(player.ferris){ // 摩天輪車廂裡露出頭
      ctx.fillStyle='#f5c99b';ctx.beginPath();ctx.arc(player.x,player.y-2,5,0,7);ctx.fill();
      ctx.fillStyle='#4a2f1d';ctx.beginPath();ctx.arc(player.x,player.y-5,5,Math.PI,0);ctx.fill();
      return;}
    if(player.sailing){
      const wob=Math.sin(tGlobal*2.2)*2;
      drawBoat(player.x,player.y+wob,player.face,player.moving);
      drawActor(player.x,player.y-8+wob,player.face,0,
        {species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},hair:player.hair,shirt:player.shirt,sailing:true,race:player.race,gender:player.gender,hairStyle:player.hairStyle,headAcc:player.headAcc,bodyAcc:player.bodyAcc,shoes:player.shoes,outfit:player.outfit,deco:player.deco,tie:player.tie});
    } else {
      drawActor(player.x,player.y,player.face,player.moving?player.walk:0,
        {species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},hair:player.hair,shirt:player.shirt,race:player.race,gender:player.gender,hairStyle:player.hairStyle,headAcc:player.headAcc,bodyAcc:player.bodyAcc,shoes:player.shoes,outfit:player.outfit,deco:player.deco,tie:player.tie});
    }
    if(player.job){ // v37 職業名牌（頭頂）
      const j=JOBS.find(q=>q.n===player.job), txt=(j?j.e+' ':'')+player.job;
      ctx.font='bold 11px "Microsoft JhengHei"'; const w2=ctx.measureText(txt).width;
      ctx.fillStyle='rgba(35,25,70,.75)';rr(player.x-w2/2-7,player.y-76,w2+14,17,8);ctx.fill();
      ctx.fillStyle='#ffd97a';ctx.textAlign='center';ctx.fillText(txt,player.x,player.y-63);ctx.textAlign='left';}
    if(player.playT){const p3=player.playT; ctx.textAlign='center';
      if(p3.act==='shoot'){ // 手持玩具做發射動作（玩具留在手上，只射出小東西）
        ctx.font='20px serif';
        ctx.fillText(p3.e,player.x+DIRV[player.face][0]*16,player.y-26);
      } else { const a=tGlobal*6; // 一般把玩動畫
        ctx.font='22px serif';
        ctx.fillText(p3.e,player.x+Math.cos(a)*22,player.y-30+Math.sin(a*1.3)*12);
        ctx.font='14px serif';
        ctx.fillText('🎵',player.x+18,player.y-54+Math.sin(tGlobal*4)*4);}
      ctx.textAlign='left';}
    if(player.holdToy){const h4=player.holdToy;
      ctx.font='24px serif';ctx.textAlign='center';
      if(h4.n==='風箏'){const kx=player.x+26+Math.sin(tGlobal*1.5)*12,ky=player.y-98+Math.cos(tGlobal*1.2)*8;
        ctx.strokeStyle='rgba(90,80,72,.8)';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(player.x+8,player.y-24);ctx.lineTo(kx,ky);ctx.stroke();
        ctx.fillText(h4.e,kx,ky);}
      else ctx.fillText(h4.e,player.x+20,player.y-36+Math.sin(tGlobal*2)*3);
      ctx.textAlign='left';}
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
    if(player.sparkle>0)drawSparkle(player.x,player.y,player.sparkle);
  }});
  for(const b of bugs)if(inView(b.x,b.y))list.push({y:b.y+(b.spec.fly?60:0),f:()=>{
    const fy=b.spec.fly?Math.sin(b.ph)*6-14:0;
    ctx.fillStyle='rgba(0,0,0,.1)';ctx.beginPath();ctx.ellipse(b.x,b.y+4,7,3,0,0,7);ctx.fill();
    ctx.font='20px serif';ctx.textAlign='center';ctx.fillText(b.spec.e,b.x,b.y+fy);ctx.textAlign='left';}});
  for(const ev of events)if(inView(ev.x,ev.y,160))list.push({y:ev.y+1,f:()=>{
    if(ev.type==='quarrel'){ // 吵架的兩人
      drawActor(ev.x-18,ev.y,2,Math.sin(tGlobal*6)*0.5,{species:'human',skin:'#f5c99b',
        pal:{fur:'#f5c99b'},hair:'#3a2a1a',shirt:'#e2574c',outfit:'tee'});
      drawActor(ev.x+18,ev.y,1,Math.sin(tGlobal*6+3)*0.5,{species:'human',skin:'#f5c99b',
        pal:{fur:'#f5c99b'},hair:'#2a2a2a',shirt:'#3f7fd6',outfit:'shirt'});
      ctx.font='20px serif';ctx.textAlign='center';
      ctx.fillText('💢',ev.x-18,ev.y-58+Math.sin(tGlobal*5)*3);
      ctx.fillText('💢',ev.x+18,ev.y-58+Math.cos(tGlobal*5)*3);ctx.textAlign='left';}
    else if(ev.type==='dog'){ // 野狗追人繞圈
      const a=tGlobal*3;
      const dx2=ev.x+Math.cos(a)*30, dy2=ev.y+Math.sin(a)*18;
      const vx2=ev.x+Math.cos(a+2.2)*30, vy2=ev.y+Math.sin(a+2.2)*18;
      drawActor(vx2,vy2,0,tGlobal*10,{species:'human',skin:'#f5c99b',
        pal:{fur:'#f5c99b'},hair:'#3a2a1a',shirt:'#f2b21c',outfit:'tee'});
      drawAnimal({x:dx2,y:dy2,spec:{n:'野狗',fur:'#7a6a58',meat:0,spd:0},walk:tGlobal*10});
      ctx.font='16px serif';ctx.textAlign='center';ctx.fillText('❗',vx2,vy2-58);ctx.textAlign='left';}
    else if(ev.type==='fire'&&ev.house){const hb2=ev.house; // 房子燒起來
      for(let i=0;i<4;i++){const ph=(tGlobal*2+i*0.27)%1;
        ctx.fillStyle=`rgba(255,${120+i*30},50,${0.85*(1-ph)})`;
        ctx.beginPath();ctx.arc(hb2.x+10+i*(hb2.w-20)/3+Math.sin(tGlobal*7+i)*4,hb2.y-10-ph*30,10*(1-ph*0.4),0,7);ctx.fill();}
      for(let i=0;i<2;i++){const ph=(tGlobal*0.8+i*0.5)%1;
        ctx.fillStyle=`rgba(90,90,90,${0.5*(1-ph)})`;
        ctx.beginPath();ctx.arc(hb2.x+hb2.w/2+Math.sin(tGlobal+i)*8,hb2.y-40-ph*50,10+ph*12,0,7);ctx.fill();}
      ctx.font='bold 16px "Microsoft JhengHei"';ctx.textAlign='center';
      ctx.fillStyle='#e2453c';ctx.fillText('🔥 失火了！按互動鍵滅火',hb2.x+hb2.w/2,hb2.y-72);ctx.textAlign='left';}
  }});
  if(player.wanted&&player.wanted.cops)for(const cp of player.wanted.cops) // v37 包圍圈警察
    if(inView(cp.x,cp.y))list.push({y:cp.y+(cp.down?-1:0),f:()=>drawCop(cp)});
  if(godz&&inView(godz.x,godz.y,650))list.push({y:godz.y,f:()=>drawGodzilla(godz)}); // v37 哥吉拉
  if(player.wanted&&player.wanted.car&&(player.wanted.phase==='chase'||player.wanted.phase==='block')){const car=player.wanted.car;
    if(inView(car.x,car.y,120))list.push({y:car.y,f:()=>{
      ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(car.x,car.y+8,22,7,0,0,7);ctx.fill();
      ctx.fillStyle='#3a4a6a';rr(car.x-20,car.y-16,40,22,6);ctx.fill(); // 車身
      ctx.fillStyle='#e8ecf2';rr(car.x-20,car.y-4,40,10,3);ctx.fill(); // 白下半
      ctx.fillStyle='#25324a';rr(car.x-12,car.y-13,24,9,3);ctx.fill(); // 車窗
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(car.x-13,car.y+7,4,0,7);ctx.arc(car.x+13,car.y+7,4,0,7);ctx.fill();
      const bl=Math.sin(tGlobal*12)>0; // 警示燈閃爍
      ctx.fillStyle=bl?'#ff3b30':'#3b7bff';rr(car.x-8,car.y-22,7,6,2);ctx.fill();
      ctx.fillStyle=bl?'#3b7bff':'#ff3b30';rr(car.x+1,car.y-22,7,6,2);ctx.fill();
      ctx.fillStyle='#fff';ctx.font='bold 8px "Microsoft JhengHei"';ctx.textAlign='center';
      ctx.fillText('POLICE',car.x,car.y+2);ctx.textAlign='left';
      ctx.font='16px serif';ctx.textAlign='center';ctx.fillText('🚨',car.x,car.y-30+Math.sin(tGlobal*8)*2);ctx.textAlign='left';}});}
  if(bees)list.push({y:bees.y+100,f:()=>{ ctx.font='13px serif';
    for(let i=0;i<8;i++)ctx.fillText('🐝',bees.x+Math.sin(tGlobal*8+i*2)*14+(i%3)*8-8,
      bees.y+Math.cos(tGlobal*9+i*1.7)*10+(i%2)*8);}});
  list.sort((a,b)=>a.y-b.y);
  for(const e of list)e.f();
  // v37 戰鬥特效（火球/手裡劍/地裂斬/天雷/次元砲光束）——畫在人物之上
  for(const e of fx){ const ph=e.t/e.dur;
    if(e.kind==='proj'){ const px=e.x+(e.x2-e.x)*ph, py=e.y+(e.y2-e.y)*ph;
      ctx.font='20px serif';ctx.textAlign='center';
      if(e.spin){ctx.save();ctx.translate(px,py);ctx.rotate(tGlobal*22);ctx.fillText(e.e,0,0);ctx.restore();}
      else ctx.fillText(e.e,px,py);
      ctx.textAlign='left'; }
    else if(e.kind==='slash'){ const ang=Math.atan2(e.y2-e.y,e.x2-e.x); // 地裂斬：往目標方向的扇形裂地衝擊
      ctx.lineCap='round';
      ctx.strokeStyle=`rgba(255,240,170,${1-ph})`;ctx.lineWidth=6;
      ctx.beginPath();ctx.arc(e.x,e.y,18+ph*72,ang-0.55,ang+0.55);ctx.stroke();
      ctx.strokeStyle=`rgba(170,130,80,${1-ph})`;ctx.lineWidth=3.5;
      ctx.beginPath();ctx.arc(e.x,e.y,10+ph*58,ang-0.35,ang+0.35);ctx.stroke();ctx.lineCap='butt'; }
    else if(e.kind==='bolt'){ drawBolt(e.x+10,e.y-250,e.x,e.y,1-ph,4); // 天雷從天劈落
      ctx.fillStyle=`rgba(255,255,190,${(1-ph)*0.6})`;
      ctx.beginPath();ctx.arc(e.x,e.y,16*(1-ph)+6,0,7);ctx.fill(); }
    else if(e.kind==='beam'){ ctx.lineCap='round'; // 次元砲光束
      ctx.strokeStyle=`rgba(130,215,255,${1-ph})`;ctx.lineWidth=8*(1-ph)+2;
      ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x2,e.y2);ctx.stroke();
      ctx.strokeStyle=`rgba(255,255,255,${1-ph})`;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x2,e.y2);ctx.stroke();ctx.lineCap='butt'; }
    else if(e.kind==='gun'){ const a=1-ph, ca=Math.cos(e.ang), sa=Math.sin(e.ang); // v41 開火特效
      if(ph<0.5){ // 槍口火光
        ctx.fillStyle=`rgba(255,220,90,${a})`;ctx.beginPath();ctx.arc(e.x+ca*6,e.y+sa*6,5+(0.5-ph)*10,0,7);ctx.fill();
        ctx.fillStyle=`rgba(255,255,220,${a})`;ctx.beginPath();ctx.arc(e.x+ca*6,e.y+sa*6,3,0,7);ctx.fill(); }
      if(e.sub==='shotgun'){ for(let k=-2;k<=2;k++){const aa=e.ang+k*0.12,px=e.x+Math.cos(aa)*(20+ph*90),py=e.y+Math.sin(aa)*(20+ph*90);
        ctx.fillStyle=`rgba(90,80,70,${a})`;ctx.beginPath();ctx.arc(px,py,2,0,7);ctx.fill();} }
      else if(e.sub==='smg'){ for(let k=0;k<3;k++){const t2=Math.min(1,ph+k*0.18),px=e.x+(e.x2-e.x)*t2,py=e.y+(e.y2-e.y)*t2;
        ctx.fillStyle=`rgba(70,70,70,${a})`;ctx.beginPath();ctx.arc(px,py,1.8,0,7);ctx.fill();} }
      else{ const tw=(e.sub==='sniper'||e.sub==='rifle')?1:0.7, hx=e.x+(e.x2-e.x)*Math.min(1,ph*1.6), hy=e.y+(e.y2-e.y)*Math.min(1,ph*1.6);
        const wcol=e.sub==='sniper'?`rgba(180,230,255,${a})`:e.sub==='cannon'?`rgba(130,215,255,${a})`:`rgba(255,220,120,${a})`;
        ctx.strokeStyle=wcol;ctx.lineCap='round';ctx.lineWidth=(e.sub==='cannon'?6:e.sub==='sniper'?3.5:2.2);
        ctx.beginPath();ctx.moveTo(e.x+ca*10,e.y+sa*10);ctx.lineTo(hx,hy);ctx.stroke();
        ctx.fillStyle=wcol;ctx.beginPath();ctx.arc(hx,hy,e.sub==='sniper'?3:2,0,7);ctx.fill();ctx.lineCap='butt'; } }
    else if(e.kind==='job'){ const a=1-ph; // v39 職業範圍技特效
      if(e.job==='firewall'){ const oy=e.y-16, n=8, grow=Math.min(1,ph*2);
        for(let i=1;i<=n;i++){ const t2=i/n; if(t2>grow)continue;
          const fx2=e.x+e.dx*e.range*t2, fy2=oy+e.dy*e.range*t2, s=14+Math.sin(tGlobal*20+i)*4;
          ctx.fillStyle=`rgba(255,${120+i*8},40,${a})`;ctx.beginPath();ctx.ellipse(fx2,fy2,s*0.7,s,0,0,7);ctx.fill();
          ctx.fillStyle=`rgba(255,235,130,${a*0.85})`;ctx.beginPath();ctx.ellipse(fx2,fy2-3,s*0.4,s*0.6,0,0,7);ctx.fill(); } }
      else if(e.job==='ice'){ const oy=e.y, n=8, grow=Math.min(1,ph*2);
        for(let i=1;i<=n;i++){ const t2=i/n; if(t2>grow)continue;
          const px=e.x+e.dx*e.range*t2, py=oy+e.dy*e.range*t2, h=22+Math.sin(i*1.3)*6;
          ctx.fillStyle=`rgba(150,220,255,${a})`;ctx.beginPath();ctx.moveTo(px-7,py+4);ctx.lineTo(px,py-h);ctx.lineTo(px+7,py+4);ctx.closePath();ctx.fill();
          ctx.fillStyle=`rgba(255,255,255,${a*0.75})`;ctx.beginPath();ctx.moveTo(px-2,py-2);ctx.lineTo(px,py-h);ctx.lineTo(px+2,py-2);ctx.closePath();ctx.fill(); } }
      else if(e.job==='shuriken'){ const oy=e.y-20, n=5;
        for(let i=0;i<n;i++){ const t2=((i/n)+ph)%1; const sx=e.x+e.dx*e.range*t2, sy=oy+e.dy*e.range*t2;
          ctx.save();ctx.translate(sx,sy);ctx.rotate(tGlobal*30+i);ctx.fillStyle=`rgba(90,100,115,${a})`;
          for(let k=0;k<4;k++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(0,-2);ctx.lineTo(9,0);ctx.lineTo(0,2);ctx.closePath();ctx.fill();}
          ctx.fillStyle=`rgba(230,235,245,${a})`;ctx.beginPath();ctx.arc(0,0,2.5,0,7);ctx.fill();ctx.restore(); } }
      else if(e.job==='thunder'){ const R=e.range;
        for(let i=0;i<5;i++){ const ang=i*1.3+Math.floor(e.x); const r=R*(0.25+((i*0.19)%0.7));
          const gx=e.x+Math.cos(ang)*r, gy=e.y+Math.sin(ang)*r*0.6;
          drawBolt(gx+8,gy-230,gx,gy,a,3);
          ctx.fillStyle=`rgba(255,255,190,${a*0.5})`;ctx.beginPath();ctx.arc(gx,gy,12*a+4,0,7);ctx.fill(); }
        ctx.strokeStyle=`rgba(180,200,255,${a*0.6})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(e.x,e.y,R,R*0.6,0,0,7);ctx.stroke(); }
      else if(e.job==='shock'){ const R=e.range, rr2=ph*R;
        ctx.strokeStyle=`rgba(255,240,170,${a})`;ctx.lineWidth=7*a+2;ctx.beginPath();ctx.ellipse(e.x,e.y,rr2,rr2*0.6,0,0,7);ctx.stroke();
        ctx.strokeStyle=`rgba(170,130,80,${a})`;ctx.lineWidth=4*a+1;ctx.beginPath();ctx.ellipse(e.x,e.y,rr2*0.7,rr2*0.42,0,0,7);ctx.stroke();
        ctx.fillStyle=`rgba(190,160,110,${a*0.5})`;
        for(let i=0;i<8;i++){const ang=i*0.785;ctx.beginPath();ctx.arc(e.x+Math.cos(ang)*rr2,e.y+Math.sin(ang)*rr2*0.6,4*a,0,7);ctx.fill();} }
      else if(e.job==='tornado'){ const R=e.range;
        ctx.strokeStyle=`rgba(200,225,240,${a})`;ctx.lineWidth=4;
        for(let s=0;s<3;s++){ ctx.beginPath();
          for(let k=0;k<=20;k++){ const t2=k/20, ang=t2*12+tGlobal*10+s*2.1, rad=R*(0.15+t2*0.85);
            const px=e.x+Math.cos(ang)*rad, py=e.y-t2*70+Math.sin(ang)*rad*0.5;
            if(k===0)ctx.moveTo(px,py);else ctx.lineTo(px,py); } ctx.stroke(); }
        ctx.font='13px serif';ctx.textAlign='center';ctx.globalAlpha=a;
        for(let i=0;i<4;i++){const ang=tGlobal*8+i*1.57;ctx.fillText('🍃',e.x+Math.cos(ang)*R*0.7,e.y+Math.sin(ang)*R*0.4);}
        ctx.globalAlpha=1;ctx.textAlign='left'; } } }
  // 天燈（世界層）
  for(const L of lanterns)if(inView(L.x,L.y,200))drawLanternBody(L);
  // 晝夜
  const [tr_,tg,tb2,ta]=skyTint();
  if(ta>0.005){ctx.fillStyle=`rgba(${tr_|0},${tg|0},${tb2|0},${ta})`;ctx.fillRect(cx,cy,VWz,VHz);}
  if(isRainy()&&!typhoon){ctx.fillStyle='rgba(60,80,120,.14)';ctx.fillRect(cx,cy,VWz,VHz);}
  if(isNight()){ // 夜晚海面的星光點點（藍眼淚）
    for(let k=0;k<90;k++){const sx3=hsh(k,321)*MW*TILE, sy3=hsh(k,654)*MH*TILE;
      if(sx3<cx||sx3>cx+VWz||sy3<cy||sy3>cy+VHz)continue;
      if(T(Math.floor(sx3/TILE),Math.floor(sy3/TILE))!==SEA)continue;
      ctx.globalAlpha=0.3+0.6*Math.abs(Math.sin(tGlobal*2+k));
      ctx.fillStyle='#bfe8ff';ctx.fillRect(sx3,sy3,2.5,2.5);ctx.globalAlpha=1;}
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
  if(isRainy()&&!typhoon&&!(world==='cn'&&player.y/TILE<250)){
    ctx.strokeStyle='rgba(190,210,255,.4)';ctx.lineWidth=1.5;
    for(let i=0;i<90;i++){
      const rx2=cx+((hsh(i,9)*VWz+tGlobal*60)%VWz), ry2=cy+((hsh(i,5)*VHz+tGlobal*860)%VHz);
      ctx.beginPath();ctx.moveTo(rx2,ry2);ctx.lineTo(rx2-4,ry2+14);ctx.stroke();}}
  // v43 颱風：昏暗暴風雨＋淹水波紋＋強風斜雨＋落雷（世界層）
  if(typhoon){ const fl=typhoon.flood;
    ctx.fillStyle=`rgba(26,34,58,${0.24+fl*0.14})`;ctx.fillRect(cx,cy,VWz,VHz);
    if(fl>0.05){ ctx.fillStyle=`rgba(70,120,170,${fl*0.4})`;ctx.fillRect(cx,cy,VWz,VHz); // 積水
      ctx.strokeStyle=`rgba(230,245,255,${fl*0.35})`;ctx.lineWidth=1.5;
      for(let i=0;i<10;i++){ const yy=cy+i*VHz/10+Math.sin(tGlobal*1.5+i)*8;
        ctx.beginPath();for(let x2=0;x2<=VWz;x2+=24)ctx.lineTo(cx+x2,yy+Math.sin(x2*0.05+tGlobal*3+i)*3);ctx.stroke(); } }
    ctx.strokeStyle='rgba(200,220,255,.55)';ctx.lineWidth=1.6; // 強風斜雨
    for(let i=0;i<180;i++){ const rx=cx+((hsh(i,9)*VWz+tGlobal*120)%VWz), ry=cy+((hsh(i,5)*VHz+tGlobal*1200)%VHz);
      ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx-14,ry+22);ctx.stroke(); }
    if(typhoon.strike){ const s=typhoon.strike, a=1-s.t/0.45; // 落雷
      drawBolt(s.x+14,cy-20,s.x,s.y,a,5);
      ctx.fillStyle=`rgba(255,255,200,${a*0.6})`;ctx.beginPath();ctx.arc(s.x,s.y,20*a+8,0,7);ctx.fill(); } }
  // v41 大陸北方寒冷飄雪（越往北越冷、雪越大）
  if(world==='cn'){ const cold=Math.max(0,Math.min(1,(250-player.y/TILE)/180));
    if(cold>0.05){ ctx.fillStyle=`rgba(205,225,255,${0.14*cold})`;ctx.fillRect(cx,cy,VWz,VHz);
      ctx.fillStyle='rgba(255,255,255,.92)'; const n=Math.floor(110*cold);
      for(let i=0;i<n;i++){ const sx=cx+((hsh(i,3)*VWz+tGlobal*26+Math.sin(tGlobal+i)*22)%VWz), sy=cy+((hsh(i,11)*VHz+tGlobal*105)%VHz);
        ctx.beginPath();ctx.arc(sx,sy,1.4+hsh(i,2)*1.6,0,7);ctx.fill(); } } }
  ctx.restore();
  if(flash>0){ctx.fillStyle=`rgba(255,255,255,${Math.min(1,flash)})`;ctx.fillRect(0,0,VW,VH);}
  if(flyAnim>0)drawFlyAnim(); // v42 搭飛機動畫
  if(player.wedding){ ctx.font='26px serif';ctx.textAlign='center'; // 婚禮飄愛心
    for(let i=0;i<16;i++){const t2=(tGlobal*0.8+i*0.4)%1;
      ctx.globalAlpha=0.9*(1-t2);
      ctx.fillText(i%2?'💕':'💗',(i*83%VW),VH-t2*VH);}
    ctx.globalAlpha=1;ctx.fillStyle='#d84f8f';ctx.font='bold 30px "Microsoft JhengHei"';
    ctx.fillText('🎉 結婚快樂！🎉',VW/2,VH*0.3);ctx.textAlign='left';}
  drawUI();
}

/* ================= UI ================= */
function panel(x,y,w,h,alpha){ ctx.fillStyle='rgba(255,251,233,'+(alpha||0.94)+')';
  rr(x,y,w,h,16);ctx.fill();ctx.strokeStyle='#c9a06a';ctx.lineWidth=3;rr(x,y,w,h,16);ctx.stroke();}
function drawClose(px2,py2){ // ✕ 返回鍵
  ctx.fillStyle='#e2574c';ctx.beginPath();ctx.arc(px2,py2,16,0,7);ctx.fill();
  ctx.strokeStyle='#fff';ctx.lineWidth=3.5;
  ctx.beginPath();ctx.moveTo(px2-6,py2-6);ctx.lineTo(px2+6,py2+6);
  ctx.moveTo(px2+6,py2-6);ctx.lineTo(px2-6,py2+6);ctx.stroke();
  uiHits.push({x:px2-24,y:py2-24,w:48,h:48,cb(){ui=null;menu=null;sfx('blip');}});}
function drawUI(){
  uiHits=[];
  const F='"Microsoft JhengHei","PingFang TC",sans-serif';
  const uS=(touchUI||VW<900)?0.62:1; // 手機縮小狀態列
  const wd='日一二三四五六'[gameDay%7];
  const [pIcon,pName]=dayPeriod();
  ctx.save();ctx.scale(uS,uS); // 左上角（時鐘＋狀態）
  panel(14,14,252,66);
  ctx.fillStyle='#6b4f2f';ctx.font='bold 18px '+F;
  ctx.fillText('第 '+gameDay+' 天（'+wd+'）'+pIcon+pName+(isRainy()?'🌧️':''),28,40);
  ctx.font='bold 22px '+F;
  let dispMin=gameMin, tzoff=0;
  if(world==='cn'){ tzoff=Math.round((300-player.x/TILE)/70); dispMin=gameMin-tzoff*60; } // v41 大陸時差：越西邊時間越早
  const gh=Math.floor((dispMin+2880)/60)%24, gm=Math.floor(((gameMin%60)+60)%60);
  ctx.fillText(`${String(gh).padStart(2,'0')}:${String(gm).padStart(2,'0')}`+(world==='cn'?(tzoff>0?' 西'+tzoff+'區':tzoff<0?' 東'+(-tzoff)+'區':' 京'):''),30,68);
  ctx.font='bold 15px '+F;ctx.fillStyle='#3f8f5a';
  ctx.fillText('📍 '+lastRegion,110,66);
  // 血量、飢餓、疲勞
  panel(14,88,252,80,.9);
  for(let i=0;i<10;i++){ctx.font='14px serif';
    ctx.fillText(player.hp>=(i+1)*10-4?'❤️':'🤍',26+i*23,110);}
  ctx.font='13px serif';ctx.fillText('🍗',24,131);
  ctx.fillStyle='#e8dcc0';rr(46,120,204,12,6);ctx.fill();
  ctx.fillStyle=player.hunger>30?'#f2994a':'#e2453c';
  if(player.hunger>1){rr(46,120,204*player.hunger/100,12,6);ctx.fill();}
  ctx.strokeStyle='#c9a06a';ctx.lineWidth=1.5;rr(46,120,204,12,6);ctx.stroke();
  ctx.font='13px serif';ctx.fillText('😴',24,153);
  ctx.fillStyle='#e8dcc0';rr(46,142,204,12,6);ctx.fill();
  ctx.fillStyle=player.tired>80?'#c94f8f':'#9b8fd6';
  if(player.tired>1){rr(46,142,204*player.tired/100,12,6);ctx.fill();}
  ctx.strokeStyle='#c9a06a';ctx.lineWidth=1.5;rr(46,142,204,12,6);ctx.stroke();
  if(player.hunger<25&&Math.sin(tGlobal*5)>0){ctx.font='bold 12px '+F;ctx.fillStyle='#e2453c';
    ctx.fillText('肚子好餓…快吃點東西！',60,130);}
  if(player.tired>80&&Math.sin(tGlobal*5)>0){ctx.font='bold 12px '+F;ctx.fillStyle='#7a5fb8';
    ctx.fillText('好累…找張床或旅館睡覺吧',60,152);}
  ctx.restore();
  ctx.save();ctx.translate(VW*(1-uS),0);ctx.scale(uS,uS); // 右上角（金錢＋狀態）
  const mtxt='🍃 '+fmt(money)+' 元';
  ctx.font='bold 20px '+F;
  const mw2=ctx.measureText(mtxt).width;
  panel(VW-mw2-58,14,mw2+44,46);
  ctx.fillStyle='#6b4f2f';ctx.fillText(mtxt,VW-mw2-36,45);
  let by=70;
  ctx.font='bold 14px '+F;
  { panel(VW-170,by,156,30,.9);ctx.fillStyle='#c9803a'; // 名譽值＋酬勞加成
    ctx.fillText('⭐ 名譽 '+(player.honor||0)+'（酬勞×'+honorMult().toFixed(1)+'）',VW-158,by+21);by+=36; }
  if(festival){ const bl=0.7+0.3*Math.sin(tGlobal*4); // 祭典進行中
    ctx.fillStyle=`rgba(201,57,43,${bl})`;rr(VW-170,by,156,30,8);ctx.fill();
    ctx.strokeStyle='#8a1f1f';ctx.lineWidth=2;rr(VW-170,by,156,30,8);ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='bold 12px '+F;ctx.fillText('🎉 '+festival.name,VW-162,by+20);ctx.font='bold 14px '+F;by+=36; }
  if(typhoon){ const bl=0.65+0.35*Math.sin(tGlobal*5); // v43 颱風警報
    ctx.fillStyle=`rgba(50,70,110,${bl})`;rr(VW-170,by,156,30,8);ctx.fill();
    ctx.strokeStyle='#26365a';ctx.lineWidth=2;rr(VW-170,by,156,30,8);ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='bold 12px '+F;ctx.fillText('🌀 颱風「'+typhoon.name+'」'+(typhoon.flood>0.4?'・淹水':''),VW-162,by+20);ctx.font='bold 14px '+F;by+=36; }
  if(player.boat){panel(VW-158,by,144,30,.85);ctx.fillStyle='#3f6f8f';
    ctx.fillText('⛵ '+(player.sailing?'航行中':'擁有小船'),VW-146,by+21);by+=36;}
  if(player.buffSpd>0){panel(VW-158,by,144,30,.85);ctx.fillStyle='#3f7fd6';
    ctx.fillText('🧋 加速 '+Math.ceil(player.buffSpd)+'s',VW-146,by+21);by+=36;}
  if(player.buffLuck>0){panel(VW-158,by,144,30,.85);ctx.fillStyle='#c9803a';
    ctx.fillText('🍗 幸運 '+Math.ceil(player.buffLuck)+'s',VW-146,by+21);by+=36;}
  if(player.notoriousUntil>gameDay){ // 通緝犯狀態（閃爍紅底）
    const bl=0.6+0.4*Math.sin(tGlobal*4);
    ctx.fillStyle=`rgba(226,69,60,${bl})`;rr(VW-158,by,144,30,8);ctx.fill();
    ctx.strokeStyle='#a02a24';ctx.lineWidth=2;rr(VW-158,by,144,30,8);ctx.stroke();
    ctx.fillStyle='#fff';ctx.fillText('🚨 通緝犯 剩'+Math.max(0,Math.ceil(player.notoriousUntil-gameDay-gameMin/1440))+'天',VW-148,by+21);}
  ctx.restore();
  // 工具列（底部中央錨點縮放，第7格＝裝備的玩具）
  ctx.save();ctx.translate(VW/2*(1-uS),VH*(1-uS));ctx.scale(uS,uS);
  const NSLOT=7, hw2=NSLOT*66+16, hx=VW/2-hw2/2, hy=VH-86;
  panel(hx,hy,hw2,72,.92);
  for(let i=0;i<NSLOT;i++){
    const sx=hx+10+i*66;
    if(i===player.tool){ctx.fillStyle='#ffd97a';rr(sx,hy+8,58,56,10);ctx.fill();
      ctx.strokeStyle='#e8a13a';ctx.lineWidth=3;rr(sx,hy+8,58,56,10);ctx.stroke();}
    const te=i<6?TOOLS[i].e:heldEmoji(player.toy);
    const tn=i<6?TOOLS[i].n:(player.toy||'玩具');
    ctx.font='24px serif';ctx.textAlign='center';
    ctx.fillText(te,sx+29,hy+38);
    ctx.font='bold 12px '+F;ctx.fillStyle='#6b4f2f';
    ctx.fillText((i+1)+' '+tn,sx+29,hy+58);ctx.textAlign='left';
    uiHits.push({x:VW/2*(1-uS)+sx*uS,y:VH*(1-uS)+(hy+8)*uS,w:58*uS,h:56*uS,
      cb:(k=>()=>{player.tool=k;sfx('blip');})(i)});
  }
  ctx.restore();
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
    // 側邊功能圖示（坐牢時整排停用：否則點🆘或切面板就能免服刑越獄，且存檔仍是jailed，重整又被關回去）
    const icons=[['🎒','bag'],['🗺️','map'],['📖','dex'],['📋','quest'],['🔨','craft'],['💾','save'],['🆘','rescue'],['❓','help']];
    const step=Math.min(50,(VH*0.66)/icons.length), iy0=Math.max(92,VH*0.15);
    if(ui!=='jail')icons.forEach(([em,mode],i)=>{ const iy=iy0+i*step;
      ctx.globalAlpha=0.85;panel(VW-52,iy,42,42,.85);ctx.globalAlpha=1;
      if(mode==='rescue'){ctx.fillStyle='#e2574c';ctx.font='bold 15px '+F;ctx.textAlign='center';ctx.fillText('脫困',VW-31,iy+27);ctx.textAlign='left';}
      else{ctx.font='20px serif';ctx.fillText(em,VW-45,iy+29);}
      // 點擊區加大：填滿整格高度、延伸到螢幕右緣，減少手機誤觸
      uiHits.push({x:VW-60,y:iy-(step-42)/2,w:60,h:step,cb:((m)=>()=>{
        if(m==='craft'){if(!ui)openCraft();else ui=null;}
        else if(m==='save'){save();toast('💾 已存檔！');}
        else if(m==='rescue'){openMenu('🆘 卡住了嗎？',[
          {label:'✅ 換個地方！傳送到最近的城市',cb(){rescueTeleport();}},
          {label:'取消',cb(){ui=null;}}]);}
        else ui=(ui===m?null:m);
        sfx('blip');})(mode)});});
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
    drawClose(x+w-20,y+18);
    ctx.fillStyle='#5b4023';ctx.font='bold 18px '+F;
    ctx.fillText(menu.title.length>32?menu.title.slice(0,32)+'…':menu.title,x+24,y+34);
    for(let i=0;i<menu.opts.length;i++){
      const oy=y+50+i*oh;
      if(i===menu.sel){ctx.fillStyle='#ffe9b0';rr(x+16,oy,w-32,oh-8,10);ctx.fill();}
      ctx.fillStyle=i===menu.sel?'#c9500f':'#6b4f2f';ctx.font='bold '+fs+'px '+F;
      ctx.fillText((i===menu.sel?'▶ ':'　 ')+menu.opts[i].label,x+28,oy+oh-15);
      uiHits.push({x:x+16,y:oy,w:w-32,h:oh-8,cb:(k=>()=>{menu.sel=k;const o=menu.opts[k];ui=null;o.cb();})(i)});
    }
  }
  if(ui==='bag'){
    const w=Math.min(720,VW-40),x=VW/2-w/2,y=48,h=VH-144; // 佔滿高度、底部留給工具列
    panel(x,y,w,h);
    ctx.fillStyle='#5b4023';ctx.font='bold 22px '+F;ctx.fillText('🎒 背包',x+22,y+34);
    ctx.font='12px '+F;ctx.fillStyle='#9a805c';
    ctx.fillText('點食物🍗可吃·點玩具/槍可裝備·雜貨店可賣',x+108,y+34);
    drawClose(x+w-24,y+22);
    const names=Object.keys(inv);
    let total=0; names.forEach(n=>total+=(ITEMS[n]?ITEMS[n].p:0)*inv[n]);
    ctx.font='bold 14px '+F;ctx.fillStyle='#3f8f5a';ctx.textAlign='right';
    ctx.fillText('總價值 '+fmt(total)+' 元',x+w-46,y+34);ctx.textAlign='left';
    // 自動縮放格子，讓「全部道具」一次顯示（道具越多格子越小）
    const Wg=w-40, Hg=h-52, gap=8, N=Math.max(1,names.length);
    let cell=34;
    for(let cs=88;cs>=34;cs-=3){ const p=cs+gap;
      const c=Math.max(1,Math.floor(Wg/p)), r=Math.max(1,Math.floor(Hg/p));
      if(c*r>=N){cell=cs;break;} }
    const pitch=cell+gap, ic=cell/94;
    const cols=Math.max(1,Math.floor(Wg/pitch));
    names.forEach((n,i)=>{
      const gx=x+20+(i%cols)*pitch, gy=y+46+Math.floor(i/cols)*pitch, cx=gx+cell/2;
      ctx.fillStyle=ITEMS[n].hu?'#e8f5d6':'#fff3d6';rr(gx,gy,cell,cell,Math.max(4,8*ic));ctx.fill();
      ctx.textAlign='center';
      if(cell>=58){ ctx.font=Math.round(26*ic)+'px serif';ctx.fillStyle='#000';ctx.fillText(ITEMS[n].e,cx,gy+cell*0.38);
        ctx.font='bold '+Math.max(9,Math.round(13*ic))+'px '+F;ctx.fillStyle='#5b4023';ctx.fillText(n,cx,gy+cell*0.64);
        ctx.font=Math.max(8,Math.round(12*ic))+'px '+F;ctx.fillStyle='#9a805c';
        ctx.fillText('×'+inv[n]+(ITEMS[n].hu?' 🍗'+ITEMS[n].hu:' '+ITEMS[n].p+'元'),cx,gy+cell*0.84);
      } else { // 小格：只放圖示＋數量
        ctx.font=Math.round(cell*0.5)+'px serif';ctx.fillStyle='#000';ctx.fillText(ITEMS[n].e,cx,gy+cell*0.52);
        ctx.font='bold '+Math.max(8,Math.round(cell*0.24))+'px '+F;ctx.fillStyle='#5b4023';ctx.fillText('×'+inv[n],cx,gy+cell*0.92);
      }
      ctx.textAlign='left';
      uiHits.push({x:gx,y:gy,w:cell,h:cell,cb:((nm)=>()=>{
        if(ITEMS[nm].toy){player.toy=nm;player.tool=6;ui=null;sfx('blip');save();
          toast(ITEMS[nm].e+' 裝備了'+nm+'！按互動鍵（或Ⓐ）就能玩');}
        else eatFood(nm);})(n)});});
    if(!names.length){ctx.font='16px '+F;ctx.fillStyle='#9a805c';
      ctx.fillText('背包空空的…去釣魚、抓蟲、搖樹吧！',x+34,y+88);}
  }
  if(ui==='map'){
    // 縮小地圖：整塊(地圖＋下方按鈕)置中於工具列上方，X 一定點得到
    let mh=Math.min(VH-200,480); let mw3=mh*(MW/MH);
    if(mw3>VW-110){mw3=VW-110;mh=mw3*(MH/MW);}
    const x=VW/2-mw3/2, y=Math.max(40,(VH-86-(mh+50))/2+8);
    panel(x-18,y-16,mw3+36,mh+58);
    ctx.drawImage(mini,x,y,mw3,mh);
    ctx.strokeStyle='#c9a06a';ctx.lineWidth=3;ctx.strokeRect(x,y,mw3,mh);
    ctx.font='bold 14px '+F;ctx.fillStyle='#5b4023';
    ctx.fillText('🗺️ 地區 '+Object.keys(townsV).length+'/'+TOWNS.length+
      '　📍 印章 '+Object.keys(stamps).length+'/'+STAMP_TOTAL,x,y+mh+28);
    ctx.fillStyle='#f0913a';rr(x+mw3-150,y+mh+8,150,30,9);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 14px '+F;
    ctx.fillText('🖼️ 縣市導覽圖',x+mw3-138,y+mh+29);
    uiHits.push({x:x+mw3-150,y:y+mh+8,w:150,h:30,cb(){ui=null;openRefView();}});
    drawClose(Math.min(x+mw3+6,VW-24),Math.max(24,y-4));
    const MKS = world==='cn'
      ? TOWNS_CN.map(t=>[t.n,t.tx,t.ty])
      : [['台北',202,44],['桃園',178,70],['新竹',163,98],['台中',158,174],['彰化',150,200],
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
    ctx.fillStyle='#5b4023';ctx.font='bold 24px '+F;ctx.fillText('📖 生物圖鑑',x+28,y+44);
    drawClose(x+w-24,y+26);
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
    const partners=NPC_DEFS.filter(d=>d.name!=='阿吉'&&d.name!=='里長伯');
    const w=Math.min(920,VW-40),x=VW/2-w/2,y=56;
    const rows=Math.ceil(partners.length/2), h=Math.min(VH-100,86+rows*44);
    panel(x,y,w,h);
    ctx.fillStyle='#5b4023';ctx.font='bold 22px '+F;
    ctx.fillText('🤝 夥伴委託（點任一列看物品去哪拿💡）',x+24,y+40);
    drawClose(x+w-24,y+26);
    partners.forEach((d,i)=>{
      const st=partnerState[d.name]||{s:0,f:false};
      const col=i%2, row=Math.floor(i/2);
      const gx=x+18+col*(w/2-10), gy=y+62+row*44;
      if(gy>y+h-40)return;
      ctx.fillStyle=st.f?'#ffe9c8':(st.s>=3?'#e8f5e0':'#f5f0e0');
      rr(gx,gy,w/2-26,38,8);ctx.fill();
      const icon=st.f?'🤝':(st.s>=3?'✅':(st.s>0?'⏳':'❔'));
      let txt;
      if(st.s>=3)txt=st.f?'同行中！':'可結伴同行';
      else{const t=chainOf(npcIdx(d.name))[st.s];
        txt='需 '+ITEMS[t[0]].e+t[0]+'×'+t[1]+'（'+(inv[t[0]]||0)+'/'+t[1]+'）';}
      ctx.font='bold 14px '+F;ctx.fillStyle='#5b4023';
      ctx.fillText(icon+' '+d.name+'　'+st.s+'/3　'+txt,gx+12,gy+25);
      uiHits.push({x:gx,y:gy,w:w/2-26,h:38,cb:((dd,ss)=>()=>{ // 點列→顯示取得提示與夥伴位置
        ui=null;
        if(ss.s>=3){dlg(dd.name,['委託全數完成！','去找'+dd.name+'選「結伴同行」一起環島吧！',
          'TA 住在「'+(nearestTown(dd.tx,dd.ty).t.c+'・'+nearestTown(dd.tx,dd.ty).t.n)+'」附近。']);return;}
        const t=chainOf(npcIdx(dd.name))[ss.s];
        dlg(dd.name+'的委託',['需要 '+ITEMS[t[0]].e+t[0]+'×'+t[1]+'（目前 '+(inv[t[0]]||0)+'/'+t[1]+'）',
          '💡 取得方式：'+guideOf(t[0]),
          '交付地點：'+dd.name+' 在「'+(nearestTown(dd.tx,dd.ty).t.c+'・'+nearestTown(dd.tx,dd.ty).t.n)+'」附近',
          '（缺貨可到雜貨店🛒購買材料救急）']);})(d,st)});});
  }
  if(ui==='home'){ // 我的家室內
    const w=Math.min(540,VW-40),h=350,x=VW/2-w/2,y=Math.max(20,VH/2-h/2-10);
    panel(x,y,w,h);
    drawClose(x+w-24,y+26);
    ctx.fillStyle='#5b4023';ctx.font='bold 20px '+F;ctx.fillText('🏠 '+player.name+'的家',x+24,y+40);
    ctx.fillStyle='#e8d0a8';rr(x+20,y+56,w-40,h-84,10);ctx.fill(); // 木地板
    ctx.strokeStyle='#d0b888';ctx.lineWidth=1;
    for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(x+20,y+56+i*(h-84)/5);ctx.lineTo(x+w-20,y+56+i*(h-84)/5);ctx.stroke();}
    // 窗戶（看得到現在是白天或晚上）
    const [ri,gi,bi,ai]=skyTint();
    ctx.fillStyle='#8fd3e8';rr(x+w-150,y+72,92,62,8);ctx.fill();
    if(ai>0.01){ctx.fillStyle=`rgba(${ri|0},${gi|0},${bi|0},${Math.min(0.85,ai+0.2)})`;rr(x+w-150,y+72,92,62,8);ctx.fill();}
    ctx.font='24px serif';ctx.fillText(isNight()?'🌙':'☀️',x+w-118,y+112);
    ctx.strokeStyle='#8a6b3a';ctx.lineWidth=4;ctx.strokeRect(x+w-150,y+72,92,62);
    // 床（點擊睡覺）
    ctx.fillStyle='#8a6b3a';rr(x+48,y+92,122,152,10);ctx.fill();
    ctx.fillStyle='#f2f2ea';rr(x+56,y+100,106,58,8);ctx.fill();
    ctx.fillStyle='#c9705f';rr(x+56,y+152,106,84,8);ctx.fill();
    ctx.font='bold 14px '+F;ctx.fillStyle='#fff';ctx.fillText('點床睡覺 💤',x+72,y+200);
    uiHits.push({x:x+48,y:y+92,w:122,h:152,cb(){doSleep(0,'家');}});
    // 小桌與檯燈
    ctx.fillStyle='#a5824a';rr(x+236,y+186,84,52,8);ctx.fill();
    ctx.fillStyle=isNight()?'#ffd97a':'#e8e0c8';ctx.beginPath();ctx.arc(x+278,y+176,10,0,7);ctx.fill();
    ctx.fillStyle='#8a6b3a';ctx.fillRect(x+274,y+182,8,8);
    drawActor(x+320,y+160,0,0,{species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},
      hair:player.hair,shirt:player.shirt,race:player.race,gender:player.gender,hairStyle:player.hairStyle,headAcc:player.headAcc,bodyAcc:player.bodyAcc,shoes:player.shoes,outfit:player.outfit,deco:player.deco,tie:player.tie});
    ctx.font='13px '+F;ctx.fillStyle='#9a805c';
    ctx.fillText('睡一覺 → 隔天早上 06:00，疲勞歸零、體力大補（✕ 出門）',x+24,y+h-14);
  }
  if(ui==='jail'){ // 桃園監獄牢房（不可用✕關閉，只能服刑或保釋）
    const w=Math.min(520,VW-40),h=330,x=VW/2-w/2,y=Math.max(20,VH/2-h/2);
    panel(x,y,w,h);
    ctx.fillStyle='#5b4023';ctx.font='bold 22px '+F;ctx.fillText('🚔 桃園監獄',x+24,y+40);
    ctx.fillStyle='#6a6a6a';rr(x+20,y+56,w-40,h-150,8);ctx.fill(); // 牢房地
    ctx.strokeStyle='#3a3a3a';ctx.lineWidth=5; // 鐵欄杆
    for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(x+40+i*(w-80)/8,y+60);ctx.lineTo(x+40+i*(w-80)/8,y+h-100);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(x+40,y+64);ctx.lineTo(x+w-40,y+64);ctx.stroke();
    drawActor(x+w/2,y+h-110,0,0,{species:'human',skin:'#f5c99b',pal:{fur:'#f5c99b'},
      hair:'#4a2f1d',shirt:'#d8a04a',race:player.race}); // 囚服(橘)
    ctx.font='13px '+F;ctx.fillStyle='#9a805c';ctx.textAlign='center';
    ctx.fillText(player.murderRap?'🔫 你開槍殺人被捕！出獄後身上會有 5000 元、名譽歸零…':'你被警察逮捕了…出獄後身上會有 5000 元。',x+w/2,y+h-74);ctx.textAlign='left';
    const bw=(w-56)/2;
    ctx.fillStyle='#3f8f5a';rr(x+20,y+h-58,bw,42,10);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 15px '+F;ctx.textAlign='center';
    ctx.fillText('服刑到隔天06:00',x+20+bw/2,y+h-32);ctx.textAlign='left';
    uiHits.push({x:x+20,y:y+h-58,w:bw,h:42,cb(){ player.jailed=false;
      gameDay++;gameMin=6*60;player.tired=0;player.hp=Math.min(100,player.hp+20);
      const pr=BUILDINGS.find(b=>b.t==='prison'); const q=findWalkSafe(pr.tx+2,pr.ty+pr.th+2);
      player.x=q.x;player.y=q.y; ui=null; sfx('chime');
      money=5000; // 被警察抓：出獄一律持有 5000 元（設定值、不累加）
      if(player.murderRap){player.honor=0;player.murderRap=false;save();
        toast('⚖️ 殺人重罪服刑期滿：出獄後身上有 5000 元、名譽值歸零。重新做人吧。');}
      else{save();toast('☀️ 服刑期滿，重獲自由！出獄後身上有 5000 元。');} }});
    ctx.fillStyle='#f0913a';rr(x+36+bw,y+h-58,bw,42,10);ctx.fill();
    ctx.fillStyle='#fff';ctx.textAlign='center';
    ctx.fillText('立刻出獄（不用等）',x+36+bw+bw/2,y+h-32);ctx.textAlign='left';
    uiHits.push({x:x+36+bw,y:y+h-58,w:bw,h:42,cb(){ player.jailed=false;
      const pr=BUILDINGS.find(b=>b.t==='prison'); const q=findWalkSafe(pr.tx+2,pr.ty+pr.th+2);
      player.x=q.x;player.y=q.y; ui=null; sfx('cash');
      money=5000; // 被警察抓：出獄一律持有 5000 元（設定值、不累加）
      if(player.murderRap){player.honor=0;player.murderRap=false;save();
        toast('⚖️ 你有殺人重罪在身，出獄後身上有 5000 元、名譽歸零。');}
      else{save();toast('🚶 走出監獄大門，身上有 5000 元。');} }});
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
      '❤️ 注意飢餓度！餓久了會扣血。打開背包點擊食物就能吃。',
      '🔨 按 C 製作：木矛（打獵山豬野兔→生肉）、營火（烤肉烤魚）。',
      '😴 注意疲勞度！走太多會累——住旅館或回家睡覺（隔天06:00）。',
      '🏠 按 C 蓋自己的家（木材10＋礦石5＋2000元），進門點床就能睡。',
      '🧸 玩具工坊可做 20 種手工玩具，背包點擊就能玩（風箏會飛喔）！',
      '🍜 各縣市有 40 間在地美食小店，老闆還有委託可接。',
      '💗 結婚：找城鎮路人「認識一下」→禮品店買禮物送禮拉好感→告白成男女朋友',
      '　 →好感80帶戒指到戶政事務所💒結婚（可離婚），配偶會一直陪你環島！',
      '⚠️ 持鏟子/斧頭/木矛/彈弓時按互動鍵＝攻擊人（空手才是對話）！',
      '　 打人會掉錢可撿，但對方會報警！躲遠或躲進自己家裡，',
      '　 否則警車會超車攔截、警察下車包圍——被圍住就關進桃園監獄！',
      '　 （警察也能打倒搶錢…但襲警會讓罪加一等）',
      '🚨 傷害路人超過10次會被列為【通緝犯】，連續2天警方不定時派車追捕！',
      '🌾 各縣市政府可買農地：播種後每小時領補助、成熟收割賺大錢！',
      '🧙 綠島魔法屋免費學職業（魔法師/劍士/忍者/道士/風女/冰女），全是範圍技！',
      '🦖 聽到廣播「哥吉拉出現」→武器店買次元砲(5萬)出海討伐，賞金100萬！',
      '✈️ 桃園/松山/小港機場可搭飛機去「大陸」(長城/東方明珠/熊貓)，株洲有直播主劉思思會唱歌喔！',
      '',
      'B背包 M地圖 P圖鑑 J任務 C製作 N音樂 (H 或 Esc 關閉)'];
    panel(x,y,w,lines.length*27+46);
    drawClose(x+w-24,y+26);
    ctx.font='bold 15px '+F;
    lines.forEach((l,i)=>{ctx.fillStyle=i===0?'#c9500f':'#5b4023';
      ctx.fillText(l,x+30,y+38+i*27);});
  }
}

/* ================= 存檔 ================= */
const SAVEKEY='twisland_v3';
function save(){ try{ localStorage.setItem(SAVEKEY,JSON.stringify({
  name:player.name,shirt:player.shirt,race:player.race,gender:player.gender,hairStyle:player.hairStyle,hair:player.hair,
  headAcc:player.headAcc,bodyAcc:player.bodyAcc,shoes:player.shoes,ownAcc:player.ownAcc,ownShoes:player.ownShoes,
  outfit:player.outfit,deco:player.deco,tie:player.tie,ownClothes:player.ownClothes,money,inv,dex,boat:player.boat,
  hp:player.hp,hunger:player.hunger,stamps,townsV,partners:partnerState,followers,
  gameDay,gameMin:Math.floor(gameMin),tired:Math.floor(player.tired),myHomes,eateryDone,toy:player.toy,jailed:player.jailed,love:player.love,
  crimes:player.crimes,notoriousUntil:player.notoriousUntil,honor:player.honor,ownGuns:player.ownGuns,murderRap:player.murderRap,
  job:player.job,farms:myFarms,world,pet:player.pet,petFood:player.petFood,autographs:player.autographs,
  x:player.x,y:player.y,sailing:player.sailing,music:musicOn}));}catch(e){} }
function load(){ try{ const s=JSON.parse(localStorage.getItem(SAVEKEY));
  if(!s)return false;
  player.name=s.name||'小島民';player.shirt=s.shirt||'#e74c3c';player.race=s.race||0;
  player.gender=s.gender||'m';player.hairStyle=s.hairStyle||0;player.hair=s.hair||'#4a2f1d';
  player.headAcc=s.headAcc||null;player.bodyAcc=s.bodyAcc||null;player.shoes=s.shoes||null;
  player.ownAcc=s.ownAcc||[];player.ownShoes=s.ownShoes||[];
  player.outfit=s.outfit||'tee';player.deco=s.deco||null;player.tie=s.tie||null;player.ownClothes=s.ownClothes||[];
  money=s.money??800;inv=s.inv||{};dex=s.dex||{};
  if(!Number.isFinite(money)||money<0||money>10000000){ // v46 防外部改檔：遊戲內收入不可能到千萬
    money=88888; toast('💰 偵測到異常金額，已修正為 88,888 元'); }
  player.hp=s.hp??100;player.hunger=s.hunger??100;
  stamps=s.stamps||{};townsV=s.townsV||{};
  partnerState=s.partners||{};followers=s.followers||[];
  gameDay=s.gameDay||1;gameMin=s.gameMin??8*60;player.tired=s.tired||0;player.jailed=!!s.jailed;
  eateryDone=s.eateryDone||{};player.toy=s.toy||null;player.love=s.love||null;
  player.crimes=s.crimes||0;player.notoriousUntil=s.notoriousUntil||0;player.patrolT=20;player.honor=s.honor||0;
  player.ownGuns=s.ownGuns||[];player.murderRap=!!s.murderRap;
  player.pet=s.pet||null; player.petFood=s.petFood||0; // v41 寵物
  player.autographs=s.autographs||[]; // v42 明星簽名
  const addToScene=(wn,...a)=>{ const S=SCENES[wn]||SCENES.tw; const sv=BUILDINGS; BUILDINGS=S.buildings; addBuild(...a); BUILDINGS=sv; };
  myHomes=s.myHomes||(s.myHome?[{tx:s.myHome.tx,ty:s.myHome.ty,type:'cabin'}]:[]);
  for(const mh of myHomes){const ht=HOUSE_TYPES.find(h=>h.id===mh.type)||HOUSE_TYPES[0]; mh.w=mh.w||'tw';
    addToScene(mh.w,'myhome',mh.tx,mh.ty,ht.tw,ht.th,(s.name||'小島民')+'的'+ht.n,{htype:ht.id});}
  player.job=s.job||null; // v37 職業＋農地
  myFarms=(s.farms||[]).map(f=>({tx:f.tx,ty:f.ty,state:f.state||'empty',at:f.at||0,pay:f.pay||0,w:f.w||'tw'}));
  for(const f of myFarms)addToScene(f.w,'farm',f.tx,f.ty,2,2,(s.name||'小島民')+'的農地',{farm:f});
  player.boat=!!s.boat;musicOn=s.music!==false;
  setScene(s.world==='cn'?'cn':'tw'); genWorld(); genNpcs(); // v40 切到存檔所在世界，重生該世界物件/NPC
  if(s.x!=null){ if(s.sailing&&!hitWater(s.x,s.y)){player.x=s.x;player.y=s.y;player.sailing=true;}
    else if(!hitObstacle(s.x,s.y)){player.x=s.x;player.y=s.y;} }
  return true;}catch(e){return false;} }
setInterval(()=>{if(started)save();},10000);
addEventListener('beforeunload',()=>{if(started)save();});

/* ================= 啟動 ================= */
genNpcs(); genWorld();
// 縣市導覽圖檢視器（玩家提供的手繪參考圖）
const refView=document.getElementById('refView'), refSel=document.getElementById('refSel'),
      refImg=document.getElementById('refImg');
{ REF_COUNTIES.forEach(([n,f])=>{const o=document.createElement('option');
    o.value='ref/'+f+'.png';o.textContent='🗺️ '+n;refSel.appendChild(o);});
  for(let i=1;i<=REF_PORTS;i++){const o=document.createElement('option');
    o.value='ref/p'+String(i).padStart(2,'0')+'.png';o.textContent='⚓ 港口導覽圖 '+i;refSel.appendChild(o);}
  refSel.onchange=()=>{refImg.src=refSel.value;};
  document.getElementById('refClose').onclick=()=>{refView.style.display='none';};}
function openRefView(){
  const county=lastRegion.split('・')[0].replace('外海','');
  const hit=REF_COUNTIES.find(([n])=>n.startsWith(county));
  if(hit)refSel.value='ref/'+hit[1]+'.png';
  refImg.src=refSel.value||('ref/'+REF_COUNTIES[0][1]+'.png');
  refView.style.display='flex';
}
const hasSave=load();
const SHIRTS=['#e74c3c','#3f7fd6','#2ea36b','#f2b21c','#9b59b6','#f27ba0'];
const swd=document.getElementById('swatches');
SHIRTS.forEach(c=>{const el=document.createElement('div');el.className='sw'+(c===player.shirt?' sel':'');
  el.style.background=c;el.onclick=()=>{player.shirt=c;
    [...swd.children].forEach(e=>e.classList.remove('sel'));el.classList.add('sel');};
  swd.appendChild(el);});
document.getElementById('nameIn').value=player.name;
{ const rs2=document.getElementById('raceSel');
  RACES.forEach((r,i)=>{const o=document.createElement('option');o.value=i;o.textContent=r.n;rs2.appendChild(o);});
  rs2.value=player.race||0; }
// （開場不再選性別/髮型；預設後可到髮型店更換造型）
if(hasSave)document.getElementById('startBtn').textContent='繼續遊戲！';
document.getElementById('startBtn').onclick=()=>{
  player.name=(document.getElementById('nameIn').value.trim()||'小島民').slice(0,8);
  player.race=+document.getElementById('raceSel').value||0;
  document.getElementById('intro').style.display='none';
  initAudio(); started=true; save();
  if(player.jailed){const pr=BUILDINGS.find(b=>b.t==='prison');
    if(pr){player.x=(pr.tx+pr.tw/2)*TILE;player.y=(pr.ty+pr.th/2)*TILE;} ui='jail';}
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
