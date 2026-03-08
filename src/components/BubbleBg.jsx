/**
 * BubbleBg.jsx
 * Full-page fixed canvas that renders floating olive-tinted bubble particles.
 * Uses requestAnimationFrame directly (no GSAP) for maximum perf.
 * The canvas is pointer-events:none so it never blocks interaction.
 */
import { useEffect, useRef } from "react";

// ── Bubble class ────────────────────────────────────────────────────────────
class Bubble {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.reset(true); // true = allow spawning anywhere on screen initially
  }

  /**
   * Re-initialises the bubble with random properties.
   * @param {boolean} initial - If true, y can start anywhere; otherwise starts below viewport
   */
  reset(initial = false) {
    this.x = Math.random() * this.canvasW;
    this.y = initial
      ? Math.random() * this.canvasH
      : this.canvasH + Math.random() * 60 + 10;
    this.r = Math.random() * 5 + 2; // radius 2–7px
    this.speedY = Math.random() * 0.4 + 0.12; // upward speed
    this.speedX = (Math.random() - 0.5) * 0.25; // slight horizontal drift
    this.alpha = Math.random() * 0.12 + 0.03; // very subtle
    this.wobble = Math.random() * Math.PI * 2; // phase offset for sine wobble
    this.wobbleAmp = Math.random() * 0.8 + 0.2; // wobble amplitude
    this.wobbleSpeed = Math.random() * 0.015 + 0.004;
    // Colour: olive green in HSL — slight hue variation per bubble
    this.hue = 78 + Math.floor(Math.random() * 20); // 78–98 °
  }

  /** Advance bubble position by one frame */
  update() {
    this.wobble += this.wobbleSpeed;
    this.x += Math.sin(this.wobble) * this.wobbleAmp + this.speedX;
    this.y -= this.speedY;

    // Respawn when floated off the top
    if (this.y < -this.r * 2) this.reset();
  }

  /**
   * Draw the bubble — a filled circle with a thin stroke ring.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.hue}, 42%, 34%, ${this.alpha})`;
    ctx.fill();
    // Rim highlight makes it look like a real soap bubble
    ctx.strokeStyle = `hsla(${this.hue}, 55%, 55%, ${this.alpha * 2.5})`;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
}

// ── Component ────────────────────────────────────────────────────────────────
const BubbleBg = () => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const bubblesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const BUBBLE_COUNT = 55; // number of simultaneous bubbles

    /** Resize canvas to full viewport */
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Recalibrate bubble canvas dimensions after resize
      bubblesRef.current.forEach((b) => {
        b.canvasW = canvas.width;
        b.canvasH = canvas.height;
      });
    };

    // Initial sizing + spawn bubbles
    resize();
    bubblesRef.current = Array.from(
      { length: BUBBLE_COUNT },
      () => new Bubble(canvas.width, canvas.height),
    );

    /** Main animation loop */
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bubblesRef.current.forEach((b) => {
        b.update();
        b.draw(ctx);
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
};

export default BubbleBg;
