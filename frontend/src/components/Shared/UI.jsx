/**
 * components/Shared/UI.jsx
 * Reusable design-system primitives used across all feature modules.
 */
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-xl border border-slate-200 shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={clsx('px-5 py-4 border-b border-slate-100', className)}>{children}</div>;
}

export function CardBody({ children, className = '' }) {
  return <div className={clsx('px-5 py-4', className)}>{children}</div>;
}

// ── Button ────────────────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary:   'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400',
  danger:    'bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-400',
  ghost:     'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-300',
  success:   'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
};
const BTN_SIZES = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  children, variant = 'primary', size = 'md',
  loading = false, disabled = false, className = '',
  icon: Icon, iconRight, onClick, type = 'button', ...rest
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center gap-2 font-medium rounded-lg',
        'focus:outline-none focus:ring-2 focus:ring-offset-1',
        'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {!loading && Icon && <Icon size={14} />}
      {children}
      {iconRight && <span className="ml-1">{iconRight}</span>}
    </button>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────
const BADGE_COLORS = {
  default:   'bg-slate-100 text-slate-700',
  indigo:    'bg-indigo-100 text-indigo-700',
  green:     'bg-emerald-100 text-emerald-700',
  yellow:    'bg-amber-100 text-amber-700',
  red:       'bg-red-100 text-red-700',
  blue:      'bg-blue-100 text-blue-700',
  purple:    'bg-purple-100 text-purple-700',
  orange:    'bg-orange-100 text-orange-700',
};

export function Badge({ children, color = 'default', className = '' }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      BADGE_COLORS[color], className
    )}>
      {children}
    </span>
  );
}

// ── Paper / Project status badge ──────────────────────────────────────────
const STATUS_MAP = {
  draft:      { color: 'default',  label: 'Draft'      },
  in_review:  { color: 'yellow',   label: 'In Review'  },
  submitted:  { color: 'blue',     label: 'Submitted'  },
  accepted:   { color: 'green',    label: 'Accepted'   },
  rejected:   { color: 'red',      label: 'Rejected'   },
  published:  { color: 'purple',   label: 'Published'  },
  planning:   { color: 'default',  label: 'Planning'   },
  active:     { color: 'green',    label: 'Active'     },
  on_hold:    { color: 'yellow',   label: 'On Hold'    },
  completed:  { color: 'indigo',   label: 'Completed'  },
  cancelled:  { color: 'red',      label: 'Cancelled'  },
};

export function StatusBadge({ status }) {
  const { color, label } = STATUS_MAP[status] || { color: 'default', label: status };
  return <Badge color={color}>{label}</Badge>;
}

// ── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({ size = 20, className = '' }) {
  return <Loader2 size={size} className={clsx('animate-spin text-indigo-500', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-48">
      <Spinner size={32} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Icon size={24} className="text-slate-400" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────
export function SectionTitle({ children, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{children}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <input
        className={clsx(
          'w-full rounded-lg border px-3 py-2 text-sm bg-white',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'placeholder:text-slate-400',
          error ? 'border-red-400' : 'border-slate-300',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────
export function Textarea({ label, error, className = '', rows = 4, ...props }) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <textarea
        rows={rows}
        className={clsx(
          'w-full rounded-lg border px-3 py-2 text-sm bg-white resize-y',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'placeholder:text-slate-400',
          error ? 'border-red-400' : 'border-slate-300',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────
export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <select
        className={clsx(
          'w-full rounded-lg border px-3 py-2 text-sm bg-white',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          error ? 'border-red-400' : 'border-slate-300',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative bg-white rounded-2xl shadow-2xl w-full', maxWidth)}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            <button onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'indigo', showLabel = false }) {
  const pct = Math.min(Math.round((value / max) * 100), 100);
  const colorMap = { indigo: 'bg-indigo-500', green: 'bg-emerald-500', amber: 'bg-amber-500' };
  return (
    <div className="w-full">
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', colorMap[color] || colorMap.indigo)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-slate-500 mt-1">{pct}%</span>}
    </div>
  );
}

// ── AI result container ───────────────────────────────────────────────────
export function AIResultBox({ children, loading, title = '✨ AI Analysis' }) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
      <p className="text-xs font-semibold text-indigo-600 mb-3 uppercase tracking-wide">{title}</p>
      {loading
        ? <div className="flex items-center gap-2 text-sm text-indigo-500"><Spinner size={16} />Generating...</div>
        : children
      }
    </div>
  );
}
