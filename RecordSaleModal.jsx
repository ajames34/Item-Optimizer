import React, { useState, useEffect } from 'react';
import { api, PLATFORMS, fmtCurrency } from '../services/api';

const PLATFORM_ICONS = { StockX: '👟', eBay: '🛒', Poshmark: '👗', Depop: '📦' };

export default function SellModal({ item, onClose, onSold }) {
    const [platform, setPlatform] = useState(PLATFORMS[0]);
    const [salePrice, setSalePrice] = useState('');
    const [shipping, setShipping] = useState('');
    const [preview, setPreview] = useState(null);
    const [prevLoading, setPrevLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Live preview whenever inputs change
    useEffect(() => {
        if (!salePrice || Number(salePrice) <= 0) { setPreview(null); return; }
        const timer = setTimeout(async () => {
            setPrevLoading(true);
            try {
                const data = await api.previewSale({
                    inventory_id: item.id,
                    sale_price: salePrice,
                    platform,
                    shipping_cost: shipping || 0,
                });
                setPreview(data);
            } catch {
                setPreview(null);
            } finally {
                setPrevLoading(false);
            }
        }, 380); // debounce
        return () => clearTimeout(timer);
    }, [salePrice, platform, shipping, item.id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const sale = await api.recordSale({
                inventory_id: item.id,
                sale_price: Number(salePrice),
                platform,
                shipping_cost: Number(shipping || 0),
                date_sold: new Date().toISOString().slice(0, 10),
            });
            onSold(sale);
            onClose();
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const isProfitable = preview && preview.net_profit >= 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[#161b27] rounded-2xl w-full max-w-md ring-1 ring-white/10 shadow-2xl animate-slide-up">

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#252d42]">
                    <div>
                        <h2 className="text-lg font-bold text-white">Mark as Sold</h2>
                        <p className="text-sm text-slate-400 mt-0.5 truncate max-w-xs">{item.item_name} · {item.brand}</p>
                    </div>
                    <button
                        id="sell-modal-close"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition"
                    >✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Platform */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                            Sale Platform
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {PLATFORMS.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    id={`platform-${p.toLowerCase()}`}
                                    onClick={() => setPlatform(p)}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${platform === p
                                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                            : 'bg-[#1c2236] border-[#252d42] text-slate-400 hover:border-indigo-500/50 hover:text-white'
                                        }`}
                                >
                                    <span>{PLATFORM_ICONS[p]}</span> {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sale Price */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                            Final Sale Price
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                            <input
                                id="sell-sale-price"
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="0.00"
                                value={salePrice}
                                onChange={(e) => setSalePrice(e.target.value)}
                                required
                                className="w-full pl-7 pr-4 py-2.5 bg-[#1c2236] border border-[#252d42] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm"
                            />
                        </div>
                    </div>

                    {/* Shipping */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                            Shipping Label Cost <span className="text-slate-600 normal-case">(optional)</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                            <input
                                id="sell-shipping"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={shipping}
                                onChange={(e) => setShipping(e.target.value)}
                                className="w-full pl-7 pr-4 py-2.5 bg-[#1c2236] border border-[#252d42] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm"
                            />
                        </div>
                    </div>

                    {/* Live Preview Box */}
                    {(preview || prevLoading) && (
                        <div className={`rounded-xl p-4 border transition-all ${prevLoading ? 'bg-[#1c2236] border-[#252d42]' :
                                isProfitable ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
                            }`}>
                            {prevLoading ? (
                                <div className="flex items-center gap-2 text-slate-500 text-sm">
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Calculating fees…
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Fee Breakdown</p>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between text-slate-400">
                                            <span>Purchase Cost</span>
                                            <span className="font-medium text-slate-300">−{fmtCurrency(item.purchase_price)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400">
                                            <span>Platform Fee ({platform})</span>
                                            <span className="font-medium text-red-400">−{fmtCurrency(preview.platform_fee)}</span>
                                        </div>
                                        {preview.shipping_cost > 0 && (
                                            <div className="flex justify-between text-slate-400">
                                                <span>Shipping</span>
                                                <span className="font-medium text-red-400">−{fmtCurrency(preview.shipping_cost)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`flex justify-between items-center mt-3 pt-3 border-t font-bold text-base ${preview.net_profit >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'
                                        }`}>
                                        <span className="text-white">Net Profit</span>
                                        <span className={isProfitable ? 'text-emerald-400' : 'text-red-400'}>
                                            {fmtCurrency(preview.net_profit)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {error && (
                        <p className="text-sm text-red-400 flex items-center gap-1.5">
                            <span>⚠</span> {error}
                        </p>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#1c2236] text-slate-400 hover:text-white border border-[#252d42] hover:border-slate-500 transition"
                        >
                            Cancel
                        </button>
                        <button
                            id="sell-submit"
                            type="submit"
                            disabled={loading || !salePrice}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing…' : 'Confirm Sale'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
