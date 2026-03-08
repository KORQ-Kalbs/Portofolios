/**
 * App.jsx
 * Root SPA component.
 *
 * Responsibilities:
 * - Import gsapConfig FIRST so plugins are registered before any child mounts
 * - Mount all sections in scroll order: Hero → About → Projects → Contact
 * - Mount global overlay components: BubbleBg, Cursor, Navbar
 * - Provide a smooth page-load reveal (the entire app fades in)
 *
 * This is a single-page layout (no React Router needed).
 * Navigation is handled by GSAP ScrollTo via smoothScrollTo() in each component.
 */

// Must be the very first GSAP-related import so plugins register globally
import "./utils/gsapConfig";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// Global overlay components
import BubbleBg from "./components/BubbleBG";
import Cursor from "./components/Cursor";
import Navbar from "./components/Navbar";

// Page sections
import Hero from "./sections/Hero";
import About from "./sections/About";
import Projects from "./sections/Projects";
import Contact from "./sections/Contact";

// ── App ───────────────────────────────────────────────────────────────────────
const App = () => {
  const appRef = useRef(null);

  /**
   * Page-load entrance: the entire app wrapper fades in from invisible.
   * This prevents the flash of unstyled content as fonts/images load.
   */
  useEffect(() => {
    // Start invisible
    gsap.set(appRef.current, { autoAlpha: 0 });

    // Reveal after a short delay (gives fonts time to load)
    gsap.to(appRef.current, {
      autoAlpha: 1,
      duration: 0.6,
      ease: "power2.out",
      delay: 0.1,
    });
  }, []);

  return (
    <>
      {/*
        ── Fixed / Global layer ──────────────────────────────────────────────
        These components sit outside the main scroll flow.
        BubbleBg (z-index 0) → Navbar (z-index 1000) → Cursor (z-index 9999+)
      */}
      <BubbleBg />
      <Cursor />
      <Navbar />

      {/*
        ── Main scroll container ─────────────────────────────────────────────
        All sections are stacked vertically. Each has its own id for
        anchor-based GSAP ScrollTo navigation.
        z-index: 1 ensures sections render above the canvas BubbleBg (z-index 0).
      */}
      <main ref={appRef} style={{ position: "relative", zIndex: 1 }}>
        {/* 1. Hero — first thing the visitor sees */}
        <Hero />

        {/* 2. About — bio + infinite skills marquee */}
        <About />

        {/* 3. Projects — infinite card carousel */}
        <Projects />

        {/* 4. Contact — email / socials / form + footer */}
        <Contact />
      </main>
    </>
  );
};

export default App;
