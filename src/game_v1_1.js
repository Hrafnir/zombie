/* Etter Mørket v1.1 — expanded survival build
   Adds trees, large ore rocks, pickaxe, smelter, puddles, water purification and more building.
   Pure browser JS. No build step. */

const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const titleScreen = $('titleScreen');
const pauseScreen = $('pauseScreen');
const helpScreen = $('helpScreen');
const gameOverScreen = $('gameOverScreen');
const hud = $('hud');
const sidePanel = $('sidePanel');
const sidePanelTitle = $('sidePanelTitle');
const sidePanelContent = $('sidePanelContent');
const toastLayer = $('toastLayer');
const interactionHint = $('interactionHint');
const messageLog = $('messageLog');
const objectiveBox = $('objectiveBox');
const hotbar = $('hotbar');
const dayLabel = $('dayLabel');
const threatPill = $('threatPill');
const damageVignette = $('damageVignette');

const meters = {
  health: $('healthMeter'), stamina: $('staminaMeter'), hunger: $('hungerMeter'), thirst: $('thirstMeter')
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a,b,c,d) => Math.hypot(a-c,b-d);
const rand = (a,b) => a + Math.random() * (b-a);
const randi = (a,b) => Math.floor(rand(a,b+1));
const choice = arr => arr[Math.floor(Math.random()*arr.length)];
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

let CONFIG = null;
let running = false;
let paused = false;
let last = performance.now();
let panelMode = null;
let selectedBuild = null;
let selectedStation = null;
let mouse = {x:0,y:0,wx:0,wy:0,clicked:false,down:false};
const keys = new Set();
const pressed = new Set();

const S = {
  worldW: 5120, worldH: 5120,
  camera: {x:0,y:0,shake:0},
  day: 1, time: 8*60, dayLength: 460,
  player: {x:2560,y:2560,r:16,hp:100,stamina:100,hunger:85,thirst:82,attackCd:0,interactCd:0,noise:0,iframe:0,weapon:'knife',spawnX:2560,spawnY:2560,frame:0},
  inv: {}, weapons: new Set(['knife']), milestones: new Set(),
  nodes: [], buildings: [], zombies: [], drops: [], projectiles: [], particles: [], messages: []
};

const ITEMS = {
  wood:'Treverk', stone:'Stein', ore:'Jernmalm', metal:'Metall', coal:'Kull', scrap:'Skrapmetall', cloth:'Tøy',
  food:'Mat', dirtyWater:'Skittent vann', water:'Rent vann', herbs:'Urter', ammo:'Ammunisjon', arrows:'Piler', parts:'Deler',
  bandage:'Bandasje', medkit:'Førstehjelpspakke', canteen:'Feltflaske'
};

const WEAPONS = {
  knife:{name:'Kniv', type:'melee', dmg:16, range:42, cd:.42, noise:40, stamina:5},
  axe:{name:'Øks', type:'melee', dmg:32, range:50, cd:.62, noise:85, stamina:10},
  pickaxe:{name:'Hakke', type:'melee', dmg:28, range:48, cd:.72, noise:90, stamina:12},
  spear:{name:'Spyd', type:'melee', dmg:36, range:68, cd:.72, noise:60, stamina:11},
  bow:{name:'Bue', type:'projectile', dmg:42, range:520, speed:560, cd:.68, noise:75, ammo:'arrows'},
  pistol:{name:'Pistol', type:'projectile', dmg:48, range:640, speed:820, cd:.32, noise:360, ammo:'ammo'},
  shotgun:{name:'Hagle', type:'spread', dmg:30, pellets:6, range:380, speed:720, cd:.92, noise:520, ammo:'ammo'}
};

const RECIPES = [
  {id:'axe', name:'Lag øks', cat:'Verktøy', cost:{wood:4,stone:3,cloth:1}, weapon:'axe', station:null, desc:'Gir mer tre fra trær og fungerer som våpen.'},
  {id:'pickaxe', name:'Lag hakke', cat:'Verktøy', cost:{wood:4,stone:5,cloth:1}, weapon:'pickaxe', station:null, desc:'Kreves for effektiv gruvedrift og malm.'},
  {id:'spear', name:'Lag spyd', cat:'Våpen', cost:{wood:5,stone:2,cloth:1}, weapon:'spear', station:null, desc:'Lengre rekkevidde i nærkamp.'},
  {id:'bandage', name:'Lag 2 bandasjer', cat:'Medisin', cost:{cloth:3,herbs:1}, item:'bandage', amount:2, station:null, desc:'Trygg tidlig healing.'},
  {id:'arrows', name:'Lag 10 piler', cat:'Ammo', cost:{wood:3,stone:1}, item:'arrows', amount:10, station:null, desc:'Ammunisjon til bue.'},
  {id:'campfire', name:'Bygg bål', cat:'Bygg', cost:{wood:6,stone:4}, build:'campfire', station:null, desc:'Renser vann og lager kull.'},
  {id:'workbench', name:'Bygg arbeidsbenk', cat:'Bygg', cost:{wood:12,scrap:6}, build:'workbench', station:null, desc:'Låser opp flere oppskrifter.'},
  {id:'woodWall', name:'Bygg trevegg', cat:'Bygg', cost:{wood:5}, build:'woodWall', station:null, desc:'Billig baseforsvar.'},
  {id:'spikes', name:'Bygg piggfelle', cat:'Bygg', cost:{wood:7,stone:3}, build:'spikes', station:null, desc:'Skader zombier som går over.'},
  {id:'bow', name:'Lag bue', cat:'Våpen', cost:{wood:8,cloth:4}, weapon:'bow', station:'workbench', desc:'Stille avstandsvåpen.'},
  {id:'canteen', name:'Lag feltflaske', cat:'Utstyr', cost:{scrap:3,cloth:2}, item:'canteen', amount:1, station:'workbench', desc:'Samler mer vann fra pytter.'},
  {id:'rainCollector', name:'Bygg regnsamler', cat:'Bygg', cost:{wood:8,cloth:4,scrap:3}, build:'rainCollector', station:'workbench', desc:'Produserer rent vann over tid.'},
  {id:'torch', name:'Bygg fakkel', cat:'Bygg', cost:{wood:2,cloth:1}, build:'torch', station:'workbench', desc:'Lys reduserer nattfaren rundt basen.'},
  {id:'bedroll', name:'Bygg sovepose', cat:'Bygg', cost:{cloth:6,wood:2}, build:'bedroll', station:'workbench', desc:'Setter respawnpunkt.'},
  {id:'storage', name:'Bygg lagerkasse', cat:'Bygg', cost:{wood:10,scrap:2}, build:'storage', station:'workbench', desc:'Baseobjekt og fremtidig lagring.'},
  {id:'smelter', name:'Bygg smelter', cat:'Bygg', cost:{stone:14,scrap:6,wood:6}, build:'smelter', station:'workbench', desc:'Smelter jernmalm til metall.'},
  {id:'stoneWall', name:'Bygg steinvegg', cat:'Bygg', cost:{stone:10,metal:1}, build:'stoneWall', station:'smelter', desc:'Sterkere baseforsvar.'},
  {id:'pistol', name:'Reparer pistol', cat:'Våpen', cost:{scrap:14,parts:4,metal:2}, weapon:'pistol', station:'workbench', desc:'Bråkete, men effektiv.'},
  {id:'shotgun', name:'Bygg hagle', cat:'Våpen', cost:{scrap:22,parts:8,wood:6,metal:4}, weapon:'shotgun', station:'smelter', desc:'Base-redderen.'}
];

const REFINING = [
  {id:'charcoal', name:'Brenn treverk til kull', station:'campfire', cost:{wood:2}, out:{coal:1}, time:4},
  {id:'cleanWater', name:'Rens skittent vann', station:'campfire', cost:{dirtyWater:1,wood:1}, out:{water:1}, time:3},
  {id:'smeltIron', name:'Smelt jernmalm til metall', station:'smelter', cost:{ore:2,coal:1}, out:{metal:1}, time:5},
  {id:'ammo', name:'Press 12 patroner', station:'smelter', cost:{scrap:5,metal:1}, out:{ammo:12}, time:4}
];

const BUILDINGS = {
  campfire:{name:'Bål', hp:120, w:42,h:42, color:'#e76f28', light:170, station:true},
  workbench:{name:'Arbeidsbenk', hp:180, w:62,h:42, color:'#8b5e34', station:true},
  smelter:{name:'Smelter', hp:240, w:58,h:58, color:'#59656a', light:150, station:true},
  woodWall:{name:'Trevegg', hp:190, w:54,h:28, color:'#72502f', solid:true},
  stoneWall:{name:'Steinvegg', hp:360, w:56,h:32, color:'#7d8587', solid:true},
  spikes:{name:'Piggfelle', hp:110, w:48,h:48, color:'#a07a48', trap:true},
  rainCollector:{name:'Regnsamler', hp:140, w:46,h:46, color:'#6d93a4', waterStore:0},
  torch:{name:'Fakkel', hp:45, w:22,h:22, color:'#ffb347', light:230},
  bedroll:{name:'Sovepose', hp:80, w:56,h:32, color:'#36527a'},
  storage:{name:'Lagerkasse', hp:120, w:46,h:38, color:'#8b6a3d'}
};

function itemName(id){ return ITEMS[id] || WEAPONS[id]?.name || BUILDINGS[id]?.name || id; }
function addItem(id,n=1){ if(n<=0)return; S.inv[id]=(S.inv[id]||0)+n; }
function has(id,n=1){ return (S.inv[id]||0)>=n || S.weapons.has(id); }
function removeItem(id,n=1){ if((S.inv[id]||0)<n)return false; S.inv[id]-=n; if(S.inv[id]<=0)delete S.inv[id]; return true; }
function canPay(cost){ return Object.entries(cost||{}).every(([id,n]) => (S.inv[id]||0)>=n); }
function pay(cost){ if(!canPay(cost))return false; Object.entries(cost||{}).forEach(([id,n])=>removeItem(id,n)); return true; }
function costText(cost){ return Object.entries(cost||{}).map(([id,n])=>`${itemName(id)} ×${n}`).join(', '); }
function missingText(cost){ return Object.entries(cost||{}).filter(([id,n])=>(S.inv[id]||0)<n).map(([id,n])=>`${itemName(id)} ×${n-(S.inv[id]||0)}`).join(', '); }
function stationName(s){ return !s ? 'ingen' : BUILDINGS[s]?.name || s; }
function stationNear(s){ return !s || nearestBuilding(S.player.x,S.player.y,110,b=>b.type===s); }

function toast(msg){
  const el=document.createElement('div'); el.className='toast'; el.textContent=msg; toastLayer.appendChild(el); setTimeout(()=>el.remove(),3200);
  S.messages.unshift(msg); S.messages=S.messages.slice(0,5); renderLog();
}
function renderLog(){ messageLog.innerHTML=S.messages.map(m=>`<div>${m}</div>`).join(''); }
function save(){ localStorage.setItem('etter-morket-v11-save', JSON.stringify({S, selectedBuild:null, savedAt:Date.now()})); toast('Lagret.'); }
function loadSave(){ const raw=localStorage.getItem('etter-morket-v11-save'); if(!raw)return false; try{ const d=JSON.parse(raw).S; Object.assign(S,d); S.weapons=new Set(d.weapons||['knife']); S.milestones=new Set(d.milestones||[]); return true; }catch{return false;} }

function resize(){ const dpr=Math.max(1,Math.min(2,devicePixelRatio||1)); canvas.width=Math.floor(innerWidth*dpr); canvas.height=Math.floor(innerHeight*dpr); canvas.style.width=innerWidth+'px'; canvas.style.height=innerHeight+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); }
addEventListener('resize', resize); resize();

addEventListener('keydown', e=>{ const k=e.key.toLowerCase(); if(!keys.has(k))pressed.add(k); keys.add(k); if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault(); handleKey(k); });
addEventListener('keyup', e=>keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', e=>setMouse(e));
canvas.addEventListener('mousedown', e=>{ setMouse(e); if(e.button===0){ mouse.down=true; mouse.clicked=true; handleClick(); } });
addEventListener('mouseup', ()=>mouse.down=false);
canvas.addEventListener('contextmenu', e=>e.preventDefault());

function setMouse(e){ const r=canvas.getBoundingClientRect(); mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; mouse.wx=mouse.x+S.camera.x; mouse.wy=mouse.y+S.camera.y; }
function down(...a){ return a.some(k=>keys.has(k)); }

$('startBtn').onclick=()=>start(false);
$('continueBtn').onclick=()=>start(true);
$('howToBtn').onclick=()=>helpScreen.classList.add('screen--active');
$('closeHelpBtn').onclick=()=>helpScreen.classList.remove('screen--active');
$('resumeBtn').onclick=()=>togglePause(false);
$('saveBtn').onclick=()=>save();
$('newGameBtn').onclick=()=>{ localStorage.removeItem('etter-morket-v11-save'); reset(); togglePause(false); };
$('restartBtn').onclick=()=>{ gameOverScreen.classList.remove('screen--active'); reset(); running=true; hud.classList.remove('hidden'); requestAnimationFrame(loop); };
$('backToTitleBtn').onclick=()=>{ gameOverScreen.classList.remove('screen--active'); titleScreen.classList.add('screen--active'); hud.classList.add('hidden'); running=false; };
$('closePanelBtn').onclick=()=>closePanel();

async function boot(){
  try { CONFIG = await (await fetch('data/levels.json')).json(); } catch { CONFIG = {}; }
  drawBackgroundOnly();
}
function start(tryLoad){
  if(!tryLoad || !loadSave()) reset();
  titleScreen.classList.remove('screen--active'); helpScreen.classList.remove('screen--active'); pauseScreen.classList.remove('screen--active');
  hud.classList.remove('hidden'); running=true; paused=false; last=performance.now(); toast('Finn vann, lag hakke og bygg før natten.'); requestAnimationFrame(loop);
}
function reset(){
  S.worldW=(CONFIG.world?.widthTiles||160)*(CONFIG.world?.tileSize||32); S.worldH=(CONFIG.world?.heightTiles||160)*(CONFIG.world?.tileSize||32); S.dayLength=CONFIG.world?.dayLengthSeconds||460;
  Object.assign(S.player,{x:S.worldW/2,y:S.worldH/2,spawnX:S.worldW/2,spawnY:S.worldH/2,hp:100,stamina:100,hunger:86,thirst:84,weapon:'knife',noise:0,iframe:0,attackCd:0,interactCd:0});
  S.day=1; S.time=8*60; S.inv={wood:8,stone:5,food:3,water:2,cloth:3}; S.weapons=new Set(['knife']); S.milestones=new Set();
  S.nodes=[]; S.buildings=[]; S.zombies=[]; S.drops=[]; S.projectiles=[]; S.particles=[]; S.messages=[]; selectedBuild=null; panelMode=null;
  generateWorld(); renderHotbar(); renderObjectives();
}
function generateWorld(){
  const safe=360;
  const addNode=(type,x,y)=>S.nodes.push({id:uid(),type,x,y,hp:nodeDef(type).hp,maxHp:nodeDef(type).hp,depleted:false,cool:0,rot:rand(-.2,.2)});
  function place(type,n,minD=safe){ for(let i=0;i<n;i++){ let x,y,t=0; do{x=rand(80,S.worldW-80); y=rand(80,S.worldH-80); t++;}while(dist(x,y,S.player.x,S.player.y)<minD && t<40); addNode(type,x,y); } }
  place('tree',260,120); place('rock',78,170); place('oreRock',46,330); place('puddle',34,160); place('bush',55,130); place('scrapPile',42,220);
  [['tree',-140,-80],['tree',-190,70],['rock',160,-110],['puddle',155,75],['bush',70,-120],['scrapPile',-210,-80],['oreRock',260,180]].forEach(([t,dx,dy])=>addNode(t,S.player.x+dx,S.player.y+dy));
  for(let i=0;i<36;i++)spawnZombie(true);
}
function nodeDef(t){ return {
  tree:{name:'Tre', hp:5, kind:'tree', color:'#245c36', needs:null, noise:130},
  rock:{name:'Stor stein', hp:7, kind:'rock', color:'#737d80', needs:'pickaxe', noise:170},
  oreRock:{name:'Malmstein', hp:9, kind:'ore', color:'#586165', needs:'pickaxe', noise:190},
  puddle:{name:'Vannpytt', hp:1, kind:'water', color:'#236d88', needs:null, noise:35},
  bush:{name:'Bærbusk', hp:2, kind:'bush', color:'#357a45', needs:null, noise:45},
  scrapPile:{name:'Skrothaug', hp:4, kind:'scrap', color:'#82745e', needs:null, noise:120}
}[t]; }

function spawnZombie(far=false){
  let x,y,t=0; do{x=rand(80,S.worldW-80); y=rand(80,S.worldH-80); t++;}while(far && dist(x,y,S.player.x,S.player.y)<720 && t<60);
  const r=Math.random(); const type=r<.72?'walker':r<.9?'runner':r<.97?'spitter':'brute';
  const def=zDef(type); S.zombies.push({id:uid(),type,x,y,hp:def.hp,maxHp:def.hp,r:def.r,state:'wander',tx:x+rand(-220,220),ty:y+rand(-220,220),atk:rand(0,1),frame:0,spit:rand(1,4)});
}
function zDef(t){ return {
  walker:{name:'Vandrer',hp:56,speed:56,dmg:8,r:15,sense:235,color:'#6e8f62'},
  runner:{name:'Løper',hp:38,speed:102,dmg:7,r:14,sense:285,color:'#8f9160'},
  brute:{name:'Kjempe',hp:160,speed:42,dmg:20,r:22,sense:230,color:'#65705f'},
  spitter:{name:'Spytter',hp:70,speed:50,dmg:6,r:16,sense:310,color:'#73996f'}
}[t]; }

function handleKey(k){
  if(k==='escape'){ if(selectedBuild){selectedBuild=null;toast('Bygging avbrutt.');return;} if(!sidePanel.classList.contains('hidden')){closePanel();return;} if(running)togglePause(); }
  if(!running||paused)return;
  if(k==='i')showInventory(); if(k==='c')showCrafting(); if(k==='b')showBuildMenu(); if(k==='f')useFood(); if(k==='v')drink(); if(k==='h')heal(); if(k==='e')interact(); if(k===' ')dodge();
  if(['1','2','3','4','5','6'].includes(k))selectWeapon(Number(k)-1);
}
function togglePause(force){ paused=force!==undefined?force:!paused; pauseScreen.classList.toggle('screen--active',paused); if(paused)save(); }
function closePanel(){ sidePanel.classList.add('hidden'); panelMode=null; selectedStation=null; }
function handleClick(){ if(!running||paused)return; if(selectedBuild){placeBuilding(selectedBuild,mouse.wx,mouse.wy);return;} attack(); }

function loop(t){ const dt=Math.min(.05,(t-last)/1000||0); last=t; if(running&&!paused)update(dt); draw(); pressed.clear(); mouse.clicked=false; if(running)requestAnimationFrame(loop); }
function update(dt){
  const p=S.player; p.attackCd=Math.max(0,p.attackCd-dt); p.interactCd=Math.max(0,p.interactCd-dt); p.iframe=Math.max(0,p.iframe-dt); p.noise=Math.max(0,p.noise-dt*240);
  S.time+=dt*(24*60/S.dayLength); if(S.time>=1440){S.time-=1440;S.day++; while(S.zombies.length<Math.min(110,36+S.day*7))spawnZombie(true); toast(`Dag ${S.day}. Flere zombier samles.`);}
  let ix=(down('d','arrowright')?1:0)-(down('a','arrowleft')?1:0), iy=(down('s','arrowdown')?1:0)-(down('w','arrowup')?1:0); const l=Math.hypot(ix,iy)||1;
  const sprint=down('shift')&&p.stamina>4&&(ix||iy); const sp=148*(sprint?1.62:1); movePlayer(p.x+ix/l*sp*dt,p.y+iy/l*sp*dt);
  if(ix||iy){ p.frame+=dt*(sprint?12:7); p.noise=Math.max(p.noise,sprint?155:72); p.stamina=clamp(p.stamina+(sprint?-22:10)*dt,0,100); } else p.stamina=clamp(p.stamina+16*dt,0,100);
  p.hunger=clamp(p.hunger-dt*.38,0,100); p.thirst=clamp(p.thirst-dt*.54,0,100); if(p.hunger<=0||p.thirst<=0)p.hp=clamp(p.hp-dt*3.4,0,100); if(p.hunger>72&&p.thirst>72)p.hp=clamp(p.hp+dt*.65,0,100);
  updateNodes(dt); updateBuildings(dt); updateProjectiles(dt); updateZombies(dt); updateDrops(dt); updateParticles(dt); autoPickup(); updateHud(); if(p.hp<=0)gameOver();
}
function movePlayer(nx,ny){ const p=S.player, ox=p.x, oy=p.y; p.x=clamp(nx,20,S.worldW-20); p.y=clamp(ny,20,S.worldH-20); for(const b of S.buildings){ if(!BUILDINGS[b.type].solid)continue; if(rectCircle(b.x,b.y,b.w,b.h,p.x,p.y,p.r)){p.x=ox;p.y=oy;return;} } }
function rectCircle(rx,ry,rw,rh,cx,cy,cr){ const qx=clamp(cx,rx-rw/2,rx+rw/2), qy=clamp(cy,ry-rh/2,ry+rh/2); return dist(qx,qy,cx,cy)<cr; }
function isNight(){ const h=S.time/60; return h<6||h>=21; }

function attack(){
  const p=S.player,w=WEAPONS[p.weapon]||WEAPONS.knife; if(p.attackCd>0)return; if(w.ammo&&!removeItem(w.ammo,1)){toast(`Mangler ${itemName(w.ammo)}.`);return;} p.attackCd=w.cd; p.stamina=clamp(p.stamina-(w.stamina||0),0,100); p.noise=Math.max(p.noise,w.noise); const a=Math.atan2(mouse.wy-p.y,mouse.wx-p.x);
  if(w.type==='projectile'){ S.projectiles.push({x:p.x,y:p.y,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,dmg:w.dmg,life:w.range/w.speed,kind:'arrow'}); }
  else if(w.type==='spread'){ for(let i=0;i<w.pellets;i++){ const aa=a+rand(-.26,.26); S.projectiles.push({x:p.x,y:p.y,vx:Math.cos(aa)*w.speed,vy:Math.sin(aa)*w.speed,dmg:w.dmg,life:w.range/w.speed,kind:'shot'}); } }
  else { let hit=false; for(const z of S.zombies){ const d=dist(p.x,p.y,z.x,z.y); const za=Math.atan2(z.y-p.y,z.x-p.x); const da=Math.abs(Math.atan2(Math.sin(za-a),Math.cos(za-a))); if(d<w.range+z.r&&da<1.05){damageZombie(z,w.dmg,Math.cos(a)*45,Math.sin(a)*45);hit=true;break;} } if(!hit)hitNodeInArc(a,w); }
}
function hitNodeInArc(a,w){ const p=S.player; for(const n of S.nodes){ if(n.depleted)continue; const d=dist(p.x,p.y,n.x,n.y); const na=Math.atan2(n.y-p.y,n.x-p.x); const da=Math.abs(Math.atan2(Math.sin(na-a),Math.cos(na-a))); if(d<58&&da<.9){harvest(n,true);break;} } }
function damageZombie(z,dmg,kx=0,ky=0){ z.hp-=dmg; z.x+=kx; z.y+=ky; z.state='chase'; particle(z.x,z.y,zDef(z.type).color,8); if(z.hp<=0){ S.zombies=S.zombies.filter(o=>o!==z); const loot=z.type==='brute'?{scrap:[1,4],parts:[0,2]}:{cloth:[0,2],food:[0,1],scrap:[0,1]}; giveLoot(loot,z.x,z.y); setTimeout(()=>spawnZombie(true),randi(1200,5000)); } }
function dodge(){ const p=S.player;if(p.stamina<20)return; const a=Math.atan2(mouse.wy-p.y,mouse.wx-p.x); movePlayer(p.x-Math.cos(a)*60,p.y-Math.sin(a)*60); p.stamina-=20; p.iframe=.25; }

function interact(){ if(S.player.interactCd>0)return; S.player.interactCd=.25; const d=nearestDrop(); if(d){collectDrop(d);return;} const b=nearestBuilding(S.player.x,S.player.y,72); if(b){useBuilding(b);return;} const n=nearestNode(); if(n){harvest(n,false);return;} toast('Ingenting å bruke her.'); }
function nearestNode(){ let best=null,bd=68; for(const n of S.nodes){ if(n.depleted)continue; const d=dist(S.player.x,S.player.y,n.x,n.y); if(d<bd){best=n;bd=d;} } return best; }
function nearestDrop(){ let best=null,bd=42; for(const d of S.drops){ const dd=dist(S.player.x,S.player.y,d.x,d.y); if(dd<bd){best=d;bd=dd;} } return best; }
function nearestBuilding(x,y,r,pred=()=>true){ let best=null,bd=r; for(const b of S.buildings){ if(!pred(b))continue; const d=dist(x,y,b.x,b.y); if(d<bd){best=b;bd=d;} } return best; }
function harvest(n,fromAttack){ const def=nodeDef(n.type); if(def.needs&&!S.weapons.has(def.needs)){toast(`${def.name} krever ${itemName(def.needs)}.`);return;} if(n.type==='puddle'){ const amt=S.inv.canteen? randi(3,5):randi(1,2); addItem('dirtyWater',amt); n.depleted=true; n.cool=55; toast(`Samlet skittent vann ×${amt}.`); refreshPanel(); return; }
  const tool=S.player.weapon; const good=(n.type==='tree'&&tool==='axe')||((n.type==='rock'||n.type==='oreRock')&&tool==='pickaxe'); n.hp-=good?2:1; S.player.noise=Math.max(S.player.noise,def.noise+(good?-30:20)); S.player.stamina=clamp(S.player.stamina-(fromAttack?0:6),0,100); particle(n.x,n.y,def.color,6);
  if(n.hp<=0){ n.depleted=true; n.cool=n.type==='tree'?95:140; n.hp=n.maxHp; const loot=nodeLoot(n.type,good); giveLoot(loot,n.x,n.y); toast(`${def.name} samlet.`); refreshPanel(); }
}
function nodeLoot(t,good){ if(t==='tree')return {wood: good?[5,9]:[2,5]}; if(t==='rock')return {stone:good?[7,12]:[2,4],ore:good?[0,1]:[0,0]}; if(t==='oreRock')return {stone:good?[5,9]:[2,4],ore:good?[4,8]:[1,2],coal:good?[0,1]:[0,0]}; if(t==='bush')return {food:[1,3],herbs:[0,2],wood:[0,1]}; if(t==='scrapPile')return {scrap:[1,4],cloth:[0,2],parts:[0,1],metal:[0,1]}; return {}; }
function giveLoot(table,x,y){ for(const [id,range] of Object.entries(table)){ const n=Array.isArray(range)?randi(range[0],range[1]):range; if(n>0)S.drops.push({id,amount:n,x:x+rand(-14,14),y:y+rand(-14,14),vx:rand(-30,30),vy:rand(-30,30)}); } }
function collectDrop(d){ addItem(d.id,d.amount); S.drops=S.drops.filter(o=>o!==d); toast(`Plukket opp ${itemName(d.id)} ×${d.amount}`); refreshPanel(); }
function autoPickup(){ for(const d of [...S.drops]) if(dist(S.player.x,S.player.y,d.x,d.y)<22)collectDrop(d); }

function useBuilding(b){ if(b.type==='workbench'||b.type==='campfire'||b.type==='smelter'){ showStation(b); return; } if(b.type==='rainCollector'){ const n=Math.floor(b.waterStore||0); if(n>0){addItem('water',n); b.waterStore=0; toast(`Tømte regnsamler: rent vann ×${n}`);} else toast('Regnsamleren er tom.'); refreshPanel(); return; } if(b.type==='bedroll'){S.player.spawnX=b.x;S.player.spawnY=b.y;toast('Respawnpunkt satt.');return;} toast(`${BUILDINGS[b.type].name} står her.`); }
function placeBuilding(type,x,y){ const def=BUILDINGS[type], rec=RECIPES.find(r=>r.build===type); if(!def||!rec)return; if(!canPay(rec.cost)){toast(`Mangler: ${missingText(rec.cost)}`);return;} if(!stationNear(rec.station)){toast(`Du må stå ved ${stationName(rec.station)}.`);return;} if(x<30||y<30||x>S.worldW-30||y>S.worldH-30){toast('Kan ikke bygge utenfor kartet.');return;} for(const b of S.buildings){ if(Math.abs(b.x-x)<(b.w+def.w)/2+8 && Math.abs(b.y-y)<(b.h+def.h)/2+8){toast('For nær et annet bygg.');return;} } for(const n of S.nodes){ if(!n.depleted&&dist(x,y,n.x,n.y)<54){toast('Rydd området først.');return;} }
  pay(rec.cost); const b={id:uid(),type,x,y,w:def.w,h:def.h,hp:def.hp,maxHp:def.hp,waterStore:0,job:null}; S.buildings.push(b); if(type==='bedroll'){S.player.spawnX=x;S.player.spawnY=y;} selectedBuild=null; toast(`${def.name} bygget.`); refreshPanel(); }
function craft(id){ const r=RECIPES.find(x=>x.id===id); if(!r)return; if(!stationNear(r.station)){toast(`Du må stå ved ${stationName(r.station)}.`);return;} if(!pay(r.cost)){toast(`Mangler: ${missingText(r.cost)}`);return;} if(r.weapon){S.weapons.add(r.weapon);S.player.weapon=r.weapon;toast(`Laget ${WEAPONS[r.weapon].name}.`);renderHotbar();} if(r.item){addItem(r.item,r.amount||1);toast(`Laget ${itemName(r.item)} ×${r.amount||1}.`);} if(r.build){selectedBuild=r.build;toast(`Velg plassering for ${BUILDINGS[r.build].name}.`);} refreshPanel(); }
function refine(id,b){ const r=REFINING.find(x=>x.id===id); if(!r)return; b=b||nearestBuilding(S.player.x,S.player.y,110,x=>x.type===r.station); if(!b){toast(`Du må stå ved ${stationName(r.station)}.`);return;} if(b.job){toast('Stasjonen er opptatt.');return;} if(!pay(r.cost)){toast(`Mangler: ${missingText(r.cost)}`);return;} b.job={id:r.id,t:0,total:r.time}; toast(`${r.name} startet.`); refreshPanel(); }

function updateNodes(dt){ for(const n of S.nodes){ if(n.depleted){n.cool-=dt; if(n.cool<=0){n.depleted=false;n.hp=n.maxHp;}} } }
function updateBuildings(dt){ for(const b of S.buildings){ if(b.job){ const r=REFINING.find(x=>x.id===b.job.id); b.job.t+=dt; if(b.job.t>=b.job.total){ Object.entries(r.out).forEach(([id,n])=>addItem(id,n)); toast(`Ferdig: ${costText(r.out)}`); b.job=null; refreshPanel(); } } if(b.type==='rainCollector')b.waterStore=clamp((b.waterStore||0)+dt*.025,0,8); } S.buildings=S.buildings.filter(b=>b.hp>0); }
function updateProjectiles(dt){ for(const p of S.projectiles){ p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt; for(const z of S.zombies){ if(dist(p.x,p.y,z.x,z.y)<z.r+5){damageZombie(z,p.dmg,p.vx*.035,p.vy*.035);p.life=-1;break;} } } S.projectiles=S.projectiles.filter(p=>p.life>0&&p.x>0&&p.y>0&&p.x<S.worldW&&p.y<S.worldH); }
function updateZombies(dt){ const p=S.player; for(const z of [...S.zombies]){ const def=zDef(z.type); const d=dist(p.x,p.y,z.x,z.y); const aggro=def.sense+(isNight()?95:0)+Math.min(180,p.noise); if(d<aggro)z.state='chase'; else if(d>aggro*1.75&&z.state==='chase')z.state='wander'; let tx=z.tx,ty=z.ty,sp=def.speed; if(z.state==='chase'){tx=p.x;ty=p.y;if(isNight())sp*=1.1;} else if(dist(z.x,z.y,z.tx,z.ty)<25||Math.random()<dt*.04){z.tx=clamp(z.x+rand(-260,260),40,S.worldW-40);z.ty=clamp(z.y+rand(-260,260),40,S.worldH-40);} const a=Math.atan2(ty-z.y,tx-z.x); z.x+=Math.cos(a)*sp*dt; z.y+=Math.sin(a)*sp*dt; z.frame+=dt*7; z.atk-=dt; z.spit-=dt;
    const b=nearestBuilding(z.x,z.y,45,x=>BUILDINGS[x.type].solid||BUILDINGS[x.type].trap); if(b&&z.atk<=0){b.hp-=def.dmg*.8; z.atk=.8; particle(b.x,b.y,'#d6b47a',4); if(BUILDINGS[b.type].trap)damageZombie(z,24);}
    if(z.type==='spitter'&&z.state==='chase'&&d<320&&z.spit<=0){ const aa=Math.atan2(p.y-z.y,p.x-z.x); S.projectiles.push({x:z.x,y:z.y,vx:Math.cos(aa)*320,vy:Math.sin(aa)*320,dmg:10,life:1.3,enemy:true,kind:'acid'}); z.spit=2.5; }
    if(d<z.r+p.r+7&&z.atk<=0){ if(p.iframe<=0){p.hp=clamp(p.hp-def.dmg,0,100);p.iframe=.45;S.camera.shake=10;damageVignette.classList.add('hit');setTimeout(()=>damageVignette.classList.remove('hit'),180);} z.atk=def.atk||1; }
  } }
function updateDrops(dt){ for(const d of S.drops){d.x+=d.vx*dt;d.y+=d.vy*dt;d.vx*=Math.pow(.05,dt);d.vy*=Math.pow(.05,dt);} }
function updateParticles(dt){ for(const p of S.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;} S.particles=S.particles.filter(p=>p.life>0); }
function particle(x,y,color,n){ for(let i=0;i<n;i++)S.particles.push({x,y,vx:rand(-60,60),vy:rand(-60,60),life:rand(.2,.65),color}); }

function useFood(){ if(!removeItem('food',1)){toast('Du har ikke mat.');return;} S.player.hunger=clamp(S.player.hunger+28,0,100); toast('Du spiste mat.'); refreshPanel(); }
function drink(){ if(removeItem('water',1)){S.player.thirst=clamp(S.player.thirst+35,0,100);toast('Du drakk rent vann.');} else if(removeItem('dirtyWater',1)){S.player.thirst=clamp(S.player.thirst+22,0,100); if(Math.random()<.35){S.player.hp-=8;toast('Skittent vann gjorde deg syk.');} else toast('Du drakk skittent vann.');} else toast('Du har ikke vann.'); refreshPanel(); }
function heal(){ if(removeItem('medkit',1)){S.player.hp=clamp(S.player.hp+65,0,100);toast('Førstehjelpspakke brukt.');} else if(removeItem('bandage',1)){S.player.hp=clamp(S.player.hp+28,0,100);toast('Bandasje brukt.');} else toast('Du har ikke førstehjelp.'); refreshPanel(); }
function selectWeapon(i){ const list=[...S.weapons]; if(list[i]){S.player.weapon=list[i];renderHotbar();toast(`Valgt: ${WEAPONS[list[i]].name}`);} }

function showPanel(title,html){ sidePanelTitle.textContent=title; sidePanelContent.innerHTML=html; sidePanel.classList.remove('hidden'); }
function refreshPanel(){ if(sidePanel.classList.contains('hidden'))return; if(panelMode==='inventory')showInventory(); if(panelMode==='craft')showCrafting(selectedStation); if(panelMode==='build')showBuildMenu(); if(panelMode==='station'&&selectedStation)showStation(selectedStation); }
function tabs(active){ return `<div class="panelTabs"><button data-tab="inventory" class="${active==='inventory'?'active':''}">Inventory</button><button data-tab="craft" class="${active==='craft'?'active':''}">Crafting</button><button data-tab="build" class="${active==='build'?'active':''}">Bygg</button></div>`; }
function showInventory(){ panelMode='inventory'; const rows=Object.keys({...ITEMS,...Object.fromEntries([...S.weapons].map(w=>[w,WEAPONS[w].name]))}).map(id=>{ const n=S.inv[id]||0; if(!n&&!S.weapons.has(id))return ''; const use=['food','water','dirtyWater','bandage','medkit'].includes(id); return `<div class="craftRow"><div><strong>${itemName(id)} ${S.weapons.has(id)?'(våpen)':`×${n}`}</strong><p>${id==='dirtyWater'?'Kan renses på bål.':id==='ore'?'Smeltes i smelter.':''}</p></div>${use?`<button data-use="${id}">Bruk</button>`:''}</div>`; }).join(''); showPanel('Inventory',tabs('inventory')+rows); }
function showCrafting(st=null){ panelMode='craft'; selectedStation=st; const rows=RECIPES.filter(r=>!r.build&&(!st||r.station===st||!r.station)).map(r=>rowRecipe(r)).join(''); showPanel('Crafting',tabs('craft')+`<p class="panelHint">Stasjoner: arbeidsbenk, bål og smelter åpner flere valg.</p>`+rows); }
function showBuildMenu(){ panelMode='build'; const rows=RECIPES.filter(r=>r.build).map(r=>rowRecipe(r)).join(''); showPanel('Bygging',tabs('build')+`<p class="panelHint">Velg bygg, klikk i verden. Esc avbryter.</p>`+rows); }
function rowRecipe(r){ const ok=canPay(r.cost)&&stationNear(r.station); return `<div class="craftRow"><div><strong>${r.name}</strong><p>${r.desc||''}</p><small>Koster: ${costText(r.cost)} • Stasjon: ${stationName(r.station)}</small></div><button ${ok?'':'disabled'} data-craft="${r.id}">${ok?'Lag/velg':'Mangler'}</button></div>`; }
function showStation(b){ panelMode='station'; selectedStation=b; const relevant=REFINING.filter(r=>r.station===b.type); const job=b.job?REFINING.find(r=>r.id===b.job.id):null; const rows=relevant.map(r=>`<div class="craftRow"><div><strong>${r.name}</strong><p>Koster: ${costText(r.cost)} → Gir: ${costText(r.out)}</p></div><button ${(canPay(r.cost)&&!b.job)?'':'disabled'} data-refine="${r.id}">${b.job?'Opptatt':'Start'}</button></div>`).join(''); showPanel(BUILDINGS[b.type].name,tabs('craft')+(job?`<p class="panelHint">Pågår: ${job.name} (${Math.round(b.job.t/b.job.total*100)}%)</p>`:'')+rows); }
sidePanelContent.onclick=e=>{ const b=e.target.closest('button'); if(!b)return; if(b.dataset.tab==='inventory')showInventory(); if(b.dataset.tab==='craft')showCrafting(); if(b.dataset.tab==='build')showBuildMenu(); if(b.dataset.craft)craft(b.dataset.craft); if(b.dataset.refine)refine(b.dataset.refine,selectedStation); if(b.dataset.use){ if(b.dataset.use==='food')useFood(); else if(['water','dirtyWater'].includes(b.dataset.use))drink(); else heal(); } };

function renderHotbar(){ const list=[...S.weapons]; hotbar.innerHTML=list.map((w,i)=>`<button class="slot ${S.player.weapon===w?'active':''}" data-w="${w}"><b>${i+1}</b>${WEAPONS[w].name}</button>`).join(''); hotbar.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>selectWeapon(i)); }
function renderObjectives(){ objectiveBox.innerHTML=`<strong>Mål</strong><ul><li>Lag hakke og finn malm</li><li>Bygg arbeidsbenk og smelter</li><li>Rens vann eller bygg regnsamler</li><li>Forsterk basen før natten</li></ul>`; }
function updateHud(){ meters.health.value=S.player.hp; meters.stamina.value=S.player.stamina; meters.hunger.value=S.player.hunger; meters.thirst.value=S.player.thirst; const h=Math.floor(S.time/60)%24,m=Math.floor(S.time%60); dayLabel.textContent=`Dag ${S.day} • ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; threatPill.textContent=isNight()?'Natt: høy fare':'Dagslys'; threatPill.classList.toggle('danger',isNight()); const n=nearestNode(), b=nearestBuilding(S.player.x,S.player.y,72); if(selectedBuild)hint(`Plasserer ${BUILDINGS[selectedBuild].name}. Klikk for å bygge.`); else if(n)hint(`E: ${nodeDef(n.type).name}`); else if(b)hint(`E: ${BUILDINGS[b.type].name}`); else interactionHint.classList.add('hidden'); }
function hint(t){ interactionHint.textContent=t; interactionHint.classList.remove('hidden'); }
function gameOver(){ running=false; hud.classList.add('hidden'); $('gameOverStats').textContent=`Du overlevde til dag ${S.day}.`; gameOverScreen.classList.add('screen--active'); }

function draw(){ const W=innerWidth,H=innerHeight; ctx.clearRect(0,0,W,H); S.camera.x=clamp(S.player.x-W/2,0,S.worldW-W); S.camera.y=clamp(S.player.y-H/2,0,S.worldH-H); setMouse({clientX:mouse.x+canvas.getBoundingClientRect().left,clientY:mouse.y+canvas.getBoundingClientRect().top}); ctx.save(); ctx.translate(-S.camera.x,-S.camera.y); drawWorld(); drawEntities(); ctx.restore(); drawNight(W,H); drawMinimap(W,H); if(paused)drawPause(W,H); }
function drawBackgroundOnly(){ ctx.fillStyle='#10191d'; ctx.fillRect(0,0,innerWidth,innerHeight); }
function drawWorld(){ ctx.fillStyle='#17281b'; ctx.fillRect(S.camera.x,S.camera.y,innerWidth,innerHeight); const g=96; const sx=Math.floor(S.camera.x/g)*g, sy=Math.floor(S.camera.y/g)*g; for(let y=sy;y<S.camera.y+innerHeight+g;y+=g){ for(let x=sx;x<S.camera.x+innerWidth+g;x+=g){ const v=Math.abs(Math.sin(x*.013+y*.021))*1; ctx.fillStyle=v>.55?'#1c3020':'#142319'; ctx.fillRect(x,y,g,g); if(v>.78){ctx.fillStyle='#29482b';ctx.beginPath();ctx.arc(x+30,y+40,2,0,7);ctx.fill();} } } }
function drawEntities(){ const all=[...S.nodes.filter(n=>!n.depleted).map(n=>({...n,kind:'node',sort:n.y})),...S.drops.map(d=>({...d,kind:'drop',sort:d.y})),...S.buildings.map(b=>({...b,kind:'building',sort:b.y})),...S.zombies.map(z=>({...z,kind:'zombie',sort:z.y})),{kind:'player',sort:S.player.y}].sort((a,b)=>a.sort-b.sort); for(const o of all){ if(o.kind==='node')drawNode(o); else if(o.kind==='drop')drawDrop(o); else if(o.kind==='building')drawBuilding(o); else if(o.kind==='zombie')drawZombie(o); else drawPlayer(); } for(const p of S.projectiles)drawProjectile(p); for(const p of S.particles)drawParticle(p); if(selectedBuild)drawGhost(); }
function drawNode(n){ const d=nodeDef(n.type); ctx.save(); ctx.translate(n.x,n.y); ctx.rotate(n.rot||0); if(n.type==='tree'){ctx.fillStyle='#5a3a22';ctx.fillRect(-5,4,10,30);ctx.fillStyle=d.color; for(const r of [28,22,16]){ctx.beginPath();ctx.moveTo(0,-r-10);ctx.lineTo(-r,r/2);ctx.lineTo(r,r/2);ctx.closePath();ctx.fill();}} else if(n.type==='puddle'){ctx.fillStyle=d.color;ctx.beginPath();ctx.ellipse(0,0,26,12,0,0,7);ctx.fill();ctx.strokeStyle='#9ee8ff';ctx.stroke();} else if(n.type==='bush'){ctx.fillStyle=d.color; for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(rand(-10,10),rand(-8,8),10,0,7);ctx.fill();} ctx.fillStyle='#b43a45';ctx.beginPath();ctx.arc(5,-2,3,0,7);ctx.fill();} else {ctx.fillStyle=d.color;ctx.beginPath();ctx.moveTo(-22,16);ctx.lineTo(-14,-10);ctx.lineTo(4,-20);ctx.lineTo(23,-4);ctx.lineTo(18,19);ctx.closePath();ctx.fill(); if(n.type==='oreRock'){ctx.fillStyle='#c87541'; for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(rand(-8,13),rand(-9,10),3,0,7);ctx.fill();}}} ctx.restore(); }
function drawBuilding(b){ const d=BUILDINGS[b.type]; ctx.save(); ctx.translate(b.x,b.y); ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(0,b.h*.35,b.w*.6,8,0,0,7);ctx.fill(); ctx.fillStyle=d.color; if(b.type.includes('Wall')){ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);ctx.strokeStyle='#24160d'; for(let x=-b.w/2+8;x<b.w/2;x+=12){ctx.beginPath();ctx.moveTo(x,-b.h/2);ctx.lineTo(x,b.h/2);ctx.stroke();}} else if(b.type==='spikes'){ for(let x=-18;x<=18;x+=12){ctx.beginPath();ctx.moveTo(x-5,18);ctx.lineTo(x,-20);ctx.lineTo(x+5,18);ctx.fill();}} else {ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);ctx.strokeStyle='#111';ctx.strokeRect(-b.w/2,-b.h/2,b.w,b.h);} if(b.job){ctx.fillStyle='#ffd166';ctx.fillRect(-b.w/2,-b.h/2-8,b.w*(b.job.t/b.job.total),4);} if(b.type==='rainCollector'){ctx.fillStyle='#bdefff';ctx.fillRect(-12,10,24*(b.waterStore||0)/8,5);} ctx.restore(); }
function drawDrop(d){ ctx.fillStyle='#f4e7b0';ctx.beginPath();ctx.arc(d.x,d.y,10,0,7);ctx.fill();ctx.fillStyle='#111';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText(itemName(d.id)[0],d.x,d.y+3); }
function drawZombie(z){ const d=zDef(z.type); ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(z.x,z.y+14,z.r*1.3,7,0,0,7);ctx.fill();ctx.fillStyle=d.color;ctx.beginPath();ctx.arc(z.x,z.y-8,z.r*.8,0,7);ctx.fill();ctx.fillRect(z.x-z.r*.75,z.y,z.r*1.5,z.r*1.7); if(z.hp<z.maxHp){ctx.fillStyle='#351';ctx.fillRect(z.x-18,z.y-28,36,4);ctx.fillStyle='#d35d5d';ctx.fillRect(z.x-18,z.y-28,36*z.hp/z.maxHp,4);} }
function drawPlayer(){ const p=S.player;ctx.save();ctx.translate(p.x,p.y); const a=Math.atan2(mouse.wy-p.y,mouse.wx-p.x);ctx.rotate(a);ctx.fillStyle=p.iframe>0?'#ffe0b0':'#d5b083';ctx.beginPath();ctx.arc(0,0,16,0,7);ctx.fill();ctx.fillStyle='#496b42';ctx.fillRect(-7,-11,16,22);ctx.strokeStyle='#f1e0a8';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(36,0);ctx.stroke();ctx.restore(); }
function drawProjectile(p){ ctx.strokeStyle=p.enemy?'#8eff78':'#ead39a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.025,p.y-p.vy*.025);ctx.stroke(); if(p.enemy&&dist(p.x,p.y,S.player.x,S.player.y)<S.player.r+6){S.player.hp-=p.dmg;p.life=-1;} }
function drawParticle(p){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,3,0,7);ctx.fill();ctx.globalAlpha=1;}
function drawGhost(){ const d=BUILDINGS[selectedBuild];ctx.globalAlpha=.55;ctx.fillStyle=d.color;ctx.fillRect(mouse.wx-d.w/2,mouse.wy-d.h/2,d.w,d.h);ctx.globalAlpha=1;ctx.strokeStyle='#ffd166';ctx.strokeRect(mouse.wx-d.w/2,mouse.wy-d.h/2,d.w,d.h);}
function drawNight(W,H){ if(!isNight())return; ctx.fillStyle='rgba(2,5,9,.58)';ctx.fillRect(0,0,W,H); const lights=[{x:S.player.x,y:S.player.y,r:145},...S.buildings.filter(b=>BUILDINGS[b.type].light).map(b=>({x:b.x,y:b.y,r:BUILDINGS[b.type].light}))]; ctx.save();ctx.globalCompositeOperation='destination-out'; for(const l of lights){ const x=l.x-S.camera.x,y=l.y-S.camera.y; const g=ctx.createRadialGradient(x,y,0,x,y,l.r);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,l.r,0,7);ctx.fill();} ctx.restore(); }
function drawMinimap(W,H){ const w=160,h=120,x=W-w-14,y=H-h-14;ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#789';ctx.strokeRect(x,y,w,h); const sx=w/S.worldW,sy=h/S.worldH;ctx.fillStyle='#fff';ctx.fillRect(x+S.player.x*sx-2,y+S.player.y*sy-2,4,4);ctx.fillStyle='#d35d5d';for(const z of S.zombies)if(dist(z.x,z.y,S.player.x,S.player.y)<600)ctx.fillRect(x+z.x*sx-1,y+z.y*sy-1,2,2);ctx.fillStyle='#d5b56c';for(const b of S.buildings)ctx.fillRect(x+b.x*sx-1,y+b.y*sy-1,3,3);}
function drawPause(W,H){ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(0,0,W,H);}

boot();