/**
 * Hero.jsx — Three.js 3D Ocean Wave
 *
 * ══════════════════════════════════════════════════════════════════
 * BLANK GAP FIX:
 *   Sebelumnya pakai `GSAP pin: true` yang menyisipkan spacer <div>
 *   kosong di DOM → muncul sebagai halaman kosong antara Hero & About.
 *
 *   SOLUSI: CSS position:sticky
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  <div ref={wrapperRef} style="height:340vh">   ← scroll    │
 *   │    <div style="position:sticky; top:0; height:100vh">      │
 *   │      ... hero content ...                                  │
 *   │    </div>                                                   │
 *   │  </div>                                                     │
 *   │  <section id="about"> ← langsung setelah wrapper, NO GAP   │
 *   └─────────────────────────────────────────────────────────────┘
 *   Sticky div menempel di top=0 selama wrapper masih dalam viewport.
 *   Begitu wrapper habis, sticky terlepas dan About langsung muncul.
 *   Zero blank gap.
 *
 * ══════════════════════════════════════════════════════════════════
 * THREE.JS 3D WAVE:
 *
 *   Kamera: PerspectiveCamera(65°) di (2, 2.5, 10) → lookAt(0, 0, 0)
 *   Ini membuat pandangan sedikit ke kiri-bawah, sehingga wave yang
 *   ada di kiri (-X) terlihat natural.
 *
 *   Wave mesh: PlaneGeometry(30, 18, 100, 60) — subdivisi tinggi
 *   untuk vertex displacement yang halus.
 *
 *   Posisi wave berdasarkan scroll progress p (0→1):
 *     x: -6  → 0    (bergeser dari kiri ke tengah)
 *     z: -16 → 4    (bergerak mendekat ke kamera)
 *
 *   Sehingga di p=0 → wave tampak KECIL, JAUH, di sebelah KIRI.
 *   Di p=0.5 → wave BESAR, SETENGAH JALAN, mendominasi layar.
 *   Di p=0.85 → wave MENGGULUNG BESAR, hampir menutupi layar.
 *   Di p=1.0 → flooded (screen terisi penuh air gelap).
 *
 *   Vertex displacement (CPU-side per frame):
 *     z(x,y,t) = swell + ripple + curlTip
 *     - swell:   sin/cos frekuensi rendah, amplitudo naik seiring p
 *     - ripple:  sin/cos frekuensi tinggi, detail permukaan air
 *     - curlTip: bagian atas wave (y tinggi) condong ke depan (+Z)
 *                seiring p, membentuk efek "breaking wave"
 *
 *   Vertex colors: gradient dari gelap (bawah) ke lime-toxic (atas crest)
 *
 *   Partikel foam: BufferGeometry Points di sepanjang crest,
 *   di-spawn & di-update setiap frame.
 *
 * ══════════════════════════════════════════════════════════════════
 * SCROLL → rAF PIPELINE:
 *   ScrollTrigger.onUpdate → targetProgress
 *   rAF: currentProgress += (target - current) * 0.065  ← LERP "berat air"
 *   rAF: update wave geometry, camera, content float, renderer.render()
 *   Saat scroll stop → target stop → lerp converges → animasi berhenti ✓
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { smoothScrollTo } from "../utils/gsapConfig";

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────
const TITLE_LINES = ["I BUILD", "DIGITAL", "THINGS."];
const TAGS = ["React", "Node.js", "PHP", "Laravel", "Tailwind", "MySQL"];

// Caustic blob config (ambient light shafts)
const CAUSTICS = [
  { x: "10%", y: "20%", size: "38vw", dur: 9, delay: 0 },
  { x: "65%", y: "12%", size: "28vw", dur: 11, delay: 2 },
  { x: "84%", y: "42%", size: "32vw", dur: 10, delay: 0.8 },
  { x: "35%", y: "62%", size: "22vw", dur: 13, delay: 3 },
  { x: "72%", y: "72%", size: "26vw", dur: 8.5, delay: 1.2 },
  { x: "18%", y: "80%", size: "20vw", dur: 12, delay: 2.5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: split text into char <span>s for GSAP per-character animation
// ─────────────────────────────────────────────────────────────────────────────
const SplitChars = ({ text }) =>
  text.split("").map((ch, i) => (
    <span
      key={i}
      className="char"
      style={{ display: "inline-block", willChange: "transform, opacity" }}
    >
      {ch === " " ? "\u00A0" : ch}
    </span>
  ));

// ─────────────────────────────────────────────────────────────────────────────
// THREE.JS HELPERS (defined outside component — no re-creation on re-render)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inisialisasi seluruh scene Three.js.
 * Dipanggil sekali saat mount.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ scene, camera, renderer, waveMesh, backWaveMesh, foamPoints, lights, dispose }}
 */
function initThreeScene(canvas) {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true, // background transparan → CSS bg terlihat
    antialias: true,
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // max 2x untuk perf
  renderer.setClearColor(0x000000, 0); // fully transparent clear

  // ── Scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  // Fog: kesan "underwater murky" — semakin jauh semakin gelap
  scene.fog = new THREE.FogExp2(0x020802, 0.048);

  // ── Camera ────────────────────────────────────────────────────────────────
  // Posisi sedikit ke kanan dan atas → membuat wave di kiri terlihat natural
  const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 120);
  camera.position.set(2.0, 2.5, 10);
  camera.lookAt(0, 0.5, 0);

  // ── Lights ────────────────────────────────────────────────────────────────
  // Ambient: cahaya dasar bawah laut, sangat gelap
  const ambientLight = new THREE.AmbientLight(0x0d2208, 1.8);
  scene.add(ambientLight);

  // Point light di crest → membuat puncak ombak bersinar "toxic"
  const crestLight = new THREE.PointLight(0x88cc22, 4.5, 22, 1.5);
  crestLight.position.set(-3, 6, 2);
  scene.add(crestLight);

  // Directional light dari atas-kanan → highlight permukaan air
  const sunLight = new THREE.DirectionalLight(0xaae044, 1.8);
  sunLight.position.set(8, 12, 4);
  scene.add(sunLight);

  // ── Wave geometry (FRONT — ombak utama) ───────────────────────────────────
  // 100 x 60 segmen untuk displacement yang halus.
  // Width 30, Height 18 unit — besar agar mengisi viewport saat dekat.
  const waveGeo = new THREE.PlaneGeometry(30, 18, 100, 60);

  // Inisialisasi vertex color buffer (3 float per vertex: R,G,B)
  const vCount = waveGeo.attributes.position.count;
  const vColors = new Float32Array(vCount * 3);
  waveGeo.setAttribute("color", new THREE.BufferAttribute(vColors, 3));

  const waveMat = new THREE.MeshPhongMaterial({
    vertexColors: true, // warna dari vertex color buffer
    transparent: true,
    opacity: 0.93,
    shininess: 90,
    specular: new THREE.Color(0x66aa22), // specular olive-green
    side: THREE.FrontSide,
  });

  const waveMesh = new THREE.Mesh(waveGeo, waveMat);
  // Posisi awal: jauh di kiri (-6x) dan jauh dari kamera (-16z)
  waveMesh.position.set(-6, 0, -16);
  // Sedikit miring: tepi bawah ke depan — natural untuk wave face
  waveMesh.rotation.x = -0.1;
  scene.add(waveMesh);

  // ── Back wave (ombak kedua — latar, lebih jauh) ───────────────────────────
  // Lebih besar dan lebih gelap → kedalaman visual
  const backGeo = new THREE.PlaneGeometry(50, 20, 60, 40);
  const bvCount = backGeo.attributes.position.count;
  const bvColors = new Float32Array(bvCount * 3);
  backGeo.setAttribute("color", new THREE.BufferAttribute(bvColors, 3));

  const backMat = new THREE.MeshPhongMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    shininess: 25,
    specular: new THREE.Color(0x336611),
    side: THREE.FrontSide,
  });

  const backWaveMesh = new THREE.Mesh(backGeo, backMat);
  backWaveMesh.position.set(-8, -1, -24); // lebih jauh dan lebih kiri
  backWaveMesh.rotation.x = -0.08;
  scene.add(backWaveMesh);

  // ── Foam particles (titik-titik busa di puncak ombak) ─────────────────────
  const FOAM_COUNT = 320;
  const foamPositions = new Float32Array(FOAM_COUNT * 3);
  const foamGeo = new THREE.BufferGeometry();
  foamGeo.setAttribute("position", new THREE.BufferAttribute(foamPositions, 3));

  const foamMat = new THREE.PointsMaterial({
    color: 0xccee88,
    size: 0.14,
    transparent: true,
    opacity: 0.72,
    sizeAttenuation: true, // partikel lebih jauh → lebih kecil (perspektif)
  });
  const foamPoints = new THREE.Points(foamGeo, foamMat);
  scene.add(foamPoints);

  // ── Spray particles (percikan lebih besar, lebih tinggi) ──────────────────
  const SPRAY_COUNT = 80;
  const sprayPositions = new Float32Array(SPRAY_COUNT * 3);
  const sprayGeo = new THREE.BufferGeometry();
  sprayGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(sprayPositions, 3),
  );

  const sprayMat = new THREE.PointsMaterial({
    color: 0xeeffcc,
    size: 0.22,
    transparent: true,
    opacity: 0.45,
    sizeAttenuation: true,
  });
  const sprayPoints = new THREE.Points(sprayGeo, sprayMat);
  scene.add(sprayPoints);

  // ── Dispose helper (cleanup saat unmount) ─────────────────────────────────
  const dispose = () => {
    waveGeo.dispose();
    waveMat.dispose();
    backGeo.dispose();
    backMat.dispose();
    foamGeo.dispose();
    foamMat.dispose();
    sprayGeo.dispose();
    sprayMat.dispose();
    renderer.dispose();
  };

  return {
    scene,
    camera,
    renderer,
    waveMesh,
    backWaveMesh,
    foamPoints,
    sprayPoints,
    crestLight,
    dispose,
  };
}

/**
 * Update vertex positions & vertex colors pada satu wave mesh.
 * Dipanggil setiap frame di rAF loop.
 *
 * @param {THREE.Mesh}   mesh       - Wave mesh yang akan di-update
 * @param {number}       scrollP    - Scroll progress 0..1 (sudah lerp)
 * @param {number}       time       - Elapsed time in seconds
 * @param {boolean}      isBack     - true jika ini adalah back wave (lebih sederhana)
 */
function updateWaveMesh(mesh, scrollP, time, isBack = false) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const col = geo.attributes.color;
  const count = pos.count;

  // Wave tinggi (amplitudo) naik seiring scroll
  // Back wave sedikit lebih kecil dan lambat
  const ampBase = isBack ? 0.25 : 0.35;
  const ampMax = isBack ? 2.0 : 3.2;
  const amp = ampBase + scrollP * ampMax;

  // Curl: bagian atas (y tinggi) condong ke depan (+Z) seiring scroll
  // Ini yang membentuk "breaking wave" / "tube" di puncak
  const curlStart = 0.28;
  const curlMax = isBack ? 1.8 : 3.5;
  const curlAmt =
    Math.max(0, (scrollP - curlStart) / (1 - curlStart)) * curlMax;

  // Dapatkan batas Y geometry untuk normalisasi
  // (PlaneGeometry default: y dari -height/2 ke +height/2)
  const halfH = isBack ? 10 : 9; // setengah tinggi geometry

  // Warna gradien:
  const cDark = new THREE.Color(0x061005); // sangat gelap di dasar
  const cMid = new THREE.Color(0x1a5810); // olive-green di tengah
  const cLight = new THREE.Color(0x55aa18); // olive-lime di tengah-atas
  const cCrest = new THREE.Color(0x99dd33); // lime-toxic cerah di crest

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    // y normalized: 0 = bawah, 1 = atas
    const ny = (y + halfH) / (halfH * 2);

    // ── Z displacement (vertex bergerak maju-mundur membentuk ombak) ────────
    let z = 0;

    // Swell rendah: ombak besar panjang (frekuensi rendah)
    z += Math.sin(x * 0.18 + time * (isBack ? 0.75 : 0.95)) * amp * 0.65;
    z += Math.cos(x * 0.26 + time * (isBack ? 0.55 : 0.72)) * amp * 0.5;

    // Ripple: detail permukaan air (frekuensi tinggi, amplitudo kecil)
    if (!isBack) {
      z += Math.sin(x * 1.1 + y * 0.4 + time * 2.8) * 0.2;
      z += Math.cos(x * 0.75 - y * 0.5 + time * 2.2) * 0.16;
      z += Math.sin(x * 0.45 + y * 0.3 + time * 1.5) * 0.22;
    } else {
      z += Math.sin(x * 0.6 + time * 1.8) * 0.12;
    }

    // Curl tip: bagian atas ombak (ny > 0.55) condong ke depan
    // Makin tinggi → makin ke depan (exponential feel)
    if (ny > 0.55 && !isBack) {
      const curlFrac = (ny - 0.55) / 0.45; // 0..1 dari 55% ke 100% ketinggian
      z += curlFrac * curlFrac * curlAmt; // kuadratik → lebih dramatis di puncak
    }

    pos.setZ(i, z);

    // ── Vertex color berdasarkan y + displacement ──────────────────────────
    // Warna lebih terang di atas, lebih gelap di bawah
    // Z displacement tinggi (ke depan) = lebih terang (terkena cahaya)
    const brightnessFromZ = Math.max(0, z / (amp * 1.2));
    const colorT = Math.min(1, ny * 0.65 + brightnessFromZ * 0.45);

    let vc = new THREE.Color();
    if (colorT < 0.25) vc.lerpColors(cDark, cMid, colorT / 0.25);
    else if (colorT < 0.6) vc.lerpColors(cMid, cLight, (colorT - 0.25) / 0.35);
    else vc.lerpColors(cLight, cCrest, (colorT - 0.6) / 0.4);

    col.setXYZ(i, vc.r, vc.g, vc.b);
  }

  pos.needsUpdate = true;
  col.needsUpdate = true;
  geo.computeVertexNormals(); // recompute normals untuk lighting yang benar
}

/**
 * Update posisi partikel foam di sepanjang crest wave.
 *
 * @param {THREE.Points} foamPoints  - Points object untuk foam
 * @param {THREE.Points} sprayPoints - Points object untuk spray
 * @param {THREE.Vector3} wavePos    - Posisi mesh wave di dunia
 * @param {number} scrollP
 * @param {number} time
 */
function updateParticles(foamPoints, sprayPoints, wavePos, scrollP, time) {
  const halfH = 9;
  const amp = 0.35 + scrollP * 3.2;
  const curlAmt = Math.max(0, (scrollP - 0.28) / 0.72) * 3.5;

  // ── Foam: tersebar di sepanjang crest ─────────────────────────────────────
  const fPos = foamPoints.geometry.attributes.position;
  const fCount = fPos.count;
  const FOAM_VISIBLE = Math.floor(fCount * Math.min(1, scrollP * 2.5));

  for (let i = 0; i < fCount; i++) {
    if (i >= FOAM_VISIBLE) {
      // Partikel tidak aktif → taruh jauh dari kamera
      fPos.setXYZ(i, 0, -100, 0);
      continue;
    }

    // Distribusi merata di sepanjang lebar wave (-15 to +15)
    const t = i / fCount;
    const x = -15 + t * 30 + Math.sin(time * 2.5 + i * 0.8) * 0.5;
    const ny = 0.8 + Math.sin(time * 3 + i * 1.2) * 0.08; // dekat puncak
    const y = ny * halfH * 2 - halfH;

    // Z displacement di titik ini (sama dengan vertex shader)
    let z = Math.sin(x * 0.18 + time * 0.95) * amp * 0.65;
    z += Math.cos(x * 0.26 + time * 0.72) * amp * 0.5;
    z += ny > 0.55 ? Math.pow((ny - 0.55) / 0.45, 2) * curlAmt : 0;

    // Tambah sedikit random dan drift ke atas untuk foam yang "mengapung"
    z += Math.sin(time * 4.5 + i * 1.8) * 0.18;
    const yFoam = y + Math.abs(Math.sin(time * 3.5 + i * 2.1)) * 0.35;

    fPos.setXYZ(
      i,
      wavePos.x + x,
      wavePos.y + yFoam,
      wavePos.z + z + 0.12, // sedikit di depan surface
    );
  }
  fPos.needsUpdate = true;

  // ── Spray: percikan ke atas melebihi crest ────────────────────────────────
  const sPos = sprayPoints.geometry.attributes.position;
  const sCount = sPos.count;
  const SPRAY_VISIBLE = Math.floor(
    sCount * Math.min(1, Math.max(0, (scrollP - 0.25) / 0.45)),
  );

  for (let i = 0; i < sCount; i++) {
    if (i >= SPRAY_VISIBLE) {
      sPos.setXYZ(i, 0, -100, 0);
      continue;
    }

    const t = i / sCount;
    const x = -12 + t * 24 + Math.sin(time * 1.8 + i * 0.9) * 1.2;
    const ny = 0.88 + Math.abs(Math.sin(time * 2.2 + i * 1.5)) * 0.15;
    const y =
      ny * halfH * 2 - halfH + Math.abs(Math.sin(time * 4.8 + i * 2.8)) * 1.2; // spray ke atas
    let z = Math.sin(x * 0.18 + time * 0.95) * amp * 0.55;
    z += curlAmt * 0.5;
    z += Math.sin(time * 5 + i * 2.2) * 0.28;

    sPos.setXYZ(i, wavePos.x + x, wavePos.y + y, wavePos.z + z + 0.25);
  }
  sPos.needsUpdate = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Hero = () => {
  // ── DOM Refs ────────────────────────────────────────────────────────────────
  const wrapperRef = useRef(null); // outer scroll container (height:340vh)
  const stickyRef = useRef(null); // inner sticky div (height:100vh)
  const threeRef = useRef(null); // Three.js renderer canvas
  const contentRef = useRef(null); // teks & CTA (float up saat scroll)
  const titleRef = useRef(null);
  const subRef = useRef(null);
  const tagsRef = useRef(null);
  const ctaRef = useRef(null);
  const statsRef = useRef(null);
  const depthRef = useRef(null);
  const tabRowRef = useRef(null);
  const causticsRef = useRef(null);

  // ── Animation state (tidak trigger re-render) ───────────────────────────
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const timeRef = useRef(0);
  const lastTsRef = useRef(null);
  const rafRef = useRef(null);
  const threeObjRef = useRef(null); // menyimpan Three.js objects

  // ── GSAP: entrance animation + ScrollTrigger (tanpa pin!) ──────────────
  useGSAP(
    () => {
      // A. Entrance animation chars heading
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        titleRef.current.querySelectorAll(".char"),
        { y: 105, opacity: 0, rotateX: -70, skewX: 4 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          skewX: 0,
          duration: 1.1,
          stagger: 0.023,
        },
        0.2,
      );
      tl.fromTo(
        subRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 },
        "-=0.3",
      );
      tl.fromTo(
        tagsRef.current.querySelectorAll(".tag-chip"),
        { x: -14, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, stagger: 0.06 },
        "-=0.35",
      );
      tl.fromTo(
        ctaRef.current,
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55 },
        "-=0.3",
      )
        .fromTo(
          statsRef.current,
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5 },
          "-=0.28",
        )
        .fromTo(
          tabRowRef.current,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.6 },
          "-=0.2",
        );

      // B. ScrollTrigger pada wrapperRef (BUKAN sticky div)
      //    Tidak ada pin → tidak ada spacer → tidak ada blank gap ✓
      ScrollTrigger.create({
        trigger: wrapperRef.current,
        start: "top top",
        end: "bottom bottom", // end = bawah wrapper = 340vh dari atas
        onUpdate: (self) => {
          targetProgressRef.current = self.progress;
          // Update depth gauge
          if (depthRef.current) {
            depthRef.current.textContent = `${Math.round(self.progress * 85)}m`;
          }
        },
      });

      // C. Caustic light blobs
      causticsRef.current?.querySelectorAll(".caustic").forEach((el, i) => {
        gsap.to(el, {
          scale: 1.35,
          x: `random(-42, 42)`,
          y: `random(-30, 30)`,
          opacity: `random(0.04, 0.16)`,
          duration: CAUSTICS[i]?.dur ?? 10,
          delay: CAUSTICS[i]?.delay ?? 0,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      });
    },
    { scope: wrapperRef },
  );

  // ── Three.js init + rAF loop ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = threeRef.current;
    if (!canvas) return;

    // ── Init Three.js scene ────────────────────────────────────────────────
    const three = initThreeScene(canvas);
    threeObjRef.current = three;

    // ── Resize handler ─────────────────────────────────────────────────────
    const onResize = () => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      three.camera.aspect = W / H;
      three.camera.updateProjectionMatrix();
      three.renderer.setSize(W, H);
    };
    window.addEventListener("resize", onResize);

    // ── rAF render loop ────────────────────────────────────────────────────
    const loop = (ts) => {
      // Delta time
      if (lastTsRef.current !== null) {
        timeRef.current += (ts - lastTsRef.current) * 0.001;
      }
      lastTsRef.current = ts;

      const t = timeRef.current;

      // Lerp current → target progress
      // 0.065 rate = ~15 frame lag = "berat seperti air"
      const cur = currentProgressRef.current;
      const tgt = targetProgressRef.current;
      currentProgressRef.current = cur + (tgt - cur) * 0.065;
      const p = currentProgressRef.current;

      // ── Update wave mesh position (3D approach dari kiri jauh → dekat) ──
      // X: -6 → 0   (bergeser dari kiri ke tengah)
      // Z: -16 → 4  (mendekati kamera)
      // Menggunakan easeInQuad agar accelerasi terasa natural
      const eP = p * p; // ease
      const waveX = -6 + p * 6.0;
      const waveZ = -16 + p * 20.0;
      const waveY = Math.sin(t * 1.1) * 0.18; // bob vertikal ambient

      three.waveMesh.position.set(waveX, waveY, waveZ);

      // Back wave: lebih lambat, selalu lebih jauh
      const bWaveZ = -24 + p * 15.0;
      three.backWaveMesh.position.set(
        waveX * 1.3 - 2,
        waveY * 0.7 - 0.5,
        bWaveZ,
      );

      // ── Update vertex displacement ─────────────────────────────────────
      updateWaveMesh(three.waveMesh, p, t, false);
      updateWaveMesh(three.backWaveMesh, p, t, true);

      // ── Update foam & spray partikel ────────────────────────────────────
      updateParticles(
        three.foamPoints,
        three.sprayPoints,
        three.waveMesh.position,
        p,
        t,
      );

      // ── Gerakkan crest light mengikuti puncak wave ─────────────────────
      three.crestLight.position.set(
        waveX - 1,
        waveY + 5 + Math.sin(t * 1.8) * 0.6,
        waveZ + 2,
      );
      // Intensitas crest light naik seiring gelombang mendekati
      three.crestLight.intensity = 2.0 + p * 6.0;

      // ── Float content up seiring scroll ──────────────────────────────
      if (contentRef.current) {
        const fadeStart = 0.2;
        const fadeEnd = 0.7;
        if (p > fadeStart) {
          const ft = Math.min(1, (p - fadeStart) / (fadeEnd - fadeStart));
          const ease = ft * ft;
          gsap.set(contentRef.current, { y: -ease * 260, opacity: 1 - ease });
        } else {
          gsap.set(contentRef.current, { y: 0, opacity: 1 });
        }
      }

      // ── Render ──────────────────────────────────────────────────────────
      three.renderer.render(three.scene, three.camera);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      three.dispose();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    /*
     * OUTER WRAPPER — scroll container (height: 340vh)
     * ScrollTrigger memonitor ini. Sticky child tetap di viewport
     * selama wrapper masih di-scroll. Begitu habis → About langsung.
     */
    <div
      ref={wrapperRef}
      id="hero"
      style={{ height: "340vh", position: "relative" }}
    >
      {/*
       * INNER STICKY — selalu di top:0, tinggi 100vh
       * Berisi Three.js canvas + semua konten hero.
       * Tidak ada GSAP pin → tidak ada spacer div → tidak ada blank gap.
       */}
      <div
        ref={stickyRef}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          background:
            "linear-gradient(180deg, #030b03 0%, #051005 30%, #071607 65%, #091a09 100%)",
        }}
      >
        {/* ════════════════════════════════════════════════════════
            LAYER 1: CAUSTIC LIGHT BLOBS (z-index 1)
            Cahaya menembus permukaan air, bergerak ambient.
        ════════════════════════════════════════════════════════ */}
        <div
          ref={causticsRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {CAUSTICS.map((c, i) => (
            <div
              key={i}
              className="caustic"
              style={{
                position: "absolute",
                left: c.x,
                top: c.y,
                width: c.size,
                height: c.size,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(110,170,40,0.08) 0%, rgba(70,120,25,0.04) 45%, transparent 70%)",
                opacity: 0.07,
                mixBlendMode: "screen",
              }}
            />
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════
            LAYER 2: SURFACE SHIMMER LINES (z-index 2)
        ════════════════════════════════════════════════════════ */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "72px",
            left: 0,
            right: 0,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              height: "2px",
              background:
                "linear-gradient(90deg,transparent,rgba(150,200,55,0.5) 50%,transparent)",
              animation: "shimH 5.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: "1px",
              marginTop: "4px",
              background:
                "linear-gradient(90deg,transparent 20%,rgba(170,210,70,0.2) 50%,transparent 80%)",
              animation: "shimH 7.5s ease-in-out infinite reverse",
            }}
          />
        </div>

        {/* ════════════════════════════════════════════════════════
            LAYER 3: CONTENT TEXT (z-index 3)
            Float up dihandle oleh rAF loop (contentRef).
        ════════════════════════════════════════════════════════ */}
        <div
          ref={contentRef}
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 2rem",
            paddingTop: "72px",
            position: "relative",
            zIndex: 3,
            willChange: "transform, opacity",
          }}
        >
          {/* Padding navbar */}
          <div style={{ height: "5vh" }} />

          {/* Badge "available for work" */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "100px",
              marginBottom: "2rem",
              border: "1px solid rgba(130,185,50,0.22)",
              background: "rgba(70,110,28,0.07)",
              backdropFilter: "blur(4px)",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#9ab050",
                boxShadow: "0 0 8px #9ab050",
                animation: "dotPulse 2.5s infinite",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontFamily: "JetBrains Mono,monospace",
                fontSize: "0.66rem",
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                color: "#9ab050",
              }}
            >
              Available for work
            </span>
          </div>

          {/* Heading */}
          <div
            ref={titleRef}
            style={{
              perspective: "900px",
              overflow: "hidden",
              paddingBottom: "0.1em",
            }}
          >
            {TITLE_LINES.map((line, li) => (
              <div
                key={li}
                style={{
                  overflow: "hidden",
                  lineHeight: "0.93",
                  paddingBottom: "0.06em",
                }}
              >
                <h1
                  style={{
                    fontFamily: "Syne,sans-serif",
                    fontWeight: 800,
                    fontSize: "clamp(3.5rem,10vw,7.5rem)",
                    letterSpacing: "-0.025em",
                    display: "block",
                    color: li === 1 ? "transparent" : "#d5e8b8",
                    WebkitTextStroke:
                      li === 1 ? "1px rgba(130,185,50,0.62)" : "0",
                    textShadow:
                      li !== 1 ? "0 0 45px rgba(80,130,30,0.14)" : "none",
                  }}
                >
                  <SplitChars text={line} />
                </h1>
              </div>
            ))}
          </div>

          {/* Sub */}
          <p
            ref={subRef}
            style={{
              marginTop: "1.5rem",
              fontFamily: "Outfit,sans-serif",
              fontWeight: 300,
              fontSize: "clamp(0.95rem,2vw,1.2rem)",
              color: "#6e8850",
              maxWidth: "460px",
              lineHeight: 1.65,
            }}
          >
            Student developer at{" "}
            <span style={{ color: "#a0ba70", fontWeight: 500 }}>
              SMK Negeri 4 Bogor
            </span>{" "}
            — crafting full-stack web experiences from the deep.
          </p>

          {/* Tags */}
          <div
            ref={tagsRef}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "1.5rem",
            }}
          >
            {TAGS.map((tag) => (
              <span
                key={tag}
                className="tag-chip"
                style={{
                  padding: "4px 12px",
                  borderRadius: "4px",
                  background: "rgba(70,110,28,0.08)",
                  border: "1px solid rgba(110,160,45,0.20)",
                  fontFamily: "JetBrains Mono,monospace",
                  fontSize: "0.68rem",
                  letterSpacing: "0.06em",
                  color: "#9ab050",
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* CTA buttons */}
          <div
            ref={ctaRef}
            style={{
              display: "flex",
              gap: "1rem",
              marginTop: "2.5rem",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => smoothScrollTo("projects")}
              style={{
                padding: "13px 30px",
                background: "linear-gradient(135deg,#506830,#304518)",
                border: "1px solid rgba(120,175,50,0.28)",
                borderRadius: "6px",
                fontFamily: "Outfit,sans-serif",
                fontWeight: 600,
                fontSize: "0.88rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#c8e090",
                boxShadow: "0 6px 20px rgba(70,110,28,0.22)",
              }}
              onMouseEnter={(e) =>
                gsap.to(e.currentTarget, {
                  y: -3,
                  boxShadow: "0 12px 28px rgba(70,110,28,0.38)",
                  duration: 0.2,
                })
              }
              onMouseLeave={(e) =>
                gsap.to(e.currentTarget, {
                  y: 0,
                  boxShadow: "0 6px 20px rgba(70,110,28,0.22)",
                  duration: 0.25,
                })
              }
            >
              View Projects
            </button>
            <button
              onClick={() => smoothScrollTo("contact")}
              style={{
                padding: "13px 30px",
                background: "rgba(6,15,4,0.45)",
                border: "1px solid rgba(110,160,45,0.18)",
                borderRadius: "6px",
                fontFamily: "Outfit,sans-serif",
                fontWeight: 400,
                fontSize: "0.88rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#688050",
                backdropFilter: "blur(4px)",
                transition: "border-color 0.2s,color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(140,190,55,0.45)";
                e.currentTarget.style.color = "#9ab050";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(110,160,45,0.18)";
                e.currentTarget.style.color = "#688050";
              }}
            >
              Get in Touch
            </button>
          </div>

          {/* Stats */}
          <div
            ref={statsRef}
            style={{
              display: "flex",
              gap: "2.5rem",
              marginTop: "3.5rem",
              flexWrap: "wrap",
            }}
          >
            {[
              ["15+", "Projects Built"],
              ["3+", "Years Learning"],
              ["6", "Technologies"],
            ].map(([num, label]) => (
              <div key={label}>
                <div
                  style={{
                    fontFamily: "Syne,sans-serif",
                    fontWeight: 700,
                    fontSize: "1.9rem",
                    color: "#9ab050",
                    lineHeight: 1,
                    textShadow: "0 0 18px rgba(120,175,50,0.28)",
                  }}
                >
                  {num}
                </div>
                <div
                  style={{
                    fontFamily: "JetBrains Mono,monospace",
                    fontSize: "0.61rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#3a5020",
                    marginTop: "4px",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            LAYER 4: THREE.JS CANVAS (z-index 4)
            WebGLRenderer mengisi seluruh sticky div.
            alpha:true → background CSS tetap terlihat.
            Wave datang dari jauh-kiri dan mendekati kamera.
        ════════════════════════════════════════════════════════ */}
        <canvas
          ref={threeRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 4,
            pointerEvents: "none",
          }}
        />

        {/* ════════════════════════════════════════════════════════
            LAYER 5: DEPTH GAUGE + TAB ROW (z-index 5)
            Selalu di atas Three.js canvas.
        ════════════════════════════════════════════════════════ */}
        <div
          style={{
            position: "absolute",
            bottom: "5.5rem",
            right: "2rem",
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "4px",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "1px",
              height: "55px",
              background:
                "linear-gradient(to bottom,transparent,rgba(130,185,50,0.36))",
            }}
          />
          <span
            ref={depthRef}
            style={{
              fontFamily: "JetBrains Mono,monospace",
              fontSize: "0.62rem",
              letterSpacing: "0.12em",
              color: "rgba(130,185,50,0.40)",
            }}
          >
            0m
          </span>
          <span
            style={{
              fontFamily: "JetBrains Mono,monospace",
              fontSize: "0.54rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(90,135,35,0.26)",
            }}
          >
            depth
          </span>
        </div>

        {/* Tab row */}
        <div
          ref={tabRowRef}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 5,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
          }}
        >
          {[
            ["About", "about"],
            ["Projects", "projects"],
            ["Contact", "contact"],
          ].map(([label, id], i) => (
            <button
              key={id}
              onClick={() => smoothScrollTo(id)}
              style={{
                background: "none",
                border: "none",
                padding: "0 2rem 1.6rem 2rem",
                paddingTop: "0.75rem",
                textAlign: "left",
                borderRight: i < 2 ? "1px solid rgba(70,110,28,0.14)" : "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.querySelector(".tl").style.color = "#9ab050";
                e.currentTarget.querySelector(".tl-line").style.transform =
                  "scaleX(1)";
                e.currentTarget.querySelector(".tl-line").style.background =
                  "rgba(130,185,50,0.46)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.querySelector(".tl").style.color =
                  i === 0 ? "#9ab050" : "#3a5020";
                e.currentTarget.querySelector(".tl-line").style.transform =
                  i === 0 ? "scaleX(1)" : "scaleX(0.28)";
                e.currentTarget.querySelector(".tl-line").style.background =
                  i === 0 ? "rgba(130,185,50,0.40)" : "rgba(50,80,22,0.30)";
              }}
            >
              <span
                className="tl"
                style={{
                  display: "block",
                  fontFamily: "JetBrains Mono,monospace",
                  fontSize: "0.66rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: i === 0 ? "#9ab050" : "#3a5020",
                  marginBottom: "0.5rem",
                  transition: "color 0.25s",
                }}
              >
                {label}
              </span>
              <div
                className="tl-line"
                style={{
                  height: "1px",
                  background:
                    i === 0 ? "rgba(130,185,50,0.40)" : "rgba(50,80,22,0.30)",
                  transformOrigin: "left center",
                  transform: i === 0 ? "scaleX(1)" : "scaleX(0.28)",
                  transition: "transform 0.3s ease,background 0.3s ease",
                  marginRight: "2rem",
                }}
              />
            </button>
          ))}
        </div>

        {/* CSS keyframes */}
        <style>{`
          @keyframes shimH {
            0%   { opacity:0.3; transform:scaleX(0.88) translateX(-8%); }
            50%  { opacity:1;   transform:scaleX(1)    translateX(8%);  }
            100% { opacity:0.3; transform:scaleX(0.88) translateX(-8%); }
          }
          @keyframes dotPulse {
            0%,100% { opacity:1;    box-shadow:0 0 8px #9ab050; }
            50%      { opacity:0.4; box-shadow:0 0 3px #9ab050; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default Hero;
