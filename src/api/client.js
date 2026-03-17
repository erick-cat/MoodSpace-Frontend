import { supabase } from '../lib/supabase.js';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// Session-level cache for template list
let templateCache = null;

/**
 * Gets the current authenticated user's ID.
 * Returns null if not logged in.
 */
async function getUserId() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
}

async function apiFetch(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: { ...(options.headers ?? {}) },
    });

    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            msg = body.message ?? body.error ?? msg;
        } catch { /* ignore */ }
        throw new Error(msg);
    }
    return res.json();
}

// ── Public endpoints (no auth required) ──────────────────────────────────────

/**
 * List all registered templates.
 * Uses a session-level cache to avoid redundant network requests across navigation.
 */
export async function listTemplates() {
    if (templateCache) return templateCache;

    try {
        // Try the static file first — it's served directly by Nginx without
        // hitting Node.js, making it extremely fast (< 5ms response time).
        const res = await fetch('/templates.json', { cache: 'no-cache' });
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
            const data = await res.json();
            templateCache = data;
            return data;
        }
    } catch { /* ignore, fall through to API */ }
    
    // Fallback to the API if the static file doesn't exist yet
    const data = await apiFetch('/api/template/list');
    templateCache = data;
    return data;
}

/**
 * Render (create/update) a user project page.
 * Requires user to be logged in — userId is taken from Supabase session.
 */
export async function renderProject(payload) {
    const userId = await getUserId();
    return apiFetch('/api/project/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload }),
    });
}
/**
 * Get user tier, usage count, and max quota limit.
 */
export async function getUserStatus(userId) {
    if (!userId) return null;
    return apiFetch(`/api/project/status/${userId}?t=${Date.now()}`);
}

/** Get all membership tiers and their configurations. */
export async function getTiers() {
    return apiFetch('/api/project/config/tiers');
}

// ── Admin endpoints (require admin key) ──────────────────────────────────────
/**
 * Get existing project configuration by subdomain.
 */
export async function getConfigBySubdomain(subdomain, userId) {
    return apiFetch(`/api/project/config-by-subdomain/${subdomain}?userId=${userId}`);
}

/** Upload a new template — admin only. */
export async function uploadTemplate(formData, adminKey) {
    return apiFetch('/api/template/upload', {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
        body: formData,
    });
}

/** Get raw project config from KV — admin only. */
export async function getProject(subdomain, adminKey) {
    return apiFetch(`/api/project/${subdomain}`, {
        headers: { 'X-Admin-Key': adminKey },
    });
}

/** Sync all local templates to R2/KV — admin only. */
export async function syncTemplates(adminKey) {
    return apiFetch('/api/template/sync-local', {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
    });
}

/** Update a specific user's tier — admin only. */
export async function updateUserTier(targetUserId, tier, adminKey) {
    return apiFetch('/api/project/config/update-user-tier', {
        method: 'POST',
        headers: { 
            'X-Admin-Key': adminKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetUserId, tier }),
    });
}

/** Check if VPS memory is synced with Cloudflare KV — admin only. */
export async function getSyncStatus(adminKey) {
    return apiFetch('/api/project/config/sync-status', {
        headers: { 'X-Admin-Key': adminKey },
    });
}
export async function refreshQuotas(adminKey) {
    return apiFetch('/api/project/config/refresh-quotas', {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
    });
}

/** Refresh in-memory blocklist from Cloudflare KV — admin only. */
export async function refreshBlocklist(adminKey) {
    return apiFetch('/api/project/config/refresh-blocklist', {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
    });
}
