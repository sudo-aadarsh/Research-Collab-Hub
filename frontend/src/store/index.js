/**
 * src/store/index.js
 * Zustand global state: auth, notifications, and UI settings.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI, usersAPI } from '../api/client';

// ── Auth Store ────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      isLoading:    false,
      error:        null,

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authAPI.login(username, password);
          localStorage.setItem('access_token',  data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);

          // Fetch full user profile
          const { data: profile } = await usersAPI.getMe();
          set({ user: profile, accessToken: data.access_token, isLoading: false });
          return { success: true };
        } catch (err) {
          const msg = err.response?.data?.detail || 'Login failed';
          set({ error: msg, isLoading: false });
          return { success: false, error: msg };
        }
      },

      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          await authAPI.register(userData);
          set({ isLoading: false });
          return { success: true };
        } catch (err) {
          const msg = err.response?.data?.detail || 'Registration failed';
          set({ error: msg, isLoading: false });
          return { success: false, error: msg };
        }
      },

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, accessToken: null });
      },

      refreshProfile: async () => {
        try {
          const { data } = await usersAPI.getMe();
          set({ user: data });
        } catch {/* silently fail */}
      },

      updateUser: (updates) => set((state) => ({
        user: { ...state.user, ...updates }
      })),
    }),
    {
      name:    'auth-store',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
);

// ── UI Store ──────────────────────────────────────────────────────────────
export const useUIStore = create((set) => ({
  sidebarOpen:   true,
  activeModule:  'dashboard',
  notifications: [],
  unreadCount:   0,

  toggleSidebar:     () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveModule:   (mod) => set({ activeModule: mod }),
  addNotification:   (n) => set((s) => ({
    notifications: [n, ...s.notifications],
    unreadCount:   s.unreadCount + 1,
  })),
  markAllRead:       () => set({ unreadCount: 0 }),
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}));
