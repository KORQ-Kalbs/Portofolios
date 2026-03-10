/**
 * BubbleBg.jsx — Underwater Ambient Bubble Canvas
 * ═══════════════════════════════════════════════════════════════════════
 *
 * SCOPE v2 (Updated):
 *   Komponen ini sekarang di-scope HANYA ke zona underwater (About, Projects,
 *   Contact). TIDAK digunakan di Hero section (yang punya Three.js sendiri).
 *
 *   App.jsx menempatkan BubbleBg di dalam <div id="underwater-zone">.
 *   BubbleBg menggunakan `position: fixed` tapi kontrolnya lewat opacity:
 *     - opacity: 0  saat Hero masih aktif (dikontrol App.jsx via scroll)
 *     - opacity: 1  saat scroll melewati Hero selesai (submersion complete)
 *   GSAP di App.jsx yang handle transisi opacity ini.
 *
 * PERBEDAAN dari v1:
 *   - Canvas menggunakan `position: fixed` (sama, agar mengikuti viewport)
 *   - Tapi dibungkus dalam div yang App.jsx bisa toggle visibility-nya
 *   - Warna bubble: lebih cyan/teal untuk "inside the wave" aesthetic
 *     (kontras dengan Hero yang olive-green)
 *   - Ditambah: occasional "bioluminescent burst" bubble yang lebih besar
 *     dan lebih terang (sisa bioluminescence dari Hero wave crash)
 *
 * BUBBLE SYSTEM:
 *   3 kategori: small (55%), medium (28%), large (12%), burst (5%)
 *   Bubble "burst" adalah gelembung besar yang muncul pasca wave crash —
 *   berwarna cyan cerah, naik lebih cepat, fades cepat.
 *
 * CANVAS: position:fixed, pointer-events:none, z-index:0
 *   Selalu di belakang konten. Alpha diatur App.jsx via GSAP.
 */

import { useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// BUBBLE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class Bubble {
  /**
   * @param {number}  W          — canvas width
   * @param {number}  H          — canvas height
   * @param {'small'|'medium'|'large'|'burst'} [category]
   * @param {number}  [forceX]   — forced X position (untuk bubble chain)
   */
  constructor(W, H, category = null, forceX = null) {
    this.W = W;
    this.H = H;
    this.category = category;
    this.forceX = forceX;
    this.reset(true); // true = spawn randomly di canvas saat init
  }

  /**
   * Re-init bubble properties.
   * @param {boolean} initial — jika true, Y bisa di mana saja
   */
  reset(initial = false) {
    // Tentukan kategori jika belum dipaksa
    const roll =
      this.category ??
      (Math.random() < 0.55
        ? "small"
        : Math.random() < 0.82
          ? "medium"
          : Math.random() < 0.97
            ? "large"
            : "burst");
    this.cat = roll;

    // Radius per kategori
    const rMap = {
      small: 1 + Math.random() * 3,
      medium: 4 + Math.random() * 5,
      large: 9 + Math.random() * 11,
      burst: 14 + Math.random() * 10,
    };
    this.r = rMap[roll];

    // Posisi
    this.x =
      this.forceX !== null
        ? this.forceX + (Math.random() - 0.5) * 22
        : Math.random() * this.W;
    this.y = initial
      ? Math.random() * this.H
      : this.H + this.r + Math.random() * 80;

    // Kecepatan naik: lebih kecil = lebih lambat
    const sMap = {
      small: 0.28 + Math.random() * 0.55,
      medium: 0.18 + Math.random() * 0.38,
      large: 0.08 + Math.random() * 0.2,
      burst: 0.55 + Math.random() * 0.7,
    };
    this.speedY = sMap[roll];
    this.speedX = (Math.random() - 0.5) * 0.2;

    // Wobble sinusoidal
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleAmp =
      roll === "large" || roll === "burst"
        ? Math.random() * 1.4 + 0.6
        : Math.random() * 0.6 + 0.15;
    this.wobbleSpd =
      roll === "large" || roll === "burst"
        ? Math.random() * 0.008 + 0.003
        : Math.random() * 0.018 + 0.006;

    // Warna:
    //   small/medium: blue-teal (underwater ambient)
    //   large:        teal lebih gelap
    //   burst:        cyan cerah (bioluminescence remnant)
    this.hue =
      roll === "burst"
        ? 180 + Math.random() * 20 // cyan 180-200
        : roll === "large"
          ? 160 + Math.random() * 25 // teal 160-185
          : 155 + Math.random() * 30; // blue-teal 155-185
    this.sat =
      roll === "burst"
        ? 70
        : roll === "large"
          ? 45
          : roll === "medium"
            ? 35
            : 28;
    this.lum =
      roll === "burst"
        ? 48
        : roll === "large"
          ? 30
          : roll === "medium"
            ? 26
            : 22;

    // Opacity base
    const aMap = {
      small: 0.04 + Math.random() * 0.09,
      medium: 0.07 + Math.random() * 0.12,
      large: 0.08 + Math.random() * 0.15,
      burst: 0.2 + Math.random() * 0.25,
    };
    this.baseAlpha = aMap[roll];
    this.alpha = this.baseAlpha;

    // Burst bubble: lifetime (fades setelah beberapa saat)
    if (roll === "burst") {
      this.lifetime = 4.0 + Math.random() * 3.5; // detik
      this.born = performance.now() * 0.001;
    } else {
      this.lifetime = Infinity;
      this.born = 0;
    }
  }

  update() {
    this.wobble += this.wobbleSpd;
    this.x += Math.sin(this.wobble) * this.wobbleAmp + this.speedX;
    this.y -= this.speedY;

    // Depth-aware opacity: lebih visible di bagian atas canvas (permukaan)
    const depthT = Math.max(0, Math.min(1, 1 - this.y / this.H));
    this.alpha = this.baseAlpha * (0.28 + depthT * 0.72);

    // Burst lifetime fade
    if (this.lifetime < Infinity) {
      const age = performance.now() * 0.001 - this.born;
      const fadeT = Math.max(0, 1 - age / this.lifetime);
      this.alpha *= fadeT * fadeT; // ease-out fade
      if (fadeT <= 0) {
        this.reset(false);
        return;
      }
    }

    // Respawn di bawah saat keluar atas
    if (this.y < -(this.r * 2)) this.reset(false);
    // Wrap X
    if (this.x < -this.r) this.x = this.W + this.r;
    if (this.x > this.W + this.r) this.x = -this.r;
  }

  draw(ctx) {
    const { x, y, r, hue, sat, lum, alpha, cat } = this;
    ctx.save();

    // Body
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue},${sat}%,${lum}%,${alpha})`;
    ctx.fill();

    // Rim
    ctx.strokeStyle = `hsla(${hue},${sat + 20}%,${lum + 25}%,${alpha * 2.2})`;
    ctx.lineWidth = cat === "large" || cat === "burst" ? 1.2 : 0.6;
    ctx.stroke();

    // Large + burst: shimmer highlight
    if (cat === "large" || cat === "burst") {
      ctx.beginPath();
      ctx.arc(
        x - r * 0.3,
        y - r * 0.3,
        r * 0.38,
        Math.PI * 1.1,
        Math.PI * 1.88,
      );
      ctx.strokeStyle = `rgba(200, 240, 235, ${alpha * 2.0})`;
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // Inner glow untuk burst (bioluminescent core)
      if (cat === "burst") {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.58, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},80%,65%,${alpha * 0.3})`;
        ctx.fill();
      }
    }

    // Medium: small highlight dot
    if (cat === "medium") {
      ctx.beginPath();
      ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(190, 228, 225, ${alpha * 1.5})`;
      ctx.fill();
    }

    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string}  [className]  — class untuk targeting GSAP dari App.jsx
 * @param {boolean} [startHidden] — jika true, canvas mulai opacity:0
 *                                  (App.jsx fade-in-kan setelah hero selesai)
 */
const BubbleBg = ({ className = "bubble-bg-canvas", startHidden = true }) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const bubblesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Jumlah bubble per kategori awal
    const COUNTS = { small: 55, medium: 22, large: 10 };
    const BURST_INTERVAL = 4500; // ms — spawn burst bubble secara periodik

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      bubblesRef.current.forEach((b) => {
        b.W = canvas.width;
        b.H = canvas.height;
      });
    };

    const spawnAll = () => {
      const W = canvas.width,
        H = canvas.height;
      const all = [];
      Object.entries(COUNTS).forEach(([cat, n]) => {
        for (let i = 0; i < n; i++) all.push(new Bubble(W, H, cat));
      });
      bubblesRef.current = all;
    };

    // Bubble chain: 3-5 small bubble dari titik yang sama
    const spawnChain = () => {
      const W = canvas.width,
        H = canvas.height;
      const cx = Math.random() * W;
      const len = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < len; i++) {
        const b = new Bubble(W, H, "small", cx);
        b.y = H + b.r + i * (12 + Math.random() * 18);
        bubblesRef.current.push(b);
      }
    };

    // Burst bubble: sisa bioluminescence dari Hero wave crash
    const spawnBurst = () => {
      const W = canvas.width,
        H = canvas.height;
      const n = 2 + Math.floor(Math.random() * 3); // 2-4 burst setiap kali
      for (let i = 0; i < n; i++) {
        const b = new Bubble(W, H, "burst");
        bubblesRef.current.push(b);
      }
    };

    resize();
    spawnAll();

    const chainTimer = setInterval(spawnChain, 3200);
    const burstTimer = setInterval(spawnBurst, BURST_INTERVAL);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bubblesRef.current.forEach((b) => {
        b.update();
        b.draw(ctx);
      });
      // Bersihkan bubble chain yang expired (jauh di atas)
      bubblesRef.current = bubblesRef.current.filter((b) => b.y > -(b.r * 3));
      rafRef.current = requestAnimationFrame(animate);
    };

    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(chainTimer);
      clearInterval(burstTimer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        // mixBlendMode screen: bubble lebih cerah di atas background gelap
        mixBlendMode: "screen",
        // Dimulai transparan; App.jsx fade-in saat hero selesai
        opacity: startHidden ? 0 : 1,
        transition: "none", // transisi dihandle oleh GSAP, bukan CSS
      }}
    />
  );
};

export default BubbleBg;
