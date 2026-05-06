/**
 * components/Shared/AppLayout.jsx
 * Persistent sidebar + top bar that wraps all authenticated pages.
 */
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, FolderKanban, Users, BookMarked,
  TrendingUp, Bell, User, LogOut, Menu, X, ChevronRight, Sparkles,
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../../store';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/papers',        icon: FileText,         label: 'Papers'         },
  { to: '/projects',      icon: FolderKanban,     label: 'Projects'       },
  { to: '/collaborations',icon: Users,            label: 'Collaborations' },
  { to: '/conferences',   icon: BookMarked,        label: 'Venues'         },
  { to: '/trends',        icon: TrendingUp,        label: 'AI Trends'      },
];

export default function AppLayout() {
  const { user, logout }        = useAuthStore();
  const { sidebarOpen, toggleSidebar, unreadCount } = useUIStore();
  const navigate                = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">

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
        <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 shrink-0">
          <button onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex items-center gap-2">
            <button className="relative p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
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
