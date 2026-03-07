import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import BubbleBg from "/src/components/BubbleBg";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Projects from "./sections/Projects";
import Contact from "./sections/Contact";

function App() {
  const [activePage, setActivePage] = useState("home");

  const renderContent = () => {
    switch (activePage) {
      case "home":
        return <Hero onNavigate={setActivePage} />;
      case "about":
        return <About />;
      case "projects":
        return <Projects />;
      case "contact":
        return <Contact />;
      default:
        return <Hero onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="flex min-h-screen">
      <BubbleBg />
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 h-screen pt-20 overflow-y-auto md:ml-64 custom-scrollbar md:pt-0">
        <div className="flex flex-col justify-center min-h-full p-6 md:p-12">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
