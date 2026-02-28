import React from 'react';

/**
 * MetricCard — top-of-page KPI card
 * props: label, value, sub, icon (emoji/svg), accentColor (tailwind color class prefix)
 * accentColor options: 'indigo' | 'emerald' | 'violet' | 'amber'
 */
const ACCENT = {
    indigo: { ring: 'ring-indigo-500/20', icon: 'bg-indigo-500/10 text-indigo-400', val: 'text-indigo-300' },
    emerald: { ring: 'ring-emerald-500/20', icon: 'bg-emerald-500/10 text-emerald-400', val: 'text-emerald-300' },
    violet: { ring: 'ring-violet-500/20', icon: 'bg-violet-500/10 text-violet-400', val: 'text-violet-300' },
    amber: { ring: 'ring-amber-500/20', icon: 'bg-amber-500/10 text-amber-400', val: 'text-amber-300' },
};

export default function MetricCard({ label, value, sub, icon, accent = 'indigo', loading = false }) {
    const a = ACCENT[accent] || ACCENT.indigo;
    return (
        <div className={`relative bg-[#161b27] rounded-2xl p-6 ring-1 ${a.ring} shadow-card overflow-hidden hover:ring-2 transition-all duration-200`}>
            {/* glow blob */}
            <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-20 blur-2xl bg-current" />

            <div className="flex items-start justify-between mb-4">
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xl ${a.icon}`}>
                    {icon}
                </span>
            </div>

            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">{label}</p>

            {loading ? (
                <div className="h-8 w-32 bg-[#1c2236] animate-pulse rounded-lg mt-1" />
            ) : (
                <p className={`text-3xl font-bold tracking-tight animate-count-up ${a.val}`}>{value}</p>
            )}

            {sub && <p className="text-xs text-slate-600 mt-1.5">{sub}</p>}
        </div>
    );
}
