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

/** List all registered templates. */
export async function listTemplates() {
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
