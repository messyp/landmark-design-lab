(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const ui = {
    score: document.getElementById('score'),
    weapon: document.getElementById('weapon'),
    health: document.getElementById('health'),
    intro: document.getElementById('introScreen'),
    gameOver: document.getElementById('gameOver'),
    finalScore: document.querySelector('#gameOver .final-score'),
    bestScore: document.querySelector('#gameOver .best-score'),
    startButton: document.getElementById('startButton'),
    restartButton: document.getElementById('restartButton'),
  };

  const keys = {};
  const pointer = { active: false, x: 0, y: 0 };

  const weaponNames = ['Pulse Blaster', 'Twin Vulcan', 'Nova Spread', 'Ion Lance'];

  const state = {
    gameState: 'intro',
    score: 0,
    bestScore: 0,
    time: 0,
    spawnTimer: 0,
    spawnInterval: 1.3,
    difficulty: 1,
    waveLevel: 1,
  };

  const player = {
    x: canvas.width / 2,
    y: canvas.height - 54,
    w: 16,
    h: 18,
    speed: 115,
    hp: 100,
    maxHp: 100,
    fireCooldown: 0,
    weaponLevel: 0,
    invincible: 0,
  };

  const bullets = [];
  const enemies = [];
  const enemyBullets = [];
  const particles = [];
  const powerUps = [];
  const announcements = [];
  const stars = [];

  class SoundManager {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicInterval = null;
      this.musicStep = 0;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.3;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playLaser() {
      if (!this.enabled) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.2);
    }

    playEnemyLaser() {
      if (!this.enabled) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.25);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.3);
    }

    playExplosion() {
      if (!this.enabled) return;
      this.init();
      const now = this.ctx.currentTime;
      const noise = this.createNoiseBuffer();
      const source = this.ctx.createBufferSource();
      source.buffer = noise;
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.4);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(now);
      source.stop(now + 0.5);
    }

    createNoiseBuffer() {
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      return buffer;
    }

    startMusic() {
      if (!this.enabled) return;
      this.init();
      if (this.musicInterval) return;
      this.musicStep = 0;
      const tempo = 112;
      const stepDuration = 60 / tempo / 2; // eighth notes
      this.musicInterval = setInterval(() => {
        this.playMusicStep(stepDuration);
      }, stepDuration * 1000);
    }

    playMusicStep(stepDuration) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const sequence = [0, 5, 3, 7, 10, 7, 5, 3, 0, 3, 5, 7, 8, 7, 5, 3];
      const bassSequence = [0, -5, -7, -5];
      const baseFreq = 220;
      const step = sequence[this.musicStep % sequence.length];
      const freq = baseFreq * Math.pow(2, step / 12);
      this.triggerNote(freq, stepDuration * 0.8, 0.15, 'square');
      if (this.musicStep % 2 === 0) {
        const bass = bassSequence[(this.musicStep / 2) % bassSequence.length];
        const bassFreq = baseFreq * Math.pow(2, bass / 12);
        this.triggerNote(bassFreq, stepDuration * 1.6, 0.08, 'triangle');
      }
      if (this.musicStep % 4 === 0) {
        const harmony = baseFreq * Math.pow(2, (step + 7) / 12);
        this.triggerNote(harmony, stepDuration * 0.7, 0.05, 'sine');
      }
      this.musicStep++;
    }

    triggerNote(freq, duration, gainValue, type) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(gainValue, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    }

    stopMusic() {
      if (this.musicInterval) {
        clearInterval(this.musicInterval);
        this.musicInterval = null;
      }
    }
  }

  const sound = new SoundManager();

  function createSprite(pattern, palette) {
    return {
      pattern,
      palette,
      w: pattern[0].length,
      h: pattern.length,
    };
  }

  function drawSprite(ctx, sprite, x, y, scale = 1, options = {}) {
    const { pattern, palette } = sprite;
    const offsetX = Math.round(x - (sprite.w * scale) / 2 + (options.offsetX || 0));
    const offsetY = Math.round(y - (sprite.h * scale) / 2 + (options.offsetY || 0));
    const overrides = options.paletteOverrides || {};
    for (let row = 0; row < pattern.length; row++) {
      const line = pattern[row];
      for (let col = 0; col < line.length; col++) {
        const char = line[col];
        if (char === '.' || char === ' ') continue;
        const color = overrides[char] || palette[char];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(offsetX + col * scale, offsetY + row * scale, scale, scale);
      }
    }
  }

  const sprites = {
    player: createSprite(
      [
        '.......44.......',
        '......3443......',
        '.....344443.....',
        '....34444443....',
        '...3444664443...',
        '..344466664443..',
        '..344466664443..',
        '.33444666644433.',
        '.333444666444333',
        '..333444444433..',
        '...3334444333...',
        '...2224444222...',
        '..222244442222..',
        '..227744447722..',
        '..277777777772..',
        '...7.77777.7...',
        '...7..777..7...',
        '....7.....7....',
      ],
      {
        '2': '#1d2545',
        '3': '#1aa0ff',
        '4': '#4bffdd',
        '6': '#ffec6a',
        '7': '#ff8a3d',
      }
    ),
    scout: createSprite(
      [
        '.....33.....',
        '....3333....',
        '...333333...',
        '..33377333..',
        '.3337777333.',
        '.3377777733.',
        '.3377667733.',
        '.3377667733.',
        '..33766733..',
        '..33366333..',
        '...333333...',
        '....3333....',
      ],
      {
        '3': '#ff3459',
        '6': '#ffd166',
        '7': '#ff6f91',
      }
    ),
    serpent: createSprite(
      [
        '.....22.....',
        '....2272....',
        '...227772...',
        '..22777772..',
        '.2277777772.',
        '.2777727772.',
        '.2777227772.',
        '..27722272..',
        '...272227...',
        '....7227....',
        '.....77.....',
      ],
      {
        '2': '#49f5ff',
        '7': '#75fb6f',
      }
    ),
    brute: createSprite(
      [
        '....55.....55....',
        '...5555...5555...',
        '..555755.557555..',
        '.555775555577555.',
        '.557777777777755.',
        '.557776666677755.',
        '.557766666667755.',
        '..5576666666755..',
        '..5556666666555..',
        '...55666666655...',
        '....556666655....',
        '.....5566655.....',
        '......55555......',
      ],
      {
        '5': '#5b5dff',
        '6': '#8c9bff',
        '7': '#ff4ecd',
      }
    ),
    wraith: createSprite(
      [
        '.....88.....',
        '....8668....',
        '...866668...',
        '..86688668..',
        '.8668888668.',
        '.8688888868.',
        '.8688668868.',
        '.8688668868.',
        '..86688668..',
        '..86666668..',
        '...866668...',
        '....8668....',
        '.....88.....',
      ],
      {
        '6': '#6c5ce7',
        '8': '#b892ff',
      }
    ),
    core: createSprite(
      [
        '....33....',
        '...3663...',
        '..366663..',
        '.36688663.',
        '.36899863.',
        '.36688663.',
        '..366663..',
        '...3663...',
        '....33....',
      ],
      {
        '3': '#45f4ff',
        '6': '#2ec4b6',
        '8': '#ff9f1c',
        '9': '#ffe66d',
      }
    ),
    kit: createSprite(
      [
        '....44....',
        '...4774...',
        '..477774..',
        '.47799774.',
        '.479bb974.',
        '.47799774.',
        '..477774..',
        '...4774...',
        '....44....',
      ],
      {
        '4': '#ffffff',
        '7': '#78ffd6',
        '9': '#6eff94',
        'b': '#2dd881',
      }
    ),
  };

  function initStars() {
    stars.length = 0;
    for (let i = 0; i < 140; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: 18 + Math.random() * 60,
        size: Math.random() < 0.2 ? 2 : 1,
        hue: 180 + Math.random() * 120,
      });
    }
  }

  initStars();

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space', 'Spacebar'].includes(e.key)) {
      e.preventDefault();
    }
    keys[e.key.toLowerCase()] = true;
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    pointer.active = true;
    pointer.x = e.offsetX * (canvas.width / canvas.clientWidth);
    pointer.y = e.offsetY * (canvas.height / canvas.clientHeight);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointer.active) return;
    pointer.x = e.offsetX * (canvas.width / canvas.clientWidth);
    pointer.y = e.offsetY * (canvas.height / canvas.clientHeight);
  });

  window.addEventListener('pointerup', () => {
    pointer.active = false;
  });

  ui.startButton.addEventListener('click', () => {
    startGame();
    sound.startMusic();
  });

  ui.restartButton.addEventListener('click', () => {
    startGame();
  });

  function startGame() {
    state.gameState = 'playing';
    state.score = 0;
    state.time = 0;
    state.spawnTimer = 0;
    state.spawnInterval = 1.2;
    state.difficulty = 1;
    state.waveLevel = 1;
    player.x = canvas.width / 2;
    player.y = canvas.height - 54;
    player.hp = player.maxHp;
    player.weaponLevel = 0;
    player.fireCooldown = 0;
    player.invincible = 1.5;
    bullets.length = 0;
    enemies.length = 0;
    enemyBullets.length = 0;
    powerUps.length = 0;
    particles.length = 0;
    announcements.length = 0;
    ui.intro.classList.remove('visible');
    ui.gameOver.classList.remove('visible');
  }

  function showGameOver() {
    state.gameState = 'gameover';
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
    }
    ui.finalScore.textContent = `Score: ${state.score}`;
    ui.bestScore.textContent = `Best: ${state.bestScore}`;
    ui.gameOver.classList.add('visible');
  }

  function updatePlayer(dt) {
    if (state.gameState !== 'playing') return;
    let moveX = 0;
    let moveY = 0;
    if (keys['arrowleft'] || keys['a']) moveX -= 1;
    if (keys['arrowright'] || keys['d']) moveX += 1;
    if (keys['arrowup'] || keys['w']) moveY -= 1;
    if (keys['arrowdown'] || keys['s']) moveY += 1;
    if (pointer.active) {
      const dx = pointer.x - player.x;
      const dy = pointer.y - player.y;
      player.x += dx * 0.12;
      player.y += dy * 0.12;
    } else {
      if (moveX && moveY) {
        const inv = 1 / Math.sqrt(2);
        moveX *= inv;
        moveY *= inv;
      }
      player.x += moveX * player.speed * dt;
      player.y += moveY * player.speed * dt;
    }

    player.x = Math.max(player.w / 2 + 4, Math.min(canvas.width - player.w / 2 - 4, player.x));
    player.y = Math.max(player.h / 2 + 8, Math.min(canvas.height - player.h / 2 - 4, player.y));

    if (player.fireCooldown > 0) {
      player.fireCooldown -= dt;
    }

    const firePressed = keys[' '] || keys['space'] || keys['spacebar'] || keys['z'];
    if (firePressed && player.fireCooldown <= 0) {
      fireWeapon();
    }

    if (player.invincible > 0) {
      player.invincible -= dt;
    }
  }

  function fireWeapon() {
    const level = player.weaponLevel;
    const baseCooldown = [0.26, 0.22, 0.2, 0.16][level] || 0.26;
    player.fireCooldown = baseCooldown;
    const color = ['#f6f490', '#8ef9f3', '#ffadad', '#bff25c'][level] || '#f6f490';
    const damage = [4, 5, 6, 8][level] || 4;
    sound.playLaser();
    if (level === 0) {
      bullets.push(createBullet(player.x, player.y - 12, 0, -220, 4, damage, color));
    } else if (level === 1) {
      bullets.push(createBullet(player.x - 6, player.y - 10, -20, -220, 4, damage, color));
      bullets.push(createBullet(player.x + 6, player.y - 10, 20, -220, 4, damage, color));
    } else if (level === 2) {
      bullets.push(createBullet(player.x, player.y - 12, 0, -240, 4, damage, color));
      bullets.push(createBullet(player.x - 10, player.y - 8, -40, -210, 4, damage - 1, color));
      bullets.push(createBullet(player.x + 10, player.y - 8, 40, -210, 4, damage - 1, color));
    } else {
      bullets.push(createBullet(player.x - 4, player.y - 12, -12, -260, 5, damage, color));
      bullets.push(createBullet(player.x + 4, player.y - 12, 12, -260, 5, damage, color));
      bullets.push(createBullet(player.x, player.y - 16, 0, -280, 6, damage + 2, '#ffffff'));
    }
  }

  function createBullet(x, y, vx, vy, size, damage, color) {
    return { x, y, vx, vy, size, damage, color, life: 0 };
  }

  function spawnEnemy() {
    const roll = Math.random();
    let type = 'scout';
    if (state.waveLevel >= 2 && roll > 0.6) type = 'serpent';
    if (state.waveLevel >= 3 && roll > 0.78) type = 'brute';
    if (state.waveLevel >= 4 && roll > 0.9) type = 'wraith';
    const enemy = createEnemy(type);
    enemies.push(enemy);
  }

  function createEnemy(type) {
    let x = 20 + Math.random() * (canvas.width - 40);
    if (type === 'serpent' || type === 'wraith') {
      x = 40 + Math.random() * (canvas.width - 80);
    }
    if (type === 'brute') {
      x = 52 + Math.random() * (canvas.width - 104);
    }
    const base = {
      type,
      x,
      y: -20,
      vx: 0,
      vy: 30 + Math.random() * 20,
      fireCooldown: 1 + Math.random() * 1.5,
      timer: 0,
      sprite: sprites.scout,
      hp: 6,
      value: 70,
    };
    if (type === 'scout') {
      base.sprite = sprites.scout;
      base.hp = 6 + state.waveLevel;
      base.vy = 45 + state.difficulty * 4;
      base.value = 70 + state.waveLevel * 10;
    } else if (type === 'serpent') {
      base.sprite = sprites.serpent;
      base.hp = 10 + state.waveLevel * 2;
      base.vy = 30 + state.waveLevel * 3;
      base.waveSpeed = 2.5 + Math.random() * 0.5;
      base.waveAmplitude = 26 + state.waveLevel * 4;
      base.baseX = x;
      base.value = 120 + state.waveLevel * 15;
    } else if (type === 'brute') {
      base.sprite = sprites.brute;
      base.hp = 24 + state.waveLevel * 5;
      base.vy = 18 + state.waveLevel * 2;
      base.value = 260 + state.waveLevel * 30;
      base.fireCooldown = 1 + Math.random() * 0.5;
      base.armor = 0.8;
    } else if (type === 'wraith') {
      base.sprite = sprites.wraith;
      base.hp = 32 + state.waveLevel * 6;
      base.vy = 26;
      base.value = 320 + state.waveLevel * 45;
      base.phase = 0;
      base.fireCooldown = 1.8;
    }
    base.w = base.sprite.w;
    base.h = base.sprite.h;
    return base;
  }

  function spawnPowerUp(x, y) {
    const type = Math.random() < 0.65 ? 'weapon' : 'heal';
    const sprite = type === 'weapon' ? sprites.core : sprites.kit;
    powerUps.push({ x, y, vy: 30, type, sprite, timer: Math.random() * Math.PI * 2 });
  }

  function addScore(amount, x = player.x, y = player.y - 20) {
    state.score += amount;
    announcements.push({
      text: `+${amount}`,
      x,
      y,
      life: 0,
      duration: 0.8,
    });
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life += dt;
      if (b.y < -10 || b.y > canvas.height + 10 || b.x < -10 || b.x > canvas.width + 10) {
        bullets.splice(i, 1);
      }
    }
  }

  function updateEnemyBullets(dt) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life += dt;
      if (b.y > canvas.height + 20 || b.x < -20 || b.x > canvas.width + 20 || b.y < -20) {
        enemyBullets.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      enemy.timer += dt;
      if (enemy.type === 'scout') {
        enemy.y += enemy.vy * dt;
        if (enemy.timer > 1.4) {
          enemy.timer = 0;
          shootEnemyBullet(enemy, { speed: 90 + state.waveLevel * 8, spread: 20, quiet: true });
        }
      } else if (enemy.type === 'serpent') {
        enemy.y += enemy.vy * dt;
        enemy.waveAngle = (enemy.waveAngle || 0) + enemy.waveSpeed * dt;
        enemy.x = enemy.baseX + Math.sin(enemy.waveAngle) * enemy.waveAmplitude;
        if (enemy.timer > 1.3) {
          enemy.timer = 0;
          shootEnemyBullet(enemy, { speed: 110 + state.waveLevel * 6, aimed: true });
        }
      } else if (enemy.type === 'brute') {
        if (enemy.y < 90) {
          enemy.y += enemy.vy * dt;
        } else {
          enemy.x += Math.sin(enemy.timer * 0.8) * 28 * dt;
        }
        enemy.fireCooldown -= dt;
        if (enemy.fireCooldown <= 0) {
          enemy.fireCooldown = 0.8;
          shootEnemyBullet(enemy, { speed: 150, aimed: true, spread: 0, count: 3, arc: 0.25 });
        }
      } else if (enemy.type === 'wraith') {
        enemy.phase += dt;
        enemy.y += Math.sin(enemy.phase * 2) * 10 * dt + enemy.vy * dt;
        enemy.x += Math.cos(enemy.phase * 1.5) * 20 * dt;
        enemy.fireCooldown -= dt;
        if (enemy.fireCooldown <= 0) {
          enemy.fireCooldown = 1.6;
          shootEnemyBullet(enemy, { speed: 160, aimed: true, spiral: true });
        }
      }

      enemy.x = Math.max(16, Math.min(canvas.width - 16, enemy.x));

      if (enemy.y > canvas.height + 60) {
        enemies.splice(i, 1);
        continue;
      }
    }
  }

  function shootEnemyBullet(enemy, opts = {}) {
    const count = opts.count || (opts.spiral ? 6 : 1);
    if (!opts.quiet) {
      sound.playEnemyLaser();
    }
    for (let i = 0; i < count; i++) {
      let angle;
      if (opts.aimed) {
        angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        if (opts.arc) {
          const offset = opts.arc * (i - (count - 1) / 2);
          angle += offset;
        }
      } else if (opts.spiral) {
        angle = (enemy.timer * 4 + (i * (Math.PI * 2)) / count) % (Math.PI * 2);
      } else {
        angle = Math.PI / 2 + ((i - (count - 1) / 2) * (opts.spread || 0)) / 180;
      }
      const speed = opts.speed || 120;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      enemyBullets.push({
        x: enemy.x,
        y: enemy.y,
        vx,
        vy,
        size: 4,
        color: '#ff5f7a',
        damage: 18,
        life: 0,
      });
    }
  }

  function updatePowerUps(dt) {
    for (let i = powerUps.length - 1; i >= 0; i--) {
      const p = powerUps[i];
      p.timer += dt;
      p.y += p.vy * dt;
      p.x += Math.sin(p.timer * 3) * 10 * dt;
      if (p.y > canvas.height + 20) {
        powerUps.splice(i, 1);
        continue;
      }
      if (state.gameState === 'playing' && rectIntersect(player, p, 10)) {
        if (p.type === 'weapon') {
          if (player.weaponLevel < weaponNames.length - 1) {
            player.weaponLevel++;
            announcements.push({ text: weaponNames[player.weaponLevel], x: player.x, y: player.y - 30, life: 0, duration: 1.2 });
          } else {
            addScore(400, player.x, player.y - 24);
            announcements.push({ text: 'PLASMA BONUS', x: player.x, y: player.y - 30, life: 0, duration: 1 });
          }
        } else if (p.type === 'heal') {
          player.hp = Math.min(player.maxHp, player.hp + 30);
          announcements.push({ text: '+HULL', x: player.x, y: player.y - 30, life: 0, duration: 1 });
        }
        powerUps.splice(i, 1);
      }
    }
  }

  function rectIntersect(a, b, pad = 0) {
    const aw = a.w || a.size * 2;
    const ah = a.h || a.size * 2;
    const bw = b.w || (b.sprite ? b.sprite.w : b.size * 2);
    const bh = b.h || (b.sprite ? b.sprite.h : b.size * 2);
    return (
      Math.abs(a.x - b.x) * 2 < aw + bw - pad &&
      Math.abs(a.y - b.y) * 2 < ah + bh - pad
    );
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 18 * dt;
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function updateAnnouncements(dt) {
    for (let i = announcements.length - 1; i >= 0; i--) {
      const note = announcements[i];
      note.life += dt;
      note.y -= 20 * dt;
      if (note.life > note.duration) {
        announcements.splice(i, 1);
      }
    }
  }

  function updateStars(dt) {
    for (const star of stars) {
      star.y += star.speed * dt * (state.gameState === 'playing' ? 1.5 : 1);
      if (star.y > canvas.height) {
        star.y = -4;
        star.x = Math.random() * canvas.width;
        star.speed = 18 + Math.random() * 60;
        star.hue = 180 + Math.random() * 120;
      }
    }
  }

  function handleCollisions() {
    if (state.gameState !== 'playing') return;
    // player bullets vs enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      for (let j = bullets.length - 1; j >= 0; j--) {
        const bullet = bullets[j];
        if (rectIntersect(enemy, bullet)) {
          const appliedDamage = enemy.armor ? bullet.damage * enemy.armor : bullet.damage;
          enemy.hp -= appliedDamage;
          bullets.splice(j, 1);
          spawnSparks(bullet.x, bullet.y, enemy.sprite.palette);
          if (enemy.hp <= 0) {
            enemies.splice(i, 1);
            const score = enemy.value + Math.floor(state.waveLevel * 8);
            addScore(score, enemy.x, enemy.y - enemy.h / 2);
            spawnExplosion(enemy.x, enemy.y, enemy.sprite.palette);
            sound.playExplosion();
            if (Math.random() < 0.18 + state.waveLevel * 0.02) {
              spawnPowerUp(enemy.x, enemy.y);
            }
          }
          break;
        }
      }
    }

    // enemy bullets vs player
    if (player.invincible <= 0) {
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        if (rectIntersect(player, bullet)) {
          enemyBullets.splice(i, 1);
          player.hp -= 20;
          player.invincible = 1;
          spawnExplosion(player.x, player.y, sprites.player.palette);
          if (player.hp <= 0) {
            player.hp = 0;
            spawnExplosion(player.x, player.y, sprites.player.palette, 40);
            sound.playExplosion();
            showGameOver();
          }
        }
      }
    }

    // enemies vs player
    if (player.invincible <= 0) {
      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (rectIntersect(player, enemy, 4)) {
          enemies.splice(i, 1);
          player.hp -= 35;
          player.invincible = 1;
          spawnExplosion(enemy.x, enemy.y, enemy.sprite.palette);
          spawnExplosion(player.x, player.y, sprites.player.palette);
          sound.playExplosion();
          if (player.hp <= 0) {
            player.hp = 0;
            showGameOver();
          }
        }
      }
    }
  }

  function spawnExplosion(x, y, palette, count = 24) {
    const colors = Object.values(palette);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        color: colors[i % colors.length] || '#ffffff',
      });
    }
  }

  function spawnSparks(x, y, palette) {
    const colors = Object.values(palette);
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.3,
        color: colors[i % colors.length] || '#ffffff',
      });
    }
  }

  function updateUI() {
    ui.score.textContent = `Score: ${state.score.toString().padStart(6, '0')}`;
    ui.weapon.textContent = `Weapon: ${weaponNames[player.weaponLevel] || weaponNames[0]}`;
    const healthPercent = Math.max(0, Math.round((player.hp / player.maxHp) * 100));
    ui.health.textContent = `Hull: ${healthPercent}%`;
  }

  function drawBackground() {
    ctx.fillStyle = '#040409';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const star of stars) {
      const alpha = 0.4 + (star.size === 2 ? 0.4 : 0);
      ctx.fillStyle = `hsla(${star.hue}, 70%, 80%, ${alpha})`;
      ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
    }
  }

  function drawPlayer() {
    if (state.gameState === 'intro') {
      const bob = Math.sin(state.time * 2) * 3;
      drawSprite(ctx, sprites.player, player.x, player.y + bob, 1, {
        paletteOverrides: { '7': '#ffb347' },
      });
      return;
    }
    if (state.gameState === 'playing' || state.gameState === 'gameover') {
      const thrusterColor = player.fireCooldown < 0.1 ? '#ffe29a' : '#ffb347';
      drawSprite(ctx, sprites.player, player.x, player.y, 1, {
        paletteOverrides: { '7': thrusterColor },
      });
      if (player.invincible > 0 && state.gameState === 'playing') {
        ctx.strokeStyle = `rgba(120, 240, 255, ${0.35 + Math.sin(player.invincible * 20) * 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.w, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawBullets() {
    ctx.save();
    ctx.shadowBlur = 6;
    for (const bullet of bullets) {
      ctx.fillStyle = bullet.color;
      ctx.shadowColor = bullet.color;
      ctx.fillRect(Math.round(bullet.x - 1), Math.round(bullet.y - 6), 2 + bullet.size / 2, 6 + bullet.size);
    }
    ctx.restore();
  }

  function drawEnemyBullets() {
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff5f7a';
    ctx.fillStyle = '#ff5f7a';
    for (const bullet of enemyBullets) {
      ctx.fillRect(Math.round(bullet.x - 2), Math.round(bullet.y - 2), 4, 4);
    }
    ctx.restore();
  }

  function drawEnemies() {
    for (const enemy of enemies) {
      drawSprite(ctx, enemy.sprite, enemy.x, enemy.y, 1);
      if (enemy.type === 'brute') {
        const hpPercent = Math.max(0, enemy.hp / (24 + state.waveLevel * 5));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(enemy.x - 12, enemy.y - enemy.h / 2 - 6, 24, 3);
        ctx.fillStyle = '#7cf87c';
        ctx.fillRect(enemy.x - 12, enemy.y - enemy.h / 2 - 6, 24 * hpPercent, 3);
      }
    }
  }

  function drawPowerUps() {
    for (const power of powerUps) {
      drawSprite(ctx, power.sprite, power.x, power.y, 1);
    }
  }

  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      const alpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = `${hexToRgba(p.color, alpha)}`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.restore();
  }

  function drawAnnouncements() {
    ctx.save();
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (const note of announcements) {
      const alpha = Math.max(0, 1 - note.life / note.duration);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillText(note.text, Math.round(note.x), Math.round(note.y));
    }
    ctx.restore();
  }

  function hexToRgba(hex, alpha) {
    let parsed = hex.replace('#', '');
    if (parsed.length === 3) {
      parsed = parsed.split('').map((c) => c + c).join('');
    }
    const bigint = parseInt(parsed, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  let lastTime = 0;
  function loop(timestamp) {
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000 || 0);
    lastTime = timestamp;
    state.time += dt;

    updateStars(dt);

    if (state.gameState === 'playing') {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy();
        state.spawnInterval = Math.max(0.45, 1.3 - state.time * 0.02);
        state.spawnTimer = state.spawnInterval;
        state.waveLevel = 1 + Math.floor(state.time / 25);
      }
      state.difficulty = 1 + state.time * 0.06;
      updatePlayer(dt);
      updateBullets(dt);
      updateEnemyBullets(dt);
      updateEnemies(dt);
      updatePowerUps(dt);
      handleCollisions();
    } else {
      updatePlayer(dt * 0.6);
      updateBullets(dt);
      updateEnemyBullets(dt);
      updateEnemies(dt * 0.8);
      updatePowerUps(dt);
    }

    updateParticles(dt);
    updateAnnouncements(dt);
    updateUI();
    render();
    requestAnimationFrame(loop);
  }

  function render() {
    drawBackground();
    drawPowerUps();
    drawParticles();
    drawEnemies();
    drawEnemyBullets();
    drawBullets();
    drawPlayer();
    drawAnnouncements();
  }

  requestAnimationFrame(loop);

  // Kick off subtle idle animation
  setInterval(() => {
    if (state.gameState === 'intro') {
      state.time += 0.016;
    }
  }, 16);
})();
