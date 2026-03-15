/**
 * Weapons Module — Gun (raycast) and Sword (melee arc)
 * Handles attack logic, cooldowns, and remote player hit detection
 */

const Weapons = (() => {
  // Remote player meshes registry: socketId -> { mesh, hp, team, username, lastPos }
  const remotePlayers = new Map();

  // Cooldown tracking
  const cooldowns = { gun: 0, sword: 0 };
  const COOLDOWN  = { gun: 0.4, sword: 0.7 }; // seconds
  const DAMAGE    = { gun: 25, sword: 50 };
  const RANGE     = { gun: 60, sword: 3 };

  let scene    = null;
  let camera   = null;
  let raycaster = new THREE.Raycaster();

  function init(scn, cam) {
    scene  = scn;
    camera = cam;
  }

  /**
   * Register a remote player's mesh for hit detection
   */
  function addRemotePlayer(id, mesh, team, username) {
    remotePlayers.set(id, { mesh, team, username, hp: 100 });
  }

  function removeRemotePlayer(id) {
    const rp = remotePlayers.get(id);
    if (rp && scene) scene.remove(rp.mesh);
    remotePlayers.delete(id);
  }

  function updateRemotePlayer(id, position, rotationY, animation) {
    const rp = remotePlayers.get(id);
    if (!rp) return;
    rp.mesh.position.set(position.x, position.y - 1.8, position.z);
    rp.mesh.rotation.y = rotationY;
  }

  /**
   * Create a simple blocky remote player mesh
   */
  function createPlayerMesh(team, username) {
    const group = new THREE.Group();
    const color = team === 'team1' ? 0x00aaff : 0xff4400;
    const mat   = new THREE.MeshLambertMaterial({ color });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.3), mat);
    body.position.y = 0.9;
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 }));
    head.position.y = 1.6;
    group.add(head);

    // Legs
    [-0.15, 0.15].forEach(xOff => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), mat);
      leg.position.set(xOff, 0.4, 0);
      group.add(leg);
    });

    // Name tag (floating text via sprite)
    // (simplified: use a point light to indicate player)
    const indicator = new THREE.PointLight(color, 0.8, 3);
    indicator.position.y = 2;
    group.add(indicator);

    group.userData.hitbox = {
      getAABB: () => ({
        min: { x: group.position.x - 0.35, y: group.position.y,      z: group.position.z - 0.25 },
        max: { x: group.position.x + 0.35, y: group.position.y + 2,   z: group.position.z + 0.25 }
      })
    };

    return group;
  }

  /**
   * Perform attack — called from Player module on mouse click
   */
  function attack(cam, scn, weapon, myTeam) {
    const now = performance.now() / 1000;
    if (now - cooldowns[weapon] < COOLDOWN[weapon]) return;
    cooldowns[weapon] = now;

    if (weapon === 'gun')  fireGun(cam, myTeam);
    if (weapon === 'sword') swingSword(cam, myTeam);
  }

  /**
   * Gun: raycast from camera center, check remote player meshes
   */
  function fireGun(cam, myTeam) {
    Audio.playGunshot();
    Effects.muzzleFlash(cam);

    // Raycast from screen center
    raycaster.setFromCamera({ x: 0, y: 0 }, cam);

    // Check against remote player meshes
const targets = [];
remotePlayers.forEach((rp, id) => {
  if (rp.team !== myTeam) {
    rp.mesh.updateMatrixWorld(true); // sync position before raycasting
    rp.mesh.traverse(child => { if (child.isMesh) targets.push(child); });
  }
});

    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const hitPoint = hits[0].point;

      // Find which player this belongs to
      remotePlayers.forEach((rp, id) => {
        if (rp.team !== myTeam) {
          let found = false;
          rp.mesh.traverse(c => { if (c === hitMesh) found = true; });
          if (found) {
            Network.sendHit(id, DAMAGE.gun, 'gun');
            Audio.playHit();
            Effects.hitParticles(hitPoint, 0x00ffff, scene);
            HUD.showHitMarker();
          }
        }
      });
    }

    // Emit bullet trail to others
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = cam.position.clone();
    Network.sendShoot(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z }
    );

    // Local bullet trail visual
    Effects.createBulletTrailLocal(origin, dir, scene);
  }

  /**
   * Sword: check distance to remote players
   */
  function swingSword(cam, myTeam) {
    Audio.playSwordSwing();
    Effects.swordArc(cam, scene);

    const myPos = cam.position;
    let hit = false;

    remotePlayers.forEach((rp, id) => {
      if (rp.team === myTeam) return;
      const dist = myPos.distanceTo(rp.mesh.position);
      if (dist < RANGE.sword) {
        Network.sendHit(id, DAMAGE.sword, 'sword');
        if (!hit) { Audio.playHit(); hit = true; }
        Effects.hitParticles(rp.mesh.position.clone().add(new THREE.Vector3(0,1,0)), 0xff4400, scene);
        HUD.showHitMarker();
      }
    });

    // Broadcast sword swing
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    Network.sendSwordSwing(
      { x: myPos.x, y: myPos.y, z: myPos.z },
      { x: dir.x, y: dir.y, z: dir.z }
    );
  }

  function getRemotePlayers() { return remotePlayers; }

  return {
    init, attack,
    addRemotePlayer, removeRemotePlayer, updateRemotePlayer,
    createPlayerMesh, getRemotePlayers
  };
})();

/** Global weapon selector (from lobby) */
let selectedWeapon = 'gun';

function selectWeapon(type) {
  selectedWeapon = type;
  document.querySelectorAll('.weapon-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-weapon="${type}"]`)?.classList.add('active');
}
