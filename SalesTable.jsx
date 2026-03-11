import React from 'react';
import { fmtCurrency, fmtDate } from '../services/api';

const PLATFORM_COLORS = {
    StockX: 'bg-lime-500/10 text-lime-400',
    eBay: 'bg-sky-500/10 text-sky-400',
    Poshmark: 'bg-rose-500/10 text-rose-400',
    Depop: 'bg-purple-500/10 text-purple-400',
};

export default function SalesTable({ sales, onUndoSale }) {
    if (!sales || sales.length === 0) {
        return (
            <div className="py-20 text-center">
                <p className="text-4xl mb-4">🧾</p>
                <p className="text-slate-400 font-medium">No completed sales yet</p>
                <p className="text-slate-600 text-sm mt-1">Mark an inventory item as sold to see it here</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-[#252d42]">
                        {['Item', 'Brand', 'Platform', 'Purchased', 'Sale Price', 'Platform Fee', 'Shipping', 'Net Profit', 'Date Sold', ''].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#252d42]/60">
                    {sales.map((sale) => {
                        const isProfit = sale.net_profit >= 0;
                        return (
                            <tr key={sale.id} className="group hover:bg-white/[0.02] transition-colors duration-150">
                                <td className="px-4 py-3.5">
                                    <p className="font-semibold text-white leading-snug">{sale.item_name}</p>
                                    {sale.size && <p className="text-xs text-slate-600 mt-0.5">Size {sale.size}</p>}
                                </td>
                                <td className="px-4 py-3.5 text-slate-400">{sale.brand}</td>
                                <td className="px-4 py-3.5">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${PLATFORM_COLORS[sale.platform] || 'bg-slate-500/10 text-slate-400'}`}>
                                        {sale.platform}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5 text-slate-400">{fmtCurrency(sale.purchase_price)}</td>
                                <td className="px-4 py-3.5 font-semibold text-slate-200">{fmtCurrency(sale.sale_price)}</td>
                                <td className="px-4 py-3.5 text-red-400">−{fmtCurrency(sale.platform_fee)}</td>
                                <td className="px-4 py-3.5 text-slate-500">
                                    {sale.shipping_cost > 0 ? `−${fmtCurrency(sale.shipping_cost)}` : '—'}
                                </td>
                                <td className="px-4 py-3.5">
                                    <span className={`font-bold text-base ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isProfit ? '+' : ''}{fmtCurrency(sale.net_profit)}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{fmtDate(sale.date_sold)}</td>
                                <td className="px-4 py-3.5">
                                    <button
                                        id={`undo-sale-${sale.id}`}
                                        onClick={() => onUndoSale(sale)}
                                        className="opacity-0 group-hover:opacity-100 px-2.5 py-1 rounded-lg text-xs text-slate-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition"
                                        title="Undo this sale"
                                    >
                                        Undo
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
