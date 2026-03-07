import React, { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

const Sidebar = ({ onNavigate }) => {
  const [currentTime, setCurrentTime] = useState("");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const menuItemsRef = useRef([]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      };
      setCurrentTime(now.toLocaleDateString("en-US", options));
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  const menuItems = [
    { id: "hero", label: "Home" },
    { id: "about", label: "About" },
    { id: "projects", label: "Projects" },
    { id: "contact", label: "Contact" },
  ];

  useGSAP(() => {
    menuItemsRef.current.forEach((btn) => {
      if (!btn) return;

      // Create hover animation
      btn.addEventListener("mouseenter", () => {
        gsap.to(btn, {
          x: 10,
          duration: 0.3,
          ease: "power2.out",
        });
        gsap.to(btn.querySelector(".menu-dot"), {
          scale: 1.2,
          opacity: 1,
          duration: 0.3,
          ease: "power2.out",
        });
        gsap.to(btn.querySelector(".menu-label"), {
          color: "#60a5fa",
          duration: 0.3,
          ease: "power2.out",
        });
      });

      btn.addEventListener("mouseleave", () => {
        gsap.to(btn, {
          x: 0,
          duration: 0.3,
          ease: "power2.out",
        });
        gsap.to(btn.querySelector(".menu-dot"), {
          scale: 0.8,
          opacity: 0.5,
          duration: 0.3,
          ease: "power2.out",
        });
        gsap.to(btn.querySelector(".menu-label"), {
          color: "inherit",
          duration: 0.3,
          ease: "power2.out",
        });
      });
    });
  }, []);

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed z-50 p-2 bg-blue-600 rounded-lg md:hidden top-4 right-4 hover:bg-blue-700 transition-colors"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16m-7 6h7"
          />
        </svg>
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-gray-900 via-gray-900/95 to-gray-900 border-r border-gray-800/50 transform transition-transform duration-300 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="flex flex-col h-full p-6">
          <div className="mb-8 text-center">
            <div className="w-24 h-24 p-1 mx-auto mb-4 rounded-full shadow-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-blue-500/20">
              <img
                src="/img/profile.png"
                alt="Profile"
                className="object-cover w-full h-full border-2 border-gray-800 rounded-full"
              />
            </div>
            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Kafkha Yasin
            </h1>
            <p className="mt-1 text-xs text-gray-400">{currentTime}</p>
          </div>

          <nav className="flex-1 space-y-3">
            {menuItems.map((item, idx) => (
              <button
                key={item.id}
                ref={(el) => (menuItemsRef.current[idx] = el)}
                onClick={() => {
                  onNavigate(item.id);
                  setIsMobileOpen(false);
                }}
                className="relative flex items-center w-full px-4 py-3 text-left text-gray-300 transition-all rounded-lg group hover:bg-gray-800/50"
              >
                <span className="menu-dot absolute left-2 w-2 h-2 bg-blue-500 rounded-full scale-75 opacity-50 transition-all"></span>
                <span className="menu-label ml-6 font-medium transition-colors">
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="pt-6 mt-6 border-t border-gray-800/50">
            <p className="text-xs text-gray-500 text-center">
              © 2024 Kafkha Yasin
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
