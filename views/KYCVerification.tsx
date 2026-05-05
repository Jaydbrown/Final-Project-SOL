import React, { useEffect, useMemo, useState } from 'react';
import { Shield, Loader2, FileText, Copy, ExternalLink } from 'lucide-react';
import { useWallets } from '@privy-io/react-auth';
import { copyText } from '../utils/clipboard';
import { maskAddress } from '../utils/address';
import {
  activateInvestmentOnDao,
  addAdminOnDao,
  addFinanceManagerOnDao,
  addMemberToDao,
  closeInvestmentOnDao,
  fetchAllInvestments,
  fetchAdminManagedDaos,
  fetchDaoUserRole,
  markInvestmentIncompleteOnDao,
  pauseDao,
  removeAdminOnDao,
  removeFinanceManagerOnDao,
  removeMemberOnDao,
  sweepUnclaimedYieldOnDao,
  type OnchainDao,
  type OnchainInvestment,
  type DaoUserRole,
  type PrivyEthereumWallet,
  unpauseDao,
  verifyMemberOnDao,
} from '../utils/localDaoContracts';
import { formatTxError, notifyError, notifySuccess, notifyWarning } from '../utils/toast';
import { getTxExplorerUrl, hasBackupExplorer } from '../utils/explorer';

const KYCVerification: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { wallets } = useWallets();
  const [step, setStep] = useState(0); // 0: Intro, 1: Add Member, 2: Success
  const [daos, setDaos] = useState<OnchainDao[]>([]);
  const [selectedDao, setSelectedDao] = useState('');
  const [memberWallet, setMemberWallet] = useState('');
  const [proofReference, setProofReference] = useState('');
  const [loadingDaos, setLoadingDaos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [proofReferenceUsed, setProofReferenceUsed] = useState('');
  const [kycProofHash, setKycProofHash] = useState('');
  const [copyState, setCopyState] = useState('');
  const [daoRole, setDaoRole] = useState<DaoUserRole | null>(null);
  const [investments, setInvestments] = useState<OnchainInvestment[]>([]);
  const [adminWalletInput, setAdminWalletInput] = useState('');
  const [financeWalletInput, setFinanceWalletInput] = useState('');
  const [memberMgmtWallet, setMemberMgmtWallet] = useState('');
  const [investmentIdInput, setInvestmentIdInput] = useState('');
  const [sweepRecipient, setSweepRecipient] = useState('');
  const [actionBusy, setActionBusy] = useState('');

  const normalizeAddMemberError = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err ?? '');
    const lower = message.toLowerCase();

    if (
      lower.includes('already a member') ||
      lower.includes('address is already a member')
    ) {
      return 'This address is already an active member of this community.';
    }
    if (lower.includes('not admin') || lower.includes('connected wallet is not creator/admin')) {
      return 'You do not have permission for this action. Use the founder or admin account.';
    }
    if (lower.includes('maximum membership limit reached')) {
      return 'This community has reached its member limit.';
    }
    if (lower.includes('invalid wallet address')) {
      return 'Enter a valid member address.';
    }
    if (
      lower.includes('user rejected') ||
      lower.includes('user denied') ||
      lower.includes('denied transaction signature')
    ) {
      return 'Action was cancelled.';
    }
    return message || 'Could not add member right now.';
  };

  const connectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.type === 'ethereum') ?? null,
    [wallets],
  );

  useEffect(() => {
    const loadDaos = async () => {
      setLoadingDaos(true);
      try {
        const rows = await fetchAdminManagedDaos(connectedWallet?.address as `0x${string}` | undefined);
        setDaos(rows);
        setSelectedDao((current) => {
          if (current) return current;
          if (typeof window !== 'undefined') {
            const recentDao = sessionStorage.getItem('localdao_recent_created_dao');
            if (recentDao && rows.some((row) => row.address.toLowerCase() === recentDao.toLowerCase())) {
              return recentDao;
            }
          }
          return rows[0]?.address || '';
        });
        if (!connectedWallet?.address) {
          const message = 'Connect your founder/admin account to continue.';
          setError(message);
          notifyWarning(message);
        } else if (rows.length === 0) {
          const message = 'This account is not a founder/admin in any active community. Switch account or add admin access first.';
          setError(message);
          notifyWarning(message);
        } else {
          setError('');
        }
      } catch (err) {
        const message = formatTxError(err, 'Could not load communities.');
        setError(message);
        notifyError(message);
      } finally {
        setLoadingDaos(false);
      }
    };
    void loadDaos();
  }, [connectedWallet?.address]);

  useEffect(() => {
    const loadDaoContext = async () => {
      if (!selectedDao) {
        setDaoRole(null);
        setInvestments([]);
        return;
      }
      try {
        if (connectedWallet?.address) {
          const role = await fetchDaoUserRole(selectedDao as `0x${string}`, connectedWallet.address as `0x${string}`);
          setDaoRole(role);
        } else {
          setDaoRole(null);
        }
        const all = await fetchAllInvestments();
        setInvestments(all.filter((inv) => inv.daoAddress.toLowerCase() === selectedDao.toLowerCase()));
      } catch {
        // keep existing errors for the main flow
      }
    };
    void loadDaoContext();
  }, [selectedDao, connectedWallet?.address]);

  const normalizeRoleActionError = (err: unknown, actionName?: string): string => {
    const message = err instanceof Error ? err.message : String(err ?? '');
    const lower = message.toLowerCase();
    if (lower.includes('investment does not meet activation requirements')) {
      return 'This project cannot be activated yet. It must meet the minimum funding and timing rules first.';
    }
    if (lower.includes('not creator')) return 'Only the founder can do this.';
    if (lower.includes('not admin')) return 'Only an admin (or founder) can do this.';
    if (lower.includes('not authorized')) return 'Only the finance lead, admin, or founder can do this.';
    if (lower.includes('already')) {
      if (actionName === 'verify-member') return 'This member is already verified.';
      if (actionName === 'add-admin') return 'This address is already an admin.';
      if (actionName === 'add-fm') return 'This address is already a finance lead.';
      return 'This action cannot be completed because no change is needed.';
    }
    if (lower.includes('user rejected') || lower.includes('user denied')) return 'Action was cancelled.';
    return message || 'Action failed.';
  };

  const requireWalletAndDao = () => {
    if (!connectedWallet) {
      const message = 'Connect your account in Privy first.';
      setError(message);
      notifyWarning(message);
      return false;
    }
    if (!selectedDao) {
      const message = 'Select a community first.';
      setError(message);
      notifyWarning(message);
      return false;
    }
    return true;
  };

  const runRoleAction = async (actionName: string, fn: () => Promise<void>) => {
    const successByAction: Record<string, string> = {
      'add-admin': 'Admin added successfully.',
      'remove-admin': 'Admin removed successfully.',
      'add-fm': 'Finance lead added successfully.',
      'remove-fm': 'Finance lead removed successfully.',
      'verify-member': 'Member verified successfully.',
      'remove-member': 'Member removed successfully.',
      'activate-investment': 'Project activated successfully.',
      'mark-incomplete': 'Project marked as incomplete.',
      'close-investment': 'Project closed successfully.',
      'sweep-yield': 'Unclaimed funds moved successfully.',
      'pause-dao': 'Community paused successfully.',
      'unpause-dao': 'Community resumed successfully.',
    };
    setError('');
    setActionBusy(actionName);
    try {
      await fn();
      const all = await fetchAllInvestments();
      setInvestments(all.filter((inv) => inv.daoAddress.toLowerCase() === selectedDao.toLowerCase()));
      notifySuccess(successByAction[actionName] ?? 'Action completed successfully.');
    } catch (err) {
      const friendly = normalizeRoleActionError(err, actionName);
      notifyError(friendly);
    } finally {
      setActionBusy('');
    }
  };

  const handleAddMember = async () => {
    setError('');
    if (!connectedWallet) {
      const message = 'Connect your account in Privy first.';
      setError(message);
      notifyWarning(message);
      return;
    }
    if (!selectedDao) {
      const message = 'Select a community.';
      setError(message);
      notifyWarning(message);
      return;
    }
    if (!memberWallet.trim().startsWith('0x') || memberWallet.trim().length !== 42) {
      const message = 'Enter a valid member address.';
      setError(message);
      notifyWarning(message);
      return;
    }

    setSubmitting(true);
    try {
      const result = await addMemberToDao(
        connectedWallet as unknown as PrivyEthereumWallet,
        {
          daoAddress: selectedDao as `0x${string}`,
          memberWallet: memberWallet.trim() as `0x${string}`,
          proofReference: proofReference.trim() || undefined,
        },
      );
      setTxHash(result.txHash);
      setProofReferenceUsed(result.proofReferenceUsed);
      setKycProofHash(result.kycProofHash);
      setStep(2);
      notifySuccess(
        'Member added to the roster. Use Admin → Verify Member so they can vote once KYC checks are complete.',
      );
    } catch (err) {
      const friendly = normalizeAddMemberError(err);
      setError(friendly);
      notifyError(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Team Access</h1>
              <p className="text-xs text-slate-400 font-medium">Manage team roles and members</p>
            </div>
          </div>
          {/* {step > 0 && step < 2 && <div className="text-xs font-bold text-slate-400">Step {step} of 1</div>} */}
        </div>

        <div className="p-8">
          {step === 0 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Member Setup</h2>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                  Add people to your community and manage who can do what.
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-left">
                <div className="flex gap-3">
                  <InfoIcon className="w-5 h-5 text-blue-500 shrink-0" />
                  <p className="text-xs text-blue-700 leading-normal">
                    If you do not use an external identity provider, leave the reference blank. We will create a fallback reference automatically.
                  </p>
                </div>
              </div>
              <button onClick={() => setStep(1)} className="w-full py-4 navy-bg text-white rounded-xl font-bold shadow-lg shadow-slate-900/10">
                Continue
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h3 className="font-bold text-slate-900">Add Member</h3>

              {loadingDaos ? (
                <p className="text-sm text-slate-500">Loading communities...</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Community</label>
                    <select
                      value={selectedDao}
                      onChange={(e) => setSelectedDao(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    >
                      {daos.length === 0 && <option value="">No active community found</option>}
                      {daos.map((dao) => (
                        <option key={dao.address} value={dao.address}>
                          {dao.name} ({maskAddress(dao.address)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Member Address</label>
                    <input
                      type="text"
                      value={memberWallet}
                      onChange={(e) => setMemberWallet(e.target.value)}
                      placeholder="0x..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                    
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Identity Reference (optional)</label>
                    <input
                      type="text"
                      value={proofReference}
                      onChange={(e) => setProofReference(e.target.value)}
                      placeholder="Case ID or reference note"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                    {/* <p className="text-xs text-slate-500 mt-2">
                      You get this from your off-chain process. If empty, we generate a fallback internal reference for MVP.
                    </p> */}
                  </div>

                  <button
                    onClick={handleAddMember}
                    disabled={submitting || daos.length === 0}
                    className="w-full py-4 navy-bg text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Saving...' : 'Add Member'}
                  </button>

                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <h4 className="text-sm font-bold text-slate-900">Founder/Admin Controls</h4>
                    <p className="text-xs text-slate-500">
                      Active roles: {daoRole ? [
                        daoRole.isCreator ? 'Founder' : '',
                        daoRole.isAdmin ? 'Admin' : '',
                        daoRole.isFinanceManager ? 'Finance Lead' : '',
                        daoRole.isVerifiedMember ? 'Verified Member' : '',
                      ].filter(Boolean).join(', ') || 'None' : 'Unknown'}
                    </p>

                    {daoRole?.isCreator && (
                      <div className="space-y-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Founder Actions</p>
                        <div className="space-y-2 p-3 bg-white border border-slate-200 rounded-xl">
                          <label className="block text-xs font-bold text-slate-700">Wallet to grant/revoke Admin role</label>
                          <p className="text-[11px] text-slate-500">Use this when you want someone to manage members and projects.</p>
                          <input
                            type="text"
                            value={adminWalletInput}
                            onChange={(e) => setAdminWalletInput(e.target.value)}
                            placeholder="Enter wallet address (0x...)"
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (!requireWalletAndDao()) return;
                                void runRoleAction('add-admin', async () => {
                                  await addAdminOnDao(
                                    connectedWallet as unknown as PrivyEthereumWallet,
                                    selectedDao as `0x${string}`,
                                    adminWalletInput.trim() as `0x${string}`
                                  );
                                });
                              }}
                              disabled={actionBusy.length > 0 || !adminWalletInput}
                              className="flex-1 py-2 navy-bg text-white rounded-lg text-xs font-bold disabled:opacity-50"
                            >
                              {actionBusy === 'add-admin' ? 'Adding...' : 'Add Admin'}
                            </button>
                            <button
                              onClick={() => {
                                if (!requireWalletAndDao()) return;
                                void runRoleAction('remove-admin', async () => {
                                  await removeAdminOnDao(
                                    connectedWallet as unknown as PrivyEthereumWallet,
                                    selectedDao as `0x${string}`,
                                    adminWalletInput.trim() as `0x${string}`
                                  );
                                });
                              }}
                              disabled={actionBusy.length > 0 || !adminWalletInput}
                              className="flex-1 py-2 border border-slate-300 rounded-lg text-xs font-bold disabled:opacity-50"
                            >
                              {actionBusy === 'remove-admin' ? 'Removing...' : 'Remove Admin'}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 p-3 bg-white border border-slate-200 rounded-xl">
                          <label className="block text-xs font-bold text-slate-700">Wallet to grant/revoke Finance Lead role</label>
                          <p className="text-[11px] text-slate-500">Finance leads can deposit investment returns and extend deadlines.</p>
                          <input
                            type="text"
                            value={financeWalletInput}
                            onChange={(e) => setFinanceWalletInput(e.target.value)}
                            placeholder="Enter wallet address (0x...)"
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (!requireWalletAndDao()) return;
                                void runRoleAction('add-fm', async () => {
                                  await addFinanceManagerOnDao(
                                    connectedWallet as unknown as PrivyEthereumWallet,
                                    selectedDao as `0x${string}`,
                                    financeWalletInput.trim() as `0x${string}`
                                  );
                                });
                              }}
                              disabled={actionBusy.length > 0 || !financeWalletInput}
                              className="flex-1 py-2 navy-bg text-white rounded-lg text-xs font-bold disabled:opacity-50"
                            >
                              {actionBusy === 'add-fm' ? 'Adding...' : 'Add Finance Lead'}
                            </button>
                            <button
                              onClick={() => {
                                if (!requireWalletAndDao()) return;
                                void runRoleAction('remove-fm', async () => {
                                  await removeFinanceManagerOnDao(
                                    connectedWallet as unknown as PrivyEthereumWallet,
                                    selectedDao as `0x${string}`,
                                    financeWalletInput.trim() as `0x${string}`
                                  );
                                });
                              }}
                              disabled={actionBusy.length > 0 || !financeWalletInput}
                              className="flex-1 py-2 border border-slate-300 rounded-lg text-xs font-bold disabled:opacity-50"
                            >
                              {actionBusy === 'remove-fm' ? 'Removing...' : 'Remove Finance Lead'}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 p-3 bg-white border border-slate-200 rounded-xl">
                          <p className="text-xs font-bold text-slate-700">Community emergency controls</p>
                          <p className="text-[11px] text-slate-500">Pause temporarily blocks sensitive actions. Resume re-enables them.</p>
                          <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (!requireWalletAndDao()) return;
                              void runRoleAction('pause-dao', async () => {
                                await pauseDao(
                                  connectedWallet as unknown as PrivyEthereumWallet,
                                  selectedDao as `0x${string}`
                                );
                              });
                            }}
                            disabled={actionBusy.length > 0}
                            className="flex-1 py-2 border border-amber-300 text-amber-700 rounded-lg text-xs font-bold disabled:opacity-50"
                          >
                            {actionBusy === 'pause-dao' ? 'Pausing...' : 'Pause Community'}
                          </button>
                          <button
                            onClick={() => {
                              if (!requireWalletAndDao()) return;
                              void runRoleAction('unpause-dao', async () => {
                                await unpauseDao(
                                  connectedWallet as unknown as PrivyEthereumWallet,
                                  selectedDao as `0x${string}`
                                );
                              });
                            }}
                            disabled={actionBusy.length > 0}
                            className="flex-1 py-2 border border-emerald-300 text-emerald-700 rounded-lg text-xs font-bold disabled:opacity-50"
                          >
                            {actionBusy === 'unpause-dao' ? 'Unpausing...' : 'Resume Community'}
                          </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {(daoRole?.isAdmin || daoRole?.isCreator) && (
                      <div className="space-y-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Admin Actions</p>
                        <div className="space-y-2 p-3 bg-white border border-slate-200 rounded-xl">
                          <label className="block text-xs font-bold text-slate-700">Member wallet for verification/removal</label>
                          <p className="text-[11px] text-slate-500">Use Verify when identity checks are complete. Remove to disable access.</p>
                          <input
                            type="text"
                            value={memberMgmtWallet}
                            onChange={(e) => setMemberMgmtWallet(e.target.value)}
                            placeholder="Enter member wallet (0x...)"
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (!requireWalletAndDao()) return;
                                void runRoleAction('verify-member', async () => {
                                  await verifyMemberOnDao(
                                    connectedWallet as unknown as PrivyEthereumWallet,
                                    selectedDao as `0x${string}`,
                                    memberMgmtWallet.trim() as `0x${string}`
                                  );
                                });
                              }}
                              disabled={actionBusy.length > 0 || !memberMgmtWallet}
                              className="flex-1 py-2 navy-bg text-white rounded-lg text-xs font-bold disabled:opacity-50"
                            >
                              {actionBusy === 'verify-member' ? 'Verifying...' : 'Verify Member'}
                            </button>
                            <button
                              onClick={() => {
                                if (!requireWalletAndDao()) return;
                                void runRoleAction('remove-member', async () => {
                                  await removeMemberOnDao(
                                    connectedWallet as unknown as PrivyEthereumWallet,
                                    selectedDao as `0x${string}`,
                                    memberMgmtWallet.trim() as `0x${string}`
                                  );
                                });
                              }}
                              disabled={actionBusy.length > 0 || !memberMgmtWallet}
                              className="flex-1 py-2 border border-slate-300 rounded-lg text-xs font-bold disabled:opacity-50"
                            >
                              {actionBusy === 'remove-member' ? 'Removing...' : 'Remove Member'}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 p-3 bg-white border border-slate-200 rounded-xl">
                          <label className="block text-xs font-bold text-slate-700">Select project for project actions</label>
                          <p className="text-[11px] text-slate-500">Activate when vote requirements are met, or mark as incomplete if funding failed.</p>
                          <select
                            value={investmentIdInput}
                            onChange={(e) => setInvestmentIdInput(e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                          >
                            <option value="">Select project</option>
                            {investments.map((inv) => (
                              <option key={inv.id} value={String(inv.id)}>
                                #{inv.id} {inv.name}
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                if (!requireWalletAndDao()) return;
                                if (!investmentIdInput) return notifyWarning('Select a project.');
                                void runRoleAction('activate-investment', async () => {
                                  await activateInvestmentOnDao(
                                    connectedWallet as unknown as PrivyEthereumWallet,
                                    selectedDao as `0x${string}`,
                                    Number(investmentIdInput)
                                  );
                                });
                              }}
                              disabled={actionBusy.length > 0 || !investmentIdInput}
                              className="py-2 navy-bg text-white rounded-lg text-xs font-bold disabled:opacity-50"
                            >
                              {actionBusy === 'activate-investment' ? 'Activating...' : 'Activate'}
                            </button>
                            <button
                              onClick={() => {
                                if (!requireWalletAndDao()) return;
                                if (!investmentIdInput) return notifyWarning('Select a project.');
                                void runRoleAction('mark-incomplete', async () => {
                                  await markInvestmentIncompleteOnDao(
                                    connectedWallet as unknown as PrivyEthereumWallet,
                                    selectedDao as `0x${string}`,
                                    Number(investmentIdInput)
                                  );
                                });
                              }}
                              disabled={actionBusy.length > 0 || !investmentIdInput}
                              className="py-2 border border-slate-300 rounded-lg text-xs font-bold disabled:opacity-50"
                            >
                              {actionBusy === 'mark-incomplete' ? 'Submitting...' : 'Mark Incomplete'}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 p-3 bg-white border border-slate-200 rounded-xl">
                          <label className="block text-xs font-bold text-slate-700">Close project (after full payout)</label>
                          <p className="text-[11px] text-slate-500">Use this after all yield has been distributed to members.</p>
                          <button
                            onClick={() => {
                              if (!requireWalletAndDao()) return;
                              if (!investmentIdInput) return notifyWarning('Select a project.');
                              void runRoleAction('close-investment', async () => {
                                await closeInvestmentOnDao(
                                  connectedWallet as unknown as PrivyEthereumWallet,
                                  selectedDao as `0x${string}`,
                                  Number(investmentIdInput)
                                );
                              });
                            }}
                            disabled={actionBusy.length > 0 || !investmentIdInput}
                            className="w-full py-2 border border-slate-300 rounded-lg text-xs font-bold disabled:opacity-50"
                          >
                            {actionBusy === 'close-investment' ? 'Closing...' : 'Close Project'}
                          </button>
                        </div>

                        <div className="space-y-2 p-3 bg-white border border-slate-200 rounded-xl">
                          <label className="block text-xs font-bold text-slate-700">Move unclaimed funds</label>
                          <p className="text-[11px] text-slate-500">
                            After grace period ends, move remaining unclaimed yield for the selected project to this recipient wallet.
                          </p>
                          <input
                            type="text"
                            value={sweepRecipient}
                            onChange={(e) => setSweepRecipient(e.target.value)}
                            placeholder="Recipient wallet address (0x...)"
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                          />
                          <button
                            onClick={() => {
                              if (!requireWalletAndDao()) return;
                              if (!investmentIdInput) return notifyWarning('Select a project.');
                              if (!sweepRecipient) return notifyWarning('Enter a payout address.');
                              void runRoleAction('sweep-yield', async () => {
                                await sweepUnclaimedYieldOnDao(
                                  connectedWallet as unknown as PrivyEthereumWallet,
                                  selectedDao as `0x${string}`,
                                  Number(investmentIdInput),
                                  sweepRecipient.trim() as `0x${string}`
                                );
                              });
                            }}
                            disabled={actionBusy.length > 0 || !investmentIdInput || !sweepRecipient}
                            className="w-full py-2 border border-rose-300 text-rose-700 rounded-lg text-xs font-bold disabled:opacity-50"
                          >
                            {actionBusy === 'sweep-yield' ? 'Moving...' : 'Move Unclaimed Funds'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 text-center py-6 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-10 h-10 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Member Added Successfully</h2>
                <p className="text-slate-500 mt-2 text-sm">Member setup is complete.</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2">
                <p className="text-xs text-slate-500">Reference Used</p>
                <p className="text-xs font-mono text-slate-700 break-all">{proofReferenceUsed}</p>
                <p className="text-xs text-slate-500 pt-2">kycProofHash</p>
                <p className="text-xs font-mono text-slate-700 break-all">{kycProofHash}</p>
                <div className="pt-1">
                  <button
                    onClick={async () => {
                      const ok = await copyText(kycProofHash);
                      setCopyState(ok ? 'Hash copied.' : 'Copy failed.');
                      setTimeout(() => setCopyState(''), 1800);
                    }}
                    className="text-xs font-bold text-emerald-600 inline-flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy Hash
                  </button>
                  {copyState && <p className="text-xs text-emerald-600 mt-1">{copyState}</p>}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={getTxExplorerUrl(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  View Transaction
                  <ExternalLink className="w-4 h-4" />
                </a>
                {hasBackupExplorer() && (
                  <a
                    href={getTxExplorerUrl(txHash, 1)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                  >
                    Backup Explorer
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button onClick={onComplete} className="flex-1 py-3 navy-bg text-white rounded-xl font-bold text-sm">
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default KYCVerification;
