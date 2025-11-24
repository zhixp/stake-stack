(function () {
  // === CONFIG ===
  const BOX_HEIGHT = 0.8;
  const ORIGINAL_SIZE = 4.5;
  // Smaller ZOOM => tighter framing (~35–40% closer than 18)
  const ZOOM = 11.5;
  const MOVE_AMPLITUDE = 6;
  const MOVE_SPEED = 0.9; // radians per second
  const PERFECTION_TOLERANCE = 0.1;
  const MAX_BPS = 3.0; // blocks per second (host also checks)
  const MIN_GAME_TIME_MS = 3500; // ignore ultra-fast sessions
  const CAMERA_LERP = 0.08;
  const CAMERA_JITTER_AMPLITUDE = 0.12;
  const PARTICLE_COUNT = 26;

  // === DOM ===
  const scoreEl = document.getElementById('score');
  const menuEl = document.getElementById('menu');
  const startBtn = document.getElementById('start-btn');

  // === STATE (PRIVATE) ===
  let scene, camera, renderer;
  let stack = [];
  let debris = [];
  let particles = [];

  let lastTime = 0;
  let animationFrameId = null;
  let gameEnded = false;
  let hue = 210;
  let combo = 0;

  let sessionToken = null;
  let sessionNonce = null;
  let sessionStartTime = null;
  let totalClicks = 0;

  // Sentinel state
  const lastClickOffsets = [];
  const lastClickTimes = [];
  let sentinelFlagged = false;
  let microJitterSeed = Math.random() * 1000;

  // === UTILS ===
  function parseQuery() {
    const qs = new URLSearchParams(window.location.search);
    sessionToken = qs.get('token') || null;
    sessionNonce = qs.get('nonce') || null;
  }

  function hslColor(h, s, l) {
    return new THREE.Color(`hsl(${h}, ${s}%, ${l}%)`);
  }

  function updateBackground() {
    // Flat pastel background, similar to Michal Zalobny's Stack Tower.
    const bg = "#dcb7b2"; // soft warm pink/beige
    document.body.style.background = bg;

    // Bright score for contrast on flat background
    scoreEl.style.color = "rgba(255, 255, 255, 0.9)";
  }

  function nowMs() {
    return performance.now();
  }

  // === CORE SETUP ===
  function init() {
    parseQuery();
    console.log('Game initialized. Token:', sessionToken, 'Nonce:', sessionNonce);

    scene = new THREE.Scene();

    const aspect = window.innerWidth / window.innerHeight;
    const d = ZOOM;
    camera = new THREE.OrthographicCamera(
      -d * aspect,
      d * aspect,
      d,
      -d,
      1,
      1000
    );

    // Isometric-ish view – flipped so the main face looks toward the player
    camera.position.set(-10, 20, -10);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('world').appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(20, 40, 20);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    // Subtle rim
    const rim = new THREE.DirectionalLight(0x66aaff, 0.35);
    rim.position.set(-30, 32, -14);
    scene.add(rim);

    window.addEventListener('resize', onResize);
    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('touchstart', handlePointer, { passive: false });
    window.addEventListener('keydown', handleKey);

    resetGame();
    lastTime = nowMs();
    animationFrameId = requestAnimationFrame(loop);
  }

  function resetGame() {
    // remove all meshes
    for (const item of stack) scene.remove(item.mesh);
    for (const d of debris) scene.remove(d.mesh);
    for (const p of particles) scene.remove(p.mesh);

    stack = [];
    debris = [];
    particles = [];
    gameEnded = false;
    hue = 210;
    combo = 0;
    scoreEl.textContent = '0';
    updateBackground();

    sentinelFlagged = false;
    lastClickOffsets.length = 0;
    lastClickTimes.length = 0;
    totalClicks = 0;
    microJitterSeed = Math.random() * 1000;
    sessionStartTime = nowMs();

    // Base layers
    addLayer(0, 0, ORIGINAL_SIZE, ORIGINAL_SIZE, null);
    addLayer(-12, 0, ORIGINAL_SIZE, ORIGINAL_SIZE, "x");

    // Reset camera roughly around base; follow logic will take over.
    camera.position.set(-10, 20, -10);
    camera.lookAt(0, 0, 0);

    // Start in "playing" state immediately so users see the moving block
    // without needing to click a separate START button.
    menuEl.style.display = 'none';
    menuEl.style.opacity = '0';
  }

  // === LAYERS & CUTTING (PURE MATH) ===

  function addLayer(x, z, width, depth, direction) {
    const y = stack.length * BOX_HEIGHT;
    const color = hslColor(hue, 60, 65);
    const geometry = new THREE.BoxGeometry(width, BOX_HEIGHT, depth);
    const material = new THREE.MeshLambertMaterial({
      color,
      emissive: hslColor(hue, 35, 35),
      emissiveIntensity: 0.12,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    stack.push({ mesh, width, depth, direction });
  }

  function spawnDebris(x, y, z, width, depth, color) {
    const geom = new THREE.BoxGeometry(width, BOX_HEIGHT, depth);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const velY = -0.05 - Math.random() * 0.12;
    const velX = (Math.random() - 0.5) * 0.14;
    const velZ = (Math.random() - 0.5) * 0.14;
    const angVel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.16,
      (Math.random() - 0.5) * 0.16,
      (Math.random() - 0.5) * 0.16
    );

    scene.add(mesh);
    debris.push({ mesh, velX, velY, velZ, angVel });
  }

  function spawnParticles(x, y, z, color) {
    // Disable particles entirely - just keep the flash effect for visual feedback
    // Particles were causing visual clutter
    
    document.body.classList.remove('flash');
    void document.body.offsetWidth;
    document.body.classList.add('flash');
  }

  function cutTopLayer() {
    if (stack.length < 2 || gameEnded) return;

    const top = stack[stack.length - 1];
    const prev = stack[stack.length - 2];
    const dir = top.direction;

    const delta = top.mesh.position[dir] - prev.mesh.position[dir];
    const size = dir === 'x' ? top.width : top.depth;
    const diff = Math.abs(delta);
    const overlap = size - diff;

    if (overlap <= 0) {
      return triggerGameOver();
    }

    const newWidth = dir === 'x' ? overlap : top.width;
    const newDepth = dir === 'z' ? overlap : top.depth;

    // Always cut; never snap physics (pure skill)
    top.width = newWidth;
    top.depth = newDepth;

    const scaleFactor = overlap / size;
    top.mesh.scale[dir] = scaleFactor;
    top.mesh.position[dir] -= delta / 2;

    // Debris piece
    const shift = (overlap / 2 + diff / 2) * Math.sign(delta);
    const debrisX = dir === 'x' ? top.mesh.position.x + shift : top.mesh.position.x;
    const debrisZ = dir === 'z' ? top.mesh.position.z + shift : top.mesh.position.z;
    const debrisWidth = dir === 'x' ? diff : newWidth;
    const debrisDepth = dir === 'z' ? diff : newDepth;

    if (debrisWidth > 0.03 && debrisDepth > 0.03) {
      spawnDebris(
        debrisX,
        top.mesh.position.y,
        debrisZ,
        debrisWidth,
        debrisDepth,
        top.mesh.material.color
      );
    }

    // Visual "perfect" reward only
    if (diff < PERFECTION_TOLERANCE) {
      combo++;
      spawnParticles(top.mesh.position.x, top.mesh.position.y, top.mesh.position.z, top.mesh.material.color);
    } else {
      combo = 0;
    }

    // New layer
    hue += 4;
    updateBackground();
    scoreEl.textContent = String(stack.length - 1);

    const nextDir = dir === 'x' ? 'z' : 'x';
    const spawnPos = -12;
    const nextX = nextDir === 'x' ? spawnPos : top.mesh.position.x;
    const nextZ = nextDir === 'z' ? spawnPos : top.mesh.position.z;

    addLayer(nextX, nextZ, newWidth, newDepth, nextDir);
  }

  function triggerGameOver() {
    if (gameEnded) return;
    gameEnded = true;

    const score = Math.max(0, stack.length - 2); // ignore flying top
    console.log('Game Over triggered! Score:', score, 'Stack length:', stack.length);
    console.log('Session token:', sessionToken, 'Sentinel flagged:', sentinelFlagged);

    // Shadow-ban: if Sentinel flagged, mislead or silently drop
    // sessionToken is required, but sessionNonce is optional for backward compatibility
    if (!sentinelFlagged && score > 0 && sessionToken) {
      const durationMs = nowMs() - sessionStartTime;
      console.log('Duration:', durationMs, 'ms, Min required:', MIN_GAME_TIME_MS);
      
      if (durationMs >= MIN_GAME_TIME_MS) {
        const payload = {
          type: 'GAME_OVER',
          score,
          token: sessionToken,
          ...(sessionNonce && { nonce: sessionNonce }),
          clicks: totalClicks,
          durationMs: Math.round(durationMs),
        };
        console.log('Sending payload:', payload);
        
        // targetOrigin can be narrowed in production to your React app origin
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, '*');
          console.log('PostMessage sent to parent');
        } else {
          // Fallback for debugging - log to console
          console.warn('No parent window! Game is not in iframe. Payload:', payload);
        }
      } else {
        console.warn('Game too short! Duration:', durationMs, 'ms <', MIN_GAME_TIME_MS, 'ms');
      }
    } else {
      // Log why score wasn't sent (for debugging)
      if (sentinelFlagged) console.warn('Score rejected: Sentinel flagged');
      if (score === 0) console.warn('Score is 0, not sending');
      if (!sessionToken) console.warn('No session token, score not sent');
    }

    // Small "fall" for last block
    const top = stack[stack.length - 1];
    spawnDebris(
      top.mesh.position.x,
      top.mesh.position.y,
      top.mesh.position.z,
      top.width,
      top.depth,
      top.mesh.material.color
    );
    scene.remove(top.mesh);
    stack.pop();

    // Show menu again
    menuEl.style.display = 'flex';
    requestAnimationFrame(() => {
      menuEl.style.opacity = '1';
    });
    document.querySelector('.title').textContent = 'GAME OVER';
    startBtn.textContent = 'RETRY';
  }

  // === SENTINEL ===
  function recordClick(e) {
    // Skip recording for keyboard events (no mouse position available)
    if (e.type === 'keydown' || !('clientX' in e) && !(e.touches && e.touches[0])) {
      return;
    }
    
    const isTouch = e.type === 'touchstart';
    const point = isTouch ? e.touches[0] : e;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    const dx = (point.clientX - cx) / window.innerWidth;
    const dy = (point.clientY - cy) / window.innerHeight;

    lastClickOffsets.push({ dx, dy });
    lastClickTimes.push(nowMs());
    if (lastClickOffsets.length > 5) lastClickOffsets.shift();
    if (lastClickTimes.length > 12) lastClickTimes.shift();

    totalClicks++;

    if (lastClickOffsets.length === 5) {
      const meanDx = lastClickOffsets.reduce((s, c) => s + c.dx, 0) / 5;
      const meanDy = lastClickOffsets.reduce((s, c) => s + c.dy, 0) / 5;
      let varDx = 0;
      let varDy = 0;
      for (const o of lastClickOffsets) {
        varDx += Math.pow(o.dx - meanDx, 2);
        varDy += Math.pow(o.dy - meanDy, 2);
      }
      varDx /= 5;
      varDy /= 5;

      if (varDx < 1e-8 && varDy < 1e-8) {
        sentinelFlagged = true;
      }
    }

    // Local speed check (host also checks independently)
    if (lastClickTimes.length >= 2) {
      const first = lastClickTimes[0];
      const last = lastClickTimes[lastClickTimes.length - 1];
      const dtSec = (last - first) / 1000;
      const localScore = Math.max(1, stack.length - 2);
      const bps = localScore / Math.max(dtSec, 0.001);
      if (bps > MAX_BPS) {
        sentinelFlagged = true;
      }
    }
  }

  // === INPUT HANDLERS ===
  function handlePointer(e) {
    e.preventDefault();
    if (menuEl.style.display !== 'none') return;

    recordClick(e);
    if (!gameEnded) {
      cutTopLayer();
    }
  }

  function handleKey(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      if (menuEl.style.display !== 'none') {
        startGame();
      } else if (!gameEnded) {
        // Don't record keyboard clicks for Sentinel (no mouse position available)
        // Keyboard input is still valid for gameplay
        cutTopLayer();
      }
    }
  }

  // === GAME CONTROL (EXPORTED ENTRY) ===
  function startGame() {
    document.querySelector('.title').textContent = 'STACK PRO';
    startBtn.textContent = 'START';
    menuEl.style.opacity = '0';
    setTimeout(() => {
      menuEl.style.display = 'none';
      resetGame();
    }, 150);
  }

  // Expose only startGame
  window.startGame = startGame;

  startBtn.addEventListener('click', () => {
    if (menuEl.style.display !== 'none') {
      menuEl.style.opacity = '0';
      setTimeout(() => {
        menuEl.style.display = 'none';
        resetGame();
      }, 150);
    }
  });

  // === MAIN LOOP ===
  function loop() {
    animationFrameId = requestAnimationFrame(loop);
    const t = nowMs();
    const dt = (t - lastTime) / 1000;
    lastTime = t;

    // Move active block
    if (!gameEnded && menuEl.style.display === 'none' && stack.length > 1) {
      const top = stack[stack.length - 1];
      const timeSeconds = t / 1000;
      const pos = Math.sin(timeSeconds * MOVE_SPEED) * MOVE_AMPLITUDE;

      if (top.direction === 'x') {
        top.mesh.position.x = pos;
      } else if (top.direction === 'z') {
        top.mesh.position.z = pos;
      }
    }

    // Debris motion
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.mesh.position.x += d.velX;
      d.mesh.position.y += d.velY;
      d.mesh.position.z += d.velZ;
      d.velY -= 0.004;
      d.mesh.rotation.x += d.angVel.x;
      d.mesh.rotation.y += d.angVel.y;
      d.mesh.rotation.z += d.angVel.z;

      if (d.mesh.position.y < -20) {
        scene.remove(d.mesh);
        debris.splice(i, 1);
      }
    }

    // Particles - fade out much faster for cleaner look
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= 0.12; // Fade 3x faster
      p.mesh.position.x += p.velX;
      p.mesh.position.y += p.velY;
      p.mesh.position.z += p.velZ;
      p.velY -= 0.015; // Slightly stronger gravity
      p.velX *= 0.98; // Air resistance
      p.velZ *= 0.98;
      p.mesh.rotation.x += 0.12;
      p.mesh.rotation.y += 0.12;
      p.mesh.scale.multiplyScalar(0.92); // Shrink faster
      
      // Update opacity based on life
      if (p.mesh.material.transparent) {
        p.mesh.material.opacity = p.life * 0.6; // Fade out smoothly
      }
      
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        p.mesh.geometry.dispose();
        particles.splice(i, 1);
      }
    }

    // Camera follow + micro jitter
    if (!gameEnded && stack.length > 0) {
      // Focus on the top block so the base can drift off screen and
      // the player always sees the active slice clearly below the score.
      const top = stack[stack.length - 1];
      const focusY = top.mesh.position.y; // center of the top block

      // Keep the camera a bit above the focus point so the base sits lower.
      const desiredY = focusY + 6; // tweak this offset to taste
      camera.position.y += (desiredY - camera.position.y) * CAMERA_LERP;

      const jitterT = t * 0.001 + microJitterSeed;
      const jx = Math.sin(jitterT * 1.7) * CAMERA_JITTER_AMPLITUDE;
      const jz = Math.cos(jitterT * 1.3) * CAMERA_JITTER_AMPLITUDE;
      camera.position.x = -10 + jx;
      camera.position.z = -10 + jz;
      camera.lookAt(0, focusY, 0);
    }

    renderer.render(scene, camera);
  }

  function onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const d = ZOOM;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // === BOOT ===
  function boot() {
    try {
      init();
    } catch (e) {
      console.error('Game init error', e);
      if (scoreEl) {
        scoreEl.textContent = 'ERR';
      }
    }
  }

  boot();
})();
