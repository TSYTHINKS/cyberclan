/**
 * Terrain Module — Procedural voxel battlefield generation
 * Creates walls, towers, cover blocks with cyberpunk aesthetic
 */

const Terrain = (() => {

  // Voxel size constant
  const VOXEL = 1;

  // Shared materials for performance (reuse across blocks)
  let materials = {};

  /**
   * Build all terrain materials with neon cyberpunk textures
   */
  function buildMaterials() {
    // Ground: dark tiled surface
    const groundGeo = null; // created per usage
    materials.ground = new THREE.MeshLambertMaterial({ color: 0x0a1520 });
    materials.wall   = new THREE.MeshLambertMaterial({ color: 0x0d2035 });
    materials.wallGlow = new THREE.MeshLambertMaterial({
      color: 0x003344,
      emissive: 0x001122,
      emissiveIntensity: 0.5
    });
    materials.accent = new THREE.MeshLambertMaterial({
      color: 0x00ffff,
      emissive: 0x00aaaa,
      emissiveIntensity: 0.8
    });
    materials.tower  = new THREE.MeshLambertMaterial({ color: 0x0a1a2a });
    materials.cover  = new THREE.MeshLambertMaterial({ color: 0x142030 });
  }

  /**
   * Create a single voxel block (box mesh)
   * @param {number} x,y,z - position
   * @param {number} w,h,d - size
   * @param {THREE.Material} mat
   */
  function voxel(scene, x, y, z, w, h, d, mat) {
    const geo  = new THREE.BoxGeometry(w * VOXEL, h * VOXEL, d * VOXEL);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + w/2, y + h/2, z + d/2);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  /**
   * Create neon accent strip (thin glowing bar)
   */
  function accentStrip(scene, x, y, z, w, d) {
    const mesh = voxel(scene, x, y, z, w, 0.1, d, materials.accent);
    // Add point light at strip center for glow
    const light = new THREE.PointLight(0x00ffff, 0.5, 6);
    light.position.copy(mesh.position);
    scene.add(light);
    return mesh;
  }

  /**
   * Build a wall with accent strips
   */
  function buildWall(scene, x, z, width, height, depth, horizontal = true) {
    const w = horizontal ? width : depth;
    const d = horizontal ? depth : width;
    voxel(scene, x, 0, z, w, height, d, materials.wall);
    // Neon top accent
    accentStrip(scene, x, height, z, w, d);
  }

  /**
   * Build a tower at position
   */
  function buildTower(scene, x, z, floors = 4) {
    const size = 3;
    // Base
    voxel(scene, x, 0, z, size, floors * 2, size, materials.tower);
    // Battlements on top
    for (let i = 0; i < 4; i++) {
      const bx = i < 2 ? x + (i % 2) * (size - 1) : x + size/2 - 0.5;
      const bz = i >= 2 ? z + (i % 2) * (size - 1) : z + size/2 - 0.5;
      voxel(scene, bx, floors*2, bz, 1, 1, 1, materials.wallGlow);
    }
    // Neon accent ring
    accentStrip(scene, x, floors * 2, z, size, size);
  }

  /**
   * Build cover blocks (low barriers)
   */
  function buildCover(scene, x, z, len, horizontal = true) {
    const w = horizontal ? len : 1;
    const d = horizontal ? 1 : len;
    voxel(scene, x, 0, z, w, 1.2, d, materials.cover);
    accentStrip(scene, x, 1.2, z, w, d);
  }

  /**
   * Build the full battlefield
   * Returns array of collision boxes for player physics
   */
  function build(scene) {
    buildMaterials();
    const colliders = []; // {min, max} AABB boxes

    // ─── Ground plane ───────────────────────────────────────────────────
    const groundGeo  = new THREE.PlaneGeometry(80, 80, 20, 20);
    const groundMesh = new THREE.Mesh(groundGeo, materials.ground);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Ground grid lines (neon effect)
    const gridHelper = new THREE.GridHelper(80, 40, 0x001122, 0x002233);
    scene.add(gridHelper);

    // ─── Outer boundary walls ────────────────────────────────────────────
    // North wall
    buildWall(scene, -40, -40, 80, 4, 1);
    colliders.push({ min: { x:-40,y:0,z:-40 }, max: { x:40,y:4,z:-39 } });
    // South wall
    buildWall(scene, -40, 39, 80, 4, 1);
    colliders.push({ min: { x:-40,y:0,z:39 }, max: { x:40,y:4,z:40 } });
    // West wall
    buildWall(scene, -40, -40, 1, 4, 80, false);
    colliders.push({ min: { x:-40,y:0,z:-40 }, max: { x:-39,y:4,z:40 } });
    // East wall
    buildWall(scene, 39, -40, 1, 4, 80, false);
    colliders.push({ min: { x:39,y:0,z:-40 }, max: { x:40,y:4,z:40 } });

    // ─── Corner towers ────────────────────────────────────────────────────
    [[-38,-38],[35,-38],[-38,35],[35,35]].forEach(([tx,tz]) => {
      buildTower(scene, tx, tz, 4);
      colliders.push({ min:{x:tx,y:0,z:tz}, max:{x:tx+3,y:8,z:tz+3} });
    });

    // ─── Center structure ────────────────────────────────────────────────
    // Central platform
    voxel(scene, -5, 0, -5, 10, 0.5, 10, materials.wallGlow);
    colliders.push({ min:{x:-5,y:0,z:-5}, max:{x:5,y:1,z:5} });
    // Center pillar
    buildTower(scene, -1.5, -1.5, 3);
    colliders.push({ min:{x:-1.5,y:0,z:-1.5}, max:{x:1.5,y:6,z:1.5} });

    // ─── Mid-field cover blocks ───────────────────────────────────────────
    const coverPositions = [
      // Left side
      [-15, -8, 5, true],  [-15, 8, 5, true],
      [-10, -15, 1, false], [-10, 12, 1, false],
      // Right side
      [10, -8, 5, true],   [10, 8, 5, true],
      [5, -15, 1, false],  [5, 12, 1, false],
      // Mid lanes
      [-5, -20, 4, true],  [-5, 17, 4, true],
      [1, -20, 4, true],   [1, 17, 4, true],
    ];
    coverPositions.forEach(([x, z, len, horiz]) => {
      buildCover(scene, x, z, len, horiz);
      const w = horiz ? len : 1;
      const d = horiz ? 1 : len;
      colliders.push({ min:{x,y:0,z}, max:{x:x+w,y:1.5,z:z+d} });
    });

    // ─── Spawn area walls (team bases) ────────────────────────────────────
    // Team 1 base (left)
    buildWall(scene, -30, -8, 12, 2.5, 1);
    buildWall(scene, -30, 7, 12, 2.5, 1);
    colliders.push({ min:{x:-30,y:0,z:-8}, max:{x:-18,y:2.5,z:-7} });
    colliders.push({ min:{x:-30,y:0,z:7},  max:{x:-18,y:2.5,z:8} });

    // Team 2 base (right)
    buildWall(scene, 18, -8, 12, 2.5, 1);
    buildWall(scene, 18, 7, 12, 2.5, 1);
    colliders.push({ min:{x:18,y:0,z:-8}, max:{x:30,y:2.5,z:-7} });
    colliders.push({ min:{x:18,y:0,z:7},  max:{x:30,y:2.5,z:8} });

    // ─── Random scatter cover ────────────────────────────────────────────
    const rng = mulberry32(42); // seeded random for consistent map
    for (let i = 0; i < 12; i++) {
      const rx = (rng() * 40) - 20;
      const rz = (rng() * 40) - 20;
      if (Math.abs(rx) < 6 && Math.abs(rz) < 6) continue; // skip center
      const horiz = rng() > 0.5;
      const len = Math.floor(rng() * 3) + 2;
      buildCover(scene, rx, rz, len, horiz);
    }

    return colliders;
  }

  /** Simple seeded RNG (mulberry32) */
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  return { build };
})();
