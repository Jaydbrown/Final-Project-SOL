import React from "react";
import { Building2, MapPin, DollarSign, Home } from "lucide-react";

const PropertyType = ({
  icon: Icon,
  title,
  description,
  examples,
}: {
  icon: any;
  title: string;
  description: string;
  examples: string[];
}) => (
  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="w-12 h-12 sage-bg rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-200">
      <Icon className="text-white w-6 h-6" />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed mb-4">{description}</p>
    <ul className="space-y-2">
      {examples.map((example, idx) => (
        <li key={idx} className="text-sm text-slate-500 flex items-start gap-2">
          <span className="text-emerald-600 mt-1">•</span>
          <span>{example}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Properties: React.FC = () => {
  return (
    <section id="properties" className="py-24 cream-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">
            Investment Properties
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Your DAO can invest in real estate and local businesses within your neighborhood, 
            generating returns that benefit the entire community.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
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

        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 sage-bg rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <MapPin className="text-white w-8 h-8" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 text-center mb-4">
              Location-Based Investing
            </h3>
            <p className="text-slate-600 leading-relaxed text-center mb-6">
              All investment properties must be located within your DAO's designated zip code or 
              adjacent neighborhoods. This ensures your investments directly benefit your local 
              community and maintain geographic relevance. Property proposals include detailed 
              financial projections, market analysis, and community impact assessments.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-600 mb-2">100%</div>
                <div className="text-sm text-slate-600">Transparent</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-600 mb-2">24/7</div>
                <div className="text-sm text-slate-600">On-Chain Tracking</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-600 mb-2">Auto</div>
                <div className="text-sm text-slate-600">Yield Distribution</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Properties;



