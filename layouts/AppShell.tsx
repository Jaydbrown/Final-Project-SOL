
import React, { useEffect, useMemo, useState } from 'react';
import { Compass, MessageSquare, User, Bell, LayoutDashboard, Menu, X, Shield, Globe, CheckCircle, Wallet, House, LogOut, UserPlus, Coins, ArrowLeft } from 'lucide-react';
import type { ViewState } from '../App';
import { useWallets, type User as PrivyUser } from '@privy-io/react-auth';
import { getChainName } from '../utils/chainUtils';
import { fetchActiveDaos, fetchAllInvestments, fetchYieldRows, formatUsdcAmount, statusLabel, type OnchainDao } from '../utils/localDaoContracts';
import { loadDaoChatMessages, subscribeDaoChat } from '../utils/daoChat';
import { Button, Modal } from '../components/UI';
import { APP_CHAIN_NAME } from '../utils/contract';

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
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; subtitle: string; view: ViewState }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [trackedDaoAddresses, setTrackedDaoAddresses] = useState<string[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
      let total = 0;
      daoAddresses.forEach((address, idx) => {
        const seenAt = lastSeen[address] ?? 0;
        total += messageSets[idx].filter((msg) => msg.createdAt > seenAt).length;
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
  const rawChainName = connectedEthWallet?.chainId ? getChainName(connectedEthWallet.chainId) : getChainName(ethWallet?.chainId);
  const isWalletConnected = Boolean(walletAddress);
  const effectiveChainName = isWalletConnected && rawChainName === 'Not Connected' ? APP_CHAIN_NAME : rawChainName;
  const sidebarConnectionLabel = isWalletConnected ? `Connected • ${effectiveChainName}` : 'Not Connected';

  const refreshNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const [investments, yields] = await Promise.all([
        fetchAllInvestments(),
        fetchYieldRows(walletAddress as `0x${string}` | undefined),
      ]);
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
      setNotifications([...investmentItems, ...yieldItems]);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    void refreshUnread();
  }, []);

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

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex">
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
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">
                {user?.email?.address ? user.email.address.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user?.email?.address || 'User'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {walletAddress
                    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                    : 'No wallet'}
                </p>
              </div>
            </div>
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
          <div className="flex items-center gap-2 lg:gap-4">
            <button
              onClick={() => onViewChange('landing')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-xs sm:text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Home
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
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
              </button>
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-50">
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
                      <p className="text-sm text-slate-500 p-3">No new notifications.</p>
                    ) : (
                      notifications.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
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
            <div className="hidden sm:flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-full border border-slate-200 cursor-pointer" onClick={() => onViewChange('wallet')}>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-mono text-slate-600">
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : 'No wallet'}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-grow overflow-auto p-4 lg:p-8">
          {children}
        </main>

        <nav className="lg:hidden h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 pb-safe">
          {navItems.slice(0, 5).map(item => {
            const isActive = currentView === item.id;
            const Icon = item.icon;
            return (
              <button 
                key={item.id} 
                onClick={() => onViewChange(item.id)}
                className={`flex flex-col items-center gap-1 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white p-6 shadow-2xl flex flex-col">
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
