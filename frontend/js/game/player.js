/**
 * Player Module — First-person player controller
 * Handles WASD movement, mouse look, jump, sprint, collision
 */

const Player = (() => {
  // ─── State ─────────────────────────────────────────────────────────────
  const state = {
    hp: 100,
    alive: true,
    position: new THREE.Vector3(-20, 1.8, 0),
    velocity: new THREE.Vector3(),
    onGround: false,
    speed: 6,
    sprintSpeed: 10,
    jumpForce: 8,
    gravity: -20,
    bobTimer: 0,
    bobAmount: 0,
    weapon: 'gun',
    team: 'team1',
  };

  // ─── Input tracking ────────────────────────────────────────────────────
  const keys = {};
  const mouse = { locked: false, dx: 0, dy: 0 };
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // ─── Three.js objects ──────────────────────────────────────────────────
  let camera    = null;
  let scene     = null;
  let colliders = [];
  let moveTimer = 0;

  /**
   * Initialize player with camera and scene references
   */
  function init(cam, scn, cols, spawnPoint, team, weapon) {
    camera    = cam;
    scene     = scn;
    colliders = cols;
    state.team   = team;
    state.weapon = weapon;
    state.hp     = 100;
    state.alive  = true;

    // Set spawn position
state.position.set(spawnPoint.x, spawnPoint.y + 0.8, spawnPoint.z);
camera.position.copy(state.position);

// Face toward center — team1 at x=-20 faces right, team2 at x=+20 faces left
euler.set(0, team === 'team1' ? -Math.PI / 2 : Math.PI / 2, 0);
camera.quaternion.setFromEuler(euler);

// Setup input
setupInput();
   
  }

  /**
   * Register keyboard and mouse events
   */
  function setupInput() {
    document.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'Space' && state.onGround && state.alive) jump();
    });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // Pointer lock for mouse look
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', () => {
      if (!mouse.locked) canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      mouse.locked = document.pointerLockElement === canvas;
      document.getElementById('crosshair').style.opacity = mouse.locked ? '1' : '0.3';
    });

    document.addEventListener('mousemove', (e) => {
      if (!mouse.locked) return;
      const sens = 0.002;
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= e.movementX * sens;
      euler.x -= e.movementY * sens;
      euler.x  = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, euler.x));
      camera.quaternion.setFromEuler(euler);
    });

    // Shoot on left click
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && mouse.locked && state.alive) {
        Weapons.attack(camera, scene, state.weapon, state.team);
      }
    });
  }

  /** Apply jump impulse */
  function jump() {
    state.velocity.y = state.jumpForce;
    state.onGround = false;
  }

  /**
   * Main update — called every frame
   * @param {number} dt - delta time in seconds
   */
  function update(dt) {
    if (!camera || !state.alive) return;

    const sprint  = keys['ShiftLeft'] || keys['ShiftLeft'];
    const speed   = sprint ? state.sprintSpeed : state.speed;
    const moving  = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];

    // ─── Build movement direction from camera facing ────────────────────
    const forward = new THREE.Vector3();
    const right   = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (keys['KeyW']) move.add(forward);
    if (keys['KeyS']) move.sub(forward);
    if (keys['KeyA']) move.sub(right);
    if (keys['KeyD']) move.add(right);
    if (move.length() > 0) move.normalize().multiplyScalar(speed);

    state.velocity.x = move.x;
    state.velocity.z = move.z;

    // ─── Gravity ────────────────────────────────────────────────────────
    state.velocity.y += state.gravity * dt;

    // ─── Integrate position ─────────────────────────────────────────────
    const newPos = state.position.clone().addScaledVector(state.velocity, dt);

    // ─── Collision detection (AABB sweep) ───────────────────────────────
    const playerAABB = {
      min: { x: newPos.x - 0.3, y: newPos.y - 1.8, z: newPos.z - 0.3 },
      max: { x: newPos.x + 0.3, y: newPos.y + 0.2, z: newPos.z + 0.3 }
    };

    state.onGround = false;

    for (const col of colliders) {
      if (aabbOverlap(playerAABB, col)) {
        // Resolve: find shallowest axis
        const overlapX = Math.min(playerAABB.max.x - col.min.x, col.max.x - playerAABB.min.x);
        const overlapY = Math.min(playerAABB.max.y - col.min.y, col.max.y - playerAABB.min.y);
        const overlapZ = Math.min(playerAABB.max.z - col.min.z, col.max.z - playerAABB.min.z);

        if (overlapY < overlapX && overlapY < overlapZ) {
          // Vertical collision
          if (state.velocity.y < 0) {
            newPos.y += overlapY;
            state.onGround = true;
          } else {
            newPos.y -= overlapY;
          }
          state.velocity.y = 0;
        } else if (overlapX < overlapZ) {
          newPos.x += state.velocity.x > 0 ? -overlapX : overlapX;
          state.velocity.x = 0;
        } else {
          newPos.z += state.velocity.z > 0 ? -overlapZ : overlapZ;
          state.velocity.z = 0;
        }
      }
    }

    // Ground clamp
    if (newPos.y < 1.8) { newPos.y = 1.8; state.velocity.y = 0; state.onGround = true; }

    // Map boundary clamp
    newPos.x = Math.max(-38, Math.min(38, newPos.x));
    newPos.z = Math.max(-38, Math.min(38, newPos.z));

    state.position.copy(newPos);

    // ─── Head bob animation ──────────────────────────────────────────────
    if (moving && state.onGround) {
      state.bobTimer += dt * (sprint ? 14 : 10);
      state.bobAmount = Math.sin(state.bobTimer) * (sprint ? 0.07 : 0.04);
      // Footstep sound trigger
      if (Math.sin(state.bobTimer) < -0.95) Audio.playFootstep();
    } else {
      state.bobAmount *= 0.85; // spring back
    }

    // Apply bob to camera Y
    camera.position.set(
      state.position.x,
      state.position.y + state.bobAmount,
      state.position.z
    );

    // ─── Broadcast movement to server ───────────────────────────────────
    moveTimer += dt;
    if (moveTimer > 0.05) { // 20 Hz sync
      moveTimer = 0;
      const anim = !moving ? 'idle' : sprint ? 'sprint' : 'walk';
      Network.sendMove(
        { x: state.position.x, y: state.position.y, z: state.position.z },
        euler.y,
        anim
      );
    }
  }

  /** AABB overlap test */
  function aabbOverlap(a, b) {
    return a.min.x < b.max.x && a.max.x > b.min.x
        && a.min.y < b.max.y && a.max.y > b.min.y
        && a.min.z < b.max.z && a.max.z > b.min.z;
  }

  function setHP(hp) {
    state.hp = Math.max(0, hp);
    HUD.updateHealth(state.hp);
    if (state.hp <= 0) state.alive = false;
  }

  function respawn(spawnPoint) {
    state.hp = 100;
    state.alive = true;
    state.velocity.set(0, 0, 0);
    state.position.set(spawnPoint.x, spawnPoint.y + 0.8, spawnPoint.z);
    HUD.updateHealth(100);
  }

  function getPosition() { return state.position.clone(); }
  function getCameraDir() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return dir;
  }
  function getTeam()   { return state.team; }
  function getWeapon() { return state.weapon; }
  function isAlive()   { return state.alive; }

  return { init, update, setHP, respawn, getPosition, getCameraDir, getTeam, getWeapon, isAlive };
})();
