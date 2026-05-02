import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Card, Badge } from '../components/UI';
import { UserAvatar } from '../components/UserAvatar';
import { CheckCircle, Copy, ExternalLink, Globe, Mail, Shield, Trash2, Upload, Wallet } from 'lucide-react';
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
import { uploadImageToIpfs } from '../utils/ipfs';
import {
  PROFILE_AVATAR_CHANGED_EVENT,
  clearStoredProfileAvatarUrl,
  getStoredProfileAvatarUrl,
  setStoredProfileAvatarUrl,
} from '../utils/profileAvatar';
import { getAccountDisplayName, getAccountInitial } from '../utils/userDisplay';
import { formatTxError } from '../utils/toast';

const MAX_PROFILE_AVATAR_BYTES = 4 * 1024 * 1024;
const PROFILE_AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const pinataConfigured = () =>
  Boolean((import.meta.env.VITE_PINATA_JWT as string | undefined)?.trim());

const ProfileView: React.FC = () => {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [daos, setDaos] = useState<OnchainDao[]>([]);
  const [roleRows, setRoleRows] = useState<WalletDaoRoleRow[]>([]);
  const [yields, setYields] = useState<YieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const walletAddress = useMemo(() => {
    const embedded = wallets.find((w) => w.type === "ethereum")?.address;
    const linked = user?.linkedAccounts?.find(
      (account) => account.type === "wallet" && "address" in account,
    ) as { address?: string } | undefined;
    return (embedded || linked?.address || "").trim();
  }, [wallets, user]);

  const displayName = useMemo(() => getAccountDisplayName(user, walletAddress), [user, walletAddress]);
  const accountInitial = useMemo(
    () => getAccountInitial(displayName, user?.email?.address),
    [displayName, user?.email?.address],
  );

  useEffect(() => {
    if (!walletAddress) {
      setProfileAvatarUrl(null);
      return;
    }
    setProfileAvatarUrl(getStoredProfileAvatarUrl(walletAddress));
    const onChange = (ev: Event) => {
      const w = (ev as CustomEvent<{ wallet?: string }>).detail?.wallet;
      if (w === walletAddress.toLowerCase()) {
        setProfileAvatarUrl(getStoredProfileAvatarUrl(walletAddress));
      }
    };
    window.addEventListener(PROFILE_AVATAR_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(PROFILE_AVATAR_CHANGED_EVENT, onChange);
  }, [walletAddress]);

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

  const totalYield = yields.reduce((sum, row) => sum + row.claimable, 0n);

  const onPickAvatar: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !walletAddress) return;
    if (!PROFILE_AVATAR_MIME.has(file.type)) {
      window.alert("Please choose a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_PROFILE_AVATAR_BYTES) {
      window.alert("Image must be 4 MB or smaller.");
      return;
    }
    if (!pinataConfigured()) {
      window.alert("Add VITE_PINATA_JWT to your environment to upload a profile photo.");
      return;
    }
    setAvatarBusy(true);
    try {
      const { gatewayUrl } = await uploadImageToIpfs(file);
      setStoredProfileAvatarUrl(walletAddress, gatewayUrl);
      setProfileAvatarUrl(gatewayUrl);
    } catch (err) {
      window.alert(formatTxError(err, "Could not upload photo."));
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = () => {
    if (!walletAddress) return;
    clearStoredProfileAvatarUrl(walletAddress);
    setProfileAvatarUrl(null);
  };

  return (
    <div className="max-w-5xl mx-auto pb-6 lg:pb-12 animate-in fade-in duration-700 space-y-4 sm:space-y-6 w-full min-w-0">
      <Card className="p-4 sm:p-8">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={onPickAvatar}
        />
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-5">
            <div className="relative shrink-0">
              <UserAvatar imageUrl={profileAvatarUrl} initials={accountInitial} size={88} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 truncate">{displayName}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {user?.email?.address ?? "No email linked"}
              </p>
              {walletAddress ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={avatarBusy || !pinataConfigured()}
                    onClick={() => avatarInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {avatarBusy ? "Uploading…" : "Upload profile photo"}
                  </button>
                  {profileAvatarUrl ? (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-3">Connect a wallet to save a profile photo.</p>
              )}
              {!pinataConfigured() ? (
                <p className="text-xs text-amber-700 mt-2 max-w-md">
                  Set <span className="font-mono">VITE_PINATA_JWT</span> to enable uploads. Photos are stored on IPFS and the URL is saved in this browser for your wallet.
                </p>
              ) : walletAddress ? (
                <p className="text-xs text-slate-400 mt-2 max-w-md">
                  This picture appears next to your name in the sidebar and header. It is stored locally per wallet on this device.
                </p>
              ) : null}
            </div>
          </div>
          <Badge variant="success" className="shrink-0">
            <CheckCircle className="w-3 h-3 mr-1" />
            Authenticated
          </Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Account Overview</h2>
            {loading ? (
              <p className="text-slate-500 text-sm">Loading profile data...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
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

          <Card className="p-4 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Connected Wallet</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4 min-w-0">
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
