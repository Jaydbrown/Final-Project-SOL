import React from "react";
import { motion } from "framer-motion";

const chipTextClass =
  "text-base sm:text-lg font-semibold tracking-tight leading-none text-slate-900 [font-family:Georgia,'Times_New_Roman',serif]";
const chipClass =
  "inline-flex items-center px-4 py-2.5 rounded-xl bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.06)]";
const branchChipClass =
  "inline-flex items-center px-2.5 py-1.5 rounded-lg bg-white/95 border border-slate-200 shadow-[0_4px_12px_rgba(15,23,42,0.05)]";

const BranchTree = ({ labels }: { labels: readonly string[] }) => (
  <motion.div
    className="mt-4 ml-3"
    initial={{ opacity: 0, y: 6 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.6 }}
    transition={{ duration: 0.35, delay: 0.12 }}
  >
    <div className="relative pl-7">
      <motion.div
        className="absolute left-0 top-0 w-[2px] h-4 bg-slate-700 rounded-full"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, amount: 0.7 }}
        transition={{ duration: 0.25 }}
        style={{ transformOrigin: "top" }}
      />
      <motion.div
        className="absolute left-0 top-4 bottom-2 w-[2px] bg-slate-700 rounded-full"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, amount: 0.7 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        style={{ transformOrigin: "top" }}
      />
      <div className="space-y-2.5 sm:space-y-3">
        {labels.map((label, index) => (
          <motion.div
            key={label}
            className="relative flex items-center min-h-7"
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.7 }}
            transition={{ duration: 0.22, delay: 0.14 + index * 0.07 }}
          >
            <motion.div
              className="absolute -left-7 top-1/2 -translate-y-1/2 w-7 h-[2px] bg-slate-700 rounded-full"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.7 }}
              transition={{ duration: 0.2, delay: 0.1 + index * 0.06 }}
              style={{ transformOrigin: "left" }}
            />
            <span className={`${branchChipClass} relative -ml-[1px] text-xs sm:text-sm font-medium tracking-tight text-slate-700`}>
              {label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  </motion.div>
);

const StepCard = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className: string;
  delay?: number;
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.42 }}
    transition={{ duration: 0.45, ease: "easeOut", delay }}
  >
    {children}
  </motion.div>
);

const staircase = [
  { title: "more support = more weight", offsetClass: "lg:ml-[0%]" },
  {
    title: "admins create",
    offsetClass: "lg:ml-[24%]",
    branches: ["projects", "deadlines", "documents", "targets"],
  },
  {
    title: "members vote support",
    offsetClass: "lg:ml-[49%]",
    branches: ["upvotes", "USDC stake", "activity logs", "status updates"],
  },
  { title: "everyone shares returns", offsetClass: "lg:ml-[72%]" },
] as const;

const Governance: React.FC = () => {
  return (
    <section id="governance" className="py-28 lg:py-32 bg-gradient-to-b from-white to-slate-50/30">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="hidden lg:block absolute top-6 right-1 w-72 h-72 rounded-3xl overflow-hidden shadow-xl shadow-slate-900/15 rotate-[7deg]">
          <img
            src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80"
            alt="Community members collaborating in discussion"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="hidden lg:block absolute bottom-6 left-0 w-[17rem] h-[17rem] rounded-3xl overflow-hidden shadow-xl shadow-slate-900/15 -rotate-[8deg]">
          <img
            src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800&q=80"
            alt="Community planning and governance meeting"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="text-center mb-20">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">
            Community Governance
          </h2>
          <p className="text-slate-500 text-base sm:text-lg">
            A visual flow from support to outcomes.
          </p>
        </div>

        <div className="relative w-full mx-auto space-y-12 sm:space-y-14 lg:space-y-16">
          {staircase.map((step, index) => (
            <StepCard
              key={step.title}
              className={`flex justify-start ${step.offsetClass}`}
              delay={index * 0.04}
            >
              <div className="relative">
                <div className={chipClass}>
                  <span className={chipTextClass}>{step.title}</span>
                </div>
                {"branches" in step ? <BranchTree labels={step.branches} /> : null}
              </div>
            </StepCard>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Governance;


