'use strict';

// ============================================================
// STREET COIN RUNNER 152 - Main Game Script
// ============================================================

// ---------- Persistence ----------
const STORAGE_KEY = 'streetCoinRunner152.save.v1';

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    return Object.assign(defaultSave(), data);
  } catch (e) {
    return defaultSave();
  }
}

function defaultSave() {
  return {
    bestScore: 0,
    totalCoins: 0,
    music: true,
    sfx: true,
    difficulty: 'normal'
  };
}

function persistSave(save) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch (e) {
    console.error('Save failed', e);
  }
}

const save = loadSave();

// ---------- Audio (Web Audio API generated) ----------
const Audio = (() => {
  let ctx = null;
  let musicGain = null;
  let sfxGain = null;
  let musicNodes = null;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain.gain.value = 0.18;
    sfxGain.gain.value = 0.35;
    musicGain.connect(ctx.destination);
    sfxGain.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    const c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
  }

  function beep(freq, duration, type = 'square', vol = 1, slide = 0) {
    if (!save.sfx) return;
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + duration);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function coin() {
    beep(880, 0.08, 'square', 0.4);
    setTimeout(() => beep(1320, 0.1, 'square', 0.3), 60);
  }
  function jump() {
    beep(420, 0.12, 'square', 0.35, 200);
  }
  function crash() {
    if (!save.sfx) return;
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime;
    // noise burst
    const bufferSize = c.sampleRate * 0.4;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = buffer;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(g);
    g.connect(sfxGain);
    src.start(t);
    // low thud
    beep(120, 0.3, 'sawtooth', 0.5, -60);
  }

  function startMusic() {
    if (!save.music) return;
    const c = ensureCtx();
    if (!c) return;
    stopMusic();

    const notes = [262, 330, 392, 523, 392, 330, 262, 196,
                   294, 370, 440, 587, 440, 370, 294, 220];
    const bpm = 120;
    const stepDur = 60 / bpm / 2; // 16th notes
    let stepIdx = 0;
    let nextTime = c.currentTime + 0.1;

    const scheduler = setInterval(() => {
      if (!save.music) { stopMusic(); return; }
      while (nextTime < c.currentTime + 0.5) {
        const note = notes[stepIdx % notes.length];
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'triangle';
        osc.frequency.value = note;
        g.gain.setValueAtTime(0, nextTime);
        g.gain.linearRampToValueAtTime(0.3, nextTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, nextTime + stepDur * 0.9);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(nextTime);
        osc.stop(nextTime + stepDur);

        // simple bass on beat
        if (stepIdx % 4 === 0) {
          const bo = c.createOscillator();
          const bg = c.createGain();
          bo.type = 'sine';
          bo.frequency.value = note / 2;
          bg.gain.setValueAtTime(0, nextTime);
          bg.gain.linearRampToValueAtTime(0.4, nextTime + 0.01);
          bg.gain.exponentialRampToValueAtTime(0.001, nextTime + stepDur * 2 * 0.9);
          bo.connect(bg);
          bg.connect(musicGain);
          bo.start(nextTime);
          bo.stop(nextTime + stepDur * 2);
        }

        nextTime += stepDur;
        stepIdx++;
      }
    }, 60);

    musicNodes = { scheduler };
  }

  function stopMusic() {
    if (musicNodes && musicNodes.scheduler) {
      clearInterval(musicNodes.scheduler);
    }
    musicNodes = null;
  }

  function setMusic(on) {
    save.music = on;
    persistSave(save);
    if (on) startMusic();
    else stopMusic();
  }

  function setSfx(on) {
    save.sfx = on;
    persistSave(save);
  }

  return { unlock, coin, jump, crash, startMusic, stopMusic, setMusic, setSfx };
})();

// ---------- Screen Routing ----------
const screens = {
  menu: document.getElementById('screen-menu'),
  how: document.getElementById('screen-how'),
  settings: document.getElementById('screen-settings'),
  game: document.getElementById('screen-game')
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
  if (name === 'menu') {
    document.getElementById('menu-best-score').textContent = save.bestScore;
    document.getElementById('menu-total-coins').textContent = save.totalCoins;
  }
}

// ---------- Menu wiring ----------
document.getElementById('btn-play').addEventListener('click', () => {
  Audio.unlock();
  showScreen('game');
  Game.start();
});
document.getElementById('btn-how').addEventListener('click', () => showScreen('how'));
document.getElementById('btn-how-back').addEventListener('click', () => showScreen('menu'));
document.getElementById('btn-settings').addEventListener('click', () => {
  refreshSettingsUI();
  showScreen('settings');
});
document.getElementById('btn-settings-back').addEventListener('click', () => showScreen('menu'));

document.getElementById('btn-quit').addEventListener('click', () => {
  if (window.appAPI && window.appAPI.quit) window.appAPI.quit();
  else window.close();
});

document.getElementById('btn-reset-save').addEventListener('click', () => {
  if (confirm('Reset all saved data? This will clear high score and total coins.')) {
    save.bestScore = 0;
    save.totalCoins = 0;
    persistSave(save);
    refreshSettingsUI();
    showScreen('menu');
  }
});

// Settings toggles
function refreshSettingsUI() {
  const mt = document.getElementById('toggle-music');
  mt.dataset.on = save.music ? 'true' : 'false';
  mt.textContent = save.music ? 'On' : 'Off';
  const st = document.getElementById('toggle-sfx');
  st.dataset.on = save.sfx ? 'true' : 'false';
  st.textContent = save.sfx ? 'On' : 'Off';
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === save.difficulty);
  });
}

document.getElementById('toggle-music').addEventListener('click', () => {
  Audio.unlock();
  Audio.setMusic(!save.music);
  refreshSettingsUI();
});
document.getElementById('toggle-sfx').addEventListener('click', () => {
  Audio.unlock();
  Audio.setSfx(!save.sfx);
  refreshSettingsUI();
  if (save.sfx) Audio.coin();
});
document.querySelectorAll('.diff-btn').forEach(b => {
  b.addEventListener('click', () => {
    save.difficulty = b.dataset.diff;
    persistSave(save);
    refreshSettingsUI();
  });
});

// In-game overlay buttons
document.getElementById('btn-pause').addEventListener('click', () => Game.togglePause());
document.getElementById('btn-resume').addEventListener('click', () => Game.togglePause());
document.getElementById('btn-pause-menu').addEventListener('click', () => Game.returnToMenu());
document.getElementById('btn-restart').addEventListener('click', () => Game.restart());
document.getElementById('btn-game-menu').addEventListener('click', () => Game.returnToMenu());

// ---------- Input ----------
const Input = {
  left: false,
  right: false,
  jumpQueued: false
};

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      Input.left = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      Input.right = true;
      break;
    case 'Space':
    case 'KeyW':
    case 'ArrowUp':
      Input.jumpQueued = true;
      e.preventDefault();
      break;
    case 'KeyP':
    case 'Escape':
      if (screens.game.classList.contains('active')) Game.togglePause();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      Input.left = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      Input.right = false;
      break;
  }
});

// ---------- Gamepad ----------
// Standard mapping:
//   buttons: 0=A, 1=B, 2=X, 3=Y, 4=LB, 5=RB, 6=LT, 7=RT,
//            8=Back, 9=Start, 10=LS, 11=RS, 12=Up, 13=Down, 14=Left, 15=Right
//   axes:    0=LSX, 1=LSY, 2=RSX, 3=RSY
const Gamepad = (() => {
  const prev = { btns: [], axisLeft: false, axisRight: false };
  let connected = false;

  window.addEventListener('gamepadconnected', (e) => {
    connected = true;
    console.log('Gamepad connected:', e.gamepad.id);
  });
  window.addEventListener('gamepaddisconnected', () => {
    connected = false;
  });

  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) return p;
    }
    return null;
  }

  function pressed(pad, idx) {
    const b = pad.buttons[idx];
    return b ? (typeof b === 'object' ? b.pressed : b > 0.5) : false;
  }

  function tick() {
    const pad = readPad();
    if (!pad) return;

    const gameActive = screens.game.classList.contains('active');
    const onMenu = !gameActive;

    // Edge detection helper
    const downNow = (idx) => pressed(pad, idx);
    const downPrev = (idx) => !!prev.btns[idx];
    const justPressed = (idx) => downNow(idx) && !downPrev(idx);

    // Stick → directional edges
    const axL = pad.axes[0] || 0;
    const axLNow = axL < -0.5;
    const axRNow = axL > 0.5;
    const axLEdge = axLNow && !prev.axisLeft;
    const axREdge = axRNow && !prev.axisRight;

    // Vertical for menu nav
    const axV = pad.axes[1] || 0;
    const upNow = downNow(12) || axV < -0.5;
    const downNowV = downNow(13) || axV > 0.5;
    const upEdge = upNow && !prev._upHeld;
    const downEdge = downNowV && !prev._downHeld;

    if (gameActive && !document.getElementById('overlay-pause').classList.contains('active')
                   && !document.getElementById('overlay-gameover').classList.contains('active')) {
      // Lane changes
      if (justPressed(14) || axLEdge) Input.left = true;
      if (justPressed(15) || axREdge) Input.right = true;
      // Jump: A button or up D-pad
      if (justPressed(0) || (upEdge && !axV)) Input.jumpQueued = true;
      // Start = pause
      if (justPressed(9)) Game.togglePause();
    } else {
      // Menu / overlay navigation
      if (justPressed(9) && gameActive) {
        // Start during overlays - resume or restart
        const pauseOv = document.getElementById('overlay-pause');
        const overOv = document.getElementById('overlay-gameover');
        if (pauseOv.classList.contains('active')) Game.togglePause();
        else if (overOv.classList.contains('active')) Game.restart();
      } else {
        if (upEdge) moveMenuFocus(-1);
        if (downEdge) moveMenuFocus(1);
        if (justPressed(0)) activateFocusedMenuButton();
        if (justPressed(1)) goBackInMenu();
      }
    }

    // Save state
    prev.btns = pad.buttons.map(b => (typeof b === 'object' ? b.pressed : b > 0.5));
    prev.axisLeft = axLNow;
    prev.axisRight = axRNow;
    prev._upHeld = upNow;
    prev._downHeld = downNowV;
  }

  function isConnected() { return connected; }

  return { tick, isConnected };
})();

function getActiveScreenButtons() {
  const active = document.querySelector('.screen.active');
  if (!active) return [];
  // Include any visible overlay buttons too
  const overlay = active.querySelector('.overlay.active');
  const root = overlay || active;
  return Array.from(root.querySelectorAll('button')).filter(b => {
    return !b.disabled && b.offsetParent !== null;
  });
}

function moveMenuFocus(dir) {
  const buttons = getActiveScreenButtons();
  if (!buttons.length) return;
  const current = document.activeElement;
  let idx = buttons.indexOf(current);
  if (idx === -1) idx = 0;
  else idx = (idx + dir + buttons.length) % buttons.length;
  buttons[idx].focus();
}

function activateFocusedMenuButton() {
  let target = document.activeElement;
  const buttons = getActiveScreenButtons();
  if (!buttons.includes(target)) target = buttons[0];
  if (target) target.click();
}

function goBackInMenu() {
  // Try to find a "Back" or "Menu" button
  const buttons = getActiveScreenButtons();
  const back = buttons.find(b =>
    /back|menu|resume/i.test(b.textContent.trim())
  );
  if (back) back.click();
}

// ---------- Touch ----------
const Touch = (() => {
  let used = false;
  let startX = 0, startY = 0, startTime = 0;
  const SWIPE_MIN = 40;        // px
  const TAP_MAX_MS = 250;
  const TAP_MAX_DIST = 20;

  function showOnScreenControls() {
    if (used) return;
    used = true;
    document.body.classList.add('touch-active');
  }

  // Swipe detection on the canvas only (so menu buttons handle their own taps)
  canvas.addEventListener('touchstart', (e) => {
    showOnScreenControls();
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    startTime = performance.now();
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = performance.now() - startTime;
    const absX = Math.abs(dx), absY = Math.abs(dy);

    if (absX < TAP_MAX_DIST && absY < TAP_MAX_DIST && dt < TAP_MAX_MS) {
      // Tap = jump
      Input.jumpQueued = true;
    } else if (absX > absY && absX > SWIPE_MIN) {
      if (dx > 0) Input.right = true;
      else Input.left = true;
    } else if (absY > absX && absY > SWIPE_MIN) {
      if (dy < 0) Input.jumpQueued = true; // swipe up = jump
    }
    e.preventDefault();
  }, { passive: false });

  // On-screen buttons (also work with mouse so they're testable on desktop)
  function wireBtn(id, action) {
    const el = document.getElementById(id);
    if (!el) return;
    const fire = (e) => {
      e.preventDefault();
      showOnScreenControls();
      action();
    };
    el.addEventListener('touchstart', fire, { passive: false });
    el.addEventListener('mousedown', fire);
  }

  wireBtn('touch-left', () => { Input.left = true; });
  wireBtn('touch-right', () => { Input.right = true; });
  wireBtn('touch-jump', () => { Input.jumpQueued = true; });

  // Detect touch capability at boot - if device looks touch-capable, show buttons proactively
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    showOnScreenControls();
  }

  return { showOnScreenControls };
})();

// ---------- Game ----------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;   // 1280
const H = canvas.height;  // 720

// Road occupies the central area
const ROAD_TOP = 220;
const ROAD_BOTTOM = H - 30;
const ROAD_LEFT = 360;
const ROAD_RIGHT = W - 360;
const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT;
const LANES = 4;
const LANE_WIDTH = ROAD_WIDTH / LANES;

function laneCenterX(laneIdx) {
  return ROAD_LEFT + LANE_WIDTH * (laneIdx + 0.5);
}

const DIFF_PRESETS = {
  easy:   { baseSpeed: 240, accel: 4,   spawnBase: 1.1, spawnMin: 0.55, coinMul: 1.2 },
  normal: { baseSpeed: 320, accel: 7,   spawnBase: 0.85, spawnMin: 0.38, coinMul: 1.0 },
  hard:   { baseSpeed: 420, accel: 10,  spawnBase: 0.65, spawnMin: 0.28, coinMul: 0.85 }
};

const Game = (() => {
  let state = 'idle'; // idle | playing | paused | over
  let lastTime = 0;
  let rafId = null;

  // World
  let speed = 0;
  let baseSpeed = 320;
  let elapsed = 0;
  let score = 0;
  let coins = 0;
  let spawnTimer = 0;
  let nextSpawn = 1.0;
  let lineOffset = 0;
  let buildingOffset = 0;

  // Player
  const player = {
    x: 0,
    y: 0,
    w: 50,
    h: 70,
    vy: 0,
    onGround: true,
    targetLane: 1,
    jumpFrames: 0,
    runFrame: 0,
    runTimer: 0
  };

  // Entities
  let obstacles = []; // {x,y,w,h,type,lane,jumpable}
  let pickups = [];   // {x,y,r,spin}
  let particles = []; // {x,y,vx,vy,life,color}

  let preset = DIFF_PRESETS.normal;

  function start() {
    preset = DIFF_PRESETS[save.difficulty] || DIFF_PRESETS.normal;
    state = 'playing';
    score = 0;
    coins = 0;
    elapsed = 0;
    speed = preset.baseSpeed;
    baseSpeed = preset.baseSpeed;
    spawnTimer = 0;
    nextSpawn = preset.spawnBase;
    lineOffset = 0;
    buildingOffset = 0;
    obstacles = [];
    pickups = [];
    particles = [];

    player.targetLane = 1;
    player.x = laneCenterX(player.targetLane);
    player.y = ROAD_BOTTOM - player.h / 2;
    player.vy = 0;
    player.onGround = true;
    player.jumpFrames = 0;
    player.runTimer = 0;
    player.runFrame = 0;

    document.getElementById('overlay-pause').classList.remove('active');
    document.getElementById('overlay-gameover').classList.remove('active');
    updateHUD();

    Audio.unlock();
    if (save.music) Audio.startMusic();

    lastTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function restart() {
    start();
  }

  function returnToMenu() {
    state = 'idle';
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    Audio.stopMusic();
    document.getElementById('overlay-pause').classList.remove('active');
    document.getElementById('overlay-gameover').classList.remove('active');
    showScreen('menu');
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      document.getElementById('overlay-pause').classList.add('active');
    } else if (state === 'paused') {
      state = 'playing';
      document.getElementById('overlay-pause').classList.remove('active');
      lastTime = performance.now();
      if (!rafId) rafId = requestAnimationFrame(loop);
    }
  }

  function gameOver() {
    if (state === 'over') return;
    state = 'over';
    Audio.crash();
    Audio.stopMusic();
    save.totalCoins += coins;
    let newBest = false;
    if (score > save.bestScore) {
      save.bestScore = score;
      newBest = true;
    }
    persistSave(save);
    document.getElementById('result-score').textContent = score;
    document.getElementById('result-coins').textContent = coins;
    document.getElementById('result-newbest').hidden = !newBest;
    document.getElementById('overlay-gameover').classList.add('active');
  }

  function updateHUD() {
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-coins').textContent = coins;
    document.getElementById('hud-best').textContent = save.bestScore;
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    Gamepad.tick();

    if (state === 'playing') {
      update(dt);
    }
    render();
  }

  function update(dt) {
    elapsed += dt;
    speed = baseSpeed + elapsed * preset.accel;
    score += Math.floor(speed * dt * 0.1);
    updateHUD();

    // Player horizontal
    if (Input.left) {
      Input.left = false; // step-based
      if (player.targetLane > 0) player.targetLane--;
    }
    if (Input.right) {
      Input.right = false;
      if (player.targetLane < LANES - 1) player.targetLane++;
    }

    const targetX = laneCenterX(player.targetLane);
    player.x += (targetX - player.x) * Math.min(1, dt * 14);

    // Jump
    if (Input.jumpQueued) {
      Input.jumpQueued = false;
      if (player.onGround) {
        player.vy = -780;
        player.onGround = false;
        player.jumpFrames = 1;
        Audio.jump();
      }
    }

    // Gravity
    if (!player.onGround) {
      player.vy += 2000 * dt;
      player.y += player.vy * dt;
      const groundY = ROAD_BOTTOM - player.h / 2;
      if (player.y >= groundY) {
        player.y = groundY;
        player.vy = 0;
        player.onGround = true;
        player.jumpFrames = 0;
      }
    }

    // Run animation
    if (player.onGround) {
      player.runTimer += dt;
      if (player.runTimer > 0.08) {
        player.runTimer = 0;
        player.runFrame = (player.runFrame + 1) % 4;
      }
    }

    // Lines and background scroll
    lineOffset = (lineOffset + speed * dt) % 80;
    buildingOffset = (buildingOffset + speed * dt * 0.25) % 200;

    // Spawning
    spawnTimer += dt;
    if (spawnTimer >= nextSpawn) {
      spawnTimer = 0;
      const spawnRange = preset.spawnBase - preset.spawnMin;
      const t = Math.min(1, elapsed / 60);
      nextSpawn = preset.spawnBase - spawnRange * t + (Math.random() * 0.2 - 0.1);
      spawnEntity();
    }

    // Move entities
    const moveDy = speed * dt;
    for (const o of obstacles) o.y += moveDy;
    for (const p of pickups) {
      p.y += moveDy;
      p.spin += dt * 6;
    }
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
      p.life -= dt;
    }

    // Remove offscreen
    obstacles = obstacles.filter(o => o.y - o.h / 2 < H + 40);
    pickups = pickups.filter(p => p.y - p.r < H + 40);
    particles = particles.filter(p => p.life > 0);

    // Collisions
    const pl = playerRect();
    // Coins
    for (let i = pickups.length - 1; i >= 0; i--) {
      const c = pickups[i];
      // 2D distance to player rect center, with bias on jumps - coins float higher
      if (rectCircleHit(pl, c)) {
        pickups.splice(i, 1);
        coins++;
        score += 25;
        Audio.coin();
        for (let k = 0; k < 8; k++) {
          particles.push({
            x: c.x, y: c.y,
            vx: (Math.random() - 0.5) * 240,
            vy: -Math.random() * 200 - 50,
            life: 0.5 + Math.random() * 0.3,
            color: '#ffd84a'
          });
        }
        updateHUD();
      }
    }
    // Obstacles
    for (const o of obstacles) {
      if (o.jumpable && !player.onGround && player.y < ROAD_BOTTOM - player.h / 2 - 25) {
        // jumping clears jumpable obstacles
        continue;
      }
      if (rectsOverlap(pl, obstacleRect(o))) {
        gameOver();
        return;
      }
    }
  }

  function playerRect() {
    // Slightly smaller hitbox than visual
    return {
      x: player.x - player.w / 2 + 6,
      y: player.y - player.h / 2 + 4,
      w: player.w - 12,
      h: player.h - 8
    };
  }

  function obstacleRect(o) {
    return { x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h };
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function rectCircleHit(rect, c) {
    const cx = Math.max(rect.x, Math.min(c.x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
    const dx = c.x - cx;
    const dy = c.y - cy;
    return dx * dx + dy * dy < c.r * c.r;
  }

  function spawnEntity() {
    const roll = Math.random();
    if (roll < 0.42) {
      // coin row
      spawnCoinRow();
    } else if (roll < 0.66) {
      spawnCone();
    } else if (roll < 0.82) {
      spawnTrashCan();
    } else if (roll < 0.95) {
      spawnCar();
    } else {
      spawnRoadblock();
    }
  }

  function spawnCoinRow() {
    const lane = Math.floor(Math.random() * LANES);
    const count = 3 + Math.floor(Math.random() * 3);
    const startY = -20;
    for (let i = 0; i < count; i++) {
      pickups.push({
        x: laneCenterX(lane),
        y: startY - i * 60,
        r: 16,
        spin: Math.random() * Math.PI * 2
      });
    }
  }

  function spawnCone() {
    const lane = Math.floor(Math.random() * LANES);
    obstacles.push({
      x: laneCenterX(lane), y: -50,
      w: 40, h: 50,
      type: 'cone', lane,
      jumpable: true
    });
  }

  function spawnTrashCan() {
    const lane = Math.floor(Math.random() * LANES);
    obstacles.push({
      x: laneCenterX(lane), y: -60,
      w: 54, h: 70,
      type: 'trashcan', lane,
      jumpable: true
    });
  }

  function spawnCar() {
    const lane = Math.floor(Math.random() * LANES);
    obstacles.push({
      x: laneCenterX(lane), y: -120,
      w: LANE_WIDTH * 0.7, h: 140,
      type: 'car', lane,
      jumpable: false,
      color: pickCarColor()
    });
  }

  function spawnRoadblock() {
    // Roadblock blocks 2 lanes
    const startLane = Math.floor(Math.random() * (LANES - 1));
    obstacles.push({
      x: (laneCenterX(startLane) + laneCenterX(startLane + 1)) / 2,
      y: -50,
      w: LANE_WIDTH * 1.9, h: 32,
      type: 'roadblock', lane: startLane,
      jumpable: false
    });
  }

  function pickCarColor() {
    const colors = ['#d24a3a', '#3a8ad2', '#3ad27a', '#d2c93a', '#9a3ad2', '#d23a8a', '#3ad2c5'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ---------- Rendering ----------
  function render() {
    // Sky / city background
    drawSkyAndCity();
    // Road
    drawRoad();
    // Coins (behind player drawn after obstacles if higher)
    for (const p of pickups) drawCoin(p);
    // Obstacles
    for (const o of obstacles) drawObstacle(o);
    // Player
    drawPlayer();
    // Particles
    for (const p of particles) drawParticle(p);
    // Foreground HUD elements (shadow already in DOM)
  }

  function drawSkyAndCity() {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    grad.addColorStop(0, '#1a1f3a');
    grad.addColorStop(0.5, '#3a2a5a');
    grad.addColorStop(1, '#6a3a5a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, ROAD_TOP);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 137) % W;
      const sy = (i * 53) % (ROAD_TOP - 40);
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Distant skyline
    drawSkyline(0.45, '#1a1830', 60, 120);
    drawSkyline(1.0, '#10141e', 90, 180);

    // Side sidewalks / buildings (left and right of road)
    drawSideBuildings();
  }

  function drawSkyline(parallax, color, baseH, varH) {
    ctx.fillStyle = color;
    const off = (buildingOffset * parallax) % 100;
    for (let x = -off; x < W + 100; x += 80) {
      const h = baseH + ((Math.sin(x * 0.07) + 1) * 0.5) * varH;
      ctx.fillRect(x, ROAD_TOP - h, 70, h);
      // windows
      ctx.fillStyle = 'rgba(255,220,100,0.35)';
      for (let wy = ROAD_TOP - h + 12; wy < ROAD_TOP - 10; wy += 14) {
        for (let wx = x + 6; wx < x + 64; wx += 14) {
          if ((wx + wy + Math.floor(x / 80)) % 3 !== 0) {
            ctx.fillRect(wx, wy, 4, 6);
          }
        }
      }
      ctx.fillStyle = color;
    }
  }

  function drawSideBuildings() {
    // Left strip
    ctx.fillStyle = '#0e1220';
    ctx.fillRect(0, ROAD_TOP, ROAD_LEFT, H - ROAD_TOP);
    ctx.fillRect(ROAD_RIGHT, ROAD_TOP, W - ROAD_RIGHT, H - ROAD_TOP);

    // Sidewalk
    ctx.fillStyle = '#3a3a48';
    ctx.fillRect(ROAD_LEFT - 30, ROAD_TOP, 30, H - ROAD_TOP);
    ctx.fillRect(ROAD_RIGHT, ROAD_TOP, 30, H - ROAD_TOP);

    // Sidewalk tile lines
    ctx.fillStyle = '#2a2a36';
    const tileOff = lineOffset % 40;
    for (let y = ROAD_TOP - tileOff; y < H; y += 40) {
      ctx.fillRect(ROAD_LEFT - 30, y, 30, 2);
      ctx.fillRect(ROAD_RIGHT, y, 30, 2);
    }

    // Streetlights
    drawStreetlight(ROAD_LEFT - 50, ROAD_TOP + ((-lineOffset * 2) % 240) + 80);
    drawStreetlight(ROAD_LEFT - 50, ROAD_TOP + ((-lineOffset * 2) % 240) + 320);
    drawStreetlight(ROAD_LEFT - 50, ROAD_TOP + ((-lineOffset * 2) % 240) + 560);
    drawStreetlight(ROAD_RIGHT + 50, ROAD_TOP + ((-lineOffset * 2 + 120) % 240) + 80, true);
    drawStreetlight(ROAD_RIGHT + 50, ROAD_TOP + ((-lineOffset * 2 + 120) % 240) + 320, true);
    drawStreetlight(ROAD_RIGHT + 50, ROAD_TOP + ((-lineOffset * 2 + 120) % 240) + 560, true);
  }

  function drawStreetlight(x, y, flip = false) {
    ctx.fillStyle = '#222230';
    ctx.fillRect(x - 3, y - 60, 6, 60);
    // Arm
    ctx.fillRect(flip ? x - 30 : x, y - 60, 30, 4);
    // Light
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.arc(flip ? x - 30 : x + 30, y - 56, 6, 0, Math.PI * 2);
    ctx.fill();
    // Light glow
    const r = ctx.createRadialGradient(flip ? x - 30 : x + 30, y - 56, 2, flip ? x - 30 : x + 30, y - 56, 50);
    r.addColorStop(0, 'rgba(255,216,74,0.4)');
    r.addColorStop(1, 'rgba(255,216,74,0)');
    ctx.fillStyle = r;
    ctx.beginPath();
    ctx.arc(flip ? x - 30 : x + 30, y - 56, 50, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRoad() {
    // Road surface
    ctx.fillStyle = '#1c1c24';
    ctx.fillRect(ROAD_LEFT, ROAD_TOP, ROAD_WIDTH, H - ROAD_TOP);

    // Edge lines
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(ROAD_LEFT, ROAD_TOP, 3, H - ROAD_TOP);
    ctx.fillRect(ROAD_RIGHT - 3, ROAD_TOP, 3, H - ROAD_TOP);

    // Lane divider dashes
    ctx.fillStyle = '#e8c84a';
    for (let i = 1; i < LANES; i++) {
      const x = ROAD_LEFT + LANE_WIDTH * i;
      const off = lineOffset;
      for (let y = ROAD_TOP - 80 + off; y < H; y += 80) {
        ctx.fillRect(x - 2, y, 4, 40);
      }
    }
  }

  function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const t = player.runFrame;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    const shadowScale = player.onGround ? 1 : 0.6;
    ctx.beginPath();
    ctx.ellipse(px, ROAD_BOTTOM - 6, 22 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (animated)
    ctx.fillStyle = '#2a3a8a';
    const legPhase = player.onGround ? Math.sin(t * Math.PI / 2) * 8 : 0;
    ctx.fillRect(px - 16, py + 10 - legPhase, 12, 24 + legPhase);
    ctx.fillRect(px + 4, py + 10 + legPhase, 12, 24 - legPhase);
    // Shoes
    ctx.fillStyle = '#222';
    ctx.fillRect(px - 18, py + 32 - legPhase, 16, 6);
    ctx.fillRect(px + 2, py + 32 + legPhase, 16, 6);

    // Body
    ctx.fillStyle = '#e54a4a';
    ctx.fillRect(px - 18, py - 18, 36, 32);

    // Arms (animated)
    ctx.fillStyle = '#e54a4a';
    const armPhase = player.onGround ? Math.sin(t * Math.PI / 2 + Math.PI) * 6 : -10;
    ctx.fillRect(px - 24, py - 14 + armPhase, 8, 20);
    ctx.fillRect(px + 16, py - 14 - armPhase, 8, 20);

    // Head
    ctx.fillStyle = '#f4c79a';
    ctx.fillRect(px - 12, py - 35, 24, 22);
    // Hat
    ctx.fillStyle = '#1f3a8a';
    ctx.fillRect(px - 14, py - 38, 28, 8);
    ctx.fillRect(px - 4, py - 42, 18, 5);
    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(px - 4, py - 25, 3, 3);
    ctx.fillRect(px + 4, py - 25, 3, 3);
  }

  function drawObstacle(o) {
    switch (o.type) {
      case 'cone': drawCone(o); break;
      case 'trashcan': drawTrashCan(o); break;
      case 'car': drawCar(o); break;
      case 'roadblock': drawRoadblock(o); break;
    }
  }

  function drawCone(o) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y + o.h / 2 - 2, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Base
    ctx.fillStyle = '#222';
    ctx.fillRect(o.x - 22, o.y + o.h / 2 - 6, 44, 6);
    // Cone body
    ctx.fillStyle = '#ff7733';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y - o.h / 2);
    ctx.lineTo(o.x - 18, o.y + o.h / 2 - 6);
    ctx.lineTo(o.x + 18, o.y + o.h / 2 - 6);
    ctx.closePath();
    ctx.fill();
    // White stripes
    ctx.fillStyle = '#fff';
    ctx.fillRect(o.x - 14, o.y - 4, 28, 4);
    ctx.fillRect(o.x - 10, o.y - 16, 20, 4);
  }

  function drawTrashCan(o) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y + o.h / 2, 24, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#4a4a55';
    ctx.fillRect(o.x - 22, o.y - o.h / 2 + 6, 44, o.h - 10);
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(o.x - 22, o.y - o.h / 2 + 6, 44, 4);
    // Ridges
    ctx.fillStyle = '#2a2a32';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(o.x - 22, o.y - o.h / 2 + 18 + i * 12, 44, 2);
    }
    // Lid
    ctx.fillStyle = '#5a5a66';
    ctx.fillRect(o.x - 26, o.y - o.h / 2, 52, 8);
    ctx.fillStyle = '#7a7a88';
    ctx.fillRect(o.x - 4, o.y - o.h / 2 - 4, 8, 5);
  }

  function drawCar(o) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y + o.h / 2, o.w / 2 - 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const w = o.w, h = o.h, x = o.x, y = o.y;
    // Car coming TOWARD player (driving up the screen toward us from above)
    // Body
    ctx.fillStyle = o.color || '#d24a3a';
    ctx.fillRect(x - w / 2 + 4, y - h / 2 + 10, w - 8, h - 16);
    // Hood/Trunk darker
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x - w / 2 + 4, y - h / 2 + 10, w - 8, 14);
    ctx.fillRect(x - w / 2 + 4, y + h / 2 - 20, w - 8, 10);
    // Windshield
    ctx.fillStyle = '#a8d0e8';
    ctx.fillRect(x - w / 2 + 12, y - h / 2 + 28, w - 24, 26);
    // Rear window
    ctx.fillStyle = '#8aa8c0';
    ctx.fillRect(x - w / 2 + 12, y + h / 2 - 40, w - 24, 16);
    // Roof
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x - w / 2 + 16, y - 6, w - 32, 12);
    // Wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(x - w / 2 - 2, y - h / 2 + 18, 8, 22);
    ctx.fillRect(x + w / 2 - 6, y - h / 2 + 18, 8, 22);
    ctx.fillRect(x - w / 2 - 2, y + h / 2 - 40, 8, 22);
    ctx.fillRect(x + w / 2 - 6, y + h / 2 - 40, 8, 22);
    // Headlights (top because car driving toward viewer)
    ctx.fillStyle = '#fff7a8';
    ctx.fillRect(x - w / 2 + 6, y - h / 2 + 6, 12, 6);
    ctx.fillRect(x + w / 2 - 18, y - h / 2 + 6, 12, 6);
    // Taillights
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(x - w / 2 + 6, y + h / 2 - 12, 12, 5);
    ctx.fillRect(x + w / 2 - 18, y + h / 2 - 12, 12, 5);
  }

  function drawRoadblock(o) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y + o.h / 2 + 2, o.w / 2 - 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bar
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
    // Red stripes
    ctx.fillStyle = '#e54a3a';
    const stripeW = 24;
    for (let i = 0; i < o.w; i += stripeW * 2) {
      ctx.fillRect(o.x - o.w / 2 + i, o.y - o.h / 2, stripeW, o.h);
    }
    // Posts
    ctx.fillStyle = '#222';
    ctx.fillRect(o.x - o.w / 2 - 6, o.y - o.h / 2, 6, o.h + 4);
    ctx.fillRect(o.x + o.w / 2, o.y - o.h / 2, 6, o.h + 4);
  }

  function drawCoin(p) {
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + p.r + 6, p.r * 0.8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const widthScale = Math.abs(Math.cos(p.spin));
    // outer
    ctx.fillStyle = '#b58a00';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r * widthScale, p.r, 0, 0, Math.PI * 2);
    ctx.fill();
    // inner
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r * widthScale * 0.78, p.r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    // dollar sign
    if (widthScale > 0.3) {
      ctx.fillStyle = '#b58a00';
      ctx.font = `bold ${Math.floor(p.r * 1.2)}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', p.x, p.y + 1);
    }
  }

  function drawParticle(p) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    ctx.globalAlpha = 1;
  }

  return { start, restart, returnToMenu, togglePause };
})();

// ---------- Init ----------
refreshSettingsUI();
showScreen('menu');

// Always-on gamepad poller (runs in addition to in-game loop on menu screens).
// Game loop also calls Gamepad.tick() during gameplay, which is fine —
// tick() is idempotent given its own prev-state, and only the game-loop call
// triggers when a game frame is rendering. The standalone poller covers menus.
(function menuGamepadLoop() {
  if (!screens.game.classList.contains('active')) {
    Gamepad.tick();
  }
  requestAnimationFrame(menuGamepadLoop);
})();

// Resize canvas to fit window while preserving aspect
function resizeCanvas() {
  const aspect = W / H;
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  let cw = ww, ch = wh;
  if (ww / wh > aspect) {
    cw = wh * aspect;
    ch = wh;
  } else {
    cw = ww;
    ch = ww / aspect;
  }
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
