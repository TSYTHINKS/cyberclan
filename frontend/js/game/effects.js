/**
 * Effects Module — Visual effects
 * Bullet trails, muzzle flash, hit particles, sword arc,
 * screen flash, death explosion
 */

const Effects = (() => {
  const activeEffects = [];

  function addEffect(mesh, scene, duration, onUpdate) {
    scene.add(mesh);
    activeEffects.push({ mesh, scene, life: duration, maxLife: duration, onUpdate: onUpdate || null });
  }

  function update(dt) {
    for (let i = activeEffects.length - 1; i >= 0; i--) {
      const fx = activeEffects[i];
      fx.life -= dt;
      const t = fx.life / fx.maxLife;
      if (fx.onUpdate) fx.onUpdate(fx.mesh, t);
      if (fx.life <= 0) {
        fx.scene.remove(fx.mesh);
        if (fx.mesh.geometry) fx.mesh.geometry.dispose();
        if (fx.mesh.material) {
          if (Array.isArray(fx.mesh.material)) fx.mesh.material.forEach(m => m.dispose());
          else fx.mesh.material.dispose();
        }
        activeEffects.splice(i, 1);
      }
    }
  }

  // ── BULLET TRAIL ──────────────────────────────────────────────────────────

  function createBulletTrailLocal(origin, direction, scene) {
    const end    = origin.clone().addScaledVector(direction, 30);
    const geo    = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const mat    = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
    const line   = new THREE.Line(geo, mat);
    addEffect(line, scene, 0.12, (mesh, t) => { mesh.material.opacity = t * 0.9; });
  }

  function createBulletTrail(data) {
    const scene = GameEngine.getScene();
    if (!scene) return;
    const o   = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
    const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z).normalize();
    createBulletTrailLocal(o, dir, scene);
  }

  // ── MUZZLE FLASH ─────────────────────────────────────────────────────────

  function muzzleFlash(camera) {
    const scene = GameEngine.getScene();
    if (!scene) return;
    const flash = new THREE.PointLight(0x00ffff, 8, 4);
    const dir   = new THREE.Vector3();
    camera.getWorldDirection(dir);
    flash.position.copy(camera.position).addScaledVector(dir, 1.2);
    scene.add(flash);
    const geo  = new THREE.SphereGeometry(0.08, 6, 6);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(flash.position);
    addEffect(mesh, scene, 0.06, (m, t) => {
      m.material.opacity = t;
      m.scale.setScalar(1 + (1 - t) * 2);
    });
    setTimeout(() => scene.remove(flash), 60);
  }

  // ── HIT PARTICLES ─────────────────────────────────────────────────────────

  function hitParticles(position, color, scene) {
    const count = 10;
    const geo   = new THREE.BufferGeometry();
    const verts = [];
    const vels  = [];
    for (let i = 0; i < count; i++) {
      verts.push(position.x, position.y, position.z);
      vels.push(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.12, transparent: true });
    const pts = new THREE.Points(geo, mat);
    const pos = geo.attributes.position;
    addEffect(pts, scene, 0.6, (mesh, t) => {
      mesh.material.opacity = t;
      const arr = pos.array;
      for (let i = 0; i < count; i++) {
        arr[i*3]   += vels[i*3]   * 0.016;
        arr[i*3+1] += vels[i*3+1] * 0.016;
        arr[i*3+1] -= 9.8 * 0.016;
        arr[i*3+2] += vels[i*3+2] * 0.016;
      }
      pos.needsUpdate = true;
    });
  }

  // ── SWORD ARC ─────────────────────────────────────────────────────────────

  function swordArc(camera, scene) {
    const dir   = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    for (let i = 0; i < 5; i++) {
      const angle    = (i / 4 - 0.5) * Math.PI * 0.6;
      const swingDir = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      const start    = camera.position.clone().addScaledVector(right, -0.3).add(new THREE.Vector3(0, -0.3, 0));
      const end      = start.clone().addScaledVector(swingDir, 2.5);
      const geo      = new THREE.BufferGeometry().setFromPoints([start, end]);
      const mat      = new THREE.LineBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.8 });
      const line     = new THREE.Line(geo, mat);
      addEffect(line, scene, 0.25, (mesh, t) => { mesh.material.opacity = t * 0.8; });
    }
  }

  function createSwordArc(data) {
    const scene = GameEngine.getScene();
    if (!scene) return;
    const pos = new THREE.Vector3(data.position.x, data.position.y + 1, data.position.z);
    hitParticles(pos, 0xff6600, scene);
  }

  // ── SCREEN FLASH when hit ─────────────────────────────────────────────────

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

  // ── DEATH EXPLOSION — body breaks into flying cubes ───────────────────────

  function deathExplosion(position, color, scene) {
    const pieces = [];
    for (let i = 0; i < 14; i++) {
      const size = 0.1 + Math.random() * 0.25;
      const geo  = new THREE.BoxGeometry(size, size, size);
      const mat  = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      // Start at the player's position, slightly scattered
      mesh.position.set(
        position.x + (Math.random() - 0.5) * 0.6,
        position.y - 0.5 + Math.random() * 1.2,
        position.z + (Math.random() - 0.5) * 0.6
      );
      // Give each piece a random flying velocity
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 6 + 3,
        (Math.random() - 0.5) * 8
      );
      scene.add(mesh);
      pieces.push({ mesh, vel });
    }

    // Animate pieces flying and falling with gravity
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 0.016;
      pieces.forEach(p => {
        p.vel.y   -= 15 * 0.016; // gravity
        p.mesh.position.addScaledVector(p.vel, 0.016);
        p.mesh.rotation.x += 0.08;
        p.mesh.rotation.z += 0.06;
      });
      // Remove pieces after 2.5 seconds
      if (elapsed > 2.5) {
        clearInterval(interval);
        pieces.forEach(p => scene.remove(p.mesh));
      }
    }, 16);
  }

  return {
    update,
    createBulletTrailLocal, createBulletTrail,
    muzzleFlash, hitParticles,
    swordArc, createSwordArc,
    showHitFlash,
    deathExplosion
  };
})();
