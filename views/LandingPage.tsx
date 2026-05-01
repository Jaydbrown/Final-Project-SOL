import React from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import HowItWorks from "../components/HowItWorks";
import Governance from "../components/Governance";
import Properties from "../components/Properties";
import TrustBadges from "../components/TrustBadges";
import Faqs from "../components/Faqs";
import Footer from "../components/Footer";
import { ViewState } from "@/App";

interface LandingPageProps {
  onViewChange: (view: ViewState) => void;
  onLogin: () => void;
  isAuthenticated?: boolean;
}


const LandingPage: React.FC<LandingPageProps> = ({
  onViewChange,
  onLogin,
  isAuthenticated = false,
}) => {
  const onLaunch = () => {
    if (isAuthenticated) {
      onViewChange('dashboard');
      return;
    }
    onLogin();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onLaunch={onLaunch} isAuthenticated={isAuthenticated} />
      <main className="flex-grow space-y-8 lg:space-y-12">
        <Hero onLaunch={onLaunch} isAuthenticated={isAuthenticated} />
        <TrustBadges />
        <Features />
        <HowItWorks onLaunch={onLaunch} />
        <Governance />
        <Properties />
        <Faqs />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
