import React, { useEffect, useMemo, useState } from 'react';
import { useWallets } from "@privy-io/react-auth";
import { Card, Button, Modal } from '../components/UI';
import { AlertCircle, ArrowUpRight, Coins, TrendingUp } from 'lucide-react';
import {
  claimInvestmentYield,
  depositInvestmentYield,
  fetchDaoUserRole,
  fetchWithdrawableStakeRows,
  fetchYieldRows,
  formatUsdcAmount,
  withdrawInvestmentStake,
  type DaoUserRole,
  type PrivyEthereumWallet,
  type WithdrawableStakeRow,
  type YieldRow,
} from '../utils/localDaoContracts';
import { formatTxError, notifyError, notifySuccess, notifyWarning } from '../utils/toast';
import { getAddressExplorerUrl } from '../utils/explorer';

const YieldsView: React.FC = () => {
  const { wallets } = useWallets();
  const [activeTab, setActiveTab] = useState<'overview' | 'distribute'>('overview');
  const [rows, setRows] = useState<YieldRow[]>([]);
  const [withdrawRows, setWithdrawRows] = useState<WithdrawableStakeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [distributeModal, setDistributeModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<YieldRow | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositCid, setDepositCid] = useState('');
  const [rolesByDao, setRolesByDao] = useState<Record<string, DaoUserRole>>({});

  const wallet = wallets.find((item) => item.type === 'ethereum');
  const walletAddress = wallet?.address as `0x${string}` | undefined;

  const canManageDao = (daoAddress: string) => {
    const role = rolesByDao[daoAddress.toLowerCase()];
    if (!role) return false;
    return role.isCreator || role.isAdmin || role.isFinanceManager;
  };

  const loadRows = async () => {
    setLoading(true);
    setError('');
    try {
      const [yieldRows, withdrawable] = await Promise.all([
        fetchYieldRows(walletAddress),
        fetchWithdrawableStakeRows(walletAddress),
      ]);
      setRows(yieldRows);
      setWithdrawRows(withdrawable);

      if (walletAddress) {
        const uniqueDaos = Array.from(new Set(yieldRows.map((row) => row.daoAddress.toLowerCase())));
        const roles = await Promise.all(
          uniqueDaos.map(async (dao) => [dao, await fetchDaoUserRole(dao as `0x${string}`, walletAddress)] as const)
        );
        setRolesByDao(Object.fromEntries(roles));
      } else {
        setRolesByDao({});
      }
    } catch (err) {
      const message = formatTxError(err, 'Failed to load yields.');
      setError(message);
      notifyError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [wallet?.address]);

  const canManageAnyDao = useMemo(() => rows.some((row) => canManageDao(row.daoAddress)), [rows, rolesByDao]);

  const totals = useMemo(() => {
    const totalYield = rows.reduce((sum, row) => sum + row.totalYield, 0n);
    const totalClaimable = rows.reduce((sum, row) => sum + row.claimable, 0n);
    return { totalYield, totalClaimable };
  }, [rows]);

  const handleClaim = async (row: YieldRow) => {
    if (!wallet) {
      notifyWarning('Connect wallet first.');
      return;
    }
    setBusyId(`claim-${row.daoAddress}-${row.investmentId}`);
    setError('');
    try {
      await claimInvestmentYield(
        wallet as unknown as PrivyEthereumWallet,
        row.daoAddress,
        row.investmentId
      );
      notifySuccess('Yield claimed successfully.');
      await loadRows();
    } catch (err) {
      const message = formatTxError(err, 'Claim failed.');
      setError(message);
      notifyError(message);
    } finally {
      setBusyId('');
    }
  };

  const handleDeposit = async () => {
    if (!wallet || !selectedRow) {
      notifyWarning('Connect wallet first.');
      return;
    }
    setBusyId(`deposit-${selectedRow.daoAddress}-${selectedRow.investmentId}`);
    setError('');
    try {
      await depositInvestmentYield(wallet as unknown as PrivyEthereumWallet, {
        daoAddress: selectedRow.daoAddress,
        investmentId: selectedRow.investmentId,
        amountUsdc: depositAmount,
        expenseReportCID: depositCid || 'manual-report',
      });
      setDistributeModal(false);
      setDepositAmount('');
      setDepositCid('');
      notifySuccess('Yield deposited successfully.');
      await loadRows();
    } catch (err) {
      const message = formatTxError(err, 'Deposit failed.');
      setError(message);
      notifyError(message);
    } finally {
      setBusyId('');
    }
  };

  const handleWithdraw = async (row: WithdrawableStakeRow) => {
    if (!wallet) {
      notifyWarning('Connect wallet first.');
      return;
    }
    setBusyId(`withdraw-${row.daoAddress}-${row.investmentId}`);
    setError('');
    try {
      await withdrawInvestmentStake(
        wallet as unknown as PrivyEthereumWallet,
        row.daoAddress,
        row.investmentId
      );
      notifySuccess('Stake withdrawn successfully.');
      await loadRows();
    } catch (err) {
      const message = formatTxError(err, 'Withdraw failed.');
      setError(message);
      notifyError(message);
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto py-8 text-slate-500">Loading yield data from chain...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Yield Earnings</h1>
          <p className="text-slate-500 mt-2">Transparent neighborhood investment returns distributed on-chain.</p>
        </div>
        {canManageAnyDao && (
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('distribute')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'distribute' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Distribute Yields
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="bg-emerald-50 border-emerald-100 p-8 space-y-4">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-emerald-600 text-white rounded-2xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1">Total Yield Generated</p>
                <h3 className="text-3xl font-extrabold text-slate-900">{formatUsdcAmount(totals.totalYield)}</h3>
              </div>
            </Card>
            <Card className="p-8 space-y-4">
              <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl w-fit">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Your Claimable Yield</p>
                <h3 className="text-3xl font-extrabold text-slate-900">{formatUsdcAmount(totals.totalClaimable)}</h3>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Investment Yield Rows</h3>
            </div>
            <div className="p-6 space-y-4">
              {rows.length === 0 ? (
                <p className="text-slate-500">No yield records yet.</p>
              ) : (
                rows.map((row) => (
                  <div key={`${row.daoAddress}-${row.investmentId}`} className="p-4 border border-slate-200 rounded-2xl">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-bold text-slate-900">{row.investmentName}</p>
                        <p className="text-xs text-slate-500">{row.daoName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">{formatUsdcAmount(row.claimable)} claimable</p>
                        <p className="text-xs text-slate-500">Total: {formatUsdcAmount(row.totalYield)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <Button
                        onClick={() => void handleClaim(row)}
                        disabled={row.claimable <= 0n || busyId.length > 0}
                        size="sm"
                      >
                        {busyId === `claim-${row.daoAddress}-${row.investmentId}` ? 'Claiming...' : 'Claim'}
                      </Button>
                      <a
                        href={getAddressExplorerUrl(row.daoAddress)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1"
                      >
                        DAO contract
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Withdrawable Stakes</h3>
              <p className="text-xs text-slate-500 mt-1">For investments marked as INCOMPLETE.</p>
            </div>
            <div className="p-6 space-y-4">
              {withdrawRows.length === 0 ? (
                <p className="text-slate-500">No withdrawable stake right now.</p>
              ) : (
                withdrawRows.map((row) => (
                  <div key={`withdraw-${row.daoAddress}-${row.investmentId}`} className="p-4 border border-slate-200 rounded-2xl">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{row.investmentName}</p>
                        <p className="text-xs text-slate-500">{row.daoName}</p>
                      </div>
                      <p className="text-sm font-bold text-amber-700">{formatUsdcAmount(row.withdrawableAmount)} withdrawable</p>
                    </div>
                    <div className="mt-4">
                      <Button
                        size="sm"
                        onClick={() => void handleWithdraw(row)}
                        disabled={busyId.length > 0}
                      >
                        {busyId === `withdraw-${row.daoAddress}-${row.investmentId}` ? 'Withdrawing...' : 'Withdraw Stake'}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Distribute Yields</h3>
              <p className="text-sm text-slate-500 mt-1">Finance managers can deposit returns for each investment.</p>
            </div>
            <Coins className="w-10 h-10 text-slate-200" />
          </div>
          <div className="p-8 space-y-4">
            {rows.length === 0 ? (
              <p className="text-slate-500">No investments available.</p>
            ) : (
              rows.map((row) => (
                <div key={`${row.daoAddress}-${row.investmentId}`} className="p-4 border border-slate-200 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">{row.investmentName}</p>
                    <p className="text-xs text-slate-500">{row.daoName}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={!canManageDao(row.daoAddress)}
                    onClick={() => {
                      if (!canManageDao(row.daoAddress)) {
                        notifyWarning('Only founder/admin/finance lead can deposit yield for this community.');
                        return;
                      }
                      setSelectedRow(row);
                      setDistributeModal(true);
                    }}
                  >
                    Deposit Yield
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      <Modal
        isOpen={distributeModal}
        onClose={() => setDistributeModal(false)}
        title="Deposit Yield"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDistributeModal(false)}>Cancel</Button>
            <Button onClick={() => void handleDeposit()} disabled={busyId.length > 0}>
              {busyId.startsWith('deposit-') ? 'Submitting...' : 'Deposit'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500">Investment</p>
            <p className="font-bold text-slate-900">{selectedRow?.investmentName}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Amount (USDC)</label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              placeholder="100"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Expense Report CID</label>
            <input
              type="text"
              value={depositCid}
              onChange={(e) => setDepositCid(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              placeholder="ipfs://..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default YieldsView;
