import React from "react";
import { Vote, Users, Clock, TrendingUp } from "lucide-react";

const GovernanceFeature = ({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) => (
  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="w-12 h-12 sage-bg rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-200">
      <Icon className="text-white w-6 h-6" />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

const Governance: React.FC = () => {
  return (
    <section id="governance" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">
            Community Governance
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Clear roles and transparent voting help communities decide what to fund and how to manage returns.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <GovernanceFeature
            icon={Vote}
            title="USDC Voting Power"
            description="Support votes are backed by staked USDC. More support means stronger voting weight."
          />
          <GovernanceFeature
            icon={Users}
            title="Proposal System"
            description="Admins create project proposals with funding targets, deadlines, and supporting documents."
          />
          <GovernanceFeature
            icon={Clock}
            title="Transparent Timelines"
            description="Each project has clear dates, status changes, and activity logs that everyone can review."
          />
          <GovernanceFeature
            icon={TrendingUp}
            title="Collective Returns"
            description="Project returns are distributed to supporters based on their share of staked support."
          />
        </div>

        <div className="mt-16 bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">
              How Decisions Are Made
            </h3>
            <p className="text-slate-600 leading-relaxed mb-6">
              Founder and admin roles manage setup, member access, and proposal listing.
              Members then vote by staking USDC support, while finance leads deposit project
              returns for distribution. Every step is recorded and visible to the community.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                Role-based permissions
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                Full activity timeline
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                Transparent return sharing
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Governance;


