import { supabase } from '../lib/supabase.js';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

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
 * Primary: /templates.json — static file served directly by Nginx (fastest).
 * Fallback: /api/template/list — dynamic API endpoint.
 */
export async function listTemplates() {
    try {
        // Try the static file first — it's served directly by Nginx without
        // hitting Node.js, making it extremely fast (< 5ms response time).
        const res = await fetch('/templates.json', { cache: 'no-cache' });
        // Only parse if it's actually JSON. Nginx might return index.html (SPA fallback)
        // if templates.json hasn't been generated yet, which would cause res.json() to fail.
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
            return res.json();
        }
    } catch { /* ignore, fall through to API */ }
    // Fallback to the API if the static file doesn't exist yet
    return apiFetch('/api/template/list');
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

// ── Admin endpoints (require admin key) ──────────────────────────────────────

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
