/**
 * App.jsx — Root SPA Component
 * ═══════════════════════════════════════════════════════════════════════
 *
 * STRUKTUR v2 — Two Zones:
 *
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  ZONE 1: HERO (Night Surface)                                   │
 *  │  ┌─────────────────────────────────────────────────────────┐   │
 *  │  │  <Hero />                                               │   │
 *  │  │  - Three.js: wave + night sky + moon (self-contained)  │   │
 *  │  │  - BubbleBg TIDAK ada di sini                          │   │
 *  │  │  - height: 320vh (scroll space)                        │   │
 *  │  └─────────────────────────────────────────────────────────┘   │
 *  │                                                                 │
 *  │  SUBMERSION OVERLAY                                             │
 *  │  ┌─────────────────────────────────────────────────────────┐   │
 *  │  │  div#submersion-overlay                                 │   │
 *  │  │  - opacity: 0 saat Hero belum selesai                  │   │
 *  │  │  - fade ke hitam saat scroll → 1.0 (menyelam)          │   │
 *  │  │  - dikontrol GSAP via hero progress event bus          │   │
 *  │  └─────────────────────────────────────────────────────────┘   │
 *  │                                                                 │
 *  │  ZONE 2: UNDERWATER (About → Contact)                          │
 *  │  ┌─────────────────────────────────────────────────────────┐   │
 *  │  │  div#underwater-zone                                    │   │
 *  │  │  - <BubbleBg /> (position:fixed, opacity:0 → 1)        │   │
 *  │  │  - <About />                                           │   │
 *  │  │  - <Projects />                                        │   │
 *  │  │  - <Contact />                                         │   │
 *  │  └─────────────────────────────────────────────────────────┘   │
 *  └─────────────────────────────────────────────────────────────────┘
 *
 * SUBMERSION TRANSITION:
 *   Hero emits scroll progress via event bus (emitScrollProgress("hero", p))
 *   App.jsx subscribe (onScrollProgress("hero", handler)):
 *     p < SM.SUBMERGE  (0.85): BubbleBg opacity = 0
 *     p > SM.SUBMERGE         : BubbleBg fade-in (0→1 selama 1.5s)
 *     p = SM.UNDERWATER (1.0) : submersion overlay fade out
 *                               underwater zone fully visible
 *
 * GSAP MILESTONES (SM = SCROLL_MILESTONES dari gsapConfig):
 *   0.00 CALM:        laut tenang, night sky, subtle biolum
 *   0.20 WAVE_RISING: ombak naik, moon intensify
 *   0.50 BARREL_PEAK: barrel sempurna, ombak di atas teks
 *   0.70 BIOLUM_MAX:  bioluminescence maksimal, teks fades
 *   0.85 SUBMERGE:    kamera menyelam, BubbleBg mulai fade-in
 *   1.00 UNDERWATER:  fully underwater, overlay fade, About in
 */

// PENTING: harus import pertama sebelum komponen lain mount
import "./utils/gsapConfig";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import {
  onScrollProgress,
  offScrollProgress,
  SCROLL_MILESTONES as SM,
} from "./utils/gsapConfig";

// Global overlay components
import Cursor from "./components/Cursor";
import Navbar from "./components/Navbar";
import BubbleBg from "./components/BubbleBg";

// Page sections
import Hero from "./sections/Hero";
import About from "./sections/About";
import Projects from "./sections/Projects";
import Contact from "./sections/Contact";

// ─────────────────────────────────────────────────────────────────────────────
// APP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const App = () => {
  const appRef = useRef(null);
  const submersionOverlayRef = useRef(null); // overlay hitam saat menyelam
  const underwaterZoneRef = useRef(null); // container untuk About-Contact

  // ── State tracking untuk transisi ─────────────────────────────────────────
  // Ref bukan state agar tidak trigger re-render
  const hasSubmergedRef = useRef(false); // sudah pernah submerse?
  const hasUnsubscribedRef = useRef(false); // sudah unsubscribe event?

  // ── Page load entrance ──────────────────────────────────────────────────────
  useEffect(() => {
    // App mulai invisible, lalu fade in (mencegah flash of unstyled content)
    gsap.set(appRef.current, { autoAlpha: 0 });
    gsap.to(appRef.current, {
      autoAlpha: 1,
      duration: 0.6,
      ease: "power2.out",
      delay: 0.12,
    });
  }, []);

  // ── Subscribe ke Hero scroll progress event bus ─────────────────────────────
  useEffect(() => {
    /**
     * Handler untuk hero scroll progress.
     * Dipanggil setiap frame dari Hero's rAF loop via emitScrollProgress.
     * Mengontrol:
     *   1. BubbleBg opacity (fade in mulai dari SM.SUBMERGE)
     *   2. Submersion overlay (blackout saat transisi hero → about)
     *   3. Underwater zone background transitions
     *
     * @param {number} progress — hero scroll progress 0..1 (lerped)
     */
    const handleHeroProgress = (progress) => {
      if (!submersionOverlayRef.current) return;

      // ── A. SUBMERSION OVERLAY ──────────────────────────────────────────────
      // Saat progress mendekati 1.0, fade overlay hitam (blackout)
      // Ini menciptakan efek "mata tertutup saat menyelam"
      const overlayStart = SM.SUBMERGE; // 0.85
      const overlayEnd = SM.UNDERWATER; // 1.00
      if (progress > overlayStart) {
        const t = (progress - overlayStart) / (overlayEnd - overlayStart);
        // Fade in kemudian fade out (in: 0→0.7 di t=0.5, out: 0.7→0 di t=1)
        const parabola = Math.sin(t * Math.PI) * 0.7;
        gsap.set(submersionOverlayRef.current, { opacity: parabola });
      } else {
        gsap.set(submersionOverlayRef.current, { opacity: 0 });
      }

      // ── B. BUBBLE BG FADE-IN ────────────────────────────────────────────────
      // BubbleBg muncul bertahap saat kita sudah "di dalam air"
      // Transisi: opacity 0 → 1 dari SM.SUBMERGE ke SM.UNDERWATER
      if (progress >= SM.SUBMERGE && !hasSubmergedRef.current) {
        // Sekali saja — flag agar tidak dipanggil berulang
        hasSubmergedRef.current = true;

        // GSAP to pada canvas BubbleBg (dicari via className)
        const bubbleCanvas = document.querySelector(".bubble-bg-canvas");
        if (bubbleCanvas) {
          gsap.fromTo(
            bubbleCanvas,
            { opacity: 0 },
            { opacity: 0.85, duration: 2.2, ease: "power2.inOut" },
          );
        }
      }

      // Reset flag jika scroll kembali ke atas (user scroll back up)
      if (progress < SM.SUBMERGE - 0.05 && hasSubmergedRef.current) {
        hasSubmergedRef.current = false;
        const bubbleCanvas = document.querySelector(".bubble-bg-canvas");
        if (bubbleCanvas) {
          gsap.to(bubbleCanvas, {
            opacity: 0,
            duration: 1.0,
            ease: "power2.out",
          });
        }
      }

      // ── C. UNDERWATER ZONE BACKGROUND ─────────────────────────────────────
      // Saat fully underwater (progress≈1), underwater zone bg menjadi lebih
      // "dalam" (lebih gelap, hint teal/cyan)
      if (underwaterZoneRef.current && progress > SM.BARREL_PEAK) {
        const t = Math.min(
          1,
          (progress - SM.BARREL_PEAK) / (1 - SM.BARREL_PEAK),
        );
        // Opacity overlay underwater bertambah: lebih gelap = lebih dalam
        // Kita set CSS custom property yang CSS zone gunakan
        underwaterZoneRef.current.style.setProperty(
          "--depth-tint",
          `rgba(2, 12, 8, ${t * 0.35})`,
        );
      }
    };

    // Subscribe ke "hero" channel
    onScrollProgress("hero", handleHeroProgress);

    // Cleanup: unsubscribe saat App unmount
    return () => {
      offScrollProgress("hero", handleHeroProgress);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/*
       * ── Global UI Layer ─────────────────────────────────────────────────
       * Cursor dan Navbar float di atas semua konten.
       * z-index: Cursor (9999) > Navbar (1000) > content (1)
       *
       * CATATAN: BubbleBg TIDAK ada di sini lagi.
       * Ia dipindah ke underwater-zone agar scoped dengan benar.
       */}
      <Cursor />
      <Navbar />

      {/*
       * ── Submersion Overlay ──────────────────────────────────────────────
       * Layer hitam tipis yang flash saat transisi Hero → About.
       * Efeknya seperti "mata tertutup" saat kepala masuk ke dalam air.
       * Opacity dikendalikan sepenuhnya oleh GSAP via event bus handler.
       */}
      <div
        ref={submersionOverlayRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 998, // di bawah Cursor (9999) dan Navbar (1000)
          background:
            "radial-gradient(ellipse 110% 110% at 50% 40%, #010d05, #000000)",
          opacity: 0,
          pointerEvents: "none", // tidak block interaksi
          willChange: "opacity",
        }}
      />

      {/*
       * ── Main App Container ───────────────────────────────────────────────
       * appRef: GSAP page-load fade target
       * position:relative dan z-index:1 agar di atas BubbleBg (z:0)
       */}
      <main ref={appRef} style={{ position: "relative", zIndex: 1 }}>
        {/*
         * ── ZONE 1: HERO (Night Surface) ────────────────────────────────
         * Hero adalah self-contained: punya Three.js scene sendiri
         * (wave + stars + moon + PointLight).
         * Hero TIDAK menggunakan BubbleBg.
         * height: 320vh (diatur di dalam Hero.jsx via sticky wrapper).
         */}
        <Hero />

        {/*
         * ── ZONE 2: UNDERWATER (About → Contact) ────────────────────────
         * Semua konten di bawah Hero ada di sini.
         * BubbleBg di-mount di sini, dimulai opacity:0.
         * App.jsx fade-in-kan BubbleBg saat hero scroll mencapai SM.SUBMERGE.
         *
         * CSS custom property --depth-tint diupdate via JS untuk efek
         * "semakin dalam = semakin gelap" saat scroll berlanjut.
         */}
        <div
          ref={underwaterZoneRef}
          id="underwater-zone"
          style={{
            position: "relative",
            // Background dasar underwater: hitam sangat gelap dengan hint teal
            background:
              "linear-gradient(180deg, #010a03 0%, #020c04 20%, #010b03 50%, #010803 80%, #02100a 100%)",
            // Overlay depth tint diupdate via JS (CSS custom property)
            // Pseudo-element tidak bisa diupdate dari JS, so kita pakai ::after
            // Alternatif: pakai inline style langsung di element
          }}
        >
          {/*
           * BubbleBg: scoped ke underwater zone.
           * - className="bubble-bg-canvas": App.jsx target via GSAP querySelector
           * - startHidden={true}: mulai opacity:0, App.jsx fade in
           * - position:fixed: mengikuti viewport (tidak scroll dengan konten)
           * - Hanya terlihat setelah hero selesai via GSAP transisi di atas
           *
           * PENTING: walaupun position:fixed (tidak di-clip oleh parent),
           * kita kontrol visibilitas via opacity + GSAP timing.
           * Bubbles jadi terlihat di viewport tepat saat kita memasuki zone ini.
           */}
          <BubbleBg className="bubble-bg-canvas" startHidden={true} />

          {/* About section — bio + skills marquee */}
          <About />

          {/* Projects section — infinite card carousel */}
          <Projects />

          {/* Contact section — form + socials + footer */}
          <Contact />
        </div>
      </main>
    </>
  );
};

export default App;
