import gsap from "gsap";

/**
 * GPU-accelerated transform animation
 * Ensures animations use GPU acceleration with force3D and will-change hints
 * 
 * @param {Element|string} element - DOM element or selector
 * @param {Object} props - GSAP animation properties
 * @returns {gsap.core.Tween} GSAP tween instance
 * 
 * @example
 * gpuTransform('.box', { x: 100, y: 50, rotation: 45, duration: 0.5 });
 */
export const gpuTransform = (element, props) => {
  return gsap.to(element, {
    ...props,
    force3D: true,
    willChange: 'transform'
  });
};

/**
 * Stagger animation with scroll trigger
 * Creates staggered entrance animations triggered by scroll position
 * 
 * @param {Element[]|string} elements - Array of elements or selector
 * @param {Object} options - Configuration options
 * @param {Element|string} options.trigger - ScrollTrigger trigger element
 * @param {number} [options.stagger=0.1] - Stagger delay between elements
 * @param {string} [options.start='top 80%'] - ScrollTrigger start position
 * @param {string} [options.end='top 60%'] - ScrollTrigger end position
 * @param {number|boolean} [options.scrub=0.5] - Scrub smoothness
 * @returns {gsap.core.Timeline} GSAP timeline instance
 * 
 * @example
 * staggerOnScroll('.card', {
 *   trigger: '.section',
 *   stagger: 0.15,
 *   start: 'top 75%'
 * });
 */
export const staggerOnScroll = (elements, options) => {
  const {
    trigger,
    stagger = 0.1,
    start = 'top 80%',
    end = 'top 60%',
    scrub = 0.5
  } = options;

  return gsap.fromTo(
    elements,
    { opacity: 0, y: 30 },
    {
      opacity: 1,
      y: 0,
      stagger: stagger,
      scrollTrigger: {
        trigger: trigger,
        start: start,
        end: end,
        scrub: scrub
      }
    }
  );
};

/**
 * Calculate cursor-based rotation for perspective tilt effect
 * Computes rotateX and rotateY values based on cursor distance from element center
 * 
 * @param {MouseEvent} event - Mouse event object
 * @param {Element} element - Target DOM element
 * @param {number} [maxTilt=15] - Maximum tilt angle in degrees
 * @returns {Object} Object with rotateX and rotateY values
 * 
 * @example
 * element.addEventListener('mousemove', (e) => {
 *   const tilt = calculateTilt(e, element, 15);
 *   gsap.to(element, { rotateX: tilt.rotateX, rotateY: tilt.rotateY });
 * });
 */
export const calculateTilt = (event, element, maxTilt = 15) => {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // Calculate normalized distance from center (-1 to 1)
  const deltaX = (event.clientX - centerX) / (rect.width / 2);
  const deltaY = (event.clientY - centerY) / (rect.height / 2);
  
  // Calculate rotation angles
  // Y rotation for horizontal movement, X rotation for vertical (inverted)
  return {
    rotateY: deltaX * maxTilt,
    rotateX: -deltaY * maxTilt
  };
};

/**
 * Batch DOM operations using requestAnimationFrame
 * Ensures DOM reads/writes are batched for optimal performance
 * 
 * @param {Function} callback - Function to execute in next animation frame
 * @returns {number} requestAnimationFrame ID
 * 
 * @example
 * batchUpdate(() => {
 *   // Perform DOM operations here
 *   element.style.transform = 'translateX(100px)';
 * });
 */
export const batchUpdate = (callback) => {
  return requestAnimationFrame(() => {
    callback();
  });
};

/**
 * Precompute timeline for optimization
 * Forces timeline to render once to cache calculations
 * Improves performance for complex timelines that will be played multiple times
 * 
 * @param {gsap.core.Timeline} timeline - GSAP timeline instance
 * @returns {gsap.core.Timeline} The same timeline instance (for chaining)
 * 
 * @example
 * const tl = gsap.timeline();
 * tl.to('.box', { x: 100 })
 *   .to('.box', { y: 100 });
 * precomputeTimeline(tl);
 */
export const precomputeTimeline = (timeline) => {
  // Progress to end and back to start to cache all calculations
  timeline.progress(1).progress(0);
  return timeline;
};

export default {
  gpuTransform,
  staggerOnScroll,
  calculateTilt,
  batchUpdate,
  precomputeTimeline
};
