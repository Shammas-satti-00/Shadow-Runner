// main.js - Step 8 (HUD + power-up timers + lives)

// ---------- Scene, Camera, Renderer ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05050a); // slight dark gradient feel

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ---------- UI references ----------
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const powerupsContainer = document.getElementById('powerups');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScore = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

// ---------- Player ----------
const playerGeo = new THREE.BoxGeometry(1, 1, 1);
const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 0.6 });
const player = new THREE.Mesh(playerGeo, playerMat);
player.position.set(0, 1, 0);
scene.add(player);

// ---------- Lighting ----------
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x404050, 0.6));

// ---------- Input ----------
const keys = {};
let velocityY = 0;
let isGrounded = true;
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---------- Platforms ----------
const platforms = [];
const platformLength = 10;
const totalPlatforms = 15;

function createPlatform(zPos) {
  const geo = new THREE.BoxGeometry(5, 1, platformLength);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x121217,
    emissive: 0x222233,
    emissiveIntensity: 0.4,
    roughness: 0.8
  });
  const platform = new THREE.Mesh(geo, mat);
  platform.position.set(0, 0, zPos);
  scene.add(platform);
  platforms.push(platform);
}

for (let i = 0; i < totalPlatforms; i++) createPlatform(i * -platformLength);

// ---------- Obstacles & Power-ups ----------
const obstacles = [];
const powerUps = [];
const powerUpTypes = ['speed','shield','score'];

// Variables for game state
let forwardSpeed = 0.15;
let score = 0;
let lives = 3;
let gameRunning = false;

// Active power-ups tracking (so we can show timers in HUD)
const activePowerUps = {}; // { type: { expiresAt: timestamp } }

// Spawn functions
function spawnObstacle(zPos) {
  if (Math.random() > 0.7) {
    const geo = new THREE.BoxGeometry(1, 2, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0xaa0000, emissiveIntensity: 0.8 });
    const obs = new THREE.Mesh(geo, mat);
    obs.position.set((Math.random()-0.5)*4, 1, zPos - Math.random()*6);
    scene.add(obs);
    obstacles.push(obs);
  }
}

function spawnPowerUp(zPos) {
  if (Math.random() > 0.85) {
    const type = powerUpTypes[Math.floor(Math.random()*powerUpTypes.length)];
    const color = type === 'speed' ? 0x00ff00 : type === 'shield' ? 0x33aaff : 0xffd24d;
    const geo = new THREE.SphereGeometry(0.4, 12, 12);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 });
    const pu = new THREE.Mesh(geo, mat);
    pu.position.set((Math.random()-0.5)*4, 1.1, zPos - Math.random()*6);
    pu.userData = { type };
    scene.add(pu);
    powerUps.push(pu);
  }
}

// Explosion particle (simple)
const particles = [];
function createExplosion(x,y,z){
  const g = new THREE.SphereGeometry(0.06,6,6);
  const m = new THREE.MeshStandardMaterial({ color:0xff3333, emissive:0xff6666 });
  for (let i=0;i<18;i++){
    const p = new THREE.Mesh(g,m.clone());
    p.position.set(x,y,z);
    p.velocity = new THREE.Vector3((Math.random()-0.5)*0.3, Math.random()*0.3, (Math.random()-0.5)*0.3);
    scene.add(p);
    particles.push(p);
  }
}

// ---------- Power-up effect application ----------
let shieldActive = false;
let speedBoostActive = false;

function applyPowerUp(type){
  const now = performance.now();
  if (type === 'speed') {
    forwardSpeed += 0.12;
    speedBoostActive = true;
    activePowerUps['speed'] = { expiresAt: now + 5000 };
  }
  if (type === 'shield') {
    shieldActive = true;
    activePowerUps['shield'] = { expiresAt: now + 5000 };
    player.material.color.set(0x00aaff);
  }
  if (type === 'score') {
    score += 200;
    // show briefly in HUD (we still track it just as immediate bonus)
    activePowerUps['score'] = { expiresAt: now + 1200 };
  }
}

// ---------- Power-up collision check ----------
function checkPowerUpCollisions(){
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const pu = powerUps[i];
    if (pu.position.distanceTo(player.position) < 1.2) {
      const type = pu.userData.type;
      applyPowerUp(type);
      scene.remove(pu);
      powerUps.splice(i,1);
    }
  }
}

// ---------- Clean up expired power-ups (and HUD) ----------
function updateActivePowerUps(){
  const now = performance.now();
  for (const key of Object.keys(activePowerUps)) {
    if (activePowerUps[key].expiresAt <= now) {
      // expire
      delete activePowerUps[key];
      if (key === 'speed') { forwardSpeed = Math.max(0.12, forwardSpeed - 0.12); speedBoostActive = false; }
      if (key === 'shield') { shieldActive = false; player.material.color.set(0x00ffcc); }
      if (key === 'score') { /* nothing to revert */ }
    }
  }
}

// ---------- HUD rendering ----------
function renderHUD(){
  scoreEl.innerText = `Score: ${score}`;
  livesEl.innerText = `Lives: ${lives}`;

  // clear then create entries for each active power-up
  powerupsContainer.innerHTML = '';
  const now = performance.now();
  for (const k of Object.keys(activePowerUps)) {
    const remaining = Math.max(0, Math.round((activePowerUps[k].expiresAt - now)/1000 * 10)/10);
    const el = document.createElement('div');
    el.className = 'pu';
    el.innerHTML = `<span style="font-weight:700">${k.toUpperCase()}</span><span>${remaining}s</span>`;
    powerupsContainer.appendChild(el);
  }
}

// ---------- Difficulty scaling ----------
function updateDifficulty(){
  if (score % 500 < 5 && forwardSpeed < 0.45) {
    forwardSpeed += 0.02;
  }
}

// ---------- Reset / Start / End ----------
function resetGame(){
  // reset player & state
  player.position.set(0,1,0);
  velocityY = 0;
  isGrounded = true;
  forwarded = 0;

  // clear obstacles & powerups & particles
  obstacles.forEach(o => scene.remove(o)); obstacles.length = 0;
  powerUps.forEach(p => scene.remove(p)); powerUps.length = 0;
  particles.forEach(p => scene.remove(p)); particles.length = 0;

  // reset platforms
  platforms.forEach((p,i) => p.position.z = i * -platformLength);

  // state variables
  forwardSpeed = 0.15;
  score = 0;
  lives = 3;
  shieldActive = false;
  speedBoostActive = false;
  Object.keys(activePowerUps).forEach(k => delete activePowerUps[k]);

  // HUD
  renderHUD();
  startScreen.style.display = 'none';
  gameOverOverlay.style.display = 'none';
  gameRunning = true;
}

function endGame(){
  gameRunning = false;
  finalScore.innerText = `Score: ${score}`;
  gameOverOverlay.style.display = 'block';
}

// ---------- Main loop ----------
let lastTime = performance.now();
function animate(){
  requestAnimationFrame(animate);

  if (!gameRunning) {
    renderer.render(scene, camera);
    return;
  }

  const now = performance.now();
  const dt = (now - lastTime) / 16.666; // approx frames scaling; not used heavily but helpful
  lastTime = now;

  // forward auto-move
  player.position.z -= forwardSpeed;

  // sideways
  const sideSpeed = 0.15;
  if (keys['KeyA']) player.position.x -= sideSpeed;
  if (keys['KeyD']) player.position.x += sideSpeed;

  // jump
  if (keys['Space'] && isGrounded) {
    velocityY = 0.25;
    isGrounded = false;
  }

  // gravity
  velocityY -= 0.015;
  player.position.y += velocityY;

  // ground collision check
  isGrounded = false;
  for (const platform of platforms){
    if (
      player.position.x > platform.position.x - 2.5 &&
      player.position.x < platform.position.x + 2.5 &&
      player.position.z < platform.position.z + platformLength/2 &&
      player.position.z > platform.position.z - platformLength/2 &&
      player.position.y <= 1
    ){
      player.position.y = 1;
      velocityY = 0;
      isGrounded = true;
    }
  }

  // recycle platforms & spawn obstacles/powerups
  for (const platform of platforms){
    if (platform.position.z - player.position.z > 20){
      platform.position.z -= totalPlatforms * platformLength;
      // spawn obstacle and power-up relative to this platform
      spawnObstacle(platform.position.z);
      spawnPowerUp(platform.position.z);
    }
  }

  // obstacle collision
  for (let i = obstacles.length - 1; i >= 0; i--){
    const obs = obstacles[i];
    if (
      Math.abs(player.position.x - obs.position.x) < 1 &&
      Math.abs(player.position.y - obs.position.y) < 1 &&
      Math.abs(player.position.z - obs.position.z) < 1
    ){
      if (!shieldActive) {
        // lose a life, small explosion, and respawn player at last safe platform
        lives -= 1;
        createExplosion(player.position.x, player.position.y, player.position.z);
        scene.remove(obs); obstacles.splice(i,1);
        if (lives <= 0) {
          endGame();
        } else {
          // respawn player one platform back for a short penalty
          player.position.set(0,1, player.position.z + platformLength * 2);
        }
      } else {
        // shield eats obstacle
        scene.remove(obs);
        obstacles.splice(i,1);
      }
    }
  }

  // check power-up pickups
  checkPowerUpCollisions();

  // update active power-ups timers and HUD
  updateActivePowerUps();
  updateDifficulty();

  // update score
  score += 1;
  renderHUD();

  // particles update
  for (let p of particles) {
    p.position.add(p.velocity);
    p.velocity.multiplyScalar(0.95);
  }

  // camera follow (raised, tilted to look ahead)
  camera.position.z = player.position.z + 12;
  camera.position.x = player.position.x;
  camera.position.y = player.position.y + 6;
  camera.lookAt(player.position.x, player.position.y, player.position.z - 5);

  // fall detection
  if (player.position.y < -5) {
    lives -= 1;
    createExplosion(player.position.x, 0, player.position.z);
    if (lives <= 0) {
      endGame();
    } else {
      // respawn at safe z
      player.position.set(0,1, player.position.z + platformLength * 3);
    }
    renderHUD();
  }

  renderer.render(scene, camera);
}

// ---------- Start / UI hookups ----------
startBtn.addEventListener('click', () => resetGame());
restartBtn.addEventListener('click', () => resetGame());

// Ensure canvas resizes
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// initialize with start screen visible
gameRunning = false;
renderHUD();
animate();
