/**
 * GameEngine — Three.js core setup and main game loop
 * Initializes renderer, scene, camera, lighting, skybox, and coordinates all modules
 */

const GameEngine = (() => {
  let renderer  = null;
  let scene     = null;
  let camera    = null;
  let animFrame = null;
  let clock     = new THREE.Clock();
  let running   = false;

  /**
   * Initialize Three.js renderer, scene, camera
   */
  function init() {
    const canvas = document.getElementById('game-canvas');

    // ─── Renderer ──────────────────────────────────────────────────────
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x020408, 1);
    renderer.toneMapping    = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // ─── Scene ─────────────────────────────────────────────────────────
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020810, 0.018);

    // ─── Camera ────────────────────────────────────────────────────────
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 200);

    // ─── Lighting ──────────────────────────────────────────────────────
    setupLighting();

    // ─── Skybox (procedural cyberpunk atmosphere) ──────────────────────
    buildSkybox();

    // ─── Window resize ─────────────────────────────────────────────────
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /**
   * Set up scene lighting (ambient + directional + neon points)
   */
  function setupLighting() {
    // Soft ambient
    const ambient = new THREE.AmbientLight(0x112233, 0.6);
    scene.add(ambient);

    // Main directional (moonlight effect)
    const dirLight = new THREE.DirectionalLight(0x4488cc, 0.8);
    dirLight.position.set(10, 30, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far  = 100;
    dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.camera.right = dirLight.shadow.camera.top   =  50;
    scene.add(dirLight);

    // Neon point lights scattered across map
    const neonColors = [0x00ffff, 0xff00aa, 0x8800ff, 0x00ff88];
    const neonPositions = [
      [-20, 3, -20], [20, 3, -20], [-20, 3, 20], [20, 3, 20],
      [0, 5, 0], [-10, 2, 0], [10, 2, 0]
    ];
    neonPositions.forEach(([x,y,z], i) => {
      const light = new THREE.PointLight(neonColors[i % neonColors.length], 0.6, 15);
      light.position.set(x, y, z);
      scene.add(light);
    });
  }

  /**
   * Build a cyberpunk skybox using a large sphere with gradient shader
   */
  function buildSkybox() {
    // Sky dome
    const skyGeo = new THREE.SphereGeometry(150, 16, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vPos;
        uniform float time;
        void main() {
          float y = normalize(vPos).y;
          // Gradient: dark blue at horizon, near-black at zenith
          vec3 horizon = vec3(0.0, 0.05, 0.15);
          vec3 zenith  = vec3(0.005, 0.005, 0.02);
          vec3 col = mix(horizon, zenith, clamp(y * 2.0, 0.0, 1.0));
          // Stars (pseudo-random based on position)
          float star = step(0.998, fract(sin(dot(normalize(vPos) * 50.0, vec3(12.9898, 78.233, 45.164))) * 43758.5453));
          col += star * vec3(0.4, 0.7, 1.0) * (0.5 + 0.5 * sin(time + normalize(vPos).x * 100.0));
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
    scene.userData.sky = sky; // reference for animation
  }

  /**
   * Start a match — called when server confirms match found
   */
  function startMatch(matchData) {
    // Initialize audio
    Audio.init();

    // Clear previous scene objects (but keep lights/sky)
    clearMapObjects();

    // Build terrain and get collision boxes
    const colliders = Terrain.build(scene);

    // Initialize player controller
    Player.init(
      camera, scene, colliders,
      matchData.spawnPoint,
      matchData.team,
      selectedWeapon
    );

    // Initialize weapons module
    Weapons.init(scene, camera);

    // Update HUD
    HUD.setTeamNames(matchData.team1Clan, matchData.team2Clan);
    HUD.updateHealth(100);
    HUD.updateWeapon(selectedWeapon);

    // Show HUD, hide waiting overlay
    document.getElementById('waiting-overlay').classList.add('hidden');

    // Start game loop
    running = true;
    clock.start();
    loop();
  }

  /**
   * Remove old terrain/player objects from scene
   */
  function clearMapObjects() {
    // Remove all non-light, non-sky objects
    const toRemove = [];
    scene.traverse(obj => {
      if (obj.isMesh && !obj.parent?.isScene) return;
      if (obj.isMesh || obj.isLine || obj.isPoints) {
        if (obj !== scene.userData.sky) toRemove.push(obj);
      }
    });
    toRemove.forEach(obj => {
      scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    });
  }

  /**
   * Main game loop
   */
  function loop() {
    if (!running) return;
    animFrame = requestAnimationFrame(loop);

    const dt = Math.min(clock.getDelta(), 0.05); // cap at 50ms

    // Update all systems
    Player.update(dt);
    Effects.update(dt);

    // Animate skybox
    if (scene.userData.sky) {
      scene.userData.sky.material.uniforms.time.value += dt;
    }

    // Render
    renderer.render(scene, camera);
  }

  /**
   * Stop game loop and release pointer lock
   */
  function stop() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ─── Remote Player Events (called from Network module) ──────────────────

  function onRemotePlayerMove(data) {
    const { id, username, position, rotation, animation, team } = data;
    let rp = Weapons.getRemotePlayers().get(id);
    if (!rp) {
      // First time seeing this player — create their mesh
      const mesh = Weapons.createPlayerMesh(team || 'team2', username);
      scene.add(mesh);
      Weapons.addRemotePlayer(id, mesh, team || 'team2', username);
    }
    Weapons.updateRemotePlayer(id, position, rotation?.y || 0, animation);
  }

  function onPlayerLeft(id) {
    Weapons.removeRemotePlayer(id);
  }

  function onRemotePlayerRespawn(data) {
    const rp = Weapons.getRemotePlayers().get(data.id);
    if (rp && data.spawnPoint) {
      rp.mesh.position.set(data.spawnPoint.x, data.spawnPoint.y, data.spawnPoint.z);
    }
  }

  function getScene()    { return scene; }
  function getCamera()   { return camera; }
  function isRunning()   { return running; }

  return {
    init, startMatch, stop,
    onRemotePlayerMove, onPlayerLeft, onRemotePlayerRespawn,
    getScene, getCamera, isRunning
  };
})();

/** Global: exit arena and return to lobby */
function exitArena() {
  GameEngine.stop();
  Weapons.getRemotePlayers().forEach((_, id) => Weapons.removeRemotePlayer(id));
  showPage('lobby');
  document.getElementById('match-end').classList.add('hidden');
}

/** Global: cancel matchmaking */
function cancelMatchmaking() {
  Network.leaveMatchmaking();
  document.getElementById('waiting-overlay').classList.add('hidden');
  document.getElementById('btn-find-match').classList.remove('hidden');
  document.getElementById('btn-cancel-match').classList.add('hidden');
  showPage('lobby');
}
