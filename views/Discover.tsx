
import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, MapPin, Users, TrendingUp, Info, ChevronRight, CheckCircle, Star, Copy, ExternalLink, X } from 'lucide-react';
import { useWallets } from "@privy-io/react-auth";
import {
  createInvestmentOnDao,
  fetchActiveDaos,
  fetchAllInvestments,
  fetchDaoParticipants,
  fetchDaoUserRole,
  fetchParticipantUpvotes,
  formatUsdcAmount,
  statusLabel,
  voteOnInvestment,
  type DaoParticipant,
  type DaoUserRole,
  type OnchainDao,
  type OnchainInvestment,
  type PrivyEthereumWallet
} from '../utils/localDaoContracts';
import { copyText } from '../utils/clipboard';
import { maskAddress } from '../utils/address';
import { buildDaoImageDataUri } from '../utils/daoImage';
import { formatTxError, notifyError, notifySuccess, notifyWarning } from '../utils/toast';
import { getAddressExplorerUrl, getTxExplorerUrl, hasBackupExplorer } from '../utils/explorer';

type DiscoverDao = {
  address: string;
  name: string;
  location: string;
  description: string;
  tvl: string;
  members: number;
  type: string;
  verified: boolean;
  isNew: boolean;
  tags: string[];
  img: string;
};

const DAOBrowseCard = ({ dao, onViewDetails }: { dao: DiscoverDao; onViewDetails: (dao: DiscoverDao) => void }) => (
  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-emerald-200 hover:shadow-xl transition-all group flex flex-col">
    <div className="h-32 bg-slate-200 relative overflow-hidden">
      <img src={dao.img} alt={dao.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
      <div className="absolute top-3 left-3 flex gap-2">
        {dao.isNew && <span className="bg-blue-600 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">New</span>}
        {dao.verified && <span className="bg-emerald-600 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> Verified</span>}
      </div>
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
        <MapPin className="w-3 h-3 text-emerald-600" />
        <span className="text-[10px] font-bold text-slate-800">{dao.location}</span>
      </div>
    </div>
    
    <div className="p-5 flex-grow flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{dao.name}</h3>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">{dao.type}</span>
      </div>
      
      <p className="text-xs text-slate-500 line-clamp-2 mb-6 leading-relaxed">{dao.description}</p>
      
      <div className="grid grid-cols-2 gap-4 mt-auto mb-6">
        <div className="space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Treasury</p>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <p className="text-sm font-bold text-slate-900">{dao.tvl}</p>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Members</p>
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">{dao.members}</p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-6">
        {dao.tags.map((tag: string) => (
          <span key={tag} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{tag}</span>
        ))}
      </div>

      <button
        onClick={() => onViewDetails(dao)}
        className="w-full py-3 navy-bg text-white rounded-xl text-xs font-bold hover:shadow-lg transition-shadow flex items-center justify-center gap-2"
      >
        Open
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const Discover: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [onchainDaos, setOnchainDaos] = useState<OnchainDao[]>([]);
  const [selectedDao, setSelectedDao] = useState<DiscoverDao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [daoRole, setDaoRole] = useState<DaoUserRole | null>(null);
  const [daoInvestments, setDaoInvestments] = useState<OnchainInvestment[]>([]);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState('');
  const [participants, setParticipants] = useState<DaoParticipant[]>([]);
  const [participantAddress, setParticipantAddress] = useState('');
  const [participantUpvotes, setParticipantUpvotes] = useState<Record<string, bigint>>({});
  const [upvoteAmount, setUpvoteAmount] = useState('10');
  const [proposalName, setProposalName] = useState('');
  const [proposalCategory, setProposalCategory] = useState('0');
  const [proposalFundNeeded, setProposalFundNeeded] = useState('1000');
  const [proposalExpectedYield, setProposalExpectedYield] = useState('10');
  const [proposalGrade, setProposalGrade] = useState('0');
  const [proposalDeadlineDays, setProposalDeadlineDays] = useState('14');
  const [busyAction, setBusyAction] = useState('');
  const [lastTxHash, setLastTxHash] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);
  const { wallets } = useWallets();
  const wallet = wallets.find((item) => item.type === "ethereum");
  const walletAddress = wallet?.address as `0x${string}` | undefined;

  useEffect(() => {
    const loadDaos = async () => {
      setLoading(true);
      setError('');
      try {
        const daos = await fetchActiveDaos();
        setOnchainDaos(daos);
      } catch (err) {
        const message = formatTxError(err, 'Failed to load communities.');
        setError(message);
        notifyError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadDaos();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedQuery = sessionStorage.getItem('localdao_search_query');
    if (savedQuery) {
      setSearchTerm(savedQuery);
      sessionStorage.removeItem('localdao_search_query');
    }
  }, []);

  const daos = useMemo(() => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return onchainDaos.map((dao) => ({
      address: dao.address,
      name: dao.name,
      location: dao.location,
      description: dao.description || 'No description provided on-chain yet.',
      tvl: dao.tvlFormatted,
      members: dao.memberCount,
      type: "Open",
      verified: dao.isActive,
      isNew: nowSeconds - Number(dao.createdAt) < 60 * 60 * 24 * 7,
      tags: ["On-chain", "Avalanche Fuji"],
      img: buildDaoImageDataUri(dao.name, dao.address),
    }));
  }, [onchainDaos]);

  const filteredDAOs = daos.filter(dao => 
    dao.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    dao.location.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const visibleDaos = filteredDAOs.slice(0, visibleCount);

  const selectedInvestment = useMemo(
    () => daoInvestments.find((inv) => inv.id.toString() === selectedInvestmentId) ?? null,
    [daoInvestments, selectedInvestmentId]
  );
  const canVoteSelectedInvestment = Boolean(
    walletAddress &&
    daoRole?.isVerifiedMember &&
    selectedInvestment &&
    selectedInvestment.status === 0
  );

  const loadSelectedDaoData = async (daoAddress: `0x${string}`) => {
    const [allInvestments, allParticipants] = await Promise.all([
      fetchAllInvestments(),
      fetchDaoParticipants(daoAddress),
    ]);
    const investments = allInvestments.filter((inv) => inv.daoAddress.toLowerCase() === daoAddress.toLowerCase());
    setDaoInvestments(investments);
    const defaultInvestment = investments.find((inv) => inv.status === 0) ?? investments[0] ?? null;
    setSelectedInvestmentId(defaultInvestment ? String(defaultInvestment.id) : '');

    setParticipants(allParticipants);
    const defaultParticipant = allParticipants[0]?.address ?? '';
    setParticipantAddress(defaultParticipant);

    if (walletAddress) {
      setDaoRole(await fetchDaoUserRole(daoAddress, walletAddress));
    } else {
      setDaoRole(null);
    }

    if (defaultInvestment && allParticipants.length > 0) {
      const upvotes = await fetchParticipantUpvotes(
        daoAddress,
        defaultInvestment.id,
        allParticipants.map((p) => p.address)
      );
      setParticipantUpvotes(upvotes);
    } else {
      setParticipantUpvotes({});
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!selectedDao) return;
      try {
        await loadSelectedDaoData(selectedDao.address as `0x${string}`);
      } catch (err) {
        const message = formatTxError(err, 'Failed to load community details.');
        notifyError(message);
      }
    };
    void load();
  }, [selectedDao?.address, walletAddress]);

  useEffect(() => {
    const refreshUpvotes = async () => {
      if (!selectedDao || !selectedInvestmentId || participants.length === 0) return;
      try {
        const upvotes = await fetchParticipantUpvotes(
          selectedDao.address as `0x${string}`,
          Number(selectedInvestmentId),
          participants.map((p) => p.address)
        );
        setParticipantUpvotes(upvotes);
      } catch {
        setParticipantUpvotes({});
      }
    };
    void refreshUpvotes();
  }, [selectedInvestmentId, participants, selectedDao?.address]);

  const handleVoteFromCard = async (voteValue: 0 | 1) => {
    if (!wallet || !selectedDao || !selectedInvestment) {
      notifyWarning('Connect wallet and select a project first.');
      return;
    }
    if (!daoRole?.isVerifiedMember) {
      notifyWarning('This wallet is not an active verified member of this DAO.');
      return;
    }
    if (selectedInvestment.status !== 0) {
      notifyWarning('Voting is only available for proposed projects.');
      return;
    }
    setBusyAction(`vote-${voteValue}`);
    setLastTxHash('');
    try {
      const hash = await voteOnInvestment(wallet as unknown as PrivyEthereumWallet, {
        daoAddress: selectedDao.address as `0x${string}`,
        investmentId: selectedInvestment.id,
        voteValue,
        upvoteAmountUsdc: voteValue === 1 ? upvoteAmount : undefined,
      });
      setLastTxHash(hash);
      notifySuccess(voteValue === 1 ? 'Upvote submitted.' : 'Downvote submitted.');
      await loadSelectedDaoData(selectedDao.address as `0x${string}`);
    } catch (err) {
      const message = formatTxError(err, 'Vote failed.');
      notifyError(message);
    } finally {
      setBusyAction('');
    }
  };

  const handleCreateProposal = async () => {
    if (!wallet || !selectedDao) {
      notifyWarning('Connect wallet first.');
      return;
    }
    if (!daoRole?.isCreator) {
      notifyWarning('Only the founder can create a proposal from this card.');
      return;
    }
    setBusyAction('create-proposal');
    setLastTxHash('');
    try {
      const hash = await createInvestmentOnDao(wallet as unknown as PrivyEthereumWallet, {
        daoAddress: selectedDao.address as `0x${string}`,
        name: proposalName,
        category: Number(proposalCategory),
        fundNeededUsdc: proposalFundNeeded,
        expectedYieldPct: Number(proposalExpectedYield),
        grade: Number(proposalGrade),
        deadlineDays: Number(proposalDeadlineDays),
        documentCids: [],
      });
      setLastTxHash(hash);
      setProposalName('');
      notifySuccess('Proposal created successfully.');
      await loadSelectedDaoData(selectedDao.address as `0x${string}`);
    } catch (err) {
      const message = formatTxError(err, 'Proposal creation failed.');
      notifyError(message);
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-10 text-center lg:text-left">
        <h1 className="text-3xl font-bold text-slate-900">Discover Neighborhood DAOs</h1>
        <p className="text-slate-500 mt-2">Find and join investment clubs powered by your neighbors.</p>
      </div>

      {daos.length > 0 && (
        <div className="mb-12 bg-emerald-900 rounded-[2rem] p-8 lg:p-12 text-white relative overflow-hidden group">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-800 text-emerald-300 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
              <Star className="w-3 h-3" />
              Featured Community
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">{daos[0].name}</h2>
            <p className="text-emerald-100 text-lg mb-8 leading-relaxed">{daos[0].description}</p>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 inline-block">
              <p className="text-[10px] font-bold text-emerald-300 uppercase">Current TVL</p>
              <p className="text-lg font-bold">{daos[0].tvl}</p>
            </div>
          </div>
          <img
            src={daos[0].img}
            className="absolute right-0 top-0 w-full lg:w-2/3 h-full object-cover opacity-20 lg:opacity-40 group-hover:scale-105 transition-transform duration-1000"
            alt={daos[0].name}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900 via-emerald-900/80 to-transparent"></div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-grow relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by neighborhood, city, or keywords..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setVisibleCount(6);
            }}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
          <Filter className="w-5 h-5 text-slate-400" />
          Filters
        </button>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading active DAOs from Avalanche Fuji...</div>
      ) : error ? (
        <div className="py-20 text-center">
          <h3 className="text-xl font-bold text-slate-900">Could not load DAOs</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">{error}</p>
        </div>
      ) : filteredDAOs.length > 0 ? (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
          {visibleDaos.map((dao, idx) => (
            <DAOBrowseCard key={idx} dao={dao} onViewDetails={setSelectedDao} />
          ))}
        </div>
        {visibleCount < filteredDAOs.length && (
          <div className="flex justify-center mb-12">
            <button
              onClick={() => setVisibleCount((count) => count + 6)}
              className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Load More ({filteredDAOs.length - visibleCount} remaining)
            </button>
          </div>
        )}
        </>
      ) : (
        <div className="py-20 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No DAOs found matching your criteria</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">Try adjusting your filters or searching for a different neighborhood.</p>
          <button className="mt-8 px-6 py-3 navy-bg text-white font-bold rounded-xl">Create First DAO in this Area</button>
        </div>
      )}

      {/* Pagination / Load More */}
      {filteredDAOs.length > 0 && (
        <div className="flex flex-col items-center gap-4 py-8">
          <button className="px-8 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            Load More DAOs
          </button>
          <p className="text-xs text-slate-400 font-medium tracking-wide">Showing {filteredDAOs.length} of {daos.length} neighborhood DAOs</p>
        </div>
      )}

      {selectedDao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedDao(null)} />
          <div className="relative w-full max-w-4xl max-h-[88vh] overflow-y-auto bg-white rounded-[2rem] shadow-2xl p-6 lg:p-8">
            <button
              onClick={() => setSelectedDao(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-4">
              <img src={selectedDao.img} alt={selectedDao.name} className="w-full h-48 rounded-2xl object-cover" />
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedDao.name}</h2>
                <p className="text-slate-500 mt-1 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {selectedDao.location}
                </p>
              </div>
              <p className="text-sm text-slate-600">{selectedDao.description}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Treasury</p>
                  <p className="font-bold text-slate-900 mt-1">{selectedDao.tvl}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Members</p>
                  <p className="font-bold text-slate-900 mt-1">{selectedDao.members}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase">DAO Contract</p>
                <p className="text-sm font-mono text-slate-700 mt-1">{maskAddress(selectedDao.address)}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Investment Voting (Same Interface)</h3>
                  <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-2">
                    Each vote equals one USDC.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Choose Investment</label>
                    <select
                      value={selectedInvestmentId}
                      onChange={(e) => setSelectedInvestmentId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                    >
                      {daoInvestments.length === 0 && <option value="">No investment found</option>}
                      {daoInvestments.map((inv) => (
                        <option key={`${inv.daoAddress}-${inv.id}`} value={String(inv.id)}>
                          #{inv.id} {inv.name} ({statusLabel(inv.status)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Participant Wallets + Upvotes</label>
                    <select
                      value={participantAddress}
                      onChange={(e) => setParticipantAddress(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                    >
                      {participants.length === 0 && <option value="">No participants found</option>}
                      {participants.map((participant) => {
                        const upvotes = participantUpvotes[participant.address.toLowerCase()] ?? 0n;
                        return (
                          <option key={participant.address} value={participant.address}>
                            {maskAddress(participant.address)} • {participant.role} • {formatUsdcAmount(upvotes)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Your Upvote Amount (USDC)</label>
                    <input
                      type="number"
                      min="1"
                      value={upvoteAmount}
                      onChange={(e) => setUpvoteAmount(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 min-w-0">
                    <button
                      onClick={() => void handleVoteFromCard(1)}
                      disabled={!canVoteSelectedInvestment || busyAction.length > 0}
                      className="min-w-0 w-full px-2 sm:px-3 py-2.5 rounded-lg text-xs sm:text-sm font-bold bg-emerald-600 text-white disabled:opacity-50 whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      {busyAction === 'vote-1' ? 'Submitting...' : 'Upvote'}
                    </button>
                    <button
                      onClick={() => void handleVoteFromCard(0)}
                      disabled={!canVoteSelectedInvestment || busyAction.length > 0}
                      className="min-w-0 w-full px-2 sm:px-3 py-2.5 rounded-lg text-xs sm:text-sm font-bold bg-slate-800 text-white disabled:opacity-50 whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      {busyAction === 'vote-0' ? 'Submitting...' : 'Downvote'}
                    </button>
                  </div>
                  {!walletAddress && (
                    <p className="text-xs text-amber-700">Connect wallet to vote.</p>
                  )}
                  {walletAddress && daoRole && !daoRole.isVerifiedMember && (
                    <p className="text-xs text-amber-700">This wallet is not an active verified member of this DAO.</p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Create Investment Proposal</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-amber-100 text-amber-700">
                      Creator Only
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">This form submits `createInvestment(...)` on-chain for the selected DAO.</p>
                  {!walletAddress && <p className="text-xs text-amber-700">Connect wallet to create proposal.</p>}
                  {walletAddress && daoRole && !daoRole.isCreator && (
                    <p className="text-xs text-amber-700">Only creator can create proposal here.</p>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Proposal Name</label>
                    <input
                      type="text"
                      value={proposalName}
                      onChange={(e) => setProposalName(e.target.value)}
                      placeholder="e.g. Community Health Center Upgrade"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Category (0-7)</label>
                      <input
                        type="number"
                        value={proposalCategory}
                        onChange={(e) => setProposalCategory(e.target.value)}
                        placeholder="0 = HEALTH"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Grade (0-3)</label>
                      <input
                        type="number"
                        value={proposalGrade}
                        onChange={(e) => setProposalGrade(e.target.value)}
                        placeholder="0 = A"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
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
                        placeholder="1000"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Expected Yield (%)</label>
                      <input
                        type="number"
                        value={proposalExpectedYield}
                        onChange={(e) => setProposalExpectedYield(e.target.value)}
                        placeholder="10"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Voting Deadline (Days)</label>
                    <input
                      type="number"
                      value={proposalDeadlineDays}
                      onChange={(e) => setProposalDeadlineDays(e.target.value)}
                      placeholder="14"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    onClick={() => void handleCreateProposal()}
                    disabled={!daoRole?.isCreator || busyAction.length > 0}
                    className="w-full min-w-0 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-bold navy-bg text-white disabled:opacity-50 whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {busyAction === 'create-proposal' ? 'Creating...' : 'Create Proposal'}
                  </button>
                </div>
              </div>

              {lastTxHash && (
                <div className="flex items-center gap-3">
                  <a
                    href={getTxExplorerUrl(lastTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    View latest transaction on Explorer
                  </a>
                  {hasBackupExplorer() && (
                    <a
                      href={getTxExplorerUrl(lastTxHash, 1)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-slate-500 hover:underline"
                    >
                      Backup Explorer
                    </a>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={async () => {
                    const ok = await copyText(selectedDao.address);
                    if (ok) notifySuccess('Address copied.');
                    else notifyError('Unable to copy address.');
                  }}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50"
                >
                  <Copy className="w-4 h-4" />
                  Copy Address
                </button>
                <a
                  href={getAddressExplorerUrl(selectedDao.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 navy-bg text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  View on Explorer
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Discover;
