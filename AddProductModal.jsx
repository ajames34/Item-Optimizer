import React, { useState } from 'react';
import { api, CONDITIONS, fmtCurrency, fmtDate } from '../services/api';

export default function AddItemModal({ onClose, onAdded }) {
    const [form, setForm] = useState({
        item_name: '', brand: '', size: '', condition: 'New', purchase_price: '', date_acquired: new Date().toISOString().slice(0, 10),
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const item = await api.addItem({ ...form, purchase_price: Number(form.purchase_price) });
            onAdded(item);
            onClose();
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[#161b27] rounded-2xl w-full max-w-md ring-1 ring-white/10 shadow-2xl animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#252d42]">
                    <h2 className="text-lg font-bold text-white">Add Inventory Item</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Item Name */}
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Item Name *</label>
                            <input id="add-item-name" type="text" placeholder="Jordan 4 Retro Military Black" value={form.item_name} onChange={set('item_name')} required
                                className="w-full px-3 py-2.5 bg-[#1c2236] border border-[#252d42] rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                        </div>

                        {/* Brand */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Brand *</label>
                            <input id="add-brand" type="text" placeholder="Nike" value={form.brand} onChange={set('brand')} required
                                className="w-full px-3 py-2.5 bg-[#1c2236] border border-[#252d42] rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                        </div>

                        {/* Size */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Size</label>
                            <input id="add-size" type="text" placeholder='10.5 / L / 32' value={form.size} onChange={set('size')}
                                className="w-full px-3 py-2.5 bg-[#1c2236] border border-[#252d42] rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                        </div>

                        {/* Condition */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Condition</label>
                            <select id="add-condition" value={form.condition} onChange={set('condition')}
                                className="w-full px-3 py-2.5 bg-[#1c2236] border border-[#252d42] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition appearance-none">
                                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Purchase Price */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Purchase Price *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                <input id="add-purchase-price" type="number" min="0" step="0.01" placeholder="0.00" value={form.purchase_price} onChange={set('purchase_price')} required
                                    className="w-full pl-7 pr-3 py-2.5 bg-[#1c2236] border border-[#252d42] rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                            </div>
                        </div>

                        {/* Date Acquired */}
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Date Acquired</label>
                            <input id="add-date" type="date" value={form.date_acquired} onChange={set('date_acquired')}
                                className="w-full px-3 py-2.5 bg-[#1c2236] border border-[#252d42] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition [color-scheme:dark]" />
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-400">⚠ {error}</p>}

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#1c2236] text-slate-400 hover:text-white border border-[#252d42] hover:border-slate-500 transition">
                            Cancel
                        </button>
                        <button id="add-item-submit" type="submit" disabled={loading}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-500/20 disabled:opacity-40">
                            {loading ? 'Adding…' : '+ Add Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
