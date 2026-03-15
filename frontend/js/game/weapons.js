
const Weapons = (() => {
  const remotePlayers = new Map();
  const cooldowns = { gun: 0, sword: 0 };
  const COOLDOWN  = { gun: 0.4, sword: 0.7 };
  const DAMAGE    = { gun: 25, sword: 50 };
  const RANGE     = { gun: 80, sword: 3 };

  let scene     = null;
  let camera    = null;
  let raycaster = new THREE.Raycaster();

  function init(scn, cam) {
    scene  = scn;
    camera = cam;
  }

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

    // position.y is eye height (1.8 above feet) so subtract 1.8
    rp.mesh.position.set(position.x, position.y - 1.8, position.z);
    rp.mesh.rotation.y = rotationY;

    // WALKING / RUNNING LIMB ANIMATION
    rp.mesh.userData.animTimer = (rp.mesh.userData.animTimer || 0) + 0.15;
    const t      = rp.mesh.userData.animTimer;
    const moving = animation === 'walk' || animation === 'sprint';
    const speed  = animation === 'sprint' ? 2.2 : 1.0;
    const swing  = moving ? Math.sin(t * speed) * 0.55 : 0;

    // Arms and legs swing opposite each other like real walking
    if (rp.mesh.userData.rightArmPivot) rp.mesh.userData.rightArmPivot.rotation.x = -swing;
    if (rp.mesh.userData.leftArmPivot)  rp.mesh.userData.leftArmPivot.rotation.x  =  swing;
    if (rp.mesh.userData.rightLegPivot) rp.mesh.userData.rightLegPivot.rotation.x =  swing;
    if (rp.mesh.userData.leftLegPivot)  rp.mesh.userData.leftLegPivot.rotation.x  = -swing;

    // NAME LABEL always faces the camera (billboard effect)
    const cam = GameEngine.getCamera();
    if (rp.mesh.userData.nameLabel && cam) {
      rp.mesh.userData.nameLabel.lookAt(cam.position);
    }
  }

  /**
   * Build a Minecraft-style blocky player with moving arms and legs
   * hexColor = the clan's color (like '#ff4400')
   * isEnemy  = true means red name, false means green name
   */
  function createPlayerMesh(team, username, hexColor, isEnemy) {
    const colorInt = parseInt((hexColor || '#00aaff').replace('#', ''), 16);
    const bodyMat  = new THREE.MeshLambertMaterial({
      color: colorInt,
      emissive: colorInt,
      emissiveIntensity: 0.15
    });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
    const group  = new THREE.Group();

    // ── HEAD ──────────────────────────────────────────────────────────────
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), bodyMat);
    head.position.y = 1.65;
    head.castShadow = true;
    group.add(head);

    // Square black eyes (Minecraft style)
    const eyeGeo = new THREE.BoxGeometry(0.11, 0.11, 0.02);
    [-0.13, 0.13].forEach(x => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, 1.67, 0.28);
      group.add(eye);
    });

    // ── BODY ──────────────────────────────────────────────────────────────
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    // ── RIGHT ARM (holds the weapon) — pivot from shoulder ────────────────
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.39, 1.35, 0);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), bodyMat);
    rightArm.position.y = -0.32;
    rightArm.castShadow = true;
    rightArmPivot.add(rightArm);
    group.add(rightArmPivot);
    group.userData.rightArmPivot = rightArmPivot;

    // ── LEFT ARM — pivot from shoulder ────────────────────────────────────
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.39, 1.35, 0);
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), bodyMat);
    leftArm.position.y = -0.32;
    leftArm.castShadow = true;
    leftArmPivot.add(leftArm);
    group.add(leftArmPivot);
    group.userData.leftArmPivot = leftArmPivot;

    // ── RIGHT LEG — pivot from hip ────────────────────────────────────────
    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.15, 0.62, 0);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.24), bodyMat);
    rightLeg.position.y = -0.32;
    rightLeg.castShadow = true;
    rightLegPivot.add(rightLeg);
    group.add(rightLegPivot);
    group.userData.rightLegPivot = rightLegPivot;

    // ── LEFT LEG — pivot from hip ─────────────────────────────────────────
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.15, 0.62, 0);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.24), bodyMat);
    leftLeg.position.y = -0.32;
    leftLeg.castShadow = true;
    leftLegPivot.add(leftLeg);
    group.add(leftLegPivot);
    group.userData.leftLegPivot = leftLegPivot;

    // ── NEON GUN in right hand ────────────────────────────────────────────
    const gunGroup = new THREE.Group();
    const gunMat   = new THREE.MeshLambertMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1.5
    });
    const barrelMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: 0x00ffff,
      emissiveIntensity: 3
    });
    const gunBody   = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.38), gunMat);
    const gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.22), barrelMat);
    gunBarrel.position.z = 0.28;
    gunGroup.add(gunBody);
    gunGroup.add(gunBarrel);
    // Position gun at end of right hand
    gunGroup.position.set(0.13, -0.4, 0.22);
    rightArmPivot.add(gunGroup);
    group.userData.gunGroup = gunGroup;

    // ── NAME LABEL floating above head ────────────────────────────────────
    const nameCanvas  = document.createElement('canvas');
    nameCanvas.width  = 256;
    nameCanvas.height = 56;
    const ctx = nameCanvas.getContext('2d');
    // Red for enemies, green for teammates
    ctx.fillStyle = isEnemy ? '#ff4444' : '#44ff88';
    ctx.font      = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(username || 'Player', 128, 40);
    const nameTex   = new THREE.CanvasTexture(nameCanvas);
    const nameLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.38),
      new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, depthWrite: false })
    );
    nameLabel.position.y = 2.3;
    group.add(nameLabel);
    group.userData.nameLabel = nameLabel;
    group.userData.animTimer = 0;

    return group;
  }

  // ── ATTACK ───────────────────────────────────────────────────────────────

  function attack(cam, scn, weapon, myTeam) {
    const now = performance.now() / 1000;
    if (now - cooldowns[weapon] < COOLDOWN[weapon]) return;
    cooldowns[weapon] = now;
    if (weapon === 'gun')   fireGun(cam, myTeam);
    if (weapon === 'sword') swingSword(cam, myTeam);
  }

  function fireGun(cam, myTeam) {
    Audio.playGunshot();
    Effects.muzzleFlash(cam);

    raycaster.far = 80;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);

    const targets = [];
    remotePlayers.forEach((rp, id) => {
      if (rp.team !== myTeam) {
        rp.mesh.updateMatrixWorld(true); // make sure position is current
        rp.mesh.traverse(child => { if (child.isMesh) targets.push(child); });
      }
    });

    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      const hitMesh  = hits[0].object;
      const hitPoint = hits[0].point;
      let hitRegistered = false;
      remotePlayers.forEach((rp, id) => {
        if (hitRegistered || rp.team === myTeam) return;
        let belongs = false;
        rp.mesh.traverse(c => { if (c === hitMesh) belongs = true; });
        if (belongs) {
          hitRegistered = true;
          Network.sendHit(id, DAMAGE.gun, 'gun');
          Audio.playHit();
          Effects.hitParticles(hitPoint, 0x00ffff, scene);
          HUD.showHitMarker();
        }
      });
    }

    const dir    = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = cam.position.clone();
    Network.sendShoot(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x,    y: dir.y,    z: dir.z    }
    );
    Effects.createBulletTrailLocal(origin, dir, scene);
  }

  function swingSword(cam, myTeam) {
    Audio.playSwordSwing();
    Effects.swordArc(cam, scene);
    const myPos = cam.position;
    let hit = false;
    remotePlayers.forEach((rp, id) => {
      if (rp.team === myTeam) return;
      const dx   = myPos.x - rp.mesh.position.x;
      const dz   = myPos.z - rp.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < RANGE.sword) {
        Network.sendHit(id, DAMAGE.sword, 'sword');
        if (!hit) { Audio.playHit(); hit = true; }
        Effects.hitParticles(
          rp.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)),
          0xff4400,
          scene
        );
        HUD.showHitMarker();
      }
    });
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    Network.sendSwordSwing(
      { x: myPos.x, y: myPos.y, z: myPos.z },
      { x: dir.x,   y: dir.y,   z: dir.z   }
    );
  }

  function getRemotePlayers() { return remotePlayers; }

  return {
    init, attack,
    addRemotePlayer, removeRemotePlayer, updateRemotePlayer,
    createPlayerMesh, getRemotePlayers
  };
})();

let selectedWeapon = 'gun';

function selectWeapon(type) {
  selectedWeapon = type;
  document.querySelectorAll('.weapon-card').forEach(c => c.classList.remove('active'));
  const card = document.querySelector('[data-weapon="' + type + '"]');
  if (card) card.classList.add('active');
}
