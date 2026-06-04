import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut, updateProfile, reload } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp as fsServerTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getDatabase, ref as dbRef, set as dbSet, onValue, onDisconnect, remove as dbRemove, serverTimestamp as rtdbServerTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAUZZxoH74aR0CPosp8SD7t7VBMF3vq5-A",
  authDomain: "mu-open-world-93c50.firebaseapp.com",
  projectId: "mu-open-world-93c50",
  storageBucket: "mu-open-world-93c50.firebasestorage.app",
  messagingSenderId: "471113504776",
  appId: "1:471113504776:web:49e8a30a23a1720a1f99bd",
  databaseURL: "https://mu-open-world-93c50-default-rtdb.firebaseio.com"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const rtdb = getDatabase(firebaseApp);
const USE_FIREBASE = true;
console.log('MU PDL Survival build: v21 - NPC global fix + mobile joystick stable');
const $ = (id) => document.getElementById(id);
const screens = ['loginScreen','registerScreen','verifyScreen','lobbyScreen','loadingScreen','gameScreen'];
const DEMO = { email: 'scripthc3@gmail.com', password: 'adm134676', nick: 'AdminHC', verified: true };
const WORLD_CONFIG = {
  lorencia: { name:'Lorencia Sombria', ground:0x2c2130, fog:0x140a18, npc:0x9b2e2e, speed:.018, xp:22, coins:8 },
  noria: { name:'Noria Verde', ground:0x18351f, fog:0x06180b, npc:0x4db25c, speed:.026, xp:20, coins:13 },
  devias: { name:'Devias Gelado', ground:0xddefff, fog:0x95b2ca, npc:0x85ccff, speed:.018, xp:31, coins:9 },
  atlans: { name:'Atlans Azul', ground:0x173c55, fog:0x092333, npc:0x4cd6e8, speed:.033, xp:38, coins:16 }
};
let state = { user:null, uid:null, progressLoaded:false, world:null, class:'warrior', level:1, xp:0, xpMax:100, coins:0, points:0, strength:1, agility:1, vitality:1, weapon:'sword', hp:120, maxHp:120, energy:100, maxEnergy:100 };
const specialSkills = {
  KeyF:{key:'F', name:'Avanço Cortante', cooldown:3200, energyCost:10, multiplier:1.55, range:4.4, dash:true, last:-99999},
  KeyG:{key:'G', name:'Giro de Espada', cooldown:5200, energyCost:15, multiplier:1.05, range:5.2, aoe:true, spin:true, last:-99999},
  KeyT:{key:'T', name:'Impacto no Chão', cooldown:7000, energyCost:20, multiplier:1.75, range:4.8, aoe:true, jump:true, last:-99999},
  KeyR:{key:'R', name:'Ciclone de Lâmina', cooldown:10000, energyCost:30, multiplier:.75, range:5.8, aoe:true, cyclone:true, last:-99999}
};
let scene, camera, renderer, player, weaponMesh, npcs=[], coinPickups=[], visualEffects=[], colliders=[], keys={}, animId, currentWorld, hudHidden=false, isAttacking=false, spawnSlots=[], skillLock=false, actionTimers=[], lockedTarget=null, targetIndicator=null;
let remotePlayers=new Map(), multiplayerPlayersRef=null, multiplayerMyRef=null, multiplayerUnsub=null, multiplayerSyncTimer=null;
let multiplayerNpcsRef=null, multiplayerNpcsUnsub=null, npcSyncTimer=null, isNpcHost=false, suppressNpcSync=false;
let walkClock = 0, lastFrameTime = 0, cameraYaw = 0, cameraLockedDuringSkill = false, rightMouseDown = false, attackCombo = 0, sprintActive=false, sprintEndAt=0, sprintCooldownUntil=0;
let multiplayerActionSeq=0, lastActionType='idle', lastActionAt=0, playerDeathSeq=0;
let lastOwnNetX=0, lastOwnNetZ=0, lastOwnNetAt=0, lastOwnNetAction='idle';
// Compatibilidade mobile: declarar antes de qualquer leitura para evitar ReferenceError.
let mobileCameraTurn = 0;
let mobileInput={active:false,x:0,y:0,forward:0,turn:0,mag:0};
const REMOTE_PLAYER_STALE_MS = 45000;
const NETWORK_SEND_INTERVAL_MS = 50; // 20 updates/segundo para movimento mais suave
const NPC_SYNC_INTERVAL_MS = 90; // NPCs pelo host, leve e mais frequente
const REMOTE_MAX_PREDICTION = 0.22;
const NPC_REMOTE_MOVE_EPSILON = 0.025;
let playerDead=false, deathStartedAt=0, cameraShakeUntil=0, cameraShakePower=0;
const THIRD_PERSON_CAMERA = { distance: 8.5, height: 9.0, lookHeight: 1.8, smooth: 0.08, yawSmooth: 0.08 };
const PLAYER_MOVE_SPEED = 0.19;
const PLAYER_STRAFE_SPEED = 0.135;
const PLAYER_TURN_SPEED = 0.029;
const SPRINT_MULTIPLIER = 1.38;
const SPRINT_ENERGY_DRAIN = 26;
const ENERGY_REGEN = 18;
const BASIC_ATTACK_ENERGY_COST = 4;
const MOUSE_TURN_SPEED = 0.0017;
const MAP_LIMIT = 235;
const spawnPoints = [[-42,0,-34],[38,0,-48],[-55,0,44],[52,0,38],[0,0,76],[84,0,-6],[-88,0,8]];
const PLAYER_RADIUS = .55;
const NPC_RADIUS = .62;
const NPC_MOVE_SPEED_BOOST = 1.85;
function lerpAngle(a,b,t){
  let d=((b-a+Math.PI)%(Math.PI*2))-Math.PI;
  if(d < -Math.PI) d += Math.PI*2;
  return a + d*t;
}
let worldRng = Math.random;
function hashStringSeed(str='mu-open-world'){
  let h=2166136261;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
function createSeededRandom(seedText){
  let a=hashStringSeed(seedText);
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngRange(rng,min,max){ return min + (max-min)*rng(); }
function addCollider(x,z,r,type='static',ref=null){ colliders.push({x,z,r,type,ref}); }
function canStandAt(x,z,r=PLAYER_RADIUS,ignore=null){
  if(x<-MAP_LIMIT || x>MAP_LIMIT || z<-MAP_LIMIT || z>MAP_LIMIT) return false;
  for(const c of colliders){
    if(c.ref && c.ref===ignore) continue;
    if(Math.hypot(x-c.x,z-c.z) < r+c.r) return false;
  }
  for(const n of npcs){
    if(n===ignore || n.userData?.hp<=0) continue;
    if(Math.hypot(x-n.position.x,z-n.position.z) < r+(n.userData.radius||NPC_RADIUS)) return false;
  }
  return true;
}
function tryMoveObject(obj, dx, dz, radius=PLAYER_RADIUS, ignore=null){
  if(!obj || (!dx && !dz)) return;
  const nx=obj.position.x+dx, nz=obj.position.z+dz;
  if(canStandAt(nx,nz,radius,ignore)){ obj.position.x=nx; obj.position.z=nz; return; }
  if(canStandAt(nx,obj.position.z,radius,ignore)) obj.position.x=nx;
  if(canStandAt(obj.position.x,nz,radius,ignore)) obj.position.z=nz;
}


function defaultProgress(){
  return { level:1, xp:0, xpMax:100, coins:0, points:0, strength:1, agility:1, vitality:1, weapon:'sword', class:'warrior' };
}
function applyProgress(data={}){
  const d={...defaultProgress(), ...data};
  state.level=Number(d.level)||1;
  state.xp=Number(d.xp)||0;
  state.xpMax=Number(d.xpMax)||100;
  state.coins=Number(d.coins)||0;
  state.points=Number(d.points)||0;
  state.strength=Number(d.strength)||1;
  state.agility=Number(d.agility)||1;
  state.vitality=Number(d.vitality)||1;
  state.weapon=d.weapon||'sword';
  state.class=d.class||'warrior';
  state.maxHp=120 + state.vitality * 18;
  state.hp=state.maxHp;
  state.energy=state.maxEnergy;
  state.progressLoaded=true;
}
async function loadPlayerProgress(firebaseUser, nickFallback='Player'){
  state.uid=firebaseUser.uid;
  const ref=doc(db, 'players', firebaseUser.uid);
  const snap=await getDoc(ref);
  if(!snap.exists()){
    const start={...defaultProgress(), nick:nickFallback, email:firebaseUser.email, createdAt:fsServerTimestamp(), updatedAt:fsServerTimestamp()};
    await setDoc(ref,start);
    applyProgress(start);
  } else {
    applyProgress(snap.data());
  }
}
let saveProgressTimer=null;
function savePlayerProgressNow(){
  if(!USE_FIREBASE || !state.uid) return;
  const ref=doc(db, 'players', state.uid);
  updateDoc(ref, {
    nick: state.user?.nick || state.user?.displayName || 'Player',
    level: state.level,
    xp: Math.floor(state.xp),
    xpMax: state.xpMax,
    coins: state.coins,
    points: state.points,
    strength: state.strength,
    agility: state.agility,
    vitality: state.vitality,
    weapon: state.weapon,
    class: state.class,
    updatedAt: fsServerTimestamp()
  }).catch(err=>console.warn('Falha ao salvar progresso:', err));
}
function scheduleSaveProgress(){
  if(!USE_FIREBASE || !state.uid) return;
  clearTimeout(saveProgressTimer);
  saveProgressTimer=setTimeout(savePlayerProgressNow, 700);
}
async function openLobbyForFirebaseUser(firebaseUser){
  const nick=firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Player';
  state.user={email:firebaseUser.email, nick, verified:firebaseUser.emailVerified};
  await loadPlayerProgress(firebaseUser, nick);
  $('playerWelcome').textContent=`Bem-vindo, ${state.user.nick}`;
  show('lobbyScreen');
}
function bootAccounts(){
  const accounts = JSON.parse(localStorage.getItem('mu_accounts')||'{}');
  accounts[DEMO.email] = accounts[DEMO.email] || DEMO;
  localStorage.setItem('mu_accounts', JSON.stringify(accounts));
}
function getAccounts(){ return JSON.parse(localStorage.getItem('mu_accounts')||'{}'); }
function saveAccounts(a){ localStorage.setItem('mu_accounts', JSON.stringify(a)); }
function show(id){ screens.forEach(s=>$(s).classList.toggle('active', s===id)); }
function msg(id, text){ $(id).textContent = text; }
function log(text){ const p=document.createElement('p'); p.textContent=text; $('combatLog').prepend(p); setTimeout(()=>p.remove(),4500); }

bootAccounts();
$('showRegisterBtn').onclick=()=>show('registerScreen');
$('backLoginBtn').onclick=()=>show('loginScreen');
$('verifyBackLoginBtn').onclick=()=>show('loginScreen');
$('forgotBtn').onclick=async()=>{
  const email=$('loginEmail').value.trim().toLowerCase();
  if(!email) return msg('loginMsg','Digite seu e-mail para recuperar a senha.');
  try{ await sendPasswordResetEmail(auth,email); msg('loginMsg','Link de recuperação enviado para seu e-mail.'); }
  catch(err){ msg('loginMsg','Erro ao enviar recuperação: '+(err.message||err.code)); }
};
$('createAccountBtn').onclick=async()=>{
  const nick=$('regNick').value.trim(), email=$('regEmail').value.trim().toLowerCase(), password=$('regPassword').value;
  if(!nick||!email||password.length<6) return msg('registerMsg','Preencha nickname, e-mail e senha com pelo menos 6 caracteres.');
  try{
    const cred=await createUserWithEmailAndPassword(auth,email,password);
    await updateProfile(cred.user,{displayName:nick});
    await sendEmailVerification(cred.user);
    state.user={email,nick,verified:false};
    state.uid=cred.user.uid;
    await setDoc(doc(db,'players',cred.user.uid), {...defaultProgress(), nick, email, createdAt:fsServerTimestamp(), updatedAt:fsServerTimestamp()});
    show('verifyScreen');
    msg('verifyMsg',`Link de confirmação enviado para ${email}.`);
  }catch(err){
    msg('registerMsg','Erro ao criar conta: '+(err.message||err.code));
  }
};
$('simulateVerifyBtn').onclick=async()=>{
  if(!auth.currentUser) return msg('verifyMsg','Faça login novamente depois de confirmar o e-mail.');
  await reload(auth.currentUser);
  if(!auth.currentUser.emailVerified) return msg('verifyMsg','Ainda não confirmado. Abra o link enviado no seu e-mail e tente de novo.');
  await openLobbyForFirebaseUser(auth.currentUser);
};
$('loginBtn').onclick=async()=>{
  requestGameFullscreenLandscape();
  const email=$('loginEmail').value.trim().toLowerCase(), password=$('loginPassword').value;
  try{
    const cred=await signInWithEmailAndPassword(auth,email,password);
    await reload(cred.user);
    if(!cred.user.emailVerified){
      state.user={email:cred.user.email, nick:cred.user.displayName||email.split('@')[0], verified:false};
      show('verifyScreen');
      return msg('verifyMsg','Sua conta ainda precisa confirmar o e-mail. Verifique sua caixa de entrada.');
    }
    await openLobbyForFirebaseUser(cred.user);
  }catch(err){
    msg('loginMsg','Erro no login: '+(err.message||err.code));
  }
};
$('logoutBtn').onclick=async()=>{ savePlayerProgressNow(); stopMultiplayerSync(true); stopNpcRealtimeSync(); try{ await signOut(auth); }catch(e){} state.user=null; state.uid=null; state.progressLoaded=false; $('loginEmail').value=''; $('loginPassword').value=''; show('loginScreen'); };
document.querySelectorAll('.world-card').forEach(card=>{
  const go=(e)=>{ e?.preventDefault?.(); enterWorld(card.dataset.world); };
  card.addEventListener('click', go);
  card.addEventListener('touchend', go, {passive:false});
});
document.querySelectorAll('.class-card').forEach(card=>card.onclick=()=>selectClass(card.dataset.class, card));
$('backLobbyBtn').onclick=()=>{ stopGame(); show('lobbyScreen'); };
$('backLobbyBtn').addEventListener('touchend',e=>{ e.preventDefault(); stopGame(); show('lobbyScreen'); },{passive:false});
document.querySelectorAll('[data-stat]').forEach(btn=>btn.onclick=()=>upgrade(btn.dataset.stat));
$('weaponSelect').onchange=(e)=>{ state.weapon=e.target.value; updateWeaponMesh(); scheduleSaveProgress(); };
function clearInputState(){ keys={}; }
function trackActionTimer(id){ actionTimers.push(id); return id; }
function clearCharacterActions(){
  actionTimers.forEach(id=>clearInterval(id));
  actionTimers=[];
  clearInputState();
  skillLock=false;
  isAttacking=false;
  cameraLockedDuringSkill=false;
  if(player?.userData){
    const arm=player.userData.weaponArm || player.userData.rightArm;
    if(arm){ arm.rotation.x=0; arm.rotation.y=0; arm.rotation.z=0; }
    if(player.userData.rightArm){ player.userData.rightArm.rotation.x=0; player.userData.rightArm.rotation.y=0; player.userData.rightArm.rotation.z=0; }
    if(player.userData.leftArm){ player.userData.leftArm.rotation.x=0; player.userData.leftArm.rotation.y=0; player.userData.leftArm.rotation.z=0; }
  }
}
window.addEventListener('keydown',e=>{
  if(e.code==='Tab'){ e.preventDefault(); toggleHud(); return; }
  if(!$('gameScreen').classList.contains('active')) return;
  if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','Backspace'].includes(e.code)) e.preventDefault();
  // Ataque básico agora fica somente no clique esquerdo do mouse.
  if(e.code==='Backspace' || e.code==='Space') return;
  keys[e.code]=true;
  if(!e.repeat && ['KeyF','KeyG','KeyT','KeyR'].includes(e.code)) specialAttack(e.code);
});
window.addEventListener('keyup',e=>{ keys[e.code]=false; });
window.addEventListener('blur',()=>{ rightMouseDown=false; clearInputState(); });
window.addEventListener('focus',clearInputState);
document.addEventListener('visibilitychange',()=>{ if(document.hidden){ rightMouseDown=false; clearInputState(); syncOwnPlayerOnline(); } });
window.addEventListener('pagehide',()=>{ if(multiplayerMyRef) dbRemove(multiplayerMyRef).catch(()=>{}); });
window.addEventListener('beforeunload',()=>{ if(multiplayerMyRef) dbRemove(multiplayerMyRef).catch(()=>{}); });
window.addEventListener('mouseup',e=>{ if(e.button===2) rightMouseDown=false; });
window.addEventListener('contextmenu',e=>{ e.preventDefault(); });
window.addEventListener('mousemove',e=>{
  if(!$('gameScreen').classList.contains('active')) return;
});
window.addEventListener('mousedown',e=>{
  if(!$('gameScreen').classList.contains('active')) return;
  if(e.button===2){
    e.preventDefault();
    rightMouseDown=false;
    lockTargetFromMouse(e);
    return;
  }
  if(e.button===0) attack();
});

function isMobileLike(){ return matchMedia('(hover:none), (pointer:coarse), (max-width:900px)').matches; }
async function requestGameFullscreenLandscape(){
  if(!isMobileLike()) return;
  try{
    const el=document.documentElement;
    if(!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen();
  }catch(err){ console.warn('Fullscreen não liberado pelo navegador:', err); }
  try{
    if(screen.orientation?.lock) await screen.orientation.lock('landscape');
  }catch(err){ console.warn('Bloqueio de orientação não suportado:', err); }
}
function setMobileHud(open){ const hud=document.querySelector('.hud'); if(hud) hud.classList.toggle('mobile-open', !!open); }
function setupMobileControls(){
  const toggle=$('mobileHudToggle');
  const stickZone=$('mobileStickZone');
  const knob=$('mobileJoystickKnob');
  const attackBtn=$('mobileAttackBtn');
  const canvas=$('gameCanvas');
  if(canvas){ canvas.addEventListener('touchstart',()=>requestGameFullscreenLandscape(), {passive:true}); canvas.addEventListener('click',()=>requestGameFullscreenLandscape()); }
  if(toggle){ toggle.addEventListener('click',e=>{ e.preventDefault(); const hud=document.querySelector('.hud'); setMobileHud(!hud?.classList.contains('mobile-open')); }); }
  document.querySelectorAll('.skill-circle').forEach(slot=>{
    const key=slot.dataset.skill;
    slot.addEventListener('click',e=>{ if(isMobileLike() && key) { e.preventDefault(); specialAttack('Key'+key); } });
    slot.addEventListener('touchstart',e=>{ if(key){ e.preventDefault(); specialAttack('Key'+key); } }, {passive:false});
  });
  if(attackBtn){
    attackBtn.addEventListener('touchstart',e=>{ e.preventDefault(); attack(); }, {passive:false});
    attackBtn.addEventListener('click',e=>{ e.preventDefault(); attack(); });
  }
  let stickId=null, center={x:0,y:0};
  function resetStick(){ keys.KeyW=false; keys.KeyS=false; keys.KeyA=false; keys.KeyD=false; mobileInput={active:false,x:0,y:0,forward:0,turn:0,mag:0,desiredYaw:null}; if(knob) knob.style.transform='translate(0px,0px)'; stickId=null; }
  if(stickZone){
    stickZone.addEventListener('touchstart',e=>{
      if(stickId!==null) return;
      const t=e.changedTouches[0]; stickId=t.identifier;
      const rect=stickZone.getBoundingClientRect();
      center={x:rect.left+rect.width/2, y:rect.top+rect.height/2};
      e.preventDefault();
    }, {passive:false});
    stickZone.addEventListener('touchmove',e=>{
      if(stickId===null) return;
      const t=[...e.changedTouches].find(t=>t.identifier===stickId); if(!t) return;
      const dx=t.clientX-center.x, dy=t.clientY-center.y;
      const max=36; const len=Math.hypot(dx,dy)||1;
      const k=Math.min(1,len/max);
      const nx=dx/len*max*k, ny=dy/len*max*k;
      if(knob) knob.style.transform=`translate(${nx}px,${ny}px)`;
      const ax = Math.abs(dx) > 8 ? THREE.MathUtils.clamp(dx/max, -1, 1) : 0;
      const ay = Math.abs(dy) > 8 ? THREE.MathUtils.clamp(dy/max, -1, 1) : 0;
      const mag=Math.min(1, Math.hypot(dx,dy)/max);
      mobileInput.active=true;
      mobileInput.x=ax;
      mobileInput.y=ay;
      mobileInput.turn=0;
      mobileInput.forward=mag;
      mobileInput.mag=mag;
      mobileInput.desiredYaw = mag>.12 ? Math.atan2(ax, -ay) : null;
      // No celular o joystick controla direção analógica; não simulamos A/D para evitar câmera girando sozinha.
      keys.KeyW = mag > .18;
      keys.KeyS = false;
      keys.KeyA = false;
      keys.KeyD = false;
      e.preventDefault();
    }, {passive:false});
    stickZone.addEventListener('touchend',e=>{ if([...e.changedTouches].some(t=>t.identifier===stickId)){ e.preventDefault(); resetStick(); } }, {passive:false});
    stickZone.addEventListener('touchcancel',e=>{ if([...e.changedTouches].some(t=>t.identifier===stickId)){ e.preventDefault(); resetStick(); } }, {passive:false});
  }
}
setupMobileControls();

function publishPlayerAction(type){
  multiplayerActionSeq++;
  lastActionType=type;
  lastActionAt=Date.now();
  syncOwnPlayerOnline();
}

function getNpcFromObject(obj){
  let current=obj;
  while(current){
    if(npcs.includes(current)) return current;
    current=current.parent;
  }
  return null;
}
function clearLockedTarget(){
  if(targetIndicator && targetIndicator.parent) targetIndicator.parent.remove(targetIndicator);
  lockedTarget=null;
  targetIndicator=null;
}
function setLockedTarget(npc){
  clearLockedTarget();
  if(!npc) return;
  lockedTarget=npc;
  const ring=new THREE.Mesh(
    new THREE.TorusGeometry(.82,.035,8,40),
    new THREE.MeshBasicMaterial({color:0xff3030})
  );
  ring.rotation.x=Math.PI/2;
  ring.position.y=.08;
  npc.add(ring);
  targetIndicator=ring;
  log('Alvo travado.');
}
function lockTargetFromMouse(e){
  if(!renderer || !camera || !npcs.length){ clearLockedTarget(); return; }
  const rect=renderer.domElement.getBoundingClientRect();
  const mouse=new THREE.Vector2(
    ((e.clientX-rect.left)/rect.width)*2-1,
    -((e.clientY-rect.top)/rect.height)*2+1
  );
  const raycaster=new THREE.Raycaster();
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(npcs,true);
  if(!hits.length){ clearLockedTarget(); return; }
  const npc=getNpcFromObject(hits[0].object);
  if(npc) setLockedTarget(npc); else clearLockedTarget();
}
function isNpcAlive(npc){
  return !!npc && npcs.includes(npc) && npc.userData && npc.userData.hp>0;
}

function selectClass(classKey, card){
  if(classKey!=='warrior'){
    logLobby('Essa classe já aparece no lobby, mas ainda será criada em uma próxima etapa. Por enquanto o Guerreiro está ativo.');
    return;
  }
  state.class='warrior';
  document.querySelectorAll('.class-card').forEach(c=>c.classList.remove('active'));
  card.classList.add('active');
}
function logLobby(text){
  const welcome=$('playerWelcome');
  if(welcome) welcome.textContent=text;
}

function enterWorld(key){
  currentWorld=WORLD_CONFIG[key]; state.world=key; requestGameFullscreenLandscape(); show('loadingScreen'); $('loadingText').textContent=`Entrando no mundo ${currentWorld.name}...`;
  setTimeout(()=>{ show('gameScreen'); setMobileHud(false); startGame(); requestGameFullscreenLandscape(); },900);
}
function resetStatsForSession(){ if(!state.progressLoaded) applyProgress(defaultProgress()); state.maxHp=120 + state.vitality * 18; state.hp=state.maxHp; state.maxEnergy=100; state.energy=state.maxEnergy; Object.values(specialSkills).forEach(s=>s.last=-99999); }
function startGame(){
  resetStatsForSession(); updateHud();
  colliders=[];
  worldRng = createSeededRandom('world-'+(state.world||'lorencia'));
  scene = new THREE.Scene(); scene.fog = new THREE.Fog(currentWorld.fog, 25, 80);
  camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, .1, 1000);
  renderer = new THREE.WebGLRenderer({canvas:$('gameCanvas'), antialias:true}); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xffe6b0, 0x182030, 1.35));
  const sun=new THREE.DirectionalLight(0xffffff,1.35); sun.position.set(-45,70,35); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-120; sun.shadow.camera.right=120; sun.shadow.camera.top=120; sun.shadow.camera.bottom=-120; scene.add(sun);
  addWorldEnvironment(); createPlayer(); setupSpawnSlots(); startMultiplayerSync(); startNpcRealtimeSync(); animate(); resizeGameRenderer();
}
function resizeGameRenderer(){
  if(!renderer || !camera) return;
  const w=innerWidth, h=innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeGameRenderer);
window.addEventListener('orientationchange', ()=>setTimeout(resizeGameRenderer, 250));
function makeGrassTexture(){
  const rng=createSeededRandom('grass-'+(state.world||'lorencia'));
  const canvas=document.createElement('canvas'); canvas.width=256; canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#274d24'; ctx.fillRect(0,0,256,256);
  for(let i=0;i<5000;i++){
    const g=55+Math.floor(rng()*90);
    ctx.fillStyle=`rgb(${20+rng()*20},${g},${18+rng()*20})`;
    ctx.fillRect(rng()*256, rng()*256, 1+rng()*2, 1+rng()*2);
  }
  const tex=new THREE.CanvasTexture(canvas); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(42,42); return tex;
}

function enableShadows(obj){
  obj.traverse?.(child=>{
    if(child.isMesh){ child.castShadow=true; child.receiveShadow=true; }
  });
}
function makeTextSprite(text, opts={}){
  const canvas=document.createElement('canvas');
  canvas.width=256; canvas.height=96;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,256,96);
  ctx.font=`bold ${opts.size||26}px Arial`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.lineWidth=5;
  ctx.strokeStyle=opts.stroke||'rgba(0,0,0,.9)';
  ctx.fillStyle=opts.color||'#ffffff';
  const lines=String(text).split('\n');
  lines.forEach((line,i)=>{ const y=38+i*28-(lines.length-1)*14; ctx.strokeText(line,128,y); ctx.fillText(line,128,y); });
  const tex=new THREE.CanvasTexture(canvas);
  const mat=new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false});
  const sprite=new THREE.Sprite(mat);
  sprite.scale.set(opts.width||2.7, opts.height||1.0, 1);
  sprite.userData.canvasTexture=tex;
  return sprite;
}
function addSkyAndAtmosphere(){
  scene.background = new THREE.Color(0x11182b);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(420,32,16), new THREE.MeshBasicMaterial({color:0x1b2440, side:THREE.BackSide}));
  scene.add(sky);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(5,24,16), new THREE.MeshBasicMaterial({color:0xf6e7b1}));
  moon.position.set(-95,92,-145); scene.add(moon);
  const starMat=new THREE.MeshBasicMaterial({color:0xffffff});
  const skyRng=createSeededRandom('sky-'+(state.world||'lorencia'));
  for(let i=0;i<70;i++){
    const star=new THREE.Mesh(new THREE.SphereGeometry(.18+skyRng()*.25,6,4), starMat);
    star.position.set((skyRng()-.5)*360, 75+skyRng()*90, (skyRng()-.5)*360);
    scene.add(star);
  }
}
function addTorch(x,z){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,2.1,8), new THREE.MeshStandardMaterial({color:0x4a2b17, roughness:.8}));
  pole.position.set(x,1.05,z); scene.add(pole);
  const flame=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8), new THREE.MeshBasicMaterial({color:0xff9d24, transparent:true, opacity:.92}));
  flame.position.set(x,2.22,z); scene.add(flame);
  const light=new THREE.PointLight(0xff9d35,.8,13); light.position.set(x,2.45,z); scene.add(light);
}
function addWorldEnvironment(){
  addSkyAndAtmosphere();
  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(500,500,96,96),
    new THREE.MeshStandardMaterial({map:makeGrassTexture(), color:currentWorld.ground, roughness:.95})
  );
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true;
  scene.add(ground);

  addLorenciaTown();
  addForestAndRocks();
  addMountainBorder();
}
function addLorenciaTown(){
  const stoneMat=new THREE.MeshStandardMaterial({color:0x6f6a5e, roughness:.85});
  const roofMat=new THREE.MeshStandardMaterial({color:0x55201e, roughness:.75});
  const woodMat=new THREE.MeshStandardMaterial({color:0x5a351b, roughness:.8});
  const plaza=new THREE.Mesh(new THREE.CylinderGeometry(18,18,.16,64), new THREE.MeshStandardMaterial({color:0x8b7d64, roughness:.9}));
  plaza.position.set(0,.08,0); plaza.receiveShadow=true; scene.add(plaza);
  const fountain=new THREE.Group();
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.5,.45,32), new THREE.MeshStandardMaterial({color:0x74706b, roughness:.7})); basin.position.y=.34; fountain.add(basin);
  const water=new THREE.Mesh(new THREE.CylinderGeometry(2.7,2.7,.08,32), new THREE.MeshStandardMaterial({color:0x3fb5ff, emissive:0x0b4770, emissiveIntensity:.35, transparent:true, opacity:.7})); water.position.y=.62; fountain.add(water);
  const statue=new THREE.Mesh(new THREE.ConeGeometry(.8,2.4,16), new THREE.MeshStandardMaterial({color:0xa9a19a, roughness:.55})); statue.position.y=1.8; fountain.add(statue);
  fountain.position.set(0,0,7); enableShadows(fountain); scene.add(fountain); addCollider(0,7,3.8,'fountain',fountain);
  addTorch(-11,-11); addTorch(11,-11); addTorch(-11,18); addTorch(11,18);
  const castle=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(16,7,10),stoneMat); base.position.y=3.5; castle.add(base);
  [-7,7].forEach(x=>{const tower=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.5,10,12),stoneMat); tower.position.set(x,5,0); castle.add(tower); const roof=new THREE.Mesh(new THREE.ConeGeometry(2.7,3,12),roofMat); roof.position.set(x,11.5,0); castle.add(roof);});
  castle.position.set(0,0,-30); scene.add(castle); addCollider(0,-30,10.5,'castle',castle);
  [[-24,0,'Ferreiro'],[24,0,'Loja'],[0,24,'Armazém'],[0,42,'Portal']].forEach(([x,z,name])=>{
    const hut=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(7,4,6),woodMat); body.position.y=2; hut.add(body);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(5,3,4),roofMat); roof.position.y=5.4; roof.rotation.y=Math.PI/4; hut.add(roof);
    hut.position.set(x,0,z); enableShadows(hut); scene.add(hut); addCollider(x,z,4.8,'building',hut);
    const label=makeTextSprite(name,{color:'#ffd36b',width:3,height:.9,size:24}); label.position.set(x,6.8,z); scene.add(label);
    // Anel azul removido: estava parecendo bug visual na casa do Portal.
  });
  enableShadows(castle);
}

function addTree(x,z,scale=1){
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.35*scale,.55*scale,3.2*scale,8),new THREE.MeshStandardMaterial({color:0x5a351b, roughness:.85}));
  trunk.position.set(x,1.6*scale,z); trunk.castShadow=true; trunk.receiveShadow=true; scene.add(trunk); addCollider(x,z,.65*scale,'tree',trunk);
  const crown=new THREE.Mesh(new THREE.ConeGeometry(2.1*scale,5.5*scale,9),new THREE.MeshStandardMaterial({color:0x17431f, roughness:.9}));
  crown.position.set(x,5.1*scale,z); crown.castShadow=true; crown.receiveShadow=true; scene.add(crown);
}
function addRock(x,z,scale=1){
  const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1.4*scale,0),new THREE.MeshStandardMaterial({color:0x5c5f5a, roughness:.95}));
  rock.position.set(x,.8*scale,z); rock.scale.y=.55+worldRng()*.6; rock.rotation.set(worldRng(),worldRng(),worldRng()); rock.castShadow=true; rock.receiveShadow=true; scene.add(rock); addCollider(x,z,1.0*scale,'rock',rock);
}
function addBush(x,z,scale=1){
  const bush=new THREE.Mesh(new THREE.SphereGeometry(1.2*scale,10,8),new THREE.MeshStandardMaterial({color:0x1f5c27, roughness:.95}));
  bush.position.set(x,.8*scale,z); bush.scale.y=.55; bush.castShadow=true; bush.receiveShadow=true; scene.add(bush); addCollider(x,z,.9*scale,'bush',bush);
}
function addForestAndRocks(){
  const rng=createSeededRandom('forest-'+(state.world||'lorencia'));
  for(let i=0;i<180;i++){
    const x=(rng()-.5)*450, z=(rng()-.5)*450;
    if(Math.hypot(x,z)<52) continue;
    addTree(x,z,.75+rng()*1.25);
  }
  for(let i=0;i<85;i++) addRock((rng()-.5)*430,(rng()-.5)*430,.55+rng()*1.6);
  for(let i=0;i<95;i++) addBush((rng()-.5)*420,(rng()-.5)*420,.45+rng()*1.1);
}
function addMountainBorder(){
  const rng=createSeededRandom('mountains-'+(state.world||'lorencia'));
  const mat=new THREE.MeshStandardMaterial({color:0x403a37, roughness:.98});
  for(let i=0;i<48;i++){
    const angle=(i/48)*Math.PI*2;
    const radius=245+rng()*18;
    const h=18+rng()*26;
    const m=new THREE.Mesh(new THREE.ConeGeometry(10+rng()*10,h,7),mat);
    m.position.set(Math.sin(angle)*radius,h/2-1,Math.cos(angle)*radius);
    m.rotation.y=rng()*Math.PI;
    m.castShadow=true; m.receiveShadow=true; scene.add(m); addCollider(m.position.x,m.position.z,8.5,'mountain',m);
  }
}
function setupSpawnSlots(){
  spawnSlots=[];
  const rng=createSeededRandom('npc-slots-'+(state.world||'lorencia'));
  spawnPoints.forEach(([x,y,z],idx)=>{
    const count = idx < 4 ? 2 : 1;
    for(let i=0;i<count;i++){
      const slot={id:`npc_${idx}_${i}`, x:x+(rng()*8-4), z:z+(rng()*8-4), npc:null, respawnAt:0};
      slot.npc=createNpc(slot.x, slot.z, slot);
      spawnSlots.push(slot);
    }
  });
  log('Monstros reduzidos e espalhados pelo campo. Respawn individual em 15s.');
}
function processRespawns(t){
  if(multiplayerNpcsRef && !isNpcHost) return;
  spawnSlots.forEach(slot=>{
    if(!slot.npc && t>=slot.respawnAt){
      slot.npc=createNpc(slot.x, slot.z, slot);
      publishNpcState(slot.npc);
    }
  });
}
function createPlayer(){
  player=new THREE.Group();
  player.userData={rightArm:null,leftArm:null,leftLeg:null,rightLeg:null,weaponArm:null,baseY:0};
  const armor=new THREE.MeshStandardMaterial({color:0xb77a24, metalness:.45, roughness:.35});
  const cloth=new THREE.MeshStandardMaterial({color:0x263a8a, metalness:.15, roughness:.55});
  const skin=new THREE.MeshStandardMaterial({color:0xf0cf9e, roughness:.5});
  const metal=new THREE.MeshStandardMaterial({color:0xdadada, metalness:.85, roughness:.25});

  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.62,1.15,6,16),armor); torso.position.y=1.55; player.add(torso);
  const chest=new THREE.Mesh(new THREE.BoxGeometry(1.25,.7,.42),armor); chest.position.y=1.75; player.add(chest);
  const shoulderL=new THREE.Mesh(new THREE.SphereGeometry(.28,12,8),metal); shoulderL.position.set(-.74,1.92,0); shoulderL.scale.set(1.25,.62,1); player.add(shoulderL);
  const shoulderR=new THREE.Mesh(new THREE.SphereGeometry(.28,12,8),metal); shoulderR.position.set(.74,1.92,0); shoulderR.scale.set(1.25,.62,1); player.add(shoulderR);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.42,20,20),skin); head.position.y=2.58; player.add(head);
  const helm=new THREE.Mesh(new THREE.ConeGeometry(.48,.55,18),metal); helm.position.y=2.98; player.add(helm);
  const cape=new THREE.Mesh(new THREE.BoxGeometry(1.05,1.55,.08),new THREE.MeshStandardMaterial({color:0x6b1021, roughness:.7})); cape.position.set(0,1.35,.35); player.add(cape);

  const leftArm=new THREE.Group(); leftArm.position.set(-.78,1.75,0); const la=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.95,5,10),skin); la.position.y=-.38; leftArm.add(la); player.add(leftArm);
  const rightArm=new THREE.Group(); rightArm.position.set(.78,1.75,0); const ra=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.95,5,10),skin); ra.position.y=-.38; rightArm.add(ra); player.add(rightArm);
  player.userData.rightArm=rightArm; player.userData.leftArm=leftArm;

  const legL=new THREE.Group(); legL.position.set(-.28,.98,0); const legMeshL=new THREE.Mesh(new THREE.CapsuleGeometry(.18,.85,5,10),cloth); legMeshL.position.y=-.43; legL.add(legMeshL); player.add(legL);
  const legR=new THREE.Group(); legR.position.set(.28,.98,0); const legMeshR=new THREE.Mesh(new THREE.CapsuleGeometry(.18,.85,5,10),cloth); legMeshR.position.y=-.43; legR.add(legMeshR); player.add(legR);
  // Botas presas aos grupos das pernas para acompanharem a caminhada.
  const bootL=new THREE.Mesh(new THREE.BoxGeometry(.34,.22,.5),metal); bootL.position.set(0,-.88,.08); legL.add(bootL);
  const bootR=new THREE.Mesh(new THREE.BoxGeometry(.34,.22,.5),metal); bootR.position.set(0,-.88,.08); legR.add(bootR);
  player.userData.leftLeg=legL; player.userData.rightLeg=legR;

  weaponMesh=new THREE.Group();
  // Arma presa na mão direita real do personagem.
  weaponMesh.position.set(.24,-.78,.28);
  rightArm.add(weaponMesh);
  player.userData.weaponArm=rightArm;
  enableShadows(player);
  scene.add(player);
  cameraYaw = player.rotation.y;
  updateWeaponMesh();
}

function makeWeapon(){
  const group=new THREE.Group();
  const metal=new THREE.MeshStandardMaterial({color:0xdadada, metalness:.9, roughness:.2});
  const wood=new THREE.MeshStandardMaterial({color:0x6e3f18, roughness:.65});
  const magic=new THREE.MeshStandardMaterial({color:0x8e5cff, emissive:0x3b197a, emissiveIntensity:.6});

  // A arma aponta para a frente real do personagem no eixo +Z local, saindo da mão direita.
  if(state.weapon==='axe'){
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,1.65,10),wood);
    handle.rotation.x=Math.PI/2; handle.position.z=.58; group.add(handle);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.72,.48,.12),metal);
    blade.position.set(.22,.34,1.22); group.add(blade);
    const blade2=new THREE.Mesh(new THREE.BoxGeometry(.45,.34,.12),metal);
    blade2.position.set(-.18,.26,-1.22); group.add(blade2);
  } else if(state.weapon==='staff'){
    const staff=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,2.15,10),wood);
    staff.rotation.x=Math.PI/2; staff.position.z=.72; group.add(staff);
    const orb=new THREE.Mesh(new THREE.SphereGeometry(.22,16,16),magic);
    orb.position.z=1.82; group.add(orb);
  } else {
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.18,.06,1.45),metal);
    blade.position.z=.95; blade.scale.x=.72; group.add(blade);
    const fuller=new THREE.Mesh(new THREE.BoxGeometry(.035,.07,1.05),new THREE.MeshStandardMaterial({color:0xf5f5ff, metalness:1, roughness:.18}));
    fuller.position.z=.9; fuller.position.y=.012; group.add(fuller);
    const edgeL=new THREE.Mesh(new THREE.BoxGeometry(.055,.07,1.32),metal); edgeL.position.set(-.105,0, .95); group.add(edgeL);
    const edgeR=new THREE.Mesh(new THREE.BoxGeometry(.055,.07,1.32),metal); edgeR.position.set(.105,0, .95); group.add(edgeR);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.145,.34,4),metal);
    tip.rotation.x=Math.PI/2; tip.rotation.z=Math.PI/4; tip.position.z=1.75; group.add(tip);
    const guard=new THREE.Mesh(new THREE.BoxGeometry(.72,.14,.1),metal);
    guard.position.z=.18; group.add(guard);
    const gem=new THREE.Mesh(new THREE.SphereGeometry(.08,12,8),new THREE.MeshBasicMaterial({color:0x32d5ff})); gem.position.z=.18; gem.position.y=.08; group.add(gem);
    const grip=new THREE.Mesh(new THREE.CylinderGeometry(.065,.075,.55,10),wood);
    grip.rotation.x=Math.PI/2; grip.position.z=-.18; group.add(grip);
    const pommel=new THREE.Mesh(new THREE.SphereGeometry(.11,12,8),metal); pommel.position.z=-.52; group.add(pommel);
  }
  group.rotation.set(0,0,0);
  return group;
}

function updateWeaponMesh(){
  if(!weaponMesh) return;
  weaponMesh.clear();
  weaponMesh.add(makeWeapon());
  $('weaponSelect').value=state.weapon;
}

const NPC_SPECIES = [
  { id:'goblin', name:'Goblin', color:0x4ba34a, dark:0x243018, eye:0xffee44, radius:.62, hpMul:1.0, dmgMul:1.0, speedMul:1.12, attackDelay:850 },
  { id:'spider', name:'Aranha', color:0x3a251d, dark:0x160d0b, eye:0xff3030, radius:.78, hpMul:.88, dmgMul:.86, speedMul:1.02, attackDelay:980 },
  { id:'wolf', name:'Lobo Selvagem', color:0x5e6370, dark:0x252934, eye:0x7ee7ff, radius:.76, hpMul:1.22, dmgMul:1.16, speedMul:1.18, attackDelay:1100 }
];

function getNpcSpeciesForSlot(slot){
  const idx = spawnSlots.indexOf(slot);
  if(idx>=0) return NPC_SPECIES[idx % NPC_SPECIES.length];
  return NPC_SPECIES[Math.floor(Math.random()*NPC_SPECIES.length)];
}
function getNpcSpeciesById(id){
  return NPC_SPECIES.find(s=>s.id===id) || NPC_SPECIES[0];
}

function addGoblinModel(npc, spec){
  const mat=new THREE.MeshStandardMaterial({color:spec.color, roughness:.58, metalness:.04});
  const dark=new THREE.MeshStandardMaterial({color:spec.dark, roughness:.75});
  const cloth=new THREE.MeshStandardMaterial({color:0x6f3c22, roughness:.78});
  const metal=new THREE.MeshStandardMaterial({color:0x8b8172, roughness:.42, metalness:.35});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.95,5,12),mat); body.position.y=1.02; body.scale.set(1.05,1,0.85); npc.add(body);
  const belly=new THREE.Mesh(new THREE.BoxGeometry(.78,.34,.42),cloth); belly.position.set(0,.78,-.02); npc.add(belly);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.38,16,12),mat); head.position.y=1.78; head.scale.set(1.08,.9,.95); npc.add(head);
  const earL=new THREE.Mesh(new THREE.ConeGeometry(.12,.48,8),mat); earL.position.set(-.43,1.82,-.02); earL.rotation.z=1.65; npc.add(earL);
  const earR=new THREE.Mesh(new THREE.ConeGeometry(.12,.48,8),mat); earR.position.set(.43,1.82,-.02); earR.rotation.z=-1.65; npc.add(earR);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.08,.22,8),dark); nose.rotation.x=Math.PI/2; nose.position.set(0,1.72,-.34); npc.add(nose);
  const eyeMat=new THREE.MeshBasicMaterial({color:spec.eye});
  const eyeL=new THREE.Mesh(new THREE.SphereGeometry(.055,8,8),eyeMat); eyeL.position.set(-.13,1.88,-.33); npc.add(eyeL);
  const eyeR=new THREE.Mesh(new THREE.SphereGeometry(.055,8,8),eyeMat); eyeR.position.set(.13,1.88,-.33); npc.add(eyeR);
  const armL=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.68,4,8),mat); armL.position.set(-.5,1.12,-.02); armL.rotation.z=.28; npc.add(armL);
  const armR=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.68,4,8),mat); armR.position.set(.5,1.12,-.02); armR.rotation.z=-.28; npc.add(armR);
  const club=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.72),metal); club.position.set(.68,1.18,-.28); club.rotation.x=.8; npc.add(club);
  const legL=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.55,4,8),mat); legL.position.set(-.2,.38,0); npc.add(legL);
  const legR=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.55,4,8),mat); legR.position.set(.2,.38,0); npc.add(legR);
  npc.userData.parts={armL,armR,legL,legR,body,head,weapon:club};
}

function addSpiderModel(npc, spec){
  const mat=new THREE.MeshStandardMaterial({color:spec.color, roughness:.68, metalness:.02});
  const dark=new THREE.MeshStandardMaterial({color:spec.dark, roughness:.8});
  const abdomen=new THREE.Mesh(new THREE.SphereGeometry(.56,16,12),mat); abdomen.position.set(0,.58,.2); abdomen.scale.set(1.15,.58,1.35); npc.add(abdomen);
  const thorax=new THREE.Mesh(new THREE.SphereGeometry(.44,16,12),mat); thorax.position.set(0,.64,-.5); thorax.scale.set(1.0,.55,.88); npc.add(thorax);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),dark); head.position.set(0,.72,-.9); head.scale.set(1.1,.7,.85); npc.add(head);
  const eyeMat=new THREE.MeshBasicMaterial({color:spec.eye});
  for(const x of [-.16,-.05,.05,.16]){ const e=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),eyeMat); e.position.set(x,.82,-1.12); npc.add(e); }
  const fangL=new THREE.Mesh(new THREE.ConeGeometry(.045,.22,8),new THREE.MeshBasicMaterial({color:0xf3ead0})); fangL.position.set(-.09,.58,-1.12); fangL.rotation.x=Math.PI; npc.add(fangL);
  const fangR=fangL.clone(); fangR.position.x=.09; npc.add(fangR);
  const legs=[];
  for(let side of [-1,1]){
    for(let i=0;i<4;i++){
      const z=-.65+i*.34;
      const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.045,.55,4,6),mat); upper.position.set(side*.42,.5,z); upper.rotation.z=side*(1.1+i*.08); upper.rotation.x=.25-i*.06; npc.add(upper);
      const lower=new THREE.Mesh(new THREE.CapsuleGeometry(.04,.58,4,6),mat); lower.position.set(side*.82,.24,z+.04); lower.rotation.z=side*(1.25+i*.08); lower.rotation.x=-.25+i*.06; npc.add(lower);
      legs.push({upper,lower,side,phase:i*.7});
    }
  }
  npc.userData.parts={body:abdomen,head,legs};
}

function addWolfModel(npc, spec){
  const mat=new THREE.MeshStandardMaterial({color:spec.color, roughness:.65, metalness:.02});
  const dark=new THREE.MeshStandardMaterial({color:spec.dark, roughness:.75});
  const white=new THREE.MeshStandardMaterial({color:0xbfc7ca, roughness:.62});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.34,1.2,6,12),mat); body.position.set(0,.78,0); body.rotation.x=Math.PI/2; body.scale.set(1.0,.9,1.18); npc.add(body);
  const chest=new THREE.Mesh(new THREE.SphereGeometry(.34,12,10),white); chest.position.set(0,.73,-.48); chest.scale.set(.9,.75,.8); npc.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.32,16,12),mat); head.position.set(0,.96,-1.02); head.scale.set(.9,.76,1.15); npc.add(head);
  const snout=new THREE.Mesh(new THREE.ConeGeometry(.16,.46,10),dark); snout.rotation.x=Math.PI/2; snout.position.set(0,.91,-1.35); npc.add(snout);
  const earL=new THREE.Mesh(new THREE.ConeGeometry(.095,.32,8),dark); earL.position.set(-.21,1.22,-.96); earL.rotation.z=.35; npc.add(earL);
  const earR=earL.clone(); earR.position.x=.21; earR.rotation.z=-.35; npc.add(earR);
  const eyeMat=new THREE.MeshBasicMaterial({color:spec.eye});
  const eyeL=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),eyeMat); eyeL.position.set(-.105,1.01,-1.31); npc.add(eyeL);
  const eyeR=eyeL.clone(); eyeR.position.x=.105; npc.add(eyeR);
  const tail=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.68,4,8),dark); tail.position.set(0,.95,.78); tail.rotation.x=-.95; npc.add(tail);
  const legs=[];
  for(const x of [-.24,.24]) for(const z of [-.48,.48]){ const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.58,4,8),mat); leg.position.set(x,.34,z); npc.add(leg); legs.push({leg,x,z}); }
  npc.userData.parts={body,head,legs,tail};
}

function getNpcDamageByLevel(level){
  if(level <= 1) return 50;
  if(level === 2) return 100;
  if(level === 3) return 250;
  return 250 + (level - 3) * 75;
}

function createNpc(x,z,slot=null, forcedSpecies=null){
  const spec=forcedSpecies ? getNpcSpeciesById(forcedSpecies) : getNpcSpeciesForSlot(slot);
  const npc=new THREE.Group();
  npc.userData={species:spec.id, speciesName:spec.name};
  if(spec.id==='spider') addSpiderModel(npc,spec);
  else if(spec.id==='wolf') addWolfModel(npc,spec);
  else addGoblinModel(npc,spec);

  const label=makeTextSprite(`${spec.name}\nLv ${Math.max(1,state.level)}`,{color:'#ffdf8a',width:3.0,height:1.0,size:21});
  label.position.y = spec.id==='spider' ? 2.05 : spec.id==='wolf' ? 2.35 : 2.8;
  npc.add(label);
  const hpGroup=new THREE.Group(); hpGroup.position.y = label.position.y - .42;
  const hpBack=new THREE.Mesh(new THREE.BoxGeometry(1.45,.14,.08),new THREE.MeshBasicMaterial({color:0x1b0505})); hpGroup.add(hpBack);
  const hpFrame=new THREE.Mesh(new THREE.BoxGeometry(1.55,.2,.05),new THREE.MeshBasicMaterial({color:0xd3a84a, transparent:true, opacity:.85})); hpFrame.position.z=.01; hpGroup.add(hpFrame);
  const hpBar=new THREE.Mesh(new THREE.BoxGeometry(1.35,.11,.09),new THREE.MeshBasicMaterial({color:0x19ff65})); hpBar.position.z=-.02; hpGroup.add(hpBar);
  npc.add(hpGroup);

  const worldBonus = state.world==='atlans'?3:state.world==='devias'?2:state.world==='noria'?1:0;
  const npcRng=createSeededRandom('npc-'+(state.world||'lorencia')+'-'+(slot?.id||`${x},${z}`));
  const npcLevel = Math.max(1, state.level + worldBonus + Math.floor(npcRng()*3));
  if(label.material?.map){ label.material.map.dispose?.(); }
  label.material.map = makeTextSprite(`${spec.name}\nLv ${npcLevel}`,{color:'#ffdf8a',width:3.0,height:1.0,size:21}).material.map;
  const maxHp = Math.floor((35 + npcLevel * 12) * spec.hpMul);
  Object.assign(npc.userData,{netId:slot?.id||null, level:npcLevel, damage:getNpcDamageByLevel(npcLevel), attackDelay:spec.attackDelay, lastHit:0, radius:spec.radius, hp:maxHp,maxHp,hpBar,hpGroup,label,slot,walkTime:npcRng()*10,attackAnim:0,attackUntil:0,baseY:0,attackDir:null});
  npc.position.set(x,0,z); enableShadows(npc); scene.add(npc); npcs.push(npc); return npc;
}



function getHostUid(playersData={}){
  const ids=Object.keys(playersData||{}).filter(Boolean).concat(state.uid?[state.uid]:[]);
  return ids.sort()[0] || state.uid;
}
function updateNpcHostRole(playersData={}){
  const host=getHostUid(playersData);
  isNpcHost = !!state.uid && host===state.uid;
}
function startNpcRealtimeSync(){
  if(!USE_FIREBASE || !state.uid || !state.world) return;
  stopNpcRealtimeSync();
  multiplayerNpcsRef=dbRef(rtdb, `worlds/${state.world}/npcs`);
  multiplayerNpcsUnsub=onValue(multiplayerNpcsRef, snap=>{
    const data=snap.val()||{};
    suppressNpcSync=true;
    Object.entries(data).forEach(([id, info])=>applySharedNpcState(id, info||{}));
    suppressNpcSync=false;
    if(Object.keys(data).length===0 && isNpcHost){
      // Apenas o host canônico do mundo popula os NPCs iniciais para todos verem iguais.
      spawnSlots.forEach(slot=>{ if(slot.npc) publishNpcState(slot.npc); });
    }
  }, err=>console.warn('NPCs em tempo real sem permissão:', err));
  npcSyncTimer=setInterval(()=>{
    if(isNpcHost) npcs.forEach(n=>publishNpcState(n));
  }, NPC_SYNC_INTERVAL_MS);
}
function stopNpcRealtimeSync(){
  if(npcSyncTimer){ clearInterval(npcSyncTimer); npcSyncTimer=null; }
  if(multiplayerNpcsUnsub){ try{ multiplayerNpcsUnsub(); }catch(e){} multiplayerNpcsUnsub=null; }
  multiplayerNpcsRef=null; isNpcHost=false; suppressNpcSync=false;
}
function publishNpcState(npc){
  if(suppressNpcSync || !multiplayerNpcsRef || !npc?.userData?.netId) return;
  const ud=npc.userData;
  const now=Date.now();
  const dt=Math.max(0.05, ((now-(ud.lastNetAt||now))/1000));
  const vx=((npc.position.x-(ud.lastNetX??npc.position.x))/dt);
  const vz=((npc.position.z-(ud.lastNetZ??npc.position.z))/dt);
  ud.lastNetX=npc.position.x; ud.lastNetZ=npc.position.z; ud.lastNetAt=now;
  dbSet(dbRef(rtdb, `worlds/${state.world}/npcs/${ud.netId}`), {
    id: ud.netId, alive: true, species: ud.species, speciesName: ud.speciesName,
    x: Number(npc.position.x.toFixed(3)), y: Number(npc.position.y.toFixed(3)), z: Number(npc.position.z.toFixed(3)), rot: Number(npc.rotation.y.toFixed(4)),
    vx: Number(vx.toFixed(3)), vz: Number(vz.toFixed(3)),
    hp: Math.max(0, Math.ceil(ud.hp)), maxHp: ud.maxHp, level: ud.level,
    attackSeq: ud.attackSeq||0, attacking: !!ud.attackAnim, moving: !!ud.netMoving || Math.hypot(vx,vz)>.01,
    slotX: ud.slot?.x ?? npc.position.x, slotZ: ud.slot?.z ?? npc.position.z,
    updatedAt: now
  }).catch(()=>{});
}
function publishNpcDeath(npc, slot){
  if(suppressNpcSync || !multiplayerNpcsRef || !npc?.userData?.netId) return;
  dbSet(dbRef(rtdb, `worlds/${state.world}/npcs/${npc.userData.netId}`), {
    id: npc.userData.netId, alive:false, species:npc.userData.species, speciesName:npc.userData.speciesName, hp:0, maxHp:npc.userData.maxHp, level:npc.userData.level,
    x:Number(npc.position.x.toFixed(3)), z:Number(npc.position.z.toFixed(3)), rot:Number(npc.rotation.y.toFixed(4)),
    respawnAt: Date.now()+15000, deathSeq: Date.now(), slotX:slot?.x ?? npc.position.x, slotZ:slot?.z ?? npc.position.z, updatedAt:rtdbServerTimestamp()
  }).catch(()=>{});
}
function applySharedNpcState(id, info){
  const slot=spawnSlots.find(s=>s.id===id);
  if(!slot) return;
  if(info.alive===false){
    const deathKey=String(info.respawnAt||'dead');
    if(slot.lastDeathKey!==deathKey){
      slot.lastDeathKey=deathKey;
      if(scene && !isNpcHost){
        const deathPos=new THREE.Vector3(Number(info.x)||slot.x,0,Number(info.z)||slot.z);
        createCoinDrop(deathPos, currentWorld.coins);
        createBloodPool(deathPos);
        createHitEffect(deathPos.clone().add(new THREE.Vector3(0,1,0)), 1.1, 0xff3333);
      }
    }
    if(slot.npc){ scene.remove(slot.npc); npcs=npcs.filter(n=>n!==slot.npc); if(lockedTarget===slot.npc) clearLockedTarget(); slot.npc=null; }
    slot.respawnAt = performance.now() + Math.max(0, (Number(info.respawnAt)||Date.now()) - Date.now());
    return;
  }
  if(slot.npc && info.species && slot.npc.userData.species!==info.species){
    scene.remove(slot.npc);
    npcs=npcs.filter(n=>n!==slot.npc);
    if(lockedTarget===slot.npc) clearLockedTarget();
    slot.npc=null;
  }
  if(!slot.npc){ slot.npc=createNpc(Number(info.x)||slot.x, Number(info.z)||slot.z, slot, info.species||null); }
  const n=slot.npc;
  const nx=Number(info.x)||n.position.x, ny=Number(info.y)||0, nz=Number(info.z)||n.position.z;
  const nr=Number(info.rot)||n.rotation.y;
  n.userData.netMoving = !!info.moving || Math.hypot(nx-n.position.x, nz-n.position.z) > NPC_REMOTE_MOVE_EPSILON;
  n.userData.netTarget = new THREE.Vector3(nx, ny, nz);
  n.userData.netVelocity = new THREE.Vector3(Number(info.vx)||0,0,Number(info.vz)||0);
  n.userData.netTargetRot = nr;
  n.userData.netUpdatedAt = Number(info.updatedAt)||Date.now();
  if(isNpcHost){ n.position.set(nx,ny,nz); n.rotation.y=nr; }
  const attackSeq=Number(info.attackSeq)||0;
  if(attackSeq && attackSeq!==n.userData.lastRemoteAttackSeq){
    n.userData.lastRemoteAttackSeq=attackSeq;
    startNpcAttack(n, false);
    // O host sincroniza o ataque; cada cliente aplica o dano se o ataque atingiu o próprio player.
    if(!isNpcHost && player && !playerDead && player.position.distanceTo(n.position) < 2.05){
      const dmg=getNpcDamageByLevel(Number(info.level)||n.userData.level||1);
      state.hp=Math.max(0, state.hp-dmg);
      createFloatingText('-'+Math.floor(dmg), player.position.clone().add(new THREE.Vector3(0,1.7,0)), '#ff5555');
      updateHud();
      if(state.hp<=0) startPlayerDeath();
    }
  }
  n.userData.hp=Number(info.hp)||n.userData.hp;
  n.userData.maxHp=Number(info.maxHp)||n.userData.maxHp;
  n.userData.level=Number(info.level)||n.userData.level;
  n.userData.damage=getNpcDamageByLevel(n.userData.level);
  if(n.userData.hpBar) n.userData.hpBar.scale.x=Math.max(.05,n.userData.hp/n.userData.maxHp);
}

function makeRemotePlayerModel(data={}){
  const group=new THREE.Group();
  group.userData={target:new THREE.Vector3(data.x||0,0,data.z||0), targetRot:data.rot||0, walkClock:Math.random()*10, lastX:data.x||0, lastZ:data.z||0, label:null, lastActionSeq:data.actionSeq||0};
  const armor=new THREE.MeshStandardMaterial({color:0x2f7dff, metalness:.35, roughness:.42});
  const cloth=new THREE.MeshStandardMaterial({color:0x1d285a, roughness:.55});
  const skin=new THREE.MeshStandardMaterial({color:0xf0cf9e, roughness:.5});
  const metal=new THREE.MeshStandardMaterial({color:0xcfd8ff, metalness:.7, roughness:.3});
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.52,1.05,6,14),armor); torso.position.y=1.48; group.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.36,16,16),skin); head.position.y=2.45; group.add(head);
  const helm=new THREE.Mesh(new THREE.ConeGeometry(.42,.45,16),metal); helm.position.y=2.82; group.add(helm);
  const armL=new THREE.Group(); armL.position.set(-.62,1.68,0); const armLMesh=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.82,5,8),skin); armLMesh.position.y=-.34; armL.add(armLMesh); group.add(armL);
  const armR=new THREE.Group(); armR.position.set(.62,1.68,0); const armRMesh=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.82,5,8),skin); armRMesh.position.y=-.34; armR.add(armRMesh); group.add(armR);
  const legL=new THREE.Group(); legL.position.set(-.22,.9,0); const legLMesh=new THREE.Mesh(new THREE.CapsuleGeometry(.15,.74,5,8),cloth); legLMesh.position.y=-.37; legL.add(legLMesh); group.add(legL);
  const legR=new THREE.Group(); legR.position.set(.22,.9,0); const legRMesh=new THREE.Mesh(new THREE.CapsuleGeometry(.15,.74,5,8),cloth); legRMesh.position.y=-.37; legR.add(legRMesh); group.add(legR);
  const sword=new THREE.Mesh(new THREE.BoxGeometry(.10,.08,1.25),metal); sword.position.set(.22,-.68,.62); armR.add(sword);
  const label=makeTextSprite(`${data.nick||'Player'}\nLv ${data.level||1}`,{color:'#8fd4ff',width:3.2,height:1.0,size:20}); label.position.y=3.25; group.add(label);
  group.userData.parts={armL,armR,legL,legR,label,sword};
  group.position.set(data.x||0,0,data.z||0); group.rotation.y=data.rot||0;
  enableShadows(group);
  return group;
}

function startMultiplayerSync(){
  if(!USE_FIREBASE || !state.uid || !state.world) return;
  stopMultiplayerSync(false);
  multiplayerPlayersRef=dbRef(rtdb, `worlds/${state.world}/players`);
  multiplayerMyRef=dbRef(rtdb, `worlds/${state.world}/players/${state.uid}`);
  onDisconnect(multiplayerMyRef).remove().catch(err=>console.warn('onDisconnect multiplayer:', err));
  multiplayerUnsub=onValue(multiplayerPlayersRef, snap=>{
    const data=snap.val()||{};
    const seen=new Set();
    Object.entries(data).forEach(([uid, info])=>{
      if(uid===state.uid) return;
      if(!info || !Number.isFinite(Number(info.x)) || !Number.isFinite(Number(info.z))) return;
      const updated=Number(info.updatedAt)||Date.now();
      if(Date.now()-updated > REMOTE_PLAYER_STALE_MS){ try{ dbRemove(dbRef(rtdb, `worlds/${state.world}/players/${uid}`)); }catch(e){} return; }
      seen.add(uid);
      let rp=remotePlayers.get(uid);
      if(!rp){
        rp=makeRemotePlayerModel(info);
        scene.add(rp);
        remotePlayers.set(uid,rp);
      }
      rp.userData.target.set(Number(info.x)||0,0,Number(info.z)||0);
      rp.userData.targetVelocity = new THREE.Vector3(Number(info.vx)||0,0,Number(info.vz)||0);
      rp.userData.targetUpdatedAt = Number(info.updatedAt)||Date.now();
      rp.userData.targetRot=Number(info.rot)||0;
      rp.userData.nick=info.nick||'Player';
      rp.userData.level=info.level||1;
      rp.userData.hp=info.hp||0;
      rp.userData.remoteMoving=!!info.moving;
      rp.userData.remoteRunning=!!info.running;
      rp.userData.remoteAction=info.action||'idle';
      const deathSeq=Number(info.deathSeq)||0;
      if(info.dead && deathSeq && deathSeq!==rp.userData.lastDeathSeq){
        rp.userData.lastDeathSeq=deathSeq;
        createBloodPool(rp.position.clone());
        rp.rotation.z=Math.PI/2;
        createFloatingText('DERROTADO', rp.position.clone().add(new THREE.Vector3(0,2.2,0)), '#ff5555');
      } else if(!info.dead && rp.rotation.z!==0){
        rp.rotation.z=0;
      }
      const actionSeq=Number(info.actionSeq)||0;
      if(actionSeq && actionSeq!==rp.userData.lastActionSeq){
        rp.userData.lastActionSeq=actionSeq;
        playRemoteAction(rp, info.actionType||'attack');
      }
      if(rp.userData.parts?.label){
        // Recria o texto apenas quando muda nome/level para evitar custo por frame.
        const labelKey=`${info.nick||'Player'}-${info.level||1}`;
        if(rp.userData.labelKey!==labelKey){
          rp.remove(rp.userData.parts.label);
          const label=makeTextSprite(`${info.nick||'Player'}\nLv ${info.level||1}`,{color:'#8fd4ff',width:3.2,height:1.0,size:20});
          label.position.y=3.25; rp.add(label); rp.userData.parts.label=label; rp.userData.labelKey=labelKey;
        }
      }
    });
    [...remotePlayers.entries()].forEach(([uid,rp])=>{
      if(!seen.has(uid)){
        scene.remove(rp);
        remotePlayers.delete(uid);
      }
    });
    updateNpcHostRole(data);
  }, err=>console.warn('Realtime Database multiplayer desativado ou sem permissão:', err));
  syncOwnPlayerOnline();
  multiplayerSyncTimer=setInterval(syncOwnPlayerOnline, NETWORK_SEND_INTERVAL_MS);
}

function syncOwnPlayerOnline(){
  if(!multiplayerMyRef || !player || !state.uid) return;
  const now=Date.now();
  const dt=Math.max(0.05, ((now-(lastOwnNetAt||now))/1000));
  const x=player.position.x, z=player.position.z;
  const vx=(x-(lastOwnNetX??x))/dt;
  const vz=(z-(lastOwnNetZ??z))/dt;
  lastOwnNetX=x; lastOwnNetZ=z; lastOwnNetAt=now;
  const moving = !!(keys.KeyW || keys.KeyS || (mobileInput.active && Math.abs(mobileInput.forward||0)>.18));
  const action = playerDead ? 'dead' : isAttacking ? 'attack' : sprintActive ? 'run' : moving ? 'walk' : 'idle';
  lastOwnNetAction=action;
  dbSet(multiplayerMyRef, {
    uid: state.uid,
    nick: state.user?.nick || auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Player',
    level: state.level,
    class: state.class,
    world: state.world,
    x: Number(x.toFixed(3)),
    y: Number(player.position.y.toFixed(3)),
    z: Number(z.toFixed(3)),
    rot: Number(player.rotation.y.toFixed(4)),
    vx: Number(vx.toFixed(3)),
    vz: Number(vz.toFixed(3)),
    hp: Math.ceil(state.hp),
    maxHp: state.maxHp,
    dead: !!playerDead,
    deathSeq: playerDeathSeq,
    moving,
    running: !!sprintActive,
    attacking: isAttacking,
    action,
    actionSeq: multiplayerActionSeq,
    actionType: lastActionType,
    actionAt: lastActionAt,
    updatedAt: now
  }).catch(err=>console.warn('Falha ao sincronizar multiplayer:', err));
}



function playRemoteAction(rp, type='attack'){
  const p=rp.userData.parts||{};
  const arm=p.armR;
  if(!arm) return;
  const pos = rp.position.clone().add(new THREE.Vector3(0,1.1,0));
  if(type==='KeyF'){
    arm.rotation.x=-1.45; arm.rotation.z=-.22;
    const f=new THREE.Vector3(Math.sin(rp.rotation.y),0,Math.cos(rp.rotation.y));
    rp.position.addScaledVector(f,.55);
    createHitEffect(pos, 1.2, 0xffd36b);
  } else if(type==='KeyG' || type==='KeyR'){
    createHitEffect(pos, type==='KeyR'?3.1:2.2, type==='KeyR'?0x9be7ff:0x66ccff);
    const start=rp.rotation.y; let frame=0; const total=type==='KeyR'?34:22;
    const timer=setInterval(()=>{ frame++; rp.rotation.y=start+Math.PI*2*(frame/total); arm.rotation.x=-1.2; arm.rotation.z=Math.sin(frame*.8)*.55; if(frame>=total){ clearInterval(timer); arm.rotation.set(0,0,0); rp.rotation.y=start; } },16);
    return;
  } else if(type==='KeyT'){
    createHitEffect(pos, 2.4, 0xff8f2f);
    createGroundCrackEffect(rp.position.clone(), 3.0);
    startScreenShake(.28, 220);
    const base=rp.position.y; let frame=0; const total=26;
    const timer=setInterval(()=>{ frame++; const k=frame/total; rp.position.y=base+Math.sin(k*Math.PI)*1.35; arm.rotation.x=-1.75+k*1.25; if(frame>=total){ clearInterval(timer); rp.position.y=base; arm.rotation.set(0,0,0); } },16);
    return;
  } else {
    arm.rotation.x=-1.05; arm.rotation.z=-.5;
    createSwordTrail(0x74d6ff);
  }
  setTimeout(()=>{ if(arm) arm.rotation.set(0,0,0); },260);
}

function updateRemotePlayers(delta=0.016){
  remotePlayers.forEach(rp=>{
    const baseTarget=rp.userData.target || rp.position;
    const vel=rp.userData.targetVelocity || new THREE.Vector3();
    const latency=Math.min(REMOTE_MAX_PREDICTION, Math.max(0, (Date.now()-(rp.userData.targetUpdatedAt||Date.now()))/1000));
    const target=baseTarget.clone().addScaledVector(vel, latency);
    const beforeX=rp.position.x, beforeZ=rp.position.z;
    rp.position.lerp(target, 0.24);
    const diff = Math.atan2(Math.sin((rp.userData.targetRot||0) - rp.rotation.y), Math.cos((rp.userData.targetRot||0) - rp.rotation.y));
    rp.rotation.y += diff * 0.22;
    const moved=!!rp.userData.remoteMoving || Math.hypot(rp.position.x-beforeX, rp.position.z-beforeZ)>.003;
    const p=rp.userData.parts||{};
    if(moved && rp.userData.remoteAction!=='dead'){
      rp.userData.walkClock += delta*(rp.userData.remoteRunning?12:9);
      const s=Math.sin(rp.userData.walkClock)*(rp.userData.remoteRunning?.46:.34);
      if(p.legL) p.legL.rotation.x=s;
      if(p.legR) p.legR.rotation.x=-s;
      if(p.armL) p.armL.rotation.x=-s*.35;
      if(p.armR && !rp.userData.remoteAction?.includes('Key')) p.armR.rotation.x=s*.2;
    } else {
      ['legL','legR','armL','armR'].forEach(k=>{ if(p[k]) p[k].rotation.x=THREE.MathUtils.lerp(p[k].rotation.x,0,.18); });
    }
    if(p.label && camera) p.label.lookAt(camera.position);
  });
}

function stopMultiplayerSync(removeSelf=true){
  if(multiplayerSyncTimer){ clearInterval(multiplayerSyncTimer); multiplayerSyncTimer=null; }
  if(multiplayerUnsub){ try{ multiplayerUnsub(); }catch(e){} multiplayerUnsub=null; }
  if(removeSelf && multiplayerMyRef){ dbRemove(multiplayerMyRef).catch(()=>{}); }
  multiplayerPlayersRef=null; multiplayerMyRef=null;
  remotePlayers.forEach(rp=>{ if(scene) scene.remove(rp); });
  remotePlayers.clear();
}

function animate(t=0){
  animId=requestAnimationFrame(animate);
  const delta = lastFrameTime ? Math.min(0.05, (t-lastFrameTime)/1000) : 0.016;
  lastFrameTime = t;
  movePlayer(delta);
  moveNpcs();
  processRespawns(t);
  processCoinPickups();
  updateVisualEffects(delta);
  updateNpcBillboards();
  updateRemotePlayers(delta);
  updateThirdPersonCamera();
  updateSkillHud();
  updateBottomBars();
  renderer.render(scene,camera);
}

function updateThirdPersonCamera(){
  if(!player || !camera) return;

  // A câmera fica atrás do personagem e acompanha suavemente a rotação dele.
  if(!cameraLockedDuringSkill){
    const diff = Math.atan2(Math.sin(player.rotation.y - cameraYaw), Math.cos(player.rotation.y - cameraYaw));
    // Acompanha melhor a virada do personagem sem dar tranco.
    cameraYaw += diff * THIRD_PERSON_CAMERA.yawSmooth;
  }

  const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
  const desired = player.position.clone()
    .addScaledVector(forward, -THIRD_PERSON_CAMERA.distance)
    .add(new THREE.Vector3(0, THIRD_PERSON_CAMERA.height, 0));
  camera.position.lerp(desired, THIRD_PERSON_CAMERA.smooth);
  if(performance.now() < cameraShakeUntil){
    const strength = cameraShakePower * ((cameraShakeUntil - performance.now())/420);
    camera.position.x += (Math.random()-.5) * strength;
    camera.position.y += (Math.random()-.5) * strength * .45;
    camera.position.z += (Math.random()-.5) * strength;
  }
  const lookTarget = player.position.clone()
    .addScaledVector(forward, 2.6)
    .add(new THREE.Vector3(0, THIRD_PERSON_CAMERA.lookHeight, 0));
  camera.lookAt(lookTarget);
}

function movePlayer(delta=0.016){
  if(playerDead){ animatePlayerBody(false, 0, delta); return; }
  if(skillLock){ animatePlayerBody(false, 0, delta); return; }

  const mobileActive = mobileInput.active && isMobileLike();
  let moveForward = 0;
  if(mobileActive){
    // Mobile: joystick em direção absoluta. O personagem vira suavemente para o ângulo do dedo e anda nessa direção.
    const mag = THREE.MathUtils.clamp(mobileInput.mag || 0, 0, 1);
    if(mag > .14 && Number.isFinite(mobileInput.desiredYaw)){
      player.rotation.y = lerpAngle(player.rotation.y, mobileInput.desiredYaw, 0.16);
      moveForward = mag;
    }
  } else {
    if(keys.KeyA) player.rotation.y += PLAYER_TURN_SPEED;
    if(keys.KeyD) player.rotation.y -= PLAYER_TURN_SPEED;
    if(keys.KeyW) moveForward += 1;
    if(keys.KeyS) moveForward -= 1;
  }

  const forward = new THREE.Vector3(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y));

  sprintActive = !!(!mobileActive && keys.ShiftLeft && keys.KeyW && moveForward > 0 && state.energy > 1);
  if(sprintActive) state.energy = Math.max(0, state.energy - SPRINT_ENERGY_DRAIN * delta);
  else state.energy = Math.min(state.maxEnergy, state.energy + ENERGY_REGEN * delta);

  const moving = Math.abs(moveForward) > 0.01;
  if(moving){
    const analog = mobileActive ? Math.min(1, Math.abs(moveForward)) : 1;
    const speed = PLAYER_MOVE_SPEED * analog * (sprintActive && moveForward > 0 ? SPRINT_MULTIPLIER : 1);
    tryMoveObject(player, forward.x * Math.sign(moveForward) * speed, forward.z * Math.sign(moveForward) * speed, PLAYER_RADIUS, player);
    if(Math.random()<(sprintActive ? 0.095 : 0.055)) createFootDust(player.position);
  }

  animatePlayerBody(moving, moveForward || 1, delta);
}

function animatePlayerBody(walking, direction, delta){
  if(!player?.userData) return;
  const {leftArm,rightArm,leftLeg,rightLeg,weaponArm} = player.userData;
  if(walking){
    walkClock += delta * 9.2;
    const swing = Math.sin(walkClock) * 0.38 * direction;
    const opposite = Math.sin(walkClock + Math.PI) * 0.38 * direction;
    if(leftLeg) leftLeg.rotation.x = swing;
    if(rightLeg) rightLeg.rotation.x = opposite;
    if(leftArm && (!isAttacking || leftArm!==weaponArm)) leftArm.rotation.x = opposite * 0.45;
    if(rightArm && (!isAttacking || rightArm!==weaponArm)) rightArm.rotation.x = swing * 0.32;
    player.position.y = Math.abs(Math.sin(walkClock * 2)) * 0.012;
  } else {
    const relax = 0.18;
    if(leftLeg) leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, relax);
    if(rightLeg) rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, relax);
    if(leftArm && (!isAttacking || leftArm!==weaponArm)) leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, relax);
    if(rightArm && (!isAttacking || rightArm!==weaponArm)) rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, relax);
    player.position.y = THREE.MathUtils.lerp(player.position.y, 0, relax);
  }
}

function animateNpcWalk(n, moving){
  const ud=n.userData, p=ud.parts||{};
  ud.walkTime=(ud.walkTime||0)+0.12;
  const s=Math.sin(ud.walkTime), c=Math.cos(ud.walkTime);
  if(ud.species==='goblin'){
    if(p.legL) p.legL.rotation.x = moving ? s*.42 : THREE.MathUtils.lerp(p.legL.rotation.x,0,.18);
    if(p.legR) p.legR.rotation.x = moving ? -s*.42 : THREE.MathUtils.lerp(p.legR.rotation.x,0,.18);
    if(p.armL) p.armL.rotation.x = moving ? -s*.22 : THREE.MathUtils.lerp(p.armL.rotation.x,0,.18);
    if(p.armR && !ud.attackAnim) p.armR.rotation.x = moving ? s*.18 : THREE.MathUtils.lerp(p.armR.rotation.x,0,.18);
    if(p.body) p.body.rotation.x = moving ? .08 : THREE.MathUtils.lerp(p.body.rotation.x,0,.16);
  } else if(ud.species==='spider'){
    if(p.legs){ p.legs.forEach((l,i)=>{ const a=Math.sin(ud.walkTime*1.5+l.phase)*(moving?.32:.06); l.upper.rotation.x = .22 + a; l.lower.rotation.x = -.22 - a*.8; }); }
    if(p.body) p.body.position.y = .58 + (moving ? Math.abs(s)*.035 : 0);
    if(p.head) p.head.position.y = .72 + (moving ? Math.abs(c)*.025 : 0);
  } else if(ud.species==='wolf'){
    if(p.legs){ p.legs.forEach((o,i)=>{ o.leg.rotation.x = moving ? Math.sin(ud.walkTime*1.6 + (i%2?Math.PI:0))*.48 : THREE.MathUtils.lerp(o.leg.rotation.x,0,.18); }); }
    if(p.body) p.body.position.y = .78 + (moving ? Math.abs(s)*.035 : 0);
    if(p.tail) p.tail.rotation.z = moving ? Math.sin(ud.walkTime*1.4)*.25 : THREE.MathUtils.lerp(p.tail.rotation.z,0,.12);
  }
}

function startNpcAttack(n, shouldPublish=true){
  const ud=n.userData;
  ud.attackAnim=1;
  ud.attackSeq=(ud.attackSeq||0)+1;
  ud.attackUntil=performance.now()+520;
  const dir=new THREE.Vector3().subVectors(player.position,n.position);
  if(dir.lengthSq()>0.0001) dir.normalize();
  ud.attackDir=dir;
  if(shouldPublish && multiplayerNpcsRef && isNpcHost) publishNpcState(n);
}

function animateNpcAttack(n){
  const ud=n.userData, p=ud.parts||{};
  if(!ud.attackAnim) return;
  const duration=520;
  const left=Math.max(0,(ud.attackUntil-performance.now())/duration);
  const phase=1-left;
  const hitWave=Math.sin(phase*Math.PI);
  const snap=Math.sin(phase*Math.PI*2);

  if(ud.species==='goblin'){
    // Goblin: levanta o braço e bate com a espada/porrete para baixo.
    if(p.armR){
      p.armR.rotation.x = -1.35 + hitWave*1.95;
      p.armR.rotation.z = -.48 + hitWave*.22;
    }
    if(p.weapon){
      p.weapon.rotation.x = .65 + hitWave*1.75;
      p.weapon.rotation.z = -.16 + hitWave*.22;
    }
    if(p.body) p.body.rotation.x = .08 + hitWave*.32;
    if(p.head) p.head.rotation.x = hitWave*.14;
  } else if(ud.species==='spider'){
    // Aranha: agacha, pula para cima do player e volta.
    const dir=ud.attackDir || new THREE.Vector3();
    const forward=Math.sin(phase*Math.PI)*.46;
    const jump=Math.sin(phase*Math.PI)*.34;
    n.position.x += dir.x * 0.018 * (phase < .55 ? 1 : -0.55);
    n.position.z += dir.z * 0.018 * (phase < .55 ? 1 : -0.55);
    n.position.y = jump;
    if(p.head) p.head.position.z = -0.9 - forward*.45;
    if(p.body){
      p.body.scale.z = 1.35 + hitWave*.20;
      p.body.scale.y = .58 - hitWave*.08;
    }
    if(p.legs){
      p.legs.forEach((l,i)=>{
        l.upper.rotation.z += l.side*hitWave*.035;
        l.lower.rotation.x = -.34 - hitWave*.25;
      });
    }
  } else if(ud.species==='wolf'){
    // Lobo: avança mordendo e chacoalha a cabeça de um lado para o outro.
    const dir=ud.attackDir || new THREE.Vector3();
    const lunge=Math.sin(phase*Math.PI)*.22;
    n.position.x += dir.x * 0.015 * (phase < .55 ? 1 : -0.45);
    n.position.z += dir.z * 0.015 * (phase < .55 ? 1 : -0.45);
    n.position.y = hitWave*.12;
    if(p.head){
      p.head.position.z = -1.02 - lunge*.9;
      p.head.rotation.y = snap*.38;
      p.head.rotation.x = -0.10 + Math.abs(snap)*.18;
    }
    if(p.body) p.body.rotation.x = Math.PI/2 - hitWave*.14;
    if(p.legs){ p.legs.forEach(o=>o.leg.rotation.x = -hitWave*.42); }
  }

  if(performance.now()>=ud.attackUntil){
    ud.attackAnim=0;
    ud.attackDir=null;
    n.position.y=0;
    if(p.body && ud.species==='wolf') p.body.rotation.x=Math.PI/2;
    if(p.head && ud.species==='wolf'){ p.head.position.z=-1.02; p.head.rotation.y=0; p.head.rotation.x=0; }
    if(p.head && ud.species==='spider') p.head.position.z=-.9;
    if(p.body && ud.species==='spider'){ p.body.scale.z=1.35; p.body.scale.y=.58; }
  }
}


function getBestNpcTarget(n){
  let best=null, bestDist=999;
  if(player && !playerDead){
    const d=n.position.distanceTo(player.position);
    if(d<bestDist){ best={obj:player, isLocal:true, pos:player.position}; bestDist=d; }
  }
  remotePlayers.forEach(rp=>{
    const d=n.position.distanceTo(rp.position);
    if(d<bestDist){ best={obj:rp, isLocal:false, pos:rp.position}; bestDist=d; }
  });
  return best && bestDist<22 ? {...best, dist:bestDist} : null;
}
function moveNpcs(){
  if(multiplayerNpcsRef && !isNpcHost){
    npcs.forEach(n=>{
      if(n.userData.netTarget){
        const latency=Math.min(REMOTE_MAX_PREDICTION, Math.max(0,(Date.now()-(n.userData.netUpdatedAt||Date.now()))/1000));
        const predicted=n.userData.netTarget.clone().addScaledVector(n.userData.netVelocity||new THREE.Vector3(), latency);
        n.position.lerp(predicted, .30);
        if(Number.isFinite(n.userData.netTargetRot)){ n.rotation.y=lerpAngle(n.rotation.y, n.userData.netTargetRot, .22); }
      }
      animateNpcWalk(n,!!n.userData.netMoving); animateNpcAttack(n); n.userData.netMoving=false;
    });
    return;
  }
  const now=performance.now();
  npcs.forEach(n=>{
    const target=getBestNpcTarget(n);
    if(!target){ animateNpcWalk(n,false); animateNpcAttack(n); return; }
    const v=new THREE.Vector3().subVectors(target.pos,n.position); const d=v.length();
    let moving=false;
    if(d<22 && d>1.45){
      v.normalize();
      const speed = currentWorld.speed * (n.userData.speedMul || 1) * NPC_MOVE_SPEED_BOOST;
      tryMoveObject(n, v.x*speed, v.z*speed, n.userData.radius||NPC_RADIUS, n);
      n.rotation.y=Math.atan2(v.x,v.z)+Math.PI;
      moving=true;
    }
    animateNpcWalk(n,moving);
    animateNpcAttack(n);
    if(d<1.55){
      const face=new THREE.Vector3().subVectors(target.pos,n.position);
      if(face.lengthSq()>0.0001) n.rotation.y=Math.atan2(face.x,face.z)+Math.PI;
    }
    if(d<1.55 && now-(n.userData.lastHit||0) > n.userData.attackDelay){
      n.userData.lastHit=now;
      startNpcAttack(n);
      if(target.isLocal){
        const dmg=n.userData.damage||4;
        state.hp=Math.max(0, state.hp-dmg);
        createFloatingText('-'+Math.floor(dmg), player.position.clone().add(new THREE.Vector3(0,1.7,0)), '#ff5555');
        if(state.hp<=0) startPlayerDeath();
      }
    }
    if(multiplayerNpcsRef && isNpcHost && (moving || n.userData.attackAnim || Math.random()<0.08)) publishNpcState(n);
  });
}

function getBaseDamage(){
  const weaponBonus = state.weapon==='axe'?9:state.weapon==='staff'?7:5;
  return 10+state.strength*4+weaponBonus;
}
function getClosestNpc(maxRange=999){
  let closest=null, dist=999;
  npcs.forEach(n=>{
    const d=n.position.distanceTo(player.position);
    if(d<dist && d<=maxRange){ dist=d; closest=n; }
  });
  return {closest, dist};
}
function damageNpc(npc, dmg, knock=.28){
  if(!npc) return;
  const targetDir=new THREE.Vector3().subVectors(npc.position,player.position);
  const crit=Math.random()<0.12;
  if(crit) dmg*=1.45;
  npc.userData.hp-=dmg;
  createFloatingText(crit ? Math.floor(dmg)+' CRIT!' : String(Math.floor(dmg)), npc.position.clone(), crit ? '#ffe54a' : '#ffffff');
  npc.userData.hpBar.scale.x=Math.max(.05,npc.userData.hp/npc.userData.maxHp);
  createImpactSparks(npc.position.clone().add(new THREE.Vector3(0,1.25,0)), crit ? 0xffee66 : 0xffffff);
  targetDir.normalize().multiplyScalar(knock);
  tryMoveObject(npc, targetDir.x, targetDir.z, npc.userData.radius||NPC_RADIUS, npc);
  if(npc.userData.hp<=0) killNpc(npc);
  else publishNpcState(npc);
}

function attack(){
  if(!player || isAttacking) return;
  if(state.energy < BASIC_ATTACK_ENERGY_COST){ log('Energia insuficiente para atacar.'); return; }
  state.energy = Math.max(0, state.energy - BASIC_ATTACK_ENERGY_COST);
  swingWeapon();
  publishPlayerAction('attack');
  let target=null;
  if(isNpcAlive(lockedTarget) && lockedTarget.position.distanceTo(player.position)<=3.2){
    target=lockedTarget;
  } else {
    const {closest}=getClosestNpc(3.2);
    target=closest;
  }
  if(!target) return;
  const dmg=getBaseDamage();
  damageNpc(target, dmg, .28);
  log(`Você causou ${dmg} de dano.`);
}
function specialAttack(code){
  if(!player || skillLock) return;
  const skill=specialSkills[code];
  if(!skill) return;
  const now=performance.now();
  const remaining=skill.cooldown-(now-skill.last);
  if(remaining>0){ log(`${skill.name} carregando: ${(remaining/1000).toFixed(1)}s.`); return; }
  const energyCost = skill.energyCost || 0;
  if(state.energy < energyCost){ log(`Energia insuficiente para ${skill.name}.`); return; }
  state.energy = Math.max(0, state.energy - energyCost);
  skill.last=now;
  publishPlayerAction(code);
  updateBottomBars();

  if(skill.cyclone) return cycloneSkill(skill);
  if(skill.jump) return jumpSlamSkill(skill);
  if(skill.spin) return spinSkill(skill);
  if(skill.dash) return dashSlashSkill(skill);
}

function hitEnemiesInRange(range, damage, knock=.38){
  let hits=0;
  [...npcs].forEach(n=>{
    if(n.position.distanceTo(player.position)<=range){ damageNpc(n, damage, knock); hits++; }
  });
  return hits;
}

function dashSlashSkill(skill){
  clearInputState();
  skillLock=true;
  swingWeapon(true);
  const forward = new THREE.Vector3(Math.sin(player.rotation.y),0,Math.cos(player.rotation.y));
  let steps=0;
  const timer=trackActionTimer(setInterval(()=>{
    steps++;
    tryMoveObject(player, forward.x*.28, forward.z*.28, PLAYER_RADIUS, player);
    if(steps>=10){
      clearInterval(timer);
      const dmg=Math.floor(getBaseDamage()*skill.multiplier);
      const {closest}=getClosestNpc(skill.range);
      if(closest){ damageNpc(closest, dmg, .72); createHitEffect(closest.position, 1.2, 0xffd36b); log(`${skill.name}: avanço rápido, ${dmg} dano.`); }
      else log(`${skill.name}: avanço rápido sem alvo.`);
      skillLock=false;
    }
  },16));
}

function spinSkill(skill){
  clearInputState();
  cameraLockedDuringSkill=true;
  skillLock=true;
  isAttacking=true;
  const startRot=player.rotation.y;
  let frame=0;
  const total=28;
  const timer=trackActionTimer(setInterval(()=>{
    frame++;
    player.rotation.y = startRot + (Math.PI*2)*(frame/total);
    const arm=player.userData.weaponArm || player.userData.rightArm;
    if(arm){ arm.rotation.x=-1.35; arm.rotation.z=Math.sin(frame*.6)*.45; }
    if(frame===14){ createHitEffect(player.position, skill.range, 0x66ccff); }
    if(frame>=total){
      clearInterval(timer);
      player.rotation.y = startRot;
      const arm=player.userData.weaponArm || player.userData.rightArm;
      if(arm){ arm.rotation.x=0; arm.rotation.y=0; arm.rotation.z=0; }
      const dmg=Math.floor(getBaseDamage()*skill.multiplier);
      const hits=hitEnemiesInRange(skill.range, dmg, .48);
      log(`${skill.name}: acertou ${hits} inimigo(s), ${dmg} dano.`);
      isAttacking=false; skillLock=false; cameraLockedDuringSkill=false; 
    }
  },16));
}

function jumpSlamSkill(skill){
  clearInputState();
  cameraLockedDuringSkill=true;
  skillLock=true;
  isAttacking=true;
  const baseY=player.position.y;
  const arm=player.userData.weaponArm || player.userData.rightArm;
  if(arm){ arm.rotation.x=-2.15; arm.rotation.z=-.12; }
  let frame=0;
  const total=34;
  const timer=trackActionTimer(setInterval(()=>{
    frame++;
    const p=frame/total;
    player.position.y = baseY + Math.sin(p*Math.PI)*2.85;
    if(frame===Math.floor(total*.72) && arm){ arm.rotation.x=-.55; arm.rotation.z=-.45; }
    if(frame>=total){
      clearInterval(timer);
      player.position.y=baseY;
      if(arm){ arm.rotation.x=0; arm.rotation.y=0; arm.rotation.z=0; }
      const dmg=Math.floor(getBaseDamage()*skill.multiplier);
      const hits=hitEnemiesInRange(skill.range, dmg, .82);
      createHitEffect(player.position, skill.range, 0xff8f2f);
      createGroundCrackEffect(player.position.clone(), skill.range);
      startScreenShake(.72, 430);
      log(`${skill.name}: impacto no chão, ${hits} inimigo(s), ${dmg} dano.`);
      isAttacking=false; skillLock=false; cameraLockedDuringSkill=false; 
    }
  },16));
}

function cycloneSkill(skill){
  clearInputState();
  cameraLockedDuringSkill=true;
  skillLock=true;
  isAttacking=true;
  const startRot=player.rotation.y;
  const forward = new THREE.Vector3(Math.sin(player.rotation.y),0,Math.cos(player.rotation.y));
  let frame=0, ticks=0;
  const total=72;
  const timer=trackActionTimer(setInterval(()=>{
    frame++;
    player.rotation.y += .38;
    player.position.addScaledVector(forward, .045);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -MAP_LIMIT, MAP_LIMIT);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -MAP_LIMIT, MAP_LIMIT);
    const arm=player.userData.weaponArm || player.userData.rightArm;
    if(arm){ arm.rotation.x=-1.35; arm.rotation.z=Math.sin(frame*.9)*.75; }
    if(frame%18===0){
      ticks++;
      const dmg=Math.floor(getBaseDamage()*skill.multiplier);
      const hits=hitEnemiesInRange(skill.range, dmg, .34);
      createHitEffect(player.position, skill.range, 0x9be7ff);
      log(`${skill.name} ${ticks}/4: ${hits} alvo(s), ${dmg} dano.`);
    }
    if(frame>=total){
      clearInterval(timer);
      player.rotation.y = startRot;
      const arm=player.userData.weaponArm || player.userData.rightArm;
      if(arm){ arm.rotation.x=0; arm.rotation.y=0; arm.rotation.z=0; }
      isAttacking=false; skillLock=false; cameraLockedDuringSkill=false; 
    }
  },16));
}

function createFootDust(pos){
  if(!scene) return;
  const dust=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),new THREE.MeshBasicMaterial({color:0x8b7658, transparent:true, opacity:.32}));
  dust.position.copy(pos); dust.position.y=.12; scene.add(dust);
  visualEffects.push({mesh:dust, life:.42, age:0, type:'flash'});
}
function createHitEffect(pos, radius=1.2, color=0xffd36b){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.035,8,56),new THREE.MeshBasicMaterial({color, transparent:true, opacity:.85}));
  ring.rotation.x=Math.PI/2; ring.position.copy(pos); ring.position.y=.12; scene.add(ring);
  visualEffects.push({mesh:ring, life:.34, age:0, type:'ring'});
  const flash=new THREE.Mesh(new THREE.SphereGeometry(.55,16,10),new THREE.MeshBasicMaterial({color, transparent:true, opacity:.55}));
  flash.position.copy(pos); flash.position.y+=.65; scene.add(flash);
  visualEffects.push({mesh:flash, life:.22, age:0, type:'flash'});
}

function startScreenShake(power=.5, duration=360){
  cameraShakePower=Math.max(cameraShakePower, power);
  cameraShakeUntil=performance.now()+duration;
}

function createGroundCrackEffect(pos, radius=4.8){
  if(!scene) return;
  const group=new THREE.Group();
  group.position.set(pos.x,.045,pos.z);
  const red=new THREE.MeshBasicMaterial({color:0xff2020, transparent:true, opacity:.9});
  const dark=new THREE.MeshBasicMaterial({color:0x210000, transparent:true, opacity:.75});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius*.45,.035,8,72), red);
  ring.rotation.x=Math.PI/2; group.add(ring);
  for(let i=0;i<12;i++){
    const len=radius*(.24+Math.random()*.42);
    const crack=new THREE.Mesh(new THREE.BoxGeometry(.055,.026,len), i%2 ? red : dark);
    crack.position.set(Math.sin(i*.9)*(radius*.13+Math.random()*radius*.16), .015, Math.cos(i*.9)*(radius*.13+Math.random()*radius*.16));
    crack.rotation.y=(i/12)*Math.PI*2 + (Math.random()-.5)*.5;
    group.add(crack);
  }
  scene.add(group);
  visualEffects.push({mesh:group, life:1.15, age:0, type:'groundCrack'});
}

function createLevelUpSpiral(pos){
  if(!scene || !player) return;
  const group=new THREE.Group();
  // Efeito preso ao player: acompanha o personagem mesmo se ele andar durante o level up.
  group.position.set(0,0,0);
  group.userData.spinA=0;
  group.userData.spinB=0;

  const blueCore=new THREE.MeshBasicMaterial({color:0xdffbff, transparent:true, opacity:.98});
  const blueA=new THREE.MeshBasicMaterial({color:0x25c9ff, transparent:true, opacity:.95});
  const blueB=new THREE.MeshBasicMaterial({color:0x006eff, transparent:true, opacity:.82});
  const whiteGlow=new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.38, side:THREE.DoubleSide});

  // Flash/aura no corpo do personagem.
  const aura=new THREE.Mesh(new THREE.SphereGeometry(1.45,24,16), new THREE.MeshBasicMaterial({color:0x1aa8ff, transparent:true, opacity:.18, side:THREE.DoubleSide}));
  aura.position.y=1.35;
  aura.scale.set(1,.95,1);
  aura.userData.levelAura=true;
  group.add(aura);

  // Núcleo branco brilhante subindo pelo centro.
  for(let i=0;i<14;i++){
    const core=new THREE.Mesh(new THREE.SphereGeometry(.055+Math.random()*.035,8,6), blueCore.clone());
    core.position.set((Math.random()-.5)*.34, .22+i*.22, (Math.random()-.5)*.34);
    core.userData.core=true;
    group.add(core);
  }

  // Duas espirais em sentidos opostos para ficar mais chamativo.
  for(let i=0;i<72;i++){
    const t=i/71;
    const ang=t*Math.PI*7.5;
    const radius=.38+Math.sin(t*Math.PI)*.7;
    const size=.06+Math.sin(t*Math.PI)*.055;

    const orbA=new THREE.Mesh(new THREE.SphereGeometry(size,10,7), blueA.clone());
    orbA.position.set(Math.cos(ang)*radius, .12+t*3.65, Math.sin(ang)*radius);
    orbA.userData.spiralA=true;
    orbA.userData.baseAngle=ang;
    orbA.userData.radius=radius;
    orbA.userData.baseY=.12+t*3.65;
    group.add(orbA);

    const orbB=new THREE.Mesh(new THREE.SphereGeometry(size*.82,10,7), blueB.clone());
    orbB.position.set(Math.cos(-ang)*radius*.82, .18+t*3.4, Math.sin(-ang)*radius*.82);
    orbB.userData.spiralB=true;
    orbB.userData.baseAngle=-ang;
    orbB.userData.radius=radius*.82;
    orbB.userData.baseY=.18+t*3.4;
    group.add(orbB);
  }

  // Anéis luminosos subindo pelo corpo.
  for(let j=0;j<5;j++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.66+j*.12,.026,10,64), new THREE.MeshBasicMaterial({color:j%2?0x77efff:0x1a8fff, transparent:true, opacity:.86}));
    ring.rotation.x=Math.PI/2;
    ring.position.y=.28+j*.62;
    ring.userData.levelRing=true;
    ring.userData.baseY=ring.position.y;
    ring.userData.speed=1.0+j*.18;
    group.add(ring);
  }

  // Partículas/estrelas azuis subindo em volta.
  for(let i=0;i<46;i++){
    const particle=new THREE.Mesh(new THREE.SphereGeometry(.025+Math.random()*.05,6,4), new THREE.MeshBasicMaterial({color:Math.random()>.45?0x8cf4ff:0xffffff, transparent:true, opacity:.95}));
    const a=Math.random()*Math.PI*2;
    const r=.35+Math.random()*1.35;
    particle.position.set(Math.cos(a)*r, Math.random()*3.2, Math.sin(a)*r);
    particle.userData.levelParticle=true;
    particle.userData.angle=a;
    particle.userData.radius=r;
    particle.userData.speed=.7+Math.random()*1.4;
    particle.userData.baseY=particle.position.y;
    group.add(particle);
  }

  // Texto LEVEL UP acima do player.
  const txt=makeTextSprite('LEVEL UP!',{color:'#8cf4ff',width:3.3,height:.85,size:34,bg:'rgba(0,40,100,0.10)'});
  txt.position.set(0,3.9,0);
  txt.userData.levelText=true;
  group.add(txt);

  // Luz azul temporária para iluminar o personagem.
  const light=new THREE.PointLight(0x25bfff, 2.9, 7.2);
  light.position.set(0,1.7,0);
  light.userData.levelLight=true;
  group.add(light);

  player.add(group);
  visualEffects.push({mesh:group, life:2.45, age:0, type:'levelSpiral'});
}

function createBloodPool(pos){
  if(!scene) return;
  const group=new THREE.Group();
  group.position.set(pos.x,.035,pos.z);
  const mat=new THREE.MeshBasicMaterial({color:0x8b0000, transparent:true, opacity:.68, side:THREE.DoubleSide});
  for(let i=0;i<6;i++){
    const pool=new THREE.Mesh(new THREE.CircleGeometry(.28+Math.random()*.5,18), mat.clone());
    pool.rotation.x=-Math.PI/2;
    pool.position.set((Math.random()-.5)*1.6,.005,(Math.random()-.5)*1.6);
    pool.scale.set(1+Math.random()*1.6,.65+Math.random()*.7,1);
    pool.rotation.z=Math.random()*Math.PI;
    group.add(pool);
  }
  scene.add(group);
  visualEffects.push({mesh:group, life:5.2, age:0, type:'blood'});
}

function startPlayerDeath(){
  if(playerDead || !player) return;
  playerDead=true;
  playerDeathSeq=Date.now();
  deathStartedAt=performance.now();
  syncOwnPlayerOnline();
  clearCharacterActions();
  clearInputState();
  createBloodPool(player.position.clone());
  startScreenShake(.34, 300);
  log('Você caiu em combate. Renascendo na cidade...');
  const startZ=player.rotation.z;
  const fall=trackActionTimer(setInterval(()=>{
    const p=Math.min(1,(performance.now()-deathStartedAt)/900);
    player.rotation.z = THREE.MathUtils.lerp(startZ, Math.PI/2, p);
    player.position.y = THREE.MathUtils.lerp(player.position.y, .18, .12);
    if(p>=1) clearInterval(fall);
  },16));
  setTimeout(()=>{
    if(!player) return;
    player.position.set(0,0,12);
    player.rotation.z=0;
    player.rotation.x=0;
    state.hp=state.maxHp;
    state.energy=Math.max(state.energy, state.maxEnergy*.55);
    playerDead=false;
    syncOwnPlayerOnline();
    updateHud();
  },2300);
}

function createSwordTrail(color=0x70d7ff){
  if(!player || !scene) return;
  const forward=new THREE.Vector3(Math.sin(player.rotation.y),0,Math.cos(player.rotation.y));
  const right=new THREE.Vector3(Math.cos(player.rotation.y),0,-Math.sin(player.rotation.y));
  const pos=player.position.clone().addScaledVector(forward,1.25).addScaledVector(right,.55).add(new THREE.Vector3(0,1.55,0));
  const trail=new THREE.Mesh(new THREE.TorusGeometry(.78,.025,8,36,Math.PI*1.25),new THREE.MeshBasicMaterial({color, transparent:true, opacity:.65, side:THREE.DoubleSide}));
  trail.position.copy(pos); trail.rotation.set(Math.PI/2,0,player.rotation.y+.6); scene.add(trail);
  visualEffects.push({mesh:trail, life:.28, age:0, type:'trail'});
}
function createImpactSparks(pos, color=0xffffff){
  if(!scene) return;
  for(let i=0;i<10;i++){
    const spark=new THREE.Mesh(new THREE.SphereGeometry(.035+Math.random()*.035,6,4),new THREE.MeshBasicMaterial({color, transparent:true, opacity:1}));
    spark.position.copy(pos);
    scene.add(spark);
    const vel=new THREE.Vector3((Math.random()-.5)*.12, .04+Math.random()*.12, (Math.random()-.5)*.12);
    visualEffects.push({mesh:spark, life:.36+Math.random()*.18, age:0, type:'spark', vel});
  }
}
function updateVisualEffects(delta){
  for(let i=visualEffects.length-1;i>=0;i--){
    const e=visualEffects[i]; e.age+=delta;
    const p=Math.min(1,e.age/e.life);
    if(e.type==='spark' && e.vel){ e.mesh.position.addScaledVector(e.vel, delta*60); e.vel.y-=.006*delta*60; }
    if(e.type==='ring'){ e.mesh.scale.setScalar(1+p*.25); }
    if(e.type==='flash'){ e.mesh.scale.setScalar(1+p*1.8); }
    if(e.type==='trail'){ e.mesh.rotation.z+=delta*5; }
    if(e.type==='groundCrack'){ e.mesh.scale.setScalar(1+p*.08); }
    if(e.type==='levelSpiral'){
      e.mesh.userData.spinA += delta*5.9;
      e.mesh.userData.spinB -= delta*4.7;
      const pulse=1+Math.sin(e.age*11)*.055;
      e.mesh.scale.setScalar(pulse);
      e.mesh.traverse(o=>{
        if(o.userData?.spiralA){ const a=o.userData.baseAngle+e.mesh.userData.spinA; o.position.x=Math.cos(a)*o.userData.radius; o.position.z=Math.sin(a)*o.userData.radius; o.position.y=o.userData.baseY + Math.sin(e.age*5+o.userData.baseAngle)*.08; }
        if(o.userData?.spiralB){ const a=o.userData.baseAngle+e.mesh.userData.spinB; o.position.x=Math.cos(a)*o.userData.radius; o.position.z=Math.sin(a)*o.userData.radius; o.position.y=o.userData.baseY + Math.cos(e.age*4+o.userData.baseAngle)*.08; }
        if(o.userData?.levelRing){ o.rotation.z += delta*2.2; o.position.y = (o.userData.baseY + e.age*o.userData.speed) % 3.45; }
        if(o.userData?.levelParticle){ const a=o.userData.angle + e.age*o.userData.speed; o.position.x=Math.cos(a)*o.userData.radius; o.position.z=Math.sin(a)*o.userData.radius; o.position.y=(o.userData.baseY + e.age*(1.0+o.userData.speed*.55)) % 3.55; }
        if(o.userData?.levelAura){ o.scale.setScalar(1+Math.sin(e.age*12)*.08); }
        if(o.userData?.levelText){ o.position.y=3.9+Math.sin(e.age*5)*.12; if(camera) o.lookAt(camera.position); }
        if(o.userData?.levelLight){ o.intensity=2.1+Math.sin(e.age*14)*1.15; }
      });
    }
    const baseOpacity = e.type==='ring'? .85 : e.type==='flash'? .55 : e.type==='trail'? .65 : e.type==='blood'? .68 : 1;
    const opacity = Math.max(0, 1-p) * baseOpacity;
    e.mesh.traverse ? e.mesh.traverse(o=>{ if(o.material && 'opacity' in o.material){ o.material.opacity=opacity; o.material.transparent=true; } }) : (e.mesh.material && (e.mesh.material.opacity=opacity));
    if(p>=1){ if(e.mesh.parent) e.mesh.parent.remove(e.mesh); else scene.remove(e.mesh); visualEffects.splice(i,1); }
  }
}
function updateNpcBillboards(){
  if(!camera) return;
  npcs.forEach(n=>{
    if(n.userData.hpGroup) n.userData.hpGroup.lookAt(camera.position);
    if(n.userData.label) n.userData.label.lookAt(camera.position);
  });
}

function createCoinDrop(pos, amount){
  if(!scene) return;
  const group=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:0xffd94a, metalness:1, roughness:.18, emissive:0x8f5c00, emissiveIntensity:.55});
  const count=Math.min(8, Math.max(3, Math.ceil(amount/3)));
  for(let i=0;i<count;i++){
    const coin=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.045,18),mat);
    coin.rotation.x=Math.PI/2;
    coin.position.set((Math.random()-.5)*1.3,.16,(Math.random()-.5)*1.3);
    const shine=new THREE.Mesh(new THREE.TorusGeometry(.18,.012,6,18),new THREE.MeshBasicMaterial({color:0xfff1a0, transparent:true, opacity:.75})); shine.rotation.x=Math.PI/2; coin.add(shine);
    group.add(coin);
  }
  group.position.copy(pos);
  group.position.y=.18;
  group.userData={amount, born:performance.now()};
  scene.add(group);
  coinPickups.push(group);
}
function processCoinPickups(){
  if(!player || !scene) return;
  const now=performance.now();
  for(let i=coinPickups.length-1;i>=0;i--){
    const c=coinPickups[i];
    const age=now-(c.userData.born||now);
    c.rotation.y += .045;
    c.children.forEach((coin,idx)=>{ coin.position.y = .16 + Math.sin(now*.006 + idx)*.035; });
    const d=c.position.distanceTo(player.position);
    // As moedas ficam visíveis no chão por um instante; depois viram ímã e vão até o player mesmo se ele estiver afastado.
    if(age>1200){
      const dir=new THREE.Vector3().subVectors(player.position,c.position).normalize();
      // Depois de aparecer no chão, a moeda vira ímã e vem bem rápido até o player.
      c.position.addScaledVector(dir, d<2.2 ? .95 : .48);
      c.position.y = THREE.MathUtils.lerp(c.position.y, 1.05, .12);
    }
    if(age>1200 && d<1.35){
      state.coins += c.userData.amount;
      log(`Você coletou ${c.userData.amount} moedas.`);
      createFloatingText('+'+c.userData.amount, player.position.clone().add(new THREE.Vector3(0,1.8,0)), '#ffdd55');
      createHitEffect(player.position.clone(), .75, 0xffd84d);
      scene.remove(c);
      coinPickups.splice(i,1);
      updateHud();
    }
  }
}

function updateSkillHud(){
  Object.values(specialSkills).forEach(skill=>{
    const el=$('cd'+skill.key);
    const slot=document.querySelector(`.skill-circle[data-skill="${skill.key}"]`);
    if(!el||!slot) return;
    const remaining=Math.max(0, skill.cooldown-(performance.now()-skill.last));
    const pct=(remaining/skill.cooldown)*100;
    el.style.height=pct+'%';
    slot.classList.toggle('ready', remaining<=0);
  });
}

function swingWeapon(power=false){
  isAttacking=true;
  createSwordTrail(power ? 0xffd36b : 0x74d6ff);
  const arm=player.userData.weaponArm || player.userData.rightArm;
  attackCombo = (attackCombo + 1) % 2;
  const vertical = attackCombo === 0;
  if(arm){
    if(power){
      arm.rotation.x=-1.55; arm.rotation.y=0; arm.rotation.z=-.32;
    } else if(vertical){
      // Corte de cima para baixo.
      arm.rotation.x=-1.38; arm.rotation.y=0; arm.rotation.z=-.08;
    } else {
      // Corte lateral, estilo golpe cruzado.
      arm.rotation.x=-.72; arm.rotation.y=.95; arm.rotation.z=-.72;
    }
  }
  const attackDelay = Math.max(90, (power?360:240) - state.agility * 8);
  setTimeout(()=>{ if(arm){ arm.rotation.x=0; arm.rotation.y=0; arm.rotation.z=0; } isAttacking=false; }, attackDelay);
}
function toggleHud(){
  hudHidden=!hudHidden;
  document.body.classList.toggle('hud-hidden', hudHidden);
}


function createFloatingText(text,pos,color='#ffd36b'){
 const el=document.createElement('div');
 el.className='floating-dmg'; el.textContent=text; el.style.color=color;
 document.body.appendChild(el);
 let y=0;
 const start=performance.now();
 function anim(){
   const v=pos.clone().project(camera);
   el.style.left=((v.x*0.5+0.5)*innerWidth)+'px';
   el.style.top=((-.5*v.y+0.5)*innerHeight-y)+'px';
   y+=0.5;
   if(performance.now()-start<900) requestAnimationFrame(anim); else el.remove();
 }
 anim();
}

function killNpc(npc){
  const slot=npc.userData.slot;
  publishNpcDeath(npc, slot);
  if(lockedTarget===npc) clearLockedTarget();
  scene.remove(npc); npcs=npcs.filter(n=>n!==npc);
  if(slot){ slot.npc=null; slot.respawnAt=performance.now()+15000; }
  state.xp+=currentWorld.xp;
  createCoinDrop(npc.position.clone(), currentWorld.coins); createFloatingText('+'+currentWorld.coins+' moedas', npc.position.clone(), '#ffdd55');
  log(`NPC derrotado: +${currentWorld.xp} XP. Moedas caíram no chão.`);
  let leveled=false;
  while(state.xp>=state.xpMax){ state.xp-=state.xpMax; state.level++; state.points+=3; state.xpMax=Math.floor(state.xpMax*1.35); leveled=true; log(`Level UP! Você ganhou 3 pontos.`); }
  if(leveled) createLevelUpSpiral(player.position.clone());
  updateHud();
  scheduleSaveProgress();
}
function upgrade(stat){
  if(state.points<=0) return log('Sem pontos para distribuir.');
  state.points--; state[stat]++; updateHud(); scheduleSaveProgress();
}

function updateBottomBars(){
  if(!$('energyBar')) return;
  state.maxHp = 120 + state.vitality * 18;
  state.hp = Math.min(state.hp, state.maxHp);
  const hpPct = Math.max(0, Math.min(100, (state.hp/state.maxHp)*100));
  $('playerHpBar').style.width = hpPct+'%';
  $('playerHpText').textContent = `${Math.ceil(state.hp)}/${state.maxHp}`;
  const energyPct = Math.max(0, Math.min(100, (state.energy/state.maxEnergy)*100));
  $('energyBar').style.width = energyPct+'%';
  $('energyText').textContent = `${Math.floor(state.energy)}/${state.maxEnergy}`;
}

function updateHud(){
  if($('weaponSelect')) $('weaponSelect').value=state.weapon;
  state.maxHp = 120 + state.vitality * 18;
  state.hp = Math.min(state.hp, state.maxHp);
  $('hudWorld').textContent=currentWorld?currentWorld.name:'Mundo'; $('hudNick').textContent=state.user?.nick||''; $('hudLevel').textContent=state.level; $('hudCoins').textContent=state.coins; $('hudPoints').textContent=state.points; $('hudXp').textContent=`${Math.floor(state.xp)}/${state.xpMax}`; $('xpBar').style.width=`${Math.min(100,(state.xp/state.xpMax)*100)}%`; $('statStrength').textContent=state.strength; $('statAgility').textContent=state.agility; $('statVitality').textContent=state.vitality; updateSkillHud(); updateBottomBars();
}
function stopGame(){ stopNpcRealtimeSync(); stopMultiplayerSync(true); savePlayerProgressNow(); if(animId) cancelAnimationFrame(animId); actionTimers.forEach(id=>clearInterval(id)); actionTimers=[]; if(renderer){ renderer.dispose(); } npcs=[]; coinPickups=[]; visualEffects=[]; colliders=[]; spawnSlots=[]; scene=null; camera=null; renderer=null; player=null; isAttacking=false; skillLock=false; hudHidden=false; walkClock=0; lastFrameTime=0; cameraYaw=0; cameraLockedDuringSkill=false; rightMouseDown=false; lockedTarget=null; targetIndicator=null; sprintActive=false; sprintEndAt=0; sprintCooldownUntil=0; multiplayerActionSeq=0; lastActionType='idle'; lastActionAt=0; playerDead=false; deathStartedAt=0; cameraShakeUntil=0; cameraShakePower=0; keys={}; document.body.classList.remove('hud-hidden'); $('combatLog').innerHTML=''; }
window.addEventListener('resize',()=>{ if(camera&&renderer){ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); }});

window.addEventListener('beforeunload',()=>{ stopMultiplayerSync(true); savePlayerProgressNow(); });
