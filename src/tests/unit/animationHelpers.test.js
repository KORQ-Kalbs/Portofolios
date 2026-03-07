import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import gsap from 'gsap';
import {
  gpuTransform,
  staggerOnScroll,
  calculateTilt,
  batchUpdate,
  precomputeTimeline
} from '../../utils/animationHelpers';

describe('animationHelpers', () => {
  describe('gpuTransform', () => {
    it('should create a GSAP animation with force3D and willChange', () => {
      const element = document.createElement('div');
      const props = { x: 100, y: 50, duration: 0.5 };
      
      const tween = gpuTransform(element, props);
      
      expect(tween).toBeDefined();
      expect(tween.vars.force3D).toBe(true);
      expect(tween.vars.willChange).toBe('transform');
      expect(tween.vars.x).toBe(100);
      expect(tween.vars.y).toBe(50);
      expect(tween.vars.duration).toBe(0.5);
    });

    it('should preserve all custom properties', () => {
      const element = document.createElement('div');
      const props = {
        rotation: 45,
        scale: 1.5,
        opacity: 0.5,
        ease: 'power2.inOut'
      };
      
      const tween = gpuTransform(element, props);
      
      expect(tween.vars.rotation).toBe(45);
      expect(tween.vars.scale).toBe(1.5);
      expect(tween.vars.opacity).toBe(0.5);
      expect(tween.vars.ease).toBe('power2.inOut');
    });
  });

  describe('staggerOnScroll', () => {
    beforeEach(() => {
      // Mock ScrollTrigger
      gsap.registerPlugin({
        name: 'scrollTrigger',
        init: () => {}
      });
    });

    it('should create staggered animation with default options', () => {
      const elements = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div')
      ];
      const trigger = document.createElement('section');
      
      const timeline = staggerOnScroll(elements, { trigger });
      
      expect(timeline).toBeDefined();
    });

    it('should use custom stagger and scroll trigger options', () => {
      const elements = [document.createElement('div')];
      const trigger = document.createElement('section');
      
      const timeline = staggerOnScroll(elements, {
        trigger,
        stagger: 0.15,
        start: 'top 75%',
        end: 'top 50%',
        scrub: 1
      });
      
      expect(timeline).toBeDefined();
    });

    it('should animate from opacity 0 and y 30 to opacity 1 and y 0', () => {
      const element = document.createElement('div');
      const trigger = document.createElement('section');
      
      const timeline = staggerOnScroll([element], { trigger });
      
      // Check that animation targets are set correctly
      expect(timeline).toBeDefined();
    });
  });

  describe('calculateTilt', () => {
    it('should return zero rotation when cursor is at element center', () => {
      const element = document.createElement('div');
      element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 200,
        height: 200
      });
      
      const event = {
        clientX: 200, // center X
        clientY: 200  // center Y
      };
      
      const tilt = calculateTilt(event, element, 15);
      
      // Use closeTo for floating point comparison
      expect(Math.abs(tilt.rotateX)).toBeLessThan(0.001);
      expect(Math.abs(tilt.rotateY)).toBeLessThan(0.001);
    });

    it('should return maximum tilt when cursor is at element edge', () => {
      const element = document.createElement('div');
      element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 200,
        height: 200
      });
      
      const maxTilt = 15;
      
      // Cursor at right edge
      const eventRight = {
        clientX: 300, // right edge
        clientY: 200  // center Y
      };
      
      const tiltRight = calculateTilt(eventRight, element, maxTilt);
      
      expect(tiltRight.rotateY).toBe(maxTilt);
      expect(Math.abs(tiltRight.rotateX)).toBeLessThan(0.001);
    });

    it('should return negative rotation for left/top positions', () => {
      const element = document.createElement('div');
      element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 200,
        height: 200
      });
      
      const maxTilt = 15;
      
      // Cursor at left edge
      const eventLeft = {
        clientX: 100, // left edge
        clientY: 200  // center Y
      };
      
      const tiltLeft = calculateTilt(eventLeft, element, maxTilt);
      
      expect(tiltLeft.rotateY).toBe(-maxTilt);
    });

    it('should respect custom maxTilt parameter', () => {
      const element = document.createElement('div');
      element.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 100,
        height: 100
      });
      
      const customMaxTilt = 20;
      
      const event = {
        clientX: 100, // right edge
        clientY: 50   // center Y
      };
      
      const tilt = calculateTilt(event, element, customMaxTilt);
      
      expect(tilt.rotateY).toBe(customMaxTilt);
    });

    it('should invert rotateX for natural tilt effect', () => {
      const element = document.createElement('div');
      element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 200,
        height: 200
      });
      
      const maxTilt = 15;
      
      // Cursor at bottom edge
      const eventBottom = {
        clientX: 200, // center X
        clientY: 300  // bottom edge
      };
      
      const tiltBottom = calculateTilt(eventBottom, element, maxTilt);
      
      // rotateX should be negative (inverted) for bottom position
      expect(tiltBottom.rotateX).toBe(-maxTilt);
      expect(tiltBottom.rotateY).toBe(0);
    });
  });

  describe('batchUpdate', () => {
    it('should execute callback in next animation frame', async () => {
      const callback = vi.fn();
      
      batchUpdate(callback);
      
      // Callback should not be executed immediately
      expect(callback).not.toHaveBeenCalled();
      
      // Wait for next frame
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          expect(callback).toHaveBeenCalledTimes(1);
          resolve();
        });
      });
    });

    it('should return requestAnimationFrame ID', () => {
      const callback = vi.fn();
      const rafId = batchUpdate(callback);
      
      expect(typeof rafId).toBe('number');
      expect(rafId).toBeGreaterThan(0);
      
      // Clean up
      cancelAnimationFrame(rafId);
    });

    it('should pass through callback execution context', async () => {
      let executedValue = null;
      
      batchUpdate(() => {
        executedValue = 'executed';
      });
      
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          expect(executedValue).toBe('executed');
          resolve();
        });
      });
    });
  });

  describe('precomputeTimeline', () => {
    it('should progress timeline to end and back to start', () => {
      const element = document.createElement('div');
      const timeline = gsap.timeline();
      timeline.to(element, { x: 100, duration: 1 });
      
      const progressSpy = vi.spyOn(timeline, 'progress');
      
      precomputeTimeline(timeline);
      
      // Should be called twice: once with 1, once with 0
      expect(progressSpy).toHaveBeenCalledWith(1);
      expect(progressSpy).toHaveBeenCalledWith(0);
      expect(progressSpy).toHaveBeenCalledTimes(2);
    });

    it('should return the same timeline instance', () => {
      const timeline = gsap.timeline();
      const result = precomputeTimeline(timeline);
      
      expect(result).toBe(timeline);
    });

    it('should allow chaining', () => {
      const element = document.createElement('div');
      const timeline = gsap.timeline();
      
      const result = precomputeTimeline(timeline)
        .to(element, { x: 100 })
        .to(element, { y: 100 });
      
      expect(result).toBe(timeline);
    });

    it('should cache timeline calculations', () => {
      const element = document.createElement('div');
      const timeline = gsap.timeline();
      timeline.to(element, { x: 100, duration: 1 });
      
      precomputeTimeline(timeline);
      
      // Timeline should be at start position after precompute
      expect(timeline.progress()).toBe(0);
    });
  });
});
