import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import HowItWorks from "../components/HowItWorks";
import Governance from "../components/Governance";
import Properties from "../components/Properties";
import TrustBadges from "../components/TrustBadges";
import Footer from "../components/Footer";
import { ViewState } from "@/App";
import { copyText } from "../utils/clipboard";
import {
  fetchWaitlist,
  joinWaitlist,
  waitlistConfigIssue,
  waitlistEnabled,
  type WaitlistEntry,
} from "../utils/waitlist";
import { formatTxError, notifyError, notifySuccess, notifyWarning } from "../utils/toast";

interface LandingPageProps {
  onViewChange: (view: ViewState) => void;
  onLogin: () => void;
}


const LandingPage: React.FC<LandingPageProps> = ({ onViewChange, onLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [myReferralCode, setMyReferralCode] = useState('');

  const appBaseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const envBaseUrl = (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.trim();
    if (envBaseUrl) return envBaseUrl.replace(/\/+$/, '');
    const currentUrl = new URL(window.location.href);
    currentUrl.search = '';
    currentUrl.hash = '';
    return `${currentUrl.origin}${currentUrl.pathname}`.replace(/\/+$/, '');
  }, []);

  const referralLink = useMemo(() => {
    if (!myReferralCode || !appBaseUrl) return '';
    return `${appBaseUrl}?ref=${myReferralCode}`;
  }, [appBaseUrl, myReferralCode]);

  const loadWaitlist = async () => {
    if (!waitlistEnabled()) return;
    try {
      setWaitlist(await fetchWaitlist(50));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadWaitlist();
    if (typeof window !== 'undefined') {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref) setReferredBy(ref.toUpperCase());
    }
  }, []);

  const onLaunch = () => {
    onLogin();
    console.log("Launching app");
    setTimeout(() => {
      (
        document.querySelector(
          'input[type="email"]'
        ) as HTMLInputElement
      )?.focus();
    }, 150);
    // onViewChange('dashboard');
  };

  const handleJoinWaitlist = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) {
      notifyWarning('Full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      notifyWarning('Valid email is required.');
      return;
    }
    setLoading(true);
    try {
      const row = await joinWaitlist({
        fullName: fullName.trim(),
        email: email.trim(),
        referredByCode: referredBy.trim() || undefined,
      });
      notifySuccess('You are on the waitlist.');
      setMyReferralCode(row.referral_code);
      setFullName('');
      setEmail('');
      await loadWaitlist();
    } catch (err) {
      notifyError(formatTxError(err, 'Failed to join waitlist.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReferral = async () => {
    if (!referralLink) {
      notifyWarning('No referral link to copy yet.');
      return;
    }
    const ok = await copyText(referralLink);
    if (ok) notifySuccess('Referral link copied.');
    else notifyError('Copy failed. Please copy manually.');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onLaunch={onLaunch} />
      <main className="flex-grow">
        <Hero onLaunch={onLaunch} />
        <TrustBadges />
        <Features />
        <HowItWorks onLaunch={onLaunch} />
        <Governance />
        <Properties />
        <section className="max-w-6xl mx-auto px-4 py-16 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl border border-slate-200 p-6">
              <h3 className="text-2xl font-bold text-slate-900">Join Waiting List</h3>
              <p className="text-slate-500 text-sm mt-1">Basic early-access form for interested users.</p>
              <form className="mt-6 space-y-4" onSubmit={handleJoinWaitlist}>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
                <input
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value.toUpperCase())}
                  placeholder="Referral code (optional)"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 navy-bg text-white rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Join Waitlist'}
                </button>
              </form>
              {referralLink && (
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500">Your referral link</p>
                  <p className="text-xs font-mono text-slate-700 break-all mt-1">{referralLink}</p>
                  <button
                    type="button"
                    onClick={() => { void handleCopyReferral(); }}
                    className="text-xs font-bold text-emerald-600 mt-2"
                  >
                    Copy referral link
                  </button>
                </div>
              )}
              {!waitlistEnabled() && (
                <p className="text-xs text-amber-600 mt-3">
                  Waitlist backend not configured. {waitlistConfigIssue()}
                </p>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6">
              <h3 className="text-2xl font-bold text-slate-900">Waiting List</h3>
              <p className="text-slate-500 text-sm mt-1">Most recent entries.</p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Ref Code</th>
                      <th className="py-2">Referred By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlist.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-slate-500">No entries yet.</td>
                      </tr>
                    ) : (
                      waitlist.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3">{row.full_name}</td>
                          <td className="py-2 pr-3">{row.email}</td>
                          <td className="py-2 pr-3 font-mono">{row.referral_code}</td>
                          <td className="py-2">{row.referred_by_code || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
