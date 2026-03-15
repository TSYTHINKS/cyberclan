/**
 * GameEngine — Three.js setup and main game loop
 */

const GameEngine = (() => {
  let renderer  = null;
  let scene     = null;
  let camera    = null;
  let animFrame = null;
  let clock     = new THREE.Clock();
  let running   = false;

  function init() {
    const canvas = document.getElementById('game-canvas');

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x020408, 1);
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020810, 0.018);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 200);

    setupLighting();
    buildSkybox();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function setupLighting() {
    scene.add(new THREE.AmbientLight(0x112233, 0.6));

    const dir = new THREE.DirectionalLight(0x4488cc, 0.8);
    dir.position.set(10, 30, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far  = 100;
    dir.shadow.camera.left = dir.shadow.camera.bottom = -50;
    dir.shadow.camera.right = dir.shadow.camera.top   =  50;
    scene.add(dir);

    const neonColors = [0x00ffff, 0xff00aa, 0x8800ff, 0x00ff88];
    [[-20,3,-20],[20,3,-20],[-20,3,20],[20,3,20],[0,5,0],[-10,2,0],[10,2,0]].forEach(([x,y,z], i) => {
      const light = new THREE.PointLight(neonColors[i % neonColors.length], 0.6, 15);
      light.position.set(x, y, z);
      scene.add(light);
    });
  }

  function buildSkybox() {
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
          float y   = normalize(vPos).y;
          vec3 col  = mix(vec3(0.0,0.05,0.15), vec3(0.005,0.005,0.02), clamp(y*2.0,0.0,1.0));
          float star = step(0.998, fract(sin(dot(normalize(vPos)*50.0, vec3(12.9898,78.233,45.164)))*43758.5453));
          col += star * vec3(0.4,0.7,1.0) * (0.5 + 0.5*sin(time + normalize(vPos).x*100.0));
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
    scene.userData.sky = sky;
  }

  function startMatch(matchData) {
    Audio.init();
    clearMapObjects();

    const colliders = Terrain.build(scene);

    Player.init(
      camera, scene, colliders,
      matchData.spawnPoint,
      matchData.team,
      selectedWeapon
    );

    Weapons.init(scene, camera);

    // Set team names with clan colors in score bar
    HUD.setTeamNames(
      matchData.team1Clan,  matchData.team2Clan,
      matchData.team1Color, matchData.team2Color
    );
    HUD.updateHealth(100);
    HUD.updateWeapon(selectedWeapon);

    // Start the 5 minute countdown timer
    HUD.startTimer(300);

    // Hide the waiting overlay
    const waitingOverlay = document.getElementById('waiting-overlay');
    if (waitingOverlay) waitingOverlay.classList.add('hidden');

    running = true;
    clock.start();
    loop();
  }

  function clearMapObjects() {
    const toRemove = [];
    scene.traverse(obj => {
      if (obj.isMesh || obj.isLine || obj.isPoints) {
        if (obj !== scene.userData.sky) toRemove.push(obj);
      }
    });
    toRemove.forEach(obj => {
      scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    });
  }

  function loop() {
    if (!running) return;
    animFrame = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    Player.update(dt);
    Effects.update(dt);
    if (scene.userData.sky) scene.userData.sky.material.uniforms.time.value += dt;
    renderer.render(scene, camera);
  }

  function stop() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function onRemotePlayerMove(data) {
    const { id, username, position, rotation, animation, team, clanColor } = data;
    const myTeam = window.currentMatch?.team;
    const isEnemy = team !== myTeam;

    let rp = Weapons.getRemotePlayers().get(id);
    if (!rp) {
      const mesh = Weapons.createPlayerMesh(team || 'team2', username, clanColor, isEnemy);
      scene.add(mesh);
      Weapons.addRemotePlayer(id, mesh, team || 'team2', username);
    }
    Weapons.updateRemotePlayer(id, position, rotation?.y || 0, animation);
  }

  function onPlayerLeft(id) { Weapons.removeRemotePlayer(id); }

  function onRemotePlayerRespawn(data) {
    const rp = Weapons.getRemotePlayers().get(data.id);
    if (rp && data.spawnPoint) {
      rp.mesh.position.set(data.spawnPoint.x, data.spawnPoint.y, data.spawnPoint.z);
    }
  }

  function getScene()  { return scene;   }
  function getCamera() { return camera;  }
  function isRunning() { return running; }

  return {
    init, startMatch, stop,
    onRemotePlayerMove, onPlayerLeft, onRemotePlayerRespawn,
    getScene, getCamera, isRunning
  };
})();

function exitArena() {
  GameEngine.stop();
  HUD.stopTimer();
  Weapons.getRemotePlayers().forEach((_, id) => Weapons.removeRemotePlayer(id));
  showPage('lobby');
  const matchEnd = document.getElementById('match-end');
  if (matchEnd) matchEnd.classList.add('hidden');
}

function cancelMatchmaking() {
  Network.leaveMatchmaking();
  const waitingOverlay = document.getElementById('waiting-overlay');
  const btnFind        = document.getElementById('btn-find-match');
  const btnCancel      = document.getElementById('btn-cancel-match');
  if (waitingOverlay) waitingOverlay.classList.add('hidden');
  if (btnFind)        btnFind.classList.remove('hidden');
  if (btnCancel)      btnCancel.classList.add('hidden');
  showPage('lobby');
}
