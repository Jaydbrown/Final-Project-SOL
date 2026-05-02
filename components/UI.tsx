
import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';

// 1. Button
export const Button: React.FC<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ variant = 'primary', size = 'md', loading, disabled, onClick, children, className = '' }) => {
  const base = "inline-flex items-center justify-center font-bold transition-all rounded-xl disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "navy-bg text-white shadow-lg shadow-slate-900/10 hover:shadow-xl",
    secondary: "bg-emerald-600 text-white hover:bg-emerald-700",
    outline: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-red-500 text-white hover:bg-red-600",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};

// 2. Card
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}> = ({ children, className = '', interactive, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-3xl border border-slate-200 shadow-sm p-6 ${interactive ? 'hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer' : ''} ${className}`}
  >
    {children}
  </div>
);

// 3. Badge
export const Badge: React.FC<{
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
}> = ({ variant = 'neutral', children, className = '' }) => {
  const variants = {
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    error: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
    neutral: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// 4. Modal
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;
  const content = (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full sm:max-w-lg max-h-[min(92dvh,100vh)] sm:max-h-[min(92dvh,44rem)] flex flex-col bg-white rounded-t-[1.75rem] sm:rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 sm:mb-0 mb-0">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-6 shrink-0 border-b border-slate-100">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight pr-2">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 rounded-full transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0">{children}</div>
        {footer && (
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
};

// 5. ProgressBar
export const ProgressBar: React.FC<{
  value: number;
  max?: number;
  label?: string;
  colorClass?: string;
}> = ({ value, max = 100, label, colorClass = "bg-emerald-500" }) => (
  <div className="space-y-2">
    {label && (
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <span>{Math.round((value / max) * 100)}%</span>
      </div>
    )}
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full transition-all duration-1000 ${colorClass}`} style={{ width: `${(value / max) * 100}%` }}></div>
    </div>
  </div>
);

export const StatusChip: React.FC<{ status: string; className?: string }> = ({ status, className = '' }) => {
  const normalized = status.toLowerCase();
  const tone =
    normalized === 'proposed'
      ? 'warning'
      : normalized === 'active'
        ? 'info'
        : normalized === 'completed'
          ? 'success'
          : 'neutral';
  return (
    <Badge variant={tone} className={className}>
      {status}
    </Badge>
  );
};

export const DeadlineChip: React.FC<{ secondsLeft: number; className?: string }> = ({ secondsLeft, className = '' }) => {
  if (secondsLeft <= 0) {
    return (
      <Badge variant="error" className={className}>
        Expired
      </Badge>
    );
  }
  const daysLeft = Math.ceil(secondsLeft / 86400);
  if (daysLeft <= 3) {
    return (
      <Badge variant="warning" className={className}>
        Ending Soon: {daysLeft}d
      </Badge>
    );
  }
  return (
    <Badge variant="info" className={className}>
      {daysLeft}d Left
    </Badge>
  );
};

export const FundingProgress: React.FC<{ raised: bigint; target: bigint }> = ({ raised, target }) => {
  const pct = target > 0n ? Number((raised * 100n) / target) : 0;
  const safePct = Math.min(Math.max(pct, 0), 100);
  return <ProgressBar value={safePct} max={100} label="Funding Progress" colorClass="bg-emerald-500" />;
};

export const RoleTags: React.FC<{
  isCreator?: boolean;
  isAdmin?: boolean;
  isFinanceManager?: boolean;
  isVerifiedMember?: boolean;
  className?: string;
}> = ({ isCreator, isAdmin, isFinanceManager, isVerifiedMember, className = '' }) => (
  <div className={`flex flex-wrap gap-2 ${className}`}>
    {isCreator && <Badge variant="info">Admin</Badge>}
    {isAdmin && !isCreator && <Badge variant="info">Admin</Badge>}
    {isFinanceManager && <Badge variant="neutral">Finance</Badge>}
    {isVerifiedMember ? <Badge variant="success">KYC Verified</Badge> : <Badge variant="warning">KYC Pending</Badge>}
  </div>
);

export const MetricCard: React.FC<{
  label: string;
  value: string;
  sublabel?: string;
  className?: string;
}> = ({ label, value, sublabel, className = '' }) => (
  <Card className={`p-4 sm:p-6 ${className}`}>
    <p className="text-slate-500 text-sm">{label}</p>
    <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
    {sublabel && <p className="text-xs text-slate-500 mt-1">{sublabel}</p>}
  </Card>
);
