/**
 * SectionWrapper.jsx
 * Wraps every major section with:
 * - Consistent max-width container & padding
 * - A ScrollTrigger-powered staggered entrance (fade + rise)
 * - An optional section label (e.g. "01 / ABOUT") in the top-left
 * - A horizontal olive rule that animates in under the label
 *
 * Props:
 *   id        {string}           The HTML id used for anchor navigation
 *   label     {string}           Short section label, e.g. "01 / ABOUT"
 *   children  {ReactNode}
 *   className {string}           Extra Tailwind classes on the outer <section>
 *   fullWidth {boolean}          If true, skip the inner max-width container
 */
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const SectionWrapper = ({
  id,
  label,
  children,
  className = "",
  fullWidth = false,
}) => {
  const sectionRef = useRef(null);
  const labelRef = useRef(null);
  const ruleRef = useRef(null);
  const contentRef = useRef(null);

  // ── Scroll-triggered entrance animation ──────────────────────────────────
  useGSAP(
    () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 88%",
          once: true, // Only animate on first entry
        },
      });

      // Label slides in from left
      if (labelRef.current) {
        tl.fromTo(
          labelRef.current,
          { x: -24, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.55, ease: "power2.out" },
          0,
        );
      }

      // Rule expands from left
      if (ruleRef.current) {
        tl.fromTo(
          ruleRef.current,
          { scaleX: 0, transformOrigin: "left" },
          { scaleX: 1, duration: 0.7, ease: "power3.inOut" },
          0.1,
        );
      }

      // Content block fades + rises
      if (contentRef.current) {
        tl.fromTo(
          contentRef.current,
          { y: 32, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power2.out" },
          0.2,
        );
      }
    },
    { scope: sectionRef },
  );

  return (
    <section
      id={id}
      ref={sectionRef}
      className={`section ${className}`}
      style={{
        padding: "6rem 0",
        position: "relative",
        zIndex: 1, // sit above the canvas BubbleBg (z-index: 0)
      }}
    >
      {/* ── Max-width wrapper ── */}
      <div
        style={{
          maxWidth: fullWidth ? "100%" : "1200px",
          margin: "0 auto",
          padding: fullWidth ? 0 : "0 2rem",
        }}
      >
        {/* ── Section label + rule ── */}
        {label && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "2.5rem",
            }}
          >
            <span
              ref={labelRef}
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#9ab050",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
            <div
              ref={ruleRef}
              style={{
                flex: 1,
                height: "1px",
                background:
                  "linear-gradient(to right, rgba(154,176,80,0.5), rgba(154,176,80,0.05))",
              }}
            />
          </div>
        )}

        {/* ── Main content ── */}
        <div ref={contentRef}>{children}</div>
      </div>
    </section>
  );
};

export default SectionWrapper;
