// Public mission visual study. No persistence, mission completion or backend calls.
const camera = document.querySelector('.camera');
const frames = [...document.querySelectorAll('.frame')];
const buttons = [...document.querySelectorAll('[data-stage]')];
const slider = document.querySelector('#phase');
const play = document.querySelector('#play');
const motion = document.querySelector('#motion');
const hudToggle = document.querySelector('#show-hud');
const hud = document.querySelector('.hud');
const alarm = document.querySelector('.alarm-light');
const terminal = document.querySelector('.terminal-interface');
const noise = document.querySelector('.screen-noise');
const context = noise.getContext('2d');
const noiseFrame = context.createImageData(noise.width, noise.height);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const descriptions = [
  'Die Drohne schwebt vor dem Wartungsterminal. Akku und Steuerverbindung bleiben sichtbar.',
  'Erste Rauchfahnen steigen auf. Das rote Warnlicht pulsiert; einzelne weiße Leuchten fallen aus.',
  'Der Rauch verdichtet sich. Wandanzeigen brechen weg und das Terminal beginnt zu rauschen.',
  'Der goldene Kern leuchtet nicht mehr. Rauch, dunkle Anzeigen und Bildschirmrauschen bleiben zurück.'
];
let value = 0;
let selected = -1;
let run = null;
let tween = null;
let animation = 0;
let lastEffect = -Infinity;
let effectTime = 0;
let lastTick = 0;
let loaded = false;
motion.checked = !reduced.matches;
const clamp = n => Math.max(0, Math.min(1,n));

function renderPhase(next) {
  value = Math.max(0,Math.min(3,next));
  // Opaque base + successive top layers: exact endpoints, no black midpoint.
  frames.forEach((image,index) => image.style.opacity = index === 0 ? '1' : String(clamp(value-(index-1))));
  terminal.style.opacity = String(1-clamp(value/1.3));
  noise.style.opacity = String(clamp(value-1.2)*.17);
  slider.value = value.toFixed(2);
  camera.dataset.phase = value.toFixed(2);
  const index = Math.round(value);
  slider.setAttribute('aria-valuetext',buttons[index].textContent.trim());
  if(index !== selected) {
    selected = index;
    buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    document.querySelector('#description').textContent = descriptions[index];
    updateAlt();
  }
  renderEffects(effectTime);
}

function updateAlt() {
  const status = hudToggle.checked ? ' Akku: 82 Prozent. Steuerverbindung stabil.' : '';
  camera.setAttribute('aria-label','Drohnenkamera. '+descriptions[selected]+status);
}

function renderEffects(time) {
  const pulse = motion.checked ? .24+.76*(.5+.5*Math.sin(time*2*Math.PI/2.4)) : .45;
  alarm.style.opacity = String(clamp(value)*(.16+.10*value)*pulse);
  if(value<1.2)return;
  let seed = (Math.floor(time*10)+1)*7919;
  const pixels = noiseFrame.data;
  for(let i=0;i<pixels.length;i+=4) {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    const grey = 25+(seed>>>24)*.55;
    pixels[i]=grey;pixels[i+1]=grey;pixels[i+2]=grey;pixels[i+3]=190;
  }
  context.putImageData(noiseFrame,0,0);
  const bandY = (time*21)%noise.height;
  context.fillStyle='#d4deec44';
  context.fillRect(0,bandY,noise.width,1);
}

function stopSequence() {
  run = null;tween = null;
  play.textContent = 'Ablauf abspielen';
  play.setAttribute('aria-pressed','false');
}

function requestTick() {
  if(!animation&&!document.hidden)animation=requestAnimationFrame(tick);
}

function tick(now) {
  animation=0;
  if(document.hidden)return;
  const elapsed = lastTick ? Math.min(100,now-lastTick) : 0;
  lastTick=now;
  if(motion.checked)effectTime+=elapsed/1000;
  if(run) {
    const seconds=(now-run.started)/1000;
    if(motion.checked)renderPhase((seconds-1.2)/3.6);
    else renderPhase(Math.min(3,Math.floor(seconds/3.6)));
    if(seconds>=12.5){renderPhase(3);stopSequence();}
  } else if(tween) {
    const progress=clamp((now-tween.started)/1100);
    const ease=progress*progress*(3-2*progress);
    renderPhase(tween.from+(tween.to-tween.from)*ease);
    if(progress===1)tween=null;
  }
  if(now-lastEffect>100) {renderEffects(effectTime);lastEffect=now;}
  if(run||tween||(motion.checked&&value>.01))requestTick();
}

buttons.forEach(button=>button.addEventListener('click',()=>{
  stopSequence();
  const to=Number(button.dataset.stage);
  if(motion.checked&&loaded)tween={from:value,to,started:performance.now()};
  else renderPhase(to);
  requestTick();
}));
slider.addEventListener('input',()=>{stopSequence();renderPhase(Number(slider.value));requestTick();});
play.addEventListener('click',()=>{
  if(run){stopSequence();return;}
  tween=null;renderPhase(0);run={started:performance.now()};
  play.textContent='Ablauf pausieren';play.setAttribute('aria-pressed','true');requestTick();
});
motion.addEventListener('change',()=>{
  if(!motion.checked&&tween){const to=tween.to;tween=null;renderPhase(to);}
  renderEffects(effectTime);requestTick();
});
hudToggle.addEventListener('change',()=>{hud.hidden=!hudToggle.checked;updateAlt();});
reduced.addEventListener('change',()=>{
  motion.checked=!reduced.matches;
  if(reduced.matches&&tween){const to=tween.to;tween=null;renderPhase(to);}
  renderEffects(effectTime);requestTick();
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){stopSequence();if(animation)cancelAnimationFrame(animation);animation=0;}
  else {lastTick=0;requestTick();}
});
renderPhase(0);
Promise.all(frames.map(image=>image.decode())).then(()=>{
  loaded=true;camera.dataset.ready='true';play.disabled=false;play.textContent='Ablauf abspielen';
}).catch(()=>{play.textContent='Bild fehlt';document.querySelector('#description').textContent='Eine Bilddatei konnte nicht geladen werden. Bitte Vorschau neu öffnen.';});
