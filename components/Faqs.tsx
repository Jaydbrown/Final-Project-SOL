import React from "react";

const faqs = [
  {
    q: "How does voting power work in LocalDAO?",
    a: "Members signal support by staking USDC on proposals. More support carries more voting weight, and all voting actions are recorded on-chain.",
  },
  {
    q: "Who can create and manage project proposals?",
    a: "Admins can create proposals and set targets, deadlines, and relevant documents. This keeps proposal management structured and transparent.",
  },
  {
    q: "How are returns shared with members?",
    a: "When finance leads deposit returns, members claim based on their recorded support share. The payout flow is auditable and rules-driven.",
  },
  {
    q: "Do I need to connect a wallet to use the app?",
    a: "You can browse public sections without a wallet, but you need a connected wallet to vote, interact with DAO actions, and access full member features.",
  },
];

const Faqs: React.FC = () => {
  return (
    <section id="faqs" className="py-24 lg:py-28 bg-gradient-to-b from-white to-slate-50/40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">FAQs</h2>
          <p className="mt-3 text-slate-600">
            Quick answers to common questions about governance, voting, and returns.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
            >
              <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-start justify-between gap-4">
                <span>{item.q}</span>
                <span className="text-slate-500 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Faqs;
