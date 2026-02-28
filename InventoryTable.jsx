import React from 'react';
import { fmtCurrency, fmtDate } from '../services/api';

const CONDITION_COLOR = {
    'New': 'bg-emerald-500/10 text-emerald-400',
    'Like New': 'bg-sky-500/10 text-sky-400',
    'Good': 'bg-amber-500/10 text-amber-400',
    'Fair': 'bg-red-500/10 text-red-400',
};

export default function InventoryTable({ items, onSell, onDelete }) {
    if (!items || items.length === 0) {
        return (
            <div className="py-20 text-center">
                <p className="text-4xl mb-4">📦</p>
                <p className="text-slate-400 font-medium">No active inventory</p>
                <p className="text-slate-600 text-sm mt-1">Click "Add Item" to get started</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-[#252d42]">
                        {['Item', 'Brand', 'Size', 'Condition', 'Purchase Price', 'Date Acquired', 'Action'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#252d42]/60">
                    {items.map((item) => (
                        <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors duration-150">
                            <td className="px-4 py-3.5">
                                <p className="font-semibold text-white leading-snug">{item.item_name}</p>
                            </td>
                            <td className="px-4 py-3.5 text-slate-400">{item.brand}</td>
                            <td className="px-4 py-3.5 text-slate-400">{item.size || '—'}</td>
                            <td className="px-4 py-3.5">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${CONDITION_COLOR[item.condition] || 'bg-slate-500/10 text-slate-400'}`}>
                                    {item.condition}
                                </span>
                            </td>
                            <td className="px-4 py-3.5 font-semibold text-slate-200">{fmtCurrency(item.purchase_price)}</td>
                            <td className="px-4 py-3.5 text-slate-500">{fmtDate(item.date_acquired)}</td>
                            <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        id={`sell-item-${item.id}`}
                                        onClick={() => onSell(item)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-500/20"
                                    >
                                        Mark as Sold
                                    </button>
                                    <button
                                        id={`delete-item-${item.id}`}
                                        onClick={() => onDelete(item)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
