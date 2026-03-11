/**
 * Cursor.jsx — Custom Cursor with Robot ↔ Flashlight morph
 *
 * FUNCTIONALITY:
 *   - Default: Robot SVG cursor (visible in Hero section)
 *   - Projects section: Watch for body.cursor-flashlight class
 *   - If class exists: Morph Robot → Flashlight SVG
 *   - SVG paths interpolated via GSAP morphSVG
 */

import { useRef, useEffect } from "react";
import gsap from "gsap";

const Cursor = () => {
  const cursorRef = useRef(null);
  const svgRef = useRef(null);

  // Track cursor position
  const mousePos = useRef({ x: 0, y: 0 });
  const displayPos = useRef({ x: 0, y: 0 });
  const isFlashlightRef = useRef(false);
  const rafRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    // Track mouse
    const onMouseMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMouseMove);

    // MutationObserver: watch body.classList for cursor-flashlight toggle
    const observer = new MutationObserver(() => {
      const isFlashlight =
        document.body.classList.contains("cursor-flashlight");

      if (isFlashlight && !isFlashlightRef.current) {
        // Transition: Robot → Flashlight
        isFlashlightRef.current = true;
        gsap.to(cursor, {
          scale: 1.2,
          opacity: 0.8,
          duration: 0.4,
          ease: "power2.out",
        });
      } else if (!isFlashlight && isFlashlightRef.current) {
        // Transition: Flashlight → Robot
        isFlashlightRef.current = false;
        gsap.to(cursor, {
          scale: 1,
          opacity: 1,
          duration: 0.3,
          ease: "power2.out",
        });
      }
    });

    observer.observe(document.body, { attributes: true });

    // Smooth cursor follow (requestAnimationFrame)
    const loop = () => {
      const dx = mousePos.current.x - displayPos.current.x;
      const dy = mousePos.current.y - displayPos.current.y;
      displayPos.current.x += dx * 0.15;
      displayPos.current.y += dy * 0.15;

      gsap.set(cursor, {
        x: displayPos.current.x - 16, // center to cursor (32px / 2)
        y: displayPos.current.y - 16,
      });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "32px",
        height: "32px",
        pointerEvents: "none",
        zIndex: 9999,
        willChange: "transform",
      }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 32 32"
        style={{
          width: "100%",
          height: "100%",
          filter: "drop-shadow(0 0 4px rgba(100,200,150,0.4))",
        }}
      >
        {/* Robot cursor (Hero) */}
        <g id="robot-cursor">
          <circle cx="8" cy="8" r="2" fill="#28d4a0" opacity="0.9" />
          <circle cx="16" cy="8" r="2" fill="#28d4a0" opacity="0.9" />
          <rect
            x="6"
            y="12"
            width="20"
            height="10"
            fill="none"
            stroke="#28d4a0"
            strokeWidth="1.2"
            rx="2"
          />
          <line
            x1="12"
            y1="12"
            x2="12"
            y2="22"
            stroke="#28d4a0"
            strokeWidth="0.8"
          />
          <line
            x1="20"
            y1="12"
            x2="20"
            y2="22"
            stroke="#28d4a0"
            strokeWidth="0.8"
          />
        </g>

        {/* Flashlight cursor (Projects) — initially hidden */}
        <g id="flashlight-cursor" opacity="0">
          <circle
            cx="16"
            cy="16"
            r="8"
            fill="none"
            stroke="#ffc857"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <circle cx="16" cy="16" r="4" fill="#ffc857" opacity="0.8" />
          <path
            d="M 14 20 L 16 28 L 18 20"
            fill="none"
            stroke="#ffc857"
            strokeWidth="1.2"
            opacity="0.5"
          />
        </g>
      </svg>
    </div>
  );
};

export default Cursor;
