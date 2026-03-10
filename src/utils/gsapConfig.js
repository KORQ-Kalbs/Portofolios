/**
 * gsapConfig.js — GSAP Hub + Scroll Event Bus + Marine Zone Milestones
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PERUBAHAN v3 (Zone-Shift Ocean Update):
 * ─────────────────────────────────────────────────────────────────────────
 * 1. SCROLL_MILESTONES diperbarui sesuai marine zone semantik baru:
 *    - CALM (0.00):     laut flat sempurna, Surface Zone penuh
 *    - WAVE_RISING (0.20): ombak mulai naik, tetap di Surface Zone
 *    - BARREL_PEAK (0.50): barrel sempurna, transisi ke Twilight Zone
 *    - WAVE_CRASH (0.70):  wave crashed, foam burst, twilight zone aktif
 *    - SUBMERGE (0.85):    kamera menyelam, memasuki Abyss Zone
 *    - UNDERWATER (1.00):  fully abyss, BubbleBg visible, About fade-in
 *
 * 2. MARINE_ZONES: mapping scroll progress → zone index (float 0..2)
 *    Dipakai oleh Hero.jsx untuk update uZone uniform dan App.jsx
 *    untuk background color transitions.
 *    Zone 0 = Surface (Teal/Cyan), Zone 1 = Twilight (Midnight Blue),
 *    Zone 2 = Abyss (Deep Charcoal/Black)
 *
 * 3. getMarineZone(scrollP): helper function untuk compute zone float.
 *    Dipakai di Hero rAF loop untuk update uZone.
 *
 * 4. Event Bus (onScrollProgress / offScrollProgress / emitScrollProgress):
 *    Tetap sama seperti v2 — Hero emits, App subscribes.
 *    Tidak ada perubahan API.
 *
 * ARSITEKTUR EVENT BUS:
 * ────────────────────
 *   Hero.jsx rAF loop
 *       ↓ emitScrollProgress("hero", progress)
 *   gsapConfig.js (Map<channel, Set<handler>>)
 *       ↓ calls all handlers
 *   App.jsx handleHeroProgress(progress)
 *       ├── Update submersion overlay opacity
 *       ├── Fade-in BubbleBg canvas
 *       └── Update underwater zone CSS background
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

/* Plugin registration — harus sebelum ScrollTrigger.create dipanggil di manapun */
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/* GSAP global config */
gsap.config({
  autoSleep: 60 /* pause idle timelines setelah 60 frame idle  */,
  force3D: true /* gunakan GPU matrix3d untuk semua transforms */,
  nullTargetWarn: false /* suppress warning saat target null            */,
});

// ─────────────────────────────────────────────────────────────────────────────
// SMOOTH SCROLL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Smooth scroll ke section berdasarkan id.
 * Menggunakan ScrollToPlugin untuk konsistensi cross-browser.
 *
 * @param {string} id     — element id tanpa "#"
 * @param {number} offset — pixel offset dari atas element (default 0)
 */
export const smoothScrollTo = (id, offset = 0) => {
  gsap.to(window, {
    duration: 1.4,
    scrollTo: { y: `#${id}`, offsetY: offset },
    ease: "power3.inOut",
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL MILESTONES (v3 — Marine Zone Semantik)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Titik-titik scroll progress yang bermakna secara visual.
 * Digunakan oleh:
 *   - Hero.jsx: mengontrol barrel arc, moon intensity, content float
 *   - App.jsx:  mengontrol overlay opacity, BubbleBg fade, bg transitions
 *   - Fragment shader (via uniforms): wave zone blending
 *
 * Nilai ini dikalibrasi untuk "320vh scroll space" (height wrapper Hero).
 * Mengubah satu nilai di sini otomatis sinkron ke semua komponen.
 */
export const SCROLL_MILESTONES = {
  /* 0.00 — Laut flat, tidak ada gelombang, Surface Zone penuh */
  CALM: 0.0,

  /* 0.20 — Wave mulai naik, kamera masih melihat permukaan teal */
  WAVE_RISING: 0.2,

  /* 0.30 — Barrel mulai arch, foam particles mulai visible */
  BARREL_FORMING: 0.3,

  /* 0.50 — Barrel peak: arch sempurna di atas teks,
   *        transisi awal menuju Twilight Zone             */
  BARREL_PEAK: 0.5,

  /* 0.70 — Wave crashed, foam burst maksimal,
   *        Twilight Zone penuh, teks sudah hilang          */
  WAVE_CRASH: 0.7,

  /* 0.85 — Kamera mulai menyelam, masuk Abyss Zone,
   *        BubbleBg mulai fade-in                          */
  SUBMERGE: 0.85,

  /* 1.00 — Fully underwater (Abyss Zone),
   *        BubbleBg terlihat penuh, About section fade-in  */
  UNDERWATER: 1.0,
};

// ─────────────────────────────────────────────────────────────────────────────
// MARINE ZONE DATA
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Data per zona laut — untuk reference di komponen yang perlu
 * mengubah CSS/background sesuai zone aktif.
 *
 * Zone float (0..2) dihitung oleh getMarineZone(scrollP).
 */
export const MARINE_ZONES = {
  /* Surface Zone (0..1): Teal/Cyan, cahaya menembus, caustics aktif */
  SURFACE: {
    index: 0,
    name: "Surface",
    scrollRange: [0.0, 0.5] /* aktif dari scroll 0 sampai 0.5    */,
    bgColor: "#000e0a" /* CSS background saat di zone ini    */,
    accentColor: "#28b4a0" /* UI accent (badge, tab, border)     */,
    depthRange: "0m – 200m",
  },

  /* Twilight Zone (1..2): Midnight Blue, sedikit cahaya, biolum mulai */
  TWILIGHT: {
    index: 1,
    name: "Twilight",
    scrollRange: [0.5, 0.85],
    bgColor: "#000812",
    accentColor: "#2255aa",
    depthRange: "200m – 1000m",
  },

  /* Abyss Zone (2..3): Charcoal/Black, hampir tanpa cahaya, deep biolum */
  ABYSS: {
    index: 2,
    name: "Abyss",
    scrollRange: [0.85, 1.0],
    bgColor: "#000306",
    accentColor: "#112235",
    depthRange: "1000m+",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MARINE ZONE HELPER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Hitung zone float (0..2) berdasarkan scroll progress.
 * Dipakai oleh Hero rAF loop untuk update uZone shader uniform.
 *
 * Mapping:
 *   scroll 0.00 → zone 0.0 (Surface penuh)
 *   scroll 0.50 → zone 1.0 (tepat masuk Twilight)
 *   scroll 0.85 → zone 1.7 (dalam Twilight, menuju Abyss)
 *   scroll 1.00 → zone 2.0 (Abyss penuh)
 *
 * Tidak linear — menggunakan smoothstep agar transisi zona terasa smooth,
 * bukan mendadak.
 *
 * @param {number} scrollP — scroll progress 0..1
 * @returns {number} zone float 0..2
 */
export const getMarineZone = (scrollP) => {
  const SM = SCROLL_MILESTONES;

  /* Surface → Twilight: scroll 0.0 → 0.70 = zone 0 → 1 */
  const surfaceToTwilight = Math.min(
    1,
    Math.max(0, (scrollP - SM.CALM) / (SM.WAVE_CRASH - SM.CALM)),
  );

  /* Twilight → Abyss: scroll 0.70 → 1.00 = zone 1 → 2 */
  const twilightToAbyss = Math.min(
    1,
    Math.max(0, (scrollP - SM.WAVE_CRASH) / (SM.UNDERWATER - SM.WAVE_CRASH)),
  );

  /* Smooth transisi: tidak abrupt */
  const smoothedST =
    surfaceToTwilight * surfaceToTwilight * (3 - 2 * surfaceToTwilight);
  const smoothedTA =
    twilightToAbyss * twilightToAbyss * (3 - 2 * twilightToAbyss);

  return smoothedST + smoothedTA;
};

/**
 * Mendapatkan nama zone aktif berdasarkan scroll progress.
 * Berguna untuk debug atau UI label.
 *
 * @param {number} scrollP
 * @returns {'Surface'|'Twilight'|'Abyss'}
 */
export const getZoneName = (scrollP) => {
  const zone = getMarineZone(scrollP);
  if (zone < 1.0) return "Surface";
  if (zone < 2.0) return "Twilight";
  return "Abyss";
};

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL PROGRESS EVENT BUS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Pub/sub sederhana untuk koordinasi lintas-komponen tanpa React state.
 * Menghindari re-render yang tidak perlu (performance-critical untuk rAF).
 *
 * Channels yang ada:
 *   "hero"     — Hero.jsx emit → App.jsx subscribe
 *   (future)   — bisa tambah channel baru jika diperlukan
 *
 * Contoh subscribe:
 *   import { onScrollProgress, offScrollProgress } from "./gsapConfig";
 *   useEffect(() => {
 *     const handler = (p) => { ... };
 *     onScrollProgress("hero", handler);
 *     return () => offScrollProgress("hero", handler);
 *   }, []);
 *
 * Contoh emit (dari rAF loop, tidak dari React):
 *   import { emitScrollProgress } from "./gsapConfig";
 *   emitScrollProgress("hero", 0.42);
 */

/* Internal storage: Map<channel, Set<handler>> */
const _scrollListeners = new Map();

/**
 * Subscribe ke scroll progress channel.
 * @param {string}   channel — nama channel (e.g. "hero")
 * @param {Function} handler — callback (progress: number) => void
 */
export const onScrollProgress = (channel, handler) => {
  if (!_scrollListeners.has(channel)) _scrollListeners.set(channel, new Set());
  _scrollListeners.get(channel).add(handler);
};

/**
 * Unsubscribe handler dari channel.
 * PENTING: panggil di return() useEffect untuk prevent memory leak.
 */
export const offScrollProgress = (channel, handler) => {
  _scrollListeners.get(channel)?.delete(handler);
};

/**
 * Emit progress ke semua subscriber channel.
 * Dipanggil dari rAF loop (bukan dari React event handler).
 * @param {string} channel
 * @param {number} progress — 0..1 (raw ScrollTrigger progress, BUKAN lerped)
 */
export const emitScrollProgress = (channel, progress) => {
  _scrollListeners.get(channel)?.forEach((fn) => fn(progress));
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default gsap;
