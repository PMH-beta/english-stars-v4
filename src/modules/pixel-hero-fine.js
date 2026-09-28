// Feine Pixel-Figur & Gefährten für English Stars (Pastell-Redesign).
// Figur 54×81, Kopf 34×34, Gefährte 40×40. Nur ganzzahlig skalieren. Nichts ragt über die Leinwand (Helm-Feder, Frisuren, Waffen, Posen: oberstes Pixel ≥ 1, Kontur passt).
// Kampfansicht Gefährte: petFacing(kind, color) · Animation: petBattleFrames / petBattleSequence · Menü mit Pixel-Schatten: petMenuImage.
// Ruhehaltung im Kampf (Blick zum Gegner): Axt, Hammer, Streitkolben stehen steiler (REST_F), damit der Kopf in der 54-px-Leinwand bleibt.
// cfg.gear.weapon.type: 'schwert' | 'dolch' | 'speer' | 'axt' | 'hammer' | 'stab' | 'bogen' | 'streitkolben', which: 'past' (Stahl) | 'pp' (Gold).
// cfg.pose = { wa, hx, hy, lx, ly, eyes, mouth, trail, draw, arrow } zeichnet Kampf-Schlüsselposen (siehe pixel-anim.js), cfg.W = breitere Leinwand für ausgestreckte Waffen.
// Dungeon-Gegner · feine Pixel-Art. Normale 72×72, Bosse 96×96 (Anzeige 2×).
// Formen → Masken → Kuppel-Beleuchtung (Licht oben links) → Innenlinien → farbige Außenkontur → Details.
const ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-/:;<=>?@[]^_{|}~ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ';
const R={
slimeG:['#173d33','#23654d','#2f8f5d','#52b86a','#8edb86','#d4f7b8'],
slimeV:['#2a1a55','#47318f','#6a4fc8','#9277ea','#bea8ff','#ece4ff'],
bone:['#4a3b33','#8a7a66','#b5a78e','#d8cdb4','#efe7d3','#fffcf2'],
iron:['#23252e','#3d414f','#5b6072','#7d8396','#a4aabb','#d2d7e3'],
steel:['#283347','#4a5d78','#6f86a6','#8fa8c6','#bcd0e6','#eef6ff'],
rust:['#3a2220','#613a2f','#86523a','#a86d48','#c9905f','#e6b98a'],
wood:['#33200f','#5c3a1e','#7f5230','#a36d40','#c48b56','#e2b27c'],
gold:['#5a3c0b','#8a5f12','#b8871f','#e2b53c','#f7d466','#fff0b0'],
leather:['#301c12','#56331f','#7a4a2c','#9c643b','#bf8656','#ddb080'],
goblin:['#1f3a1c','#355e25','#4f852f','#6fa83d','#98ca57','#cfea8a'],
eyeW:['#4a3f52','#9a93a8','#c9c4d4','#ece9f2','#faf8ff','#ffffff'],
red:['#3f0f1f','#6e1a31','#a02a42','#cc4455','#e97a7a','#ffb8b0'],
robe:['#1c1236','#33236a','#4b3597','#6a4fc8','#8d74e3','#b9a6ff'],
fur:['#1b1528','#2e2544','#443863','#5e5484','#8379ad','#b5addb'],
membrane:['#2a1630','#4d2750','#733d6d','#96578c','#bb7fae','#e2b5d6'],
furR:['#3d1426','#6b2440','#99395a','#c55a78','#e58c9e','#ffc6cc'],
memR:['#3a1520','#62233a','#8b3a55','#b35a73','#d68a9a','#f5c0c8'],
tongue:['#4a1428','#7d2440','#b03c58','#d8617a','#ef93a0','#ffc8cc'],
mouthIn:['#1a0c14','#2a1220','#3b1a2c','#4d2338','#632e48','#7a3a58'],
capRed:['#3f0c18','#74162a','#aa2338','#d63a48','#f06f6a','#ffb4a6'],
cream:['#4a3d33','#9c8a70','#c8b894','#e6d8b8','#f6eed8','#fffaf0'],
gill:['#4a2e2a','#7a5046','#a07060','#c09078','#dcb49a','#f0d4bc'],
ratFur:['#231c1a','#3e3330','#5a4a44','#786459','#9c8677','#c4b0a0'],
pink:['#4d2230','#86424f','#b56a76','#d99098','#f0b8bc','#ffe0e2'],
spider:['#120e1c','#221a33','#342849','#4a3a63','#665283','#8f7aad'],
venom:['#1a4020','#2f7a2a','#5ab83a','#8fe25a','#c8ff8a','#f0ffd0'],
glowR:['#4a0a14','#8a1424','#d0283a','#ff5a5a','#ff9a8a','#ffe0d0'],
glowY:['#5a3a08','#a06a10','#e0a020','#ffd040','#ffec90','#fffbe0'],
glowC:['#0a3a4a','#127a8a','#1fbfd0','#4fe8f0','#a8fbff','#f0ffff'],
glowV:['#2a0a5a','#4a1aa0','#7a3ae0','#a878ff','#d4b8ff','#f6eeff'],
ghost:['#3a3466','#6a64a4','#9a95cf','#c4c0ec','#e4e2ff','#ffffff'],
void:['#0f0c1c','#171229','#1f1836','#282043','#322850','#3c305e'],
stone:['#23262e','#3a3f4a','#555c69','#737b89','#98a0ad','#c3cad4'],
stoneW:['#1f2129','#31353f','#474d59','#626a77','#848c99','#aab2bd'],
moss:['#1b3320','#2a4d2c','#3c6b39','#558a48','#79ab5e','#a8cf82'],
scaleR:['#2e0a18','#57122a','#86203a','#b53645','#dd5f55','#f5a07a'],
belly:['#4a2e0c','#7a5516','#a87e26','#d6aa42','#eecf74','#fff0b8'],
horn:['#43372c','#7c6a54','#a8957a','#cdbc9c','#e8dcc2','#fbf6ea'],
furB:['#241410','#43261a','#643925','#864f33','#a86b48','#cc9068'],
muzzle:['#3d2a20','#6e5040','#98725c','#bd9478','#d9b598','#f0d6be'],
hoof:['#15121a','#262130','#383146','#4c445c','#645b76','#827996'],
fire:['#5a1a08','#a03010','#e0581a','#ff8a2a','#ffc050','#fff0a0']};
const LV=(()=>{const v=[-0.5,-0.72,0.9],n=Math.hypot(v[0],v[1],v[2]);return v.map(a=>a/n);})();
const BAY=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
function inPoly(P,x,y){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if(((a[1]>y)!=(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
function bezPt(P,t){let p=P.map(q=>q.slice());while(p.length>1){const n=[];for(let i=0;i<p.length-1;i++)n.push([p[i][0]+(p[i+1][0]-p[i][0])*t,p[i][1]+(p[i+1][1]-p[i][1])*t]);p=n;}return p[0];}
function bres(x0,y0,x1,y1){const o=[];x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let e=dx+dy;for(;;){o.push([x0,y0]);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}return o;}
function dist(m,W,H){const d=new Float32Array(W*H);for(let i=0;i<W*H;i++)d[i]=m[i]?1e9:0;const at=(x,y)=>(x<0||y<0||x>=W||y>=H)?0:d[y*W+x];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(d[i])d[i]=Math.min(d[i],at(x-1,y)+1,at(x,y-1)+1,at(x-1,y-1)+1.414,at(x+1,y-1)+1.414);}
 for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;if(d[i])d[i]=Math.min(d[i],at(x+1,y)+1,at(x,y+1)+1,at(x+1,y+1)+1.414,at(x-1,y+1)+1.414);}return d;}
function Sprite(W,H){
 const N=W*H,vis=new Int16Array(N).fill(-1),parts=[],groups={},deco=[];let zc=0;const S={W,H};
 S.add=(test,m,o,bb)=>{o=o||{};let p;if(o.g!==undefined&&groups[o.g]!==undefined)p=parts[groups[o.g]];else{p={id:parts.length,m,o,mask:new Uint8Array(N)};parts.push(p);if(o.g!==undefined)groups[o.g]=p.id;}
  p.z=zc++;const x0=Math.max(0,Math.floor(bb[0])),y0=Math.max(0,Math.floor(bb[1])),x1=Math.min(W-1,Math.ceil(bb[2])),y1=Math.min(H-1,Math.ceil(bb[3]));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const cx=x+.5,cy=y+.5;if(o.clip&&!o.clip(cx,cy))continue;if(test(cx,cy)){const i=y*W+x;p.mask[i]=1;vis[i]=p.id;}}return S;};
 S.ell=(cx,cy,rx,ry,m,o)=>S.add((x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1,m,o,[cx-rx-1,cy-ry-1,cx+rx+1,cy+ry+1]);
 S.rect=(a,b,c,d,m,o)=>S.add((x,y)=>x>=a&&x<=c+1&&y>=b&&y<=d+1,m,o,[a-1,b-1,c+1,d+1]);
 S.poly=(P,m,o)=>{const xs=P.map(p=>p[0]),ys=P.map(p=>p[1]);return S.add((x,y)=>inPoly(P,x,y),m,o,[Math.min(...xs)-1,Math.min(...ys)-1,Math.max(...xs)+1,Math.max(...ys)+1]);};
 S.path=(P,r0,r1,m,o)=>{const seg=[];let tot=0;for(let i=1;i<P.length;i++){const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);seg.push([P[i-1],P[i],tot,l]);tot+=l;}
  const rm=Math.max(r0,r1),xs=P.map(p=>p[0]),ys=P.map(p=>p[1]);
  return S.add((x,y)=>{for(const [a,b,s0,l] of seg){const dx=b[0]-a[0],dy=b[1]-a[1];let t=l?((x-a[0])*dx+(y-a[1])*dy)/(l*l):0;t=t<0?0:t>1?1:t;const g=tot?(s0+t*l)/tot:0,r=r0+(r1-r0)*g;if((x-a[0]-dx*t)**2+(y-a[1]-dy*t)**2<=r*r)return true;}return false;},m,o,[Math.min(...xs)-rm-1,Math.min(...ys)-rm-1,Math.max(...xs)+rm+1,Math.max(...ys)+rm+1]);};
 S.cap=(a,b,c,d,r0,r1,m,o)=>S.path([[a,b],[c,d]],r0,r1,m,o);
 S.bez=(P,r0,r1,m,o)=>{const Q=[];for(let i=0;i<=22;i++)Q.push(bezPt(P,i/22));return S.path(Q,r0,r1,m,o);};
 S.erase=(test)=>{for(let i=0;i<N;i++){const x=i%W,y=(i/W)|0;if(test(x+.5,y+.5)){vis[i]=-1;for(const p of parts)p.mask[i]=0;}}return S;};
 S.eraseEll=(cx,cy,rx,ry)=>S.erase((x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1);
 S.style=(k)=>{S.smooth=k;return S;};S.mark=()=>S;
 S.px=(c,l)=>{deco.push(['px',c,l]);return S;};
 S.line=(a,b,c,d,col)=>{deco.push(['px',col,bres(a,b,c,d)]);return S;};
 S.lineIn=(a,b,c,d,col,m)=>{deco.push(['in',col,bres(a,b,c,d),m]);return S;};
 S.dot=(cx,cy,rx,ry,c)=>{const l=[];for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1)l.push([x,y]);deco.push(['px',c,l]);return S;};
 S.render=()=>{
  // Übergänge: Nähte zwischen Teilen aus demselben Material. Kurze Nähte quer über ein Glied (≤ 1,5 × Breite des schmaleren Teils + 1) sind Gelenke:
  // keine Linie, kein Schlagschatten, Kerben in der Kontur gefüllt, Ton über die Naht geglättet. Längere Nähte (Glied vor Körper) werden weich (Ton 1 statt Kontur).
  const sm=S.smooth,nb4=[[0,-1],[-1,0],[1,0],[0,1]];let J=null,SJ=null,SS=null;
  if(sm){
   for(const p of parts){const d=dist(p.mask,W,H);let mx=0,ar=0;for(let i=0;i<N;i++)if(p.mask[i]){ar++;if(d[i]>mx)mx=d[i];}p.mx=mx;p.ar=ar;}
   const ovl=(a,b)=>{const A=parts[a].mask,B=parts[b].mask;let n=0;for(let i=0;i<N;i++)if(A[i]&&B[i])n++;return n/Math.max(1,Math.min(parts[a].ar,parts[b].ar));},OV={};
   const up=new Int32Array(N).fill(-1);
   for(let i=0;i<N;i++){const pid=vis[i];if(pid<0)continue;const p=parts[pid],x=i%W,y=(i/W)|0;
    for(const [dx,dy] of nb4){const a=x+dx,b=y+dy;if(a<0||b<0||a>=W||b>=H)continue;const q=vis[b*W+a];if(q<0||q===pid)continue;const Q=parts[q];if(Q.z>p.z&&Q.o.line!==false){if(Q.m===p.m&&!Q.o.hard&&!p.o.hard)up[i]=q;break;}}}
   J=new Set();SJ=new Uint8Array(N);SS=new Uint8Array(N);const seen=new Uint8Array(N);
   for(let i=0;i<N;i++){if(up[i]<0||seen[i])continue;const q=up[i],pid=vis[i],st=[i],comp=[];seen[i]=1;
    while(st.length){const k=st.pop();comp.push(k);const x=k%W,y=(k/W)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const a=x+dx,b=y+dy;if(a<0||b<0||a>=W||b>=H)continue;const j=b*W+a;if(!seen[j]&&up[j]===q&&vis[j]===pid){seen[j]=1;st.push(j);}}}
    const ok2=pid+'|'+q;if(OV[ok2]===undefined)OV[ok2]=ovl(pid,q);const joint=sm==='fur'&&OV[ok2]<=.4&&comp.length<=3*Math.min(parts[pid].mx,parts[q].mx)+1;
    if(joint){J.add(pid+'|'+q);J.add(q+'|'+pid);}for(const k of comp)(joint?SJ:SS)[k]=1;}
   for(let pass=0;pass<2;pass++){const add=[];
    for(let i=0;i<N;i++){if(vis[i]>=0)continue;const x=i%W,y=(i/W)|0,cnt={};let n=0;
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const a=x+dx,b=y+dy;if(a<0||b<0||a>=W||b>=H)continue;const q=vis[b*W+a];if(q<0)continue;n++;cnt[q]=(cnt[q]||0)+1;}
     if(n<4)continue;const ks=Object.keys(cnt);let best=-1;
     for(let u=0;u<ks.length;u++)for(let v=u+1;v<ks.length;v++)if(J.has(ks[u]+'|'+ks[v])){const w=cnt[ks[u]]>=cnt[ks[v]]?+ks[u]:+ks[v];if(best<0||cnt[w]>cnt[best])best=w;}
     if(best>=0)add.push([i,best]);}
    for(const [i,q] of add){vis[i]=q;parts[q].mask[i]=1;}
    if(!add.length)break;}
  }
  for(const p of parts){const d=dist(p.mask,W,H);let mx=0;for(let i=0;i<N;i++)if(p.mask[i]&&d[i]>mx)mx=d[i];
   const Rr=Math.max(1,p.o.R!==undefined?p.o.R:mx*(p.o.round!==undefined?p.o.round:1)),h=new Float32Array(N);
   for(let i=0;i<N;i++)if(p.mask[i]){const u=Math.min(d[i],Rr)/Rr;h[i]=Rr*Math.sqrt(1-(1-u)*(1-u));}p.d=d;p.h=h;p.Rr=Rr;}
  const mat=new Array(N).fill(null),tone=new Int8Array(N),col=new Array(N).fill(null),cl=t=>t<1?1:t>5?5:t;
  for(let i=0;i<N;i++){const pid=vis[i];if(pid<0)continue;const p=parts[pid],o=p.o,x=i%W,y=(i/W)|0;let t;
   if(o.flat!==undefined)t=o.flat;
   else if(o.emit){const u=Math.min(p.d[i],p.Rr)/p.Rr;t=u>.72?5:u>.46?4:u>.22?3:2;}
   else{const hv=(a,b)=>(a<0||b<0||a>=W||b>=H)?0:p.h[b*W+a];const nx=-(hv(x+1,y)-hv(x-1,y))/2,ny=-(hv(x,y+1)-hv(x,y-1))/2,nl=Math.hypot(nx,ny,1);
    const I=(nx*LV[0]+ny*LV[1]+LV[2])/nl+(o.bias||0);t=I>=.95?5:I>=.8?4:I>=.56?3:I>=.3?2:1;
    for(const [dx,dy] of [[-1,-1],[-2,-2],[-1,-2],[-2,-1]]){const a=x+dx,b=y+dy;if(a<0||b<0)continue;const q=vis[b*W+a];if(q>=0&&q!==pid&&parts[q].z>p.z&&parts[q].o.line!==false&&!parts[q].o.noCast&&!(J&&J.has(pid+'|'+q))){t-=1;break;}}}
   if(o.tex)t+=o.tex(x,y)||0;mat[i]=p.m;tone[i]=cl(t);col[i]=R[p.m][tone[i]];}
  if(J&&J.size){const band=new Set(),ok=(pid,q)=>q>=0&&(q===pid||J.has(pid+'|'+q));
   for(let i=0;i<N;i++){if(!SJ[i])continue;band.add(i);const x=i%W,y=(i/W)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const a=x+dx,b=y+dy;if(a<0||b<0||a>=W||b>=H)continue;const j=b*W+a;if(ok(vis[i],vis[j]))band.add(j);}}
   const t2=new Map();for(const i of band){const pid=vis[i],x=i%W,y=(i/W)|0;let s=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const a=x+dx,b=y+dy;if(a<0||b<0||a>=W||b>=H)continue;const j=b*W+a;if(ok(pid,vis[j])&&tone[j]>0){s+=tone[j];n++;}}if(n)t2.set(i,cl(Math.round(s/n)));}
   for(const [i,t] of t2){if(parts[vis[i]].o.flat!==undefined)continue;tone[i]=t;col[i]=R[mat[i]][t];}}
  const lc=new Array(N).fill(null);
  for(let i=0;i<N;i++){const pid=vis[i];if(pid<0)continue;const p=parts[pid],x=i%W,y=(i/W)|0;
   for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){const a=x+dx,b=y+dy;if(a<0||b<0||a>=W||b>=H)continue;const q=vis[b*W+a];if(q<0||q===pid)continue;const Q=parts[q];if(Q.z>p.z&&Q.o.line!==false){if(SJ&&SJ[i])break;if(SS&&SS[i]&&sm==='fur'){if(tone[i]>1&&p.o.flat===undefined)lc[i]=R[p.m][tone[i]-1];break;}lc[i]=(SS&&SS[i])?R[p.m][1]:Q.o.soft?R[p.m][1]:R[Q.m][0];break;}}}
  for(let i=0;i<N;i++)if(lc[i]){col[i]=lc[i];tone[i]=0;}
  const oc=new Array(N).fill(null);
  for(let i=0;i<N;i++){if(vis[i]>=0)continue;const x=i%W,y=(i/W)|0;
   for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){const a=x+dx,b=y+dy;if(a<0||b<0||a>=W||b>=H)continue;const q=vis[b*W+a];if(q>=0&&!parts[q].o.noOut){oc[i]=R[parts[q].m][0];break;}}}
  for(let i=0;i<N;i++)if(oc[i])col[i]=oc[i];
  for(const p of parts){if(!p.o.fade)continue;const [f0,f1]=p.o.fade;
   for(let i=0;i<N;i++){const x=i%W,y=(i/W)|0;if(y<=f0)continue;const own=vis[i]===p.id;let near=false;
    if(!own&&oc[i])for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){const a=x+dx,b=y+dy;if(a>=0&&b>=0&&a<W&&b<H&&vis[b*W+a]===p.id){near=true;break;}}
    if(!own&&!near)continue;if((BAY[y%4][x%4]+.5)/16<(y-f0)/(f1-f0)){col[i]=null;mat[i]=null;}}}
  const res=c=>c==='.'?null:c[0]==='#'?c:R[c.split(':')[0]][+c.split(':')[1]];
  for(const [k,a,b,m] of deco){const cc=res(a);for(const [x,y] of b){if(x<0||y<0||x>=W||y>=H)continue;const i=y*W+x;
   if(k==='px'){col[i]=cc;tone[i]=0;}else if(k==='in'){if(!mat[i]||tone[i]===0)continue;if(m&&mat[i]!==m)continue;col[i]=cc;}}}
  return {w:W,h:H,col};};
 return S;}
function enc(img){const pal=[],idx={},r=[];for(let y=0;y<img.h;y++){let s='',prev=null,run=0;
 for(let x=0;x<img.w;x++){const c=img.col[y*img.w+x];let ch='.';if(c){if(idx[c]===undefined){if(pal.length>=ALPHA.length)throw new Error('Palette voll');idx[c]=ALPHA[pal.length];pal.push(c);}ch=idx[c];}
  if(ch===prev)run++;else{if(run)s+=prev+(run>1?run:'');prev=ch;run=1;}}
 if(run)s+=prev+(run>1?run:'');r.push(s.replace(/\.\d*$/,''));}return {w:img.w,h:img.h,p:pal,r};}
const MI=(W)=>(P)=>P.map(([x,y])=>[W-x,y]);


Object.assign(R,{
zSkin:['#1e2a22','#34463a','#4d6453','#6a826c','#8ea68c','#bccab4'],
ice:['#1a3550','#2a5a82','#3f86b3','#66b3dc','#9fd8f2','#e2f7ff'],
shell:['#0f1f24','#16353d','#1f4f5a','#2c6d78','#46949b','#7ec2c0'],
pale:['#4a3c44','#8a7a84','#b8a8b0','#d8cad0','#eee4e8','#fffafc'],
cloak:['#120a14','#221226','#341a38','#4a2450','#62306a','#7c3e86'],
witchG:['#1c2e14','#2f4a1f','#46692c','#62893c','#86ab55','#b4d07e'],
toad:['#2a2410','#4a4219','#6b6224','#8e8433','#b3a94c','#d8cf78'],
fireS:['#3a0c0a','#7a1c10','#b8381a','#e8642a','#ffa04a','#ffe0a0']});
// Feine Pixel-Figur + Gefährten im Stil der Dungeon-Gegner. Figur 54×81, Kopf-Ausschnitt 34×34, Gefährte 40×40.
// Feine Pixel-Figur + Gefährten im Stil der Dungeon-Gegner. Figur 54×81, Kopf-Ausschnitt 34×34, Gefährte 40×40.
// Feine Pixel-Figur + Gefährten im Stil der Dungeon-Gegner. Figur 54×81, Kopf-Ausschnitt 34×34, Gefährte 40×40.
const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const toH=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mixc=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function ramp(base){const b=hx(base),D=[34,20,48],L=[255,248,226];return [toH(mixc(b,D,.8)),toH(mixc(b,D,.55)),toH(mixc(b,D,.28)),toH(b),toH(mixc(b,L,.34)),toH(mixc(b,L,.66))];}
const SKIN=['#f7d7bf','#efc3a4','#e0a882','#c98c64','#ab6e49','#8c5537','#6e3f28','#4f2c1d','#9ed8b0','#7fb86a','#9cc8f0','#6f94d8','#b9a2ec','#f0a8c8','#a6a8b8','#e8c26a'];
const HAIR=['#2b2233','#4a3226','#7a4a2a','#b0703a','#e0b050','#efdcae','#b8442e','#e27aa0','#6d86e6','#6cc59a','#9c9cab','#f2f2f6'];
const CLOTH=['#6a4fc8','#3f86b3','#4f9a5a','#cc4455','#e0a82e','#e8783a','#3d414f','#e6dfcc','#d06a9a','#2a8a8a','#8a5a3a','#28356a'];
const IRIS=['#3f86b3','#4f9a5a','#7a4a2a','#6a4fc8','#2b2233','#cc4455','#e0a82e','#9c9cab'];
const HAIRS=['kurz','stachel','lang','zopf','dutt','locken','scheitel','iro','glatze','bob','zoepfe','wuschel','afro','undercut','emo','halblang','seitenzopf','palme','wellen','stoppel'];
const HAIR_N=['Kurz','Stachelig','Lang','Pferdeschwanz','Dutt','Locken','Seitenscheitel','Irokese','Glatze','Bob','Zöpfe','Wuschel','Afro','Undercut','Seitenpony','Halblang','Seitenzopf','Palme','Wellen','Stoppel'];
const EYES=['rund','gross','schmal','froh','muede','wach','zwinkern','wimpern','katze','punkte','brille','glitzer'],EYES_N=['Rund','Groß','Schmal','Fröhlich','Müde','Wach','Zwinkern','Wimpern','Katzenaugen','Punktaugen','Brille','Glitzer'];
const MOUTHS=['laecheln','grinsen','offen','neutral','frech','schief','breit','zahnluecke','katze','schmollen','zaehne','fang'],MOUTH_N=['Lächeln','Grinsen','Staunen','Neutral','Frech','Schief','Lachen','Zahnlücke','Katzenmund','Schmollen','Zähne zeigen','Eckzahn'];
const TOPS=['shirt','hoodie','tunika','weste','mantel','kleid','ringel','latz','jacke','polo','sport','karo','bluse','rueschen','strickjacke','sommerkleid'],TOPS_N=['T-Shirt','Hoodie','Tunika','Weste','Umhang','Kleid','Ringelpulli','Latzhose','Jacke','Polo','Trikot','Karohemd','Bluse','Rüschentop','Strickjacke','Sommerkleid'];
const PANTS=['hose','shorts','rock','pluder','leggings','jeans','cargo','sport','karo','flicken','kniebund','schlag','faltenrock','tuellrock','jeansrock','glockenrock'],PANTS_N=['Hose','Shorts','Rock','Pluderhose','Leggings','Jeans','Cargohose','Sporthose','Karohose','Flickenhose','Kniebundhose','Schlaghose','Faltenrock','Tüllrock','Jeansrock','Glockenrock'];
const PRE=[
 {skin:1,hair:0,hairC:1,eyes:0,iris:0,mouth:0,top:1,topC:0,top2C:7,pants:0,pantsC:6,build:1},
 {skin:0,hair:2,hairC:4,eyes:1,iris:1,mouth:4,top:2,topC:2,pants:5,pantsC:1,build:0},
 {skin:4,hair:5,hairC:0,eyes:3,iris:2,mouth:1,top:0,topC:5,pants:1,pantsC:6,build:1},
 {skin:2,hair:1,hairC:6,eyes:5,iris:0,mouth:1,top:6,topC:1,top2C:7,pants:5,pantsC:6,build:2},
 {skin:6,hair:4,hairC:0,eyes:1,iris:4,mouth:0,top:5,topC:8,pants:2,pantsC:8,build:0},
 {skin:3,hair:3,hairC:2,eyes:0,iris:1,mouth:2,top:3,topC:3,top2C:7,pants:0,pantsC:1,build:1},
 {skin:1,hair:7,hairC:9,eyes:2,iris:3,mouth:5,top:4,topC:9,top2C:7,pants:3,pantsC:6,build:1},
 {skin:5,hair:9,hairC:8,eyes:4,iris:2,mouth:3,top:7,topC:7,top2C:4,pants:0,pantsC:1,build:1},
 {skin:7,hair:8,hairC:0,eyes:5,iris:1,mouth:0,top:0,topC:2,pants:4,pantsC:6,build:2},
 {skin:0,hair:10,hairC:7,eyes:3,iris:3,mouth:4,top:1,topC:4,pants:2,pantsC:0,build:0}];
const GEAR={none:{},schwert:{weapon:{type:'schwert',which:'past'}},speer:{weapon:{type:'speer',which:'past'},head:'past'},voll:{weapon:{type:'speer',which:'past'},head:'past',body:'pp',legs:'past',arms:'past'},goldspeer:{weapon:{type:'speer',which:'pp'},head:'past'}};

function hero(c){
 c=Object.assign({skin:1,hair:0,hairC:1,eyes:0,iris:0,mouth:0,top:0,topC:0,top2C:7,pants:0,pantsC:6,build:1,blush:true,gear:{}},c);
 R.skin=ramp(SKIN[c.skin]);R.hair=ramp(HAIR[c.hairC]);R.top=ramp(CLOTH[c.topC]);R.top2=ramp(CLOTH[c.top2C]);R.pants=ramp(CLOTH[c.pantsC]);R.iris=ramp(IRIS[c.iris]);R.boots=R.leather;R.blush=ramp('#ef8f8f');
 const fc=c.face||0,g=c.gear||{},A=g.body?(g.body==='pp'?'gold':'steel'):null,S=Sprite(c.W||54,81).style('soft'),bw=[9.5,10.5,12][c.build],cx=27,H=HAIRS[c.hair],T=TOPS[c.top],P=PANTS[c.pants];
 const PO=c.pose||{},PX=(PO.hx||0)*(fc||1),PY=PO.hy||0,LX=(PO.lx||0)*(fc||1),LY=PO.ly||0;let BOW=null;
 // Kampfansicht (fc ≠ 0): Hinterhaar rückt 2 px zum Hinterkopf (bk). Bei diesen Frisuren wandern die Haarteile der abgewandten Seite (Schläfe, Strähne, Zopf) hinter den Kopf.
 const bk=fc?-2*fc:0,BX=Q=>Q.map(p=>[p[0]+bk,p[1]]),FAR=!!fc&&['lang','dutt','iro','bob','zoepfe','afro','halblang','wellen'].includes(H),FX=x=>cx+fc*(x-cx)+bk;let MK='body';const mk=k=>{MK=k;S.mark(k);};mk('hairB');
 if(H==='lang')S.poly(BX([[14,15],[40,15],[42,46],[36,42],[27,44],[18,42],[12,46]]),'hair');
 if(H==='bob')S.ell(27+bk,19,14.5,12.5,'hair');
 if(H==='zopf'&&!PO.lie){const m=x=>fc>0?54-x:x;S.bez([[m(37),11],[m(47),13],[m(48),27],[m(44),38]],4.4,2.6,'hair');}
 if(H==='afro')S.ell(27+bk,13.5,16,13,'hair').ell(27+bk,19.5,15.3,7.6,'hair');
 if(H==='halblang')S.poly(BX([[14,15],[40,15],[41,34],[35,32],[27,33],[19,32],[13,34]]),'hair');
 if(H==='wellen')S.poly(BX([[14,15],[40,15],[42,24],[40,30],[43,37],[40,44],[42,50],[34,46],[27,48],[20,46],[12,50],[14,44],[11,37],[14,30],[12,24]]),'hair');
 if(FAR&&H!=='iro')S.poly([[FX(39.7),12],[FX(35.8),12],[FX(36.6),19],[FX(39),19]],'hair');
 if(FAR&&H==='zoepfe'&&!PO.lie){S.cap(FX(39),17,FX(40.4),27,1.8,2,'hair');for(let k=0;k<4;k++)S.ell(FX(40.4),28+k*4,2.4,2.3,'hair');S.ell(FX(40.4),44,1.6,1.4,'red');}
 mk('torso');if(T==='mantel')S.poly([[cx-bw-1,36],[cx+bw+1,36],[cx+bw+6,73],[cx-bw-6,73]],'top',{round:.5});
 const skirt=['rock','faltenrock','tuellrock','jeansrock','glockenrock'].includes(P),short=P==='shorts',baggy=P==='pluder',thin=P==='leggings',lr=thin?3:baggy?4.6:3.8,legM=(skirt||short)?'skin':'pants';
 const bm=g.legs?(g.legs==='pp'?'gold':'steel'):'boots',fs=fc?Math.sign(fc):1,FB=o=>Object.assign({},o||{},{bias:((o&&o.bias)||0)-.3});
 const leg=(s,far)=>{mk(far?'legF':(fc?'legN':(s<0?'legN':'legF')));const q=far?FB:(o=>o),d=fc?(far?-fs*3:fs):0,dy=far?-1:0,x0=(s<0?22:32)+d,x1=(s<0?21.5:32.5)+d;
  S.cap(x0,58,x1,73+dy,lr,lr-.4,legM,q());
  if(short)S.cap(x0,58,x1-.2*s,64,4.1,4,'pants',q({g:far?'shF':'sh'}));
  if(baggy)S.rect(x1-4,70+dy,x1+4,72+dy,'pants',q({bias:-.2}));
  if(P==='jeans')S.lineIn(x1-2.5*s,60,x1-2.5*s,72,'pants:2','pants');
  if(P==='cargo')S.rect(x1+s*1.4-1.6,62+dy,x1+s*1.4+1.6,66+dy,'pants',q({bias:.12}));
  if(P==='sport')S.lineIn(x1+s*2.4,59,x1+s*2.4,72+dy,'eyeW:5','pants');
  if(P==='karo'){[61,65,69].forEach(y=>S.lineIn(x1-3,y+dy,x1+3,y+dy,'pants:1','pants'));S.lineIn(x1,59,x1,72+dy,'pants:4','pants');}
  if(P==='flicken')S.rect(x1-1.7,(s<0?64:60)+dy,x1+1.5,(s<0?67:63)+dy,'top2',q({bias:.1}));
  if(P==='kniebund'){S.cap(x1,67+dy,x1,72+dy,lr-.2,lr-.5,'eyeW',q());S.rect(x1-lr+.6,66+dy,x1+lr-.6,66.8+dy,'gold',q());}
  S.cap(x1,71+dy,x1,75+dy,3.7,3.7,bm,q());S.ell((s<0?21:33)+d+1.8*fc,77.3+dy,4.8+.6*Math.abs(fc),2.7,bm,q());
  if(P==='schlag')S.poly([[x1-lr+.4,66+dy],[x1+lr-.4,66+dy],[x1+lr+1.8,74.5+dy],[x1-lr-1.8,74.5+dy]],'pants',q());};
 if(fc){leg(fs,true);leg(-fs,false);}else{leg(-1,false);leg(1,false);}mk('torso');
 if(short)S.rect(17,57,37,60,'pants',{g:'sh'});
 if(P==='rock')S.poly([[17,55],[37,55],[40,66],[14,66]],'pants',{round:.5});
 if(P==='faltenrock'){S.poly([[17,55],[37,55],[41.5,67],[12.5,67]],'pants',{round:.4});[19,23,27,31,35].forEach(x=>S.lineIn(x,58,27+(x-27)*1.38,66,'pants:2','pants'));S.lineIn(17,57,37,57,'pants:1','pants');}
 if(P==='tuellrock'){S.poly([[17,55],[37,55],[44,62],[41,64.5],[37,63],[33,65],[29,63.5],[25,65],[21,63],[17,64.5],[10,62]],'pants',{round:.7});S.poly([[18.5,56],[35.5,56],[39.5,60.5],[14.5,60.5]],'pants',{line:false,bias:.3});S.px('pants:5',[[15,61],[20,59],[25,62],[30,59],[35,62],[39,60],[27,57]]);}
 if(P==='jeansrock'){S.poly([[17,55],[37,55],[38.5,65],[15.5,65]],'pants',{round:.3});S.lineIn(27,57,27,65,'pants:2','pants').lineIn(19,58,22.5,58,'pants:4','pants').lineIn(31.5,58,35,58,'pants:4','pants').lineIn(16.5,63,37.5,63,'pants:4','pants');S.px('pants:1',[[20,55],[24,55],[30,55],[34,55]]);}
 if(P==='glockenrock'){S.poly([[17,55],[37,55],[42.5,71],[11.5,71]],'pants',{round:.5});S.rect(17,55,37,57,'top2');S.lineIn(12,69,42,69,'pants:4','pants');S.px('pants:1',[[21,62],[27,65],[33,62]]);}
 const sm=['weste','mantel','latz'].includes(T)?'top2':'top',shortS=['shirt','kleid','latz','polo','sport','bluse','rueschen','sommerkleid'].includes(T),am=g.arms?(g.arms==='pp'?'gold':'steel'):null;
 const arm=(s,far)=>{const q=far?FB:(o=>o),d=far?-s*1.8:0,x0=cx+s*(bw+.5)+d,x1=cx+s*(bw+3.5)+d+(s===1?PX:LX),y1=54+(s===1?PY:LY);if(shortS){S.cap(x0,39,x0+s*1.6,46,3.4,3.2,sm,q());S.cap(x0+s*1.6,46,x1,y1,2.6,2.4,'skin',q());}else S.cap(x0,39,x1,y1,3.4,3,sm,q());if(am)S.cap(x0+s*1.2,46,x1,y1-1,3.3,3.1,am,q());if(A)S.ell(x0,38.5,4.6,3.6,A,q());};
 const hand=(s,far)=>S.ell(cx+s*(bw+4.2)+(far?-s*1.8:0)+(s===1?PX:LX),56.3+(s===1?PY:LY),2.8,2.8,'skin',far?{bias:-.3}:undefined);
 const hr=cx+bw+4.2+(fc>0?-1.8:0)+PX;
 const WT=g.weapon?g.weapon.type:null,TILT={speer:.16,stab:.12,bogen:0,dolch:.45},REST_F={axt:.05,hammer:.15,streitkolben:.2},RAD={speer:54,stab:56,axt:36,hammer:36,streitkolben:36,dolch:20},FW=fc<0?-1:1;
 const weapon=()=>{const pm=MK;mk('weapon');weaponX();mk(pm);};const weaponX=()=>{if(g.weapon){const wm=g.weapon.which==='pp'?'gold':'steel',T=WT,F=FW,base=(fc>0&&!c.pose&&REST_F[T]!==undefined)?REST_F[T]:(TILT[T]!==undefined?TILT[T]:.34);
  const wa=fc*(base+(PO.wa||0)),ca=Math.cos(wa),sa=Math.sin(wa),rt=(x,y)=>[hr+(x-hr)*ca-(y-56)*sa,56+PY+(x-hr)*sa+(y-56)*ca],rp=Q=>Q.map(p=>rt(p[0],p[1])),rr=(a,b,c2,d)=>rp([[a,b],[c2,b],[c2,d],[a,d]]),ln=(a,b,c2,d)=>rt(a,b).concat(rt(c2,d)),rpx=(x,y)=>rt(x,y).map(Math.round);
  if(PO.trail&&T!=='bogen'){const px0=hr,py0=56+PY,Rr=RAD[T]||32;
   if(PO.trail==='arc'){const A0=fc*(base+(PO.a0||0)),A1=wa,lo=Math.min(A0,A1),hi=Math.max(A0,A1);
    S.add((x,y)=>{const dx=x-px0,dy=y-py0,r=Math.hypot(dx,dy),an=Math.atan2(dx,-dy);if(an<lo||an>hi)return false;const u=(an-A0)/(A1-A0),th=1+4.5*u;return r<=Rr+.6&&r>=Rr-th;},'eyeW',{flat:5},[px0-Rr-2,py0-Rr-2,px0+Rr+2,py0+Rr+2]);}
   else{const dv=Math.sin(wa),ev=-Math.cos(wa),nx=-ev,ny=dv;(PO.tl||[[-4,8,34],[4,12,38]]).forEach(([o,a,b])=>S.cap(px0+dv*a+nx*o,py0+ev*a+ny*o,px0+dv*b+nx*o,py0+ev*b+ny*o,.6,.6,'eyeW',{flat:5}));}}
  if(T==='speer'){S.cap(...ln(hr,79,hr,12),1.15,1.15,'wood');S.poly(rp([[hr-2.6,13],[hr+2.6,13],[hr,2]]),wm);S.poly(rr(hr-1.5,12.5,hr+2.5,16),'gold');S.lineIn(...ln(hr,4,hr,11),wm+':5',wm);}
  else if(T==='stab'){S.cap(...ln(hr,79,hr,11),1.2,1.2,'wood');S.poly(rr(hr-1.8,40,hr+2.2,42.4),wm);S.poly(rr(hr-2.2,10.5,hr+2.6,13.2),wm);S.path(rp([[hr-2,11],[hr-3.4,6.5],[hr-1.2,3]]),.9,.6,wm);S.path(rp([[hr+2.4,11],[hr+3.8,6.5],[hr+1.6,3]]),.9,.6,wm);{const gr=PO.glow||2.7;S.ell(...rt(hr+.2,6.8),gr,gr,'glowV',{emit:true});S.px('#ffffff',[rpx(hr-.8,5.6)]);if(gr>3){const q=gr+3;S.px('#ffffff',[rpx(hr+.2-q,6.8),rpx(hr+.2+q,6.8),rpx(hr+.2,6.8-q),rpx(hr+.2+q*.7,6.8+q*.7)]);S.px('glowV',[rpx(hr+.2-q-1,6.8),rpx(hr+.2+q+1,6.8),rpx(hr+.2,6.8-q-1),rpx(hr+.2-q*.7,6.8-q*.7)]);}}}
  else if(T==='axt'){S.cap(...ln(hr,63,hr,23.5),1.2,1.1,'wood');S.poly(rp([[hr+F*.5,24.5],[hr+F*4,23.5],[hr+F*9.5,19.5],[hr+F*10.5,26.5],[hr+F*9.5,33.5],[hr+F*4,29.5],[hr+F*.5,28.5]]),wm);S.poly(rp([[hr-F*.5,24.8],[hr-F*4,26.5],[hr-F*.5,28.2]]),wm);S.lineIn(...ln(hr+F*9.6,21,hr+F*10.1,32),wm+':5',wm);S.lineIn(...ln(hr+F*3.5,25,hr+F*3.5,28),wm+':1',wm);S.cap(...ln(hr,55,hr,61),1.5,1.5,'leather');}
  else if(T==='hammer'){S.cap(...ln(hr,63,hr,27.5),1.2,1.1,'wood');S.poly(rp([[hr-5,20.5],[hr+6,20.5],[hr+6,28],[hr-5,28]]),wm);S.poly(rp([[hr-6.2,21.6],[hr-5,21.6],[hr-5,26.9],[hr-6.2,26.9]]),wm);S.lineIn(...ln(hr-3.5,21.5,hr-3.5,27),wm+':1',wm);S.lineIn(...ln(hr+4.5,21.5,hr+4.5,27),wm+':1',wm);S.lineIn(...ln(hr-4,21.5,hr+5,21.5),wm+':5',wm);S.cap(...ln(hr,55,hr,61),1.5,1.5,'leather');}
  else if(T==='streitkolben'){S.cap(...ln(hr,62,hr,30),1.2,1.1,wm);S.cap(...ln(hr,54,hr,61),1.6,1.6,'leather');for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6,ux=Math.cos(a),uy=Math.sin(a),x=hr+ux*4.6,y=25.5+uy*4.6;S.poly(rp([[x-uy*1.4,y+ux*1.4],[x+uy*1.4,y-ux*1.4],[x+ux*2.8,y+uy*2.8]]),wm);}S.ell(...rt(hr,25.5),4.2,4.4,wm);S.poly(rp([[hr-1.2,21.5],[hr+1.2,21.5],[hr,17.5]]),wm);S.px(wm+':5',[rpx(hr-1.4,24)]);}
  else if(T==='dolch'){S.cap(...ln(hr,52,hr,39),1.5,.7,wm);S.lineIn(...ln(hr,41,hr,51),wm+':5',wm);S.poly(rr(hr-3.5,52,hr+4.5,53.8),'gold');S.cap(...ln(hr,55,hr,58.5),1,1,'leather');S.ell(...rt(hr,59.8),1.3,1.3,'gold');}
  else if(T==='bogen'){const lm=g.weapon.which==='pp'?'gold':'wood',t1=[hr-F*8,37],t2=[hr-F*8,75];
   S.bez(rp([t1,[hr+F*3.5,43],[hr+F*3.5,69],t2]),1.5,1.5,lm);S.ell(...rt(...t1),1.25,1.25,wm);S.ell(...rt(...t2),1.25,1.25,wm);S.cap(...ln(hr+F*.6,52.5,hr+F*.6,59.5),1.8,1.8,'leather');
   const T1=rt(...t1),T2=rt(...t2),dr=PO.draw||0,near=[cx-(bw+4.2)+LX,56.3+LY],mid=rt(hr-F*8,56),Pp=[mid[0]+(near[0]-mid[0])*dr,mid[1]+(near[1]-mid[1])*dr];
   S.line(T1[0],T1[1],Pp[0],Pp[1],'cream:5');S.line(Pp[0],Pp[1],T2[0],T2[1],'cream:5');
   BOW=PO.arrow?{P:Pp,tip:rt(hr+F*7,56),wm}:null;}
  else{S.cap(...ln(hr,52,hr,24),2,1.2,wm);S.lineIn(...ln(hr,26,hr,50),wm+':5',wm);S.poly(rr(hr-4.5,52,hr+5.5,54.8),'gold');S.cap(...ln(hr,55,hr,60),1.1,1.1,'leather');S.ell(...rt(hr,61.3),1.6,1.6,'gold');}}};
 const bowFront=()=>{if(!BOW)return;const pm=MK;mk('weapon');const {P,tip,wm}=BOW,dx=tip[0]-P[0],dy=tip[1]-P[1],Lh=Math.hypot(dx,dy)||1,ux=dx/Lh,uy=dy/Lh,nx=-uy,ny=ux;
  S.cap(P[0],P[1],tip[0]-ux*3,tip[1]-uy*3,.6,.6,'wood');S.poly([[tip[0]-ux*3.5+nx*1.8,tip[1]-uy*3.5+ny*1.8],[tip[0]+ux*1.2,tip[1]+uy*1.2],[tip[0]-ux*3.5-nx*1.8,tip[1]-uy*3.5-ny*1.8]],wm);
  S.poly([[P[0]+ux*.5,P[1]+uy*.5],[P[0]+ux*4+nx*1.9,P[1]+uy*4+ny*1.9],[P[0]+ux*5.5,P[1]+uy*5.5],[P[0]+ux*4-nx*1.9,P[1]+uy*4-ny*1.9]],'red');mk(pm);};
 if(fc){mk('armF');if(fc>0){arm(1,true);weapon();hand(1,true);}else{arm(-1,true);hand(-1,true);}}mk('torso');
 const tb=(T==='latz'||T==='weste'||T==='strickjacke')?'top2':'top';
 S.poly([[cx-bw,37],[cx+bw,37],[cx+bw+1,59],[cx-bw-1,59]],tb,{g:'t',round:.55}).ell(cx-bw+1.5,38.5,3.4,3,tb,{g:'t'}).ell(cx+bw-1.5,38.5,3.4,3,tb,{g:'t'});
 if(T==='kleid')S.poly([[cx-bw,50],[cx+bw,50],[cx+bw+6,70],[cx-bw-6,70]],'top',{g:'t',round:.5});
 if(T==='tunika')S.poly([[cx-bw-1,52],[cx+bw+1,52],[cx+bw+3,64],[cx-bw-3,64]],'top',{g:'t'});
 if(T==='hoodie'){S.ell(cx,34,10,4.2,'top',{bias:-.1});S.lineIn(cx-5,50,cx+5,50,'top:1','top').lineIn(cx-5,50,cx-6,56,'top:1','top').lineIn(cx+5,50,cx+6,56,'top:1','top');S.px('top2:5',[[cx-2,38],[cx-2,39],[cx-2,40],[cx+2,38],[cx+2,39],[cx+2,40]]);}
 if(T==='weste'){S.poly([[cx-bw,37],[cx-2,37],[cx-3,58],[cx-bw-1,58]],'top').poly([[cx+bw,37],[cx+2,37],[cx+3,58],[cx+bw+1,58]],'top');S.px('gold:4',[[cx-4,45],[cx-4,50]]);}
 if(T==='ringel')for(let y=41;y<=57;y+=4)S.lineIn(cx-bw-1,y,cx+bw+1,y,'top2:4','top');
 if(T==='latz'){S.rect(cx-6,43,cx+6,58,'pants');S.cap(cx-6,43,cx-8,37.5,1,1,'pants').cap(cx+6,43,cx+8,37.5,1,1,'pants');S.px('gold:4',[[cx-5,44],[cx+5,44]]).lineIn(cx-3,48,cx+3,48,'pants:2','pants');}
 if(T==='jacke'){S.rect(cx-2.5,38,cx+2.5,58,'top2');S.poly([[cx-3,37],[cx-7.5,37],[cx-3,44]],'top').poly([[cx+3,37],[cx+7.5,37],[cx+3,44]],'top');S.px('gold:4',[[cx-5,50],[cx+5,50]]);}
 if(T==='polo'){S.poly([[cx-4.5,36.5],[cx-.5,39],[cx-2,41.5]],'top2').poly([[cx+4.5,36.5],[cx+.5,39],[cx+2,41.5]],'top2');S.px('top2:5',[[cx,43],[cx,46]]);}
 if(T==='sport'){S.lineIn(cx-bw+1,40,cx-bw+1,58,'top2:4','top').lineIn(cx+bw-1,40,cx+bw-1,58,'top2:4','top');S.px('eyeW:5',[[cx-2,44],[cx-1,44],[cx,44],[cx+1,44],[cx+1,45],[cx,46],[cx,47],[cx-1,48],[cx-1,49]]);}
 if(T==='karo'){[42,46,50,54].forEach(y=>S.lineIn(cx-bw-1,y,cx+bw+1,y,'top:1','top'));[cx-4,cx+4].forEach(x=>S.lineIn(x,38,x,58,'top:4','top'));S.px('top2:5',[[cx,41],[cx,45],[cx,49]]);}
 if(T==='bluse'){S.poly([[cx-bw-1,52],[cx+bw+1,52],[cx+bw+2.6,58.6],[cx-bw-2.6,58.6]],'top',{g:'t'});S.poly([[cx-5.5,36.5],[cx-.5,39],[cx-1.5,42],[cx-6.5,39.5]],'eyeW').poly([[cx+5.5,36.5],[cx+.5,39],[cx+1.5,42],[cx+6.5,39.5]],'eyeW');S.px('top:1',[[cx,44],[cx,48],[cx,52]]);S.lineIn(cx-bw,52,cx+bw,52,'top:1','top');}
 if(T==='rueschen'){[44,49,54].forEach(y=>{S.lineIn(cx-bw,y,cx+bw,y,'top:4','top');for(let x=Math.ceil(cx-bw);x<=cx+bw;x+=2)S.px('top:2',[[x,y+1]]);});S.px('top2:5',[[cx-1,40],[cx+1,40],[cx,41]]);}
 if(T==='strickjacke'){S.poly([[cx-bw,37],[cx-2.5,37],[cx-3,59],[cx-bw-1,59]],'top').poly([[cx+bw,37],[cx+2.5,37],[cx+3,59],[cx+bw+1,59]],'top');S.px('top2:5',[[cx-4,44],[cx-4,48],[cx-4,52]]);S.lineIn(cx-bw,57,cx-4,57,'top:1','top').lineIn(cx+4,57,cx+bw,57,'top:1','top').lineIn(cx-bw+1,51,cx-6,51,'top:1','top');S.px('red:3',[[cx-1,45],[cx+1,45],[cx-1,46],[cx,46],[cx+1,46],[cx,47]]);}
 if(T==='sommerkleid'){S.poly([[cx-bw,50],[cx+bw,50],[cx+bw+8,71],[cx-bw-8,71]],'top',{g:'t',round:.5});S.rect(cx-bw-.5,49,cx+bw+.5,51.5,'top2');S.poly([[cx+3,48],[cx+7,46.5],[cx+7,53.5],[cx+3,52]],'top2');S.px('top:5',[[cx-6,56],[cx+2,58],[cx-3,62],[cx+6,63],[cx-8,66],[cx+1,67],[cx+9,68],[cx-4,44],[cx+4,42]]);}
 if(T==='tunika'||T==='kleid'||T==='mantel')S.rect(cx-bw-1,54,cx+bw+1,56,'leather').rect(cx-1.5,53.5,cx+1.5,56.5,'gold');
 if(T==='mantel')S.ell(cx,37.8,2,2,'gold');
 if(A){S.poly([[cx-bw+1,39],[cx+bw-1,39],[cx+bw-1.5,55],[cx-bw+1.5,55]],A,{round:.6});S.lineIn(cx,40,cx,54,A+':1',A);S.rect(cx-bw,54,cx+bw,56,'leather');}
 if(fc>=0){bowFront();mk('armN');arm(-1);hand(-1);mk('torso');}
 S.rect(24,31,30,36,'skin',{bias:-.35});
 if(['shirt','ringel','kleid','latz','sport','rueschen','sommerkleid'].includes(T))S.poly([[cx-3.5,36.5],[cx+3.5,36.5],[cx,40.5]],'skin',{bias:-.2});
 mk('head');if(!fc)S.ell(15.6,21.5,2.3,3,'skin',{hard:true}).ell(38.4,21.5,2.3,3,'skin',{hard:true});
 S.ell(cx,19.5,fc?11.45:11.5,12,'skin',{g:'hd'}).ell(cx,24.8,9.6,7.4,'skin',{g:'hd'});
 if(fc){const ex=fc>0?18.2:35.8,er=Math.round(ex)-(fc>0?0:1);S.ell(ex,22,2.1,2.8,'skin',{nw:true,hard:true});S.rect(er,22,er,23,'skin',{nw:true,flat:1});}
 const E=PO.eyes||EYES[c.eyes];[22.5,31.5].forEach(x=>{const X=Math.round(x),hi=[X-1,20];
  if(E==='au'){if(x<27)S.px('void:1',[[X-2,20],[X-1,21],[X,21],[X-2,22]]);else S.px('void:1',[[X+1,20],[X-1,21],[X,21],[X+1,22]]);}
  if(E==='rund'){S.dot(x,21.6,1.4,1.9,'void:1');S.px('#ffffff',[hi]);}
  if(E==='gross'){S.dot(x,21.5,2,2.5,'void:1');S.dot(x+.2,22.6,1.2,1.1,'iris:4');S.px('#ffffff',[[X-1,20],[X-1,21]]);}
  if(E==='schmal')S.line(X-2,22,X+1,22,'void:1').px('void:1',[[X+1,21]]);
  if(E==='froh')S.px('void:1',[[X-2,22],[X-1,21],[X,21],[X+1,22]]);
  if(E==='muede'){S.dot(x,22.3,1.4,1.2,'void:1');S.line(X-2,21,X+1,21,'skin:1');S.px('#ffffff',[[X-1,22]]);}
  if(E==='wach'){S.dot(x,21.6,1.5,2,'iris:2');S.px('void:1',[[X,22],[X-1,22]]).px('#ffffff',[hi]).px('void:1',[[X+1,19],[X+2,19]]);}
  if(E==='zwinkern'){if(x<27){S.dot(x,21.6,1.4,1.9,'void:1');S.px('#ffffff',[hi]);}else S.px('void:1',[[X-2,21],[X-1,22],[X,22],[X+1,21]]);}
  if(E==='wimpern'){S.dot(x,21.6,1.4,1.9,'void:1');S.px('#ffffff',[hi]);S.px('void:1',x<27?[[X-2,19],[X-3,18]]:[[X+1,19],[X+2,18]]);}
  if(E==='katze'){S.dot(x,21.8,1.9,1.4,'iris:3');S.line(X-1,20,X-1,22,'void:1');}
  if(E==='punkte')S.px('void:1',[[X-1,21],[X-1,22]]);
  if(E==='ko')S.px('void:1',[[X-2,20],[X,20],[X-1,21],[X-2,22],[X,22]]);
  if(E==='brille'){S.dot(x,21.6,1.2,1.6,'void:1');S.px('#ffffff',[[X-1,21]]);S.line(X-3,19,X+1,19,'void:2').line(X-3,24,X+1,24,'void:2').line(X-3,19,X-3,24,'void:2').line(X+1,19,X+1,24,'void:2');if(x<27)S.line(X+2,21,X+5,21,'void:2');}
  if(E==='glitzer'){S.dot(x,21.5,2,2.5,'iris:1');S.dot(x+.2,22.4,1.2,1.2,'iris:3');S.px('#ffffff',[[X-2,20],[X-1,20],[X-2,21],[X,23]]);}});
 const bc=H==='glatze'?'skin:1':'hair:1';if(!PO.lie)S.line(20,18,24,18,bc).line(30,18,34,18,bc);
 S.px('skin:2',[[27,24]]);if(c.blush)S.dot(fc<0?22:19.5,25.5,1.5,.9,'blush:3').dot(fc>0?32:34.5,25.5,1.5,.9,'blush:3');
 const M=PO.mouth||MOUTHS[c.mouth],mc='skin:0';
 if(M==='laecheln')S.line(25,27,29,27,mc).px(mc,[[24,26],[30,26]]);
 if(M==='grinsen')S.line(24,27,30,27,mc).line(25,28,29,28,'eyeW:5').line(25,29,29,29,mc);
 if(M==='offen')S.dot(27,28,1.4,1.6,'mouthIn:3').px('tongue:3',[[27,29]]);
 if(M==='neutral')S.line(25,28,29,28,mc);
 if(M==='frech')S.line(25,27,29,27,mc).px(mc,[[24,26],[30,26]]).px('tongue:3',[[28,28],[29,28]]);
 if(M==='schief')S.line(25,28,28,28,mc).px(mc,[[29,27],[30,26]]);
 if(M==='breit')S.line(24,26,30,26,mc).line(24,27,30,27,'mouthIn:3').line(25,28,29,28,'mouthIn:3').line(26,29,28,29,mc).px(mc,[[23,26],[31,26],[24,28],[30,28],[25,29],[29,29]]).px('tongue:3',[[26,28],[27,28],[28,28]]);
 if(M==='zahnluecke')S.line(24,27,30,27,mc).line(25,28,29,28,'eyeW:5').px('mouthIn:3',[[27,28]]).line(25,29,29,29,mc);
 if(M==='katze')S.px(mc,[[24,27],[25,28],[26,28],[27,27],[28,28],[29,28],[30,27]]);
 if(M==='schmollen')S.line(26,27,28,27,mc).px('blush:3',[[26,28],[27,28],[28,28]]);
 if(M==='zaehne')S.line(24,27,30,27,mc).line(24,28,30,28,'eyeW:5').line(24,29,30,29,mc).px(mc,[[23,28],[31,28],[26,28],[28,28]]);
 if(M==='fang')S.line(25,27,29,27,mc).px(mc,[[24,26],[30,26]]).px('eyeW:5',[[28,28]]);
 const hp=(P)=>S.poly(P,'hair',{g:'hf'});
 const NL=!FAR||fc>0,NR=!FAR||fc<0;
 const top=(ry)=>{S.ell(cx,14.5,12.7,ry,'hair',{g:'hf',clip:(x,y)=>y<=13});if(NL)hp([[14.3,12],[18.2,12],[17.4,19],[15,19]]);if(NR)hp([[39.7,12],[35.8,12],[36.6,19],[39,19]]);};
 const jag=(y0,y1,n)=>{const P=[[14.5,y0]];for(let i=0;i<=n;i++)P.push([14.5+25*i/n,i%2?y0+(y1-y0)*.4:y1]);P.push([39.5,y0]);hp(P);};
 const curtain=()=>hp([[14.5,12],[39.5,12],[39,17],[31,14.5],[27,13.5],[23,14.5],[15,17]]);
 if(H==='kurz'){top(8);jag(12,17,8);}
 if(H==='stachel'){top(8);jag(12,16,6);[[[15,13],[13,4],[21,9]],[[20,9],[22,0],[28,8]],[[26,8],[31,0],[34,9]],[[32,9],[40,3],[39,14]]].forEach(hp);}
 if(H==='lang'){top(8);curtain();if(NL)S.cap(15.2,16,14.2,36,2.6,2.2,'hair',{g:'hf'});if(NR)S.cap(38.8,16,39.8,36,2.6,2.2,'hair',{g:'hf'});}
 if(H==='zopf'){top(8);hp([[14.5,12],[39.5,12],[39,15.5],[30,15],[20,17.5],[15,18]]);S.ell(fc>0?13:41,15,1.9,1.9,'red');}
 if(H==='dutt'){top(7);hp([[14.5,12],[39.5,12],[39,14.5],[27,13.5],[15,14.5]]);S.ell(cx+bk,5.5,5.5,4.5,'hair',{g:'hf'});S.rect(cx-3+bk,8.5,cx+3+bk,9.5,'gold');}
 if(H==='locken'){top(8);for(let k=0;k<=8;k++){const a=Math.PI*(1.05+k*.1125);S.ell(cx+Math.cos(a)*12.4,16+Math.sin(a)*11.4,3.3,3.3,'hair',{g:'hf'});}[[18,14.5],[22.5,13.8],[27,13.5],[31.5,13.8],[36,14.5]].forEach(([x,y])=>S.ell(x,y,2.7,2.7,'hair',{g:'hf'}));}
 if(H==='scheitel'){top(8);hp([[15.5,18],[17,11],[30,9],[39,12],[38.5,16],[30,13],[22,13.5]]);}
 if(H==='iro'){if(!fc){hp([[cx-2.6,15],[cx-3.4,8],[cx-3.6,5.5],[cx-3.4,1.8],[cx-1.5,4.2],[cx,.3],[cx+1.5,4.2],[cx+3.4,1.8],[cx+3.6,5.5],[cx+3.4,8],[cx+2.6,15]]);}else{const rx=11.45,ry=12,cy=19.5,a0=-.72,a1=1.62,N2=12,O=[],I=[],pt=(a,r)=>[cx-fc*(rx+r)*Math.sin(a),cy-(ry+r)*Math.cos(a)];for(let i=0;i<=N2;i++){const a=a0+(a1-a0)*i/N2,u=(a-.3)/.95;if(i%2){O.push(pt(a+.1,1.4+2+4*Math.exp(-u*u)));}else O.push(pt(a,1.4));I.push(pt(a,-1));}S.poly(O.concat(I.reverse()),'hair',{g:'hf',nw:true});}}
 if(H==='bob'){top(8);S.rect(15.5,12,38.5,15.5,'hair',{g:'hf'});}
 if(H==='zoepfe'){top(8);hp([[14.5,12],[39.5,12],[39,17],[33,15],[27,16.5],[21,15],[15,17]]);[-1,1].filter(s=>(!FAR||s!==fc)&&!PO.lie).forEach(s=>{S.cap(cx+s*12,17,cx+s*13.4,27,1.8,2,'hair');for(let k=0;k<4;k++)S.ell(cx+s*13.4,28+k*4,2.4,2.3,'hair');S.ell(cx+s*13.4,44,1.6,1.4,'red');});}
 if(H==='wuschel'){top(8.5);jag(12,16.5,7);[[[14,15],[11,9],[18,11]],[[18,9],[16,3],[24,7]],[[25,7],[27,1],[31,7]],[[31,7],[37,3],[37,10]],[[36,11],[43,10],[39,16]]].forEach(hp);}
 if(H==='glatze')S.px('skin:5',[[22,10],[23,10],[22,11]]);
 if(H==='afro'){top(9);[[17,14],[21.5,12.8],[27,12.4],[32.5,12.8],[37,14]].forEach(([x,y])=>S.ell(x,y,3,3,'hair',{g:'hf'}));if(fc){const N=Q=>Q.map(([x,y])=>[cx-fc*(cx-x),y]),ex=fc>0?18.2:35.8;S.poly(N([[12.6,11],[22.8,11],[22.8,15.4],[21.8,17.6],[20.6,19],[16.3,19.2],[16,25.5],[14.2,27.2],[12.4,25]]),'hair',{g:'hf',nw:true});}}
 if(H==='undercut'){S.ell(cx,13,12.4,7.5,'hair',{g:'hf',clip:(x,y)=>y<=12.5});hp([[16,13],[19,6],[33,4],[41,9],[38.5,14],[30,11],[21,13.5]]);}
 if(H==='emo'){top(8);hp([[14.5,12],[39.5,12],[39,16],[29,15],[23,19.5],[18,24],[15,20]]);}
 if(H==='halblang'){top(8);jag(12,16.5,6);if(NL)S.cap(15.2,16,14.6,31,2.4,2.2,'hair',{g:'hf'});if(NR)S.cap(38.8,16,39.4,31,2.4,2.2,'hair',{g:'hf'});}
 if(H==='seitenzopf'){top(8);hp([[14.5,12],[39.5,12],[39,15],[28,15.5],[16,18]]);if(!PO.lie){S.cap(15,16,13.8,23,2,2.2,'hair');for(let k=0;k<6;k++)S.ell(13.6-k*.2,24.5+k*4,2.5,2.3,'hair');S.ell(12.4,48.5,1.6,1.4,'red');}}
 if(H==='palme'){top(7.5);hp([[14.5,12],[39.5,12],[39,15],[27,14],[15,15]]);[[[cx-2,7],[cx-8,3],[cx-4,2.2]],[[cx-1,7],[cx-1,1.4],[cx+2,2.2]],[[cx+1,7],[cx+7,2.2],[cx+8,4.6]]].forEach(hp);S.rect(cx-2.5,6,cx+2.5,8,'red');}
 if(H==='wellen'){top(8);curtain();if(NL)S.bez([[15,16],[12,24],[16,30],[13,38]],2.6,2,'hair',{g:'hf'});if(NR)S.bez([[39,16],[42,24],[38,30],[41,38]],2.6,2,'hair',{g:'hf'});}
 if(H==='stoppel')S.ell(cx,15,12.2,9,'hair',{g:'hf',clip:(x,y)=>y<=14.5,bias:.15,tex:(x,y)=>((x*3+y*5)%7===0)?1:0});
 // Seitenansicht: Haar deckt Schläfe, den Bereich über dem Ohr und den Hinterkopf bis zum Nacken (Ohr bleibt frei, keine Hautlücke zwischen Haar und Ohr).
 if(fc&&!['glatze','iro','afro','undercut'].includes(H)){const N=Q=>Q.map(([x,y])=>[cx-fc*(cx-x),y]);S.poly(N([[13.8,12],[22.4,12],[22.2,15.2],[21.4,17.4],[20.4,19.1],[16.4,19.3],[16.1,24.8],[15.2,27.4],[13.4,25.5]]),'hair',{g:'hf',nw:true});}
 if(g.head){const hm=g.head==='pp'?'gold':'steel';S.ell(cx,15,13.4,10.2,hm,{g:'hm',clip:(x,y)=>y<=18}).rect(13.8,16,40.2,18.5,hm,{g:'hm'});if(!PO.lie)S.rect(cx-1,18,cx+1,23,hm);S.bez([[cx,7],[cx+4,1.2],[cx+10,3]],1.8,1,'red');S.px(hm+':5',[[20,9],[21,8]]);}
 if(fc<=0){mk(fc?'armN':'armF');arm(1);weapon();bowFront();hand(1);}
 return S;}

const PETS=[['wolf','Wolf',['#8e93a6','#5a5f70','#e2dccb','#9a6a44','#3d3a46','#b8c8e0']],['katze','Katze',['#e89a4a','#3d3a46','#f0efe8','#8e93a6','#9a6a44','#e6c89a']],['biene','Biene',['#f2c23c','#e07a9a','#6cc59a','#9277ea','#6db3e0','#e8783a']],['fuchs','Fuchs',['#e8783a','#c8c2b4','#b8442e','#eeeae0','#3d3a46','#d8a860']],['eule','Eule',['#9a7050','#c9c0e8','#6d86e6','#eeeae0','#8e93a6','#d0903a']],['drache','Drache',['#52b06a','#cc4455','#6a4fc8','#3f86b3','#e0a82e','#3d414f']],['schildkroete','Schildkröte',['#5a9a4a','#8a6a3a','#3f86b3','#2a8a8a','#8a8a3a','#b8442e']],['adler','Adler',['#7a5030','#3d414f','#b0703a','#c8903a','#8e93a6','#a84430']],['schlange','Schlange',['#6ab04a','#e0a82e','#6d86e6','#cc4455','#7a5aa8','#3d414f']],['krake','Krake',['#d0608a','#6a4fc8','#2a8a8a','#e8783a','#3f86b3','#b8442e']],['hase','Hase',['#e6dfcc','#b0845a','#9c9cab','#3d3a46','#d8b880','#e8b0c0']],['frosch','Frosch',['#6cc55a','#e0a82e','#3f86b3','#cc4455','#7a5aa8','#2a8a8a']],['pinguin','Pinguin',['#3d414f','#3f6f9a','#7a5aa8','#6a4a3a','#2a6a6a','#6a6a7a']],['baer','Bär',['#8a5a3a','#d0a060','#e6dfcc','#3d3a46','#8e93a6','#a0503a']],['igel','Igel',['#7a5040','#8a8a9a','#b87a9a','#b89060','#4a3a3a','#d8d0c0']],['maus','Maus',['#9c9cab','#b0845a','#e6dfcc','#3d3a46','#f0efe8','#c8a070']],['axolotl','Axolotl',['#f0a0b8','#8fb8e0','#f0d080','#f0efe8','#b090e0','#90c890']],['papagei','Papagei',['#cc4455','#4f9a5a','#3f86b3','#e0c030','#7a5aa8','#e8783a']],['fledermaus','Fledermaus',['#6a5a8a','#8a5a3a','#3d414f','#a84450','#8e93a6','#3f5a8a']],['schleim','Schleim',['#6cc59a','#9277ea','#ffb070','#6db3e0','#f090b0','#e8d060']]];
// Einpassen je Art: k = waagerechte Stauchung um die Mitte, dx/dy = Verschiebung. So bleiben Schwanz, Flügel, Zunge und Tentakel samt Kontur in der 40-px-Leinwand.
const PET_FIT={fuchs:{k:.96,dx:.5},drache:{k:.96,dx:.5},schlange:{dx:-1},krake:{dy:-1}};
function fitSprite(S,f){if(!f)return S;const k=f.k||1,dx=f.dx||0,dy=f.dy||0,cx=20,X=x=>cx+(x-cx)*k+dx,Xi=x=>(x-dx-cx)/k+cx,Q=L=>L.map(p=>[X(p[0]),p[1]+dy]),P={};
 const o2=o=>{if(!o)return o;const r=Object.assign({},o);if(o.clip){const c=o.clip;r.clip=(x,y)=>c(Xi(x),y-dy);}if(o.tex){const t=o.tex;r.tex=(x,y)=>t(Math.round(Xi(x)),y-dy);}return r;};
 P.ell=(x,y,rx,ry,m,o)=>{S.ell(X(x),y+dy,rx*k,ry,m,o2(o));return P;};P.rect=(a,b,c,d,m,o)=>{S.rect(X(a),b+dy,X(c),d+dy,m,o2(o));return P;};
 P.poly=(L,m,o)=>{S.poly(Q(L),m,o2(o));return P;};P.path=(L,r0,r1,m,o)=>{S.path(Q(L),r0,r1,m,o2(o));return P;};
 P.cap=(a,b,c,d,r0,r1,m,o)=>{S.cap(X(a),b+dy,X(c),d+dy,r0,r1,m,o2(o));return P;};P.bez=(L,r0,r1,m,o)=>{S.bez(Q(L),r0,r1,m,o2(o));return P;};
 P.style=k=>{S.style(k);return P;};P.mark=k=>{S.mark(k);return P;};P.add=(t,m,o,bb)=>{S.add((x,y)=>t(Xi(x),y-dy),m,o2(o),[X(bb[0]),bb[1]+dy,X(bb[2]),bb[3]+dy]);return P;};P.erase=t=>{S.erase((x,y)=>t(Xi(x),y-dy));return P;};
 P.eraseEll=(x,y,rx,ry)=>{S.eraseEll(X(x),y+dy,rx*k,ry);return P;};P.px=(c,l)=>{S.px(c,l.map(p=>[Math.floor(X(p[0]+.5)),p[1]+dy]));return P;};
 P.line=(a,b,c,d,col)=>{S.line(Math.round(X(a)),b+dy,Math.round(X(c)),d+dy,col);return P;};P.lineIn=(a,b,c,d,col,m)=>{S.lineIn(Math.round(X(a)),b+dy,Math.round(X(c)),d+dy,col,m);return P;};
 P.dot=(x,y,rx,ry,c)=>{S.dot(X(x),y+dy,rx*k,ry,c);return P;};P.render=()=>S.render();return P;}
function pet(kind,col){R.pf=ramp(col);const S=fitSprite(Sprite(40,40),PET_FIT[kind]).style('fur'),F='pf',DK={bias:-.32};
 const quadFar=(hx,fx,r)=>{S.cap(hx+3.2,31,hx+3,35.8,r-.2,r-.5,F,DK).ell(hx+3.4,36.6,r+.1,1.1,F,DK);S.cap(fx+3,31,fx+3.3,35.8,r-.2,r-.5,F,DK).ell(fx+3.8,36.6,r+.1,1.1,F,DK);};
 const quadNear=(hx,fx,r,toe)=>{S.ell(hx+1.6,30.6,r+2,r+2.3,F);S.cap(hx,32.5,hx-.3,36.6,r,r-.3,F).ell(hx+.2,37.5,r+.4,1.2,F);S.cap(fx,32,fx+.2,36.6,r,r-.3,F).ell(fx+.8,37.5,r+.4,1.2,F);S.px(toe||F+':5',[[Math.round(hx+1),37],[Math.round(fx+1.6),37]]);};
 if(kind==='wolf'||kind==='fuchs'){const fox=kind==='fuchs';
  S.bez(fox?[[11,28],[2,26],[3,13]]:[[11,27],[4,23],[4,14]],fox?4.2:2.8,fox?2.2:1.4,F);if(fox)S.ell(3.2,13.5,2.8,2.8,'cream');
  quadFar(11.5,23.2,2.3);
  S.ell(19,28,10.5,6.8,F);S.ell(20,31.5,6,2.6,fox?'cream':F,{line:false,bias:fox?0:.35});if(fox)S.ell(25,26,3.6,3.6,'cream',{line:false});
  quadNear(11.5,23.2,2.3);
  S.poly([[24,14],[25.5,5],[29.5,12]],F).poly([[30,12],[34.5,5],[35,14]],F);
  S.poly([[25.2,12.5],[26,8],[28.3,11.6]],'pink',{line:false}).poly([[31.3,11.6],[33.8,8],[34,12.5]],'pink',{line:false});
  S.ell(29,17.5,7,6.4,F,{g:'hd'}).ell(34.5,20.5,4.6,3.1,F,{g:'hd'});S.ell(34,21.6,3.6,1.9,'cream',{line:false});
  S.px('void:1',[[38,19],[39,19],[38,20]]);S.dot(29.8,16.8,1.2,1.5,'void:1');S.px('#ffffff',[[29,16]]);}
 if(kind==='katze'){
  S.bez([[10,29],[3,27],[3,17],[7,14]],2,1.6,F);
  quadFar(11.8,22.6,2.1);
  S.ell(18.5,29,9.5,6.4,F,{tex:(x,y)=>(x%4===0&&y<30)?-1:0});
  quadNear(11.8,22.6,2.1);
  S.poly([[23,15],[23.5,6.5],[28.5,12.5]],F).poly([[31,12.5],[36,7],[35.5,16]],F);
  S.poly([[24.3,13.5],[24.6,9],[27,12.2]],'pink',{line:false}).poly([[32.2,12.4],[34.8,9.5],[34.6,14]],'pink',{line:false});
  S.ell(29.5,19,7.4,6.8,F);
  S.dot(27,18.6,1.3,1.7,'venom:3').dot(32.6,18.6,1.3,1.7,'venom:3');S.px('void:1',[[27,18],[27,19],[33,18],[33,19]]).px('#ffffff',[[26,17],[32,17]]);
  S.px('pink:3',[[29,21],[30,21]]).px(F+':1',[[29,22],[30,23],[31,22]]);
  S.line(34,22,39,21,'cream:5').line(34,23,39,24,'cream:5').line(25,22,21,21,'cream:5');}
 if(kind==='biene'){const inB=(x,y)=>((x-18)/10)**2+((y-26)/7.5)**2<=1;
  S.ell(14,13,6.5,4.5,'ice',{bias:.35}).ell(21,11.5,5.5,4,'ice',{bias:.35});
  S.poly([[6,26],[9,23.5],[9,28.5]],'spider');
  S.ell(18,26,10,7.5,F);[13,18,23].forEach(x=>S.rect(x-1,19,x,33,'spider',{line:false,clip:inB}));
  S.ell(28.5,24,5,5,'spider');S.dot(30.5,23,1.4,1.7,'#ffffff');S.px('void:1',[[31,23],[31,24]]);
  S.path([[27,20],[26,15],[24,13]],.6,.6,'spider').path([[30,20],[32,15],[34,14]],.6,.6,'spider');S.dot(24,13,1.2,1.2,F+':3').dot(34,14,1.2,1.2,F+':3');
  S.px('spider:3',[[15,34],[15,35],[21,34],[21,35]]).px('pink:3',[[32,27],[33,27]]);}
 if(kind==='eule'){
  S.ell(8.5,27,3.5,8,F,{bias:-.25}).ell(31.5,27,3.5,8,F,{bias:-.25});
  S.ell(20,25,10.5,12.5,F);S.ell(20,29,6.5,7.5,'cream',{line:false,tex:(x,y)=>((y%3===0)&&(x%2===0))?-1:0});
  S.poly([[11,14],[10,6],[16,12]],F).poly([[29,14],[30,6],[24,12]],F);
  S.ell(15.5,19,4.6,4.4,'cream').ell(24.5,19,4.6,4.4,'cream');
  S.ell(15.5,19,2.6,2.6,'glowY',{emit:true}).ell(24.5,19,2.6,2.6,'glowY',{emit:true});S.dot(15.8,19.3,1.2,1.2,'void:1').dot(24.8,19.3,1.2,1.2,'void:1');S.px('#ffffff',[[15,18],[24,18]]);
  S.poly([[18.5,22],[21.5,22],[20,26]],'gold');S.px('gold:3',[[16,38],[18,38],[22,38],[24,38]]);}
 if(kind==='drache'){
  S.poly([[17,22],[10,8],[3,12],[7,17],[3,22],[11,25]],F,{bias:-.2});S.path([[17,22],[10,8],[3,12]],1,.7,F);
  S.bez([[10,30],[3,33],[2,26]],2.6,1.2,F);S.poly([[0,26],[4,25],[2,21]],F);
  quadFar(12,23,2.3);
  S.ell(18.5,29,9,6.8,F);S.ell(19,31.5,6,3,'belly',{line:false});
  quadNear(12,23,2.3,'horn:5');
  [[21,21],[17,22],[13,23]].forEach(([x,y])=>S.poly([[x-1.5,y+1],[x+1.5,y+1],[x,y-2]],'horn'));
  S.bez([[26,14],[26,8],[29,5]],1.5,.6,'horn').bez([[31,14],[33,8],[36,6]],1.5,.6,'horn');
  S.ell(29,18.5,7,6.2,F,{g:'hd'}).ell(34.5,21,4.4,3.2,F,{g:'hd'});
  S.dot(30,17.6,1.7,2,'#ffffff').dot(30.5,18,1,1.3,'void:1');S.px(F+':0',[[37,19],[38,20]]).px('fire:4',[[39,21]]);}
 if(kind==='schildkroete'){
  S.ell(9,35,3,2.4,'moss').ell(28,35.5,3,2.4,'moss').ell(14,36,3,2.2,'moss',{bias:-.2}).ell(24,36,3,2.2,'moss',{bias:-.2});
  S.ell(19,28,13,9.5,F,{clip:(x,y)=>y<=32});S.rect(6,31,32,33.5,'belly');
  [[19,24],[12,27],[26,27],[15.5,19.5],[22.5,19.5]].forEach(([x,y])=>{[[x-2,y-2,x+2,y-2],[x-3,y,x-2,y-2],[x+3,y,x+2,y-2],[x-3,y,x-2,y+2],[x+3,y,x+2,y+2],[x-2,y+2,x+2,y+2]].forEach(([a,b,c2,d])=>S.lineIn(a,b,c2,d,F+':1',F));});
  S.ell(34,27,4.6,4.2,'moss');S.dot(35.4,26,1,1.3,'void:1');S.px('#ffffff',[[35,25]]).line(34,29,37,29,'moss:0');S.px('moss:1',[[4,31],[5,31]]);}
 if(kind==='adler'){
  S.poly([[13,34],[21,34],[22,39],[12,39]],F,{bias:-.25});
  S.ell(18,25,8.5,10,F);S.poly([[10,20],[18,24],[16,36],[9,32]],F,{bias:-.3});
  S.ell(23,14,6.2,5.6,'cream');S.poly([[27,13],[32,14],[31,17],[28,18]],'gold');S.px('gold:1',[[31,17]]);
  S.dot(24.6,13,1,1.2,'glowY:3');S.px('void:1',[[25,13]]).line(22,11,26,11,'cream:1');S.px('gold:3',[[16,35],[17,35],[20,35],[21,35]]);}
 if(kind==='schlange'){const t=(x,y)=>((x+y)%4===0)?-1:0;
  S.ell(20,34,13,4.5,F,{tex:t});S.ell(21,29.5,9,3.8,F,{tex:t});
  S.bez([[25,28],[28,22],[26,16]],3.2,2.8,F);S.bez([[24,29],[26,23]],1.3,1.1,'belly',{line:false});
  S.ell(29,14,5.5,4.3,F,{g:'hd'}).ell(33,15,3.5,2.8,F,{g:'hd'});
  S.dot(30,13,1.2,1.4,'glowY:3');S.px('void:1',[[30,13]]).px('#ffffff',[[29,12]]);
  S.path([[36,16],[39,16],[40,14]],.6,.6,'tongue').path([[39,16],[40,18]],.6,.6,'tongue');S.px(F+':5',[[14,32],[20,33],[26,34]]);}
 if(kind==='krake'){
  [[12,24,5,31,8,37],[16,26,13,34,17,39],[24,26,27,34,23,39],[28,24,35,31,32,37]].forEach(([a,b,c2,d,e,f])=>S.bez([[a,b],[c2,d],[e,f]],2.6,1,F,{bias:-.1}));
  S.ell(20,17,10.5,10.5,F,{g:'k'}).ell(20,24,9,4,F,{g:'k'});
  S.ell(16,19,2.6,3,'eyeW').ell(24,19,2.6,3,'eyeW');S.dot(16.4,19.6,1.2,1.6,'void:1').dot(24.4,19.6,1.2,1.6,'void:1');S.px('#ffffff',[[15,18],[23,18]]);
  S.px(F+':4',[[14,11],[15,11],[25,10],[21,8],[22,8],[27,14]]).px(F+':1',[[19,24],[20,25],[21,24]]);}
 if(kind==='hase'){
  S.ell(9.5,30.5,3.2,3,'cream');S.ell(26,36.7,2.2,1.1,F,DK);S.bez([[23.5,16],[21,9],[21.5,3]],2,1.4,F,DK);
  S.ell(17,30,8.5,7.5,F);S.ell(21.5,31.5,3.8,4.6,'cream',{line:false});
  S.ell(13.2,31.2,5.2,5.4,F);S.ell(14.8,37.4,5.4,1.4,F);S.px(F+':5',[[19,37],[20,37]]);
  S.cap(23,32.5,23.3,36.6,1.8,1.6,F).ell(23.9,37.5,2.3,1.2,F);
  S.ell(27,21,6.4,5.8,F,{g:'hd'}).ell(31.5,23,3.2,2.6,F,{g:'hd'});
  S.bez([[27,16],[27,9],[28.5,3]],2.1,1.5,F);S.bez([[27.3,14.5],[27.3,9.5],[28.3,5.5]],.8,.6,'pink',{line:false});
  S.dot(28.2,20,1.2,1.5,'void:1');S.px('#ffffff',[[27,19]]);S.px('pink:3',[[34,22],[29,24],[30,24]]);
  S.line(33,23,37,22,'cream:5').line(33,24,37,25,'cream:5');}
 if(kind==='frosch'){
  S.ell(8.8,33.2,5.4,4.2,F).ell(31.2,33.2,5.4,4.2,F);
  S.ell(20,29,11,8.4,F,{g:'b'}).ell(14,20,4.4,4.2,F,{g:'b'}).ell(26,20,4.4,4.2,F,{g:'b'});
  S.ell(20,32.6,7,4.6,'belly',{line:false});
  S.cap(15.5,31.5,15,36.4,1.6,1.4,F).cap(24.5,31.5,25,36.4,1.6,1.4,F);
  S.ell(14.4,37.3,3,1.2,F).ell(25.6,37.3,3,1.2,F);S.px(F+':5',[[13,37],[15,37],[24,37],[26,37]]);
  S.ell(14,20,2.8,2.8,'eyeW').ell(26,20,2.8,2.8,'eyeW');
  S.dot(14.6,20.4,1.3,1.6,'void:1').dot(26.6,20.4,1.3,1.6,'void:1');S.px('#ffffff',[[13,19],[25,19]]);
  S.line(14,27,26,27,F+':0');S.px(F+':0',[[13,26],[27,26]]);S.px('pink:3',[[11,25],[12,25],[28,25],[29,25]]);
  S.px(F+':1',[[6,31],[9,30],[31,30],[34,31],[17,23],[23,23]]);}
 if(kind==='pinguin'){
  S.ell(15.6,37.4,3.2,1.2,'gold').ell(24.4,37.4,3.2,1.2,'gold');
  S.bez([[12.5,21],[8.6,27],[9.6,33]],2.4,1.2,F,{bias:-.12}).bez([[27.5,21],[31.4,27],[30.4,33]],2.4,1.2,F,{bias:-.12});
  S.ell(20,25.5,9,11.2,F);S.ell(20,29,6.2,7.4,'cream',{line:false});S.ell(20,17.6,5.6,4.2,'cream',{line:false,clip:(x,y)=>y>=16});
  S.dot(17.5,17.6,1.2,1.5,'void:1').dot(22.5,17.6,1.2,1.5,'void:1');S.px('#ffffff',[[17,16],[22,16]]);
  S.poly([[18,20],[22,20],[20,23.2]],'gold');S.px('pink:3',[[15,20],[25,20]]);}
 if(kind==='baer'){
  S.ell(13,10,3,3,F).ell(27,10,3,3,F);S.ell(13,10,1.5,1.5,'muzzle',{line:false}).ell(27,10,1.5,1.5,'muzzle',{line:false});
  S.ell(20,29.5,10,8.2,F);S.ell(20,31,6,5.6,'muzzle',{line:false});
  S.cap(11.8,25,10.8,32,2.8,2.5,F,{side:-1}).cap(28.2,25,29.2,32,2.8,2.5,F,{side:1});
  S.ell(13.5,36.3,4.2,2.1,F).ell(26.5,36.3,4.2,2.1,F);S.ell(13.5,36.3,2,1.1,'muzzle',{line:false}).ell(26.5,36.3,2,1.1,'muzzle',{line:false});
  S.ell(20,16.5,8.2,7.4,F,{g:'h'});S.ell(20,19.6,3.8,2.9,'muzzle');
  S.px('void:1',[[19,18],[20,18],[21,18],[20,19]]);S.px('void:2',[[19,21],[20,21]]);
  S.dot(16.4,15.6,1.1,1.4,'void:1').dot(23.6,15.6,1.1,1.4,'void:1');S.px('#ffffff',[[16,15],[23,15]]);S.px('pink:3',[[13,19],[27,19]]);}
 if(kind==='igel'){const SP={g:'sp',tex:(x,y)=>((x+2*y)%5===0)?-1:0};
  S.ell(14.6,36.3,2.2,1.1,'muzzle',DK).ell(23.6,36.3,2.2,1.1,'muzzle',DK);
  for(let k=0;k<9;k++){const a=Math.PI*(1.05+k*.1),c=Math.cos(a),sn=Math.sin(a),bx=18.5+c*9.5,by=30+sn*6.6,tx=18.5+c*13.6,ty=30+sn*10.2,nx=-sn*2.3,ny=c*2.3;S.poly([[bx-nx,by-ny],[tx,ty],[bx+nx,by+ny]],F,SP);}
  S.ell(18.5,30,10.5,7.4,F,SP);
  S.ell(28.2,31.5,5.6,4.6,'muzzle').ell(33,33,2.8,2.1,'muzzle');S.px('void:1',[[35,32],[36,32],[35,33]]);
  S.dot(28.6,29.8,1.1,1.3,'void:1');S.px('#ffffff',[[28,29]]);S.px('pink:3',[[30,33]]);
  S.ell(17.2,37.4,2.3,1.1,'muzzle').ell(26.2,37.5,2.3,1.1,'muzzle');}
 if(kind==='maus'){
  S.bez([[11,33],[4,35],[2,29],[5,25]],1.1,.7,'pink');S.ell(14.6,36.3,2,1,'pink',DK);S.ell(28.6,22.8,3,3,F,DK);
  S.ell(18.5,31,8.5,6.3,F);S.ell(20,33.6,5,2.4,'cream',{line:false});
  S.ell(27,28.6,5.6,5,F,{g:'hd'}).ell(31.8,30,3.1,2.5,F,{g:'hd'});
  S.ell(24.2,22.4,4.2,4.2,F);S.ell(24.2,22.4,2.5,2.5,'pink',{line:false});
  S.dot(28.2,27.6,1.2,1.4,'void:1');S.px('#ffffff',[[27,26]]);S.px('pink:3',[[34,29],[35,29]]);
  S.line(32,31,37,30,'cream:5').line(32,32,37,33,'cream:5');S.ell(17,37.3,2.2,1.1,'pink').ell(25,37.3,2.2,1.1,'pink');}
 if(kind==='axolotl'){
  S.bez([[11,30],[5,29],[2,24]],3.2,1,F);
  S.cap(15.5,32.5,15.2,35.8,1.3,1.1,F,DK).cap(25,32.5,26,35.8,1.3,1.1,F,DK);
  S.ell(19,30.5,9,5.4,F);S.ell(20,33.2,6,2.2,F,{line:false,bias:.3});
  S.cap(13,33,11.8,36.6,1.4,1.2,F).cap(22.5,33.5,23.4,36.6,1.4,1.2,F);S.px(F+':5',[[11,37],[23,37]]);
  [[[24,21],[21,16.5],[20.5,12]],[[25.5,19.5],[24.5,14.5],[25.5,10]],[[27.5,19],[28.5,14],[30.5,11]]].forEach(P=>S.bez(P,1.3,.8,'tongue'));
  S.ell(28.5,25,7.4,6.4,F,{g:'hd'});S.dot(29.6,23.6,1.3,1.5,'void:1');S.px('#ffffff',[[29,22]]);
  S.px(F+':0',[[33,27],[34,27],[35,26]]);S.px('pink:3',[[31,27]]);}
 if(kind==='papagei'){const W2=col==='#cc4455'?'ice':'gold';
  S.poly([[13,30],[18,31],[15.6,38.4],[11.6,37.8]],W2);
  S.ell(19.5,24,6.8,9.4,F);S.ell(17,26,4.2,7,W2);S.lineIn(15,22,16,31,W2+':1',W2).lineIn(18,22,19,31,W2+':1',W2);
  S.ell(22,15,5.8,5.4,F,{g:'hd'});S.ell(24,14.2,2.2,2.2,'eyeW');S.px('void:1',[[24,14],[25,14]]);
  S.poly([[26.4,13],[30.6,14.2],[30,18.2],[27,17.6]],'cream');S.px('void:2',[[28,17],[29,17]]);
  S.px('horn:1',[[18,34],[19,34],[21,34],[22,34]]);}
 if(kind==='fledermaus'){
  const wing=f=>{const P=Q=>Q.map(([x,y])=>[f(x),y]);S.poly(P([[15,23],[6,17],[2,20],[3,28],[7,26],[9,31],[13,29]]),F,{bias:-.25});S.path(P([[15,23],[6,17],[2,20]]),1,.7,F,{bias:-.08});};
  wing(x=>x);wing(x=>40-x);
  S.poly([[14.5,19],[13,9.5],[18.5,15.5]],F).poly([[25.5,19],[27,9.5],[21.5,15.5]],F);
  S.poly([[15,17],[14.2,12],[17.4,15.4]],'pink',{line:false}).poly([[25,17],[25.8,12],[22.6,15.4]],'pink',{line:false});
  S.ell(20,25,7,8.4,F);S.ell(20,28.6,4,4.2,F,{line:false,bias:.3});
  S.dot(17.5,23,1.4,1.7,'void:1').dot(22.5,23,1.4,1.7,'void:1');S.px('#ffffff',[[17,22],[22,22]]);
  S.line(18,26,22,26,F+':0');S.px('eyeW:5',[[19,27],[21,27]]);S.px('pink:3',[[15,26],[25,26]]);S.px(F+':1',[[18,34],[22,34]]);}
 if(kind==='schleim'){
  S.ell(20,31.5,12.5,6.6,F,{g:'b'}).ell(20,27,9.5,9,F,{g:'b'}).bez([[20,19],[19,14],[23,11]],3.4,1,F,{g:'b'});
  S.erase((x,y)=>y>38.5);
  S.dot(13.5,25,1.3,2.6,F+':5');S.px('#ffffff',[[13,23]]);
  S.dot(16.5,28,1.4,2,'void:1').dot(23.5,28,1.4,2,'void:1');S.px('#ffffff',[[16,27],[23,27]]);
  S.px(F+':0',[[19,32],[20,33],[21,32]]);S.px('pink:3',[[13,31],[14,31],[26,31],[27,31]]);S.dot(28,35,1.2,1,F+':4');}
 return S;}

function crop(img,x0,y0,w,h){const col=new Array(w*h).fill(null);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const X=x+x0,Y=y+y0;if(X>=0&&Y>=0&&X<img.w&&Y<img.h)col[y*w+x]=img.col[Y*img.w+X];}return {w,h,col};}
const head=(img)=>crop(img,10,0,34,34);
function buildAll(gears){const O={};const put=(k,img)=>O[k]=enc(img);
 PRE.forEach((c,v)=>{const img=hero(c).render();put('H'+v+'_none',img);put('Hh'+v,head(img));(gears||[]).forEach(g=>{if(g!=='none')put('H'+v+'_'+g,hero(Object.assign({},c,{gear:GEAR[g]})).render());});});
 HAIRS.forEach((_,i)=>put('oh_hair'+i,head(hero(Object.assign({},PRE[0],{hair:i})).render())));
 EYES.forEach((_,i)=>put('oh_ey'+i,head(hero(Object.assign({},PRE[0],{eyes:i})).render())));
 MOUTHS.forEach((_,i)=>put('oh_mo'+i,head(hero(Object.assign({},PRE[0],{mouth:i})).render())));
 TOPS.forEach((_,i)=>put('ob_top'+i,hero(Object.assign({},PRE[0],{top:i})).render()));
 PANTS.forEach((_,i)=>put('ob_pa'+i,hero(Object.assign({},PRE[0],{pants:i,top:0})).render()));
 PETS.forEach(([k],a)=>PETS[a][2].forEach((col,b)=>put('P'+a+'_'+b,pet(k,col).render())));
 PETS.forEach(([k],a)=>{if(PET_TURN[k])PETS[a][2].forEach((col,b)=>put('Pr'+a+'_'+b,petFacing(k,col,1)));});
 return O;}

function turned(fn,dir,deg,op){deg=deg||34;op=Object.assign({sort:true},op||{});const calls=[];let W=0,H=0;const P={};
 ['ell','rect','poly','path','cap','bez','add','erase','eraseEll','px','line','lineIn','dot','style','mark'].forEach(k=>{P[k]=(...a)=>{calls.push([k,a]);return P;};});
 const real=Sprite;let ret;Sprite=(w,h)=>{W=w;H=h;return P;};try{ret=fn();}finally{Sprite=real;}
 if(!W)return null;
 P.render=()=>{
  const segT=(Q,r0,r1)=>{const seg=[];let tot=0;for(let i=1;i<Q.length;i++){const l=Math.hypot(Q[i][0]-Q[i-1][0],Q[i][1]-Q[i-1][1]);seg.push([Q[i-1],Q[i],tot,l]);tot+=l;}
   return (x,y)=>{for(const [a,b,s0,l] of seg){const dx=b[0]-a[0],dy=b[1]-a[1];let t=l?((x-a[0])*dx+(y-a[1])*dy)/(l*l):0;t=t<0?0:t>1?1:t;const g=tot?(s0+t*l)/tot:0,r=r0+(r1-r0)*g;if((x-a[0]-dx*t)**2+(y-a[1]-dy*t)**2<=r*r)return true;}return false;};};
  const bbP=(Q,r)=>{const xs=Q.map(p=>p[0]),ys=Q.map(p=>p[1]);return [Math.min(...xs)-r-1,Math.min(...ys)-r-1,Math.max(...xs)+r+1,Math.max(...ys)+r+1];};
  const byCi=new Map(),shapes=[];
  calls.forEach(([k,a],ci)=>{let t=null,m,o,bb,hostable=false;
   if(k==='ell'){const [cx,cy,rx,ry]=a;m=a[4];o=a[5];t=(x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1;bb=[cx-rx-1,cy-ry-1,cx+rx+1,cy+ry+1];hostable=true;}
   else if(k==='rect'){const [x0,y0,x1,y1]=a;m=a[4];o=a[5];t=(x,y)=>x>=x0&&x<=x1+1&&y>=y0&&y<=y1+1;bb=[x0-1,y0-1,x1+1,y1+1];hostable=true;}
   else if(k==='poly'){const Q=a[0];m=a[1];o=a[2];t=(x,y)=>inPoly(Q,x,y);bb=bbP(Q,0);hostable=Q.length<=6;}
   else if(k==='path'){m=a[3];o=a[4];t=segT(a[0],a[1],a[2]);bb=bbP(a[0],Math.max(a[1],a[2]));}
   else if(k==='cap'){const Q=[[a[0],a[1]],[a[2],a[3]]];m=a[6];o=a[7];t=segT(Q,a[4],a[5]);bb=bbP(Q,Math.max(a[4],a[5]));}
   else if(k==='bez'){const Q=[];for(let i=0;i<=22;i++)Q.push(bezPt(a[0],i/22));m=a[3];o=a[4];t=segT(Q,a[1],a[2]);bb=bbP(Q,Math.max(a[1],a[2]));}
   else if(k==='add'){t=a[0];m=a[1];o=a[2];bb=a[3];}
   if(!t)return;o=o||{};
   const pts=[],x0=Math.max(0,Math.floor(bb[0])),y0=Math.max(0,Math.floor(bb[1])),x1=Math.min(W-1,Math.ceil(bb[2])),y1=Math.min(H-1,Math.ceil(bb[3]));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const qx=x+.5,qy=y+.5;if(o.clip&&!o.clip(qx,qy))continue;if(t(qx,qy))pts.push(y*W+x);}
   let sx=0,sy=0,mn=1e9,mx=-1e9;pts.forEach(i=>{const x=i%W;sx+=x;sy+=(i/W)|0;if(x<mn)mn=x;if(x>mx)mx=x;});
   const s={ci,t,m,o,bb,hostable,pts,set:new Set(pts),area:pts.length,fx:pts.length?sx/pts.length+.5:0,fy:pts.length?sy/pts.length+.5:0,w:mx-mn+1};shapes.push(s);byCi.set(ci,s);});
  const groups={};shapes.forEach(s=>{if(s.o.g===undefined)return;const G=groups[s.o.g]||(groups[s.o.g]={set:new Set(),ci:s.ci});s.pts.forEach(i=>G.set.add(i));});
  shapes.forEach(s=>{const G=s.o.g!==undefined?groups[s.o.g]:null;s.hset=G?G.set:s.set;s.harea=s.hset.size;s.hci=G?G.ci:s.ci;});
  const fdx=-dir*1.2,fdy=-1;
  if(op.sort){const all=new Set();shapes.forEach(s=>s.pts.forEach(i=>all.add(i)));const tot=all.size||1;
   const core=shapes.filter(s=>s.hostable&&!s.o.nw&&s.harea>=.05*tot&&Math.abs(s.fx-W/2)<=.15*W),coreSet=new Set(),coreHs=new Set(core.map(s=>s.hset));core.forEach(s=>s.hset.forEach(i=>coreSet.add(i)));
   const isFar=s=>{if(s.o.side)return s.o.side===dir;if(coreHs.has(s.hset)||!s.area||(s.fx-W/2)*dir<=.06*W)return false;let out=0;for(const i of s.pts)if(!coreSet.has(i))out++;return out>=.5*s.area;};
   const gF={};shapes.forEach(s=>{if(s.o.g!==undefined)gF[s.o.g]=(gF[s.o.g]===undefined||gF[s.o.g])&&isFar(s);});
   shapes.forEach(s=>{s.far=s.o.g!==undefined?gF[s.o.g]:isFar(s);if(!s.far)return;let j=s.ci;core.forEach(c=>{if(c.ci<j){for(const i of s.pts)if(c.set.has(i)){j=c.ci;break;}}});s.key=j-.5+s.ci*1e-6;});}
  const hosts=shapes.filter(s=>s.hostable&&!s.o.nw&&s.harea>=50);
  const rows=new Map(),ext=(h,y)=>{let R0=rows.get(h.hset);if(!R0){R0={};h.hset.forEach(i=>{const x=i%W,yy=(i/W)|0,r=R0[yy]||(R0[yy]=[x,x]);if(x<r[0])r[0]=x;if(x>r[1])r[1]=x;});rows.set(h.hset,R0);}return R0[Math.floor(y)];};
  const th=deg*Math.PI/180*dir;
  const mapX=(h,x,y)=>{const r=ext(h,y);if(!r)return {x,k:1};const c=(r[0]+r[1]+1)/2,R=Math.max(1,(r[1]-r[0]+1)/2),u=Math.max(-1,Math.min(1,(x-c)/R)),ph=Math.asin(u),p2=ph+th;
   if(Math.abs(p2)>Math.PI/2*.97)return null;return {x:c+R*Math.sin(p2),k:Math.max(.3,Math.min(1.2,Math.cos(p2)/Math.max(.3,Math.cos(ph))))};};
  const hostOf=s=>{if(s.o.nw||!s.area||s.far)return null;let best=null;for(const h of hosts){if(h.far||h.hset===s.hset||h.harea<2*s.area||h.hci>s.ci)continue;
    let inn=0;for(const i of s.pts)if(h.hset.has(i))inn++;if(inn<.9*s.area)continue;const r=ext(h,s.fy);if(!r||s.w>.6*(r[1]-r[0]+1))continue;if(!best||h.harea>best.harea)best=h;}return best;};
  const hostPt=(x,y)=>{const i=Math.floor(y)*W+Math.floor(x);let best=null;for(const h of hosts)if(h.hset.has(i)&&(!best||h.harea>best.harea))best=h;return best;};
  const mp=(x,y)=>{const h=hostPt(x+.5,y+.5);if(!h)return [x,y];if(h.far)return [x+Math.round(fdx),y+fdy];const r=mapX(h,x+.5,y+.5);return r?[Math.round(r.x-.5),y]:null;};
  const S=real(W,H),order=calls.map((c,ci)=>ci).sort((a,b)=>{const ka=byCi.get(a)&&byCi.get(a).far?byCi.get(a).key:a,kb=byCi.get(b)&&byCi.get(b).far?byCi.get(b).key:b;return ka-kb;});
  order.forEach(ci=>{const [k,a]=calls[ci],s=byCi.get(ci);
   if(s&&s.far){const o2=Object.assign({},s.o);if(o2.flat!==undefined)o2.flat=Math.max(1,o2.flat-1);else if(!o2.emit)o2.bias=(o2.bias||0)-.28;
    if(s.o.clip){const c0=s.o.clip;o2.clip=(x,y)=>c0(x-fdx,y-fdy);}if(s.o.tex){const t0=s.o.tex;o2.tex=(x,y)=>t0(Math.round(x-fdx),Math.round(y-fdy));}
    S.add((x,y)=>s.t(x-fdx,y-fdy),s.m,o2,[s.bb[0]+fdx,s.bb[1]+fdy,s.bb[2]+fdx,s.bb[3]+fdy]);return;}
   if(s){const h=hostOf(s);if(!h){S.add(s.t,s.m,s.o,s.bb);return;}
    const q=mapX(h,s.fx,s.fy);if(!q)return;const fx=s.fx,nx=q.x,kk=q.k,inv=x=>fx+(x-nx)/kk;
    const o2=Object.assign({},s.o);if(s.o.clip){const c0=s.o.clip;o2.clip=(x,y)=>c0(inv(x),y);}if(s.o.tex){const t0=s.o.tex;o2.tex=(x,y)=>t0(Math.round(inv(x)),y);}
    const hs2=h.hset,cl=o2.clip;o2.clip=(x,y)=>hs2.has(Math.floor(y)*W+Math.floor(x))&&(!cl||cl(x,y));
    S.add((x,y)=>s.t(inv(x),y),s.m,o2,[nx-(fx-s.bb[0])*kk-1,s.bb[1],nx+(s.bb[2]-fx)*kk+1,s.bb[3]]);return;}
   if(k==='style'){S.style(a[0]);return;}if(k==='mark'){S.mark(a[0]);return;}if(k==='erase'){S.erase(a[0]);return;}if(k==='eraseEll'){S.eraseEll(a[0],a[1],a[2],a[3]);return;}
   if(k==='px'){const out=[];a[1].forEach(([x,y])=>{const q=mp(x,y);if(q)out.push(q);});S.px(a[0],out);return;}
   if(k==='line'||k==='lineIn'){const p0=mp(a[0],a[1]),p1=mp(a[2],a[3]);if(!p0||!p1)return;if(k==='line')S.line(p0[0],p0[1],p1[0],p1[1],a[4]);else S.lineIn(p0[0],p0[1],p1[0],p1[1],a[4],a[5]);return;}
   if(k==='dot'){const [cx,cy,rx,ry,c]=a;const h=hostPt(cx,cy);if(!h){S.dot(cx,cy,rx,ry,c);return;}if(h.far){S.dot(cx+fdx,cy+fdy,rx,ry,c);return;}const r=mapX(h,cx,cy);if(!r)return;S.dot(r.x,cy,Math.max(.6,rx*r.k),ry,c);}});
  return S.render();};
 return (ret&&ret!==P&&ret.render)?ret:P;}
function shadowed(img){const sh='#1F1F2461',w=img.w,h=img.h,col=img.col;let yb=-1;for(let y=h-1;y>=0&&yb<0;y--)for(let x=0;x<w;x++)if(col[y*w+x]){yb=y;break;}
 let mn=w,mx=0;for(let y=Math.max(0,yb-3);y<=yb;y++)for(let x=0;x<w;x++)if(col[y*w+x]){mn=Math.min(mn,x);mx=Math.max(mx,x);}
 const fl=yb<h-8,H2=h+6,out=new Array(w*H2).fill(null);for(let i=0;i<w*h;i++)out[i]=col[i];
 const cx=(mn+mx+1)/2,cy=fl?h+2:yb+1.5,rx=Math.max(4,(mx-mn+1)*(fl?.36:.58)),ry=fl?1.8:2.6;
 for(let y=0;y<H2;y++)for(let x=0;x<w;x++){if(out[y*w+x])continue;if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1)out[y*w+x]=sh;}return {w,h:H2,col:out};}
export { hero, pet, crop, PRE, PETS, HAIRS, HAIR_N, EYES, EYES_N, MOUTHS, MOUTH_N, TOPS, TOPS_N, PANTS, PANTS_N, SKIN, HAIR, CLOTH, IRIS, GEAR };

// ── Liegen / Umfallen: dieselben Formen werden gedreht oder gespiegelt neu gezeichnet (saubere Kontur, Licht bleibt oben links) ──
// T = {f:(x,y)=>[X,Y], i:(X,Y)=>[x,y]}; opt.only = Abschnitte (S.mark), die gezeichnet werden (z. B. ['weapon']).
function xformSprite(real,W,H,T,opt){opt=opt||{};const S=real(W,H),P={};let sec='body';
 const tp=(x,y)=>T.f(x,y),ip=(X,Y)=>T.i(X,Y),skip=()=>opt.only?!opt.only.includes(sec):(opt.skip&&opt.skip.includes(sec));
 const oo=o=>{if(!o)return o;const r=Object.assign({},o);if(o.clip){const c=o.clip;r.clip=(X,Y)=>c(...ip(X,Y));}if(o.tex){const t=o.tex;r.tex=(X,Y)=>{const q=ip(X+.5,Y+.5);return t(Math.floor(q[0]),Math.floor(q[1]));};}if(o.fade)delete r.fade;return r;};
 const bbT=(x0,y0,x1,y1)=>{const q=[tp(x0,y0),tp(x1,y0),tp(x0,y1),tp(x1,y1)];return [Math.min(...q.map(p=>p[0]))-1,Math.min(...q.map(p=>p[1]))-1,Math.max(...q.map(p=>p[0]))+1,Math.max(...q.map(p=>p[1]))+1];};
 const pix=(x,y)=>{const q=tp(x+.5,y+.5);return [Math.floor(q[0]),Math.floor(q[1])];};
 P.style=k=>{S.style(k);return P;};P.mark=k=>{sec=k;return P;};
 P.ell=(cx,cy,rx,ry,m,o)=>{if(!skip())S.add((X,Y)=>{const q=ip(X,Y);return ((q[0]-cx)/rx)**2+((q[1]-cy)/ry)**2<=1;},m,oo(o),bbT(cx-rx,cy-ry,cx+rx,cy+ry));return P;};
 P.rect=(a,b,c,d,m,o)=>{if(!skip())S.add((X,Y)=>{const q=ip(X,Y);return q[0]>=a&&q[0]<=c+1&&q[1]>=b&&q[1]<=d+1;},m,oo(o),bbT(a,b,c+1,d+1));return P;};
 P.poly=(Q,m,o)=>{if(!skip())S.poly(Q.map(p=>tp(p[0],p[1])),m,oo(o));return P;};
 P.path=(Q,r0,r1,m,o)=>{if(!skip())S.path(Q.map(p=>tp(p[0],p[1])),r0,r1,m,oo(o));return P;};
 P.cap=(a,b,c,d,r0,r1,m,o)=>{if(!skip()){const p=tp(a,b),q=tp(c,d);S.cap(p[0],p[1],q[0],q[1],r0,r1,m,oo(o));}return P;};
 P.bez=(Q,r0,r1,m,o)=>{if(!skip())S.bez(Q.map(p=>tp(p[0],p[1])),r0,r1,m,oo(o));return P;};
 P.add=(t,m,o,bb)=>{if(!skip())S.add((X,Y)=>t(...ip(X,Y)),m,oo(o),bbT(bb[0],bb[1],bb[2],bb[3]));return P;};
 P.erase=t=>{if(!skip())S.erase((X,Y)=>t(...ip(X,Y)));return P;};
 P.eraseEll=(cx,cy,rx,ry)=>P.erase((x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1);
 P.px=(c,l)=>{if(!skip())S.px(c,l.map(([x,y])=>pix(x,y)));return P;};
 P.line=(a,b,c,d,col)=>{if(!skip()){const p=pix(a,b),q=pix(c,d);S.line(p[0],p[1],q[0],q[1],col);}return P;};
 P.lineIn=(a,b,c,d,col,m)=>{if(!skip()){const p=pix(a,b),q=pix(c,d);S.lineIn(p[0],p[1],q[0],q[1],col,m);}return P;};
 P.dot=(cx,cy,rx,ry,c)=>{if(skip())return P;const l=[];for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1)l.push(pix(x,y));S.px(c,l);return P;};
 P.render=()=>S.render();return P;}
// mk(w,h) → {W,H,T,opt}; alle Sprite()-Aufrufe in draw() (auch in turned()) laufen durch die Drehung.
function lieWith(draw,mk){const real=Sprite;Sprite=(w,h)=>{const q=mk(w,h);return xformSprite(real,q.W,q.H,q.T,q.opt);};try{return draw();}finally{Sprite=real;}}
// Boden: das Bild wird in starre Abschnitte (Kopf, Rumpf, Beine …) an den dünnsten Stellen geteilt; jeder Abschnitt sinkt, bis er den Boden G berührt.
// Zwischen den Abschnitten verläuft die Verschiebung stufenweise (höchstens 1 px je Spalte), die Kontur bleibt geschlossen.
function groundImg(img,G){const {w,h,col}=img,lo=new Array(w).fill(-1),hi=new Array(w).fill(-1);
 for(let x=0;x<w;x++)for(let y=0;y<h;y++)if(col[y*w+x]){if(hi[x]<0)hi[x]=y;lo[x]=y;}
 const th=lo.map((l,x)=>l<0?0:l-hi[x]+1),xs=[];for(let x=0;x<w;x++)if(th[x])xs.push(x);if(!xs.length)return img;const X0=xs[0],X1=xs[xs.length-1];
 const cuts=[];for(let x=X0+4;x<=X1-4;x++){let mL=0,mR=0;for(let d=1;d<=14;d++){if(x-d>=X0)mL=Math.max(mL,th[x-d]);if(x+d<=X1)mR=Math.max(mR,th[x+d]);}
  const loc=th[x]<=th[x-1]&&th[x]<=th[x+1];if(loc&&th[x]<=.62*Math.min(mL,mR)&&(!cuts.length||x-cuts[cuts.length-1]>=6))cuts.push(x);}
 const bnd=[X0].concat(cuts,[X1+1]),sh=new Array(w).fill(0),seg=[];
 for(let k=0;k<bnd.length-1;k++){let m=-1;for(let x=bnd[k];x<bnd[k+1];x++)m=Math.max(m,lo[x]);seg.push(m<0?0:G-m);}
 for(let k=0;k<seg.length;k++)for(let x=bnd[k];x<bnd[k+1];x++)sh[x]=seg[k];
 for(let k=1;k<bnd.length-1;k++){const c=bnd[k],a=seg[k-1],b=seg[k],r=Math.max(1,Math.ceil(Math.abs(b-a)/2));for(let x=c-r;x<c+r;x++){if(x<X0||x>X1)continue;const t=(x-(c-r)+.5)/(2*r);sh[x]=Math.round(a+(b-a)*t);}}
 const sm=sh.slice();for(let x=X0;x<=X1;x++){let v=sm[x];for(let d=1;d<=6;d++){if(x-d>=X0)v=Math.min(v,sm[x-d]+d);if(x+d<=X1)v=Math.min(v,sm[x+d]+d);}sh[x]=Math.min(v,G-lo[x]);}
 const out=new Array(w*h).fill(null);for(let x=0;x<w;x++)for(let y=0;y<h;y++){const c=col[y*w+x];if(!c)continue;const Y=y+sh[x];if(Y>=0&&Y<h)out[Y*w+x]=c;}return {w,h,col:out};}
const bboxOf=img=>{let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++)if(img.col[y*img.w+x]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return {x0,y0,x1,y1};};
const place=(parts,W,H)=>{const col=new Array(W*H).fill(null);for(const [img,ox,oy] of parts)for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){const c=img.col[y*img.w+x];if(!c)continue;const X=x+ox,Y=y+oy;if(X>=0&&Y>=0&&X<W&&Y<H)col[Y*W+X]=c;}return {w:W,h:H,col};};
// 90° nach hinten: Blick nach rechts (dir 1) → Kopf links; Blick nach links (dir −1) → Kopf rechts. Rücken unten, Gesicht nach oben.
const LIE90=(dir,pad)=>(w,h)=>({W:h+2*pad,H:w+2*pad,T:dir>0?{f:(x,y)=>[y+pad,w-x+pad],i:(X,Y)=>[w-(Y-pad),X-pad]}:{f:(x,y)=>[h-y+pad,x+pad],i:(X,Y)=>[Y-pad,h-(X-pad)]}});
// Auf den Rücken gerollt (Beine oben): senkrecht gespiegelt.
const FLIP=(pad)=>(w,h)=>({W:w+2*pad,H:h+2*pad,T:{f:(x,y)=>[x+pad,h-y+pad],i:(X,Y)=>[X-pad,h-(Y-pad)]}});
// Kippen um den Fußpunkt (px,py) mit Winkel a (rad, negativ = nach hinten für Blick rechts).
const TILT=(a,px,py,pad,L)=>(w,h)=>{const c=Math.cos(a),s=Math.sin(a),f=(x,y)=>[px+(x-px)*c-(y-py)*s+pad+L,py+(x-px)*s+(y-py)*c+pad],i=(X,Y)=>{const u=X-pad-L-px,v=Y-pad-py;return [px+u*c+v*s,py-u*s+v*c];};return {W:w+2*pad+L,H:h+2*pad,T:{f,i}};};
const lowestRow=img=>bboxOf(img).y1;
// Held liegt (Kampfansicht, Blick rechts): X-Augen, vorderer Arm über den Kopf geworfen, Waffe liegt vor ihm am Boden.
// Ergebnis im Koordinatensystem des stehenden Helden (54×81): ox = Versatz nach links, Boden = unterste Fußzeile des Stehbilds.
export function heroDown(cfg){return heroDownB(cfg);}
export function heroKneel(cfg){return heroPose(cfg,'kneel',BACK_P);}
function heroDownOld(cfg){const g=cfg.gear||{},noW=Object.assign({},g);delete noW.weapon;
 const stand=turned(()=>hero(Object.assign({},cfg,{face:1})),1,34,{sort:false}).render(),GY=lowestRow(stand),PAD=10;
 const body=lieWith(()=>turned(()=>hero(Object.assign({},cfg,{face:1,gear:noW,pose:{lx:-2,ly:-25,eyes:'ko',mouth:'offen'}})),1,34,{sort:false}).render(),LIE90(1,PAD));
 const bb=bboxOf(body),bw=bb.x1-bb.x0+1,W=bw+8,H=GY+4;
 let img=place([[body,-bb.x0+2,GY-bb.y1]],W,H);img=groundImg(img,GY);
 if(g.weapon){const wimg=lieWith(()=>turned(()=>hero(Object.assign({},cfg,{face:1})),1,34,{sort:false}).render(),(w,h)=>Object.assign(LIE90(1,PAD)(w,h),{opt:{only:['weapon']}}));
  const wb=bboxOf(wimg);if(wb.x1>=0){const ww=wb.x1-wb.x0+1,wx=Math.round((W-ww)/2)+4,wy=GY+2-wb.y1;const W2=Math.max(W,wx+ww+2),H2=GY+4;
   img=place([[img,0,0],[wimg,wx-wb.x0,wy]],W2,H2);}}
 img.ox=-Math.round(img.w/2-27+8);return img;}
// Zwischenbild beim Umfallen: 50° nach hinten gekippt, unterster Punkt auf dem Boden.
export function heroFall(cfg){return heroPose(cfg,'fall',BACK_P);}
function heroFallOld(cfg){const stand=turned(()=>hero(Object.assign({},cfg,{face:1})),1,34,{sort:false}).render(),GY=lowestRow(stand),PAD=6;
 const im=lieWith(()=>turned(()=>hero(Object.assign({},cfg,{face:1,pose:{hx:-2,hy:-6,lx:-4,ly:-14,eyes:'ko',mouth:'offen'}})),1,34,{sort:false}).render(),TILT(-.87,27,GY,PAD,60));
 const bb=bboxOf(im),W=bb.x1-bb.x0+5,img=place([[im,-bb.x0+2,GY-bb.y1]],W,GY+4);img.ox=bb.x0-2-PAD-60;return img;}
// Gefährte liegt: Vierbeiner und Kleintiere rollen auf den Rücken (Beine oben), aufrechte Tiere fallen nach hinten, Schlange/Schleim sacken zusammen (zur Laufzeit).
export const PET_KO={baer:'lie',pinguin:'lie',eule:'lie',papagei:'lie',adler:'lie',schildkroete:'flip',schlange:'flat',schleim:'flat',krake:'flat'};
// Zusammensacken (Vierbeiner, Kleintiere, Flieger): Beine knicken ein (Zeilen zwischen Bauch und Pfoten fallen weg), die Pfoten bleiben sichtbar,
// Flieger landen vorher auf dem Boden. Augen werden zu X (Glanzpunkt #ffffff + dunkles Auge → X in Augenfarbe).
function collapse(img,GY){const {w,h,col}=img;let yb=-1,yt=h;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(col[y*w+x]){yt=Math.min(yt,y);yb=Math.max(yb,y);}
 let src=col;if(yb<GY){const s=GY-yb,n=new Array(w*h).fill(null);for(let y=0;y<h-s;y++)for(let x=0;x<w;x++)n[(y+s)*w+x]=col[y*w+x];src=n;yt+=s;yb=GY;}
 const cnt=[];let mx=0;for(let y=0;y<h;y++){let n=0;for(let x=0;x<w;x++)if(src[y*w+x])n++;cnt.push(n);mx=Math.max(mx,n);}
 const runs=y=>{let n=0,w0=0,inr=false,best=0,cur=0;for(let x=0;x<w;x++){if(src[y*w+x]){if(!inr){n++;inr=true;cur=0;}cur++;best=Math.max(best,cur);}else inr=false;}return [n,best];};
 let belly=yb;while(belly>yt){const [n,b]=runs(belly);if(n===1&&b>=.45*mx)break;belly--;}const k=Math.max(0,(yb-2)-belly);
 const out=new Array(w*h).fill(null);for(let y=0;y<h;y++){const Y=y<=belly?y+k:(y>=yb-1?y:-1);if(Y<0||Y>=h)continue;for(let x=0;x<w;x++){const c=src[y*w+x];if(c)out[Y*w+x]=c;}}
 xEyes(out,w,h);return {w,h,col:out};}
function xEyes(col,w,h){const isW=c=>c&&c.toLowerCase()==='#ffffff',lum=c=>{const n=parseInt(c.slice(1,7),16);return ((n>>16)&255)+((n>>8)&255)+(n&255);};const done=new Set();
 for(let i=0;i<col.length;i++){if(!isW(col[i]))continue;const x=i%w,y=(i/w)|0;const dk=[];for(let dy=-1;dy<=2;dy++)for(let dx=-2;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=w||Y>=h)continue;const c=col[Y*w+X];if(c&&!isW(c)&&lum(c)<150)dk.push([X,Y,c]);}
  if(dk.length<2||dk.length>9)continue;const cx=Math.round(dk.reduce((a,p)=>a+p[0],0)/dk.length),cy=Math.round(dk.reduce((a,p)=>a+p[1],0)/dk.length),key=cx+','+cy;if(done.has(key))continue;done.add(key);
  const ink=dk.sort((a,b)=>lum(a[2])-lum(b[2]))[0][2];const fill={};for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const c=col[(cy+dy)*w+cx+dx];if(c&&!isW(c)&&lum(c)>=150)fill[c]=(fill[c]||0)+1;}
  const fc=Object.keys(fill).sort((a,b)=>fill[b]-fill[a])[0];if(!fc)continue;
  for(const [X,Y] of dk)col[Y*w+X]=fc;col[i]=fc;[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]].forEach(([dx,dy])=>{const X=cx+dx,Y=cy+dy;if(X>=0&&Y>=0&&X<w&&Y<h&&col[Y*w+X])col[Y*w+X]=ink;});}}
export function petDown(kind,color){const how=PET_KO[kind]||'collapse';if(how==='flat')return null;const d=PET_TURN[kind],draw=()=>d?turned(()=>pet(kind,color),1,d,{sort:true}).render():pet(kind,color).render();
 const base=draw(),sh=petShadowOf(base),GY=sh.fl?Math.round(sh.cy)-1:sh.yb,PAD=6;
 if(how==='collapse'){const img=collapse({w:base.w,h:GY+3,col:base.col.slice(0,base.w*(GY+3)).concat(new Array(Math.max(0,base.w*(GY+3)-base.col.length)).fill(null))},GY);img.ox=0;img.hd='r';return img;}
 const im=lieWith(draw,how==='lie'?LIE90(1,PAD):FLIP(PAD)),bb=bboxOf(im),W=bb.x1-bb.x0+3,img=groundImg(place([[im,-bb.x0+1,GY-bb.y1]],W,GY+3),GY);
 xEyes(img.col,img.w,img.h);img.ox=Math.round(base.w/2-W/2);img.hd=how==='lie'?'l':'r';return img;}

// Gelenk-Rig für Liege- und Fallposen: jede Zeichenroutine gehört zu einem Abschnitt (mark). Jeder Abschnitt hat starre Teile (Drehung um ein Gelenk),
// Knie werden über 6 dünne Scheiben mit Zwischenwinkeln gebogen. Alles bleibt EIN Sprite: Kontur und Licht werden auf der fertigen Pose berechnet.
function rigSprite(real,W,H,rig){const S=real(W,H),P={W,H};let sec='body';const G=rig.G!==undefined?rig.G:1e9;
 const pcs=()=>rig.sec[sec]!==undefined?rig.sec[sec]:(rig.def||[]);
 const bbP=(bb,Lp)=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of Lp)for(const [x,y] of [[bb[0],bb[1]],[bb[2],bb[1]],[bb[0],bb[3]],[bb[2],bb[3]]]){const q=p.f(x,y);if(q[0]<x0)x0=q[0];if(q[1]<y0)y0=q[1];if(q[0]>x1)x1=q[0];if(q[1]>y1)y1=q[1];}return [x0-1,y0-1,x1+1,Math.min(y1+1,G+1)];};
 P.add=(t,m,o,bb)=>{const Lp=pcs();if(!Lp.length)return P;o=o||{};const clip=o.clip,tex=o.tex,o2=Object.assign({},o);delete o2.clip;delete o2.fade;
  const test=(X,Y)=>{if(Y>G)return false;for(const p of Lp){const q=p.i(X,Y);if(p.reg(q[0],q[1])&&(!clip||clip(q[0],q[1]))&&t(q[0],q[1]))return true;}return false;};
  if(tex)o2.tex=(X,Y)=>{for(const p of Lp){const q=p.i(X+.5,Y+.5);if(p.reg(q[0],q[1]))return tex(Math.floor(q[0]),Math.floor(q[1]));}return 0;};
  S.add(test,m,o2,bbP(bb,Lp));return P;};
 P.ell=(cx,cy,rx,ry,m,o)=>P.add((x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1,m,o,[cx-rx-1,cy-ry-1,cx+rx+1,cy+ry+1]);
 P.rect=(a,b,c,d,m,o)=>P.add((x,y)=>x>=a&&x<=c+1&&y>=b&&y<=d+1,m,o,[a-1,b-1,c+1,d+1]);
 P.poly=(Q,m,o)=>{const xs=Q.map(p=>p[0]),ys=Q.map(p=>p[1]);return P.add((x,y)=>inPoly(Q,x,y),m,o,[Math.min(...xs)-1,Math.min(...ys)-1,Math.max(...xs)+1,Math.max(...ys)+1]);};
 P.path=(Q,r0,r1,m,o)=>{const seg=[];let tot=0;for(let i=1;i<Q.length;i++){const l=Math.hypot(Q[i][0]-Q[i-1][0],Q[i][1]-Q[i-1][1]);seg.push([Q[i-1],Q[i],tot,l]);tot+=l;}const rm=Math.max(r0,r1),xs=Q.map(p=>p[0]),ys=Q.map(p=>p[1]);
  return P.add((x,y)=>{for(const [a,b,s0,l] of seg){const dx=b[0]-a[0],dy=b[1]-a[1];let t=l?((x-a[0])*dx+(y-a[1])*dy)/(l*l):0;t=t<0?0:t>1?1:t;const g=tot?(s0+t*l)/tot:0,r=r0+(r1-r0)*g;if((x-a[0]-dx*t)**2+(y-a[1]-dy*t)**2<=r*r)return true;}return false;},m,o,[Math.min(...xs)-rm-1,Math.min(...ys)-rm-1,Math.max(...xs)+rm+1,Math.max(...ys)+rm+1]);};
 P.cap=(a,b,c,d,r0,r1,m,o)=>P.path([[a,b],[c,d]],r0,r1,m,o);
 P.bez=(Q,r0,r1,m,o)=>{const R=[];for(let i=0;i<=22;i++)R.push(bezPt(Q,i/22));return P.path(R,r0,r1,m,o);};
 P.erase=t=>{const Lp=pcs();if(Lp.length)S.erase((X,Y)=>Lp.some(p=>{const q=p.i(X,Y);return p.reg(q[0],q[1])&&t(q[0],q[1]);}));return P;};
 P.eraseEll=(cx,cy,rx,ry)=>P.erase((x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1);
 const mp=(x,y)=>{for(const p of pcs())if(p.reg(x+.5,y+.5)){const q=p.f(x+.5,y+.5);return [Math.floor(q[0]),Math.floor(q[1])];}return null;};
 const ml=l=>{const out=[];l.forEach(([x,y])=>{const q=mp(x,y);if(q&&q[1]<=G)out.push(q);});return out;};
 P.px=(c,l)=>{S.px(c,ml(l));return P;};P.line=(a,b,c,d,col)=>{S.px(col,ml(bres(a,b,c,d)));return P;};
 P.lineIn=(a,b,c,d,col,m)=>{ml(bres(a,b,c,d)).forEach(([x,y])=>S.lineIn(x,y,x,y,col,m));return P;};
 P.dot=(cx,cy,rx,ry,c)=>{const l=[];for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1)l.push([x,y]);S.px(c,ml(l));return P;};
 P.style=k=>{S.style(k);return P;};P.mark=k=>{sec=k;return P;};P.render=()=>S.render();return P;}
const RG={rot:(a,px,py,tx,ty)=>{const c=Math.cos(a),s=Math.sin(a);if(tx===undefined){tx=px;ty=py;}return {f:(x,y)=>[tx+(x-px)*c-(y-py)*s,ty+(x-px)*s+(y-py)*c],i:(X,Y)=>[px+(X-tx)*c+(Y-ty)*s,py-(X-tx)*s+(Y-ty)*c]};},
 mv:(dx,dy)=>({f:(x,y)=>[x+dx,y+dy],i:(X,Y)=>[X-dx,Y-dy]}),
 comp:(...T)=>({f:(x,y)=>{let q=[x,y];for(let k=T.length-1;k>=0;k--)q=T[k].f(q[0],q[1]);return q;},i:(X,Y)=>{let q=[X,Y];for(let k=0;k<T.length;k++)q=T[k].i(q[0],q[1]);return q;}}),
 pc:(T,reg)=>({f:T.f,i:T.i,reg:reg||(()=>true)}),
 // Glied mit Gelenk J, Achse u (Richtung vom proximalen zum distalen Teil): proximal starr (T0), distal um theta gebogen, dazwischen n Scheiben.
 bend:(T0,J,u,theta,b,n)=>{b=b||2.6;n=n||6;const m=.4,w=2*b/n,s=(x,y)=>(x-J[0])*u[0]+(y-J[1])*u[1],out=[RG.pc(T0,(x,y)=>s(x,y)<-b+m)];
  for(let k=0;k<n;k++){const lo=-b+k*w-m,hi=-b+(k+1)*w+m;out.push(RG.pc(RG.comp(T0,RG.rot(theta*(k+.5)/n,J[0],J[1])),(x,y)=>{const v=s(x,y);return v>=lo&&v<=hi;}));}
  out.push(RG.pc(RG.comp(T0,RG.rot(theta,J[0],J[1])),(x,y)=>s(x,y)>b-m));return out;}};
function rigWith(draw,W,H,rig){const real=Sprite;Sprite=(w,h)=>rigSprite(real,W,H,rig);try{return draw();}finally{Sprite=real;}}

// Posen fürs Umfallen (Kampfansicht, Blick rechts): 'kneel' Knie geben nach, 'fall' kippt nach vorn und fängt sich mit den Händen, 'down' liegt auf dem Bauch.
// Liegend: Kopf zur Kamera gedreht (Wange am Boden, X-Augen), vorderer Arm hängt vor der Brust zum Boden, hinterer Arm nach vorn gestreckt,
// vorderes Bein im Knie angewinkelt (Unterschenkel hoch), hinteres Bein gestreckt mit gestrecktem Fuß, Waffe liegt am Boden.
// Ergebnis im Koordinatensystem des stehenden Helden (54×81): ox = Versatz des Bildes nach links/rechts, unterste Zeile = Bodenzeile des Stehbilds.
const HP_J={hip:[27,58],hipN:[23,57],hipF:[30,57],kneeN:[23,66],kneeF:[30,65.5],ankN:[23,74.5],ankF:[30,74],shN:[15.5,39.5],shF:[36.5,39.5],neck:[27,34],head:[27,19.5]};
const WEAPON_TILT={speer:.16,stab:.12,bogen:0,dolch:.45};
function heroPose(cfg,name,PT){const g=cfg.gear||{},noW=Object.assign({},g);delete noW.weapon;const J=HP_J,R=RG;
 const stand=turned(()=>hero(Object.assign({},cfg,{face:1})),1,34,{sort:false}).render(),GY=lowestRow(stand),OFF=50,W=54+2*OFF,H=GY+1,G=GY;
 const P=(PT||{kneel:{t:.26,h:.22,aN:-.42,aF:-.3,lN:-.26,lF:-.2,kN:1.57,kF:1.57,fN:1.35,fF:1.35,dyN:0,dyF:0,x:-2},
  fall:{t:.98,h:.18,aN:-1.25,aF:-1.05,lN:-.55,lF:-.45,kN:1.57,kF:1.5,fN:1.3,fF:1.3,dyN:0,dyF:0,x:0},
  down:{t:1.5708,h:0,aN:-.62,aF:-2.9,lN:.12,lF:-.04,kN:1.75,kF:.18,fN:.7,fF:1.3,dyN:3,dyF:0,x:6,k:.7}})[name];
 const k=P.k||1,xf=39,Sc={f:(x,y)=>[xf-(xf-x)*k,y],i:(X,Y)=>[xf-(xf-X)/k,Y]},sc=p=>[xf-(xf-p[0])*k,p[1]],JS={};for(const q in J)JS[q]=sc(J[q]);
 const wrap=L=>L.map(p=>({f:(x,y)=>{const q=Sc.f(x,y);return p.f(q[0],q[1]);},i:(X,Y)=>Sc.i(...p.i(X,Y)),reg:(x,y)=>{const q=Sc.f(x,y);return p.reg(q[0],q[1]);}}));
 const Tt=R.rot(P.t,JS.hip[0],JS.hip[1]);
 const leg=(hj,kn,an,a,k,f,dy)=>R.chain(R.comp(R.mv(0,dy),Tt,R.rot(a,hj[0],hj[1])),[{J:kn,u:[0,1],th:k,b:2.6},{J:an,u:[0,1],th:f,b:1.8,n:4}]);
 const sec={torso:wrap([R.pc(Tt)]),legN:wrap(leg(JS.hipN,JS.kneeN,JS.ankN,P.lN,P.kN,P.fN,P.dyN)),legF:wrap(leg(JS.hipF,JS.kneeF,JS.ankF,P.lF,P.kF,P.fF,P.dyF)),
  armN:wrap([R.pc(R.comp(Tt,R.rot(P.aN,JS.shN[0],JS.shN[1])))]),armF:wrap([R.pc(R.comp(Tt,R.rot(P.aF,JS.shF[0],JS.shF[1])))]),weapon:[]};
 if(P.hold&&g.weapon)sec.weapon=sec.armF;
 const lying=name==='down';
 if(!lying){const Th=wrap([R.pc(R.comp(Tt,R.rot(P.h,JS.neck[0],JS.neck[1])))]);sec.head=Th;sec.hairB=Th;}else{sec.head=[];sec.hairB=[];}
 const eyes=name==='kneel'?{eyes:'schmal',mouth:'offen'}:{eyes:'ko',mouth:'offen'};
 const body=rigWith(()=>turned(()=>hero(Object.assign({},cfg,{face:1,gear:P.hold?g:noW,pose:Object.assign({},eyes)})),1,34,{sort:false}).render(),W,H,{G:1e9,sec:mapSec(sec,OFF)});
 // Boden: tiefster Punkt von Rumpf/Beinen auf die Bodenzeile
 let bb=bboxOf(body),dy=GY-bb.y1;
 let layers=[[body,0,dy]];
 if(lying){const nk=Tt.f(JS.neck[0],JS.neck[1]);const hc=[nk[0]+OFF+12.5,GY-dy-13.6];
  // Schwerkraft: Haar, das über das Kinn hinaus zum Körper reicht, fällt über die Schulter zum Boden.
  const sh=X=>Math.max(0,(hc[0]-X)-12)*.9,Sh={f:(x,y)=>[x,y+sh(x)],i:(X,Y)=>[X,Y-sh(X)]};
  const Th=R.comp(Sh,R.mv(hc[0]-J.head[0],hc[1]-J.head[1]),R.rot(1.5708,J.head[0],J.head[1]));
  const hf=Object.assign({},cfg,{face:0,pose:Object.assign({},eyes)});
  const back=rigWith(()=>hero(hf).render(),W,H,{G:1e9,sec:{hairB:[R.pc(Th)]},def:[]});
  const front=rigWith(()=>hero(hf).render(),W,H,{G:1e9,sec:{head:[R.pc(Th)]},def:[]});
  layers=[[back,0,dy]].concat(layers,[[front,0,dy]]);}
 // Waffe liegt am Boden
 if(g.weapon&&!P.hold){const T=g.weapon.type,tl=WEAPON_TILT[T]!==undefined?WEAPON_TILT[T]:.34,long=['speer','stab','bogen'].includes(T);
  const wim=rigWith(()=>turned(()=>hero(Object.assign({},cfg,{face:1,pose:{wa:-tl}})),1,34,{sort:false}).render(),W,H,{G:1e9,sec:{weapon:[R.pc(R.rot(1.5708+(long?0:-.12),27+OFF,40,27+OFF,40))]},def:[]});
  const wb=bboxOf(wim);if(wb.x1>=0){const tx=lying?(long?OFF+12:OFF+74):(long?OFF+6:OFF+46),wx=tx-wb.x0,wy=GY-1-wb.y1;layers=[[wim,wx,wy]].concat(layers);}}
 let img=placeClip(layers,W,H,GY);const b2=bboxOf(img),x0=Math.max(0,b2.x0-2),x1=Math.min(W-1,b2.x1+2);
 const out={w:x1-x0+1,h:H,col:new Array((x1-x0+1)*H).fill(null)};for(let y=0;y<H;y++)for(let x=x0;x<=x1;x++)out.col[y*out.w+x-x0]=img.col[y*W+x];
 out.ox=x0-OFF+P.x;out.hd=lying?'r':'r';return out;}
function mapSec(sec,OFF){const o={};for(const k in sec)o[k]=sec[k].map(p=>({reg:p.reg,f:(x,y)=>{const q=p.f(x,y);return [q[0]+OFF,q[1]];},i:(X,Y)=>p.i(X-OFF,Y)}));return o;}
function placeClip(parts,W,H,GY){const col=new Array(W*H).fill(null);for(const [img,ox,oy] of parts)for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){const c=img.col[y*img.w+x];if(!c)continue;const X=x+ox,Y=y+oy;if(X<0||Y<0||X>=W||Y>=H||Y>GY)continue;col[Y*W+X]=c;}return {w:W,h:H,col};}
RG.chain=(T0,joints)=>{const out=[],m=.4;const sj=(j,x,y)=>(x-j.J[0])*j.u[0]+(y-j.J[1])*j.u[1];
 const rec=(k,T,pre)=>{if(k===joints.length){out.push(R2(T,pre));return;}const j=joints[k],b=j.b||2.6,n=j.n||6,w=2*b/n;
  out.push(R2(T,(x,y)=>pre(x,y)&&sj(j,x,y)<-b+m));
  for(let q=0;q<n;q++){const lo=-b+q*w-m,hi=-b+(q+1)*w+m;out.push(R2(RG.comp(T,RG.rot(j.th*(q+.5)/n,j.J[0],j.J[1])),(x,y)=>{if(!pre(x,y))return false;const v=sj(j,x,y);return v>=lo&&v<=hi;}));}
  rec(k+1,RG.comp(T,RG.rot(j.th,j.J[0],j.J[1])),(x,y)=>pre(x,y)&&sj(j,x,y)>b-m);};
 const R2=(T,reg)=>({f:T.f,i:T.i,reg});rec(0,T0,()=>true);return out;};
export { xformSprite, lieWith, groundImg, LIE90, FLIP, TILT, rigSprite, rigWith, RG, heroPose };
export function toCanvas(img, scale = 1) {
  const c = document.createElement('canvas'); c.width = img.w * scale; c.height = img.h * scale;
  const x = c.getContext('2d');
  img.col.forEach((col, i) => { if (col) { x.fillStyle = col; x.fillRect((i % img.w) * scale, Math.floor(i / img.w) * scale, scale, scale); } });
  return c;
}
// cfg: { skin 0–15 (ab 8 Fantasie), hair 0–19, hairC 0–11, eyes 0–11, iris 0–7, mouth 0–11, top 0–11, topC 0–11, top2C 0–11, pants 0–11, pantsC 0–11, build 0–2, gear: GEAR.* } · Gefährte: PETS[0–19], Farbe 0–5
export const renderHero = (cfg, scale = 2) => toCanvas(hero(cfg).render(), scale);
export const renderHead = (cfg, scale = 2) => toCanvas(crop(hero(cfg).render(), 10, 0, 34, 34), scale);
export const renderPet = (kind, color, scale = 2) => toCanvas(pet(kind, color).render(), scale);

export const WEAPON_TYPES = ['schwert', 'dolch', 'speer', 'axt', 'hammer', 'stab', 'bogen', 'streitkolben'];
// Figur im Kampf in 3/4-Ansicht: dir 1 = schaut nach rechts (zum Gegner), -1 = nach links. Inklusive Pixel-Schatten.
export function renderHeroFacing(cfg, dir = 1, scale = 2) { return toCanvas(shadowed(turned(() => hero(Object.assign({}, cfg, { face: dir })), dir, 34, { sort: false }).render()), scale); }
export { turned, shadowed };

// Gefährte noch nicht freigespielt (8.10): graue Silhouette. Jede Farbe nach Helligkeit L = .299·R + .587·G + .114·B
// auf 3 Grautöne: L < 90 → #8f8a7d, L < 175 → #c9c4b3, sonst #dad5c5. Umriss und Pixel bleiben exakt die des Gefährten.
export function petSilhouette(img) {
  const G = ['#8f8a7d', '#c9c4b3', '#dad5c5'];
  return { w: img.w, h: img.h, col: img.col.map(c => { if (!c) return null; const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16), l = .299 * r + .587 * g + .114 * b; return l < 90 ? G[0] : l < 175 ? G[1] : G[2]; }) };
}
export const renderPetSilhouette = (kind, scale = 2) => { const p = PETS.find(q => q[0] === kind); return toCanvas(petSilhouette(pet(kind, p[2][0]).render()), scale); };

// ── Gefährte im Kampf ────────────────────────────────────────────────────────
// Steht vor dem Helden an derselben Stelle, nur leicht zum Gegner versetzt: Mitte = Fußmitte des Helden + 24 px, Fußlinie 4 px tiefer (weiter vorn).
// Verdeckt so die Beine des Helden, Kopf und Oberkörper bleiben sichtbar. Blick nach rechts zum Gegner, 2×, eigener Pixel-Schatten.
// Im Helden-Container (108 × 174, position:relative): left:38px; bottom:-4px; margin-left:-12px; margin-top:-8px; 104 × 100 (Bild 52 × 50 inkl. Rand, s. petFrames); z-index 3 (Held: z-index 2). Niederlage: gleiche Stelle vor dem liegenden Helden.
export const PET_BATTLE = { scale: 2, offsetX: 24, offsetY: 4, left: 38, bottom: -4, width: 104, height: 100, marginLeft: -12, marginTop: -8, padX: 6, padTop: 4, zIndex: 3, heroZIndex: 2, idleFps: 4, actionFps: 8, loop: 16 };
// Kampfansicht der Gefährten: frontal gezeichnete Arten (PET_TURN, Drehung in Grad) werden wie der Held mit turned() zum Gegner gedreht.
// Alle übrigen sind schon im Profil nach rechts gezeichnet und bleiben unverändert. Menüs (Profil, Freunde, Auswahl) zeigen weiter pet().
export const PET_TURN = { eule: 24, krake: 24, frosch: 24, pinguin: 24, baer: 24, fledermaus: 24, schleim: 24 };
function mirrorImg(img) { const { w, h, col } = img, o = new Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = col[y * w + w - 1 - x]; return { w, h, col: o }; }
export function petFacing(kind, color, dir = 1) { const d = PET_TURN[kind], img = d ? turned(() => pet(kind, color), 1, d, { sort: true }).render() : pet(kind, color).render(); return dir < 0 ? mirrorImg(img) : img; }
export const renderPetFacing = (kind, color, dir = 1, scale = 2) => toCanvas(petFacing(kind, color, dir), scale);
// Schatten: steht der Gefährte, liegt er unter den Füßen. Schwebt er (unterstes Pixel mehr als 8 px über dem Boden, z. B. Biene, Fledermaus), liegt ein kleinerer Schatten auf dem Boden.
function petShadowOf(img) { const { w, h, col } = img; let yb = -1; for (let y = h - 1; y >= 0 && yb < 0; y--) for (let x = 0; x < w; x++) if (col[y * w + x]) { yb = y; break; }
  let mn = w, mx = 0; for (let y = Math.max(0, yb - 3); y <= yb; y++) for (let x = 0; x < w; x++) if (col[y * w + x]) { mn = Math.min(mn, x); mx = Math.max(mx, x); }
  const fl = yb < h - 8; return { cx: (mn + mx + 1) / 2, cy: fl ? h + .5 : yb + 1.5, rx: Math.max(4, (mx - mn + 1) * (fl ? .36 : .58)), ry: fl ? 1.8 : 2.6, yb, fl }; }
// anim: 'idle' (4 Bilder, 4 fps: Oberkörper 1 px runter in Bild 2–3, Beine bleiben; schwebende Gefährten wippen ganz) · 'attack' (4 Bilder, 8 fps: Sprung nach vorn, Schatten wird kleiner) · 'hurt' (4 Bilder, 8 fps: 2 px zurück, Bild 2 hell aufblitzend).
// Ergebnis: 4 Bilder { w: w + 12, h: h + 10, col, px: 6, pt: 4 } inklusive Pixel-Schatten, für jede Ansicht (img). Rand: 6 px links und rechts, 4 px oben,
// damit Sprung (dx +4, dy −3) und Zurückzucken (dx −2) nie abgeschnitten werden. Einbau: Canvas um px · Maßstab nach links und pt · Maßstab nach oben versetzen
// (margin-left/-right: −px·sc, margin-top: −pt·sc), dann steht der Gefährte an derselben Stelle wie ohne Rand.
export // Gefährte im Kampf (Niederlage: bricht vor Bauch/Beinen des liegenden Helden zusammen, dx +30, damit dessen Gesicht frei bleibt): je Ablauf 4 Bilder. idle 4 fps · attack/hurt/win 8 fps · die 8 fps (Blitz, zuckt, fällt, liegt) · ko 4 fps (liegt, 3 Sterne kreisen).
// Gefährte im Kampf (8 fps): idle/attack/hurt/win je 4 Bilder, Rand 6 px links/rechts, 4 px oben.
// Niederlage 'die' = 6 Bilder wie beim Helden: Blitz, bäumt sich auf (~rear), wird rückwärts vom Gegner weggeschleudert (~air), landet auf dem Rücken (~down, Kopf links, Beine hoch), federt 1 px nach, liegt.
// 'ko' = 4 Bilder mit 4 fps: liegt, drei Sterne kreisen über dem Kopf. P = petPoses(kind, color) = { rear, air, down } mit ox/oy zum Stehbild. Jedes Bild trägt px/pt (Rand), damit es an der alten Stelle liegt.
function petFrames(img, anim = 'idle', P = null) {
  const { w, h, col } = img, sh = petShadowOf(img), H = h + 6, split = sh.fl ? H : sh.yb - 6, GY = sh.fl ? h : sh.yb;
  const TK = ['..K..', '.KWK.', 'KWYWK', '.KWK.', '..K..'], TC = { K: '#1F1F24', W: '#FFFFFF', Y: '#FFD66B' }, SHC = '#1F1F2461';
  const lite = v => { const n = parseInt(v.slice(1, 7), 16), m = t => Math.round(t + (255 - t) * .6); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(t => m(t).toString(16).padStart(2, '0')).join(''); };
  const SP = { idle: { dx: [0,0,0,0], dy: [0,0,0,0], up: [0,1,1,0], fl: -1, rs: [1,1,1,1] }, attack: { dx: [0,2,4,1], dy: [0,-3,-2,0], up: [0,0,0,0], fl: -1, rs: [1,.8,.85,1] }, hurt: { dx: [0,-2,-1,0], dy: [0,0,0,0], up: [0,0,0,0], fl: 1, rs: [1,1,1,1] },
    win: { dx: [0,0,0,0], dy: [0,-3,-4,-1], up: [1,0,0,0], fl: -1, rs: [1,.75,.7,.9] } }[anim];
  const canvas = (W2, H2) => new Array(W2 * H2).fill(null);
  const ell = (c, W2, PX, PT, scx, rx) => { for (let y = 0; y < H; y++) for (let x = -PX; x < w + PX; x++) if (((x + .5 - scx) / rx) ** 2 + ((y + .5 - sh.cy) / sh.ry) ** 2 <= 1) c[(y + PT) * W2 + x + PX] = SHC; };
  if (SP) { const PX = 6, PT = 4, W2 = w + 2 * PX, H2 = H + PT, out = [];
    for (let f = 0; f < 4; f++) { const c = canvas(W2, H2); ell(c, W2, PX, PT, sh.cx, sh.rx * SP.rs[f]);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = col[y * w + x]; if (!v) continue; if (f === SP.fl) v = lite(v); const xx = x + SP.dx[f] + PX, yy = y + (y < split ? SP.up[f] : 0) + SP.dy[f] + PT; if (xx >= 0 && yy >= 0 && xx < W2 && yy < H2) c[yy * W2 + xx] = v; }
      out.push({ w: W2, h: H2, col: c, px: PX, pt: PT }); }
    return out; }
  if (anim !== 'die' && anim !== 'ko') return [];
  const src = P && P.col ? { down: P } : (P || {}), Q = {}; for (const k of ['rear', 'air', 'down']) if (src[k]) Q[k] = Object.assign({ ox: 0, oy: 0, hd: 'l' }, src[k]);
  const bnd = q => { let a = 1e9, b = -1; for (let k = 0; k < q.col.length; k++) if (q.col[k]) { const x = k % q.w; if (x < a) a = x; if (x > b) b = x; } return [q.ox + a, q.ox + b]; };
  let X0 = 0, X1 = w - 1, Y0 = 0, Y1 = H - 1; for (const k in Q) { const q = Q[k]; X0 = Math.min(X0, q.ox); X1 = Math.max(X1, q.ox + q.w - 1); Y0 = Math.min(Y0, q.oy); Y1 = Math.max(Y1, q.oy + q.h - 1); }
  let st = null; const D = Q.down; if (D) { const [dl, dr] = bnd(D), hx = D.hd === 'l' ? dl + 8 : dr - 8; let ty = 1e9; for (let y = 0; y < D.h; y++) for (let x = hx - D.ox - 3; x <= hx - D.ox + 3; x++) if (x >= 0 && x < D.w && D.col[y * D.w + x]) ty = Math.min(ty, y); st = { hx, ty: (ty < 1e9 ? ty + D.oy : GY - 12) - 6 }; Y0 = Math.min(Y0, st.ty - 3); }
  const PX = Math.max(6, -X0 + 3, X1 - (w - 1) + 3), PT = Math.max(4, -Y0 + 2), W2 = w + 2 * PX, H2 = Math.max(H, Y1 + 2) + PT;
  const frame = (k, o) => { const c = canvas(W2, H2), q = Q[k], put = (xx, yy, v) => { if (xx >= 0 && yy >= 0 && xx < W2 && yy < H2) c[yy * W2 + xx] = v; };
    if (!q) { ell(c, W2, PX, PT, sh.cx, sh.rx); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = col[y * w + x]; if (!v) continue; if (o.li) v = lite(v); put(x + PX, y + PT, v); } }
    else { const [l, r] = bnd(q); ell(c, W2, PX, PT, (l + r + 1) / 2, k === 'down' ? Math.max(sh.rx, (r - l + 1) * .46) : sh.rx * (k === 'air' ? .65 : .95));
      for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) { let v = q.col[y * q.w + x]; if (!v) continue; if (o.li) v = lite(v); put(x + q.ox + PX, y + q.oy + (o.dy || 0) + PT, v); }
      if (o.st && st) for (let n = 0; n < 3; n++) { const an = (o.st - 1) * Math.PI / 2 + n * 2 * Math.PI / 3, sx = Math.round(st.hx + PX + 5 * Math.cos(an)), sy = Math.round(st.ty + PT + 2 * Math.sin(an)); TK.forEach((row, jj) => { for (let ii = 0; ii < 5; ii++) { const ch = row[ii]; if (ch !== '.') put(sx - 2 + ii, sy - 2 + jj, TC[ch]); } }); } }
    return { w: W2, h: H2, col: c, px: PX, pt: PT }; };
  if (anim === 'die') return [frame(null, { li: 1 }), frame('rear', {}), frame('air', {}), frame('down', {}), frame('down', { dy: -1 }), frame('down', {})];
  return [1, 2, 3, 4].map(s => frame('down', { st: s }));
}
const _PP = {};
const petPosesC = (kind, color) => _PP[kind + color] || (_PP[kind + color] = petPoses(kind, color));
export const petBattleFrames = (kind, color, anim = 'idle') => petFrames(petFacing(kind, color, 1), anim, (anim === 'die' || anim === 'ko') ? petPosesC(kind, color) : null);
// Menü-Bühne (Profil 8.1, Freunde 8.2, Fortschritt 8.3): Figur und Gefährte als EIN Bild mit EINEM Pixel-Schatten, beide in Vorderansicht und im selben Maßstab.
// Der Gefährte steht rechts leicht vor der Figur: dx = linke Kante seines 40er-Bilds in Figur-Pixeln, dy = seine Bodenlinie liegt so viele Pixel tiefer (steht weiter vorn) und er verdeckt das hintere Bein.
// Schatten wie shadowed() bzw. petFrames() (#1F1F2461, Figur rx = Fußbreite × .58, ry 2,6; schwebende Gefährten kleiner), als Vereinigung in EINEM Ton gemalt, nie doppelt dunkel.
// Reihenfolge: Schatten → Figur → Gefährte. Das Bild ist auf die Pixel zugeschnitten und endet mit der untersten Schattenzeile: unten bündig setzen, dann ragt nichts in die UI darunter.
export function heroWithPet(heroImg, petImg, { dx = 24, dy = 3 } = {}) {
  const foot = ({ w, h, col }) => { let yb = -1; for (let y = h - 1; y >= 0 && yb < 0; y--) for (let x = 0; x < w; x++) if (col[y * w + x]) { yb = y; break; }
    let mn = w, mx = 0; for (let y = Math.max(0, yb - 3); y <= yb; y++) for (let x = 0; x < w; x++) if (col[y * w + x]) { mn = Math.min(mn, x); mx = Math.max(mx, x); }
    return { yb, mn, mx, fl: yb < h - 8 }; };
  const fh = foot(heroImg), fp = foot(petImg), gH = fh.yb + 1, gP = gH + dy, oy = fp.fl ? gP - petImg.h : gP - (fp.yb + 1);
  const E = [{ cx: (fh.mn + fh.mx + 1) / 2, cy: gH + .5, rx: Math.max(4, (fh.mx - fh.mn + 1) * .58), ry: 2.6 },
    { cx: dx + (fp.mn + fp.mx + 1) / 2, cy: gP + .5, rx: Math.max(4, (fp.mx - fp.mn + 1) * (fp.fl ? .36 : .58)), ry: fp.fl ? 1.8 : 2.6 }];
  const X0 = Math.floor(Math.min(0, dx, ...E.map(e => e.cx - e.rx))), X1 = Math.ceil(Math.max(heroImg.w, dx + petImg.w, ...E.map(e => e.cx + e.rx))),
    Y0 = Math.min(0, oy), Y1 = Math.ceil(Math.max(heroImg.h, oy + petImg.h, ...E.map(e => e.cy + e.ry)));
  const W = X1 - X0, H = Y1 - Y0, col = new Array(W * H).fill(null);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const px = x + X0 + .5, py = y + Y0 + .5; if (E.some(e => ((px - e.cx) / e.rx) ** 2 + ((py - e.cy) / e.ry) ** 2 <= 1)) col[y * W + x] = '#1F1F2461'; }
  const put = (img, ox, oy2) => { for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const v = img.col[y * img.w + x]; if (v) col[(y + oy2 - Y0) * W + x + ox - X0] = v; } };
  put(heroImg, 0, 0); put(petImg, dx, oy);
  let x0 = W, x1 = -1, y0 = H, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (col[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w2 = x1 - x0 + 1, h2 = y1 - y0 + 1, out = new Array(w2 * h2); for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) out[y * w2 + x] = col[(y + y0) * W + x + x0];
  return { w: w2, h: h2, col: out };
}
export const renderHeroWithPet = (cfg, kind, color, scale = 2, opts) => toCanvas(heroWithPet(hero(cfg).render(), pet(kind, color).render(), opts), scale);
// Menü (Profil, Freunde): Vorderansicht mit Pixel-Schatten = erstes Stehen-Bild, ohne den Bewegungsrand.
export const petMenuImage = (kind, color) => { const f = petFrames(pet(kind, color).render(), 'idle')[0]; return crop(f, f.px, f.pt, f.w - 2 * f.px, f.h - f.pt); };
// Synchron zum Helden: gleiche 16er-Schleife und gleicher Startschritt wie dessen Animation (z. B. attack@4 → start 4, hurt@7 → start 7).
// Bild f: start ≤ f < start+4 → Aktionsbild, sonst Stehen (Bild ⌊f/2⌋ mod 4). Abspielen mit 8 fps.
// Gefährte synchron zum Helden, 8 fps. anim = ein Ablauf ('attack' | 'hurt' ab start; 'win' | 'ko' Schleife; 'die' ab start einmal, danach 'ko')
// oder dieselbe Schreibweise wie data-anim in den Fragmenten: 'attack@4,hurt@12/16', 'win@9/48', 'die@3/48' (Zahl hinter / = Zykluslänge).
export function petBattleSequence(kind, color, anim, start = 4, loop = 16) {
  const F = {}, get = a => F[a] || (F[a] = petBattleFrames(kind, color, a)), idle = get('idle');
  const cyc = /\/(\d+)$/.exec(anim || ''); if (cyc) loop = +cyc[1];
  const prog = /@/.test(anim || '') ? [...anim.matchAll(/(attack|hurt|win|die)@(\d+)/g)].map(m => [m[1], +m[2]])
    : (!anim || anim === 'idle') ? [] : (anim === 'win' || anim === 'ko') ? [[anim, 0]] : [[anim, start]];
  return Array.from({ length: loop }, (_, f) => {
    let img = idle[Math.floor(f / 2) % 4];
    for (const [a, s0] of prog) { if (f < s0) continue; const e = f - s0;
      if (a === 'win') img = get('win')[e % 4];
      else if (a === 'ko') img = get('ko')[Math.floor(e / 2) % 4];
      else if (a === 'die') { const L = get('die').length; img = e < L ? get('die')[e] : get('ko')[Math.floor((e - L) / 2) % 4]; }
      else if (e < 4) img = get(a)[e]; }
    return img; });
}
// ── Ende Gefährte im Kampf ──

// SF2-Liegepose: Rückenlage in Seitenansicht, Kopf zur Seite weg vom Gegner. Körper neu gezeichnet (flach, Gewicht am Boden),
// Kopf + Hinterhaar aus der Kampfansicht um 90° gedreht (Gesicht zeigt nach oben, leicht zur Kamera). Alles EIN Sprite: Kontur und Licht auf der fertigen Pose.
const LIE={W:132,H:85,GY:79,OX:18};
function lieInj(draw,W,H,rig,inject){const real=Sprite;let done=false;
 Sprite=(w,h)=>{const P=rigSprite(real,W,H,rig),m0=P.mark;P.mark=k=>{if(!done&&k!=='hairB'){done=true;m0('__lie');inject(P);}return m0(k);};return P;};
 try{return draw();}finally{Sprite=real;}}
const LIE_W_BACK={speer:1,stab:1,bogen:1};
const LIE_W={schwert:{x:52,a:.05},dolch:{x:60,a:.08},speer:{x:48,a:-.03,y:-4},stab:{x:44,a:.03,y:-4,dir:-1},axt:{x:52,a:-.04,dir:-1},hammer:{x:54,a:.04,dir:-1},streitkolben:{x:54,a:.05,dir:-1},bogen:{x:74,a:.03,y:-2}};
function heroLie(cfg,opt){opt=opt||{};const HD=opt.deg||8;
 const c=Object.assign({skin:1,hair:0,hairC:1,eyes:0,iris:0,mouth:0,top:0,topC:0,top2C:7,pants:0,pantsC:6,build:1,blush:true,gear:{}},cfg);
 const g=c.gear||{},H=HAIRS[c.hair],T=TOPS[c.top],P=PANTS[c.pants],W=LIE.W,LH=LIE.H,GY=LIE.GY,OX=LIE.OX;
 const A=g.body?(g.body==='pp'?'gold':'steel'):null,am=g.arms?(g.arms==='pp'?'gold':'steel'):null,bm=g.legs?(g.legs==='pp'?'gold':'steel'):'boots';
 const D=[11.5,12.5,14][c.build],XL=OX+30,XR=OX+58,TOP=GY-D,bw=[9.5,10.5,12][c.build];
 const skirt=['rock','faltenrock','tuellrock','jeansrock','glockenrock'].includes(P),short=P==='shorts',baggy=P==='pluder',thin=P==='leggings',lr=thin?3:baggy?4.6:3.8,legM=(skirt||short)?'skin':'pants';
 const sm=['weste','mantel','latz'].includes(T)?'top2':'top',shortS=['shirt','kleid','latz','polo','sport','bluse','rueschen','sommerkleid'].includes(T);
 const tb=(T==='latz'||T==='weste'||T==='strickjacke')?'top2':'top',dress=T==='kleid'||T==='sommerkleid';
 const Th=RG.rot(-Math.PI/2,15.5,19.5,OX+22,GY-.5),HC=(x,y)=>y<=33.5&&Th.f(x,y)[1]<=GY+.5;
 const I={f:(x,y)=>[x,y],i:(X,Y)=>[X,Y]};
 const body=S=>{
  const FB=o=>Object.assign({},o||{},{bias:((o&&o.bias)||0)-.3}),L=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  // Haar am Boden (lange Frisuren) hinter dem Kopf
  const fan=(len,wav)=>{const R=[[-12,-13,.9],[-9,-8.5,1],[-4.5,-4.5,1.05],[-1,-1.4,.95]];R.forEach(([y0,y1,k],n)=>{const L2=len*k,w=wav?(n%2?1.6:-1.6):0;
    S.bez([[OX+11,GY+y0+4],[OX+3,GY+y0+2+w],[OX+3-L2*.45,GY+y1+w],[OX+3-L2,GY+Math.min(-1,y1*.35+2)]],3.1,1.4,'hair');});
   R.forEach(([y0,y1,k])=>{const L2=len*k;S.lineIn(OX+2,GY+y0+3,OX+3-L2*.8,GY+Math.min(-1.5,y1*.4+1.5),'hair:2','hair');});};
  if(H==='lang')fan(14,false);if(H==='wellen')fan(15,true);if(H==='halblang')fan(8,false);
  if(H==='zopf'){S.bez([[OX+9,GY-5],[OX+3,GY-7.5],[OX-4,GY-4.5],[OX-11,GY-2]],3.5,2.1,'hair');S.lineIn(OX+2,GY-6,OX-9,GY-2.5,'hair:2','hair');S.ell(OX+6,GY-5.5,1.9,1.9,'red');}
  if(H==='seitenzopf'){for(let k=0;k<6;k++)S.ell(OX+7-k*3.6,GY-2.6+k*.1,2.5-k*.08,2.3-k*.06,'hair');S.ell(OX-15,GY-2.2,1.6,1.4,'red');}
  if(H==='zoepfe'){for(let k=0;k<4;k++)S.ell(OX+6-k*3.8,GY-7.5+k*.4,2.4,2.2,'hair');S.ell(OX-9.5,GY-6,1.6,1.4,'red');for(let k=0;k<4;k++)S.ell(OX+8-k*3.8,GY-2,2.4,2.2,'hair');S.ell(OX-7.5,GY-2,1.6,1.4,'red');}
  // Mantel-Schöße am Boden
  if(T==='mantel')S.poly([[XR-9,TOP+3],[XR+6,GY-7],[XR+14,GY-4],[XR+16,GY],[XR-9,GY]],'top',{round:.5});
  // Beine: fernes gestreckt (Zehen oben), nahes mit Knie oben (Fuß flach am Boden)
  const leg=near=>{const q=near?(o=>o||{}):FB,hip=near?[XR+1,GY-6.5]:[XR,GY-5],kn=near?[XR+8,GY-15.5]:[XR+10,GY-4.4],an=near?[XR+14.5,GY-3.6]:[XR+20,GY-4.8];
   S.cap(hip[0],hip[1],kn[0],kn[1],lr,lr-.2,legM,q());S.cap(kn[0],kn[1],an[0],an[1],lr-.2,lr-.5,legM,q());
   if(short)S.cap(hip[0],hip[1],...L(hip,kn,.62),4.1,4,'pants',q({g:near?'shN':'shF'}));
   const mid=L(hip,kn,.5),mid2=L(kn,an,.5);
   if(P==='jeans'){S.lineIn(...L(hip,kn,.15),...L(kn,an,.85),'pants:2','pants');}
   if(P==='cargo'&&near)S.rect(mid[0]-1.6,mid[1]-1.2,mid[0]+1.6,mid[1]+2,'pants',q({bias:.12}));
   if(P==='sport'){S.lineIn(hip[0],hip[1]+2,kn[0]+(near?-1:0),kn[1]+2,'eyeW:5','pants');S.lineIn(kn[0]+(near?1:0),kn[1]+2,an[0],an[1]+2,'eyeW:5','pants');}
   if(P==='karo'){[.3,.7].forEach(t=>{const p=L(hip,kn,t);S.lineIn(p[0]-1,p[1]-3,p[0]+1,p[1]+3,'pants:1','pants');});S.lineIn(...L(hip,kn,.1),...L(kn,an,.9),'pants:4','pants');}
   if(P==='flicken'&&near)S.rect(kn[0]-1.6,kn[1]-.5,kn[0]+1.6,kn[1]+2.5,'top2',q({bias:.1}));
   if(P==='kniebund'){S.cap(...L(kn,an,.25),an[0],an[1],lr-.2,lr-.5,'eyeW',q());const b=L(kn,an,.25);S.cap(b[0],b[1],...L(kn,an,.32),lr-.3,lr-.3,'gold',q());}
   if(baggy)S.cap(...L(kn,an,.82),an[0],an[1],lr+.4,lr+.4,'pants',q({bias:-.2}));
   if(P==='schlag')S.poly([[...L(kn,an,.55)].map((v,i)=>v+(i?-lr+.4:0)),[an[0]+1,an[1]-lr-1.6],[an[0]+1.5,an[1]+lr+1.2],L(kn,an,.55).map((v,i)=>v+(i?lr-.4:0))],'pants',q());
   if(near){S.cap(an[0],an[1],an[0]+1,an[1]+1.2,3.7,3.7,bm,q());S.ell(an[0]+3.2,GY-1.3,4.9,2.7,bm,q());}
   else{S.cap(an[0],an[1],an[0]+1.6,an[1],3.7,3.7,bm,q());S.ell(an[0]+3.8,GY-6.8,2.8,4.6,bm,q());}};
  leg(false);
  if(T==='hoodie')S.ell(OX+29,GY-3.6,5.6,3.9,'top',{bias:-.1});
  S.rect(OX+31,GY-16,OX+38,GY-7,'skin',{bias:-.35});
  // Rumpf (Brust oben, Rücken am Boden)
  S.poly([[XL+1,TOP+3],[XL+5,TOP+.4],[XL+12,TOP-.6],[XL+20,TOP+.6],[XR-3,TOP+1.6],[XR+.5,TOP+3.6],[XR+1.5,GY-2],[XR+1,GY],[XL,GY],[XL-1,GY-3]],tb,{g:'t',round:.55});
  S.ell(XL+4.5,TOP+5.5,5.2,5.5,tb,{g:'t'});
  if(short)S.rect(XR-2,TOP+3,XR+2,GY,'pants',{g:'shN'});
  if(T==='weste'||T==='strickjacke'){S.poly([[XL+4,TOP+3],[XR-1,TOP+3.6],[XR+1.5,GY],[XL+1,GY],[XL+1,TOP+5]],'top');S.px(T==='weste'?'gold:4':'top2:5',[[XL+10,TOP+3],[XL+16,TOP+3],[XL+22,TOP+3.4]]);if(T==='strickjacke')S.px('red:3',[[XL+13,TOP+6],[XL+14,TOP+6],[XL+13,TOP+7],[XL+14,TOP+7],[XL+15,TOP+6],[XL+14,TOP+8]]);}
  if(T==='jacke'){S.poly([[XL+6,TOP+.2],[XR-3,TOP+1.8],[XR-3,TOP+3.6],[XL+6,TOP+2.2]],'top2');S.px('gold:4',[[XL+14,TOP+3.4],[XL+21,TOP+4]]);}
  if(T==='latz'){S.poly([[XL+9,TOP+.2],[XR-1,TOP+2],[XR+1.5,GY],[XR-6,GY],[XR-6,TOP+5],[XL+9,TOP+4.4]],'pants');S.cap(XL+10,TOP+2.2,XL+4,TOP+4.2,1,1,'pants');S.px('gold:4',[[XL+10,TOP+2]]);}
  if(T==='ringel')for(let x=XL+9;x<=XR-2;x+=4)S.lineIn(x,TOP+1,x,GY-1,'top2:4','top');
  if(T==='karo'){for(let x=XL+9;x<=XR-2;x+=4)S.lineIn(x,TOP+1,x,GY-1,'top:1','top');S.lineIn(XL+4,GY-D*.5,XR,GY-D*.5,'top:4','top');}
  if(T==='sport')S.lineIn(XL+5,GY-D*.55,XR,GY-D*.55,'top2:4','top');
  if(T==='rueschen')[XL+11,XL+17,XL+23].forEach(x=>{S.lineIn(x,TOP+1,x,GY-1,'top:4','top');for(let y=TOP+2;y<GY;y+=2)S.px('top:2',[[x+1,y]]);});
  if(T==='hoodie'){S.px('top2:5',[[XL+9,TOP],[XL+9,TOP+1],[XL+12,TOP],[XL+12,TOP+1]]);S.lineIn(XL+16,TOP+4,XL+23,TOP+4.5,'top:1','top');}
  if(T==='polo'){S.poly([[XL+2.5,TOP+1],[XL+8,TOP-.8],[XL+6,TOP+2.6]],'top2');S.px('top2:5',[[XL+11,TOP+1]]);}
  if(T==='bluse'){S.poly([[XL+2,TOP+1.5],[XL+8.5,TOP-1],[XL+7,TOP+2.4],[XL+3,TOP+3.4]],'eyeW');S.px('top:1',[[XL+12,TOP+.6],[XL+16,TOP+.8],[XL+20,TOP+1]]);}
  if(['shirt','ringel','kleid','latz','sport','rueschen','sommerkleid'].includes(T))S.poly([[XL+3,TOP+1.4],[XL+8,TOP-.4],[XL+5,TOP+2.8]],'skin',{bias:-.2});
  if(T==='tunika'||T==='kleid'||T==='mantel'){S.rect(XR-6,TOP+2,XR-4,GY,'leather');S.rect(XR-6.5,TOP+1.5,XR-3.5,TOP+4.5,'gold');}
  if(T==='tunika')S.poly([[XR-4,TOP+2],[XR+5,TOP+4.5],[XR+6,GY],[XR-4,GY]],'top');
  if(T==='mantel')S.ell(XL+5,TOP+.8,1.8,1.8,'gold');
  if(A){S.poly([[XL+5,TOP+1],[XR-6,TOP+2],[XR-6,GY-3],[XL+5,GY-3]],A,{round:.6});S.lineIn(XL+7,TOP+1.5,XR-7,TOP+2.2,A+':5',A);S.rect(XR-6,TOP+2,XR-4,GY,'leather');}
  leg(true);
  // Rock / Kleid fällt über die Hüfte und den hochgestellten Oberschenkel
  const sk=dress?'top':skirt?'pants':null;
  if(sk){const lng=P==='glockenrock'||T==='sommerkleid',shortK=P==='jeansrock',k=lng?1:shortK?.45:.7,kn=[XR+8,GY-15.5],hp=[XR+1,GY-6.5],e=L(hp,kn,k);
   const Q=[[XR-5,TOP+1.6],[XR,TOP+.4],[e[0]-1,e[1]-4],[e[0]+2.4,e[1]-2.6],[e[0]+3.6,GY-6],[e[0]+5,GY],[XR-5,GY]];
   if(P==='tuellrock'){S.poly(Q.map(([x,y],i)=>[x+(i===3||i===4?1.5:0),y]),'pants',{round:.7});S.px('pants:5',[[XR+2,TOP+3],[XR+5,GY-8],[XR+7,GY-3],[XR+9,GY-11]]);}
   else S.poly(Q,sk,{round:.5});
   if(P==='faltenrock')[.3,.55,.8].forEach(t=>{const p=L([XR-2,TOP+2],[e[0]+4,GY-1],t);S.lineIn(p[0]-2,p[1]-4,p[0]+1,p[1]+3,'pants:2','pants');});
   if(P==='jeansrock'){S.lineIn(XR,TOP+2,e[0]+3,GY-2,'pants:2','pants');S.lineIn(XR-3,TOP+3,XR-3,GY-1,'pants:4','pants');}
   if(P==='glockenrock'){S.rect(XR-5,TOP+1.4,XR-2.5,GY,'top2');S.lineIn(e[0]+3,e[1]-2,e[0]+4.5,GY-1,'pants:4','pants');}
   if(T==='sommerkleid'){S.rect(XR-7,TOP+1.2,XR-4.5,GY,'top2');S.px('top:5',[[XR+2,TOP+4],[XR+6,GY-10],[XR+9,GY-5],[XR+4,GY-3],[XL+14,TOP+4],[XL+20,TOP+6]]);}
   if(T==='kleid'){S.rect(XR-6,TOP+2,XR-4,GY,'leather');S.rect(XR-6.5,TOP+1.5,XR-3.5,TOP+4.5,'gold');}}
  // naher Arm liegt neben dem Körper, Ellbogen leicht zur Kamera
  const sh=[XL+6,TOP+6],el=[XL+12.5,GY-1.4],hd=[XL+20.5,GY-.6],e2=L(sh,el,.55);
  if(shortS){S.cap(sh[0],sh[1],e2[0],e2[1],3.4,3.2,sm);S.cap(e2[0],e2[1],el[0],el[1],2.6,2.5,'skin');S.cap(el[0],el[1],hd[0],hd[1],2.5,2.4,'skin');}
  else{S.cap(sh[0],sh[1],el[0],el[1],3.4,3.2,sm);S.cap(el[0],el[1],hd[0],hd[1],3.2,3,sm);}
  if(am)S.cap(el[0]+.6,el[1],hd[0]-1,hd[1],3.3,3.1,am);
  S.ell(hd[0]+1.8,hd[1]-.5,2.8,2.6,'skin');
  if(A)S.ell(sh[0]-.5,sh[1]-1.2,4.6,3.6,A);
 };
 // Waffe: liegt vor dem Körper am Boden (erst Umriss messen, dann passend setzen)
 let WP=[];
 if(g.weapon){const T2=g.weapon.type,cfgW=LIE_W[T2]||LIE_W.schwert,dir=cfgW.dir||1,hr=27+bw+2.4;
  const mkT=(tx,ty)=>RG.rot(dir*Math.PI/2+cfgW.a,hr,56,tx,ty);
  const probe=rigWith(()=>turned(()=>hero(Object.assign({},c,{face:1,pose:{wa:-(({speer:.16,stab:.12,bogen:0,dolch:.45})[T2]??.34)}})),1,34,{sort:false}).render(),W,LH+40,{G:1e9,sec:{weapon:[RG.pc(mkT(OX+cfgW.x,40))]},def:[]});
  const bb=bboxOf(probe);WP=[RG.pc(mkT(OX+cfgW.x,40+(GY+(cfgW.y!==undefined?cfgW.y:3)-bb.y1)))];}
 const back=g.weapon&&LIE_W_BACK[g.weapon.type],rig={G:1e9,sec:{hairB:[RG.pc(Th,HC)],head:[RG.pc(Th,HC)],__lie:[RG.pc(I)],weapon:back?[]:WP},def:[]};
 const tl=g.weapon?(({speer:.16,stab:.12,bogen:0,dolch:.45})[g.weapon.type]??.34):0;
 let img=lieInj(()=>turned(()=>hero(Object.assign({},c,{face:1,pose:{eyes:'ko',mouth:'offen',wa:-tl,lie:1}})),1,HD,{sort:false}).render(),W,LH,rig,body);
 if(back){const wim=rigWith(()=>turned(()=>hero(Object.assign({},c,{face:1,pose:{wa:-tl,lie:1}})),1,34,{sort:false}).render(),W,LH,{G:1e9,sec:{weapon:WP},def:[]});for(let i=0;i<img.col.length;i++)if(!img.col[i]&&wim.col[i])img.col[i]=wim.col[i];}
 return img;}


// SF2-Niederlage (rückwärts): kneel = Taumeln nach hinten, fall = in der Luft nach hinten gekippt (Arme fliegen nach vorn), down = heroLie (Rückenlage, Kopf links).
const BACK_P={kneel:{t:-.3,h:-.25,aN:-.9,aF:-.7,lN:.35,lF:.2,kN:.35,kF:.25,fN:.1,fF:.1,dyN:0,dyF:0,x:-3,hold:1},
 fall:{t:-.95,h:-.3,aN:-1.25,aF:-1.6,lN:-.05,lF:-.22,kN:.75,kF:.55,fN:.3,fF:.25,dyN:0,dyF:0,x:-6,hold:1}};
function heroDownB(cfg){const stand=turned(()=>hero(Object.assign({},cfg,{face:1})),1,34,{sort:false}).render(),GY=lowestRow(stand),sb=bboxOf(stand);
 const img=heroLie(cfg),b=bboxOf(img),x0=Math.max(0,b.x0-2),x1=Math.min(img.w-1,b.x1+2),w=x1-x0+1,H=GY+1,sy=GY-b.y1,out={w,h:H,col:new Array(w*H).fill(null)};
 for(let y=0;y<img.h;y++)for(let x=x0;x<=x1;x++){const c=img.col[y*img.w+x];if(!c)continue;const Y=y+sy;if(Y<0||Y>=H)continue;out.col[Y*w+x-x0]=c;}
 out.ox=sb.x0-10-2;out.hd='l';return out;}

export {heroLie, heroDownB, BACK_P};

// Rig je Gefährte (Kampfansicht, Blick rechts, 40×40). t: 'quad' (kippt rückwärts über, landet auf dem Rücken, Beine hoch), 'up' (aufrecht: kippt 90° nach hinten auf den Rücken, Füße hoch),
// 'snake' (Hals klappt nach hinten, Kopf landet links am Boden), 'goo' (Schleim: kippt leicht zurück und zerläuft). C = Körpermitte, E = Körper-Ellipse (bestimmt, wie er aufliegt), H = Drehpunkt am Boden beim Aufbäumen.
const PR_T={quad:{rear:{th:-.5,P:'hind',dx:-1},air:{th:-1.95,P:'c',dx:-5,dy:-7},down:{th:-Math.PI,P:'c',dx:-7}},
 up:{rear:{th:-.42,P:'hind',dx:-1},air:{th:-1.15,P:'c',dx:-5,dy:-6},down:{th:-Math.PI/2,P:'c',dx:-7}},
 snake:{rear:{th:0,P:'c',dx:-1},air:{th:0,P:'c',dx:-2},down:{th:0,P:'c',dx:-3}},
 goo:{rear:{th:-.2,P:'hind',dx:-1},air:{th:-.5,P:'c',dx:-4,dy:-5},down:{th:-.28,P:'hind',dx:-5,sc:[1.16,.7]}}};
const LEG=(n,J,reg,b)=>({n,J,u:[0,1],b:b||1.6,reg});
const PET_RIG={
 wolf:{C:[19,28],E:[19,28,10.5,6.8],H:[12,38],parts:[{n:'head',J:[26,23],u:[.55,-.83],b:2.4},{n:'tail',J:[9.5,26.5],u:[-.8,-.6],b:2,reg:(x,y)=>x<11.5},
  LEG('fln',[23.2,33],(x,y)=>x>19.5&&x<24.7),LEG('flf',[26.2,32],(x,y)=>x>=24.7&&x<31),LEG('hln',[11.5,33],(x,y)=>x>6&&x<13.1),LEG('hlf',[14.7,32],(x,y)=>x>=13.1&&x<=19.5)]},
 fuchs:{C:[19.1,28],E:[19.1,28,10.1,6.8],H:[12.8,38],parts:[{n:'head',J:[26.2,23],u:[.55,-.83],b:2.4},{n:'tail',J:[11,27.5],u:[-1,-.3],b:2,reg:(x,y)=>x<12.5},
  LEG('fln',[23.6,33],(x,y)=>x>20&&x<25),LEG('flf',[26.5,32],(x,y)=>x>=25&&x<31),LEG('hln',[12.3,33],(x,y)=>x>7&&x<13.9),LEG('hlf',[15.4,32],(x,y)=>x>=13.9&&x<=20)]},
 katze:{C:[18.5,29],E:[18.5,29,9.5,6.4],H:[12.5,38],parts:[{n:'head',J:[25.5,24.5],u:[.6,-.8],b:2.4},{n:'tail',J:[10,28.5],u:[-.9,-.4],b:2,reg:(x,y)=>x<11},
  LEG('fln',[22.6,33],(x,y)=>x>19&&x<24.1),LEG('flf',[25.6,32],(x,y)=>x>=24.1&&x<31),LEG('hln',[11.8,33],(x,y)=>x>6&&x<13.3),LEG('hlf',[14.8,32],(x,y)=>x>=13.3&&x<=19)]},
 drache:{C:[18.6,29],E:[18.6,29,8.7,6.8],H:[13,38],parts:[{n:'head',J:[25.5,24],u:[.6,-.8],b:2.4,reg:(x,y)=>x>=20},{n:'wing',J:[14.5,21.5],u:[-.45,-.9],b:1.6,ns:1,reg:(x,y)=>x<18.5&&y<24.5},
  {n:'tail',J:[10.5,30.5],u:[-1,.1],b:2,ns:2,reg:(x,y)=>x<10.5&&y>23},
  LEG('fln',[23.4,33],(x,y)=>x>19.5&&x<24.8),LEG('flf',[26.3,32],(x,y)=>x>=24.8&&x<31),LEG('hln',[12.8,33],(x,y)=>x>7&&x<14.2),LEG('hlf',[15.7,32],(x,y)=>x>=14.2&&x<=19.5)]},
 hase:{C:[17,30],E:[17,30,8.5,7.5],H:[14,38],parts:[{n:'head',J:[23,25],u:[.5,-.87],b:2.4},LEG('fl',[23,33],(x,y)=>x>20.5),LEG('hl',[14,34.5],(x,y)=>x<=20.5&&x>8,1.4)]},
 igel:{C:[18.5,30],E:[18.5,28.5,12.8,9.4],H:[16,38],parts:[{n:'head',J:[25.5,31],u:[1,.1],b:2,reg:(x,y)=>y>25},LEG('fl',[24.5,35.4],(x,y)=>x>21&&x<30,1.1),LEG('hl',[15.8,35.4],(x,y)=>x<=21&&x>11,1.1)]},
 maus:{C:[18.5,31],E:[18.5,31,8.5,6.3],H:[15,38],parts:[{n:'head',J:[23.5,28.5],u:[.75,-.66],b:2.2,reg:(x,y)=>x>20.5},{n:'tail',J:[11,32.5],u:[-1,.1],b:1.5,reg:(x,y)=>x<11.5},
  LEG('fl',[25,36],(x,y)=>x>21&&y>35,1.1),LEG('hl',[16,36],(x,y)=>x<=21&&x>12&&y>35,1.1)]},
 axolotl:{C:[19,30.5],E:[19,30.5,9,5.4],H:[14,38],parts:[{n:'head',J:[24.5,27.5],u:[.65,-.76],b:2.4,reg:(x,y)=>x>21.5},{n:'tail',J:[11,30],u:[-1,-.35],b:2,reg:(x,y)=>x<11.5},
  LEG('fl',[24,33.5],(x,y)=>x>20.5&&y>32,1.5),LEG('hl',[14,33.5],(x,y)=>x<=20.5&&x>9&&y>32,1.5)]},
 schildkroete:{C:[19,30],E:[19,28,13,9.5],H:[9,38],parts:[{n:'head',J:[30.5,28],u:[1,0],b:1.8,reg:(x,y)=>x>30},LEG('fl',[26,33.5],(x,y)=>x>19&&x<31,1),LEG('hl',[11.5,33.5],(x,y)=>x<=19&&x>4,1)]},
 biene:{C:[18,26],E:[18,26,10,7.5],H:[12,34],q:{rear:{P:'c',th:-.4,dy:-1}},parts:[{n:'head',J:[25.5,24],u:[1,-.2],b:2,reg:(x,y)=>x>24},{n:'wings',J:[17,18.5],u:[0,-1],b:1.5,ns:1,reg:(x,y)=>y<18.5&&x<23.5}]},
 adler:{t:'up',C:[18,26],E:[18,25,8.5,10],H:[13,38],parts:[{n:'head',J:[21,19.5],u:[.4,-.9],b:2.2,reg:(x,y)=>y<20.5},{n:'tail',J:[17,34],u:[0,1],b:1.5,reg:(x,y)=>y>33.5}]},
 papagei:{t:'up',C:[19.5,24],E:[19.5,24,6.8,9.4],H:[15,38],parts:[{n:'head',J:[21,19.5],u:[.35,-.94],b:2.2,reg:(x,y)=>y<20.5&&x>14},{n:'tail',J:[16,32],u:[-.3,1],b:1.8,reg:(x,y)=>y>32.5}]},
 eule:{t:'up',C:[20,25],E:[20,25,11,12.5],H:[12,38],parts:[{n:'wingL',J:[10,24],u:[-1,.2],b:1.5,ns:1,reg:(x,y)=>x<10.5&&y>18},{n:'wingR',J:[31,24],u:[1,.2],b:1.5,ns:1,reg:(x,y)=>x>30&&y>18},{n:'feet',J:[20,37.2],u:[0,1],b:.8,reg:(x,y)=>y>37.2}]},
 pinguin:{t:'up',C:[20,25.5],E:[20,25.5,9,11.2],H:[14,38],parts:[{n:'finL',J:[12,22],u:[-.3,1],b:1.5,ns:1,reg:(x,y)=>x<12.5&&y>20},{n:'finR',J:[28,22],u:[.3,1],b:1.5,ns:1,reg:(x,y)=>x>27.5&&y>20},{n:'feet',J:[20,36],u:[0,1],b:1,reg:(x,y)=>y>36.2}]},
 baer:{t:'up',C:[20,29.5],E:[20,29.5,10,8.2],H:[12,38],parts:[{n:'head',J:[20,22.5],u:[0,-1],b:2,reg:(x,y)=>y<22.5},{n:'armL',J:[11.5,25.5],u:[-.1,1],b:1.5,reg:(x,y)=>x<13.5&&y>23&&y<34},{n:'armR',J:[28.5,25.5],u:[.1,1],b:1.5,reg:(x,y)=>x>26.5&&y>23&&y<34},{n:'feet',J:[20,35],u:[0,1],b:1.2,reg:(x,y)=>y>34.5}]},
 frosch:{C:[20,29],E:[20,27,11,9.5],H:[12,38],parts:[{n:'legs',J:[20,32.5],u:[0,1],b:1.2,ns:1,reg:(x,y)=>y>32.5}]},
 krake:{t:'up',C:[20,18],E:[20,18,10.5,10.5],H:[12,39],parts:[{n:'tent',J:[20,27],u:[0,1],b:1.5,reg:(x,y)=>y>26}]},
 fledermaus:{C:[20,25],E:[20,25,7,8.4],H:[14,34],parts:[{n:'wingL',J:[14,22],u:[-1,.1],b:1.5,ns:1,reg:(x,y)=>x<14},{n:'wingR',J:[26,22],u:[1,.1],b:1.5,ns:1,reg:(x,y)=>x>26}]},
 schleim:{t:'goo',C:[20,29],E:[20,31.5,12.5,6.6],H:[8,38],parts:[{n:'curl',J:[20.5,19.5],u:[0,-1],b:1.5,reg:(x,y)=>y<19.5}]},
 schlange:{t:'snake',C:[19,33],E:[19,34,13,4.5],H:[8,38],parts:[{n:'neck',J:[23,28],u:[.25,-.97],b:2,reg:(x,y)=>x>19.5&&y<28.5}]}};
// Winkel je Pose (Teil relativ zum Körper, Bogenmaß). Negativ = gegen den Uhrzeigersinn.
const PR_A={
 wolf:{rear:{head:-.3,fln:.5,flf:.45,tail:.2},air:{head:.6,tail:-1.1,fln:-.5,flf:-.2,hln:.5,hlf:.2},down:{head:1.5,tail:-.9,fln:-.55,flf:-.15,hln:.55,hlf:.15}},
 fuchs:{rear:{head:-.3,fln:.5,flf:.45,tail:.3},air:{head:.6,tail:-1.1,fln:-.5,flf:-.2,hln:.5,hlf:.2},down:{head:1.5,tail:-.7,fln:-.55,flf:-.15,hln:.55,hlf:.15}},
 katze:{rear:{head:-.3,fln:.5,flf:.45,tail:.3},air:{head:.6,tail:-1,fln:-.5,flf:-.2,hln:.5,hlf:.2},down:{head:1.5,tail:-.8,fln:-.55,flf:-.15,hln:.55,hlf:.15}},
 drache:{rear:{head:-.3,fln:.5,flf:.45,wing:.4},air:{head:.6,tail:-.2,wing:.5,fln:-.5,flf:-.2,hln:.5,hlf:.2},down:{head:1.5,tail:-.5,wing:1.5,fln:-.55,flf:-.15,hln:.55,hlf:.15}},
 hase:{rear:{head:-.3,fl:.5},air:{head:.6,fl:-.4,hl:.4},down:{head:1.5,fl:-.45,hl:.5}},
 igel:{rear:{head:-.2,fl:.4},air:{head:.4,fl:-.3,hl:.3},down:{head:.9,fl:-.3,hl:.3}},
 maus:{rear:{head:-.3,fl:.5,tail:.3},air:{head:.6,tail:-.8,fl:-.4,hl:.4},down:{head:1.4,tail:-.6,fl:-.45,hl:.45}},
 axolotl:{rear:{head:-.3,fl:.5,tail:.3},air:{head:.6,tail:-.8,fl:-.4,hl:.4},down:{head:1.4,tail:-.6,fl:-.45,hl:.45}},
 schildkroete:{rear:{head:-.2,fl:.3},air:{head:.4,fl:-.3,hl:.3},down:{head:.6,fl:-.35,hl:.35}},
 biene:{rear:{head:-.2,wings:-.2},air:{head:.4,wings:.2},down:{head:.8,wings:1.6}},
 adler:{rear:{head:-.2},air:{head:.3,tail:-.3},down:{head:.4,tail:-.5}},
 papagei:{rear:{head:-.2},air:{head:.3,tail:-.3},down:{head:.4,tail:-.5}},
 eule:{rear:{wingR:-.2,wingL:-.1},air:{wingR:-.4,wingL:-.2,feet:-.5},down:{wingR:-.25,wingL:.1,feet:-.8}},
 pinguin:{rear:{finR:-.3,finL:-.1},air:{finR:-.4,finL:-.2,feet:-.6},down:{finR:-.15,finL:0,feet:-.9}},
 baer:{rear:{head:-.2,armR:-.3,armL:-.1},air:{head:.2,armR:-.5,armL:-.2,feet:-.6},down:{head:.35,armR:-.25,armL:-.1,feet:-.8}},
 frosch:{rear:{legs:.2},air:{legs:-.3},down:{legs:0}},
 krake:{rear:{tent:.2},air:{tent:.3},down:{tent:.35}},
 fledermaus:{rear:{wingR:.3,wingL:-.3},air:{wingR:.4,wingL:-.4},down:{wingR:0,wingL:0}},
 schleim:{rear:{curl:-.3},air:{curl:-.6},down:{curl:-.9}},
 schlange:{rear:{neck:-.5},air:{neck:-1.5},down:{neck:-2.45}}};
for(const k in PR_A){const R=PET_RIG[k];R.q=R.q||{};for(const p in PR_A[k]){R.q[p]=Object.assign({},R.q[p]||{});R.q[p].a=Object.assign({},(R.q[p].a)||{},PR_A[k][p]);}}


// ---- Gefährte · Niederlage: kippt NACH HINTEN (vom Gegner weg), landet auf dem Rücken, Kopf links ----
// Jeder Gefährte hat ein kleines Gelenk-Rig (Kampfansicht, Blick rechts): Körper + Teile (Kopf, Schwanz, Vorder-/Hinterbeine, Flügel …).
// Teil = { J: Gelenk, u: Achse vom Körper ins Teil, reg: Zusatzbedingung }. Posen: rear (bäumt sich auf, kippt), air (in der Luft), down (liegt).
// Je Pose: th = Drehung des ganzen Körpers (negativ = nach hinten kippen), P = Drehpunkt ('hind' = Hinterpfoten am Boden, 'c' = Körpermitte),
// a[teil] = Drehung des Teils gegenüber dem Körper, dx/dy = Versatz. Kontur und Licht rechnet der Sprite-Renderer auf der fertigen Pose neu.
function petRigPieces(R,pose,GY,OFF){
 const Q0=((PR_T[R.t||'quad'])||PR_T.quad)[pose]||{},Q1=(R.q&&R.q[pose])||{},Q=Object.assign({},Q0,Q1,{a:Object.assign({},Q0.a||{},Q1.a||{})}),parts=R.parts||[];
 const piv=Q.P==='hind'?(R.H||[R.C[0]-6,GY]):Q.P==='c'?R.C:Q.P;
 const SC=Q.sc?{f:(x,y)=>[piv[0]+(x-piv[0])*Q.sc[0],piv[1]+(y-piv[1])*Q.sc[1]],i:(X,Y)=>[piv[0]+(X-piv[0])/Q.sc[0],piv[1]+(Y-piv[1])/Q.sc[1]]}:RG.mv(0,0);
 const TB=RG.comp(RG.mv(OFF+(Q.dx||0),OFF+(Q.dy||0)),RG.rot(Q.th||0,piv[0],piv[1]),SC);
 const S=(p,x,y)=>(x-p.J[0])*p.u[0]+(y-p.J[1])*p.u[1];
 const who=(x,y)=>{for(let k=0;k<parts.length;k++){const p=parts[k];if(S(p,x,y)>-(p.b||2.2)&&(!p.reg||p.reg(x,y)))return k;}return -1;};
 const out=[RG.pc(TB,(x,y)=>who(x,y)<0)];
 parts.forEach((p,k)=>{const a=(Q.a&&Q.a[p.n])||0,L=Math.hypot(p.u[0],p.u[1])||1,u=[p.u[0]/L,p.u[1]/L];p.u=u;
  RG.bend(TB,p.J,u,a,p.b||2.2,p.ns||6).forEach(pc=>{const r0=pc.reg;out.push({f:pc.f,i:pc.i,reg:(x,y)=>who(x,y)===k&&r0(x,y)});});});
 return {pieces:out,TB};}
function petPose(kind,color,pose,opt){opt=opt||{};const R=PET_RIG[kind];if(!R)return null;
 const d=PET_TURN[kind],draw=()=>d?turned(()=>pet(kind,color),1,d,{sort:true}).render():pet(kind,color).render();
 const base=draw(),sh=petShadowOf(base),GY=sh.fl?Math.round(sh.cy)-1:sh.yb,OFF=44,W=40+2*OFF,H=40+2*OFF;
 let {pieces,TB}=petRigPieces(R,pose,GY,OFF);
 let img=rigWith(draw,W,H,{def:pieces,sec:{}});
 let bb=bboxOf(img);if(bb.x1<0)return null;
 // Boden: rear bleibt mit den Hinterpfoten stehen, down liegt mit dem Rücken auf dem Boden (Körper-Ellipse bestimmt die Höhe, nicht Kopf oder Schwanz).
 if(pose==='down'){let lo=-1e9;const E=R.E||[R.C[0],R.C[1],8,6];for(let k=0;k<48;k++){const t=k/48*2*Math.PI,q=TB.f(E[0]+E[2]*Math.cos(t),E[1]+E[3]*Math.sin(t));if(q[1]>lo)lo=q[1];}
  const sy=Math.round(GY+OFF-lo+(R.sink||0));if(sy){pieces=pieces.map(p=>({reg:p.reg,f:(x,y)=>{const q=p.f(x,y);return [q[0],q[1]+sy];},i:(X,Y)=>p.i(X,Y-sy)}));}
  img=rigWith(draw,W,H,{def:pieces,sec:{},G:GY+OFF});bb=bboxOf(img);if(bb.x1<0)return null;
  img=groundImg(img,GY+OFF);bb=bboxOf(img);if(!opt.eyes)xEyes(img.col,img.w,img.h);}
 else if(pose==='rear'){img=rigWith(draw,W,H,{def:pieces,sec:{},G:GY+OFF});bb=bboxOf(img);}
 dropIslands(img,24);bb=bboxOf(img);const out=crop(img,bb.x0,bb.y0,bb.x1-bb.x0+1,bb.y1-bb.y0+1);out.ox=bb.x0-OFF;out.oy=bb.y0-OFF;out.hd='l';
 if(pose==='air'){const lim=GY-2-(out.h-1);if(out.oy>lim)out.oy=lim;}
 return out;}
function dropIslands(img,min){const {w,h,col}=img,seen=new Uint8Array(w*h);for(let i=0;i<col.length;i++){if(!col[i]||seen[i])continue;const st=[i],cc=[];seen[i]=1;while(st.length){const q=st.pop();cc.push(q);const x=q%w,y=(q/w)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=w||Y>=h)continue;const j=Y*w+X;if(col[j]&&!seen[j]){seen[j]=1;st.push(j);}}}if(cc.length<min)cc.forEach(q=>col[q]=null);}return img;}
function petPoses(kind,color){const R=PET_RIG[kind];if(!R)return null;const o={};for(const p of ['rear','air','down'])o[p]=petPose(kind,color,p);return o;}

export { petPose, petPoses, PET_RIG };
