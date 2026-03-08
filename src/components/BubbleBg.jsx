/**
 * BubbleBg.jsx — Underwater Bubble System
 *
 * Canvas full-page yang merender gelembung air bawah laut.
 * Ditingkatkan dari versi sebelumnya dengan:
 *
 * 1. THREE size categories:
 *    - Small  (r: 1–4px)  : gelembung kecil, bergerak cepat, banyak
 *    - Medium (r: 4–9px)  : gelembung sedang, lebih lambat
 *    - Large  (r: 9–20px) : gelembung besar, paling lambat, ada internal shimmer
 *
 * 2. Underwater color palette (bukan lagi plain olive):
 *    HSL range: hue 100–165° (dari olive-green ke teal)
 *    Saturation rendah untuk kesan murky toxic ocean
 *
 * 3. Large bubbles punya efek visual:
 *    - Internal shimmer: arc putih kecil di sudut atas kiri (highlight)
 *    - Rim lebih tebal dan lebih terang
 *    - Sedikit blur glow di sekitarnya
 *
 * 4. Bubble chains: small bubbles kadang naik berkelompok
 *    (3–5 bubble berdekatan dengan timing berbeda)
 *
 * 5. Depth-aware opacity: bubble di bagian bawah canvas lebih transparan
 *    (seolah lebih jauh/dalam), makin ke atas makin jelas
 */
import { useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// BUBBLE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class Bubble {
  /**
   * @param {number} canvasW  - Lebar canvas
   * @param {number} canvasH  - Tinggi canvas
   * @param {'small'|'medium'|'large'} [forcedSize] - Paksa kategori ukuran
   * @param {number} [forcedX] - Paksa posisi X (untuk bubble chain)
   */
  constructor(canvasW, canvasH, forcedSize = null, forcedX = null) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.forcedSize = forcedSize;
    this.forcedX = forcedX;
    this.reset(true);
  }

  /**
   * Reset bubble ke kondisi awal / re-spawn.
   * @param {boolean} initial - true = boleh spawn di mana saja di canvas
   */
  reset(initial = false) {
    // ── Tentukan ukuran bubble ────────────────────────────────────────────
    // Distribusi: 60% small, 30% medium, 10% large
    const roll =
      this.forcedSize ||
      (Math.random() < 0.6
        ? "small"
        : Math.random() < 0.75
          ? "medium"
          : "large");
    this.size = roll;

    // Radius berdasarkan kategori
    const radiusMap = {
      small: Math.random() * 3 + 1, // 1–4px
      medium: Math.random() * 5 + 4, // 4–9px
      large: Math.random() * 11 + 9, // 9–20px
    };
    this.r = radiusMap[roll];

    // ── Posisi ───────────────────────────────────────────────────────────
    this.x =
      this.forcedX !== null
        ? this.forcedX + (Math.random() - 0.5) * 20 // cluster di sekitar forcedX
        : Math.random() * this.canvasW;

    this.y = initial
      ? Math.random() * this.canvasH
      : this.canvasH + this.r + Math.random() * 80; // spawn di bawah canvas

    // ── Kecepatan naik: bubble besar lebih lambat ─────────────────────────
    const speedMap = {
      small: Math.random() * 0.55 + 0.25, // 0.25–0.80 px/frame
      medium: Math.random() * 0.35 + 0.15, // 0.15–0.50 px/frame
      large: Math.random() * 0.2 + 0.08, // 0.08–0.28 px/frame
    };
    this.speedY = speedMap[roll];

    // ── Horizontal drift: slight wobble kiri-kanan ────────────────────────
    this.speedX = (Math.random() - 0.5) * 0.18;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleAmp =
      roll === "large"
        ? Math.random() * 1.2 + 0.5
        : roll === "medium"
          ? Math.random() * 0.8 + 0.2
          : Math.random() * 0.5 + 0.1;
    this.wobbleSpd =
      roll === "large"
        ? Math.random() * 0.008 + 0.003
        : roll === "medium"
          ? Math.random() * 0.012 + 0.004
          : Math.random() * 0.018 + 0.006;

    // ── Warna: hue 95–165° (olive-green ke teal-toxic) ────────────────────
    this.hue = Math.floor(Math.random() * 70) + 95; // 95–165°
    this.sat = roll === "large" ? 35 : roll === "medium" ? 28 : 22; // lebih jenuh = lebih jelas
    this.lum = roll === "large" ? 32 : roll === "medium" ? 28 : 24;

    // ── Opacity ───────────────────────────────────────────────────────────
    const alphaMap = {
      small: Math.random() * 0.1 + 0.04, // very subtle
      medium: Math.random() * 0.14 + 0.06,
      large: Math.random() * 0.18 + 0.08,
    };
    this.baseAlpha = alphaMap[roll];
    this.alpha = this.baseAlpha;
  }

  /** Maju satu frame */
  update() {
    this.wobble += this.wobbleSpd;
    this.x += Math.sin(this.wobble) * this.wobbleAmp + this.speedX;
    this.y -= this.speedY;

    // Opacity meningkat saat bubble mendekati permukaan (atas canvas)
    // Effect: bubble "muncul" dari kegelapan laut dalam
    const depthFactor = Math.max(0, Math.min(1, 1 - this.y / this.canvasH));
    this.alpha = this.baseAlpha * (0.3 + depthFactor * 0.7);

    // Re-spawn saat keluar layar atas
    if (this.y < -(this.r * 2)) this.reset(false);
    // Wrap horizontal
    if (this.x < -this.r) this.x = this.canvasW + this.r;
    if (this.x > this.canvasW + this.r) this.x = -this.r;
  }

  /**
   * Render bubble ke canvas.
   * - Small/Medium: filled circle + rim
   * - Large: filled circle + rim + internal shimmer highlight
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const { x, y, r, hue, sat, lum, alpha, size } = this;

    ctx.save();

    // ── Main bubble body ──────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lum}%, ${alpha})`;
    ctx.fill();

    // ── Rim (edge glow) ───────────────────────────────────────────────────
    ctx.strokeStyle = `hsla(${hue}, ${sat + 18}%, ${lum + 22}%, ${alpha * 2.2})`;
    ctx.lineWidth = size === "large" ? 1.2 : size === "medium" ? 0.8 : 0.5;
    ctx.stroke();

    // ── Large bubble extras ───────────────────────────────────────────────
    if (size === "large") {
      // Shimmer highlight: arc putih di pojok kiri atas bubble
      // Merepresentasikan pantulan cahaya di permukaan bubble
      ctx.beginPath();
      ctx.arc(
        x - r * 0.3, // offset ke kiri
        y - r * 0.3, // offset ke atas
        r * 0.35, // ukuran ≈35% dari radius bubble
        Math.PI * 1.1, // sudut mulai
        Math.PI * 1.85, // sudut akhir
      );
      ctx.strokeStyle = `rgba(220, 240, 200, ${alpha * 1.8})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Soft inner glow (radial via multiple arcs)
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lum + 10}%, ${alpha * 0.25})`;
      ctx.fill();
    }

    // ── Medium bubble: small highlight dot ───────────────────────────────
    if (size === "medium") {
      ctx.beginPath();
      ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 220, 180, ${alpha * 1.5})`;
      ctx.fill();
    }

    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const BubbleBg = () => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const bubblesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Jumlah bubble per kategori
    const COUNTS = { small: 50, medium: 20, large: 8 };
    // Waktu antar spawn bubble chain (ms)
    const CHAIN_INTERVAL = 3500;

    /** Set ukuran canvas ke full viewport */
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      bubblesRef.current.forEach((b) => {
        b.canvasW = canvas.width;
        b.canvasH = canvas.height;
      });
    };

    /** Buat semua bubble */
    const spawnBubbles = () => {
      const w = canvas.width;
      const h = canvas.height;
      const all = [];

      // Small bubbles
      for (let i = 0; i < COUNTS.small; i++)
        all.push(new Bubble(w, h, "small"));
      // Medium bubbles
      for (let i = 0; i < COUNTS.medium; i++)
        all.push(new Bubble(w, h, "medium"));
      // Large bubbles
      for (let i = 0; i < COUNTS.large; i++)
        all.push(new Bubble(w, h, "large"));

      bubblesRef.current = all;
    };

    /**
     * Spawn "bubble chain" — sekelompok 3–5 small bubble di posisi X yang sama,
     * memberikan efek gelembung naik dari satu titik (seperti dari batu/tanaman).
     */
    const spawnChain = () => {
      const w = canvas.width;
      const h = canvas.height;
      const chainX = Math.random() * w;
      const chainLen = Math.floor(Math.random() * 3) + 3; // 3–5 bubble
      for (let i = 0; i < chainLen; i++) {
        const b = new Bubble(w, h, "small", chainX);
        // Offset vertikal agar tidak muncul serentak
        b.y = h + b.r + i * (Math.random() * 25 + 10);
        bubblesRef.current.push(b);
      }
    };

    // ── Init ──────────────────────────────────────────────────────────────
    resize();
    spawnBubbles();

    // Chain spawn secara periodik
    const chainTimer = setInterval(spawnChain, CHAIN_INTERVAL);

    // ── Main loop ─────────────────────────────────────────────────────────
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bubblesRef.current.forEach((b) => {
        b.update();
        b.draw(ctx);
      });
      // Bersihkan chain bubbles yang sudah keluar layar
      bubblesRef.current = bubblesRef.current.filter((b) => b.y > -(b.r * 3));
      rafRef.current = requestAnimationFrame(animate);
    };

    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(chainTimer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        // Sedikit multiply blend agar bubbles terlihat bagian dari background
        mixBlendMode: "screen",
      }}
    />
  );
};

export default BubbleBg;
