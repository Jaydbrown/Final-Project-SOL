import React from "react";
import { Building2, MapPin, DollarSign, Home } from "lucide-react";

const PropertyType = ({
  icon: Icon,
  title,
  description,
  examples,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  examples: string[];
}) => (
  <article className="bg-white/85 p-7 rounded-3xl border border-slate-200/80 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
    <div className="w-11 h-11 sage-bg rounded-xl flex items-center justify-center mb-4">
      <Icon className="text-white w-6 h-6" />
    </div>
    <h3 className="text-xl font-semibold tracking-tight text-slate-900 mb-2 [font-family:Georgia,'Times_New_Roman',serif]">
      {title}
    </h3>
    <p className="text-slate-600 leading-relaxed mb-4">{description}</p>
    <ul className="space-y-1.5">
      {examples.map((example, idx) => (
        <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
          <span className="text-emerald-600 mt-1">•</span>
          <span>{example}</span>
        </li>
      ))}
    </ul>
  </article>
);

const Properties: React.FC = () => {
  return (
    <section id="properties" className="py-24 lg:py-28 bg-gradient-to-b from-[#FDFBF7] to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 lg:mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">
            Investment Properties
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Community DAOs fund neighborhood assets with transparent on-chain governance and
            shared returns for members.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-7 mb-14">
          <PropertyType
            icon={Building2}
            title="Residential Real Estate"
            description="Acquire rental properties, multi-family units, and residential developments in your zip code."
            examples={[
              "Single-family rental homes",
              "Multi-unit apartment buildings",
              "Condominium developments",
              "Student housing near universities"
            ]}
          />
          <PropertyType
            icon={Home}
            title="Commercial Properties"
            description="Invest in commercial real estate that serves your local community and generates steady income."
            examples={[
              "Retail storefronts",
              "Office buildings",
              "Mixed-use developments",
              "Warehouse and storage facilities"
            ]}
          />
          <PropertyType
            icon={DollarSign}
            title="Local Business Loans"
            description="Provide capital to neighborhood businesses and earn returns through structured loan agreements."
            examples={[
              "Restaurant expansions",
              "Local retail startups",
              "Service business growth",
              "Community-focused enterprises"
            ]}
          />
          <PropertyType
            icon={MapPin}
            title="Development Projects"
            description="Participate in larger development initiatives that transform and improve your neighborhood."
            examples={[
              "Affordable housing projects",
              "Community centers",
              "Green space development",
              "Infrastructure improvements"
            ]}
          />
        </div>

        <div className="bg-white/90 rounded-3xl p-8 md:p-10 border border-slate-200/90 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900 [font-family:Georgia,'Times_New_Roman',serif] mb-3">
            Location-Based Investing
          </h3>
          <p className="text-slate-600 leading-relaxed max-w-4xl">
            Proposals stay locally relevant by targeting each DAO&apos;s designated zip code and nearby communities.
            Every property proposal includes clear assumptions, timeline checkpoints, and expected community impact.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Properties;



