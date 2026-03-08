/**
 * Cursor.jsx
 * Custom cursor system with two layers:
 *   1. A small precise dot (follows mouse instantly)
 *   2. An olive robot character that trails behind with a soft lag
 *
 * The robot's eyes shift direction based on movement velocity,
 * giving it a "looking around" personality.
 *
 * Mount once inside App.jsx — it is position:fixed so it overlays everything.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";

// ── Inline SVG Robot Character ───────────────────────────────────────────────
/**
 * A small pixel-art-inspired robot head.
 * eyeX / eyeY shift the pupils to simulate looking in a direction.
 */
const RobotSVG = ({ eyeX = 0, eyeY = 0 }) => (
  <svg
    width="52"
    height="62"
    viewBox="0 0 52 62"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    {/* Antenna stem */}
    <line
      x1="26"
      y1="0"
      x2="26"
      y2="9"
      stroke="#7a9040"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Antenna tip orb */}
    <circle cx="26" cy="3" r="3" fill="#9ab050" />

    {/* Head outer shell */}
    <rect x="4" y="9" width="44" height="38" rx="9" fill="#1c1c1a" />
    {/* Head inner panel */}
    <rect
      x="7"
      y="12"
      width="38"
      height="32"
      rx="7"
      fill="#141413"
      stroke="#7a9040"
      strokeWidth="0.8"
    />

    {/* Left eye socket */}
    <rect x="11" y="20" width="12" height="9" rx="3" fill="#0a0a09" />
    {/* Left eye glow */}
    <rect
      x="12"
      y="21"
      width="10"
      height="7"
      rx="2"
      fill="#9ab050"
      opacity="0.9"
    />
    {/* Left pupil — shifts with eyeX / eyeY */}
    <rect
      x={14 + Math.round(eyeX)}
      y={22 + Math.round(eyeY)}
      width="4"
      height="4"
      rx="1"
      fill="#0a0a09"
    />
    {/* Left eye glint */}
    <rect
      x="13"
      y="22"
      width="2"
      height="2"
      rx="0.5"
      fill="white"
      opacity="0.5"
    />

    {/* Right eye socket */}
    <rect x="29" y="20" width="12" height="9" rx="3" fill="#0a0a09" />
    {/* Right eye glow */}
    <rect
      x="30"
      y="21"
      width="10"
      height="7"
      rx="2"
      fill="#9ab050"
      opacity="0.9"
    />
    {/* Right pupil */}
    <rect
      x={32 + Math.round(eyeX)}
      y={22 + Math.round(eyeY)}
      width="4"
      height="4"
      rx="1"
      fill="#0a0a09"
    />
    {/* Right eye glint */}
    <rect
      x="31"
      y="22"
      width="2"
      height="2"
      rx="0.5"
      fill="white"
      opacity="0.5"
    />

    {/* Mouth panel */}
    <rect x="14" y="33" width="24" height="5" rx="2.5" fill="#0a0a09" />
    {/* Mouth LED segments — indicate expression */}
    <rect
      x="16"
      y="34"
      width="4"
      height="3"
      rx="1"
      fill="#9ab050"
      opacity="0.7"
    />
    <rect
      x="22"
      y="34"
      width="4"
      height="3"
      rx="1"
      fill="#9ab050"
      opacity="0.4"
    />
    <rect
      x="28"
      y="34"
      width="4"
      height="3"
      rx="1"
      fill="#9ab050"
      opacity="0.7"
    />

    {/* Neck */}
    <rect x="20" y="47" width="12" height="6" rx="2" fill="#1c1c1a" />

    {/* Body / torso */}
    <rect
      x="8"
      y="53"
      width="36"
      height="9"
      rx="5"
      fill="#1c1c1a"
      stroke="#7a9040"
      strokeWidth="0.7"
    />
    {/* Body LED dot */}
    <circle cx="26" cy="58" r="2" fill="#9ab050" opacity="0.6" />
  </svg>
);

// ── Component ────────────────────────────────────────────────────────────────
const Cursor = () => {
  const dotRef = useRef(null); // precise cursor dot
  const charRef = useRef(null); // lagging robot character
  const eyeXRef = useRef(0); // current eye offset x (for React re-render avoidance)
  const eyeYRef = useRef(0);
  const prevMouseRef = useRef({ x: 0, y: 0 }); // last frame mouse pos for velocity
  const rafRef = useRef(null);

  useEffect(() => {
    const dot = dotRef.current;
    const char = charRef.current;

    // quickTo — creates an optimised setter that GSAP re-uses each frame
    const dotXTo = gsap.quickTo(dot, "x", { duration: 0.05 });
    const dotYTo = gsap.quickTo(dot, "y", { duration: 0.05 });
    const charXTo = gsap.quickTo(char, "x", {
      duration: 0.7,
      ease: "power3.out",
    });
    const charYTo = gsap.quickTo(char, "y", {
      duration: 0.7,
      ease: "power3.out",
    });

    let mouseX = -200;
    let mouseY = -200;

    /** Track raw mouse position each frame */
    const onMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Dot follows instantly
      dotXTo(mouseX - 4);
      dotYTo(mouseY - 4);

      // Character follows with lag, centred around cursor
      charXTo(mouseX - 26); // half of SVG width
      charYTo(mouseY - 70); // above cursor
    };

    /**
     * rAF loop — we continuously update eye direction based on
     * velocity between the cursor and the robot's current position.
     */
    const tick = () => {
      const cx = parseFloat(gsap.getProperty(char, "x")) + 26;
      const cy = parseFloat(gsap.getProperty(char, "y")) + 35;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const mag = Math.sqrt(dx * dx + dy * dy);

      // Clamp eye offset to ±2 pixels
      const maxEye = 2;
      eyeXRef.current =
        mag > 5 ? (dx / mag) * Math.min(mag / 60, 1) * maxEye : 0;
      eyeYRef.current =
        mag > 5 ? (dy / mag) * Math.min(mag / 60, 1) * maxEye : 0;

      // Directly mutate the SVG rect elements for eye pupils
      // (avoids React re-rendering the whole component every frame)
      const pupils = char.querySelectorAll("[data-pupil]");
      pupils.forEach((p) => {
        const baseX = parseFloat(p.getAttribute("data-base-x"));
        const baseY = parseFloat(p.getAttribute("data-base-y"));
        p.setAttribute("x", baseX + Math.round(eyeXRef.current));
        p.setAttribute("y", baseY + Math.round(eyeYRef.current));
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    // Hide character off-screen initially
    gsap.set([dot, char], { x: -200, y: -200 });

    window.addEventListener("mousemove", onMouseMove);
    rafRef.current = requestAnimationFrame(tick);

    // Scale-down cursor when pressing
    const shrink = () => gsap.to(dot, { scale: 0.5, duration: 0.15 });
    const unshrink = () => gsap.to(dot, { scale: 1, duration: 0.15 });
    window.addEventListener("mousedown", shrink);
    window.addEventListener("mouseup", unshrink);

    // Robot bounces when entering clickable elements
    const onHoverEnter = () =>
      gsap.to(char, {
        y: "-=8",
        duration: 0.25,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      });
    document.querySelectorAll("a, button, [role=button]").forEach((el) => {
      el.addEventListener("mouseenter", onHoverEnter);
    });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", shrink);
      window.removeEventListener("mouseup", unshrink);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      {/* ── Precise cursor dot ── */}
      <div
        ref={dotRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#9ab050",
          zIndex: 10000,
          pointerEvents: "none",
          mixBlendMode: "difference",
        }}
      />

      {/* ── Robot character ── */}
      <div
        ref={charRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 9999,
          pointerEvents: "none",
          userSelect: "none",
          // Subtle drop shadow
          filter: "drop-shadow(0 4px 12px rgba(107,124,62,0.4))",
        }}
      >
        {/* We render once and manipulate DOM directly for pupils to avoid per-frame re-renders */}
        <svg
          width="52"
          height="62"
          viewBox="0 0 52 62"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="26"
            y1="0"
            x2="26"
            y2="9"
            stroke="#7a9040"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="26" cy="3" r="3" fill="#9ab050" />
          <rect x="4" y="9" width="44" height="38" rx="9" fill="#1c1c1a" />
          <rect
            x="7"
            y="12"
            width="38"
            height="32"
            rx="7"
            fill="#141413"
            stroke="#7a9040"
            strokeWidth="0.8"
          />

          {/* Left eye */}
          <rect x="11" y="20" width="12" height="9" rx="3" fill="#0a0a09" />
          <rect
            x="12"
            y="21"
            width="10"
            height="7"
            rx="2"
            fill="#9ab050"
            opacity="0.9"
          />
          <rect
            data-pupil="true"
            data-base-x="14"
            data-base-y="22"
            x="14"
            y="22"
            width="4"
            height="4"
            rx="1"
            fill="#0a0a09"
          />
          <rect
            x="13"
            y="22"
            width="2"
            height="2"
            rx="0.5"
            fill="white"
            opacity="0.5"
          />

          {/* Right eye */}
          <rect x="29" y="20" width="12" height="9" rx="3" fill="#0a0a09" />
          <rect
            x="30"
            y="21"
            width="10"
            height="7"
            rx="2"
            fill="#9ab050"
            opacity="0.9"
          />
          <rect
            data-pupil="true"
            data-base-x="32"
            data-base-y="22"
            x="32"
            y="22"
            width="4"
            height="4"
            rx="1"
            fill="#0a0a09"
          />
          <rect
            x="31"
            y="22"
            width="2"
            height="2"
            rx="0.5"
            fill="white"
            opacity="0.5"
          />

          {/* Mouth */}
          <rect x="14" y="33" width="24" height="5" rx="2.5" fill="#0a0a09" />
          <rect
            x="16"
            y="34"
            width="4"
            height="3"
            rx="1"
            fill="#9ab050"
            opacity="0.7"
          />
          <rect
            x="22"
            y="34"
            width="4"
            height="3"
            rx="1"
            fill="#9ab050"
            opacity="0.4"
          />
          <rect
            x="28"
            y="34"
            width="4"
            height="3"
            rx="1"
            fill="#9ab050"
            opacity="0.7"
          />

          <rect x="20" y="47" width="12" height="6" rx="2" fill="#1c1c1a" />
          <rect
            x="8"
            y="53"
            width="36"
            height="9"
            rx="5"
            fill="#1c1c1a"
            stroke="#7a9040"
            strokeWidth="0.7"
          />
          <circle cx="26" cy="58" r="2" fill="#9ab050" opacity="0.6" />
        </svg>
      </div>
    </>
  );
};

export default Cursor;
