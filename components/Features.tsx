
import React from 'react';
import { ShieldCheck, Users, TrendingUp } from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="w-12 h-12 sage-bg rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-200">
      <Icon className="text-white w-6 h-6" />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

const Features: React.FC = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">
            Built for Real Communities
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Organize local projects, manage roles, and track all funding activity in one place.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={ShieldCheck}
            title="Role-Based Access"
            description="Founders, admins, finance leads, and members each have clear permissions for safe day-to-day operations."
          />
          <FeatureCard 
            icon={Users}
            title="Community Voting"
            description="Members can vote on local proposals by staking USDC support or casting a downvote."
          />
          <FeatureCard 
            icon={TrendingUp}
            title="Transparent Returns"
            description="When a project earns money, finance leads deposit returns and members claim their share based on participation."
          />
        </div>
      </div>
    </section>
  );
};

export default Features;
