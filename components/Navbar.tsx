import React from "react";
import { Home, Menu, X } from "lucide-react";

const Navbar: React.FC<{ onLaunch: () => void; isAuthenticated?: boolean }> = ({
  onLaunch,
  isAuthenticated = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState("how-it-works");
  const launchLabel = isAuthenticated ? "Open App" : "Launch App";
  const sections = React.useMemo(() => ["how-it-works", "governance", "properties", "faqs"], []);
  const navItemClass = (sectionId: string) =>
    `text-sm font-semibold px-3.5 py-2 rounded-xl transition-all ${
      activeSection === sectionId
        ? "bg-slate-900 text-white shadow-sm"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
    }`;

  React.useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    let ticking = false;

    const updateActiveSection = () => {
      const anchorY = window.innerHeight * 0.28;
      let nextActive = sections[0];

      for (const id of sections) {
        const element = document.getElementById(id);
        if (!element) continue;
        const { top } = element.getBoundingClientRect();
        if (top <= anchorY) nextActive = id;
      }

      setActiveSection((current) => (current === nextActive ? current : nextActive));
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setIsOpen(false); // Close mobile menu after clicking
    }
  };

  return (
    <div className="sticky top-4 z-50 px-3 sm:px-5 lg:px-8">
      <nav
        className={`max-w-7xl mx-auto rounded-2xl backdrop-blur-md border transition-all duration-300 ${
          isScrolled
            ? "bg-white/95 border-slate-200 shadow-xl shadow-slate-900/8"
            : "bg-white/88 border-slate-200/90 shadow-md shadow-slate-900/5"
        }`}
      >
        <div
          className={`grid grid-cols-[auto_1fr_auto] items-center transition-all duration-300 px-4 sm:px-7 lg:px-8 ${
            isScrolled ? "h-[3.35rem]" : "h-[4.35rem]"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="navy-bg p-1.5 rounded-lg">
              <Home className="text-white w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">
              LocalDAO
            </span>
          </div>

          <div className="hidden md:flex items-center justify-center gap-2 lg:gap-3">
            <button
              onClick={() => scrollToSection("how-it-works")}
              className={navItemClass("how-it-works")}
            >
              How it works
            </button>
            <button
              onClick={() => scrollToSection("governance")}
              className={navItemClass("governance")}
            >
              Governance
            </button>
            <button
              onClick={() => scrollToSection("properties")}
              className={navItemClass("properties")}
            >
              Properties
            </button>
            <button
              onClick={() => scrollToSection("faqs")}
              className={navItemClass("faqs")}
            >
              FAQs
            </button>
            <a
              href="/whitepaper.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-all"
            >
              Whitepaper
            </a>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onLaunch}
              className="hidden md:inline-flex navy-bg text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-95 transition-all shadow-lg shadow-slate-900/15"
            >
              {launchLabel}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden text-slate-600"
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 py-4 px-4 space-y-4 rounded-b-2xl">
          <button
            onClick={() => scrollToSection("how-it-works")}
            className="block text-slate-600 font-medium w-full text-left"
          >
            How it works
          </button>
          <button
            onClick={() => scrollToSection("governance")}
            className="block text-slate-600 font-medium w-full text-left"
          >
            Governance
          </button>
          <button
            onClick={() => scrollToSection("properties")}
            className="block text-slate-600 font-medium w-full text-left"
          >
            Properties
          </button>
          <button
            onClick={() => scrollToSection("faqs")}
            className="block text-slate-600 font-medium w-full text-left"
          >
            FAQs
          </button>
          <a
            href="/whitepaper.html"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="block text-slate-600 font-medium w-full text-left"
          >
            Whitepaper
          </a>
          <button
            onClick={onLaunch}
            className="w-full navy-bg text-white px-5 py-3 rounded-xl text-sm font-semibold"
          >
            {launchLabel}
          </button>
          </div>
        )}
      </nav>
    </div>
  );
};

export default Navbar;
