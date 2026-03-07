import gsap from 'gsap';

/**
 * PerformanceMonitor class for tracking and optimizing animation performance
 * Monitors FPS and automatically optimizes animations when performance drops below 50fps
 * 
 * @class PerformanceMonitor
 * @example
 * const monitor = new PerformanceMonitor();
 * monitor.startMonitoring();
 * // ... later
 * monitor.stopMonitoring();
 */
export class PerformanceMonitor {
  constructor() {
    this.fps = 60;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.rafId = null;
  }
  
  /**
   * Start monitoring FPS using requestAnimationFrame
   * Continuously measures frame rate and triggers optimization if FPS drops below 50
   */
  startMonitoring() {
    this.rafId = requestAnimationFrame(this.measure.bind(this));
  }
  
  /**
   * Measure current FPS by counting frames over 1 second intervals
   * Triggers optimizeAnimations if FPS drops below 50
   * @private
   */
  measure() {
    this.frameCount++;
    const currentTime = performance.now();
    
    if (currentTime >= this.lastTime + 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
      this.frameCount = 0;
      this.lastTime = currentTime;
      
      if (this.fps < 50) {
        console.warn('Low FPS detected:', this.fps);
        this.optimizeAnimations();
      }
    }
    
    this.rafId = requestAnimationFrame(this.measure.bind(this));
  }
  
  /**
   * Optimize animations by reducing complexity
   * Speeds up global timeline slightly to reduce frame time
   */
  optimizeAnimations() {
    // Reduce animation complexity by speeding up slightly
    gsap.globalTimeline.timeScale(1.2);
  }
  
  /**
   * Stop monitoring and cancel the requestAnimationFrame loop
   */
  stopMonitoring() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
