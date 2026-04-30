import React from "react";
import { Home, Menu, X } from "lucide-react";

const Navbar: React.FC<{ onLaunch: () => void }> = ({ onLaunch }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setIsOpen(false); // Close mobile menu after clicking
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="navy-bg p-1.5 rounded-lg">
              <Home className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">
              LocalDAO
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              How it works
            </button>
            <button
              onClick={() => scrollToSection("governance")}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Governance
            </button>
            <button
              onClick={() => scrollToSection("properties")}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Properties
            </button>
            <button
              onClick={onLaunch}
              className="navy-bg text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Launch App
            </button>
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-600"
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 py-4 px-4 space-y-4">
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
            onClick={onLaunch}
            className="w-full navy-bg text-white px-5 py-3 rounded-xl text-sm font-semibold"
          >
            Launch App
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
