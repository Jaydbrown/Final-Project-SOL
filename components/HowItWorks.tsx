import React, { useMemo, useRef, useState } from "react";
import { UserPlus, Wallet, Vote, Gift, type LucideIcon } from "lucide-react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const segmentFill = (progress: number, segmentIndex: number, segmentCount: number) => {
  const scaled = progress * segmentCount - segmentIndex;
  return clamp01(scaled);
};

const segmentOpacity = (fill: number) => {
  if (fill < 0.85) return 1;
  return clamp01(1 - (fill - 0.85) / 0.15);
};

const steps: Array<{
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    number: "01",
    icon: UserPlus,
    title: "Create Community DAO",
    description:
      "A founder starts a community DAO and sets location, member limits, and project focus.",
  },
  {
    number: "02",
    icon: Wallet,
    title: "Add Team & Members",
    description:
      "Founders assign admins and finance leads. Members are invited and verified for participation.",
  },
  {
    number: "03",
    icon: Vote,
    title: "List and Vote on Projects",
    description:
      "Admins list proposals. Members vote with transparent on-chain participation and clear outcomes.",
  },
  {
    number: "04",
    icon: Gift,
    title: "Share Returns",
    description:
      "Finance leads deposit returns and members claim earnings according to their support and voting.",
  },
];

const HowItWorks: React.FC<{ onLaunch: () => void }> = ({ onLaunch }) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 70%", "end 35%"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    setScrollProgress(latest);
  });

  const segmentCount = steps.length - 1;
  const activeStep = Math.min(segmentCount, Math.floor(scrollProgress * segmentCount + 0.4));
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const segmentFills = useMemo(
    () => Array.from({ length: segmentCount }, (_, index) => segmentFill(scrollProgress, index, segmentCount)),
    [scrollProgress, segmentCount],
  );

  return (
    <section id="how-it-works" ref={sectionRef} className="py-24 cream-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">
            How It Works
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A simple flow for setting up a community and funding local projects.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-10 lg:gap-12 items-start">
          <div className="relative">
            <motion.div
              style={{ width: progressWidth }}
              className="absolute left-6 top-8 h-[2px] bg-black/20 lg:hidden"
            />
            <div className="space-y-8 lg:space-y-10">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index <= activeStep;
                const fill = index < segmentCount ? segmentFills[index] : 0;

                return (
                  <div key={step.number} className="relative">
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: false, margin: "-20% 0px -20% 0px" }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className={`relative rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${
                        isActive
                          ? "bg-white border-slate-900/40 shadow-lg shadow-slate-900/10"
                          : "bg-white/70 border-slate-200"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`relative w-12 h-12 rounded-xl border flex items-center justify-center transition-colors ${
                            isActive
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-slate-50 text-slate-500 border-slate-200"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <div className="absolute -top-2 -right-2 w-6 h-6 navy-bg rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                            {step.number}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-slate-900">{step.title}</h4>
                          <p className="text-sm text-slate-600 leading-relaxed mt-2">{step.description}</p>
                        </div>
                      </div>
                    </motion.div>

                    {index < segmentCount && (
                      <div className="relative h-10 lg:h-12 flex items-center pl-6">
                        <div className="h-[2px] w-24 sm:w-28 lg:w-32 bg-slate-200" />
                        <motion.div
                          style={{ width: `${fill * 100}%`, opacity: segmentOpacity(fill) }}
                          className="absolute left-6 h-[2px] bg-black"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:sticky lg:top-28">
            <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl shadow-slate-900/10 bg-white">
              <img
                src="https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1200&q=80"
                alt="Children playing together in a community"
                className="w-full h-[280px] sm:h-[340px] lg:h-[460px] object-cover"
                loading="lazy"
              />
              <div className="p-5 border-t border-slate-100">
                <p className="text-sm font-semibold text-slate-900">Community first</p>
                <p className="text-xs text-slate-600 mt-1">
                  LocalDAO helps neighborhoods pool support, vote transparently, and fund real community outcomes.
                </p>
              </div>
            </div>
          </div>
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
