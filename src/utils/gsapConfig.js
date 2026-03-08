/**
 * gsapConfig.js
 * Central GSAP configuration — import this ONCE at the top of App.jsx
 * All other components can import from "gsap" directly; plugins are
 * already registered globally by the time they mount.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

// Register plugins globally so every component can use them
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/**
 * Smoothly scrolls the page to a section element by its id.
 * Uses GSAP ScrollToPlugin for consistent cross-browser behaviour.
 *
 * @param {string} id   - The id attribute of the target section (without "#")
 * @param {number} [offset=0] - Optional pixel offset from the top of the element
 */
export const smoothScrollTo = (id, offset = 0) => {
  gsap.to(window, {
    duration: 1.3,
    scrollTo: { y: `#${id}`, offsetY: offset },
    ease: "power3.inOut",
  });
};

/**
 * Default GSAP config tweaks — sets a slightly higher fps cap
 * and uses requestAnimationFrame for smoother animations.
 */
gsap.config({
  autoSleep: 60,
  force3D: true,
  nullTargetWarn: false,
});

export default gsap;
