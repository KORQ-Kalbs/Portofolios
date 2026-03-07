import React, { useEffect, useRef } from "react";

const BubbleBg = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const createBubbles = () => {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < 15; i++) {
        const bubble = document.createElement("div");
        const size = Math.random() * 80 + 20;
        bubble.className = "bubble";
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${Math.random() * 100}%`;
        bubble.style.top = `${Math.random() * 100}%`;
        bubble.style.animationDelay = `${Math.random() * 5}s`;
        bubble.style.animationDuration = `${Math.random() * 10 + 15}s`;
        fragment.appendChild(bubble);
      }
      container.appendChild(fragment);
    };

    createBubbles();
    return () => {
      container.innerHTML = "";
    }; // Cleanup
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden -z-10" />
  );
};

export default BubbleBg;
