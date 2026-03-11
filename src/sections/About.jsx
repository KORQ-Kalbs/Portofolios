/**
 * About.jsx — Shallow Zone: Poly Fish Swarm + Kelp Forest + Skill Pods
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  THREE.JS SYSTEMS                                                         ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  1. FISH BOIDS (InstancedMesh — 1 draw call / 45 fish)                  ║
 * ║     • Low-poly geometry: 9 triangles, flat-shading (MeshPhongMaterial)   ║
 * ║     • Boids: Separation + Alignment + Cohesion + MouseFlee               ║
 * ║     • Mouse flee radius: 3.8 units (Raycaster → floor plane Y=0)        ║
 * ║     • Instance orientation: lookAt(pos + velocity) per frame             ║
 * ║     • Per-instance color: InstancedMesh.setColorAt()                     ║
 * ║                                                                           ║
 * ║  2. KELP FOREST (InstancedMesh — 1 draw call / 20 stalks)               ║
 * ║     • TubeGeometry, CatmullRomCurve3, 10 segments, radius 0.055          ║
 * ║     • Custom vertex shader sway:                                          ║
 * ║         Pv = Pi + sin(Pi.y × 0.5 + uTime × 2.0 + phase) × 0.2          ║
 * ║     • Per-instance phase offset: InstancedBufferAttribute                ║
 * ║     • Per-instance scale (height variance): InstancedBufferAttribute     ║
 * ║     • vHeightFactor^1.8: ujung bergerak banyak, dasar diam              ║
 * ║                                                                           ║
 * ║  3. SEABED (PlaneGeometry — 48W × 24H, 48×24 segments)                  ║
 * ║     • Vertex count IDENTIK dengan Projects floor untuk morphing          ║
 * ║     • Sandy displacement: layered sine waves                              ║
 * ║     • Positions di-export via window.__aboutFloorPositions               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * SKILL PODS:
 *   HTML div glassmorphism + GSAP infinite bob (per-pod unique frequency).
 *   Tidak ada Three.js untuk pods (HTML lebih fleksibel, lebih readable).
 *
 * LIGHT: LightContext → useLightRef() → mainLight update per frame.
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLightRef } from "../context/LightContext";

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
const SKILLS = [
  { name: "React", icon: "⚛️", level: 90, color: "#0ea5e9", cat: "Frontend" },
  {
    name: "JavaScript",
    icon: "🟡",
    level: 88,
    color: "#eab308",
    cat: "Language",
  },
  { name: "Node.js", icon: "🟩", level: 75, color: "#22c55e", cat: "Backend" },
  { name: "Laravel", icon: "🔴", level: 80, color: "#f43f5e", cat: "Backend" },
  { name: "PHP", icon: "🐘", level: 78, color: "#818cf8", cat: "Language" },
  { name: "MySQL", icon: "🗄️", level: 82, color: "#f97316", cat: "Database" },
  {
    name: "Tailwind",
    icon: "🎨",
    level: 92,
    color: "#38bdf8",
    cat: "Frontend",
  },
  {
    name: "TypeScript",
    icon: "🔷",
    level: 65,
    color: "#3b82f6",
    cat: "Language",
  },
  { name: "Git", icon: "🌿", level: 85, color: "#4ade80", cat: "DevOps" },
  { name: "Figma", icon: "🖼️", level: 70, color: "#e879f9", cat: "Design" },
  {
    name: "PostgreSQL",
    icon: "🐘",
    level: 65,
    color: "#60a5fa",
    cat: "Database",
  },
  { name: "REST API", icon: "🔌", level: 88, color: "#34d399", cat: "Backend" },
];

// ─────────────────────────────────────────────────────────────────────────────
// KELP SHADERS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * KELP VERTEX SHADER
 *
 * Formula utama (dari prompt):
 *   Pv = Pi + sin(Pi.y × 0.5 + uTime × 2.0) × 0.2
 *
 * Extensions:
 *   + instancePhase : offset unik per stalk (InstancedBufferAttribute)
 *   + instanceScale : tinggi stalk berbeda per instance
 *   + vHeightFactor^1.8 : ujung (ny=1) bergerak jauh, pangkal (ny=0) diam
 *   + Sway di X dan Z (bukan Y) agar stalk tidak naik-turun
 *
 * CARA KERJA instancePhase (InstancedBufferAttribute):
 *   THREE.InstancedMesh + geometry.setAttribute('instancePhase',
 *     new THREE.InstancedBufferAttribute(phases, 1))
 *   → divisor=1: GL memberikan satu nilai per INSTANCE, bukan per vertex.
 *   → Setiap stalk mendapat fasenya sendiri → tidak sinkron.
 */
const KELP_VS = /* glsl */ `
  precision highp float;

  /* Uniforms (shared, berubah per frame) */
  uniform float uTime;

  /* Instance attributes: SATU nilai per instance (bukan per vertex)
   * Ini adalah kunci "variation antar stalk" tanpa multiple draw calls. */
  attribute float instancePhase;  /* random [0, 2π] per stalk              */
  attribute float instanceScale;  /* random [0.7, 1.3] per stalk           */

  /* Varyings ke fragment */
  varying float vHeightFactor;    /* 0=pangkal, 1=ujung                    */
  varying float vSwayMag;         /* magnitude sway (untuk color highlight) */

  void main() {
    /* ── Height factor ──────────────────────────────────────────────────
     * TubeGeometry dibangun dari Y=0 ke Y=KELP_HEIGHT (3.0).
     * vHeightFactor: seberapa tinggi vertex ini di dalam stalk.          */
    float kelpHeight   = 3.0 * instanceScale;
    vHeightFactor      = clamp(position.y / max(kelpHeight, 0.01), 0.0, 1.0);

    /* ── Sway envelope ───────────────────────────────────────────────────
     * Sway lebih kuat di ujung: pangkal diam (terikat ke dasar).
     * Exp 1.8: lebih agresif dari linear, lebih smooth dari kuadrat.    */
    float swayEnvelope = pow(vHeightFactor, 1.8);
    float amplitude    = swayEnvelope * 0.22;

    /* ── Sway formula (dari prompt, extended) ───────────────────────────
     * swayX = sin(Pi.y × 0.5 + uTime × 2.0 + instancePhase) × 0.2
     * swayZ = sin(Pi.y × 0.38 + uTime × 1.55 + instancePhase×1.32) × 0.2×0.45
     * (dua sumbu: lebih natural dari satu sumbu saja)                   */
    float swayX = sin(position.y * 0.5  + uTime * 2.0  + instancePhase) * amplitude;
    float swayZ = sin(position.y * 0.38 + uTime * 1.55 + instancePhase * 1.32) * amplitude * 0.45;
    vSwayMag    = abs(swayX);

    /* ── Terapkan sway dan scale ─────────────────────────────────────── */
    vec3 pos = position;
    pos.x   += swayX;
    pos.z   += swayZ;
    pos.y   *= instanceScale;          /* stretch stalk sesuai instanceScale */

    /* ── Instance transform ──────────────────────────────────────────────
     * instanceMatrix: mat4 yang di-set oleh InstancedMesh.setMatrixAt().
     * Di-provide otomatis oleh THREE.js untuk InstancedMesh.            */
    vec4 worldPos   = instanceMatrix * vec4(pos, 1.0);
    gl_Position     = projectionMatrix * viewMatrix * worldPos;
  }
`;

const KELP_FS = /* glsl */ `
  precision mediump float;
  varying float vHeightFactor;
  varying float vSwayMag;

  void main() {
    /* Gradient olive ke sea-green dari pangkal ke ujung */
    vec3 rootCol = vec3(0.08, 0.20, 0.06);   /* dark olive-green */
    vec3 tipCol  = vec3(0.16, 0.50, 0.26);   /* bright sea-green */
    /* Quadratic gradient: lebih dramatis di ujung */
    vec3 col = mix(rootCol, tipCol, vHeightFactor * vHeightFactor);

    /* Light catch: sedikit highlight di sisi yang lagi sway */
    col += vec3(0.04, 0.08, 0.04) * vSwayMag * vHeightFactor;

    /* Tip translucency (pangkal opaque, ujung semi-transparan) */
    float alpha = mix(1.0, 0.50, vHeightFactor * vHeightFactor);

    gl_FragColor = vec4(col, alpha);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// FISH GEOMETRY (9 triangles, low-poly, flat shading)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Low-poly fish dengan 9 triangles (unindexed untuk flat normals).
 * Fish menghadap +X direction (nose ke kanan).
 * InstancedMesh akan rotate sesuai velocity per frame.
 *
 * Top view:           Side view:
 *    ╱ ╲ (tail)           fin
 *   │fin│                  │
 *    ╲ ╱  ═══ (body)  ──── nose
 *
 * Unindexed geometry → computeVertexNormals() = per-face normal = flat look.
 */
function createFishGeo() {
  /* Named vertices */
  const nose = [0.6, 0.0, 0.0];
  const topL = [0.0, 0.2, 0.14];
  const topR = [0.0, 0.2, -0.14];
  const botL = [0.0, -0.16, 0.12];
  const botR = [0.0, -0.16, -0.12];
  const tail = [-0.5, 0.0, 0.0];
  const tailTL = [-0.62, 0.3, 0.08];
  const tailBL = [-0.62, -0.3, 0.08];
  const finTop = [0.1, 0.4, 0.0];

  /* 9 triangles (unindexed → 27 vertices × 3 = 81 floats) */
  const tris = [
    nose,
    topL,
    botL /* body kiri        */,
    topL,
    tail,
    botL /* body kiri belakang */,
    nose,
    botR,
    topR /* body kanan       */,
    topR,
    botR,
    tail /* body kanan belakang */,
    nose,
    topR,
    topL /* atap atas        */,
    topL,
    topR,
    tail /* atap belakang    */,
    nose,
    botL,
    botR /* bawah atas       */,
    botL,
    botR,
    tail /* bawah belakang   */,
    tail,
    tailTL,
    tailBL /* sirip ekor       */,
  ];

  const pos = new Float32Array(tris.length * 3);
  tris.forEach((v, i) => {
    pos[i * 3] = v[0];
    pos[i * 3 + 1] = v[1];
    pos[i * 3 + 2] = v[2];
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals(); /* unindexed → per-face normals → flat look */
  return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOID CLASS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Satu agen dalam simulasi kawanan ikan.
 *
 * RULES (diaplikasikan setiap frame):
 *   1. Separation : jauhi tetangga yang terlalu dekat
 *   2. Alignment  : ikuti arah rata-rata tetangga
 *   3. Cohesion   : bergerak ke pusat massa kelompok lokal
 *   4. Mouse Flee : lari dari mouse jika dalam radius
 *   5. Boundary   : putar balik halus jika terlalu jauh dari center
 *
 * Complexity: O(n²) per frame — acceptable untuk n=45 fish.
 */
class Boid {
  constructor(bounds) {
    /* bounds: { x, y, z } half-extents area renang */
    this.bounds = bounds;
    this.maxSpeed = 0.05 + Math.random() * 0.02;
    this.maxForce = 0.0038 + Math.random() * 0.0018;

    /* Random spawn dalam bounds */
    this.pos = new THREE.Vector3(
      (Math.random() - 0.5) * bounds.x * 1.8,
      (Math.random() - 0.5) * bounds.y * 1.4,
      (Math.random() - 0.5) * bounds.z * 1.8,
    );
    /* Kecepatan awal: arah acak, magnitude near-maxSpeed */
    this.vel = new THREE.Vector3(
      Math.random() - 0.5,
      (Math.random() - 0.5) * 0.25 /* gerakan vertikal minimal */,
      Math.random() - 0.5,
    )
      .normalize()
      .multiplyScalar(0.03 + Math.random() * 0.02);

    this.acc = new THREE.Vector3(); /* reset setiap frame */
  }

  /** Limit vector ke maxLength. Modifies in-place, returns this. */
  _limit(v, max) {
    if (v.length() > max) v.normalize().multiplyScalar(max);
    return v;
  }

  /** Steering force: dari velocity saat ini menuju target velocity. */
  _steer(desired) {
    return this._limit(desired.sub(this.vel), this.maxForce);
  }

  /* ── Boids rules ─────────────────────────────────────────────────────── */

  separation(boids, dist = 1.4) {
    const steer = new THREE.Vector3();
    let count = 0;
    for (const other of boids) {
      if (other === this) continue;
      const d = this.pos.distanceTo(other.pos);
      if (d < dist && d > 0.001) {
        steer.add(this.pos.clone().sub(other.pos).normalize().divideScalar(d));
        count++;
      }
    }
    if (count > 0) steer.divideScalar(count);
    if (steer.length() > 0) {
      steer.normalize().multiplyScalar(this.maxSpeed);
      this._steer(steer);
    }
    return steer;
  }

  alignment(boids, dist = 3.5) {
    const avg = new THREE.Vector3();
    let count = 0;
    for (const other of boids) {
      if (other === this) continue;
      if (this.pos.distanceTo(other.pos) < dist) {
        avg.add(other.vel);
        count++;
      }
    }
    if (count > 0) {
      avg.divideScalar(count).normalize().multiplyScalar(this.maxSpeed);
      return this._steer(avg);
    }
    return new THREE.Vector3();
  }

  cohesion(boids, dist = 4.0) {
    const center = new THREE.Vector3();
    let count = 0;
    for (const other of boids) {
      if (other === this) continue;
      if (this.pos.distanceTo(other.pos) < dist) {
        center.add(other.pos);
        count++;
      }
    }
    if (count > 0) {
      center.divideScalar(count);
      const desired = center
        .sub(this.pos)
        .normalize()
        .multiplyScalar(this.maxSpeed);
      return this._steer(desired);
    }
    return new THREE.Vector3();
  }

  /** Mouse flee: lari jika dalam radius fleeR. */
  fleeMouse(mouseW, fleeR = 3.8) {
    const d = this.pos.distanceTo(mouseW);
    if (d < fleeR && d > 0.001) {
      const strength = Math.pow((fleeR - d) / fleeR, 1.5) * 3.5;
      return this.pos
        .clone()
        .sub(mouseW)
        .normalize()
        .multiplyScalar(this.maxForce * strength);
    }
    return new THREE.Vector3();
  }

  /** Soft boundary: steer balik jika mendekati tepi. */
  boundary(margin = 1.5) {
    const { x, y, z } = this.bounds;
    const f = this.maxForce * 2.2;
    const s = new THREE.Vector3(
      this.pos.x > x - margin ? -f : this.pos.x < -x + margin ? f : 0,
      this.pos.y > y - margin
        ? -f * 0.7
        : this.pos.y < -y + margin
          ? f * 0.7
          : 0,
      this.pos.z > z - margin ? -f : this.pos.z < -z + margin ? f : 0,
    );
    return s;
  }

  /** Update: apply all rules, integrate velocity. */
  update(boids, mouseW) {
    this.acc.set(0, 0, 0);
    this.acc.add(this.separation(boids).multiplyScalar(1.6));
    this.acc.add(this.alignment(boids).multiplyScalar(1.0));
    this.acc.add(this.cohesion(boids).multiplyScalar(0.8));
    this.acc.add(this.fleeMouse(mouseW).multiplyScalar(1.0));
    this.acc.add(this.boundary());
    this.vel.add(this.acc);
    this._limit(this.vel, this.maxSpeed);
    this.pos.add(this.vel);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THREE.JS SCENE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Build complete About section Three.js scene.
 *
 * DRAW CALLS: 1 (fish) + 1 (kelp) + 1 (floor) = 3 total.
 * Performance target: maintain 60fps on mobile/mid-range GPU.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number}            h       — canvas height in pixels
 * @param {object}            iLight  — initial light data from LightContext
 */
function buildScene(canvas, h, iLight) {
  const W = canvas.clientWidth || window.innerWidth;
  const H = h || window.innerHeight;

  /* ── Renderer ─────────────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false; /* no shadows = significant perf gain */

  /* ── Scene ───────────────────────────────────────────────────────────── */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x041a0e, 0.03);

  /* ── Camera ──────────────────────────────────────────────────────────── */
  const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 80);
  camera.position.set(0, 3.5, 13);
  camera.lookAt(0, -0.5, 0);

  /* ══════════════════════════════════════════════════════════════════════
   * LIGHTING (diupdate per frame dari LightContext)
   * ══════════════════════════════════════════════════════════════════════ */
  const lc = iLight.color;
  const mainLight = new THREE.PointLight(
    new THREE.Color(lc[0], lc[1], lc[2]),
    iLight.intensity * 0.28,
    65,
    1.2,
  );
  const lp = iLight.pos;
  mainLight.position.set(lp.x * 0.25, 9, lp.z * 0.25);
  scene.add(mainLight);

  /* Ambient teal (underwater scattered light) */
  const ambLight = new THREE.AmbientLight(0x041a10, 2.4);
  scene.add(ambLight);

  /* Fill dari atas (cahaya permukaan menembus) */
  const fillLight = new THREE.DirectionalLight(0x0a4030, 0.7);
  fillLight.position.set(0, 12, 5);
  scene.add(fillLight);

  /* ══════════════════════════════════════════════════════════════════════
   * SEABED — PlaneGeometry 48×24, 48×24 segmen
   * IDENTIK dengan Projects floor untuk vertex-level morphing.
   * ══════════════════════════════════════════════════════════════════════ */
  const SEG_W = 48,
    SEG_H = 24;
  const floorGeo = new THREE.PlaneGeometry(48, 24, SEG_W, SEG_H);
  floorGeo.rotateX(-Math.PI / 2);

  const fPos = floorGeo.attributes.position;
  const fCount = fPos.count;

  /* Sandy seabed: layered sine untuk gentle bumps */
  const aboutPos = new Float32Array(fCount * 3);
  for (let i = 0; i < fCount; i++) {
    const x = fPos.getX(i),
      z = fPos.getZ(i);
    const bump =
      Math.sin(x * 0.32) * Math.cos(z * 0.26) * 0.55 +
      Math.sin(x * 0.78 + 1.1) * Math.cos(z * 0.62) * 0.28 +
      Math.sin(x * 1.45 + 0.9) * Math.cos(z * 1.18 + 0.5) * 0.12;
    const newY = -5.5 + bump;
    fPos.setY(i, newY);
    aboutPos[i * 3] = fPos.getX(i);
    aboutPos[i * 3 + 1] = newY;
    aboutPos[i * 3 + 2] = fPos.getZ(i);
  }
  fPos.needsUpdate = true;
  floorGeo.computeVertexNormals();

  /* Export untuk Projects floor morphing */
  window.__aboutFloorPositions = aboutPos;
  window.__aboutFloorSegW = SEG_W;
  window.__aboutFloorSegH = SEG_H;

  const floorMat = new THREE.MeshLambertMaterial({ color: 0x0c2010 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  scene.add(floorMesh);

  /* ══════════════════════════════════════════════════════════════════════
   * KELP FOREST — InstancedMesh (20 stalks, 1 draw call)
   * ══════════════════════════════════════════════════════════════════════ */
  const KELP_N = 20;
  const KELP_HEIGHT = 3.0;

  /* TubeGeometry dari CatmullRomCurve: tegak dengan slight curve */
  const kelpCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.0 * KELP_HEIGHT, 0.0),
    new THREE.Vector3(0.08, 0.4 * KELP_HEIGHT, 0.0),
    new THREE.Vector3(-0.06, 0.7 * KELP_HEIGHT, 0.04),
    new THREE.Vector3(0.0, 1.0 * KELP_HEIGHT, 0.0),
  ]);
  /* TubeGeometry(curve, tubularSeg, radius, radialSeg, closed) */
  const kelpGeo = new THREE.TubeGeometry(kelpCurve, 10, 0.055, 5, false);

  /* InstancedBufferAttribute: satu nilai per instance
   * divisor=1 (default) → gl.vertexAttribDivisor(1) → per-instance */
  const kPhases = new Float32Array(KELP_N).map(
    () => Math.random() * Math.PI * 2,
  );
  const kScales = new Float32Array(KELP_N).map(() => 0.7 + Math.random() * 0.6);
  kelpGeo.setAttribute(
    "instancePhase",
    new THREE.InstancedBufferAttribute(kPhases, 1),
  );
  kelpGeo.setAttribute(
    "instanceScale",
    new THREE.InstancedBufferAttribute(kScales, 1),
  );

  const kelpMat = new THREE.ShaderMaterial({
    vertexShader: KELP_VS,
    fragmentShader: KELP_FS,
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
  });

  const kelpIM = new THREE.InstancedMesh(kelpGeo, kelpMat, KELP_N);
  kelpIM.instanceMatrix.setUsage(
    THREE.StaticDrawUsage,
  ); /* posisi tidak berubah */

  /* Tempatkan kelp di tepi kiri dan kanan scene */
  const dummy = new THREE.Object3D();
  for (let i = 0; i < KELP_N; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const xPos = side * (4.5 + Math.random() * 7.5);
    const zPos = -8 + Math.random() * 14;
    dummy.position.set(xPos, -5.5, zPos);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.updateMatrix();
    kelpIM.setMatrixAt(i, dummy.matrix);
  }
  kelpIM.instanceMatrix.needsUpdate = true;
  scene.add(kelpIM);

  /* ══════════════════════════════════════════════════════════════════════
   * FISH SWARM — InstancedMesh (45 fish, 1 draw call)
   * ══════════════════════════════════════════════════════════════════════ */
  const FISH_N = 45;
  const fishGeo = createFishGeo();
  const fishMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(0.15, 0.62, 0.52),
    emissive: new THREE.Color(0.02, 0.1, 0.08),
    shininess: 45,
    flatShading: true /* KEY: per-face normals = low-poly look */,
  });

  const fishIM = new THREE.InstancedMesh(fishGeo, fishMat, FISH_N);
  fishIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); /* update per frame */
  scene.add(fishIM);

  /* Per-instance color: hue variation dalam teal-hijau range */
  const tmpC = new THREE.Color();
  for (let i = 0; i < FISH_N; i++) {
    tmpC.setHSL(
      0.42 + Math.random() * 0.16,
      0.55 + Math.random() * 0.28,
      0.35 + Math.random() * 0.22,
    );
    fishIM.setColorAt(i, tmpC);
  }
  if (fishIM.instanceColor) fishIM.instanceColor.needsUpdate = true;

  /* Boids array */
  const BOUNDS = { x: 11, y: 3.0, z: 9 };
  const boids = Array.from({ length: FISH_N }, () => new Boid(BOUNDS));

  /* ── Dispose ─────────────────────────────────────────────────────────── */
  const dispose = () => {
    [floorGeo, floorMat, kelpGeo, kelpMat, fishGeo, fishMat].forEach((o) =>
      o?.dispose?.(),
    );
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    kelpMat,
    fishIM,
    boids,
    dummy,
    mainLight,
    ambLight,
    dispose,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL POD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Glassmorphism skill card dengan GSAP infinite bob.
 * Bob frequency berbeda per pod → terlihat organik.
 *
 * @param {{ name, icon, level, color, cat }} skill
 * @param {number} index — untuk stagger delay dan unique frequency
 */
const SkillPod = ({ skill, index }) => {
  const podRef = useRef(null);
  const bobTlRef = useRef(null);

  useEffect(() => {
    if (!podRef.current) return;

    /* Bob: Y oscillation, amplitude ±4–6px, period 2.4–4.5s */
    const dur = 2.4 + index * 0.22;
    const amp = 4 + Math.sin(index * 1.5) * 2;

    bobTlRef.current = gsap.timeline({ repeat: -1, yoyo: true });
    bobTlRef.current.to(podRef.current, {
      y: amp,
      duration: dur,
      ease: "sine.inOut",
      delay: (index * 0.18) % dur,
    });

    /* Slight rotation (sway feeling) */
    gsap.to(podRef.current, {
      rotate: index % 2 === 0 ? 1.2 : -1.2,
      duration: dur * 1.35,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: index * 0.25,
    });

    return () => {
      bobTlRef.current?.kill();
      gsap.killTweensOf(podRef.current);
    };
  }, [index]);

  return (
    <div
      ref={podRef}
      style={{
        background: `linear-gradient(135deg,rgba(4,38,24,0.72),rgba(8,56,38,0.58))`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${skill.color}32`,
        borderRadius: "16px",
        padding: "1.1rem 1.25rem",
        minWidth: "132px",
        cursor: "default",
        willChange: "transform",
        boxShadow: `0 8px 24px rgba(0,0,0,0.38), 0 0 0 1px ${skill.color}14`,
        transition: "box-shadow .3s",
      }}
      onMouseEnter={(e) => {
        gsap.to(e.currentTarget, {
          scale: 1.08,
          duration: 0.2,
          ease: "power2.out",
        });
        e.currentTarget.style.boxShadow = `0 14px 34px rgba(0,0,0,0.48),0 0 0 1px ${skill.color}55,0 0 24px ${skill.color}22`;
      }}
      onMouseLeave={(e) => {
        gsap.to(e.currentTarget, {
          scale: 1.0,
          duration: 0.28,
          ease: "power2.inOut",
        });
        e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.38),0 0 0 1px ${skill.color}14`;
      }}
    >
      <div
        style={{ fontSize: "1.55rem", marginBottom: "0.45rem", lineHeight: 1 }}
      >
        {skill.icon}
      </div>
      <div
        style={{
          fontFamily: "Syne,sans-serif",
          fontWeight: 700,
          fontSize: "0.84rem",
          color: "#d4ede8",
          marginBottom: "0.30rem",
        }}
      >
        {skill.name}
      </div>
      <div
        style={{
          fontFamily: "JetBrains Mono,monospace",
          fontSize: "0.50rem",
          color: skill.color,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "0.65rem",
          opacity: 0.8,
        }}
      >
        {skill.cat}
      </div>
      <div
        style={{
          height: "3px",
          background: "rgba(255,255,255,0.07)",
          borderRadius: "100px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${skill.level}%`,
            background: `linear-gradient(90deg,${skill.color}80,${skill.color})`,
            boxShadow: `0 0 8px ${skill.color}`,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: "JetBrains Mono,monospace",
          fontSize: "0.48rem",
          color: "rgba(170,220,200,0.40)",
          marginTop: "0.28rem",
          textAlign: "right",
        }}
      >
        {skill.level}%
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const About = () => {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const bioRef = useRef(null);
  const skillsRef = useRef(null);

  const mouseRef = useRef(new THREE.Vector3(0, 0, 5)); /* 3D mouse pos */
  const rafRef = useRef(null);
  const elapsedRef = useRef(0);
  const prevTsRef = useRef(null);
  const isInViewRef = useRef(false);
  const lightRef = useLightRef(); /* LightContext ref — no re-render */

  /* ── GSAP entrance ────────────────────────────────────────────────────── */
  useGSAP(
    () => {
      /* Bio cards stagger */
      gsap.fromTo(
        bioRef.current?.querySelectorAll(".bio-item") ?? [],
        { y: 55, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.78,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: bioRef.current,
            start: "top 82%",
            once: true,
          },
        },
      );
      /* Skill pods stagger */
      gsap.fromTo(
        skillsRef.current?.querySelectorAll(".pod-wrap") ?? [],
        { y: 38, opacity: 0, scale: 0.88 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.55,
          stagger: 0.065,
          ease: "back.out(1.4)",
          scrollTrigger: {
            trigger: skillsRef.current,
            start: "top 78%",
            once: true,
          },
        },
      );

      /* IntersectionObserver: pause rAF when off-screen */
      const io = new IntersectionObserver(
        ([e]) => {
          isInViewRef.current = e.isIntersecting;
        },
        { threshold: 0.01 },
      );
      if (sectionRef.current) io.observe(sectionRef.current);
      return () => io.disconnect();
    },
    { scope: sectionRef },
  );

  /* ── Three.js init + rAF ──────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const three = buildScene(canvas, section.offsetHeight, lightRef.current);

    /* Raycaster voor mouse → 3D world (horizontal plane at Y=0) */
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, three.camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        mouseRef.current.copy(hit);
      }
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    /* Resize */
    const onResize = () => {
      const W = canvas.clientWidth,
        H = section.offsetHeight;
      three.camera.aspect = W / H;
      three.camera.updateProjectionMatrix();
      three.renderer.setSize(W, H);
    };
    window.addEventListener("resize", onResize);

    /* Dummy object (reused each frame to build instance matrices) */
    const dummy = new THREE.Object3D();

    /* ── rAF loop ─────────────────────────────────────────────────────── */
    const loop = (ts) => {
      if (prevTsRef.current !== null)
        elapsedRef.current += (ts - prevTsRef.current) * 0.001;
      prevTsRef.current = ts;
      const t = elapsedRef.current;

      /* Suspend rendering when section not visible */
      if (!isInViewRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      /* ── Light update from LightContext ref ──────────────────────────── */
      const lData = lightRef.current;
      three.mainLight.color.setRGB(
        lData.color[0],
        lData.color[1],
        lData.color[2],
      );
      three.mainLight.intensity = lData.intensity * 0.26;
      three.mainLight.position.y = 6 + lData.dayBlend * 5;
      /* Ambient slightly brighter during day */
      three.ambLight.intensity = 2.2 + lData.dayBlend * 1.5;

      /* ── Kelp sway uniform ──────────────────────────────────────────── */
      three.kelpMat.uniforms.uTime.value = t;

      /* ── Boids update → InstancedMesh sync ─────────────────────────── */
      const mouseW = mouseRef.current;
      const boids = three.boids;

      /* Update every boid */
      for (let i = 0; i < boids.length; i++) {
        boids[i].update(boids, mouseW);
      }

      /* Sync to instance matrices */
      for (let i = 0; i < boids.length; i++) {
        const b = boids[i];
        dummy.position.copy(b.pos);
        /* Orient fish toward velocity direction (lookAt trick) */
        if (b.vel.length() > 0.001) {
          const target = b.pos.clone().add(b.vel);
          dummy.lookAt(target);
        }
        /* Slight size variation per fish */
        const sc = 0.36 + (i % 7) * 0.028;
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        three.fishIM.setMatrixAt(i, dummy.matrix);
      }
      three.fishIM.instanceMatrix.needsUpdate = true;

      /* ── Render ─────────────────────────────────────────────────────── */
      three.renderer.render(three.scene, three.camera);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      three.dispose();
    };
  }, []);

  /* ── JSX ──────────────────────────────────────────────────────────────── */
  return (
    <section
      ref={sectionRef}
      id="about"
      style={{
        position: "relative",
        minHeight: "190vh",
        background:
          "linear-gradient(180deg,#010a06 0%,#02200e 30%,#031a0e 65%,#040e08 100%)",
        overflow: "hidden",
      }}
    >
      {/* ── Three.js canvas (z:0, behind HTML content) ─────────────────── */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none",
          mixBlendMode: "screen",
        }}
      />

      {/* ── HTML Content (z:1) ────────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Section label */}
        <div
          style={{
            borderBottom: "1px solid rgba(30,180,110,0.10)",
            padding: "4rem 3rem 1.5rem",
          }}
        >
          <span
            style={{
              fontFamily: "JetBrains Mono,monospace",
              fontSize: "0.60rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(40,180,120,0.45)",
            }}
          >
            ↓ 01 / About
          </span>
        </div>

        {/* ── BIO SECTION ─────────────────────────────────────────────── */}
        <div
          ref={bioRef}
          style={{ maxWidth: "1200px", margin: "0 auto", padding: "4rem 3rem" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "3.5rem",
              alignItems: "start",
            }}
          >
            {/* Left column */}
            <div className="bio-item">
              <h2
                style={{
                  fontFamily: "Syne,sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(1.9rem,5vw,3.2rem)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.03em",
                  color: "#a8d8c0",
                  marginBottom: "1.4rem",
                }}
              >
                HELLO,
                <br />
                <span
                  style={{
                    color: "transparent",
                    WebkitTextStroke: "1px rgba(40,200,120,0.42)",
                  }}
                >
                  I'M A BUILDER.
                </span>
              </h2>
              <p
                style={{
                  fontFamily: "Outfit,sans-serif",
                  fontWeight: 300,
                  fontSize: "1rem",
                  lineHeight: 1.8,
                  color: "rgba(140,210,175,0.68)",
                  maxWidth: "380px",
                }}
              >
                Pelajar full-stack developer dari{" "}
                <span style={{ color: "#28c890", fontWeight: 500 }}>
                  SMK Negeri 4 Bogor
                </span>{" "}
                yang passionate dalam web engineering dan pengalaman interaktif.
              </p>
              <div
                style={{
                  marginTop: "2rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.65rem",
                }}
              >
                {[
                  ["📍", "Bogor, Jawa Barat"],
                  ["🎓", "SMK Negeri 4 Bogor — RPL"],
                  ["🌐", "Full-Stack Web Dev"],
                  ["⚡", "Open to Internship"],
                ].map(([ic, v]) => (
                  <div
                    key={v}
                    style={{
                      display: "flex",
                      gap: "1rem",
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "JetBrains Mono,monospace",
                        fontSize: "0.60rem",
                        letterSpacing: "0.10em",
                        color: "rgba(40,200,120,0.42)",
                        minWidth: "26px",
                      }}
                    >
                      {ic}
                    </span>
                    <span
                      style={{
                        fontFamily: "Outfit,sans-serif",
                        fontSize: "0.86rem",
                        color: "rgba(180,230,205,0.72)",
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column */}
            <div
              className="bio-item"
              style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
            >
              <blockquote
                style={{
                  borderLeft: "2px solid rgba(40,200,120,0.28)",
                  paddingLeft: "1.5rem",
                  fontFamily: "Syne,sans-serif",
                  fontStyle: "italic",
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  lineHeight: 1.6,
                  color: "rgba(140,210,175,0.60)",
                }}
              >
                "The ocean teaches us that even the deepest pressure creates the
                most brilliant light."
              </blockquote>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: "1rem",
                }}
              >
                {[
                  ["15+", "Projects"],
                  ["3+", "Years"],
                  ["8", "Technologies"],
                ].map(([n, l]) => (
                  <div
                    key={l}
                    style={{
                      padding: "1.1rem 0.9rem",
                      background: "rgba(4,28,16,0.55)",
                      border: "1px solid rgba(30,180,100,0.10)",
                      borderRadius: "10px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "Syne,sans-serif",
                        fontWeight: 800,
                        fontSize: "1.55rem",
                        color: "#28c890",
                        textShadow: "0 0 14px rgba(40,200,130,0.32)",
                      }}
                    >
                      {n}
                    </div>
                    <div
                      style={{
                        fontFamily: "JetBrains Mono,monospace",
                        fontSize: "0.52rem",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "rgba(80,180,120,0.40)",
                        marginTop: "4px",
                      }}
                    >
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── SKILLS PODS ─────────────────────────────────────────────── */}
        <div
          ref={skillsRef}
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 3rem 7rem",
          }}
        >
          {/* Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              marginBottom: "3rem",
            }}
          >
            <h3
              style={{
                fontFamily: "Syne,sans-serif",
                fontWeight: 800,
                fontSize: "clamp(1.4rem,3.5vw,2.3rem)",
                color: "#a8d8c0",
                letterSpacing: "-0.02em",
              }}
            >
              SKILL PODS
            </h3>
            <div
              style={{
                flex: 1,
                height: "1px",
                background:
                  "linear-gradient(90deg,rgba(40,200,120,0.22),transparent)",
              }}
            />
            <span
              style={{
                fontFamily: "JetBrains Mono,monospace",
                fontSize: "0.58rem",
                letterSpacing: "0.18em",
                color: "rgba(40,200,120,0.32)",
                textTransform: "uppercase",
              }}
            >
              {SKILLS.length} techs
            </span>
          </div>

          {/* Pods grid */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1.2rem",
              alignItems: "flex-start",
            }}
          >
            {SKILLS.map((skill, i) => (
              <div
                key={skill.name}
                className="pod-wrap"
                style={{ willChange: "transform, opacity" }}
              >
                <SkillPod skill={skill} index={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
