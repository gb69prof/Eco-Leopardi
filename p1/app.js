/* Leopardi Web App – Prototype v1
   - Video YouTube: click portrait -> plays, on end -> enters 360 scene
   - 360 scenes: pano1/pano2/pano3
   - Natural forward/back: hold arrows (touch) or keyboard arrows
   - Fog transition between scenes
*/

const $ = (s)=>document.querySelector(s);

const homeLayer = $("#home-layer");
const videoLayer = $("#video-layer");
const sceneLayer = $("#scene-layer");
const fog = $("#fog");

const topTitle = $("#top-title");
const lessonText = $("#lesson-text");
const statusLine = $("#status-line");
const meterFill = $("#meter-fill");

const drawer = $("#drawer");
const menuBtn = $("#menu-btn");
const leopardiIcon = $("#leopardi-icon");

const btnF = $("#btn-forward");
const btnB = $("#btn-back");
const skipBtn = $("#skip-video");
const homePortrait = $("#home-portrait");

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

let sceneIndex = 0;      // 0..SCENES-1
let progress = 0.0;      // 0..1 inside current segment (for “natural” threshold feel)
let moveDir = 0;         // -1 back, +1 forward, 0 none
let lastT = performance.now();

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
  if(idx>=0){
    drawer.classList.add("hidden");
    goToScene(idx, true);
  }
});

leopardiIcon.addEventListener("click", ()=>{
  // Back to home
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
window.onYouTubeIframeAPIReady = () => {
  ytReady = true;
};

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
    events: {
      onStateChange: onPlayerStateChange
    }
  });
}

function onPlayerStateChange(evt){
  // ENDED = 0
  if(evt.data === YT.PlayerState.ENDED){
    enterScene();
  }
}

homePortrait.addEventListener("click", ()=>{
  homeLayer.classList.add("hidden");
  videoLayer.classList.remove("hidden");
  ensurePlayer();
  // YouTube requires a user gesture. This click qualifies.
  // If player not ready yet, poll briefly.
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
});

skipBtn.addEventListener("click", ()=> enterScene());

/* ----------------- Three.js 360 + minimal parallax ----------------- */
let renderer, camera, scene, sphere, texLoader;
let ambientGain = null;

function initThree(){
  const canvas = $("#gl");
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  resize();

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, canvas.clientWidth/canvas.clientHeight, 0.1, 2000);
  camera.position.set(0, 0, 0.1);

  texLoader = new THREE.TextureLoader();

  // Inside-out sphere
  const geom = new THREE.SphereGeometry(500, 64, 32);
  geom.scale(-1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  sphere = new THREE.Mesh(geom, mat);
  scene.add(sphere);

  // Minimal “foreground” plane for slight depth cue
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x0f0f12, transparent:true, opacity:0.12 })
  );
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -4.5;
  ground.position.z = -6;
  scene.add(ground);

  // Simple pointer look (mouse + touch drag)
  attachLookControls(canvas);

  // Start ambient audio (procedural wind-like noise)
  startAmbient();
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

function enterScene(){
  if(hasStartedScene) return;
  hasStartedScene = true;

  // stop video playback to avoid audio bleed
  try{ ytPlayer && ytPlayer.stopVideo && ytPlayer.stopVideo(); }catch(_){}

  videoLayer.classList.add("hidden");
  sceneLayer.classList.remove("hidden");

  if(!renderer) initThree();

  // start at scene 1 (collina)
  goToScene(0, true);
  requestAnimationFrame(loop);
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
    // allow CSS animation restart
    fog.style.animation = "none";
    void fog.offsetHeight;
    fog.style.animation = "";
  }

  await loadPano(s.pano);

  // hide fog a moment later
  if(withFog){
    setTimeout(()=> fog.classList.add("hidden"), 1400);
  }
}

/* ----------------- Movement model ----------------- */
/* We simulate “walking forward/back” as progress 0..1 inside the current scene.
   When progress crosses 1 -> next scene. When crosses 0 backward -> previous scene.
   This keeps the “passo passo” feel with a natural threshold.
*/
const SPEED = 0.18; // slow & contemplative
function updateMovement(dt){
  if(moveDir === 0) return;

  progress += moveDir * SPEED * dt;

  // subtle camera bob + minimal z cue
  const bob = Math.sin(performance.now()*0.002) * 0.03 * Math.abs(moveDir);
  camera.position.z = 0.10 + bob;

  // When reaching thresholds, switch scenes with fog
  if(progress >= 1.0 && sceneIndex < SCENES.length-1){
    progress = 0.0;
    goToScene(sceneIndex+1, true);
  }
  if(progress <= 0.0 && sceneIndex > 0){
    progress = 1.0;
    goToScene(sceneIndex-1, true);
  }

  // Meter micro-reacts inside scene (breathing)
  const base = SCENES[sceneIndex].meter;
  const breathe = Math.sin(performance.now()*0.0012) * 2.0;
  meterFill.style.width = (base + breathe) + "%";
}

function stopAllMotion(){ moveDir = 0; }

/* Touch arrows: hold to move */
function bindHold(btn, dir){
  const start = (e)=>{ e.preventDefault(); moveDir = dir; };
  const end = (e)=>{ e.preventDefault(); if(moveDir===dir) moveDir = 0; };

  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", end);
  btn.addEventListener("pointercancel", end);
  btn.addEventListener("pointerleave", end);
}
bindHold(btnF, +1);
bindHold(btnB, -1);

/* Keyboard arrows */
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

    yaw -= dx * 0.003;
    pitch -= dy * 0.003;
    pitch = clamp(pitch, -Math.PI/2 + 0.05, Math.PI/2 - 0.05);

    camera.rotation.set(pitch, yaw, 0, "YXZ");
  };

  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("pointermove", move);
}

/* ----------------- Ambient audio (procedural) ----------------- */
function startAmbient(){
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();

    // white noise
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++){ output[i] = (Math.random()*2-1)*0.35; }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 720;

    const gain = ctx.createGain();
    gain.gain.value = 0.0; // fade in later

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(0);
    ambientGain = gain;

    // fade in slowly
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 2.2);

    // resume on first gesture if needed
    const resume = ()=>{
      if(ctx.state === "suspended") ctx.resume();
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);

  }catch(_){}
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
window.addEventListener("resize", ()=>{
  if(renderer) resize();
});

// Start in home
showHome();