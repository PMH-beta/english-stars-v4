// UI-Animationen für English Stars (Pastell) · übernommen aus der Referenzdatei (Methode pxaUi), unverändert.
// Alle Elemente mit data-ui="art" bewegen sich im 8-fps-Takt in harten Stufen (kein Überblenden). Arten und Werte: siehe Screen 9.7 und START-HERE.md.
// Nutzung: const ui = createUiAnimator({ icon, idleFrames }); let t = 0; setInterval(() => ui.tick(t++), 125);
//   icon(ctx, name, w, h): Pixel-Icon zeichnen (Icon-Engine, für data-ui="swap").
//   idleFrames(el): 4 Canvas-Bilder fürs Atmen der Figur im Menü (data-ui="idle"), Vorlage: Methode uiIdle in der Referenzdatei.
//   Bei prefers-reduced-motion passiert nichts, der Ruhezustand aus dem Markup bleibt stehen.
export function createUiAnimator({ icon, idleFrames, root = document } = {}) {
  const self = { icon: icon || (() => {}), uiIdle: idleFrames || (() => null) };
  const pxaUi = function (t) {
    if(this._rm===undefined)this._rm=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;if(this._rm)return;
    if(!this._uiEls||t%16===0)this._uiEls=[...root.querySelectorAll('[data-ui]')];
    for(const el of this._uiEls){
      const k=el.dataset.ui,d=+(el.dataset.d||0),c=+(el.dataset.c||0),a=+(el.dataset.a||0),q=Math.floor((t+d)/2);
      if(el._t0===undefined){el._t0=el.style.transform||'';if(k==='flicker')el.style.transformOrigin='50% 100%';}
      const T=s=>{const v=(el._t0?el._t0+' ':'')+s;if(el._lt!==v){el.style.transform=v;el._lt=v;}},O=o=>{const v=String(o);if(el._lo!==v){el.style.opacity=v;el._lo=v;}},X=s=>{if(el.textContent!==s)el.textContent=s;};
      if(k==='bob')T('translateY('+Math.round([0,-1,-2,-1][q%4]*(a||1.5))+'px)');
      else if(k==='pulse')T('scale('+(1+[0,1,2,1][q%4]*(a||3)/100)+')');
      else if(k==='ring'){const C=c||12,p=(t+d)%C;if(p<8){const s=Math.floor(p/2);T('scale('+(1+s*(a||10)/100)+')');O([.9,.6,.35,.12][s]);}else O(0);}
      else if(k==='dots')X('.'.repeat(1+Math.floor((t+d)/3)%3));
      else if(k==='blink')O(Math.floor((t+d)/4)%2?0:1);
      else if(k==='shake'){const C=c||24,p=(t+d)%C;T('translateX('+(p<8?[0,-4,4,-3,3,-2,2,0][p]*(a?a/4:1):0)+'px)');}
      else if(k==='pop'){const C=c||40,p=(t%C)-d;if(p<0){T('scale(0)');O(0);}else{T('scale('+([.4,1.25,.92,1.05][p]??1)+')');O(1);}}
      else if(k==='flip'){const C=c||20,p=(t+d)%C;T('scaleX('+([1,.66,.33,.12,-.33,-.66,-1,-.66,-.33,.12,.33,.66][p]??1)+')');}
      else if(k==='rot90')T('rotate('+(Math.floor((t+d)/(a||2))%4*90)+'deg)');
      else if(k==='rot45')T('rotate('+((t+d)%8*45)+'deg)');
      else if(k==='fill'){if(el._w0===undefined)el._w0=parseFloat(el.style.width)||0;const C=c||40,p=(t+d)%C,f=+(el.dataset.from||0),s=Math.min(8,Math.floor(p/2)),w=(f+(el._w0-f)*s/8).toFixed(1)+'%';if(el.style.width!==w)el.style.width=w;}
      else if(k==='count'){if(el._n0===undefined)el._n0=el.textContent;const m=/(\d+)/.exec(el._n0);if(m){const C=c||40,p=(t+d)%C,n=Math.round(+m[1]*Math.min(8,Math.floor(p/2))/8);X(el._n0.replace(m[1],String(n)));}}
      else if(k==='hp'){if(el._w0===undefined){el._w0=parseFloat(el.style.width)||0;el._bg0=el.style.backgroundColor||el.style.background;}const C=c||16,at=+(el.dataset.at||0),p=t%C,f=+(el.dataset.from||el._w0),to=el._w0;let w=f,bg=el._bg0;
        if(p>=at){const e=p-at,g=e<3?f:Math.max(to,f-(f-to)*(e-2)/4);w=g;const cut=g>0?(to/g*100).toFixed(1):0;bg='linear-gradient(90deg,'+el._bg0+' 0 '+cut+'%,#FFFFFF '+cut+'% 100%)';}
        const ws=w.toFixed(1)+'%';if(el.style.width!==ws)el.style.width=ws;if(el._lb!==bg){el.style.background=bg;el._lb=bg;}}
      else if(k==='slide'){const C=c||48,p=(t+d)%C,y=p<3?[-70,-36,-10][p]:p<34?0:p<37?[-10,-36,-70][p-34]:-70;T('translateY('+y+'px)');O(p>=37?0:1);}
      else if(k==='shimmer'){const x=((t+d)%16)*10-30,v='linear-gradient(100deg,transparent '+x+'%,rgba(255,255,255,.6) '+x+'%,rgba(255,255,255,.6) '+(x+14)+'%,transparent '+(x+14)+'%)';if(el._ls!==v){el.style.backgroundImage=v;el._ls=v;}}
      else if(k==='bars'){const H=a||22;[...el.children].forEach((s,i)=>{const h=Math.round(4+((i*5+t*(2+i%3))%5)*(H-4)/4)+'px';if(s.style.height!==h)s.style.height=h;});}
      else if(k==='typing'){if(el._txt===undefined)el._txt=el.dataset.text||el.textContent;const C=c||40,p=(t+d)%C;X(el._txt.slice(0,Math.min(el._txt.length,Math.floor(p/2))));}
      else if(k==='scan'){const C=c||24,p=(t+d)%C;T('translateY('+Math.round(p/(C-1)*(a||100))+'px)');}
      else if(k==='fall'){const C=c||32,p=(t+d)%C;T('translateY('+Math.round(p/C*(a||80))+'px)');}
      else if(k==='wiggle')T('rotate('+[0,-2,0,2][q%4]*(a?a/2:1)+'deg)');
      else if(k==='flicker')T('scaleY('+[1,1.12,.94,1.06][(t+d)%4]+')');
      else if(k==='float'){const C=c||24,p=(t+d)%C;if(p<12){T('translateY('+(-p*(a||2))+'px)');O(p<8?1:[.7,.45,.2,0][p-8]);}else O(0);}
      else if(k==='glow'){const v='0 0 0 '+[0,3,6,3][q%4]+'px '+(el.dataset.col||'rgba(255,214,107,.6)');if(el._lg!==v){el.style.boxShadow=v;el._lg=v;}}
      else if(k==='confetti'){if(!el._cf)el._cf=[...el.children].filter(s=>s.tagName==='SPAN'&&s.style.position==='absolute').map((s,i)=>({s,top:parseFloat(s.style.top)||0,t0:s.style.transform||'',v:3+(i*7)%4}));const H=el.clientHeight+24;
        el._cf.forEach((o,i)=>{const y=Math.round(((o.top+12+t*o.v)%H)-o.top-12),v='translateY('+y+'px) '+o.t0+' scaleX('+[1,.45,-1,-.45][Math.floor((t+i)/2)%4]+')';if(o.lv!==v){o.s.style.transform=v;o.lv=v;}});}
      else if(k==='swap'&&el.getContext){const S=(el.dataset.seq||'').split(','),n=S[Math.floor((t+d)/2)%S.length];if(el._ln!==n||t%8===0){const x=el.getContext('2d');x.clearRect(0,0,el.width,el.height);this.icon(x,n,el.width,el.height);el._ln=n;}}
      else if(k==='idle'&&el.getContext){const L=this.uiIdle(el);if(!L)continue;const f=Math.floor((t+d)/2)%4,fr=L[f];if(el.width!==fr.width||el.height!==fr.height){el.width=fr.width;el.height=fr.height;}const x=el.getContext('2d');x.clearRect(0,0,el.width,el.height);x.drawImage(fr,0,0);}
      else if(k==='turn180'){const C=c||16,cy=Math.floor((t+d)/C),p=(t+d)%C;T('rotate('+((cy*180+(p>=C-2?(p-C+3)*90:0))%360)+'deg)');}
      else if(k==='halo'){const n=[4,5,6,5][q%4],v='0 0 0 '+n+'px #FFD66B,0 0 0 '+(n+2)+'px #1F1F24';if(el._lg!==v){el.style.boxShadow=v;el._lg=v;}}
      else if(k==='beat'){const C=c||12,p=(t+d)%C;T('translateY('+([0,-3,0,-2][p]||0)*(a?a/3:1)+'px)');}
      else if(k==='sparkle'&&el.getContext){const C=c||16,p=(t+d)%C,f=p<8?[0,1,2,3,2,1,0,-1][p]:-1;if(el._lf===f)continue;el._lf=f;const x=el.getContext('2d');x.clearRect(0,0,el.width,el.height);if(f<0)continue;const m=Math.floor(el.width/2),P=(xx,yy,col)=>{x.fillStyle=col;x.fillRect(m+xx,m+yy,1,1);};
        const W='#FFFFFF',Y='#FFD66B',K='#1F1F24';if(f===0){P(0,0,Y);}else if(f===1){P(0,0,W);[[1,0],[-1,0],[0,1],[0,-1]].forEach(([u,v])=>P(u,v,Y));}else{P(0,0,W);for(let r=1;r<=f;r++)[[r,0],[-r,0],[0,r],[0,-r]].forEach(([u,v])=>P(u,v,r===f?Y:W));if(f===3)[[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([u,v])=>P(u,v,Y));}}
    }
  };
  return { tick: (t) => pxaUi.call(self, t) };
}
