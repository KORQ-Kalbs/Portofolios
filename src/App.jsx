import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import Sidebar from "./components/Sidebar";
import BubbleBg from "/src/components/BubbleBg";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Projects from "./sections/Projects";
import Contact from "./sections/Contact";
import { smoothScrollTo } from "./utils/gsapConfig";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

function App() {
  const mainRef = useRef(null);
  const containerRef = useRef(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    // Cleanup ScrollTrigger on unmount
    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element && !isScrollingRef.current) {
      isScrollingRef.current = true;
      smoothScrollTo(element, 80);
      // Allow scroll immediately without waiting
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 100);
    }
  };

  return (
    <div ref={containerRef} className="flex min-h-screen">
      <BubbleBg />
      <Sidebar onNavigate={scrollToSection} />
      <main
        ref={mainRef}
        className="flex-1 pt-20 overflow-y-auto md:ml-64 md:pt-0 custom-scrollbar"
      >
        <div className="min-h-screen flex flex-col justify-center p-6 md:p-12">
          <div id="hero">
            <Hero onNavigate={scrollToSection} />
          </div>
        </div>

        <div className="min-h-screen flex flex-col justify-center p-6 md:p-12">
          <div id="about">
            <About />
          </div>
        </div>

        <div className="min-h-screen flex flex-col justify-center p-6 md:p-12">
          <div id="projects">
            <Projects />
          </div>
        </div>

        <div className="min-h-screen flex flex-col justify-center p-6 md:p-12">
          <div id="contact">
            <Contact />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
