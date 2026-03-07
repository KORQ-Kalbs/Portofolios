import React, { useState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SectionWrapper from "/src/components/SectionWrapper";

gsap.registerPlugin(ScrollTrigger);

const Contact = () => {
  const [status, setStatus] = useState("");
  const containerRef = useRef(null);
  const formRef = useRef(null);
  const inputsRef = useRef([]);

  useGSAP(() => {
    const ctx = gsap.context(() => {
      // Form entrance animation
      gsap.fromTo(
        formRef.current,
        { opacity: 0, y: 50, rotateX: 10 },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.8,
          scrollTrigger: {
            trigger: formRef.current,
            start: "top 80%",
            end: "top 60%",
            scrub: 0.5,
            markers: false,
          },
        },
      );

      // Input field animations
      inputsRef.current.forEach((input, idx) => {
        if (!input) return;

        // Entrance animation
        gsap.fromTo(
          input,
          { opacity: 0, x: -30 },
          {
            opacity: 1,
            x: 0,
            duration: 0.5,
            delay: idx * 0.1,
            scrollTrigger: {
              trigger: formRef.current,
              start: "top 75%",
              end: "top 55%",
              scrub: 0.3,
              markers: false,
            },
          },
        );

        // Focus animations
        input.addEventListener("focus", () => {
          gsap.to(input, {
            boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
            borderColor: "#3b82f6",
            duration: 0.3,
            ease: "power2.out",
          });
        });

        input.addEventListener("blur", () => {
          gsap.to(input, {
            boxShadow: "none",
            borderColor: "rgb(55, 65, 81)",
            duration: 0.3,
            ease: "power2.out",
          });
        });
      });
    }, containerRef);

    return () => ctx.revert();
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Button animation on submit
    const btn = e.currentTarget.querySelector("button");
    gsap.to(btn, {
      scale: 0.95,
      duration: 0.1,
      ease: "power2.in",
    });
    gsap.to(btn, {
      scale: 1,
      duration: 0.3,
      delay: 0.1,
      ease: "power2.out",
    });

    setStatus("✓ Message sent successfully!");
    e.currentTarget.reset();

    setTimeout(() => setStatus(""), 3000);
  };

  return (
    <SectionWrapper title="Get In Touch">
      <div ref={containerRef} className="max-w-lg mx-auto">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="space-y-4 p-8 border border-gray-700 bg-gray-800/30 rounded-3xl backdrop-blur-sm"
        >
          <input
            ref={(el) => (inputsRef.current[0] = el)}
            required
            type="text"
            placeholder="Your Name"
            className="w-full p-4 transition-all border border-gray-700 outline-none bg-gray-900/50 rounded-xl focus:border-blue-500"
          />
          <input
            ref={(el) => (inputsRef.current[1] = el)}
            required
            type="email"
            placeholder="Your Email"
            className="w-full p-4 transition-all border border-gray-700 outline-none bg-gray-900/50 rounded-xl focus:border-blue-500"
          />
          <textarea
            ref={(el) => (inputsRef.current[2] = el)}
            required
            placeholder="Message"
            rows="4"
            className="w-full p-4 transition-all border border-gray-700 outline-none bg-gray-900/50 rounded-xl focus:border-blue-500 resize-none"
          />
          <button
            type="submit"
            className="w-full py-4 font-bold transition-all bg-blue-600 shadow-lg hover:bg-blue-700 rounded-xl shadow-blue-500/20 hover:shadow-blue-500/40 relative overflow-hidden group"
          >
            <span className="relative z-10">Send Message</span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
          {status && (
            <p className="text-sm text-center text-green-400 font-medium animate-pulse">
              {status}
            </p>
          )}
        </form>

        {/* Contact info */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="p-4 border border-gray-700 rounded-xl bg-gray-800/20 text-center hover:border-blue-500/50 transition-colors cursor-pointer group">
            <p className="text-2xl mb-2 group-hover:scale-110 transition-transform">
              📧
            </p>
            <p className="text-sm text-gray-400">Email</p>
            <p className="text-xs text-gray-500 mt-1">contact@example.com</p>
          </div>
          <div className="p-4 border border-gray-700 rounded-xl bg-gray-800/20 text-center hover:border-blue-500/50 transition-colors cursor-pointer group">
            <p className="text-2xl mb-2 group-hover:scale-110 transition-transform">
              📱
            </p>
            <p className="text-sm text-gray-400">Phone</p>
            <p className="text-xs text-gray-500 mt-1">+62 812 3456 7890</p>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

export default Contact;
