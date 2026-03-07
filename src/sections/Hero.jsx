import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import SectionWrapper from "/src/components/SectionWrapper";

const Hero = ({ onNavigate }) => {
  const containerRef = useRef(null);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const buttonsRef = useRef([]);

  useGSAP(() => {
    const ctx = gsap.context(() => {
      // Stagger animation for title words
      const titleChars = titleRef.current?.querySelectorAll(".char");
      if (titleChars?.length) {
        gsap.fromTo(
          titleChars,
          {
            opacity: 0,
            y: 30,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.03,
            ease: "power2.out",
          },
        );
      }

      // Description fade in
      gsap.fromTo(
        descRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, delay: 0.3, ease: "power2.out" },
      );

      // Button animations
      buttonsRef.current.forEach((btn, idx) => {
        if (!btn) return;
        gsap.fromTo(
          btn,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            delay: 0.5 + idx * 0.15,
            ease: "power2.out",
          },
        );

        // Hover animation for buttons
        btn.addEventListener("mouseenter", () => {
          gsap.to(btn, {
            scale: 1.05,
            duration: 0.3,
            ease: "power2.out",
          });
          if (btn.classList.contains("bg-blue-600")) {
            gsap.to(btn, {
              boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)",
              duration: 0.3,
            });
          }
        });

        btn.addEventListener("mouseleave", () => {
          gsap.to(btn, {
            scale: 1,
            duration: 0.3,
            ease: "power2.out",
            boxShadow: "none",
          });
        });
      });
    }, containerRef);

    return () => ctx.revert();
  });

  const splitTextIntoChars = (text) => {
    return text.split("").map((char, idx) => (
      <span key={idx} className="char inline-block">
        {char === " " ? "\u00A0" : char}
      </span>
    ));
  };

  return (
    <SectionWrapper title="Welcome to my world">
      <div ref={containerRef} className="space-y-6">
        <h1
          ref={titleRef}
          className="text-5xl font-extrabold leading-tight md:text-7xl"
        >
          {splitTextIntoChars("Transforming ")}
          <span className="text-blue-500 inline-block">
            {splitTextIntoChars("Ideas")}
          </span>
          {splitTextIntoChars(" into Digital ")}
          <span className="text-purple-500 inline-block">
            {splitTextIntoChars("Reality.")}
          </span>
        </h1>

        <p ref={descRef} className="max-w-2xl text-lg text-gray-400">
          I'm a Full-stack Developer focused on building clean, performant, and
          user-centric applications.
        </p>

        <div className="flex pt-4 space-x-4">
          <button
            ref={(el) => (buttonsRef.current[0] = el)}
            onClick={() => onNavigate("projects")}
            className="px-8 py-3 font-semibold transition-all bg-blue-600 rounded-full hover:bg-blue-700 relative overflow-hidden group"
          >
            <span className="relative z-10">View Projects</span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>

          <button
            ref={(el) => (buttonsRef.current[1] = el)}
            onClick={() => onNavigate("contact")}
            className="px-8 py-3 font-semibold transition-all border border-gray-600 rounded-full hover:border-blue-500 hover:bg-blue-500/10 group"
          >
            <span className="relative z-10">Contact Me</span>
          </button>
        </div>
      </div>
    </SectionWrapper>
  );
};

export default Hero;
