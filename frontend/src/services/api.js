// Centralized API helper for the resale dashboard
//
// VITE_API_URL controls where API requests go:
//   • Dev  (empty): relative '/api' → Vite proxy → localhost:4000
//   • Prod (set):   absolute URL, e.g. 'https://api.your-app.com'
//
// Auth: call setTokenGetter(getToken) once after the user signs in.
// Every request will then include Authorization: Bearer <clerk-jwt>
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';

// Module-level token getter — set by setTokenGetter() from App.jsx
let _getToken = null;

/** Call this once inside App (or a top-level component) after Clerk is ready. */
export function setTokenGetter(fn) {
    _getToken = fn;
}

async function req(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };

    // Attach Clerk JWT when we have a token getter
    if (_getToken) {
        try {
            const token = await _getToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;
        } catch (_) {
            // Not signed in — let the server handle the 401
        }
    }

    const res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

export const api = {
    getDashboard: () => req('/dashboard'),
    getInventory: (status) =>
        req(`/inventory${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    addItem: (body) => req('/inventory', { method: 'POST', body }),
    deleteItem: (id) => req(`/inventory/${id}`, { method: 'DELETE' }),
    getSales: () => req('/sales'),
    previewSale: (p) => req(
        `/sales/preview?inventory_id=${p.inventory_id}&sale_price=${p.sale_price}&platform=${p.platform}&shipping_cost=${p.shipping_cost ?? 0}`
    ),
    recordSale: (body) => req('/sales', { method: 'POST', body }),
    deleteSale: (id) => req(`/sales/${id}`, { method: 'DELETE' }),
};

export const PLATFORMS = ['StockX', 'eBay', 'Poshmark', 'Depop'];
export const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];

export const fmtCurrency = (n = 0) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
};
