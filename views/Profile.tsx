import React, { useEffect, useMemo, useState } from 'react';
import { usePrivy } from "@privy-io/react-auth";
import { Card, Badge } from '../components/UI';
import { CheckCircle, Copy, ExternalLink, Globe, Mail, Shield, Wallet } from 'lucide-react';
import {
  fetchActiveDaos,
  fetchWalletDaoRoles,
  fetchYieldRows,
  formatUsdcAmount,
  type OnchainDao,
  type WalletDaoRoleRow,
  type YieldRow,
} from '../utils/localDaoContracts';
import { maskAddress } from '../utils/address';
import { copyText } from '../utils/clipboard';
import { getAddressExplorerUrl } from '../utils/explorer';

const ProfileView: React.FC = () => {
  const { user } = usePrivy();
  const [daos, setDaos] = useState<OnchainDao[]>([]);
  const [roleRows, setRoleRows] = useState<WalletDaoRoleRow[]>([]);
  const [yields, setYields] = useState<YieldRow[]>([]);
  const [loading, setLoading] = useState(true);

  const walletAddress = useMemo(() => {
    const wallet = user?.linkedAccounts?.find(
      (account) => account.type === 'wallet' && 'address' in account
    ) as { address?: string } | undefined;
    return wallet?.address ?? '';
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [daoRows, yieldRows] = await Promise.all([
          fetchActiveDaos(),
          fetchYieldRows(walletAddress as `0x${string}` | undefined),
        ]);
        const walletRoles = await fetchWalletDaoRoles(walletAddress as `0x${string}` | undefined);
        setDaos(daoRows);
        setRoleRows(walletRoles);
        setYields(yieldRows);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [walletAddress]);

  const profileName = user?.email?.address ? user.email.address.split('@')[0] : 'Member';
  const totalYield = yields.reduce((sum, row) => sum + row.claimable, 0n);

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-in fade-in duration-700 space-y-6">
      <Card className="p-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{profileName}</h1>
            <p className="text-sm text-slate-500">{user?.email?.address ?? 'No email linked'}</p>
          </div>
          <Badge variant="success">
            <CheckCircle className="w-3 h-3 mr-1" />
            Authenticated
          </Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Account Overview</h2>
            {loading ? (
              <p className="text-slate-500 text-sm">Loading profile data...</p>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active DAOs</p>
                  <p className="text-2xl font-extrabold text-slate-900">{daos.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DAO Roles</p>
                  <p className="text-2xl font-extrabold text-slate-900">{roleRows.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Claimable Yield</p>
                  <p className="text-2xl font-extrabold text-slate-900">{formatUsdcAmount(totalYield)}</p>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Connected Wallet</h2>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Wallet className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {walletAddress ? maskAddress(walletAddress) : 'No wallet connected'}
                  </p>
                </div>
              </div>
              {walletAddress && (
                <div className="flex gap-2">
                  <button className="p-2 rounded-lg hover:bg-slate-200" onClick={() => { void copyText(walletAddress); }}>
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    className="p-2 rounded-lg hover:bg-slate-200"
                    target="_blank"
                    rel="noreferrer"
                    href={getAddressExplorerUrl(walletAddress)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">DAO Roles</h2>
            {roleRows.length === 0 ? (
              <p className="text-sm text-slate-500">No role found for this wallet on active DAOs.</p>
            ) : (
              <div className="space-y-3">
                {roleRows.map((row) => (
                  <div key={row.daoAddress} className="p-4 border border-slate-100 rounded-xl space-y-3">
                    <div>
                      <p className="font-bold text-slate-900">{row.daoName}</p>
                      <p className="text-xs text-slate-500">{row.location}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.isCreator && <Badge variant="neutral">Creator</Badge>}
                      {row.isAdmin && <Badge variant="info">Admin</Badge>}
                      {row.isFinanceManager && <Badge variant="warning">Finance Manager</Badge>}
                      {row.isVerifiedMember && <Badge variant="success">Verified Member</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-8">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-bold text-slate-900">Security</h2>
            </div>
            <p className="text-sm text-slate-600 mb-2">Identity is managed by Privy authentication.</p>
            <p className="text-xs text-slate-500">KYC and role data are enforced by on-chain DAO permissions.</p>
          </Card>

          <Card className="p-8 space-y-3">
            <button className="w-full text-left text-sm font-medium text-slate-700 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Help Center
            </button>
            <button className="w-full text-left text-sm font-medium text-slate-700 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Contact Support
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
