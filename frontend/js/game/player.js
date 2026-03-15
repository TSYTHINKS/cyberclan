/**
 * Player Module — First-person controller
 * WASD movement, mouse look, jump, sprint, collision detection
 * Press 1 or Q = Gun    Press 2 or E = Sword
 */

const Player = (() => {
  const state = {
    hp:          100,
    alive:       true,
    position:    new THREE.Vector3(-20, 1.8, 0),
    velocity:    new THREE.Vector3(),
    onGround:    false,
    speed:       6,
    sprintSpeed: 10,
    jumpForce:   8,
    gravity:     -20,
    bobTimer:    0,
    bobAmount:   0,
    weapon:      'gun',
    team:        'team1',
  };

  const keys  = {};
  const mouse = { locked: false };
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  let camera    = null;
  let scene     = null;
  let colliders = [];
  let moveTimer = 0;

  function init(cam, scn, cols, spawnPoint, team, weapon) {
    camera    = cam;
    scene     = scn;
    colliders = cols;
    state.team   = team;
    state.weapon = weapon || 'gun';
    state.hp     = 100;
    state.alive  = true;
    state.velocity.set(0, 0, 0);

    // Place player at spawn point
    state.position.set(spawnPoint.x, spawnPoint.y + 0.8, spawnPoint.z);
    camera.position.copy(state.position);

    // Face toward center of map
    // team1 is at x=-20 so face RIGHT (+X direction)
    // team2 is at x=+20 so face LEFT  (-X direction)
    euler.set(0, team === 'team1' ? -Math.PI / 2 : Math.PI / 2, 0);
    camera.quaternion.setFromEuler(euler);

    setupInput();
  }

  function setupInput() {
    document.addEventListener('keydown', (e) => {
      keys[e.code] = true;

      // JUMP
      if (e.code === 'Space' && state.onGround && state.alive) {
        state.velocity.y = state.jumpForce;
        state.onGround = false;
      }

      // SWITCH WEAPON: press 1 or Q for Gun
      if (e.code === 'Digit1' || e.code === 'KeyQ') {
        state.weapon = 'gun';
        HUD.updateWeapon('gun');
      }

      // SWITCH WEAPON: press 2 or E for Sword
      if (e.code === 'Digit2' || e.code === 'KeyE') {
        state.weapon = 'sword';
        HUD.updateWeapon('sword');
      }
    });

    document.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    // Click canvas to lock mouse (needed for looking around)
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', () => {
      if (!mouse.locked) canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      mouse.locked = document.pointerLockElement === canvas;
      const crosshair = document.getElementById('crosshair');
      if (crosshair) crosshair.style.opacity = mouse.locked ? '1' : '0.3';
    });

    // Mouse movement = look around
    document.addEventListener('mousemove', (e) => {
      if (!mouse.locked) return;
      const sens = 0.002;
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= e.movementX * sens;
      euler.x -= e.movementY * sens;
      // Clamp looking up/down so you can't flip upside down
      euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
      camera.quaternion.setFromEuler(euler);
    });

    // Left click = attack
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && mouse.locked && state.alive) {
        Weapons.attack(camera, scene, state.weapon, state.team);
      }
    });
  }

  function update(dt) {
    if (!camera || !state.alive) return;

    const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
    const speed  = sprint ? state.sprintSpeed : state.speed;
    const moving = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];

    // Work out which direction the camera is facing
    const forward = new THREE.Vector3();
    const right   = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Build movement vector from keys pressed
    const move = new THREE.Vector3();
    if (keys['KeyW']) move.add(forward);
    if (keys['KeyS']) move.sub(forward);
    if (keys['KeyA']) move.sub(right);
    if (keys['KeyD']) move.add(right);
    if (move.length() > 0) move.normalize().multiplyScalar(speed);

    state.velocity.x = move.x;
    state.velocity.z = move.z;

    // Gravity pulls player down
    state.velocity.y += state.gravity * dt;

    // Calculate new position
    const newPos = state.position.clone().addScaledVector(state.velocity, dt);

    // ── COLLISION DETECTION (stop player walking through walls) ───────────
    const pMin = { x: newPos.x - 0.3, y: newPos.y - 1.8, z: newPos.z - 0.3 };
    const pMax = { x: newPos.x + 0.3, y: newPos.y + 0.2, z: newPos.z + 0.3 };

    state.onGround = false;

    for (const col of colliders) {
      const overlap =
        pMin.x < col.max.x && pMax.x > col.min.x &&
        pMin.y < col.max.y && pMax.y > col.min.y &&
        pMin.z < col.max.z && pMax.z > col.min.z;

      if (overlap) {
        const ox = Math.min(pMax.x - col.min.x, col.max.x - pMin.x);
        const oy = Math.min(pMax.y - col.min.y, col.max.y - pMin.y);
        const oz = Math.min(pMax.z - col.min.z, col.max.z - pMin.z);

        if (oy < ox && oy < oz) {
          if (state.velocity.y < 0) { newPos.y += oy; state.onGround = true; }
          else { newPos.y -= oy; }
          state.velocity.y = 0;
        } else if (ox < oz) {
          newPos.x += state.velocity.x > 0 ? -ox : ox;
          state.velocity.x = 0;
        } else {
          newPos.z += state.velocity.z > 0 ? -oz : oz;
          state.velocity.z = 0;
        }
      }
    }

    // Don't fall below ground
    if (newPos.y < 1.8) {
      newPos.y = 1.8;
      state.velocity.y = 0;
      state.onGround = true;
    }

    // Keep inside map boundaries
    newPos.x = Math.max(-38, Math.min(38, newPos.x));
    newPos.z = Math.max(-38, Math.min(38, newPos.z));

    state.position.copy(newPos);

    // ── HEAD BOB when walking ──────────────────────────────────────────────
    if (moving && state.onGround) {
      state.bobTimer += dt * (sprint ? 14 : 10);
      state.bobAmount = Math.sin(state.bobTimer) * (sprint ? 0.07 : 0.04);
      if (Math.sin(state.bobTimer) < -0.95) Audio.playFootstep();
    } else {
      state.bobAmount *= 0.85;
    }

    camera.position.set(
      state.position.x,
      state.position.y + state.bobAmount,
      state.position.z
    );

    // ── SEND POSITION TO SERVER every 50ms (20 times per second) ──────────
    moveTimer += dt;
    if (moveTimer > 0.05) {
      moveTimer = 0;
      const anim = !moving ? 'idle' : sprint ? 'sprint' : 'walk';
      Network.sendMove(
        { x: state.position.x, y: state.position.y, z: state.position.z },
        euler.y,
        anim
      );
    }
  }

  function setHP(hp) {
    state.hp    = Math.max(0, hp);
    HUD.updateHealth(state.hp);
    if (state.hp <= 0) {
      state.alive = false;
      state.velocity.set(0, 0, 0);
    }
  }

  function respawn(spawnPoint) {
    state.hp    = 100;
    state.alive = true;
    state.velocity.set(0, 0, 0);
    state.position.set(spawnPoint.x, spawnPoint.y + 0.8, spawnPoint.z);
    HUD.updateHealth(100);
  }

  function getPosition() { return state.position.clone(); }
  function isAlive()     { return state.alive; }

  return { init, update, setHP, respawn, getPosition, isAlive };
})();
