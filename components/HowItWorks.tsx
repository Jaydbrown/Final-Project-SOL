import React from "react";
import { UserPlus, Wallet, Vote, Gift } from "lucide-react";

const Step = ({
  number,
  icon: Icon,
  title,
  description,
  isLast = false,
}: {
  number: string;
  icon: any;
  title: string;
  description: string;
  isLast?: boolean;
}) => (
  <div className="relative flex flex-col items-center text-center group">
    <div className="w-16 h-16 rounded-full bg-slate-50 border-2 border-slate-200 flex items-center justify-center mb-6 group-hover:border-emerald-500 group-hover:bg-emerald-50 transition-colors z-10 relative">
      <Icon className="w-7 h-7 text-slate-500 group-hover:text-emerald-600" />
      <div className="absolute -top-2 -right-2 w-6 h-6 navy-bg rounded-full text-white text-[10px] flex items-center justify-center font-bold">
        {number}
      </div>
    </div>
    <h4 className="text-lg font-bold text-slate-900 mb-2">{title}</h4>
    <p className="text-sm text-slate-600 leading-relaxed px-4">{description}</p>

    {!isLast && (
      <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-[2px] bg-slate-100 z-0"></div>
    )}
  </div>
);

const HowItWorks: React.FC<{ onLaunch: () => void }> = ({ onLaunch }) => {
  return (
    <section id="how-it-works" className="py-24 cream-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">
            How It Works
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A simple flow for setting up a community and funding local projects.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          <Step
            number="01"
            icon={UserPlus}
            title="Create Community DAO"
            description="A founder creates a community DAO and sets location, member limits, and project details."
          />
          <Step
            number="02"
            icon={Wallet}
            title="Add Team & Members"
            description="Founder adds admins and finance leads. Admins add and verify members before voting."
          />
          <Step
            number="03"
            icon={Vote}
            title="List and Vote on Projects"
            description="Admins list project proposals. Members upvote by staking USDC or downvote once per project."
          />
          <Step
            number="04"
            icon={Gift}
            title="Share Returns"
            description="Finance leads deposit project returns, and members claim earnings based on their support."
          />
        </div>

        <div className="mt-20 text-center">
          <button
            onClick={onLaunch}
            className="navy-bg text-white px-10 py-4 rounded-xl font-bold hover:shadow-xl transition-shadow"
          >
            Get Started Now
          </button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
