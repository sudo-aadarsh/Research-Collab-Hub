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
export const useUIStore = create(
  persist(
    (set, get) => ({
      sidebarOpen:   true,
      activeModule:  'dashboard',
      notifications: [],
      unreadCount:   0,
      darkMode:      false,

      toggleSidebar:   () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setActiveModule: (mod) => set({ activeModule: mod }),
      toggleDarkMode:  () => set((s) => {
        const next = !s.darkMode;
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { darkMode: next };
      }),

      /**
       * Add a new notification.
       * @param {{ type: 'paper'|'project'|'collab'|'system', title: string, message: string, icon?: string }} n
       */
      addNotification: (n) => set((s) => ({
        notifications: [
          { ...n, id: Date.now(), timestamp: new Date().toISOString(), read: false },
          ...s.notifications.slice(0, 49), // keep last 50
        ],
        unreadCount: s.unreadCount + 1,
      })),

      markAllRead: () => set((s) => ({
        notifications: s.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      })),

      markRead: (id) => set((s) => ({
        notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
        unreadCount: Math.max(0, s.unreadCount - (s.notifications.find(n => n.id === id)?.read ? 0 : 1)),
      })),

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: 'ui-store',
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        darkMode: state.darkMode,
      }),
    }
  )
);

// ── Saved Store ───────────────────────────────────────────────────────────
export const useSavedStore = create(
  persist(
    (set, get) => ({
      savedPapers:   [],
      savedProjects: [],

      savePaper: (paper) => set((state) => {
        const exists = state.savedPapers.some(p => p.id === paper.id);
        if (exists) return state;
        return { savedPapers: [...state.savedPapers, { ...paper, savedAt: new Date().toISOString() }] };
      }),

      unsavePaper: (paperId) => set((state) => ({
        savedPapers: state.savedPapers.filter(p => p.id !== paperId),
      })),

      isSavedPaper: (paperId) => {
        return get().savedPapers.some(p => p.id === paperId);
      },

      saveProject: (project) => set((state) => {
        const exists = state.savedProjects.some(p => p.id === project.id);
        if (exists) return state;
        return { savedProjects: [...state.savedProjects, { ...project, savedAt: new Date().toISOString() }] };
      }),

      unsaveProject: (projectId) => set((state) => ({
        savedProjects: state.savedProjects.filter(p => p.id !== projectId),
      })),

      isSavedProject: (projectId) => {
        return get().savedProjects.some(p => p.id === projectId);
      },

      clearAllSaved: () => set({ savedPapers: [], savedProjects: [] }),
    }),
    {
      name: 'saved-store',
      partialize: (state) => ({ savedPapers: state.savedPapers, savedProjects: state.savedProjects }),
    }
  )
);
