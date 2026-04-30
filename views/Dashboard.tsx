import React, { useEffect, useMemo, useState } from 'react';
import { Coins, Plus, Search, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useWallets } from "@privy-io/react-auth";
import type { ViewState } from '../App';
import { Card } from '../components/UI';
import type { User } from '@privy-io/react-auth';
import { fetchActiveDaos, fetchAllInvestments, fetchDaoUserRole, fetchYieldRows, formatUsdcAmount, statusLabel, type DaoUserRole, type OnchainDao, type OnchainInvestment, type YieldRow } from '../utils/localDaoContracts';
import { formatTxError, notifyError } from '../utils/toast';

interface DashboardProps {
  onViewChange: (view: ViewState) => void;
  onVote: (id: string) => void;
  user: User | null;
}

const Dashboard: React.FC<DashboardProps> = ({ onViewChange, onVote, user }) => {
  const [daos, setDaos] = useState<OnchainDao[]>([]);
  const [investments, setInvestments] = useState<OnchainInvestment[]>([]);
  const [yields, setYields] = useState<YieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rolesByDao, setRolesByDao] = useState<Record<string, DaoUserRole>>({});
  const [daoPage, setDaoPage] = useState(1);
  const [proposalPage, setProposalPage] = useState(1);
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
    const proposed = investments.filter((inv) => inv.status === 0);
    return { totalTvl, totalYield, proposed };
  }, [daos, investments, yields]);

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-6">
          <Wallet className="w-5 h-5 text-blue-600 mb-3" />
          <p className="text-slate-500 text-sm">Total TVL</p>
          <h3 className="text-2xl font-bold">{formatUsdcAmount(totals.totalTvl)}</h3>
        </Card>
        <Card className="p-6">
          <Coins className="w-5 h-5 text-emerald-600 mb-3" />
          <p className="text-slate-500 text-sm">Total Yield Generated</p>
          <h3 className="text-2xl font-bold">{formatUsdcAmount(totals.totalYield)}</h3>
        </Card>
        <Card className="p-6">
          <Users className="w-5 h-5 text-purple-600 mb-3" />
          <p className="text-slate-500 text-sm">Active DAOs</p>
          <h3 className="text-2xl font-bold">{daos.length}</h3>
        </Card>
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
                    <p className="font-bold text-slate-900">{dao.name}</p>
                    <p className="text-xs text-slate-500">{dao.location}</p>
                    <p className="text-xs text-slate-500 mt-1">TVL: {dao.tvlFormatted}</p>
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
                      <p className="text-xs text-slate-500">{proposal.daoName} • {statusLabel(proposal.status)}</p>
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
    </div>
  );
};

export default Dashboard;
