import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ShieldCheck, Mail, Bell, BellOff, Check, Settings } from 'lucide-react';
import { useWallets } from "@privy-io/react-auth";
import type { ViewState } from '../App';
import { Card, DeadlineChip, FundingProgress, MetricCard, StatusChip } from '../components/UI';
import type { User } from '@privy-io/react-auth';
import { fetchActiveDaos, fetchAllInvestments, fetchDaoUserRole, fetchYieldRows, formatUsdcAmount, statusLabel, type DaoUserRole, type OnchainDao, type OnchainInvestment, type YieldRow } from '../utils/localDaoContracts';
import { formatTxError, notifyError, notifySuccess, notifyWarning } from '../utils/toast';
import { BACKEND_URL } from '../utils/backendUrl';

const subscriberEmailFromUser = (user: User | null | undefined): string | undefined =>
  typeof user?.email?.address === 'string' ? user.email.address.trim() : undefined;

interface DashboardProps {
  onViewChange: (view: ViewState) => void;
  onVote: (id: string) => void;
  user: User | null;
}

// Component for Gmail connection status
const GmailConnectionStatus: React.FC<{ walletAddress: string }> = ({ walletAddress }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      checkConnection();
    }
  }, [walletAddress]);

  const checkConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/preferences/${walletAddress}`);
      const data = await response.json();
      setIsConnected(!!data.gmailConnected);
    } catch (error) {
      console.error("Error checking Gmail connection:", error);
    }
  };

  const connectGmail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/gmail/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress })
      });
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error("Error connecting Gmail:", error);
      notifyError("Failed to connect Gmail");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
          isConnected 
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
            : "bg-slate-100 text-slate-600 border border-slate-200"
        }`}
      >
        <Mail className="w-3.5 h-3.5" />
        {isConnected ? "Gmail Connected" : "Connect Gmail"}
      </button>

      {showDetails && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDetails(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-600" />
                Email Notifications
              </h4>
              <button
                onClick={() => setShowDetails(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {!isConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Connect your Gmail to receive email notifications about:
                </p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  <li>New investment proposals in your DAOs</li>
                  <li>Yield deposits and claim opportunities</li>
                  <li>Vote reminders and updates</li>
                  <li>Chat messages in your communities</li>
                </ul>
                <button
                  onClick={connectGmail}
                  disabled={loading}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? "Connecting..." : "Connect Gmail Account"}
                </button>
                <p className="text-xs text-slate-500 text-center">
                  We'll only send relevant DAO notifications
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-2 rounded-lg">
                  <Check className="w-4 h-4" />
                  <span>Your Gmail is connected</span>
                </div>
                <button
                  onClick={connectGmail}
                  className="w-full py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Reconnect Gmail
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Component for DAO-specific notification settings
const DaoNotificationToggle: React.FC<{
  walletAddress: string;
  daoAddress: string;
  daoName: string;
  subscriberEmail?: string;
}> = ({ walletAddress, daoAddress, daoName, subscriberEmail }) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      checkSubscription();
    }
  }, [walletAddress, daoAddress]);

  const checkSubscription = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/subscriptions/${walletAddress}`);
      const subs = await response.json();
      const daoSub = subs.find((s: any) => s.daoAddress === daoAddress.toLowerCase());
      setIsSubscribed(daoSub?.receiveNotifications || false);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const toggleSubscription = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          daoAddress,
          receiveNotifications: !isSubscribed,
          email: subscriberEmail?.trim() || undefined,
        }),
      });
      
      if (response.ok) {
        setIsSubscribed(!isSubscribed);
        notifySuccess(isSubscribed ? "Notifications disabled for this DAO" : "Email notifications enabled for this DAO!");
      }
    } catch (error) {
      console.error("Error toggling subscription:", error);
      notifyError("Failed to update notification preferences");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleSubscription}
      disabled={loading}
      className={`p-1.5 rounded-lg transition ${
        isSubscribed 
          ? "text-emerald-600 hover:bg-emerald-50" 
          : "text-slate-400 hover:bg-slate-100"
      }`}
      title={isSubscribed ? "Disable email notifications" : "Enable email notifications"}
    >
      {isSubscribed ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
    </button>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ onViewChange, onVote, user }) => {
  const [daos, setDaos] = useState<OnchainDao[]>([]);
  const [investments, setInvestments] = useState<OnchainInvestment[]>([]);
  const [yields, setYields] = useState<YieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rolesByDao, setRolesByDao] = useState<Record<string, DaoUserRole>>({});
  const [daoPage, setDaoPage] = useState(1);
  const [proposalPage, setProposalPage] = useState(1);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const PAGE_SIZE = 5;
  const { wallets } = useWallets();
  const walletAddress = wallets.find((item) => item.type === "ethereum")?.address as `0x${string}` | undefined;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [daoRows, invRows, yieldRows] = await Promise.all([
          fetchActiveDaos(),
          fetchAllInvestments(),
          fetchYieldRows(),
        ]);
        setDaos(daoRows);
        setInvestments(invRows);
        setYields(yieldRows);
        setError('');
      } catch (err) {
        const message = formatTxError(err, 'Failed to load dashboard.');
        setError(message);
        notifyError(message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const loadRoles = async () => {
      if (!walletAddress) {
        setRolesByDao({});
        return;
      }
      try {
        const uniqueDaoAddresses = Array.from(
          new Set(investments.filter((inv) => inv.status === 0).map((inv) => inv.daoAddress.toLowerCase())),
        );
        if (uniqueDaoAddresses.length === 0) {
          setRolesByDao({});
          return;
        }
        const roleRows = await Promise.all(
          uniqueDaoAddresses.map(async (dao) => [dao, await fetchDaoUserRole(dao as `0x${string}`, walletAddress)] as const),
        );
        setRolesByDao(Object.fromEntries(roleRows));
      } catch {
        setRolesByDao({});
      }
    };
    void loadRoles();
  }, [walletAddress, investments]);

  const totals = useMemo(() => {
    const totalTvl = daos.reduce((sum, dao) => sum + dao.tvlRaw, 0n);
    const totalYield = yields.reduce((sum, row) => sum + row.totalYield, 0n);
    const totalDistributed = yields.reduce((sum, row) => sum + row.distributed, 0n);
    const proposed = investments.filter((inv) => inv.status === 0);
    return { totalTvl, totalYield, totalDistributed, proposed };
  }, [daos, investments, yields]);

  const recentActivity = useMemo(() => {
    return [...investments]
      .sort((a, b) => Number(b.createdAt - a.createdAt))
      .slice(0, 6);
  }, [investments]);

  const pagedDaos = useMemo(() => {
    const start = (daoPage - 1) * PAGE_SIZE;
    return daos.slice(start, start + PAGE_SIZE);
  }, [daos, daoPage]);

  const pagedProposals = useMemo(() => {
    const start = (proposalPage - 1) * PAGE_SIZE;
    return totals.proposed.slice(start, start + PAGE_SIZE);
  }, [totals.proposed, proposalPage]);

  const daoPages = Math.max(1, Math.ceil(daos.length / PAGE_SIZE));
  const proposalPages = Math.max(1, Math.ceil(totals.proposed.length / PAGE_SIZE));

  if (loading) return <div className="max-w-7xl mx-auto py-10 text-slate-500">Loading dashboard...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back{user?.email?.address ? `, ${user.email.address.split('@')[0]}` : ''}.</p>
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </div>
        <div className="flex gap-3">
          {walletAddress && (
            <GmailConnectionStatus walletAddress={walletAddress} />
          )}
          <button
            onClick={() => onViewChange('discover')}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <Search className="w-4 h-4" />
            Discover
          </button>
          <button
            onClick={() => onViewChange('kyc')}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            KYC / Admin
          </button>
          <button
            onClick={() => onViewChange('create-dao')}
            className="px-4 py-2 navy-bg text-white rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create DAO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Total TVL" value={formatUsdcAmount(totals.totalTvl)} />
        <MetricCard label="Generated Yield" value={formatUsdcAmount(totals.totalYield)} />
        <MetricCard label="Distributed Yield" value={formatUsdcAmount(totals.totalDistributed)} />
        <MetricCard label="Active DAOs" value={String(daos.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">Active DAOs</h2>
            <p className="text-xs text-slate-500">{daos.length} total</p>
          </div>
          {daos.length === 0 ? (
            <p className="text-slate-500 text-sm">No DAO deployed yet.</p>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto pr-1 space-y-3">
                {pagedDaos.map((dao) => (
                  <div key={dao.address} className="p-4 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{dao.name}</p>
                        <p className="text-xs text-slate-500">{dao.location}</p>
                        <p className="text-xs text-slate-500 mt-1">TVL: {dao.tvlFormatted}</p>
                      </div>
                      {walletAddress && (
                        <DaoNotificationToggle
                          walletAddress={walletAddress}
                          daoAddress={dao.address}
                          daoName={dao.name}
                          subscriberEmail={subscriberEmailFromUser(user)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  onClick={() => setDaoPage((p) => Math.max(1, p - 1))}
                  disabled={daoPage <= 1}
                  className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg disabled:opacity-50"
                >
                  Prev
                </button>
                <p className="text-xs text-slate-500">Page {daoPage} / {daoPages}</p>
                <button
                  onClick={() => setDaoPage((p) => Math.min(daoPages, p + 1))}
                  disabled={daoPage >= daoPages}
                  className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">Proposals Needing Votes</h2>
            <p className="text-xs text-slate-500">{totals.proposed.length} total</p>
          </div>
          {totals.proposed.length === 0 ? (
            <p className="text-slate-500 text-sm">No pending proposals.</p>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto pr-1 space-y-3">
                {pagedProposals.map((proposal) => (
                  (() => {
                    const role = rolesByDao[proposal.daoAddress.toLowerCase()];
                    const canVote = Boolean(walletAddress && role?.isVerifiedMember);
                    return (
                  <div key={`${proposal.daoAddress}-${proposal.id}`} className="p-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{proposal.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">{proposal.daoName}</span>
                        <StatusChip status={statusLabel(proposal.status)} />
                        <DeadlineChip secondsLeft={Number(proposal.deadline) - Math.floor(Date.now() / 1000)} />
                      </div>
                      <div className="mt-2">
                        <FundingProgress raised={proposal.upvotes} target={proposal.fundNeeded} />
                      </div>
                    </div>
                    {canVote ? (
                      <button
                        onClick={() => onVote(`${proposal.daoAddress}:${proposal.id.toString()}`)}
                        className="px-4 py-2 navy-bg text-white text-xs font-bold rounded-lg"
                      >
                        Vote
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">
                        Members only
                      </span>
                    )}
                  </div>
                    );
                  })()
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  onClick={() => setProposalPage((p) => Math.max(1, p - 1))}
                  disabled={proposalPage <= 1}
                  className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg disabled:opacity-50"
                >
                  Prev
                </button>
                <p className="text-xs text-slate-500">Page {proposalPage} / {proposalPages}</p>
                <button
                  onClick={() => setProposalPage((p) => Math.min(proposalPages, p + 1))}
                  disabled={proposalPage >= proposalPages}
                  className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </Card>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent DAO Activity</h2>
          <p className="text-xs text-slate-500">Newest first</p>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-slate-500">No recent actions yet.</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div key={`${item.daoAddress}-${item.id}`} className="p-3 border border-slate-200 rounded-xl">
                <p className="text-sm font-bold text-slate-900">{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">{item.daoName}</span>
                  <StatusChip status={statusLabel(item.status)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Email Notification Info Banner */}
      {walletAddress && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Stay Updated via Email</h3>
              <p className="text-sm text-slate-600 mt-1">
                {daos.some(dao => rolesByDao[dao.address.toLowerCase()]?.isVerifiedMember) 
                  ? "You're a member of one or more DAOs. Connect your Gmail to receive notifications about proposals, votes, and chat messages."
                  : "Join a DAO through KYC verification to start receiving email notifications about investment opportunities."}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onViewChange('kyc')}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50"
                >
                  Complete KYC
                </button>
                <button
                  onClick={() => onViewChange('messages')}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Go to Chat
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowNotificationSettings(!showNotificationSettings)}
              className="p-1.5 hover:bg-white rounded-lg transition"
            >
              <Settings className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;