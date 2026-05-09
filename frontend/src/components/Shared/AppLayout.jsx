/**
 * components/Shared/AppLayout.jsx
 * Persistent sidebar + top bar that wraps all authenticated pages.
 */
import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, FolderKanban, Users, BookMarked,
  TrendingUp, Bell, User, LogOut, Menu, X, ChevronRight, Sparkles, Bookmark,
  CheckCheck, Trash2, FileUp, FolderPlus, UserCheck, UserX, Info, Sun, Moon
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../../store';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/papers',        icon: FileText,         label: 'Papers'         },
  { to: '/projects',      icon: FolderKanban,     label: 'Projects'       },
  { to: '/saved',         icon: Bookmark,         label: 'Saved'          },
  { to: '/collaborations',icon: Users,            label: 'Collaborations' },
  { to: '/conferences',   icon: BookMarked,        label: 'Venues'         },
  { to: '/trends',        icon: TrendingUp,        label: 'AI Trends'      },
];

const TYPE_ICON = {
  paper:   { icon: FileText,   color: 'text-indigo-500', bg: 'bg-indigo-50' },
  project: { icon: FolderPlus, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  collab:  { icon: UserCheck,  color: 'text-amber-500',  bg: 'bg-amber-50'  },
  system:  { icon: Info,       color: 'text-slate-500',  bg: 'bg-slate-50'  },
};

function NotificationPanel({ onClose }) {
  const { notifications, markAllRead, markRead, clearNotifications } = useUIStore();

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
        <h3 className="font-semibold text-sm">Notifications</h3>
        <div className="flex gap-1">
          {notifications.length > 0 && (
            <>
              <button onClick={markAllRead}
                className="p-1.5 rounded hover:bg-white/10 transition text-xs flex items-center gap-1 text-slate-300 hover:text-white"
                title="Mark all read">
                <CheckCheck size={14} /> All read
              </button>
              <button onClick={clearNotifications}
                className="p-1.5 rounded hover:bg-white/10 transition text-slate-300 hover:text-red-300"
                title="Clear all">
                <Trash2 size={14} />
              </button>
            </>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 transition">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Bell size={28} className="text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No notifications yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Activity will appear here</p>
          </div>
        ) : (
          notifications.map((n) => {
            const meta = TYPE_ICON[n.type] || TYPE_ICON.system;
            const Icon = meta.icon;
            return (
              <div key={n.id}
                onClick={() => markRead(n.id)}
                className={clsx(
                  'flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40',
                  !n.read && 'bg-indigo-50/40 dark:bg-indigo-950/20'
                )}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${meta.bg} dark:bg-slate-800`}>
                  <Icon size={14} className={meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx('text-sm leading-snug', !n.read ? 'font-semibold text-slate-800 dark:text-slate-200' : 'font-medium text-slate-700 dark:text-slate-300')}>
                    {n.title}
                  </p>
                  {n.message && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>}
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                  </p>
                </div>
                {!n.read && (
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout }        = useAuthStore();
  const { sidebarOpen, toggleSidebar, unreadCount, darkMode, toggleDarkMode } = useUIStore();
  const navigate                = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const handleLogout = () => { logout(); navigate('/login'); };

  // Close notification panel on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside className={clsx(
        'flex flex-col bg-slate-900 text-white transition-all duration-300 shrink-0',
        sidebarOpen ? 'w-60' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
          <div className="p-1.5 bg-indigo-600 rounded-lg shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-sm leading-tight">
              Research<br/>
              <span className="text-indigo-400">Collab Hub</span>
            </span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )
            }>
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
              {sidebarOpen && (
                <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
              )}
            </NavLink>
          ))}
        </nav>

        {/* User area */}
        <div className="border-t border-slate-700 p-3">
          <NavLink to="/profile" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 text-xs font-bold">
              {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-white truncate">{user?.full_name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.institution}</p>
              </div>
            )}
          </NavLink>
          <button onClick={handleLogout}
            className="mt-1 flex items-center gap-3 w-full px-2 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors text-sm">
            <LogOut size={16} className="shrink-0" />
            {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-14 flex items-center justify-between px-4 shrink-0 transition-colors">
          <div className="flex items-center gap-2">
            <button onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Switcher */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all duration-300 transform active:scale-95"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? (
                <Sun size={20} className="text-amber-400 animate-pulse" />
              ) : (
                <Moon size={20} className="text-indigo-500 hover:text-indigo-600" />
              )}
            </button>

            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(o => !o)}
                className="relative p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center leading-none font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
            </div>

            <NavLink to="/profile"
              className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold hover:bg-indigo-600 transition-colors">
              {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


