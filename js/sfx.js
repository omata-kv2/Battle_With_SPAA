const SFX_FILES = {
  portal: './assets/sounds/portal.mp3',
  pda_open: './assets/sounds/pda_open.mp3',
  chat_pop: './assets/sounds/chat_pop.mp3',
  spaa_clear: './assets/sounds/spaa_clear.mp3',
  purchase: './assets/sounds/purchase.mp3',
  btn_click: './assets/sounds/btn_click.mp3',
  enemy_destroy: './assets/sounds/enemy_destroy.mp3',
  enemy_hit: './assets/sounds/enemy_hit.mp3',
  level_up: './assets/sounds/level_up.mp3',
  item_use: './assets/sounds/item_use.mp3'
};

let audioCtx = null;
const bufferCache = new Map();
const loadingPromises = new Map();
let sfxInitialized = false;

function ensureAudioContext(){
  if(!audioCtx){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(Ctx) audioCtx = new Ctx();
  }
  if(audioCtx && audioCtx.state === 'suspended'){
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

async function loadBuffer(key){
  if(bufferCache.has(key)) return bufferCache.get(key);
  if(loadingPromises.has(key)) return loadingPromises.get(key);
  const url = SFX_FILES[key];
  const ctx = ensureAudioContext();
  if(!url || !ctx) return null;

  const p = fetch(url)
    .then(r => r.arrayBuffer())
    .then(ab => ctx.decodeAudioData(ab))
    .then(buf => {
      bufferCache.set(key, buf);
      return buf;
    })
    .catch(() => null);
  loadingPromises.set(key, p);
  return p;
}

export function preloadAllSfx(){
  ensureAudioContext();
  Object.keys(SFX_FILES).forEach(k => { loadBuffer(k); });
}

export function playSfx(key, volume = 0.75){
  const ctx = ensureAudioContext();
  if(!ctx) return;
  const cached = bufferCache.get(key);
  if(cached){
    const src = ctx.createBufferSource();
    src.buffer = cached;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
    return;
  }
  loadBuffer(key).then(buf => {
    if(!buf || !audioCtx) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(0);
  });
}

export function initGlobalSfx(){
  if(sfxInitialized) return;
  sfxInitialized = true;

  const unlockAndPreload = () => {
    preloadAllSfx();
  };
  document.addEventListener('pointerdown', unlockAndPreload, { once: true });

  document.addEventListener('pointerdown', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if(!btn || btn.disabled) return;
    if(
      btn.id === 'fire' ||
      btn.id === 'skillBtn' ||
      btn.id === 'yajuRocketBtn' ||
      btn.id === 'yajuDashBtn' ||
      btn.id === 'yajuSprintBtn' ||
      btn.classList.contains('laser-mk-btn')
    ){
      return;
    }
    playSfx('btn_click', 0.65);
  }, { passive: true });
}
