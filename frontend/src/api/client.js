/**
 * src/api/client.js
 *
 * Centralized Axios client with:
 * - Automatic JWT header injection
 * - 401 auto-logout
 * - Typed API methods for every backend module
 */
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ── Axios instance ────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,  // 60s — AI calls can take up to 30s on Gemini free tier
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: inject token ────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: handle 401 ─────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════════
export const authAPI = {
  login:    (username, password) =>
    api.post('/auth/login', new URLSearchParams({ username, password }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),

  register: (data) => api.post('/auth/register', data),
};

// ═══════════════════════════════════════════════════════════════════════════
// Users
// ═══════════════════════════════════════════════════════════════════════════
export const usersAPI = {
  getMe:          ()       => api.get('/users/me'),
  updateMe:       (data)   => api.patch('/users/me', data),
  getUser:        (id)     => api.get(`/users/${id}`),
  listUsers:      (params) => api.get('/users/', { params }),
  addInterest:    (data)   => api.post('/users/me/interests', data),
  removeInterest: (topic)  => api.delete(`/users/me/interests/${encodeURIComponent(topic)}`),
  addSkill:       (data)   => api.post('/users/me/skills', data),
};

// ═══════════════════════════════════════════════════════════════════════════
// Projects
// ═══════════════════════════════════════════════════════════════════════════
export const projectsAPI = {
  create:             (data)                => api.post('/projects/', data),
  list:               (params)              => api.get('/projects/', { params }),
  get:                (id)                  => api.get(`/projects/${id}`),
  update:             (id, data)            => api.patch(`/projects/${id}`, data),
  delete:             (id)                  => api.delete(`/projects/${id}`),
  join:               (id)                  => api.post(`/projects/${id}/join`),
  addMember:          (id, data)            => api.post(`/projects/${id}/members`, data),
  removeMember:       (id, userId)          => api.delete(`/projects/${id}/members/${userId}`),
  createWithFile:     (formData)            => api.post('/projects/upload', formData, { 
    headers: { 'Content-Type': 'multipart/form-data' } 
  }),
  addMilestone:       (id, data)            => api.post(`/projects/${id}/milestones`, data),
  completeMilestone:  (projectId, msId)     => api.patch(`/projects/${projectId}/milestones/${msId}/complete`),
  getMessages:        (id)                  => api.get(`/projects/${id}/messages`),
  postMessage:        (id, data)            => api.post(`/projects/${id}/messages`, data),
  downloadUrl:        (relativePath) => {
    if (!relativePath) return relativePath;
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return relativePath;
    if (relativePath.startsWith('/api/v1')) relativePath = relativePath.replace('/api/v1', '');
    if (relativePath.startsWith('/')) return `${api.defaults.baseURL}${relativePath}`;
    return relativePath;
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Papers
// ═══════════════════════════════════════════════════════════════════════════
export const papersAPI = {
  create:        (data)       => api.post('/papers/', data),
  createWithFile: (formData)  => api.post('/papers/upload', formData, { 
    headers: { 'Content-Type': 'multipart/form-data' } 
  }),
  list:          (params)     => api.get('/papers/', { params }),
  get:           (id)         => api.get(`/papers/${id}`),
  update:        (id, data)   => api.patch(`/papers/${id}`, data),
  delete:        (id)         => api.delete(`/papers/${id}`),
  updateStatus:       (id, status)          => api.patch(`/papers/${id}/status`, { status }),
  addAuthor:          (id, author)          => api.post(`/papers/${id}/authors`, author),
  join:               (id)                  => api.post(`/papers/${id}/join`),
  getMessages:        (id)                  => api.get(`/papers/${id}/messages`),
  postMessage:        (id, data)            => api.post(`/papers/${id}/messages`, data),
  getVersions:   (id)         => api.get(`/papers/${id}/versions`),
  downloadUrl:   (relativePath) => {
    if (!relativePath) return relativePath;
    // If it's already an absolute URL, return as-is
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }
    // If the stored path already contains /api/v1, strip it to avoid duplication
    // (baseURL already includes /api/v1)
    if (relativePath.startsWith('/api/v1')) {
      relativePath = relativePath.replace('/api/v1', '');
    }
    // Prepend with baseURL for relative paths
    if (relativePath.startsWith('/')) {
      return `${api.defaults.baseURL}${relativePath}`;
    }
    return relativePath;
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// References
// ═══════════════════════════════════════════════════════════════════════════
export const referencesAPI = {
  create:          (data)          => api.post('/references', data),
  list:            (params)        => api.get('/references', { params }),
  get:             (id)            => api.get(`/references/${id}`),
  update:          (id, data)      => api.patch(`/references/${id}`, data),
  delete:          (id)            => api.delete(`/references/${id}`),
  linkToPaper:     (paperId, refId, data) => api.post(`/papers/${paperId}/references/${refId}`, data),
  unlinkFromPaper: (paperId, refId)       => api.delete(`/papers/${paperId}/references/${refId}`),
  getPaperRefs:    (paperId)              => api.get(`/papers/${paperId}/references`),
  getBibtex:       (refId)                => api.get(`/references/${refId}/bibtex`),
  exportBibtex:    (paperId)              => api.get(`/papers/${paperId}/references/export/bibtex`),
};

// ═══════════════════════════════════════════════════════════════════════════
// Collaborations
// ═══════════════════════════════════════════════════════════════════════════
export const collabAPI = {
  sendRequest:         (data)   => api.post('/collaborations/requests', data),
  getIncoming:         ()       => api.get('/collaborations/requests/incoming'),
  getOutgoing:         ()       => api.get('/collaborations/requests/outgoing'),
  respond:             (id, status) => api.patch(`/collaborations/requests/${id}/respond`, { status }),
  getRecommendations:  ()       => api.get('/collaborations/recommendations'),
  dismissRecommendation: (id)   => api.post(`/collaborations/recommendations/${id}/dismiss`),
};

// ═══════════════════════════════════════════════════════════════════════════
// Conferences & Journals
// ═══════════════════════════════════════════════════════════════════════════
export const venuesAPI = {
  listConferences: (params) => api.get('/conferences', { params }),
  listJournals:    (params) => api.get('/journals', { params }),
  createSubmission:(data)   => api.post('/submissions', data),
  createConference: (data)  => api.post('/conferences', data),
};

// ═══════════════════════════════════════════════════════════════════════════
// AI Features
// ═══════════════════════════════════════════════════════════════════════════
export const aiAPI = {
  summarizeText:        (text, mode = 'abstract') =>
    api.post('/ai/summarize', { text, mode }),

  summarizePaper:       (paperId)  => api.post(`/ai/summarize/paper/${paperId}`),

  getCollabRecs:        (limit = 10) =>
    api.get('/ai/recommend/collaborators', { params: { limit } }),

  getVenueRecs:         (paperId)  => api.get(`/ai/recommend/venues/${paperId}`),

  analyzeTrends:        (data)     => api.post('/ai/trends', data),

  getDirections:        ()         => api.get('/ai/directions'),

  explainMatch:         (candidateId) => api.get(`/ai/explain/match/${candidateId}`),
};
