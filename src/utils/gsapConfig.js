import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

// Register plugins
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// Set global defaults for smooth animations
gsap.defaults({
  duration: 0.6,
  ease: "power2.out",
});

// Configure ScrollTrigger
ScrollTrigger.defaults({
  markers: false,
  onUpdate: (self) => {
    // Any global scroll trigger updates
  },
});

// Smooth scroll configuration
export const smoothScrollTo = (target, offsetY = 80) => {
  gsap.to(window, {
    scrollTo: { y: target, offsetY },
    duration: 1.2,
    ease: "power2.inOut",
  });
};

// Stagger animation helper
export const staggerElements = (elements, options = {}) => {
  const defaults = {
    duration: 0.6,
    stagger: 0.1,
    ease: "power2.out",
    ...options,
  };

  return gsap.fromTo(
    elements,
    {
      opacity: 0,
      y: 30,
      ...options.from,
    },
    {
      opacity: 1,
      y: 0,
      ...defaults,
      ...options.to,
    },
  );
};

// Parallax scroll helper
export const createParallax = (element, speed = 0.5) => {
  gsap.to(element, {
    y: () => gsap.getProperty(window, "scrollY") * speed,
    ease: "none",
    duration: 0,
  });
};

// Performance optimization: Disable animations on low-power devices
export const prefersReducedMotion = () => {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Debounce helper for scroll events
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default {
  smoothScrollTo,
  staggerElements,
  createParallax,
  prefersReducedMotion,
  debounce,
};
