import React, { useState, useEffect } from 'react';
import { Mail, Bell, BellOff, Check, AlertCircle } from 'lucide-react';

interface GmailNotificationSettingsProps {
  walletAddress: string;
  daoAddress: string;
  daoName: string;
  onSubscriptionChange?: (isSubscribed: boolean) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export const GmailNotificationSettings: React.FC<GmailNotificationSettingsProps> = ({
  walletAddress,
  daoAddress,
  daoName,
  onSubscriptionChange
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) {
      checkGmailConnection();
      checkSubscription();
    }
  }, [walletAddress, daoAddress]);

  const checkGmailConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/preferences/${walletAddress}`);
      const data = await response.json();
      setIsConnected(!!data.gmailConnected);
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
    }
  };

  const checkSubscription = async () => {
    try {
      // FIXED: Correct endpoint - removed '/notifications'
      const response = await fetch(`${BACKEND_URL}/api/chat/subscriptions/${walletAddress}`);
      const subs = await response.json();
      const daoSub = subs.find((s: any) => s.daoAddress === daoAddress.toLowerCase());
      const subscribed = daoSub?.receiveNotifications || false;
      setIsSubscribed(subscribed);
      onSubscriptionChange?.(subscribed);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const connectGmail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/gmail/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });
      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No URL returned');
      }
    } catch (error) {
      console.error('Error connecting Gmail:', error);
      setError('Failed to connect Gmail. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubscription = async () => {
    setLoading(true);
    setError(null);
    try {
      // FIXED: Correct endpoint - removed '/notifications'
      const response = await fetch(`${BACKEND_URL}/api/chat/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          daoAddress: daoAddress.toLowerCase(),
          receiveNotifications: !isSubscribed
        })
      });
      
      if (response.ok) {
        const newStatus = !isSubscribed;
        setIsSubscribed(newStatus);
        onSubscriptionChange?.(newStatus);
        // Show success message (you can replace with your toast notification)
        console.log(newStatus ? 'Email notifications enabled!' : 'Email notifications disabled');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update preferences');
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      setError('Failed to update notification preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-2 rounded-lg hover:bg-slate-100 transition"
        title={isSubscribed ? "Email notifications enabled" : "Email notifications disabled"}
      >
        {isSubscribed ? (
          <Bell className="w-4 h-4 text-emerald-600" />
        ) : (
          <BellOff className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {showSettings && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowSettings(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-600" />
                Email Notifications
              </h4>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            )}

            {!isConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Get email notifications when someone messages in <strong>{daoName}</strong>
                </p>
                <button
                  onClick={connectGmail}
                  disabled={loading}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {loading ? 'Connecting...' : 'Connect Gmail Account'}
                </button>
                <p className="text-xs text-slate-500 text-center">
                  We'll only send chat notifications for DAOs you join
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Receive notifications for {daoName}</span>
                  <button
                    onClick={toggleSubscription}
                    disabled={loading}
                    className={`px-3 py-1 rounded-full text-sm transition ${
                      isSubscribed
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isSubscribed ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" /> Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <BellOff className="w-3 h-3" /> Disabled
                      </span>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {isSubscribed 
                    ? "📧 You'll receive email notifications for new messages in this DAO"
                    : "🔕 Click enable to get email notifications when someone messages"}
                </p>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    ✓ Gmail connected
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};