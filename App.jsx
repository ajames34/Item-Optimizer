import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, useUser, UserButton, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';

import { api, fmtCurrency, setTokenGetter } from './services/api';
import MetricCard from './components/MetricsCard.jsx';
import InventoryTable from './components/InventoryTable.jsx';
import SalesTable from './components/SalesTable.jsx';
import SellModal from './components/RecordSaleModal.jsx';
import AddItemModal from './components/AddProductModal.jsx';
import SignInPage from './pages/SignInPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';

// ──────────────────────────────────────────────────────────────
// Toast
// ──────────────────────────────────────────────────────────────
function Toast({ toasts }) {
    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-xl ring-1 animate-slide-up pointer-events-auto min-w-[260px] ${t.type === 'success'
                            ? 'bg-emerald-950 text-emerald-300 ring-emerald-500/30'
                            : 'bg-red-950 text-red-300 ring-red-500/30'
                        }`}
                >
                    <span className="text-base">{t.type === 'success' ? '✅' : '❌'}</span>
                    {t.message}
                </div>
            ))}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────
// Tab
// ──────────────────────────────────────────────────────────────
function Tab({ id, active, children, onClick, badge }) {
    return (
        <button
            id={id}
            onClick={onClick}
            className={`relative px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${active
                    ? 'bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
        >
            {children}
            {badge != null && (
                <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${active ? 'bg-indigo-500/30 text-indigo-300' : 'bg-white/10 text-slate-500'
                    }`}>
                    {badge}
                </span>
            )}
        </button>
    );
}

// ──────────────────────────────────────────────────────────────
// ProtectedRoute — redirects to /sign-in if not authenticated
// ──────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
    return (
        <>
            <SignedIn>{children}</SignedIn>
            <SignedOut><RedirectToSignIn redirectUrl="/" /></SignedOut>
        </>
    );
}

// ──────────────────────────────────────────────────────────────
// Dashboard (the actual app content — only rendered when signed in)
// ──────────────────────────────────────────────────────────────
function Dashboard() {
    const { getToken } = useAuth();
    const { user } = useUser();

    // Register token getter so every api.* call sends Authorization header
    useEffect(() => {
        setTokenGetter(getToken);
    }, [getToken]);

    const [tab, setTab] = useState('inventory');
    const [stats, setStats] = useState(null);
    const [inventory, setInventory] = useState([]);
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [showAddItem, setShowAddItem] = useState(false);
    const [sellTarget, setSellTarget] = useState(null);
    const [toasts, setToasts] = useState([]);

    // ── helpers ──────────────────────────────────────────────────
    const toast = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3800);
    }, []);

    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try { setStats(await api.getDashboard()); }
        catch { /* silent */ }
        finally { setStatsLoading(false); }
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [inv, sal] = await Promise.all([
                api.getInventory('In Stock'),
                api.getSales(),
            ]);
            setInventory(inv);
            setSales(sal);
        } catch {
            toast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
        loadStats();
    }, [toast, loadStats]);

    useEffect(() => { loadAll(); }, [loadAll]);

    // 30-day profit (client-side calc for the card)
    const thirtyDayProfit = (() => {
        if (!sales.length) return 0;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        return sales
            .filter(s => new Date(s.date_sold + 'T00:00:00') >= cutoff)
            .reduce((sum, s) => sum + (s.net_profit ?? 0), 0);
    })();

    const thirtyDaySales = sales.filter(s => {
        const c = new Date(); c.setDate(c.getDate() - 30);
        return new Date(s.date_sold + 'T00:00:00') >= c;
    }).length;

    // ── handlers ──────────────────────────────────────────────────
    const handleItemAdded = (item) => {
        setInventory(prev => [item, ...prev]);
        loadStats();
        toast(`"${item.item_name}" added to inventory!`);
    };

    const handleSold = () => {
        loadAll();
        toast('Sale recorded — item moved to Completed Sales ✓');
        setTab('sales');
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`Remove "${item.item_name}" from inventory? This cannot be undone.`)) return;
        try {
            await api.deleteItem(item.id);
            setInventory(prev => prev.filter(x => x.id !== item.id));
            loadStats();
            toast(`"${item.item_name}" removed.`);
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const handleUndoSale = async (sale) => {
        if (!window.confirm(`Undo sale of "${sale.item_name}"? The item will return to active inventory.`)) return;
        try {
            await api.deleteSale(sale.id);
            loadAll();
            toast('Sale undone — item restored to inventory.');
            setTab('inventory');
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    // ──────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#0f1117] text-slate-100 font-sans">
            {/* ─ Header ────────────────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-[#0f1117]/90 backdrop-blur-md border-b border-[#252d42]">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-base shadow-lg shadow-indigo-500/30">
                            📦
                        </div>
                        <span className="font-bold text-white text-lg tracking-tight">Inventory Optimizer</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Greeting */}
                        {user && (
                            <span className="text-sm text-slate-400 hidden sm:block">
                                Hey, <span className="text-slate-200 font-medium">{user.firstName ?? user.emailAddresses[0]?.emailAddress}</span>
                            </span>
                        )}

                        {/* Clerk UserButton — avatar + dropdown with sign out */}
                        <UserButton
                            afterSignOutUrl="/sign-in"
                            appearance={{
                                elements: {
                                    avatarBox: 'w-8 h-8 ring-2 ring-indigo-500/40',
                                },
                            }}
                        />

                        <button
                            id="header-add-item"
                            onClick={() => setShowAddItem(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-500/20"
                        >
                            <span className="text-base leading-none">+</span> Add Item
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* ─ Metric Cards ────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                    <MetricCard
                        label="Total Active Inventory Value"
                        value={statsLoading ? '—' : fmtCurrency(stats?.total_invested ?? 0)}
                        sub={`${stats?.in_stock_count ?? 0} item${stats?.in_stock_count !== 1 ? 's' : ''} in stock`}
                        icon="🏷️"
                        accent="indigo"
                        loading={statsLoading}
                    />
                    <MetricCard
                        label="30-Day Net Profit"
                        value={statsLoading ? '—' : fmtCurrency(thirtyDayProfit)}
                        sub={`${thirtyDaySales} sale(s) this period`}
                        icon="📈"
                        accent="emerald"
                        loading={statsLoading}
                    />
                    <MetricCard
                        label="Total Items Sold"
                        value={statsLoading ? '—' : (stats?.sold_count ?? 0)}
                        sub={`All-time · ${fmtCurrency(stats?.total_net_profit ?? 0)} net profit`}
                        icon="🛒"
                        accent="violet"
                        loading={statsLoading}
                    />
                </div>

                {/* ─ Panel ──────────────────────────────────────── */}
                <div className="bg-[#161b27] rounded-2xl ring-1 ring-white/[0.06] shadow-card overflow-hidden">
                    {/* Tab bar */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#252d42]">
                        <div className="flex gap-1">
                            <Tab id="tab-inventory" active={tab === 'inventory'} onClick={() => setTab('inventory')} badge={inventory.length}>
                                Active Inventory
                            </Tab>
                            <Tab id="tab-sales" active={tab === 'sales'} onClick={() => setTab('sales')} badge={sales.length}>
                                Completed Sales
                            </Tab>
                        </div>

                        {tab === 'inventory' && (
                            <button
                                id="panel-add-item"
                                onClick={() => setShowAddItem(true)}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 hover:border-indigo-400/50 transition"
                            >
                                + Add Item
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="py-20 flex items-center justify-center gap-3 text-slate-600">
                            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Loading…
                        </div>
                    ) : (
                        <>
                            {tab === 'inventory' && (
                                <InventoryTable
                                    items={inventory}
                                    onSell={(item) => setSellTarget(item)}
                                    onDelete={handleDelete}
                                />
                            )}
                            {tab === 'sales' && (
                                <>
                                    {/* Platform breakdown strip */}
                                    {stats?.platform_breakdown?.length > 0 && (
                                        <div className="flex items-center gap-6 px-5 py-3 border-b border-[#252d42] bg-[#0f1117]/40 overflow-x-auto">
                                            {stats.platform_breakdown.map((p) => (
                                                <div key={p.platform} className="flex items-center gap-3 shrink-0">
                                                    <span className="text-xs text-slate-600 font-semibold uppercase tracking-wider">{p.platform}</span>
                                                    <span className="text-xs text-slate-400">{p.sales_count} sale{p.sales_count !== 1 ? 's' : ''}</span>
                                                    <span className="text-xs font-bold text-emerald-400">{fmtCurrency(p.net_profit)}</span>
                                                </div>
                                            ))}
                                            <div className="ml-auto shrink-0 text-xs text-slate-600 font-semibold">
                                                ROI: <span className="text-indigo-400">{stats?.roi_percent ?? 0}%</span>
                                            </div>
                                        </div>
                                    )}
                                    <SalesTable sales={sales} onUndoSale={handleUndoSale} />
                                </>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* ─ Modals ─────────────────────────────────────── */}
            {showAddItem && (
                <AddItemModal onClose={() => setShowAddItem(false)} onAdded={handleItemAdded} />
            )}
            {sellTarget && (
                <SellModal
                    item={sellTarget}
                    onClose={() => setSellTarget(null)}
                    onSold={handleSold}
                />
            )}

            <Toast toasts={toasts} />
        </div>
    );
}

// ──────────────────────────────────────────────────────────────
// App — top-level router
// ──────────────────────────────────────────────────────────────
export default function App() {
    return (
        <Routes>
            {/* Public auth pages */}
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />

            {/* Protected dashboard */}
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />

            {/* Catch-all → home */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
