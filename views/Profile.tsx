import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Card, Badge, RoleTags, MetricCard } from "../components/UI";
import { UserAvatar } from "../components/UserAvatar";
import {
  Building2,
  CheckCircle,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Shield,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  Users,
} from "lucide-react";
import {
  fetchActiveDaos,
  fetchWalletDaoRoles,
  fetchYieldRows,
  formatUsdcAmount,
  type OnchainDao,
  type WalletDaoRoleRow,
  type YieldRow,
} from "../utils/localDaoContracts";
import { maskAddress } from "../utils/address";
import { copyText } from "../utils/clipboard";
import { getAddressExplorerUrl } from "../utils/explorer";
import { uploadImageToIpfs } from "../utils/ipfs";
import {
  PROFILE_AVATAR_CHANGED_EVENT,
  clearStoredProfileAvatarUrl,
  getStoredProfileAvatarUrl,
  setStoredProfileAvatarUrl,
} from "../utils/profileAvatar";
import { getAccountDisplayName, getAccountInitial } from "../utils/userDisplay";
import { formatTxError } from "../utils/toast";
import { APP_CHAIN_NAME } from "../utils/contract";
import { getChainName } from "../utils/chainUtils";

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

  const connectedEth = wallets.find((w) => w.type === "ethereum") as { chainId?: string } | undefined;
  const linkedEth = user?.linkedAccounts?.find(
    (a) => a.type === "wallet" && "chainType" in a && a.chainType === "ethereum",
  ) as { chainId?: string } | undefined;
  const walletChainLabel = connectedEth?.chainId
    ? getChainName(connectedEth.chainId)
    : linkedEth?.chainId
      ? getChainName(linkedEth.chainId)
      : null;

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

  const { verifiedMemberships, pendingKyc } = useMemo(() => {
    let v = 0;
    let p = 0;
    for (const r of roleRows) {
      if (r.isVerifiedMember) v += 1;
      else if (r.isListedMember) p += 1;
    }
    return { verifiedMemberships: v, pendingKyc: p };
  }, [roleRows]);

  const yieldByDaoAddress = useMemo(() => {
    const m: Record<string, YieldRow[]> = {};
    for (const y of yields) {
      const k = y.daoAddress.toLowerCase();
      (m[k] ??= []).push(y);
    }
    return m;
  }, [yields]);

  const sortedCommunities = useMemo(
    () =>
      [...roleRows].sort((a, b) =>
        a.daoName.localeCompare(b.daoName, undefined, { sensitivity: "base" }),
      ),
    [roleRows],
  );

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
      <Card className="p-4 sm:p-8 overflow-hidden relative">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={onPickAvatar}
        />
        <div className="absolute right-4 top-4 sm:right-8 sm:top-8 flex flex-col items-end gap-1 text-right">
          <Badge variant="success" className="shrink-0">
            <CheckCircle className="w-3 h-3 mr-1" />
            Authenticated
          </Badge>
          <p className="text-[10px] text-slate-500 flex items-center gap-1 justify-end max-w-[10rem] leading-tight">
            <Globe className="w-3 h-3 text-emerald-500 shrink-0" />
            App: {APP_CHAIN_NAME}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start gap-6 pr-24 sm:pr-32">
          <div className="flex items-start gap-4 sm:gap-5 shrink-0">
            <UserAvatar imageUrl={profileAvatarUrl} initials={accountInitial} size={88} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">{displayName}</h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <Mail className="w-4 h-4 shrink-0 opacity-60" />
              {user?.email?.address ?? "No email linked"}
            </p>
            {walletChainLabel && walletAddress ? (
              <p className="text-xs text-slate-400 mt-2">Wallet network: {walletChainLabel}</p>
            ) : null}
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
              <p className="text-xs text-slate-400 mt-3">Connect an Ethereum wallet to see your DAO memberships.</p>
            )}
            {!pinataConfigured() ? (
              <p className="text-xs text-amber-700 mt-2 max-w-lg">
                Set <span className="font-mono">VITE_PINATA_JWT</span> to enable photo uploads. Photos go to IPFS; the
                URL is stored in this browser per wallet.
              </p>
            ) : walletAddress ? (
              <p className="text-xs text-slate-400 mt-2 max-w-lg">
                Avatar appears in the sidebar, header, and community chat. Stored locally for this device only.
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {!walletAddress ? (
        <Card className="p-6 border-amber-100 bg-amber-50/80">
          <p className="text-sm text-amber-900 font-medium">Connect your wallet to load on-chain memberships and yield.</p>
        </Card>
      ) : loading ? (
        <Card className="p-8">
          <p className="text-slate-500 text-sm">Loading your on-chain profile…</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard
              label="Your DAOs"
              value={String(roleRows.length)}
              sublabel={
                daos.length ? `${daos.length} active on ${APP_CHAIN_NAME}` : "No DAO index from factory"
              }
            />
            <MetricCard label="Verified memberships" value={String(verifiedMemberships)} />
            <MetricCard label="Awaiting KYC" value={String(pendingKyc)} />
            <MetricCard label="Claimable yield" value={formatUsdcAmount(totalYield)} />
          </div>

          <Card className="p-4 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
              <div>
                <div className="flex items-center gap-2 text-emerald-700 mb-1">
                  <Building2 className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Memberships</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">Your DAO communities</h2>
                <p className="text-sm text-slate-500 mt-1 max-w-xl">
                  DAOs where you are creator, admin, finance lead, verified member, or on the roster pending KYC
                  verification.
                </p>
              </div>
            </div>

            {sortedCommunities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-600 font-medium">No DAO memberships yet for this wallet.</p>
                <p className="text-xs text-slate-500 mt-2">
                  Ask a DAO admin to add your address, complete KYC in the app, or create a DAO from the dashboard.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-1">
                {sortedCommunities.map((row) => {
                  const yRows = yieldByDaoAddress[row.daoAddress.toLowerCase()] ?? [];
                  const claimableDao = yRows.reduce((s, r) => s + r.claimable, 0n);
                  return (
                    <div
                      key={row.daoAddress}
                      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:border-emerald-200/80 transition-colors"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <h3 className="text-lg font-bold text-slate-900">{row.daoName}</h3>
                          <p className="text-sm text-slate-500 flex items-start gap-2">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{row.location || "Location not set"}</span>
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                              TVL {row.tvlFormatted}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {row.memberCount} members
                            </span>
                            {claimableDao > 0n ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                Claimable {formatUsdcAmount(claimableDao)}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <code className="text-[11px] bg-slate-100 px-2 py-1 rounded-lg font-mono text-slate-700">
                              {maskAddress(row.daoAddress)}
                            </code>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                              onClick={() => void copyText(row.daoAddress)}
                              aria-label="Copy DAO address"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <a
                              href={getAddressExplorerUrl(row.daoAddress)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
                            >
                              Contract explorer <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <RoleTags
                            isCreator={row.isCreator}
                            isAdmin={row.isAdmin}
                            isFinanceManager={row.isFinanceManager}
                            isVerifiedMember={row.isVerifiedMember}
                            isListedMember={row.isListedMember}
                            className="pt-2"
                          />
                        </div>
                      </div>
                      {yRows.length > 0 ? (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                            Your yield positions here
                          </p>
                          <ul className="space-y-2">
                            {yRows.map((y) => (
                              <li
                                key={`${y.daoAddress}-${y.investmentId}`}
                                className="flex flex-wrap justify-between gap-2 text-sm bg-slate-50 rounded-xl px-3 py-2"
                              >
                                <span className="text-slate-800 font-medium truncate min-w-0">{y.investmentName}</span>
                                <span className="text-slate-600 tabular-nums shrink-0">
                                  Claimable{" "}
                                  <span className="font-bold text-emerald-700">{formatUsdcAmount(y.claimable)}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {yields.length > 0 && (
            <Card className="p-4 sm:p-8">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Yield summary</h2>
              <p className="text-sm text-slate-500 mb-4">
                Investments where you have staked votes or claims. Totals mirror the Yields screen.
              </p>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[320px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-widest text-slate-400">
                      <th className="pb-2 pr-3 font-bold">DAO</th>
                      <th className="pb-2 pr-3 font-bold">Investment</th>
                      <th className="pb-2 pr-3 font-bold">Claimable</th>
                      <th className="pb-2 font-bold">Distributed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yields.map((y) => (
                      <tr key={`${y.daoAddress}-${y.investmentId}`} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 pr-3 text-slate-700 font-medium">{y.daoName}</td>
                        <td className="py-2.5 pr-3 text-slate-600">{y.investmentName}</td>
                        <td className="py-2.5 pr-3 text-emerald-700 font-semibold tabular-nums">
                          {formatUsdcAmount(y.claimable)}
                        </td>
                        <td className="py-2.5 text-slate-500 tabular-nums">{formatUsdcAmount(y.distributed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="p-4 sm:p-8">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Connected wallet</h2>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-3 bg-white rounded-xl shadow-sm shrink-0">
                      <Wallet className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Address</p>
                      <p className="text-sm font-mono font-bold text-slate-900 break-all">{walletAddress}</p>
                      <p className="text-xs text-slate-500 mt-1">{maskAddress(walletAddress)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      className="p-2 rounded-lg border border-slate-200 hover:bg-white"
                      onClick={() => void copyText(walletAddress)}
                      aria-label="Copy wallet address"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      className="p-2 rounded-lg border border-slate-200 hover:bg-white"
                      target="_blank"
                      rel="noreferrer"
                      href={getAddressExplorerUrl(walletAddress)}
                      aria-label="View on explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-slate-400" />
                  <h2 className="text-lg font-bold text-slate-900">Security</h2>
                </div>
                <ul className="text-sm text-slate-600 space-y-3 list-disc list-inside">
                  <li>Sign-in and recovery are handled by Privy.</li>
                  <li>
                    DAO permissions and member rosters live on-chain on <strong>{APP_CHAIN_NAME}</strong>.
                  </li>
                  <li>Profile photos use IPFS; only the gateway URL is kept in this browser.</li>
                </ul>
              </Card>

              <Card className="p-6 space-y-3">
                <a
                  href="/whitepaper.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-left text-sm font-medium text-slate-700 flex items-center gap-2 py-2 rounded-xl hover:bg-slate-50 px-2 -mx-2"
                >
                  <Globe className="w-4 h-4 shrink-0" /> Whitepaper
                </a>
                <p className="text-xs text-slate-500 pl-7">Product details and DAO mechanics.</p>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProfileView;
