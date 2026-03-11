// If VITE_API_BASE_URL is not set (i.e. Production on VPS), use relative path
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/** 
 * Temporary helper to identity a user across sessions until real Auth is added.
 * Stores a random UUID in localStorage.
 */
function getUserId() {
    let id = localStorage.getItem('rs_user_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('rs_user_id', id);
    }
    return id;
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
            msg = body.error ?? msg;
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
 * Public endpoint — accessible by end users, no admin key needed.
 */
export async function renderProject(payload) {
    return apiFetch('/api/project/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: getUserId(), // Automatically attach the unique user ID
            ...payload
        }),
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
