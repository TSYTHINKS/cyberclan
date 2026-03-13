/**
 * API Helper — Centralizes all backend HTTP calls
 * Automatically attaches JWT token to requests
 */

const API = (() => {
  const BASE = '/api';

  /** Get stored auth token */
  function getToken() { return localStorage.getItem('cc_token'); }

  /** Make a fetch request with auth header */
  async function request(path, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  return {
    // ─── Auth ─────────────────────────────────────────────────────────────
    login:   (email, password) => request('/auth/login', 'POST', { email, password }),
    signup:  (username, email, password) => request('/auth/signup', 'POST', { username, email, password }),
    me:      () => request('/auth/me'),

    // ─── Clans ────────────────────────────────────────────────────────────
    listClans:   (search = '') => request(`/clans?search=${search}`),
    createClan:  (data) => request('/clans/create', 'POST', data),
    joinClan:    (id)   => request(`/clans/join/${id}`, 'POST'),
    leaveClan:   ()     => request('/clans/leave', 'POST'),
    getClan:     (id)   => request(`/clans/${id}`),

    // ─── Leaderboard ──────────────────────────────────────────────────────
    leaderboard: () => request('/leaderboard'),

    // ─── Matches ──────────────────────────────────────────────────────────
    recentMatches: () => request('/matches/recent'),
  };
})();
