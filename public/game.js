const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const GRAVITY = 470;
const SPEED = 620;
const fallback = { src: '/assets/memory.svg', caption: 'My favourite team. Us.' };
let memories = Array.from({ length: 6 }, () => ({ photos: [fallback.src], caption: fallback.caption }));
let photoIndex = 0, lossIndex = 0;
let lossImages = ['/assets/triggerfish.svg'];
const W = 960, H = 540;
let state = 'intro', kills = 0, lives = 5;
let player, enemies = [], ragdolls = [], projectiles = [], particles = [], angle = -0.35;
let dragging = false, pointerId = null, cooldown = 0, enemyClock = 0, elapsed = 0;
let soundOn = false, audio, lastTime = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

$('start').disabled = true;
fetch('/photos.json').then(r => { if (!r.ok) throw new Error('Photo configuration unavailable'); return r.json(); }).then(config => {
  const entries = config.memories?.map(memory => ({
    caption: memory.caption || fallback.caption,
    photos: (Array.isArray(memory.photos) ? memory.photos : [memory.src]).filter(src => typeof src === 'string' && src.length)
  })).filter(memory => memory.photos.length);
  if (entries?.length) memories = entries;
  const losses = (Array.isArray(config.lossImages) ? config.lossImages : [config.triggerfish]).filter(src => typeof src === 'string' && src.length);
  if (losses.length) lossImages = losses;
  $('total').textContent = memories.length;
  $('photo-intro').textContent = `${memories.length} levels. ${memories.reduce((count, memory) => count + memory.photos.length, 0)} little memories.`;
}).catch(() => { /* The draft stays playable with its bundled illustrations. */ }).finally(() => { $('start').disabled = false; });
for (const id of ['memory-image', 'final-image']) $(id).addEventListener('error', () => { if (!$(id).src.endsWith('/assets/memory.svg')) $(id).src = '/assets/memory.svg'; });
$('fish-image').addEventListener('error', () => { if (!$('fish-image').src.endsWith('/assets/triggerfish.svg')) $('fish-image').src = '/assets/triggerfish.svg'; });

function resize() {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * scale); canvas.height = Math.round(rect.height * scale);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  if (!player) placeCharacters();
}
function placeCharacters() {
  player = { x: W * 0.18, y: H * 0.72, color: '#fcf7f0' };
  const count = Math.min(3, 1 + Math.floor(kills / 2));
  const positions = count === 1 ? [[0.80, kills % 2 ? 0.49 : 0.64]] : count === 2 ? [[0.67, 0.43], [0.84, 0.69]] : [[0.66, 0.28], [0.85, 0.49], [0.65, 0.72]];
  enemies = positions.map(([x, y], i) => ({ x: W * x, y: H * y, color: '#f7a6b5', alive: true, hp: kills >= 4 ? 2 : 1, speed: kills >= 4 ? 490 : 420, clock: -i * 0.5, interval: [4.8,4.1,3.5,2.8,2.05,1.65][Math.min(kills,5)] + i * 0.12 }));
}
new ResizeObserver(resize).observe(canvas);

function tone(frequency = 400, duration = 0.1, type = 'sine') {
  if (!soundOn) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type; osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.055, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
  } catch { /* Sound is optional on browsers that disallow audio. */ }
}
function show(next) {
  state = next; dragging = false; pointerId = null;
  $('overlay').hidden = next === 'playing';
  for (const panel of document.querySelectorAll('.panel')) panel.hidden = panel.id !== next;
  $('pause').hidden = next !== 'playing';
  $('aim-hint').hidden = next !== 'playing';
  if (next !== 'playing') requestAnimationFrame(() => $(next).querySelector('button')?.focus({ preventScroll: true }));
}
function hud() {
  $('score').textContent = kills;
  $('hearts').textContent = '♥ '.repeat(lives) + '♡ '.repeat(5 - lives);
  $('hearts').setAttribute('aria-label', `${lives} lives remaining`);
}
function start() {
  kills = 0; lives = 5; elapsed = 0; particles = []; angle = -0.35;
  nextEnemy(); hud(); tone(520, 0.15);
}
function nextEnemy() {
  projectiles = []; ragdolls = []; particles = []; lives = 5; cooldown = 0; enemyClock = 0; placeCharacters(); hud(); show('playing');
  $('aim-hint').textContent = `Level ${kills + 1} · ${enemies.length} ${enemies.length === 1 ? 'enemy' : 'enemies'} · Drag to aim, release to throw`;
  canvas.focus({ preventScroll: true });
}
function burst(x, y, color) {
  if (reducedMotion) return;
  for (let i = 0; i < 18; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 180, vy: -Math.random() * 160, life: 0.8, color });
}
function finishLevel() {
  if (state !== 'playing') return;
  kills++; projectiles = []; hud(); tone(740, 0.22, 'triangle');
  photoIndex = 0;
  showRewardPhoto();
}
function showRewardPhoto() {
  const memory = memories[kills - 1], src = memory.photos[photoIndex];
  const lastPhoto = photoIndex === memory.photos.length - 1;
  if (kills >= memories.length && lastPhoto) {
    $('final-image').src = src;
    $('final-image').alt = `Our final memory: ${memory.caption}`;
    $('final-caption').textContent = memory.caption || 'You + me. Always.';
    $('final-gif').src = '/assets/lisan-al-gaib.gif';
    $('final-previous').hidden = photoIndex === 0;
    show('ending'); tone(880, 0.5);
  } else {
    $('memory-image').src = src;
    $('memory-image').alt = `Photo ${photoIndex + 1} of ${memory.photos.length}: ${memory.caption}`;
    $('caption').textContent = memory.caption;
    $('memory-count').textContent = `Level ${kills} complete · Photo ${photoIndex + 1} of ${memory.photos.length}`;
    $('previous-photo').hidden = photoIndex === 0;
    $('continue').innerHTML = lastPhoto ? 'Next level <span>↗</span>' : 'Next photo <span>♡</span>';
    show('memory');
    $('continue').focus({ preventScroll: true });
  }
  $('overlay').scrollTop = 0;
  const upcoming = memory.photos[photoIndex + 1];
  if (upcoming) { const preload = new Image(); preload.src = upcoming; }
}
function hitPlayer() {
  lives--; hud(); burst(player.x, player.y - 42, '#f7a6b5'); tone(130, 0.15, 'triangle');
  if (lives <= 0) {
    projectiles = [];
    $('fish-image').src = lossImages[lossIndex++ % lossImages.length];
    $('fish-image').alt = 'A triggerfish reaction to losing the game';
    show('death');
  }
}
function throwSpear(owner, a, who = player) {
  const velocity = owner === 'player' ? SPEED : who.speed;
  projectiles.push({ x: who.x, y: who.y - 43, vx: Math.cos(a) * velocity, vy: Math.sin(a) * velocity, owner });
  tone(owner === 'player' ? 420 : 240, 0.06, 'triangle');
}
function fire() {
  if (state !== 'playing' || cooldown > 0) return;
  throwSpear('player', angle); cooldown = 0.38;
}
// Solve the lower ballistic arc so enemy spears are aimed, with a small miss allowance.
function enemyAim(enemy) {
  const dx = enemy.x - player.x;
  const rise = enemy.y - player.y + (Math.random() - 0.5) * (kills >= 4 ? 20 : 48);
  const speed2 = enemy.speed ** 2;
  const discriminant = speed2 ** 2 - GRAVITY * (GRAVITY * dx ** 2 + 2 * rise * speed2);
  if (discriminant < 0) return Math.PI + Math.PI / 4;
  return Math.PI + Math.atan((speed2 - Math.sqrt(discriminant)) / (GRAVITY * dx));
}
function pointerAngle(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * W / rect.width, y = (event.clientY - rect.top) * H / rect.height;
  angle = Math.max(-1.35, Math.min(0.65, Math.atan2(y - (player.y - 43), Math.max(20, x - player.x))));
}
canvas.addEventListener('pointerdown', event => {
  if (state !== 'playing' || pointerId !== null) return;
  pointerId = event.pointerId; dragging = true; pointerAngle(event); canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => { if (dragging && event.pointerId === pointerId) pointerAngle(event); });
canvas.addEventListener('pointerup', event => {
  if (!dragging || event.pointerId !== pointerId) return;
  pointerAngle(event); dragging = false; pointerId = null; fire();
});
canvas.addEventListener('pointercancel', () => { dragging = false; pointerId = null; });
document.addEventListener('keydown', event => {
  if (event.code === 'KeyP') { if (state === 'playing') show('paused'); else if (state === 'paused') resume(); return; }
  if (state !== 'playing' || event.target instanceof HTMLButtonElement) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (['ArrowUp', 'ArrowLeft'].includes(event.code)) angle = Math.max(-1.35, angle - 0.025);
  if (['ArrowDown', 'ArrowRight'].includes(event.code)) angle = Math.min(0.65, angle + 0.025);
  if (event.code === 'Space') fire();
});
function resume() { show('playing'); canvas.focus({ preventScroll: true }); }
$('start').onclick = start; $('retry').onclick = nextEnemy; $('replay').onclick = start;
$('pause').onclick = () => show('paused'); $('resume').onclick = resume;
$('continue').onclick = () => {
  if (photoIndex < memories[kills - 1].photos.length - 1) { photoIndex++; showRewardPhoto(); }
  else nextEnemy();
};
for (const id of ['previous-photo', 'final-previous']) $(id).onclick = () => { if (photoIndex > 0) { photoIndex--; showRewardPhoto(); } };
$('sound').onclick = () => { soundOn = !soundOn; $('sound').textContent = `Sound ${soundOn ? 'on' : 'off'} ♫`; $('sound').setAttribute('aria-pressed', String(soundOn)); tone(600); };
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') show('paused'); });

const portraitPhone = matchMedia('(max-width: 650px) and (orientation: portrait)');
function updateOrientation() {
  $('rotate-prompt').hidden = !portraitPhone.matches;
  document.querySelector('.arcade').inert = portraitPhone.matches;
  if (portraitPhone.matches && state === 'playing') show('paused');
}
portraitPhone.addEventListener('change', updateOrientation);
updateOrientation();
async function enterFullscreen() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch { /* Physical rotation remains available when fullscreen or locking is unsupported. */ }
  $('rotate-help').textContent = 'Turn your phone sideways. If it stays upright, switch off portrait orientation lock.';
  updateOrientation();
}
$('rotate-fullscreen').onclick = enterFullscreen;
$('fullscreen').onclick = async () => {
  if (document.fullscreenElement) {
    screen.orientation?.unlock?.();
    await document.exitFullscreen();
  } else await enterFullscreen();
};
document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Exit fullscreen ⛶' : 'Fullscreen ⛶'; });

// Swept collision: test the path travelled this frame, avoiding missed hits at low frame rates.
function intersectsCharacter(x0, y0, x1, y1, target, headOnly = false) {
  const left = target.x - 15, right = target.x + 15;
  const top = target.y - 76, bottom = target.y - (headOnly ? 55 : 3);
  let min = 0, max = 1;
  for (const [origin, delta, low, high] of [[x0, x1 - x0, left, right], [y0, y1 - y0, top, bottom]]) {
    if (Math.abs(delta) < 0.0001) { if (origin < low || origin > high) return false; }
    else {
      const a = (low - origin) / delta, b = (high - origin) / delta;
      min = Math.max(min, Math.min(a, b)); max = Math.min(max, Math.max(a, b));
      if (min > max) return false;
    }
  }
  return true;
}
function update(dt) {
  if (state !== 'playing') return;
  elapsed += dt; cooldown = Math.max(0, cooldown - dt); enemyClock += dt;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.clock += dt;
    if (enemy.clock > enemy.interval) { throwSpear('enemy', enemyAim(enemy), enemy); enemy.clock = 0; }
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i], x0 = p.x, y0 = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt + GRAVITY * dt * dt / 2; p.vy += GRAVITY * dt;
    const target = p.owner === 'player' ? enemies.find(enemy => enemy.alive && intersectsCharacter(x0, y0, p.x, p.y, enemy)) : intersectsCharacter(x0, y0, p.x, p.y, player) ? player : null;
    if (target) {
      projectiles.splice(i, 1);
      if (p.owner === 'player') {
        const headshot = intersectsCharacter(x0,y0,p.x,p.y,target,true);
        target.hp -= headshot ? 2 : 1;
        burst(target.x, p.y, '#f9d788'); tone(180, 0.1, 'triangle');
        if (target.hp > 0) { $('aim-hint').textContent = 'One more hit. Aim for the head!'; continue; }
        target.alive = false; ragdolls.push(makeRagdoll(target, p));
        const remaining = enemies.filter(enemy => enemy.alive).length;
        $('aim-hint').textContent = remaining ? `${remaining} ${remaining === 1 ? 'enemy' : 'enemies'} left. You've got this.` : 'Going… going…';
      } else { hitPlayer(); if (state !== 'playing') return; }
    } else if (p.x < -80 || p.x > W + 80 || p.y > H + 80) projectiles.splice(i, 1);
  }
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; p.life -= dt; }
  for (const doll of ragdolls) stepRagdoll(doll, dt);
  // A reward waits for the final body to completely leave the visible arena.
  ragdolls = ragdolls.filter(doll => !doll.points.every(p => p.y > H + 25 || p.x > W + 65 || p.x < -65));
  if (enemies.every(enemy => !enemy.alive) && ragdolls.length === 0) finishLevel();
}

function makeRagdoll(enemy, projectile) {
  const offsets = [[0,-65],[0,-48],[0,-26],[-17,-39],[-27,-49],[18,-42],[32,-47],[-12,-13],[-18,0],[13,-13],[18,0]];
  const points = offsets.map(([x,y], i) => ({x:enemy.x+x,y:enemy.y+y,px:enemy.x+x-(projectile.vx*0.22+(i%3-1)*48)/120,py:enemy.y+y-(projectile.vy*0.15-95+(i%4)*22)/120}));
  const pairs = [[0,1],[1,2],[1,3],[3,4],[1,5],[5,6],[2,7],[7,8],[2,9],[9,10],[3,5],[7,9]];
  return {points, color:enemy.color, accumulator:0, links:pairs.map(([a,b])=>({a,b,length:Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y)}))};
}
function stepRagdoll(doll, dt) {
  // Fixed physics steps keep the floppy joints consistent across phones and desktops.
  doll.accumulator += dt;
  const step = 1/120;
  while(doll.accumulator >= step) {
    doll.accumulator -= step;
    for(const p of doll.points) {
      const vx=(p.x-p.px)*0.998, vy=(p.y-p.py)*0.998;
      p.px=p.x; p.py=p.y; p.x+=vx; p.y+=vy+820*step*step;
    }
    for(let pass=0;pass<6;pass++) for(const link of doll.links) {
      const a=doll.points[link.a], b=doll.points[link.b], dx=b.x-a.x,dy=b.y-a.y;
      const length=Math.hypot(dx,dy)||0.001, correction=(length-link.length)/length*0.5;
      a.x+=dx*correction; a.y+=dy*correction; b.x-=dx*correction; b.y-=dy*correction;
    }
  }
}
function drawRagdoll(doll) {
  const p=doll.points;
  for(const link of doll.links.slice(0,10)) line([[p[link.a].x,p[link.a].y],[p[link.b].x,p[link.b].y]],doll.color,4);
  circle(p[0].x,p[0].y,10,doll.color);
  line([[p[0].x-5,p[0].y-3],[p[0].x-1,p[0].y+1]],'#182b46',1.5);
  line([[p[0].x-5,p[0].y+1],[p[0].x-1,p[0].y-3]],'#182b46',1.5);
  spear(p[1].x+18,p[1].y,Math.atan2(p[2].y-p[1].y,p[2].x-p[1].x)-Math.PI/2,'#fcf7f0',54);
}
function line(points, color, width = 3) {
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
}
function circle(x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function spear(x, y, a, color, length = 42) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  line([[-length, 0], [-5, 0]], '#e4bc89', 2.4);
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-10, -4); ctx.lineTo(-8, 0); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill(); ctx.restore();
}
function character(who, isPlayer) {
  const { x, y, color } = who, dir = isPlayer ? 1 : -1;
  circle(x, y - 65, 10, color);
  line([[x, y - 53], [x, y - 25], [x - 12, y]], color, 4);
  line([[x, y - 25], [x + 12, y]], color, 4);
  line([[x, y - 46], [x - dir * 10, y - 36], [x + dir * 6, y - 34]], color, 3);
  const a = isPlayer ? angle : Math.PI + 0.15;
  line([[x, y - 47], [x + Math.cos(a) * 23, y - 43 + Math.sin(a) * 23]], color, 3);
  spear(x + Math.cos(a) * 49, y - 43 + Math.sin(a) * 49, a, color, 52);
  if (isPlayer) { line([[x - 10, y - 68], [x + 10, y - 68], [x + 17, y - 61]], '#f7a6b5', 3); }
  else { line([[x - 10, y - 67], [x + 10, y - 67]], '#182b46', 3); }
  if (!isPlayer && who.hp > 1) { circle(x-5,y-86,3,'#f9d788'); circle(x+5,y-86,3,'#f9d788'); }
}
function island(x, y, size, accent) {
  ctx.fillStyle = '#29465a'; ctx.beginPath(); ctx.moveTo(x - size, y); ctx.lineTo(x + size, y); ctx.lineTo(x + size * 0.6, y + 27); ctx.lineTo(x + size * 0.15, y + 60); ctx.lineTo(x - size * 0.48, y + 36); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#34566a'; ctx.beginPath(); ctx.moveTo(x - size, y); ctx.lineTo(x + 8, y + 5); ctx.lineTo(x + size * 0.15, y + 60); ctx.lineTo(x - size * 0.48, y + 36); ctx.fill();
  line([[x - size, y], [x + size, y]], accent, 5);
  for (let i = 0; i < 5; i++) { const xx = x - size + 9 + i * size * 0.38; line([[xx, y], [xx + 2, y - 8], [xx + 5, y - 2]], accent, 1); }
}
function draw() {
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#203650'); sky.addColorStop(1, '#476880'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 38; i++) { const x = ((i * 137.5 + 18) % 997) / 997 * W, y = ((i * 71 + 26) % 400) / 650 * H; circle(x, y, i % 3 ? 1 : 1.7, '#d5dbe076'); }
  circle(W * 0.78, H * 0.23, W < 600 ? 30 : 43, '#f9dfaa');
  circle(W * 0.78 - 13, H * 0.23 - 10, W < 600 ? 27 : 38, '#243c56');
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = ['#36566c', '#2b485f', '#203c53'][layer]; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 35; x += 35) ctx.lineTo(x, H * (0.72 + layer * 0.075) - Math.sin(x / (130 + layer * 40) + layer * 2) * (35 - layer * 7));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  if (!player) return;
  island(player.x, player.y + 3, Math.min(W * 0.12, 74), '#a7c7b4');
  for (const enemy of enemies) island(enemy.x, enemy.y + 3, Math.min(W * (enemies.length > 1 ? 0.075 : 0.10), 63), '#bf9eaf');
  character(player, true);
  for (const enemy of enemies) if (enemy.alive) character(enemy, false);
  for (const doll of ragdolls) drawRagdoll(doll);
  if (state === 'playing') {
    ctx.font = '11px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = '#d2e0e5'; ctx.fillText('you ♡', player.x, player.y + 83);
    ctx.fillStyle = '#edc1cb';
    for (const enemy of enemies) if (enemy.alive) ctx.fillText(enemy.clock > enemy.interval - 1 ? 'watch out…' : enemies.length === 1 ? 'a minor inconvenience' : 'trouble', enemy.x, enemy.y + 77);
  }
  for (const p of projectiles) spear(p.x, p.y, Math.atan2(p.vy, p.vx), p.owner === 'player' ? '#fcf7f0' : '#f7a6b5');
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life); circle(p.x, p.y, 3, p.color); } ctx.globalAlpha = 1;
}
function frame(time) { const dt = Math.min((time - lastTime) / 1000, 0.035); lastTime = time; update(dt); draw(); requestAnimationFrame(frame); }
resize(); hud(); requestAnimationFrame(frame);
