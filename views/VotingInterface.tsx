import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Clock, Info, XCircle } from 'lucide-react';
import { useWallets } from "@privy-io/react-auth";
import {
  fetchDaoUserRole,
  fetchAllInvestments,
  formatUsdcAmount,
  statusLabel,
  voteOnInvestment,
  type DaoUserRole,
  type OnchainInvestment,
  type PrivyEthereumWallet,
} from '../utils/localDaoContracts';
import { maskAddress } from '../utils/address';
import { formatTxError, notifyError, notifySuccess, notifyWarning } from '../utils/toast';
import { getTxExplorerUrl, hasBackupExplorer } from '../utils/explorer';

interface VotingInterfaceProps {
  proposalId: string | null;
  onBack: () => void;
}

const VotingInterface: React.FC<VotingInterfaceProps> = ({ proposalId, onBack }) => {
  const { wallets } = useWallets();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingVoteType, setSubmittingVoteType] = useState<'yes' | 'no' | null>(null);
  const [txHash, setTxHash] = useState('');
  const [allInvestments, setAllInvestments] = useState<OnchainInvestment[]>([]);
  const [daoRole, setDaoRole] = useState<DaoUserRole | null>(null);
  const [voteType, setVoteType] = useState<'yes' | 'no' | null>(null);
  const [upvoteAmount, setUpvoteAmount] = useState('10');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setAllInvestments(await fetchAllInvestments());
      } catch (err) {
        const message = formatTxError(err, 'Failed to load investment for voting.');
        notifyError(message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const investment = useMemo(() => {
    const proposed = allInvestments.filter((item) => item.status === 0);
    const proposalKey = proposalId?.trim() ?? '';

    if (proposalKey.includes(':')) {
      const [daoAddress, idPart] = proposalKey.split(':');
      const wantedId = Number(idPart);
      if (daoAddress && Number.isFinite(wantedId)) {
        const found = allInvestments.find(
          (item) =>
            item.daoAddress.toLowerCase() === daoAddress.toLowerCase() &&
            item.id === wantedId
        );
        if (found) return found;
      }
    }

    const wantedId = proposalKey ? Number(proposalKey) : NaN;
    if (Number.isFinite(wantedId)) {
      const sameId = allInvestments.filter((item) => item.id === wantedId);
      if (sameId.length > 0) {
        // Fallback for old links without DAO context.
        return sameId[0];
      }
    }
    return proposed[0] ?? allInvestments[0] ?? null;
  }, [allInvestments, proposalId]);

  const walletAddress = wallets.find((item) => item.type === "ethereum")?.address as `0x${string}` | undefined;

  useEffect(() => {
    const loadRole = async () => {
      if (!investment || !walletAddress) {
        setDaoRole(null);
        return;
      }
      try {
        setDaoRole(await fetchDaoUserRole(investment.daoAddress, walletAddress));
      } catch {
        setDaoRole(null);
      }
    };
    void loadRole();
  }, [investment?.daoAddress, walletAddress]);

  const voteStats = useMemo(() => {
    if (!investment) return { yesPct: 0, noPct: 0 };
    const total = investment.upvotes + investment.downvotes;
    if (total === 0n) return { yesPct: 0, noPct: 0 };
    const yesPct = Number((investment.upvotes * 100n) / total);
    return { yesPct, noPct: 100 - yesPct };
  }, [investment]);

  const handleVote = async (type: 'yes' | 'no') => {
    if (!investment) return;
    const wallet = wallets.find((item) => item.type === "ethereum");
    if (!wallet) {
      notifyWarning('Connect your wallet first.');
      return;
    }

    setSubmitting(true);
    setSubmittingVoteType(type);
    setTxHash('');
    try {
      const hash = await voteOnInvestment(wallet as unknown as PrivyEthereumWallet, {
        daoAddress: investment.daoAddress,
        investmentId: investment.id,
        voteValue: type === 'yes' ? 1 : 0,
        upvoteAmountUsdc: type === 'yes' ? upvoteAmount : undefined,
      });
      setTxHash(hash);
      setVoteType(type);
      setAllInvestments(await fetchAllInvestments());
      notifySuccess(type === 'yes' ? 'Support vote submitted.' : 'Downvote submitted.');
    } catch (err) {
      const message = formatTxError(err, 'Vote failed.');
      notifyError(message);
    } finally {
      setSubmitting(false);
      setSubmittingVoteType(null);
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto py-8 px-4 text-slate-500">Loading proposal...</div>;
  }

  if (!investment) {
    return <div className="max-w-4xl mx-auto py-8 px-4 text-slate-500">No proposal available for voting.</div>;
  }

  const status = statusLabel(investment.status);
  const secondsLeft = Number(investment.deadline) - Math.floor(Date.now() / 1000);
  const canVote = status === 'Proposed' && secondsLeft > 0;
  const canWalletVote = Boolean(walletAddress && daoRole?.isVerifiedMember);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-bold">Back to Dashboard</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded">
                Proposal #{investment.id}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {status}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">{investment.name}</h1>
            <p className="text-slate-500 text-sm">
              {investment.daoName} ({maskAddress(investment.daoAddress)})
            </p>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Treasury Ask</p>
                <p className="text-lg font-bold text-slate-900">{formatUsdcAmount(investment.fundNeeded)}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Target Yield</p>
                <p className="text-lg font-bold text-emerald-600">{investment.expectedYield.toString()}%</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Funding</p>
                <p className="text-lg font-bold">{formatUsdcAmount(investment.upvotes)}</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-normal">
                Upvotes stake USDC. Downvotes are free and have no profit share.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-6 sticky top-24">
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Time Remaining</p>
              <span className="text-2xl font-bold text-slate-900">
                {secondsLeft > 0 ? `${Math.floor(secondsLeft / 86400)}d` : 'Ended'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-emerald-600">YES ({voteStats.yesPct}%)</span>
                <span className="text-slate-400">NO ({voteStats.noPct}%)</span>
              </div>
              <div className="h-8 w-full bg-slate-100 rounded-xl overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: `${voteStats.yesPct}%` }} />
                <div className="h-full bg-red-400" style={{ width: `${voteStats.noPct}%` }} />
              </div>
            </div>

            {canVote ? (
              <div className="space-y-3">
                {!walletAddress && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                    Connect your wallet to vote.
                  </div>
                )}
                {walletAddress && daoRole && !daoRole.isVerifiedMember && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                    This wallet is not an active verified member of this DAO.
                  </div>
                )}
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Upvote Amount (USDC)</label>
                <input
                  type="number"
                  min="1"
                  value={upvoteAmount}
                  onChange={(e) => setUpvoteAmount(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => void handleVote('yes')}
                    disabled={submitting || !canWalletVote}
                    className="min-w-0 w-full py-3 sm:py-4 px-2 bg-emerald-50 text-emerald-700 rounded-2xl text-sm sm:text-base font-bold hover:bg-emerald-100 transition-colors border-2 border-emerald-100 whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {submittingVoteType === 'yes' ? 'Submitting...' : 'Vote Yes'}
                  </button>
                  <button
                    onClick={() => void handleVote('no')}
                    disabled={submitting || !canWalletVote}
                    className="min-w-0 w-full py-3 sm:py-4 px-2 bg-red-50 text-red-700 rounded-2xl text-sm sm:text-base font-bold hover:bg-red-100 transition-colors border-2 border-red-100 whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {submittingVoteType === 'no' ? 'Submitting...' : 'Vote No'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 text-slate-600 text-sm text-center">
                Voting is closed for this proposal.
              </div>
            )}

            {voteType && (
              <div className={`p-4 rounded-xl text-center font-bold ${voteType === 'yes' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                You voted {voteType.toUpperCase()}.
              </div>
            )}
            {txHash && (
              <div className="text-center space-x-3">
                <a
                  href={getTxExplorerUrl(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-bold text-blue-600 hover:underline"
                >
                  View transaction on Explorer
                </a>
                {hasBackupExplorer() && (
                  <a
                    href={getTxExplorerUrl(txHash, 1)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-bold text-slate-500 hover:underline"
                  >
                    Backup Explorer
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="p-6 border border-slate-100 rounded-3xl flex items-center gap-4 bg-white">
            {canVote ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <XCircle className="w-6 h-6 text-slate-400" />}
            <div>
              <h4 className="text-sm font-bold text-slate-900">On-chain voting</h4>
              <p className="text-xs text-slate-500">Votes require wallet signature and gas on Fuji.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VotingInterface;
