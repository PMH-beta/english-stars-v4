// Kampf-Animationen für English Stars (Pastell-Redesign)
// Abläufe je Figur: idle (Schleife) · attack · hurt · win (Schleife) · die (einmal, endet in ko) · ko (Schleife, Endposition).
// Held: win nutzt die Pose cheer. die = Blitz, Rot-Ton, fall (50° nach hinten gekippt, neu gezeichnet), down (liegt auf dem Rücken, X-Augen, Waffe am Boden vor ihm), Staub; ko = down mit kreisenden Sternen.
// Gegner: Angriffsart je Figur (ATK_OF: lunge Krallen · slam Bodenschlag · hop Sprung + Schleimspritzer · swoop Sturzflug + Biss · bite Schnappen · cast Zauberkugel),
//   Niederlage je Körperbau (DIE_OF poseL/poseC mit Posen kneel/fall/down): fällt aufs Gesicht, zerfällt in Stücke, bricht zusammen, fällt flach herunter, kippt um; melt zerfließt, fade löst sich auf.
// Stehen 4 fps · 4 Bilder (Schleife) · Angriff 8 fps · 6 Bilder (Treffer-Bild 3) · Treffer 8 fps · 5 Bilder.
// Eigene Abläufe je Waffe in ATK (Dolch, Axt, Hammer, Streitkolben, Stab); Schwert und Speer ANIMS.attack.
// Bogen: eigener Angriff (ANIMS.shoot) · 6 Bilder · Pfeil startet bei Bild 2 (250 ms) und trifft bei Bild 4 (500 ms).
// Alle Bilder entstehen zur Laufzeit aus der Kampf-Figur; der Held bekommt drei Schlüsselposen mit seiner aktuellen Ausrüstung.
import { hero, turned, shadowed, heroDown, heroKneel, heroFall } from './pixel-hero-fine.js';
import { ALPHA, DUNGEON_ENEMIES_FACING_LEFT, DUNGEON_ENEMIES_KO } from './pixel-enemies-dungeon.js';
import { ARROWS, MAGIC, decodeSprite } from './pixel-world-fine.js';

function createPixelAnimator(){
  const SHADOW='#1F1F2461',INK='#1F1F24',WHITE='#FFFFFF',GOLD='#FFD66B',HURT='#FF4D5E',GLOW='#C9B8FF',GLOW2='#8B6FE8';
  const ANIMS={
    idle:{fps:4,loop:true,frames:[{},{sq:1},{sq:1,nk:1},{nk:1}]},
    attack:{fps:8,hit:3,frames:[{pose:'wind',dx:-2,sh:-2,sq:1},{pose:'wind',dx:-3,sh:-3,sq:1},{pose:'smear',dx:10,sh:3,sq:-1,fx:'streak'},{pose:'strike',dx:14,sh:2,fx:'spark'},{pose:'strike',dx:10,sh:1},{dx:4}]},
    hurt:{fps:8,frames:[{pose:'ouch',flash:1,dx:-3,sh:-2},{pose:'ouch',tint:1,dx:-5,sh:-3,sq:1},{pose:'ouch',dx:-4,sh:-2},{pose:'ouch',dx:-2,sh:-1},{dx:-1}]},
    shoot:{fps:8,hit:4,launch:2,frames:[{pose:'wind',dx:-1,sq:1},{pose:'wind',dx:-2,sh:-1,sq:1},{pose:'smear',dx:-3,sh:-2},{pose:'strike',dx:-2,sh:-1},{pose:'strike',dx:-1},{dx:0}]},
    // Sieg (Schleife, 8 fps): Hocke, Sprung mit erhobener Waffe, Landung, kurz stehen. Niederlage (einmal, 8 fps): Treffer, Knie, Umfallen nach hinten, Aufprall. K.O. (Schleife, 4 fps): liegt, drei Sterne kreisen über dem Kopf.
    win:{fps:8,loop:true,frames:[{pose:'cheer',sq:2},{pose:'cheer',sq:-1,dy:-4},{pose:'cheer',dy:-6},{pose:'cheer',dy:-4},{pose:'cheer',sq:2},{pose:'cheer'},{pose:'cheer',sq:1},{pose:'cheer'}]},
    die:{fps:8,frames:[{pose:'ouch',flash:1,dx:-3,sh:-2},{pose:'kneel',tint:1},{pose:'fall',dy:-7},{pose:'fall',dx:-2,dy:-3},{pose:'down',lie:1,hd:'l',fx:'thud'},{pose:'down',lie:1,hd:'l',dy:-2},{pose:'down',lie:1,hd:'l'}]},
    ko:{fps:4,loop:true,frames:[1,2,3,4].map(s=>({pose:'down',lie:1,hd:'l',stars:s}))}
  };
  // Gegner: Angriffsart je Figur (E_ATK), Treffer/Sieg je Bewegungsstil, Niederlage je Körper (umfallen, abstürzen, zerfließen, verblassen).
  const E_ATK={lunge:{fps:8,hit:3,frames:[{dx:-2,sh:-2,sq:1},{dx:-3,sh:-3,sq:2},{dx:10,sh:3,sq:-1,fx:'streak'},{dx:14,sh:2,fx:'claw'},{dx:11,sh:1},{dx:4}]},
    slam:{fps:8,hit:3,frames:[{dy:-1,sq:-2},{dx:2,dy:-5,sq:-3,sh:-2},{dx:8,dy:-2,sh:3},{dx:11,sq:3,fx:'quake',band:[.5,1]},{dx:11,sq:2,fx:'dust'},{dx:3}]},
    hop:{fps:8,hit:3,frames:[{sq:3,wd:2},{dx:6,dy:-8,sq:-2},{dx:12,dy:-6,sq:-1},{dx:15,sq:4,wd:4,fx:'splat'},{dx:12,sq:2,wd:2},{dx:5,dy:-3}]},
    swoop:{fps:8,hit:3,frames:[{dx:-2,dy:-4},{dx:-3,dy:-7},{dx:9,dy:-1,fx:'streak'},{dx:14,dy:3,fx:'bite'},{dx:10},{dx:4,dy:-3}]},
    bite:{fps:8,hit:3,frames:[{dx:-3,sh:-3,sq:2},{dx:-4,sh:-4,sq:2},{dx:13,sh:4,fx:'streak'},{dx:17,sh:3,fx:'bite'},{dx:12,sh:1},{dx:4}]},
    cast:{fps:8,hit:4,launch:2,mz:[.15,.55],frames:[{glow:1},{glow:2,dy:-1},{glow:2,dx:2,dy:-1,sq:-1},{glow:1,dx:-2},{dx:-1},{}]}};
  const ATK_OF={goblin:'lunge',goblinR:'lunge',zombie:'lunge',skelett:'lunge',skelettR:'lunge',mumie:'lunge',imp:'lunge',vampir:'lunge',ruestung:'slam',gargoyle:'swoop',golem:'slam',minotaurus:'slam',slimeG:'hop',slimeV:'hop',slimeF:'hop',slimeK:'hop',kroete:'hop',pilz:'hop',bat:'swoop',batR:'swoop',schlange:'bite',spinne:'bite',spinneF:'bite',spinneK:'bite',kaefer:'bite',ratte:'bite',mimic:'bite',lich:'cast',hexe:'cast',auge:'cast',buch:'cast',kristall:'cast',schatten:'cast',irrlicht:'cast',geist:'cast',drache:'cast'};
  const DIE_OF={geist:'fade',irrlicht:'fade',schatten:'fade',slimeG:'back',slimeV:'back',slimeF:'back',slimeK:'back',schlange:'back',goblin:'back',goblinR:'back',zombie:'back',mumie:'back',imp:'back',minotaurus:'back',vampir:'back',hexe:'back',lich:'back',skelett:'back',skelettR:'back',golem:'back',ruestung:'back',gargoyle:'back',kristall:'back',ratte:'flip',kroete:'flip',kaefer:'flip',spinne:'flip',spinneF:'flip',spinneK:'flip',drache:'back',bat:'back',batR:'back',auge:'back',buch:'back',pilz:'back',mimic:'back'};
  const E_HURT={hover:[{flash:1,dx:-3,dy:-2},{tint:1,dx:-5,dy:-3,sh:-2},{dx:-4,dy:-2,sh:-1},{dx:-2,dy:-1},{dx:-1}],wobble:[{flash:1,dx:-2,sq:-2},{tint:1,dx:-4,sq:3,wd:3},{dx:-3,sq:-1},{dx:-2,sq:1,wd:1},{dx:-1}]};
  const E_WIN={breathe:[{sq:2},{sq:-1,dy:-4},{dy:-5},{dy:-3},{sq:2},{},{sq:1},{}],hover:[{dy:-2},{dy:-4,sh:1},{dy:-6,sh:2},{dy:-5,sh:1},{dy:-3},{dy:-1,sh:-1},{dy:-2,sh:-2},{dy:-1,sh:-1}],wobble:[{sq:3,wd:3},{sq:-3,dy:-6},{sq:-2,dy:-8},{sq:-1,dy:-5},{sq:4,wd:4},{sq:2,wd:2},{sq:1,wd:1},{}]};
  const E_DIE={back:[{flash:1,dx:-3,sh:-2},{pose:'kneel',tint:1,dx:-3},{pose:'fall',dx:-5,dy:-7},{pose:'down',lie:1,hd:'r',dx:-6,dy:-6},{pose:'down',lie:1,hd:'r',dx:-6,fx:'thud'},{pose:'down',lie:1,hd:'r',dx:-6,dy:-2},{pose:'down',lie:1,hd:'r',dx:-6}],
    flip:[{flash:1,dx:-3,sh:-2},{pose:'kneel',tint:1,dx:-3,dy:-5},{pose:'fall',dx:-5,dy:-9},{pose:'down',lie:1,hd:'c',dx:-6,dy:-6},{pose:'down',lie:1,hd:'c',dx:-6,fx:'thud'},{pose:'down',lie:1,hd:'c',dx:-6,dy:-2},{pose:'down',lie:1,hd:'c',dx:-6}],
    poseL:[{flash:1,dx:-3,sh:-2},{tint:1,dx:-4,sh:-2},{pose:'kneel'},{pose:'fall'},{pose:'down',lie:1,hd:'l',fx:'thud'},{pose:'down',lie:1,hd:'l'}],poseC:[{flash:1,dx:-3,sh:-2},{tint:1,dx:-4,sh:-2},{pose:'kneel'},{pose:'fall'},{pose:'down',lie:1,hd:'c',fx:'thud'},{pose:'down',lie:1,hd:'c'}],down:[{flash:1,dx:-3,sh:-2},{tint:1,dx:-5,sh:-3,sq:1},{pose:'fall'},{pose:'down',lie:1,hd:'r',fx:'thud'},{pose:'down',lie:1,hd:'r',dy:-1},{pose:'down',lie:1,hd:'r'}],
    downF:[{flash:1,dx:-3,sh:-2},{tint:1,dx:-5,sh:-3,sq:1},{tint:1,dy:-7,sq:-2},{pose:'down',lie:1,hd:'l',fx:'thud'},{pose:'down',lie:1,hd:'l',dy:-1},{pose:'down',lie:1,hd:'l'}],
    fall:[{flash:1,dx:-3,sh:-2},{tint:1,dx:-5,sh:-3,sq:1},{tint:1,dx:-4,kn:4,sh:-3},{dx:-4,kn:8,sh:-6},{rot:1,dy:-3},{rot:1,fx:'thud'},{rot:1}],
    drop:[{flash:1,dy:-2},{tint:1,dy:-3},{tint:1,land:.35},{land:.75},{land:1,sq:3,wd:2,fx:'thud'},{land:1,flip:1,dy:-2},{land:1,flip:1,sq:2}],
    melt:[{flash:1,sq:-2},{tint:1,wd:2},{flat:.78,wide:1.08},{flat:.6,wide:1.16},{flat:.46,wide:1.24},{flat:.36,wide:1.3,fx:'thud'},{flat:.34,wide:1.3}],
    fade:[{flash:1},{tint:1,dy:-1},{dy:-2,fade:.35,sq:-1},{dy:-4,fade:.6,sq:-2},{dy:-6,fade:.8,sq:-3},{dy:-8,fade:.93,sq:-4},{fade:1}]};
  const E_KO={back:[1,2,3,4].map(s=>({pose:'down',lie:1,hd:'r',dx:-6,stars:s})),flip:[1,2,3,4].map(s=>({pose:'down',lie:1,hd:'c',dx:-6,stars:s})),poseL:[1,2,3,4].map(s=>({pose:'down',lie:1,hd:'l',stars:s})),poseC:[1,2,3,4].map(s=>({pose:'down',lie:1,hd:'c',stars:s})),down:[1,2,3,4].map(s=>({pose:'down',lie:1,hd:'r',stars:s})),downF:[1,2,3,4].map(s=>({pose:'down',lie:1,hd:'l',stars:s})),fall:[1,2,3,4].map(s=>({rot:1,stars:s})),drop:[1,2,3,4].map(s=>({land:1,flip:1,sq:2,stars:s})),melt:[{flat:.34,wide:1.3},{flat:.37,wide:1.27},{flat:.34,wide:1.3},{flat:.31,wide:1.33}],fade:[{fade:1},{fade:1},{fade:1},{fade:1}]};
  const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const CLAW=(()=>{const g=[];for(let y=0;y<9;y++){const r=Array(15).fill('.');for(let k=0;k<3;k++){const x=1+k*4+Math.floor((8-y)/2);if(y===0||y===8){r[x]='K';continue;}r[x]='W';if(r[x-1]==='.')r[x-1]='K';if(r[x+1]==='.')r[x+1]='K';}g.push(r.join(''));}return g;})();
  const CHOMP=['.KKKKKKK.','KWWWWWWWK','KWKWKWKWK','.K.K.K.K.','.K.K.K.K.','KWKWKWKWK','KWWWWWWWK','.KKKKKKK.'],SPLAT=['..K...K..','.KCK.KLK.','KCLCKCCCK','.KCCCCCK.','KCCKCCLCK','.K.KCCK.K','....KK...'];
  const ATK={dolch:{fps:8,hit:3,frames:[{pose:'wind',dx:-2,sq:1},{pose:'strike',dx:7,sh:2,fx:'tick'},{pose:'wind2',dx:2},{pose:'strike2',dx:11,sh:3,fx:'spark'},{pose:'strike2',dx:8,sh:1},{dx:3}]},axt:{fps:8,hit:3,frames:[{pose:'wind',dx:-2,sh:-3},{pose:'wind',dx:-3,sh:-4},{pose:'smear',dx:7,sh:2},{pose:'strike',dx:12,sh:4,sq:1,fx:'spark',band:[.35,1]},{pose:'strike',dx:11,sh:3,sq:1},{dx:4}]},hammer:{fps:8,hit:3,frames:[{pose:'wind',dx:-2,sq:2},{pose:'lift',dx:3,dy:-5,sq:-1},{pose:'smear',dx:9,dy:-2},{pose:'strike',dx:12,sq:2,fx:'quake',band:[.5,1]},{pose:'strike',dx:12,sq:1,fx:'dust'},{dx:4}]},streitkolben:{fps:8,hit:3,frames:[{pose:'wind',dx:-3,sq:2,sh:-2},{pose:'wind',dx:-4,sq:2,sh:-2},{pose:'smear',dx:8,sh:2},{pose:'strike',dx:12,sh:2,sq:-1,fx:'spark',band:[0,.4]},{pose:'strike',dx:10,sh:1},{dx:4}]},stab:{fps:8,hit:4,launch:2,mz:[0,.45],frames:[{pose:'wind',sq:1},{pose:'wind',dx:-1,sq:1},{pose:'smear',dx:2},{pose:'strike',dx:1},{pose:'strike'},{}]}}; const IDLE_STYLE={hover:[{},{dy:-1},{dy:-2},{dy:-1}],wobble:[{},{sq:1,wd:1},{sq:2,wd:2},{sq:1,wd:1}]};
  const STYLE={bat:'hover',batR:'hover',geist:'hover',auge:'hover',irrlicht:'hover',buch:'hover',schatten:'hover',kristall:'hover',slimeG:'wobble',slimeV:'wobble',slimeF:'wobble',slimeK:'wobble',kroete:'wobble',pilz:'wobble'};
  const TICK=['..K..','.KWK.','KWYWK','.KWK.','..K..'],PUFF=['...KKK..KK..','..KWWWKKWWK.','.KWWWWWWWWWK','KWWCWWWCWWWK','KCWCCWCCCWCK','.KCCCCCCCCK.','..KKKKKKKK..'],PUFF_S=['..KK.KK..','.KWWKWWK.','KWCWWCWWK','.KCCCCCK.','..KKKKK..'],DUSTC='#F3EBD8',PEB='#7A5A3A'; const SPARK=['....K....','...KWK...','.K.KWK.K.','..KWYWK..','KWWYYYWWK','..KWYWK..','.K.KWK.K.','...KWK...','....K....'];
  const rgba=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16),h.length>7?parseInt(h.slice(7,9),16):255];
  const MC={},mix=(h,t,k)=>MC[h+t+k]||(MC[h+t+k]='#'+[0,1,2].map(i=>{const a=rgba(h)[i],b=rgba(t)[i];return Math.round(a+(b-a)*k).toString(16).padStart(2,'0');}).join(''));
  function decode(sp,A){const col=new Array(sp.w*sp.h).fill(null);sp.r.forEach((row,y)=>{let x=0;row.replace(/(\D)(\d*)/g,(m,ch,n)=>{const k=n?+n:1,i=A.indexOf(ch);if(i>=0)for(let q=0;q<k;q++)col[y*sp.w+x+q]=sp.p[i];x+=k;return m;});});return {w:sp.w,h:sp.h,col,ox:sp.ox||0};}
  function bounds(im,withShadow){let x0=1e9,x1=-1,y0=1e9,y1=-1;for(let i=0;i<im.col.length;i++){const c=im.col[i];if(!c||(!withShadow&&c===SHADOW))continue;const x=i%im.w,y=(i/im.w)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return {x0,x1,y0,y1};}
  // Ein Bild: Zeilen stauchen/strecken (sq Rumpf, nk Hals), Spalten verbreitern (wd), Zeilen neigen (sh), verschieben (dx/dy), Blitz/Rot, Effekte, Schatten.
  function frame(src,sh,f,o){
    const M=o.M,P=o.P,W=src.w+2*M,H=src.h+P,out=new Array(W*H).fill(null),dir=o.dir;
    const rows=[];for(let y=0;y<src.h;y++)rows.push(y);
    const vop=(r,k)=>{if(!k)return;const i=rows.indexOf(r);if(i<0)return;if(k>0){const a=Math.max(0,i-k);rows.splice(a,i-a);}else for(let n=0;n<-k;n++)rows.splice(i,0,r);};
    vop(o.ynk,f.nk||0);vop(o.ysq,f.sq||0);vop(o.ykn,f.kn||0);
    const cols=[];for(let x=0;x<src.w;x++)cols.push(x);
    if(f.wd){const i=cols.indexOf(o.xc);for(let n=0;n<f.wd;n++)cols.splice(i,0,o.xc);}
    const cs=f.wd?-Math.floor(f.wd/2):0,top=src.h-rows.length,shv=(f.sh||0)*dir,dx=(f.dx||0)*dir,dy=(f.dy||0)+(f.land?Math.round((o.gap||0)*f.land):0),span=Math.max(1,o.yb-o.yt);
    for(let j=0;j<rows.length;j++){const sy=rows[j],oy=top+j,of=Math.round(shv*Math.max(0,o.yb-oy)/span);
      for(let i=0;i<cols.length;i++){const c=src.col[sy*src.w+cols[i]];if(!c||c===SHADOW)continue;const X=i+cs+of+dx+M+(src.ox||0),Y=oy+dy+P;if(X>=0&&Y>=0&&X<W&&Y<H)out[Y*W+X]=c;}}
    if(f.flash||f.tint){const cp=out.slice();for(let i=0;i<out.length;i++){const c=cp[i];if(!c)continue;if(f.flash){const x=i%W,e=x===0||x===W-1||!cp[i-1]||!cp[i+1]||!cp[i-W]||!cp[i+W];out[i]=e?INK:WHITE;}else out[i]=mix(c,HURT,.42);}}
    const put2=(nw)=>{out.fill(null);for(let i=0;i<nw.length;i++)if(nw[i])out[i]=nw[i];};
    if(f.flat||f.wide){const q=bounds({w:W,h:H,col:out});if(q.x1>=0){const gy=q.y1,xc=(q.x0+q.x1+1)/2,fl=f.flat||1,wi=f.wide||1,nw=new Array(W*H).fill(null);
      for(let y=0;y<H;y++){const sy=Math.round(gy-(gy-y)/fl);if(sy<q.y0||sy>q.y1)continue;for(let x=0;x<W;x++){const sx=Math.floor(xc+(x+.5-xc)/wi);if(sx<q.x0||sx>q.x1)continue;const c=out[sy*W+sx];if(c)nw[y*W+x]=c;}}
      for(let i=0;i<nw.length;i++){if(!nw[i]||nw[i]===INK)continue;const x=i%W;if(x===0||x===W-1||!nw[i-1]||!nw[i+1]||i<W||!nw[i-W]||i+W>=nw.length||!nw[i+W])nw[i]=INK;}put2(nw);}}
    if(f.flip){const q=bounds({w:W,h:H,col:out});if(q.x1>=0){const nw=new Array(W*H).fill(null);for(let y=q.y0;y<=q.y1;y++)for(let x=q.x0;x<=q.x1;x++){const c=out[y*W+x];if(c)nw[(q.y0+q.y1-y)*W+x]=c;}put2(nw);}}
    if(f.rot){const q=bounds({w:W,h:H,col:out});if(q.x1>=0){const cxr=Math.round((q.x0+q.x1+1)/2),pts=[];let mnX=1e9,mxX=-1e9,mxY=-1e9;
      for(let y=q.y0;y<=q.y1;y++)for(let x=q.x0;x<=q.x1;x++){const c=out[y*W+x];if(!c)continue;const X=-dir*(q.y1-y),Y=-dir*(x-cxr);pts.push([X,Y,c]);if(X<mnX)mnX=X;if(X>mxX)mxX=X;if(Y>mxY)mxY=Y;}
      const ox=cxr-Math.round((mnX+mxX)/2),nw=new Array(W*H).fill(null);pts.forEach(([X,Y,c])=>{const xx=X+ox,yy=Y-mxY+q.y1;if(xx>=0&&yy>=0&&xx<W&&yy<H)nw[yy*W+xx]=c;});put2(nw);}}
    if(f.fade){for(let i=0;i<out.length;i++){if(!out[i])continue;const x=i%W,y=(i/W)|0;if(BAYER[(y%4)*4+x%4]<f.fade*16)out[i]=null;}}
    if(f.glow){const cp=out.slice();for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(cp[y*W+x])continue;let d=9;for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++){const X=x+xx,Y=y+yy;if(X<0||Y<0||X>=W||Y>=H)continue;const c=cp[Y*W+X];if(!c||c===SHADOW)continue;const m=Math.abs(xx)+Math.abs(yy);if(m<d)d=m;}
      if(d===1)out[y*W+x]=GLOW;else if(d===2&&f.glow>1&&(x+y)%2===0)out[y*W+x]=GLOW2;}}
    const b=bounds({w:W,h:H,col:out});
    if(b.x1>=0&&f.fx==='streak'&&!o.hasPose){const ym=Math.round((b.y0+b.y1)/2),back=dir>0?b.x0:b.x1;
      [[-7,12],[0,16],[7,10]].forEach(([q,len])=>{const y=ym+q;for(let k=3;k<3+len;k++){const x=back-dir*k;if(x<0||x>=W)continue;[[y,WHITE],[y-1,INK],[y+1,INK]].forEach(([yy,c])=>{if(yy>=0&&yy<H&&!out[yy*W+x])out[yy*W+x]=c;});}});}
    let imp=-1;if(b.x1>=0&&(f.fx==='quake'||f.fx==='dust')){const gy=o.yb+P;for(let y=Math.max(0,gy-12);y<=Math.min(H-1,gy);y++)for(let x=0;x<W;x++){const c=out[y*W+x];if(!c||c===SHADOW)continue;if(imp<0||(dir>0?x>imp:x<imp))imp=x;}} if(b.x1>=0&&(f.fx==='spark'||f.fx==='tick'||f.fx==='quake'||f.fx==='claw'||f.fx==='bite'||f.fx==='splat')){const bd=f.band||[.2,.75],ya=Math.round(b.y0+(b.y1-b.y0)*bd[0]),yz=Math.round(b.y0+(b.y1-b.y0)*bd[1]);let fx=-1,fy=-1;
      for(let y=ya;y<=yz;y++)for(let x=0;x<W;x++){if(!out[y*W+x])continue;if(fx<0||(dir>0?x>fx:x<fx)){fx=x;fy=y;}}
      if(fx>=0){const PT=f.fx==='tick'?TICK:f.fx==='claw'?CLAW:f.fx==='bite'?CHOMP:f.fx==='splat'?SPLAT:SPARK,pw=PT[0].length,hw=(pw-1)/2,hn=(PT.length-1)/2,cx=fx+dir*(hw-1),LC=o.main?mix(o.main,WHITE,.45):WHITE;PT.forEach((row,j)=>{for(let i=0;i<pw;i++){const ch=row[dir<0?pw-1-i:i];if(ch==='.')continue;const X=Math.round(cx-hw+i),Y=Math.round(fy-hn+j);if(X>=0&&Y>=0&&X<W&&Y<H)out[Y*W+X]=ch==='K'?INK:ch==='W'?WHITE:ch==='C'?(o.main||WHITE):ch==='L'?LC:GOLD;}});}}
    if(imp>=0){const q=f.fx==='quake',PF=q?PUFF:PUFF_S,pw=PF[0].length,ph=PF.length,gy=o.yb+P,y0=gy-ph+1-(q?0:3);const put=(x0,mir)=>{for(let j=0;j<ph;j++)for(let i=0;i<pw;i++){const ch=PF[j][mir?pw-1-i:i];if(ch==='.')continue;const X=x0+i,Y=y0+j;if(X<0||Y<0||X>=W||Y>=H||out[Y*W+X])continue;out[Y*W+X]=ch==='K'?INK:ch==='W'?WHITE:DUSTC;}};put(dir>0?imp+1:imp-pw,dir<0);put(dir>0?imp-pw-9:imp+10,dir>0);(q?[[-4,10],[3,14],[9,9]]:[[-6,15],[4,19],[12,13]]).forEach(([ex,ey])=>{const X=imp+dir*ex,Y=gy-ey;for(let yy=Y;yy<Y+2;yy++)for(let xx=X;xx<X+2;xx++)if(xx>=0&&yy>=0&&xx<W&&yy<H&&!out[yy*W+xx])out[yy*W+xx]=PEB;});} if(b.x1>=0&&f.fx==='thud'){const gy=b.y1;[b.x0-5,b.x1-3].forEach((x0,n)=>{for(let j=0;j<5;j++)for(let i=0;i<9;i++){const ch=PUFF_S[j][n?8-i:i];if(ch==='.')continue;const X=x0+i,Y=gy-4+j;if(X<0||Y<0||X>=W||Y>=H||out[Y*W+X])continue;out[Y*W+X]=ch==='K'?INK:ch==='W'?WHITE:DUSTC;}});}
    if(b.x1>=0&&f.stars){const hx=f.hd==='c'?Math.round((b.x0+b.x1)/2):f.hd==='r'?b.x1-12:f.hd==='l'?b.x0+12:f.flip?Math.round((b.x0+b.x1)/2):dir>0?b.x0+6:b.x1-6;let ty=1e9;for(let y=b.y0;y<=b.y1;y++)for(let x=hx-4;x<=hx+4;x++)if(x>=0&&x<W&&out[y*W+x]){ty=Math.min(ty,y);}const cy2=ty-6;
      for(let k=0;k<3;k++){const a=(f.stars-1)*Math.PI/2+k*2*Math.PI/3,sx=Math.round(hx+6*Math.cos(a)),sy=Math.round(cy2+2*Math.sin(a));TICK.forEach((row,j)=>{for(let i=0;i<5;i++){const ch=row[i];if(ch==='.')continue;const X=sx-2+i,Y=sy-2+j;if(X>=0&&Y>=0&&X<W&&Y<H&&!out[Y*W+X])out[Y*W+X]=ch==='K'?INK:ch==='W'?WHITE:GOLD;}});}}
    if(sh&&!(f.fade>=1)){const lying=f.rot||f.flat||f.flip||f.lie,cx=lying&&b.x1>=0?(b.x0+b.x1+1)/2:sh.cx+dx+M,cy=sh.cy+P,rx=lying&&b.x1>=0?Math.max(sh.rx,(b.x1-b.x0+1)*.46):Math.max(2,(sh.rx+Math.min(0,dy-(f.land?Math.round((o.gap||0)*f.land):0))*1.5)*(1-(f.fade||0)*.8)),ry=sh.ry;
      for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++){if(x<0||y<0||x>=W||y>=H||out[y*W+x])continue;if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1)out[y*W+x]=SHADOW;}}
    return {w:W,h:H,col:out};
  }
  // Alle Bilder einer Figur in einer gemeinsamen Bildgröße. ox/oy = Lage des Ausgangs-Sprites im Bild.
  function build(base,poses,opt){
    opt=opt||{};poses=poses||{};const role=opt.role||'enemy',dir=opt.dir||(role==='hero'?1:-1),style=opt.style||'breathe';
    const all=[base].concat(Object.values(poses)),Wm=Math.max(...all.map(i=>i.w)),Hm=Math.max(...all.map(i=>i.h));
    const pad=im=>{if(im.w===Wm&&im.h===Hm)return im;const col=new Array(Wm*Hm).fill(null);for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)col[y*Wm+x]=im.col[y*im.w+x];return {w:Wm,h:Hm,col,ox:im.ox||0};};
    const B=pad(base),PS={};for(const k in poses)PS[k]=pad(poses[k]);
    const s0={x0:1e9,x1:-1,y0:1e9,y1:-1};B.col.forEach((c,i)=>{if(c!==SHADOW)return;const x=i%Wm,y=(i/Wm)|0;s0.x0=Math.min(s0.x0,x);s0.x1=Math.max(s0.x1,x);s0.y0=Math.min(s0.y0,y);s0.y1=Math.max(s0.y1,y);});
    const sh=s0.x1<0?null:{cx:(s0.x0+s0.x1+1)/2,cy:(s0.y0+s0.y1+1)/2,rx:(s0.x1-s0.x0+1)/2,ry:(s0.y1-s0.y0+1)/2};
    const bb=bounds(B),hg=bb.y1-bb.y0;
    const g={dir,M:64,P:6,yt:bb.y0,yb:bb.y1,xc:Math.round((bb.x0+bb.x1)/2),ysq:opt.ysq!=null?opt.ysq:Math.round(bb.y0+hg*.62),ynk:opt.ynk!=null?opt.ynk:Math.round(bb.y0+hg*.3),ykn:opt.ykn!=null?opt.ykn:Math.round(bb.y0+hg*.84)};
    const gap=sh?Math.max(0,Math.round(sh.cy-1-bb.y1)):0;g.gap=gap;
    {const cnt={};B.col.forEach(c=>{if(!c||c===SHADOW||c===INK)return;const q=rgba(c);if(q[0]+q[1]+q[2]<150)return;cnt[c]=(cnt[c]||0)+1;});let best=null;for(const k in cnt)if(!best||cnt[k]>cnt[best])best=k;g.main=best;}
    const frames={},atk=role==='enemy'?(opt.atk||'lunge'):null,die=role==='enemy'?(opt.die||'fall'):null;
    const AN=role==='enemy'?{idle:{fps:4,frames:IDLE_STYLE[style]||ANIMS.idle.frames},attack:E_ATK[atk]||E_ATK.lunge,hurt:{fps:8,frames:E_HURT[style]||ANIMS.hurt.frames},win:{fps:8,frames:(E_WIN[style]||E_WIN.breathe).map((f,i)=>atk==='cast'&&i>0&&i<4?Object.assign({glow:i===2?2:1},f):f)},die:{fps:8,frames:E_DIE[die]||E_DIE.fall},ko:{fps:4,frames:E_KO[die]||E_KO.fall}}
      :{idle:ANIMS.idle,attack:(opt.attack&&ATK[opt.attack])||(opt.ranged?ANIMS.shoot:ANIMS.attack),hurt:ANIMS.hurt,win:ANIMS.win,die:ANIMS.die,ko:ANIMS.ko};
    const ranged=role==='enemy'?atk==='cast':!!opt.ranged;
    for(const name in AN){const fr=(name==='idle'&&role!=='enemy'&&IDLE_STYLE[style])?IDLE_STYLE[style]:AN[name].frames;
      frames[name]=fr.map(f=>{const P2=f.pose&&PS[f.pose];return frame(P2||B,sh,f,Object.assign({},g,{hasPose:!!P2}));});}
    const U={x0:1e9,x1:-1,y0:1e9,y1:-1};for(const k in frames)frames[k].forEach(im=>{const q=bounds(im,true);if(q.x1<0)return;U.x0=Math.min(U.x0,q.x0);U.x1=Math.max(U.x1,q.x1);U.y0=Math.min(U.y0,q.y0);U.y1=Math.max(U.y1,q.y1);});
    const fw=U.x1-U.x0+1,fh=U.y1-U.y0+1;
    for(const k in frames)frames[k]=frames[k].map(im=>{const col=new Array(fw*fh);for(let y=0;y<fh;y++)for(let x=0;x<fw;x++)col[y*fw+x]=im.col[(y+U.y0)*im.w+x+U.x0];return {w:fw,h:fh,col};});
    const OX=g.M-U.x0,OY=g.P-U.y0,AT=AN.attack;
    const hitPoint={x:OX+(dir>0?bb.x0+(bb.x1-bb.x0)*.7:bb.x0+(bb.x1-bb.x0)*.3),y:OY+bb.y0+(bb.y1-bb.y0)*.5},body={x:OX+(bb.x0+bb.x1+1)/2,y:OY+(bb.y0+bb.y1+1)/2};
    let muzzle=null;if(ranged){const im=frames.attack[AT.launch],q=bounds(im),ya=Math.round(q.y0+(q.y1-q.y0)*(AT.mz?AT.mz[0]:.2)),yz=Math.round(q.y0+(q.y1-q.y0)*(AT.mz?AT.mz[1]:.62));let mx=-1,my=0;
      for(let y=ya;y<=yz;y++)for(let x=0;x<im.w;x++){const c=im.col[y*im.w+x];if(!c||c===SHADOW)continue;const e=dir>0?x:im.w-1-x;if(e>mx){mx=e;my=y;}}
      if(mx>=0)muzzle={x:dir>0?mx+1:im.w-2-mx,y:my};}
    return {fw,fh,ox:OX,oy:OY,frames,fps:{idle:4,attack:AT.fps,hurt:8,win:8,die:8,ko:4},hit:AT.hit,ranged,launch:ranged?AT.launch:null,muzzle,hitPoint,body,main:g.main};
  }
  const RC={};
  function toCanvas(im){const c=document.createElement('canvas');c.width=im.w;c.height=im.h;const x=c.getContext('2d'),d=x.createImageData(im.w,im.h);for(let i=0;i<im.col.length;i++){const h=im.col[i];if(!h)continue;d.data.set(RC[h]||(RC[h]=rgba(h)),i*4);}x.putImageData(d,0,0);return c;}
  return {ANIMS,ATK,E_ATK,ATK_OF,DIE_OF,IDLE_STYLE,STYLE,decode,build,toCanvas,styleOf:k=>STYLE[k]||'breathe',atkOf:k=>ATK_OF[k]||'lunge',dieOf:k=>DIE_OF[k]||'fall',sparkImage:()=>{const col=[];SPARK.forEach(r=>{for(const ch of r)col.push(ch==='.'?null:ch==='K'?INK:ch==='W'?WHITE:GOLD);});return {w:9,h:9,col};}};
}

const PXA = createPixelAnimator();
export const { ANIMS, ATK, IDLE_STYLE, STYLE, E_ATK, ATK_OF, DIE_OF } = PXA;
export { PXA };

// Schlüsselposen je Waffe (wa = Waffenwinkel in rad zusätzlich zur Grundneigung, hx/hy = Handversatz, trail = 'arc' ab a0 oder 'lines', tl = eigene Speedlines, glow = Radius der Stabkugel):
// Schwert Hieb im Bogen · Speer Stoß · Dolch Doppelstich (wind/strike/wind2/strike2) · Axt Hieb von oben · Hammer Sprung + Bodenschlag (lift) · Streitkolben Aufwärtsschlag · Stab Zauberkugel · Bogen Schuss · ohne Waffe Faustschlag.
export const HERO_POSES = {"speer":{"wind":{"wa":0.95,"hx":-4,"hy":-6,"eyes":"schmal","mouth":"neutral"},"smear":{"wa":1.2,"hx":3,"hy":-7,"eyes":"schmal","mouth":"offen","trail":"lines"},"strike":{"wa":1.25,"hx":8,"hy":-8,"eyes":"schmal","mouth":"offen"},"ouch":{"wa":-0.22,"hx":-2,"hy":0,"eyes":"au","mouth":"offen"},"cheer":{"wa":0.5,"hx":5,"hy":-12,"lx":-3,"ly":-30,"eyes":"froh","mouth":"breit"},"ko":{"hx":0,"hy":2,"eyes":"ko","mouth":"offen"}},"schwert":{"wind":{"wa":-1.3,"hx":-6,"hy":-20,"eyes":"schmal","mouth":"neutral"},"smear":{"wa":0.6,"hx":4,"hy":-8,"eyes":"schmal","mouth":"offen","trail":"arc","a0":-1.3},"strike":{"wa":1.41,"hx":6,"hy":-5,"eyes":"schmal","mouth":"offen"},"ouch":{"wa":-0.3,"hx":-2,"hy":1,"eyes":"au","mouth":"offen"},"cheer":{"wa":0.2,"hx":5,"hy":-25,"lx":-3,"ly":-30,"eyes":"froh","mouth":"breit"},"ko":{"hx":0,"hy":2,"eyes":"ko","mouth":"offen"}},"bogen":{"wind":{"hx":3,"hy":-10,"lx":14,"ly":-11,"draw":1,"arrow":1,"eyes":"schmal","mouth":"neutral"},"smear":{"hx":3,"hy":-10,"lx":8,"ly":-11,"draw":0,"eyes":"schmal","mouth":"offen"},"strike":{"hx":2,"hy":-9,"lx":5,"ly":-7,"draw":0,"eyes":"schmal"},"ouch":{"wa":-0.22,"hx":-2,"hy":1,"eyes":"au","mouth":"offen"},"cheer":{"hx":5,"hy":-27,"lx":-3,"ly":-30,"draw":0,"eyes":"froh","mouth":"breit"},"ko":{"hx":0,"hy":2,"eyes":"ko","mouth":"offen"}},"ohne":{"wind":{"hx":-3,"hy":-2,"eyes":"schmal"},"smear":{"hx":5,"hy":-7,"eyes":"schmal","mouth":"offen"},"strike":{"hx":9,"hy":-9,"eyes":"schmal","mouth":"offen"},"ouch":{"hx":-2,"hy":1,"eyes":"au","mouth":"offen"},"cheer":{"hx":4,"hy":-29,"lx":-4,"ly":-29,"eyes":"froh","mouth":"breit"},"ko":{"hx":0,"hy":2,"eyes":"ko","mouth":"offen"}},"dolch":{"wind":{"wa":0.5,"hx":-5,"hy":-3,"eyes":"schmal","mouth":"neutral"},"strike":{"wa":1.1,"hx":9,"hy":-7,"eyes":"schmal","mouth":"offen"},"wind2":{"wa":0.8,"hx":2,"hy":-5,"eyes":"schmal","mouth":"offen"},"strike2":{"wa":1.15,"hx":11,"hy":-4,"eyes":"schmal","mouth":"offen"},"ouch":{"wa":-0.3,"hx":-2,"hy":1,"eyes":"au","mouth":"offen"},"cheer":{"wa":0.2,"hx":5,"hy":-27,"lx":-3,"ly":-30,"eyes":"froh","mouth":"breit"},"ko":{"hx":0,"hy":2,"eyes":"ko","mouth":"offen"}},"axt":{"wind":{"wa":-1.3,"hx":-4,"hy":-21,"eyes":"schmal","mouth":"neutral"},"smear":{"wa":0.35,"hx":5,"hy":-14,"eyes":"schmal","mouth":"offen","trail":"arc","a0":-1.3},"strike":{"wa":1.95,"hx":7,"hy":-7,"eyes":"schmal","mouth":"offen"},"ouch":{"wa":-0.3,"hx":-2,"hy":1,"eyes":"au","mouth":"offen"},"cheer":{"wa":0.2,"hx":5,"hy":-24,"lx":-3,"ly":-30,"eyes":"froh","mouth":"breit"},"ko":{"hx":0,"hy":2,"eyes":"ko","mouth":"offen"}},"hammer":{"wind":{"wa":-1.35,"hx":-5,"hy":-12,"eyes":"schmal","mouth":"neutral"},"lift":{"wa":-0.1,"hx":2,"hy":-18,"eyes":"schmal","mouth":"offen"},"smear":{"wa":1.1,"hx":6,"hy":-13,"eyes":"schmal","mouth":"offen","trail":"arc","a0":-0.1},"strike":{"wa":2,"hx":8,"hy":-5,"eyes":"schmal","mouth":"offen"},"ouch":{"wa":-0.3,"hx":-2,"hy":1,"eyes":"au","mouth":"offen"},"cheer":{"wa":0.2,"hx":5,"hy":-20,"lx":-3,"ly":-30,"eyes":"froh","mouth":"breit"},"ko":{"hx":0,"hy":2,"eyes":"ko","mouth":"offen"}},"streitkolben":{"wind":{"wa":2,"hx":-6,"hy":-4,"eyes":"schmal","mouth":"neutral"},"smear":{"wa":1.25,"hx":4,"hy":-5,"eyes":"schmal","mouth":"offen","trail":"arc","a0":2},"strike":{"wa":0.4,"hx":8,"hy":-13,"eyes":"schmal","mouth":"offen"},"ouch":{"wa":-0.3,"hx":-2,"hy":1,"eyes":"au","mouth":"offen"},"cheer":{"wa":0.2,"hx":5,"hy":-20,"lx":-3,"ly":-30,"eyes":"froh","mouth":"breit"},"ko":{"hx":0,"hy":2,"eyes":"ko","mouth":"offen"}},"stab":{"wind":{"wa":0.2,"hx":-2,"hy":-3,"eyes":"schmal","mouth":"neutral","glow":3.6},"smear":{"wa":1.05,"hx":6,"hy":-8,"eyes":"schmal","mouth":"offen","glow":3.9},"strike":{"wa":1,"hx":5,"hy":-7,"eyes":"schmal","mouth":"offen"},"ouch":{"wa":-0.22,"hx":-2,"hy":0,"eyes":"au","mouth":"offen"},"cheer":{"wa":0.6,"hx":5,"hy":-12,"lx":-3,"ly":-30,"eyes":"froh","mouth":"breit"},"ko":{"hx":0,"hy":2,"eyes":"ko","mouth":"offen"}}};
// Alle Posen bleiben in der 112×81-Leinwand (oben ≥ 1, unten ≤ 79), damit nichts abgeschnitten wird. cheer = Siegerpose (beide Arme hoch: Waffenhand hebt die Waffe, freie Hand als Faust nach oben; ohne Waffe beide Fäuste hoch), ko = liegt nach dem Umfallen (Augen „ko“ = X).
export const posesFor = (type) => (type && HERO_POSES[type]) || HERO_POSES.ohne;

// Einmal pro Kampf aufrufen (beim Laden des Kampfes) und wiederverwenden.
export function heroCombatSheet(cfg) {
  const facing = Object.assign({}, cfg, { face: 1 });
  const draw = (extra) => turned(() => hero(Object.assign({}, facing, extra)), 1, 34, { sort: false }).render();
  const weapon = cfg.gear && cfg.gear.weapon, type = weapon ? weapon.type : null, ranged = type === 'bogen' || type === 'stab';
  const poses = {};
  for (const [k, p] of Object.entries(posesFor(type))) poses[k] = draw({ W: 112, pose: p });
  // Niederlage: Zwischenbild (50° gekippt) und Liegebild (Waffe liegt vor dem Helden am Boden). img.ox = Versatz zum Kampfbild.
  poses.kneel = heroKneel(cfg); poses.fall = heroFall(cfg); poses.down = heroDown(cfg);
  const sheet = PXA.build(shadowed(draw({})), poses, { role: 'hero', ysq: 50, ynk: 33, ranged, attack: PXA.ATK[type] ? type : undefined });
  if (type === 'bogen') sheet.projectile = decodeSprite(ARROWS[weapon.which === 'pp' ? 'pp' : 'past']);
  if (type === 'stab') { sheet.projectile = decodeSprite(MAGIC.orb); sheet.impact = decodeSprite(MAGIC.burst); sheet.projectileHead = .67; }
  return sheet;
}
export function enemyCombatSheet(key) {
  const sp = DUNGEON_ENEMIES_FACING_LEFT[key];
  if (!sp) return null;
  const ko = DUNGEON_ENEMIES_KO[key] || {}, poses = {};
  if (ko.kneel) poses.kneel = PXA.decode(ko.kneel, ALPHA);
  if (ko.down) poses.down = PXA.decode(ko.down, ALPHA);
  if (ko.fall) poses.fall = PXA.decode(ko.fall, ALPHA);
  const sheet = PXA.build(PXA.decode(sp, ALPHA), poses, { role: 'enemy', style: PXA.styleOf(key), atk: PXA.atkOf(key), die: PXA.dieOf(key) });
  // Zauber-Gegner (atk 'cast'): dieselbe Kugel wie der Stab, gespiegelt und rot-violett (#E0457B, Farbton) eingefärbt.
  if (sheet.ranged) { sheet.projectile = decodeSprite(MAGIC.orb); sheet.impact = decodeSprite(MAGIC.burst); sheet.projectileHead = .67; sheet.tint = '#E0457B'; }
  return sheet;
}

// Ebene für Pfeile: ein <canvas> absolut über der ganzen Kampfbühne (gleiche Größe), pointer-events: none.
export class ProjectileLayer {
  constructor(canvas, { scale = 2 } = {}) {
    this.cv = canvas; this.scale = scale; this.spark = PXA.toCanvas(PXA.sparkImage());
    Object.assign(canvas.style, { imageRendering: 'pixelated', pointerEvents: 'none' });
    this.resize();
  }
  resize() { this.cv.width = Math.ceil(this.cv.clientWidth / this.scale); this.cv.height = Math.ceil(this.cv.clientHeight / this.scale); }
  // Punkt im Blatt eines Players (Sprite-Pixel) → Pixel dieser Ebene.
  toLocal(player, pt) { const a = player.cv.getBoundingClientRect(), b = this.cv.getBoundingClientRect(), s = this.scale; return { x: (a.left - b.left) / s + pt.x * player.scale / s, y: (a.top - b.top) / s + pt.y * player.scale / s }; }
  // Harte Schritte im Takt der Animation, am Ziel ein Bild lang der Funke.
  fly(img, from, to, steps, ms, done, { impact, head = 1, tint } = {}) {
    const left = to.x < from.x, paint = (im, flip) => { const s = PXA.toCanvas(im); if (!flip && !tint) return s; const c = document.createElement('canvas'); c.width = s.width; c.height = s.height; const g = c.getContext('2d'); const put = () => { if (flip) { g.translate(s.width, 0); g.scale(-1, 1); } g.drawImage(s, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0); }; put(); if (tint) { g.globalCompositeOperation = 'hue'; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'destination-in'; put(); } return c; };
    const arrow = paint(img, left), hit = impact ? paint(impact, false) : this.spark, x = this.cv.getContext('2d'); let i = 0; clearTimeout(this.t); if (left) head = 1 - head;
    const step = () => {
      x.clearRect(0, 0, this.cv.width, this.cv.height);
      if (i < steps) { const k = i / steps; x.drawImage(arrow, Math.round(from.x + (to.x - from.x) * k - Math.round(arrow.width * head)), Math.round(from.y + (to.y - from.y) * k - arrow.height / 2)); i++; this.t = setTimeout(step, ms); }
      else { x.drawImage(hit, Math.round(to.x - hit.width / 2), Math.round(to.y - hit.height / 2)); if (done) done(); this.t = setTimeout(() => x.clearRect(0, 0, this.cv.width, this.cv.height), ms); }
    };
    step();
  }
}

// Spielt ein Blatt auf einem <canvas> ab. Der Canvas liegt absolut in einem Container von der Größe der ruhenden Figur.
export class SpritePlayer {
  constructor(canvas, sheet, { scale = 2, reducedMotion } = {}) {
    this.cv = canvas; this.sheet = sheet; this.scale = scale;
    this.reduced = reducedMotion ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.frames = {};
    for (const k in sheet.frames) this.frames[k] = sheet.frames[k].map(PXA.toCanvas);
    Object.assign(canvas, { width: sheet.fw, height: sheet.fh });
    Object.assign(canvas.style, { position: 'absolute', imageRendering: 'pixelated', width: sheet.fw * scale + 'px', height: sheet.fh * scale + 'px', left: -sheet.ox * scale + 'px', top: -sheet.oy * scale + 'px' });
    this.play('idle');
  }
  // name: 'idle' | 'attack' | 'hurt' | 'win' | 'die' | 'ko'. idle, win und ko laufen in Schleife; 'die' geht danach in 'ko' (liegen bleiben), attack/hurt zurück in 'idle'.
  // onHit feuert beim Treffer-Bild, onEnd nach dem letzten Bild.
  // Bogen und Stab (sheet.ranged): zusätzlich target (SpritePlayer des Gegners) und layer (ProjectileLayer) übergeben.
  play(name, { onHit, onEnd, target, layer } = {}) {
    clearTimeout(this.t);
    const S = this.sheet, list = this.frames[name], ms = 1000 / S.fps[name], loop = name === 'idle' || name === 'win' || name === 'ko';
    let seq = list.map((_, i) => i);
    if (this.reduced) seq = name === 'attack' ? [S.hit] : name === 'die' ? [list.length - 1] : [0];
    let i = 0;
    const step = () => {
      const f = seq[i];
      this.draw(list[f]);
      if (name === 'attack' && S.ranged && f === S.launch && target && layer) layer.fly(S.projectile, layer.toLocal(this, S.muzzle), layer.toLocal(target, target.sheet.hitPoint), S.hit - S.launch, ms, undefined, { impact: S.impact, head: S.projectileHead || 1, tint: S.tint });
      if (name === 'attack' && f === S.hit && onHit) onHit();
      i++;
      if (i >= seq.length) {
        if (!loop) { this.t = setTimeout(() => { if (onEnd) onEnd(); this.play(name === 'die' ? 'ko' : 'idle'); }, ms); return; }
        if (seq.length === 1) return;
        i = 0;
      }
      this.t = setTimeout(step, ms);
    };
    step();
  }
  draw(fr) { const x = this.cv.getContext('2d'); x.clearRect(0, 0, this.cv.width, this.cv.height); x.drawImage(fr, 0, 0); }
  destroy() { clearTimeout(this.t); }
}
