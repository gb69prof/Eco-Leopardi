/* Leopardi Web App – v1.1
   - Avvio WebGL quando vuoi (senza video)
   - Frecce iPad robuste: touchstart/touchend + pointer + mouse
   - Video YouTube opzionale: play -> on end -> entra in scena
*/

const $ = (s)=>document.querySelector(s);

const homeLayer  = $("#home-layer");
const videoLayer = $("#video-layer");
const sceneLayer = $("#scene-layer");
const fog        = $("#fog");

const topTitle   = $("#top-title");
const lessonText = $("#lesson-text");
const statusLine = $("#status-line");
const meterFill  = $("#meter-fill");

const drawer     = $("#drawer");
const menuBtn    = $("#menu-btn");
const leopardiIcon = $("#leopardi-icon");

const btnF = $("#btn-forward");
const btnB = $("#btn-back");

const skipBtn = $("#skip-video");

// NUOVI bottoni home
const btnPlayVideo = $("#btn-play-video");
const btnStartPath = $("#btn-start-path");

let ytPlayer = null;
let ytReady = false;
let hasStartedScene = false;

const SCENES = [
  {
    id: 1,
    title: "Collina – Soglia",
    status: "Apertura",
    meter: 72,
    text: "Qui l’esperienza è reale. Ma il limite la trasforma.",
    pano: "assets/pano1_collina.jpg"
  },
  {
    id: 2,
    title: "Natura-matrigna",
    status: "Disincanto",
    meter: 38,
    text: "Qui non c’è cattiveria. C’è indifferenza. È peggio.",
    pano: "assets/pano2_deserto.jpg"
  },
  {
    id: 3,
    title: "Vesuvio – Ginestre",
    status: "Resistenza",
    meter: 58,
    text: "La vita non nega la catastrofe. Ci cresce accanto.",
    pano: "assets/pano3_vesuvio.jpg"
  }
];

let sceneIndex = 0;  // 0..SCENES-1
let progress   = 0.0;
let moveDir    = 0;  // -1 indietro, +1 avanti
let lastT      = performance.now();

/* ----------------- Drawer / Home ----------------- */
menuBtn.addEventListener("click", ()=>{
  drawer.classList.toggle("hidden");
  drawer.setAttribute("aria-hidden", drawer.classList.contains("hidden") ? "true":"false");
});

drawer.addEventListener("click", (e)=>{
  const btn = e.target.closest(".drawer-item");
  if(!btn) return;

  const wanted = Number(btn.dataset.scene);
  const idx = SCENES.findIndex(s=>s.id===wanted);

  drawer.classList.add("hidden");

  // Se non hai ancora avviato il WebGL, lo avvio ora e poi salto alla scena richiesta
  if(!hasStartedScene){
    enterScene(idx);
  }else if(idx >= 0){
    goToScene(idx, true);
  }
});

leopardiIcon.addEventListener("click", ()=>{
  stopAllMotion();
  showHome();
});

function showHome(){
  topTitle.textContent = "Giacomo Leopardi – Spazio di esperienza";
  lessonText.innerHTML = "Non stai entrando in una biografia.<br><br>Stai entrando in una visione.";
  statusLine.textContent = "Apertura";
  meterFill.style.width = "55%";
  homeLayer.classList.remove("hidden");
  videoLayer.classList.add("hidden");
  sceneLayer.classList.add("hidden");
}

/* ----------------- YouTube ----------------- */
window.onYouTubeIframeAPIReady = () => { ytReady = true; };

function ensurePlayer(){
  if(ytPlayer || !ytReady) return;
  ytPlayer = new YT.Player("player", {
    videoId: "iN_rSsKyAQc",
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      modestbranding: 1
    },
    events: { onStateChange: onPlayerStateChange }
  });
}

function onPlayerStateChange(evt){
  if(evt.data === YT.PlayerState.ENDED){
    // fine reale del video => entra nel WebGL
    enterScene(0);
  }
}

function showVideoAndPlay(){
  homeLayer.classList.add("hidden");
  sceneLayer.classList.add("hidden");
  videoLayer.classList.remove("hidden");

  ensurePlayer();

  // su iOS serve gesto utente: questo click vale come gesto
  const tryPlay = () => {
    try{
      if(ytPlayer && ytPlayer.playVideo){
        ytPlayer.playVideo();
        return;
      }
    }catch(_){}
    setTimeout(tryPlay, 120);
  };
  tryPlay();
}

/* Bottoni Home */
btnPlayVideo.addEventListener("click", ()=> showVideoAndPlay());
btnStartPath.addEventListener("click", ()=> enterScene(0)); // entra subito

skipBtn.addEventListener("click", ()=> enterScene(0));

/* ----------------- Three.js 360 ----------------- */
let renderer, camera, scene, sphere, texLoader;

function initThree(){
  const canvas = $("#gl");
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  resize();

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, canvas.clientWidth/canvas.clientHeight, 0.1, 2000);
  camera.position.set(0, 0, 0.1);

  texLoader = new THREE.TextureLoader();

  const geom = new THREE.SphereGeometry(500, 64, 32);
  geom.scale(-1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  sphere = new THREE.Mesh(geom, mat);
  scene.add(sphere);

  attachLookControls(canvas);
}

function loadPano(url){
  return new Promise((resolve, reject)=>{
    texLoader.load(url, (tex)=>{
      tex.colorSpace = THREE.SRGBColorSpace;
      sphere.material.map = tex;
      sphere.material.needsUpdate = true;
      resolve();
    }, undefined, reject);
  });
}

/* Entrata WebGL: puoi chiamarla sia dopo video che direttamente */
function enterScene(startIndex=0){
  // stop video se stava andando
  try{ ytPlayer && ytPlayer.stopVideo && ytPlayer.stopVideo(); }catch(_){}

  videoLayer.classList.add("hidden");
  homeLayer.classList.add("hidden");
  sceneLayer.classList.remove("hidden");

  if(!renderer) initThree();

  if(!hasStartedScene){
    hasStartedScene = true;
    requestAnimationFrame(loop);
  }

  // porta alla scena richiesta (default collina)
  startIndex = Math.max(0, Math.min(SCENES.length-1, startIndex));
  goToScene(startIndex, true);
}

async function goToScene(idx, withFog){
  idx = Math.max(0, Math.min(SCENES.length-1, idx));
  sceneIndex = idx;
  progress = 0.0;

  const s = SCENES[sceneIndex];
  topTitle.textContent = s.title;
  lessonText.textContent = s.text;
  statusLine.textContent = s.status;
  meterFill.style.width = s.meter + "%";

  if(withFog){
    fog.classList.remove("hidden");
    fog.style.animation = "none";
    void fog.offsetHeight;
    fog.style.animation = "";
  }

  await loadPano(s.pano);

  if(withFog){
    setTimeout(()=> fog.classList.add("hidden"), 1400);
  }
}

/* ----------------- Movimento “naturale” ----------------- */
const SPEED = 0.18; // lento, contemplativo
function updateMovement(dt){
  if(moveDir === 0) return;

  progress += moveDir * SPEED * dt;

  // soglie
  if(progress >= 1.0 && sceneIndex < SCENES.length-1){
    progress = 0.0;
    goToScene(sceneIndex+1, true);
  }
  if(progress <= 0.0 && sceneIndex > 0){
    progress = 1.0;
    goToScene(sceneIndex-1, true);
  }

  // respiro lieve sulla barra
  const base = SCENES[sceneIndex].meter;
  const breathe = Math.sin(performance.now()*0.0012) * 2.0;
  meterFill.style.width = (base + breathe) + "%";
}

function stopAllMotion(){ moveDir = 0; }

/* iPad: HOLD affidabile (touch + pointer + mouse) */
function bindHold(btn, dir){
  const start = (e)=>{
    // IMPORTANTISSIMO su iOS
    if(e && e.cancelable) e.preventDefault();
    moveDir = dir;
  };
  const end = (e)=>{
    if(e && e.cancelable) e.preventDefault();
    if(moveDir === dir) moveDir = 0;
  };

  // pointer events (modern)
  btn.addEventListener("pointerdown", start, {passive:false});
  btn.addEventListener("pointerup", end, {passive:false});
  btn.addEventListener("pointercancel", end, {passive:false});
  btn.addEventListener("pointerleave", end, {passive:false});

  // touch fallback (iOS Safari)
  btn.addEventListener("touchstart", start, {passive:false});
  btn.addEventListener("touchend", end, {passive:false});
  btn.addEventListener("touchcancel", end, {passive:false});

  // mouse fallback (desktop)
  btn.addEventListener("mousedown", start);
  window.addEventListener("mouseup", end);
}
bindHold(btnF, +1);
bindHold(btnB, -1);

/* Tastiera */
document.addEventListener("keydown", (e)=>{
  if(e.key === "ArrowRight") moveDir = +1;
  if(e.key === "ArrowLeft") moveDir = -1;
});
document.addEventListener("keyup", (e)=>{
  if(e.key === "ArrowRight" && moveDir===+1) moveDir = 0;
  if(e.key === "ArrowLeft" && moveDir===-1) moveDir = 0;
});

/* ----------------- Look controls ----------------- */
function attachLookControls(canvas){
  let isDown = false;
  let lastX = 0, lastY = 0;
  let yaw = 0, pitch = 0;

  const clamp = (v, a, b)=>Math.max(a, Math.min(b, v));

  const down = (e)=>{
    isDown = true;
    lastX = e.clientX; lastY = e.clientY;
  };
  const up = ()=>{ isDown = false; };
  const move = (e)=>{
    if(!isDown) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;

    yaw   -= dx * 0.003;
    pitch -= dy * 0.003;
    pitch = clamp(pitch, -Math.PI/2 + 0.05, Math.PI/2 - 0.05);

    camera.rotation.set(pitch, yaw, 0, "YXZ");
  };

  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("pointermove", move);
}

/* ----------------- Render loop ----------------- */
function loop(t){
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;

  updateMovement(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function resize(){
  const canvas = $("#gl");
  if(!renderer) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", ()=>{ if(renderer) resize(); });

// Start in home
showHome();
