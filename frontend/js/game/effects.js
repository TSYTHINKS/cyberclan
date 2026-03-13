/**
 * Effects Module — Visual feedback system
 * Bullet trails, muzzle flash, particles, sword arc, hit flash
 */

const Effects = (() => {
  const activeEffects = []; // { mesh, life, maxLife, update }

  /**
   * Add a timed effect and track it for cleanup
   */
  function addEffect(mesh, scene, duration, onUpdate = null) {
    scene.add(mesh);
    activeEffects.push({ mesh, scene, life: duration, maxLife: duration, onUpdate });
  }

  /**
   * Update all active effects (call from game loop)
   */
  function update(dt) {
    for (let i = activeEffects.length - 1; i >= 0; i--) {
      const fx = activeEffects[i];
      fx.life -= dt;
      const t = fx.life / fx.maxLife; // 1 -> 0

      if (fx.onUpdate) fx.onUpdate(fx.mesh, t);

      if (fx.life <= 0) {
        fx.scene.remove(fx.mesh);
        // Dispose geometry & material to prevent memory leaks
        if (fx.mesh.geometry) fx.mesh.geometry.dispose();
        if (fx.mesh.material) {
          if (Array.isArray(fx.mesh.material)) fx.mesh.material.forEach(m => m.dispose());
          else fx.mesh.material.dispose();
        }
        activeEffects.splice(i, 1);
      }
    }
  }

  // ─── Bullet Trail ───────────────────────────────────────────────────────

  /**
   * Draw a local bullet trail (from own gun)
   */
  function createBulletTrailLocal(origin, direction, scene) {
    const length = 30;
    const end    = origin.clone().addScaledVector(direction, length);

    const points  = [origin, end];
    const geo     = new THREE.BufferGeometry().setFromPoints(points);
    const mat     = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
    const line    = new THREE.Line(geo, mat);

    addEffect(line, scene, 0.12, (mesh, t) => {
      mesh.material.opacity = t * 0.9;
    });
  }

  /**
   * Draw a remote player's bullet trail (from network event)
   */
  function createBulletTrail({ origin, direction }) {
    // Reuse scene from engine
    const scene = GameEngine.getScene();
    if (!scene) return;
    const o   = new THREE.Vector3(origin.x, origin.y, origin.z);
    const dir = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
    createBulletTrailLocal(o, dir, scene);
  }

  // ─── Muzzle Flash ────────────────────────────────────────────────────────

  function muzzleFlash(camera) {
    const scene = GameEngine.getScene();
    if (!scene) return;

    // Point light flash in front of camera
    const flash = new THREE.PointLight(0x00ffff, 8, 4);
    const dir   = new THREE.Vector3();
    camera.getWorldDirection(dir);
    flash.position.copy(camera.position).addScaledVector(dir, 1.2);
    scene.add(flash);

    // Sphere mesh for visible flash
    const geo  = new THREE.SphereGeometry(0.08, 6, 6);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(flash.position);

    addEffect(mesh, scene, 0.06, (m, t) => {
      m.material.opacity = t;
      m.scale.setScalar(1 + (1 - t) * 2);
    });

    // Remove light manually after short time
    setTimeout(() => scene.remove(flash), 60);
  }

  // ─── Hit Particles ───────────────────────────────────────────────────────

  /**
   * Burst of particles at hit point
   */
  function hitParticles(position, color, scene) {
    const count = 10;
    const geo   = new THREE.BufferGeometry();
    const verts = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
      verts.push(position.x, position.y, position.z);
      velocities.push(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat   = new THREE.PointsMaterial({ color, size: 0.12, transparent: true });
    const pts   = new THREE.Points(geo, mat);
    const vel   = velocities;
    const pos   = geo.attributes.position;

    addEffect(pts, scene, 0.6, (mesh, t) => {
      mesh.material.opacity = t;
      const arr = pos.array;
      for (let i = 0; i < count; i++) {
        arr[i*3]   += vel[i*3]   * 0.016;
        arr[i*3+1] += vel[i*3+1] * 0.016;
        arr[i*3+1] -= 9.8 * 0.016; // gravity
        arr[i*3+2] += vel[i*3+2] * 0.016;
      }
      pos.needsUpdate = true;
    });
  }

  // ─── Sword Arc ───────────────────────────────────────────────────────────

  function swordArc(camera, scene) {
    const dir    = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right  = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();

    // Fan of lines simulating a sword swing
    for (let i = 0; i < 5; i++) {
      const angle = (i / 4 - 0.5) * Math.PI * 0.6;
      const swingDir = dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), angle);
      const start = camera.position.clone().addScaledVector(right, -0.3).add(new THREE.Vector3(0,-0.3,0));
      const end   = start.clone().addScaledVector(swingDir, 2.5);

      const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
      const mat = new THREE.LineBasicMaterial({
        color: 0xff8800, transparent: true,
        opacity: 0.8 - i * 0.1
      });
      const line = new THREE.Line(geo, mat);

      addEffect(line, scene, 0.25, (mesh, t) => {
        mesh.material.opacity = t * (0.8 - i * 0.1);
      });
    }
  }

  function createSwordArc(data) {
    const scene = GameEngine.getScene();
    if (!scene) return;
    // Simplified: just particles at sword position for remote
    const pos = new THREE.Vector3(data.position.x, data.position.y + 1, data.position.z);
    hitParticles(pos, 0xff6600, scene);
  }

  // ─── Screen Flash (on damage) ─────────────────────────────────────────────

  function showHitFlash() {
    const el = document.getElementById('hit-indicator');
    if (!el) return;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    requestAnimationFrame(() => {
      el.style.animation = '';
      setTimeout(() => el.classList.add('hidden'), 400);
    });
  }

  return {
    update,
    createBulletTrailLocal, createBulletTrail,
    muzzleFlash, hitParticles,
    swordArc, createSwordArc,
    showHitFlash
  };
})();
