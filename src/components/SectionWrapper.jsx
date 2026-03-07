import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const SectionWrapper = ({ children, title }) => {
  const titleRef = useRef(null);
  const containerRef = useRef(null);

  useGSAP(() => {
    const ctx = gsap.context(() => {
      // Title animation on scroll
      gsap.fromTo(
        titleRef.current,
        { opacity: 0, x: -30 },
        {
          opacity: 1,
          x: 0,
          duration: 0.6,
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 85%",
            end: "top 75%",
            scrub: 0.3,
            markers: false,
          },
        },
      );

      // Children fade in
      gsap.fromTo(
        containerRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.8,
          delay: 0.2,
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 85%",
            end: "top 70%",
            scrub: 0.3,
            markers: false,
          },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  });

  return (
    <div ref={containerRef} className="max-w-6xl mx-auto space-y-8 opacity-100">
      <div
        ref={titleRef}
        className="inline-block px-4 py-1 mb-4 text-sm font-medium text-blue-400 border rounded-full bg-blue-500/10 border-blue-500/20"
      >
        {title}
      </div>
      {children}
    </div>
  );
};

export default SectionWrapper;
