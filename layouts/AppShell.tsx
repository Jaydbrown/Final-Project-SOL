
import React, { useEffect, useMemo, useState } from 'react';
import { Compass, MessageSquare, User, Bell, LayoutDashboard, Menu, X, Shield, Globe, CheckCircle, Wallet, House, LogOut, UserPlus, Coins, ArrowLeft } from 'lucide-react';
import type { ViewState } from '../App';
import { useWallets, type User as PrivyUser } from '@privy-io/react-auth';
import { getChainName } from '../utils/chainUtils';
import { fetchActiveDaos, fetchAllInvestments, fetchYieldRows, formatUsdcAmount, statusLabel, type OnchainDao } from '../utils/localDaoContracts';
import {
  loadDaoChatMessages,
  subscribeDaoChat,
  MESSAGES_NAV_DAO_STORAGE_KEY,
} from '../utils/daoChat';
import { Button, Modal } from '../components/UI';
import { APP_CHAIN_NAME } from '../utils/contract';
import { UserAvatar } from '../components/UserAvatar';
import {
  PROFILE_AVATAR_CHANGED_EVENT,
  getStoredProfileAvatarUrl,
  profileAvatarStorageKey,
} from '../utils/profileAvatar';
import {
  formatWalletEncapsulated,
  getAccountDisplayName,
  getAccountInitial,
} from '../utils/userDisplay';

interface AppShellProps {
  children: React.ReactNode;
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  user: PrivyUser | null;
  onLogout: () => void;
}

const AppShell: React.FC<AppShellProps> = ({ children, currentView, onViewChange, user, onLogout }) => {
  const { wallets } = useWallets();
  const connectedEthWallet = wallets.find((wallet) => wallet.type === 'ethereum') as { address?: string; chainId?: string } | undefined;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  type BellNotification = {
    id: string;
    title: string;
    subtitle: string;
    view: ViewState;
    /** When set, opening this item navigates to Messages for this DAO room. */
    daoAddress?: string;
  };
  const [notifications, setNotifications] = useState<BellNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [trackedDaoAddresses, setTrackedDaoAddresses] = useState<string[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);

  const LAST_SEEN_KEY = 'localdao_chat_last_seen_by_room';

  const readLastSeen = (): Record<string, number> => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(LAST_SEEN_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, number>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeLastSeen = (value: Record<string, number>) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(value));
  };

  const refreshUnread = async () => {
    try {
      const daos = await fetchActiveDaos();
      const daoAddresses = daos.map((dao) => dao.address.toLowerCase());
      setTrackedDaoAddresses(daoAddresses);
      const lastSeen = readLastSeen();
      const messageSets = await Promise.all(daoAddresses.map((address) => loadDaoChatMessages(address, 300)));
      const self = walletAddress?.toLowerCase() ?? "";
      let total = 0;
      daoAddresses.forEach((address, idx) => {
        const seenAt = lastSeen[address] ?? 0;
        total += messageSets[idx].filter((msg) => {
          if (msg.createdAt <= seenAt) return false;
          if (!self) return false;
          return msg.senderWallet.toLowerCase() !== self;
        }).length;
      });
      setUnreadCount(total);
    } catch {
      setUnreadCount(0);
    }
  };

  const markAllChatAsRead = async () => {
    try {
      const daos = await fetchActiveDaos();
      const daoAddresses = daos.map((dao) => dao.address.toLowerCase());
      const messagesByDao = await Promise.all(daoAddresses.map((address) => loadDaoChatMessages(address, 300)));
      const lastSeen = readLastSeen();
      daoAddresses.forEach((address, idx) => {
        const lastMessage = messagesByDao[idx][messagesByDao[idx].length - 1];
        lastSeen[address] = lastMessage?.createdAt ?? Date.now();
      });
      writeLastSeen(lastSeen);
      setUnreadCount(0);
    } catch {
      // no-op
    }
  };

  // Get the Ethereum wallet's chain ID from linked accounts
  const ethWallet = user?.linkedAccounts?.find(
    (account) => account.type === 'wallet' && 'chainType' in account && account.chainType === 'ethereum'
  ) as { chainId?: string; address?: string } | undefined;
  const walletAddress = (connectedEthWallet?.address || ethWallet?.address) as `0x${string}` | undefined;
  const accountDisplayName = useMemo(
    () => getAccountDisplayName(user, walletAddress ?? ""),
    [user, walletAddress],
  );
  const accountInitial = useMemo(
    () => getAccountInitial(accountDisplayName, user?.email?.address),
    [accountDisplayName, user?.email?.address],
  );

  useEffect(() => {
    if (!walletAddress) {
      setProfileAvatarUrl(null);
      return;
    }
    setProfileAvatarUrl(getStoredProfileAvatarUrl(walletAddress));

    const onAvatarEvent = (ev: Event) => {
      const w = (ev as CustomEvent<{ wallet?: string }>).detail?.wallet;
      if (w && walletAddress && w === walletAddress.toLowerCase()) {
        setProfileAvatarUrl(getStoredProfileAvatarUrl(walletAddress));
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (!walletAddress || e.key !== profileAvatarStorageKey(walletAddress)) {
        return;
      }
      setProfileAvatarUrl(getStoredProfileAvatarUrl(walletAddress));
    };
    window.addEventListener(PROFILE_AVATAR_CHANGED_EVENT, onAvatarEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PROFILE_AVATAR_CHANGED_EVENT, onAvatarEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, [walletAddress]);

  const rawChainName = connectedEthWallet?.chainId ? getChainName(connectedEthWallet.chainId) : getChainName(ethWallet?.chainId);
  const isWalletConnected = Boolean(walletAddress);
  const effectiveChainName = isWalletConnected && rawChainName === 'Not Connected' ? APP_CHAIN_NAME : rawChainName;
  const sidebarConnectionLabel = isWalletConnected ? `Connected • ${effectiveChainName}` : 'Not Connected';

  const refreshNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const [investments, yields, daos] = await Promise.all([
        fetchAllInvestments(),
        fetchYieldRows(walletAddress as `0x${string}` | undefined),
        fetchActiveDaos(),
      ]);
      const lastSeenMap = readLastSeen();
      const self = walletAddress?.toLowerCase() ?? "";
      const chatRows: Array<BellNotification & { _ts: number }> = [];
      for (const dao of daos) {
        if (!self) break;
        const addr = dao.address.toLowerCase();
        const msgs = await loadDaoChatMessages(addr, 150);
        const seen = lastSeenMap[addr] ?? 0;
        const incoming = msgs.filter(
          (m) => m.createdAt > seen && m.senderWallet.toLowerCase() !== self,
        );
        if (incoming.length === 0) continue;
        const latest = incoming[incoming.length - 1]!;
        const textPreview = latest.content.trim().slice(0, 72) + (latest.content.trim().length > 72 ? "…" : "");
        const preview = latest.attachmentUrl?.trim()
          ? textPreview
            ? `📷 ${textPreview}`
            : "📷 Photo shared"
          : textPreview || "New message";
        chatRows.push({
          id: `chat-${addr}-${latest.id}`,
          title: `Messages · ${dao.name}`,
          subtitle:
            incoming.length > 1
              ? `${incoming.length} new · ${preview}`
              : `${latest.senderLabel}: ${preview}`,
          view: "messages",
          daoAddress: dao.address,
          _ts: latest.createdAt,
        });
      }
      chatRows.sort((a, b) => b._ts - a._ts);
      const chatItems: BellNotification[] = chatRows.map(({ _ts: _t, ...rest }) => rest);

      const investmentItems = investments
        .filter((item) => item.status === 0)
        .slice(0, 4)
        .map((item) => ({
          id: `proposal-${item.daoAddress}-${item.id}`,
          title: `Vote needed: ${item.name}`,
          subtitle: `${item.daoName} • ${statusLabel(item.status)}`,
          view: 'investments' as ViewState,
        }));
      const yieldItems = yields
        .filter((item) => item.claimable > 0n)
        .slice(0, 4)
        .map((item) => ({
          id: `yield-${item.daoAddress}-${item.investmentId}`,
          title: `Claim available: ${item.investmentName}`,
          subtitle: `${item.daoName} • ${formatUsdcAmount(item.claimable)} claimable`,
          view: 'yields' as ViewState,
        }));
      setNotifications([...chatItems, ...investmentItems, ...yieldItems]);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    void refreshUnread();
  }, [walletAddress]);

  useEffect(() => {
    if (isNotificationsOpen) {
      void refreshNotifications();
    }
  }, [isNotificationsOpen, walletAddress]);

  useEffect(() => {
    if (currentView === 'messages') {
      void markAllChatAsRead();
    } else {
      void refreshUnread();
    }
  }, [currentView]);

  useEffect(() => {
    if (trackedDaoAddresses.length === 0) return;
    const unsubs = trackedDaoAddresses.map((address) =>
      subscribeDaoChat(address, () => {
        if (currentView === 'messages') {
          void markAllChatAsRead();
        } else {
          void refreshUnread();
        }
      }),
    );
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [trackedDaoAddresses, currentView]);

  const navItems = useMemo(() => [
    { id: 'dashboard' as ViewState, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'discover' as ViewState, label: 'Discover DAOs', icon: Compass },
    { id: 'investments' as ViewState, label: 'Neighborhoods', icon: House },
    { id: 'wallet' as ViewState, label: 'My Wallet', icon: Wallet },
    { id: 'yields' as ViewState, label: 'Yields', icon: Coins },
    { id: 'kyc' as ViewState, label: 'KYC / Admin', icon: UserPlus },
    { id: 'messages' as ViewState, label: 'Messages', icon: MessageSquare, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'profile' as ViewState, label: 'Profile', icon: User },
  ], [unreadCount]);

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = currentView === item.id;
    const Icon = item.icon;
    return (
      <button
        onClick={() => {
          onViewChange(item.id);
          setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
          isActive 
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 font-semibold' 
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
        <span className="flex-grow text-left text-sm">{item.label}</span>
        {item.badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-white text-emerald-600' : 'bg-red-500 text-white'}`}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const dockLabel: Record<ViewState, string> = {
    dashboard: 'Home',
    discover: 'Explore',
    investments: 'Hoods',
    wallet: 'Wallet',
    yields: 'Yield',
    kyc: 'Admin',
    messages: 'Chat',
    profile: 'Profile',
    'create-dao': 'Create',
    'vote-proposal': 'Vote',
    landing: 'Home',
    'my-daos': 'DAOs',
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FDFBF7] flex w-full max-w-[100vw] overflow-x-clip">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 sticky top-0 h-screen p-6 overflow-y-auto">
        <div className="flex items-center gap-2 mb-10 cursor-pointer" onClick={() => onViewChange('dashboard')}>
          <div className="navy-bg p-1.5 rounded-lg">
            <Shield className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">LocalDAO</span>
        </div>

        <nav className="flex-grow space-y-2">
          {navItems.map(item => <NavLink key={item.id} item={item} />)}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100 space-y-4">
          <div className="w-full flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-bold">Member Onboarding</span>
            </div>
            <span className="text-[10px] font-bold uppercase">On-chain</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Globe className="w-3 h-3 text-emerald-500" />
              {sidebarConnectionLabel}
            </p>
            <button
              type="button"
              onClick={() => onViewChange("profile")}
              className="flex items-center gap-3 w-full text-left rounded-xl hover:bg-slate-100/80 transition-colors -mx-1 px-1 py-0.5"
            >
              <UserAvatar imageUrl={profileAvatarUrl} initials={accountInitial} size={32} />
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {isWalletConnected ? accountDisplayName : user?.email?.address || "User"}
                </p>
                <p className="text-[10px] text-slate-500 font-mono truncate" title={walletAddress ?? undefined}>
                  {walletAddress ? formatWalletEncapsulated(walletAddress) : "No wallet"}
                </p>
              </div>
            </button>
          </div>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-bold">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0">
        <header className="min-h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-8 sticky top-0 z-40 pt-[env(safe-area-inset-top,0px)]">
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-4 min-w-0">
            <button
              onClick={() => onViewChange('landing')}
              className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-xs sm:text-sm font-semibold shrink-0"
              type="button"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Home</span>
            </button>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 lg:hidden">
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3 lg:gap-6">
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen((current) => !current)}
                className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                aria-label="Toggle notifications"
              >
              <Bell className="w-5 h-5" />
              {(notifications.length > 0 || unreadCount > 0) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
              </button>
              {isNotificationsOpen && (
                <div
                  className="fixed sm:absolute inset-x-3 sm:inset-x-auto top-[calc(4rem+env(safe-area-inset-top,0px))] sm:top-full sm:right-0 left-auto mt-0 sm:mt-2 w-auto sm:w-80 max-w-[min(100vw-1.5rem,20rem)] max-h-[min(24rem,70vh)] sm:max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overscroll-contain"
                >
                  <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900">Notifications</p>
                    <button
                      onClick={() => void refreshNotifications()}
                      className="text-xs font-bold text-emerald-600 hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="p-2">
                    {notificationsLoading ? (
                      <p className="text-sm text-slate-500 p-3">Loading notifications...</p>
                    ) : notifications.length === 0 ? (
                      unreadCount > 0 ? (
                        <div className="p-3">
                          <p className="text-sm text-slate-600">You have unread community messages.</p>
                          <button
                            type="button"
                            onClick={() => {
                              onViewChange("messages");
                              setIsNotificationsOpen(false);
                            }}
                            className="mt-2 text-sm font-bold text-emerald-600 hover:underline"
                          >
                            Open Messages
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 p-3">No new notifications.</p>
                      )
                    ) : (
                      notifications.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.daoAddress?.trim()) {
                              sessionStorage.setItem(
                                MESSAGES_NAV_DAO_STORAGE_KEY,
                                item.daoAddress.trim().toLowerCase(),
                              );
                            }
                            onViewChange(item.view);
                            setIsNotificationsOpen(false);
                          }}
                          className="w-full text-left p-3 rounded-xl hover:bg-slate-50"
                        >
                          <p className="text-sm font-bold text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{item.subtitle}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
            <button
              type="button"
              className="hidden sm:flex items-center gap-2.5 bg-slate-100 pl-2 pr-4 py-1.5 rounded-full border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors max-w-[min(100%,220px)]"
              onClick={() => onViewChange("profile")}
            >
              <UserAvatar imageUrl={profileAvatarUrl} initials={accountInitial} size={28} />
              <div className="min-w-0 flex flex-col items-start">
                <span className="text-xs font-bold text-slate-800 truncate w-full text-left">
                  {walletAddress ? accountDisplayName : "Guest"}
                </span>
                <span className="text-[10px] text-slate-500 font-mono truncate w-full text-left" title={walletAddress ?? undefined}>
                  {walletAddress ? formatWalletEncapsulated(walletAddress) : "No wallet"}
                </span>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-grow overflow-x-clip overflow-y-auto p-3 sm:p-4 lg:p-8 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
          {children}
        </main>

        <nav className="lg:hidden shrink-0 bg-white border-t border-slate-200 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 z-40">
          <div className="flex overflow-x-auto no-scrollbar gap-0.5 px-2 pb-1 items-center justify-start">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  className={`flex flex-col items-center gap-0.5 min-w-[4.125rem] max-w-[4.75rem] px-1 py-2 rounded-xl shrink-0 ${
                    isActive ? 'text-emerald-600 bg-emerald-50/70' : 'text-slate-400'
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-[1.35rem] h-[1.35rem]" />
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="absolute -top-1 -right-2 min-w-4 h-4 px-[3px] flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold leading-none border border-white">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold leading-tight text-center line-clamp-2 w-full px-px">
                    {dockLabel[item.id] ?? item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="absolute left-0 top-0 bottom-0 w-[min(18rem,88vw)] max-w-[20rem] bg-white p-5 sm:p-6 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="navy-bg p-1.5 rounded-lg">
                  <Shield className="text-white w-5 h-5" />
                </div>
                <span className="font-bold text-xl text-slate-900">LocalDAO</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="space-y-2">
              {navItems.map(item => <NavLink key={item.id} item={item} />)}
            </nav>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="mt-auto w-full flex items-center justify-center gap-2 p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-red-100"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-bold">Logout</span>
            </button>
          </div>
        </div>
      )}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Confirm Logout"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowLogoutConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowLogoutConfirm(false);
                onLogout();
              }}
            >
              Logout
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to logout from this device?
        </p>
      </Modal>
    </div>
  );
};

export default AppShell;
