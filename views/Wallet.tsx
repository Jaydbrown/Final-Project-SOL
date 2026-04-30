import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/UI';
import { Globe, Shield, Wallet } from 'lucide-react';
import type { User } from '@privy-io/react-auth';
import { fetchActiveDaos, fetchYieldRows, formatUsdcAmount, type OnchainDao, type YieldRow } from '../utils/localDaoContracts';
import { getChainName } from '../utils/chainUtils';
import { formatTxError, notifyError } from '../utils/toast';

interface WalletViewProps {
  user: User | null;
}

const WalletView: React.FC<WalletViewProps> = ({ user }) => {
  const ethWallet = user?.linkedAccounts?.find(
    (account) => account.type === 'wallet' && 'chainType' in account && account.chainType === 'ethereum'
  ) as { chainId?: string; address?: string } | undefined;

  const [daos, setDaos] = useState<OnchainDao[]>([]);
  const [yields, setYields] = useState<YieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [daoPage, setDaoPage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [daoRows, yieldRows] = await Promise.all([
          fetchActiveDaos(),
          fetchYieldRows(ethWallet?.address as `0x${string}` | undefined),
        ]);
        setDaos(daoRows);
        setYields(yieldRows);
        setError('');
      } catch (err) {
        const message = formatTxError(err, 'Failed to load wallet data.');
        setError(message);
        notifyError(message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [ethWallet?.address]);

  const totals = useMemo(() => {
    const totalTvl = daos.reduce((sum, dao) => sum + dao.tvlRaw, 0n);
    const totalClaimable = yields.reduce((sum, row) => sum + row.claimable, 0n);
    return { totalTvl, totalClaimable };
  }, [daos, yields]);

  const pagedDaos = useMemo(() => {
    const start = (daoPage - 1) * PAGE_SIZE;
    return daos.slice(start, start + PAGE_SIZE);
  }, [daos, daoPage]);
  const daoPages = Math.max(1, Math.ceil(daos.length / PAGE_SIZE));

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Wallet</h1>
        <p className="text-slate-500 mt-2 flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-500" />
          {getChainName(ethWallet?.chainId)}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Loading wallet data...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-emerald-900 text-white border-none p-10">
              <p className="text-emerald-300 text-xs font-bold uppercase tracking-[0.2em] mb-4">On-chain Portfolio</p>
              <h2 className="text-4xl font-extrabold mb-6">{formatUsdcAmount(totals.totalTvl)}</h2>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-emerald-400 text-[10px] font-bold uppercase mb-1">Claimable Yield</p>
                  <p className="text-xl font-bold">{formatUsdcAmount(totals.totalClaimable)}</p>
                </div>
                <div>
                  <p className="text-emerald-400 text-[10px] font-bold uppercase mb-1">Connected Wallet</p>
                  <p className="text-sm font-mono">{ethWallet?.address ? `${ethWallet.address.slice(0, 6)}...${ethWallet.address.slice(-4)}` : 'No wallet connected'}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900">DAO Treasury Snapshot</h3>
                <p className="text-xs text-slate-500">{daos.length} total</p>
              </div>
              {daos.length === 0 ? (
                <p className="text-slate-500 text-sm">No active DAO found yet.</p>
              ) : (
                <>
                  <div className="max-h-96 overflow-y-auto pr-1 space-y-3">
                    {pagedDaos.map((dao) => (
                      <div key={dao.address} className="p-4 border border-slate-200 rounded-xl">
                        <p className="font-bold text-slate-900">{dao.name}</p>
                        <p className="text-xs text-slate-500">{dao.location}</p>
                        <p className="text-sm font-bold mt-2">{dao.tvlFormatted}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
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
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-slate-400" />
                <h3 className="font-bold text-slate-900">Wallet Actions</h3>
              </div>
              <p className="text-sm text-slate-500">
                Deposits and withdrawals happen through DAO actions (`vote`, `withdrawStake`, `claimYield`) and are visible in Snowtrace.
              </p>
            </Card>

            <Card className="bg-slate-900 text-white p-6 border-none">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-emerald-400" />
                <p className="text-xs font-bold">On-chain Security</p>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Funds are controlled by audited contract rules and role-based permissions on Avalanche Fuji.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletView;
