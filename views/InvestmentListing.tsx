import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Clock, MapPin, Search, X } from 'lucide-react';
import { useWallets } from "@privy-io/react-auth";
import {
  createInvestmentOnDao,
  extendInvestmentDeadline,
  fetchActiveDaos,
  fetchDaoUserRole,
  fetchAllInvestments,
  formatUsdcAmount,
  statusLabel,
  type DaoUserRole,
  type OnchainDao,
  type OnchainInvestment,
  type PrivyEthereumWallet,
} from '../utils/localDaoContracts';
import { maskAddress } from '../utils/address';
import { buildDaoImageDataUri } from '../utils/daoImage';
import { formatTxError, notifyError, notifySuccess, notifyWarning } from '../utils/toast';
import { DeadlineChip, FundingProgress, StatusChip } from '../components/UI';

const InvestmentListing: React.FC<{ onVote: (id: string) => void }> = ({ onVote }) => {
  const [filter, setFilter] = useState('All');
  const [selectedInvestment, setSelectedInvestment] = useState<OnchainInvestment | null>(null);
  const [investments, setInvestments] = useState<OnchainInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rolesByDao, setRolesByDao] = useState<Record<string, DaoUserRole>>({});
  const [managedDaos, setManagedDaos] = useState<OnchainDao[]>([]);
  const [extendModal, setExtendModal] = useState<OnchainInvestment | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDaoAddress, setCreateDaoAddress] = useState('');
  const [proposalName, setProposalName] = useState('');
  const [proposalCategory, setProposalCategory] = useState('0');
  const [proposalFundNeeded, setProposalFundNeeded] = useState('1000');
  const [proposalExpectedYield, setProposalExpectedYield] = useState('10');
  const [proposalGrade, setProposalGrade] = useState('0');
  const [proposalDeadlineDays, setProposalDeadlineDays] = useState('14');
  const [extendDays, setExtendDays] = useState('7');
  const [busy, setBusy] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);
  const { wallets } = useWallets();
  const wallet = wallets.find((item) => item.type === "ethereum");
  const walletAddress = wallet?.address as `0x${string}` | undefined;
  const modalRoot = typeof document !== 'undefined' ? document.body : null;

  const loadInvestments = async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, daoRows] = await Promise.all([fetchAllInvestments(), fetchActiveDaos()]);
      setInvestments(rows);

      if (walletAddress) {
        const uniqueDaos = Array.from(new Set(daoRows.map((dao) => dao.address.toLowerCase())));
        const roles = await Promise.all(
          uniqueDaos.map(async (dao) => [dao, await fetchDaoUserRole(dao as `0x${string}`, walletAddress)] as const)
        );
        const roleMap = Object.fromEntries(roles);
        setRolesByDao(roleMap);
        const canCreateInDaos = daoRows.filter((dao) => {
          const role = roleMap[dao.address.toLowerCase()];
          return Boolean(role?.isCreator || role?.isAdmin);
        });
        setManagedDaos(canCreateInDaos);
        setCreateDaoAddress((current) => current || canCreateInDaos[0]?.address || '');
      } else {
        setRolesByDao({});
        setManagedDaos([]);
        setCreateDaoAddress('');
      }
    } catch (err) {
      const message = formatTxError(err, 'Failed to load projects.');
      setError(message);
      notifyError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvestments();
  }, [walletAddress]);

  const canManageFinance = (daoAddress: string) => {
    const role = rolesByDao[daoAddress.toLowerCase()];
    if (!role) return false;
    return role.isCreator || role.isAdmin || role.isFinanceManager;
  };

  const handleExtendDeadline = async () => {
    if (!extendModal) return;
    if (!wallet) {
      notifyWarning('Connect wallet first.');
      return;
    }
    const days = Number(extendDays);
    if (!Number.isFinite(days) || days < 1 || days > 90) {
      notifyWarning('Extension must be between 1 and 90 days.');
      return;
    }

    setBusy(`extend-${extendModal.daoAddress}-${extendModal.id}`);
    setError('');
    try {
      await extendInvestmentDeadline(wallet as unknown as PrivyEthereumWallet, {
        daoAddress: extendModal.daoAddress,
        investmentId: extendModal.id,
        additionalDays: days,
      });
      setExtendModal(null);
      setExtendDays('7');
      notifySuccess('Deadline extended successfully.');
      await loadInvestments();
    } catch (err) {
      const message = formatTxError(err, 'Failed to extend deadline.');
      setError(message);
      notifyError(message);
    } finally {
      setBusy('');
    }
  };

  const handleCreateProposal = async () => {
    if (!wallet) {
      notifyWarning('Connect wallet first.');
      return;
    }
    if (!createDaoAddress) {
      notifyWarning('Select a community.');
      return;
    }
    setBusy('create-proposal');
    setError('');
    try {
      await createInvestmentOnDao(wallet as unknown as PrivyEthereumWallet, {
        daoAddress: createDaoAddress as `0x${string}`,
        name: proposalName,
        category: Number(proposalCategory),
        fundNeededUsdc: proposalFundNeeded,
        expectedYieldPct: Number(proposalExpectedYield),
        grade: Number(proposalGrade),
        deadlineDays: Number(proposalDeadlineDays),
        documentCids: [],
      });
      setCreateModalOpen(false);
      setProposalName('');
      notifySuccess('Proposal created successfully.');
      await loadInvestments();
    } catch (err) {
      const message = formatTxError(err, 'Failed to create proposal.');
      setError(message);
      notifyError(message);
    } finally {
      setBusy('');
    }
  };

  const filtered = useMemo(() => {
    return investments.filter((investment) => {
      const label = statusLabel(investment.status);
      return filter === 'All' || label === filter;
    });
  }, [filter, investments]);

  useEffect(() => {
    setVisibleCount(6);
  }, [filter, investments.length]);

  if (loading) {
    return <div className="max-w-7xl mx-auto py-12 text-slate-500">Loading on-chain investments...</div>;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-12">
        <h2 className="text-xl font-bold text-slate-900">Could not load investments</h2>
        <p className="text-slate-500 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Investment Opportunities</h1>
          <p className="text-slate-500 mt-2">Browse and vote on local neighborhood assets.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (!walletAddress) {
                notifyWarning('Connect wallet first.');
                return;
              }
              if (managedDaos.length === 0) {
                notifyWarning('No community found where this wallet is founder/admin.');
                return;
              }
              setCreateModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white"
          >
            Create Proposal
          </button>
          {['All', 'Proposed', 'Active', 'Incomplete', 'Completed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                filter === f ? 'navy-bg text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900">No investments found</h3>
          <p className="text-slate-500 mt-2">No matching proposals on-chain yet.</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.slice(0, visibleCount).map(inv => {
            const status = statusLabel(inv.status);
            const secondsLeft = Number(inv.deadline) - Math.floor(Date.now() / 1000);
            const role = rolesByDao[inv.daoAddress.toLowerCase()];
            const canVoteThisDao = Boolean(walletAddress && role?.isVerifiedMember && status === 'Proposed');

            return (
              <div
                key={`${inv.daoAddress}-${inv.id}`}
                className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-xl hover:border-emerald-200 transition-all group flex flex-col"
              >
                <div className="h-44 relative overflow-hidden bg-slate-100">
                  <img
                    src={buildDaoImageDataUri(inv.name, `${inv.daoAddress}-${inv.id.toString()}`)}
                    alt={inv.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 right-4">
                    <StatusChip status={status} className="shadow-sm" />
                  </div>
                </div>
                <div className="p-6 flex-grow flex flex-col">
                  <div className="flex gap-2 items-center mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                      {inv.daoName}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-600 transition-colors mb-2">{inv.name}</h3>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                    Target yield {inv.expectedYield.toString()}% with funding goal {formatUsdcAmount(inv.fundNeeded)}.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-50">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Raised</p>
                      <p className="text-sm font-bold text-slate-900">{formatUsdcAmount(inv.upvotes)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Yield</p>
                      <p className="text-sm font-bold text-emerald-600">{inv.expectedYield.toString()}% APY</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <FundingProgress raised={inv.upvotes} target={inv.fundNeeded} />
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <DeadlineChip secondsLeft={secondsLeft} />
                    </div>
                  </div>

                  <div className="mt-auto flex gap-3">
                    <button
                      onClick={() => setSelectedInvestment(inv)}
                      className="flex-grow py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      Details
                    </button>
                    {status === 'Proposed' && (
                      <button
                        onClick={() => onVote(`${inv.daoAddress}:${inv.id.toString()}`)}
                        disabled={!canVoteThisDao}
                        className="flex-grow py-3 navy-bg text-white rounded-xl text-xs font-bold hover:shadow-lg transition-shadow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!walletAddress ? 'Connect wallet first' : !role?.isVerifiedMember ? 'Only verified members can vote' : undefined}
                      >
                        Join
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                    {status === 'Proposed' && (
                      <button
                        onClick={() => {
                          if (!canManageFinance(inv.daoAddress)) {
                            notifyWarning('Only founder/admin/finance lead can extend deadlines.');
                            return;
                          }
                          setExtendModal(inv);
                        }}
                        className="flex-grow py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                      >
                        Extend
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {visibleCount < filtered.length && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setVisibleCount((count) => count + 6)}
              className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Load More ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
        </>
      )}

      {selectedInvestment && modalRoot && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedInvestment(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl p-8">
            <button
              onClick={() => setSelectedInvestment(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedInvestment.name}</h2>
            <p className="text-slate-500 mb-6">{selectedInvestment.daoName}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-slate-400 text-xs uppercase">Investment ID</p>
                <p className="font-bold">{selectedInvestment.id}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-slate-400 text-xs uppercase">Status</p>
                <p className="font-bold">{statusLabel(selectedInvestment.status)}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-slate-400 text-xs uppercase">Goal</p>
                <p className="font-bold">{formatUsdcAmount(selectedInvestment.fundNeeded)}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-slate-400 text-xs uppercase">Current Upvotes</p>
                <p className="font-bold">{formatUsdcAmount(selectedInvestment.upvotes)}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="w-3 h-3" /> DAO contract: {maskAddress(selectedInvestment.daoAddress)}
            </div>
          </div>
        </div>
      , modalRoot)}

      {extendModal && modalRoot && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setExtendModal(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Extend Deadline</h3>
            <p className="text-sm text-slate-500">{extendModal.name}</p>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Additional Days (1-90)</label>
              <input
                type="number"
                min="1"
                max="90"
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setExtendModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleExtendDeadline()}
                disabled={busy.length > 0}
                className="px-4 py-2 rounded-lg navy-bg text-white text-sm font-bold disabled:opacity-50"
              >
                {busy.startsWith('extend-') ? 'Submitting...' : 'Extend'}
              </button>
            </div>
          </div>
        </div>
      , modalRoot)}

      {createModalOpen && modalRoot && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCreateModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create Investment Proposal (On-chain)</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">DAO</label>
              <select
                value={createDaoAddress}
                onChange={(e) => setCreateDaoAddress(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              >
                {managedDaos.map((dao) => (
                  <option key={dao.address} value={dao.address}>
                    {dao.name} ({dao.location})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Proposal Name</label>
              <input
                type="text"
                value={proposalName}
                onChange={(e) => setProposalName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Category (0-7)</label>
                <input
                  type="number"
                  value={proposalCategory}
                  onChange={(e) => setProposalCategory(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Grade (0-3)</label>
                <input
                  type="number"
                  value={proposalGrade}
                  onChange={(e) => setProposalGrade(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Fund Needed (USDC)</label>
                <input
                  type="number"
                  value={proposalFundNeeded}
                  onChange={(e) => setProposalFundNeeded(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Expected Yield (%)</label>
                <input
                  type="number"
                  value={proposalExpectedYield}
                  onChange={(e) => setProposalExpectedYield(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Deadline (Days)</label>
              <input
                type="number"
                value={proposalDeadlineDays}
                onChange={(e) => setProposalDeadlineDays(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateProposal()}
                disabled={busy.length > 0}
                className="px-4 py-2 rounded-lg navy-bg text-white text-sm font-bold disabled:opacity-50"
              >
                {busy === 'create-proposal' ? 'Submitting...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      , modalRoot)}
    </div>
  );
};

export default InvestmentListing;
