import { usePage, Link } from '@inertiajs/react';
import Layout from '@/Root';

const ACTION_LABELS = {
    ban:           { label: 'User Banned',    icon: '🔨', color: 'text-red-400'    },
    unban:         { label: 'User Unbanned',  icon: '✅', color: 'text-emerald-400' },
    item_approve:  { label: 'Item Approved',  icon: '✅', color: 'text-emerald-400' },
    item_remove:   { label: 'Item Removed',   icon: '🗑', color: 'text-red-400'     },
    grant_kitties: { label: 'Kitties Granted',icon: '💰', color: 'text-amber-400'  },
    grant_item:    { label: 'Item Granted',   icon: '🎁', color: 'text-purple-400' },
    dismiss_report:{ label: 'Report Dismissed',icon:'📋', color: 'text-gray-400'   },
};

export default function StaffIndex({ stats, recentActions }) {
    const auth    = usePage().props;
    const user    = auth?.user;
    const isAdmin = user?.role === 'admin';

    return (
        <Layout>
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">🛡</span>
                            <h1 className="text-3xl font-black text-white">Staff Panel</h1>
                        </div>
                        <p className="text-gray-400 text-sm">
                            Logged in as <strong className="text-white">{user?.name}</strong>
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold uppercase ${isAdmin ? 'bg-red-600/30 text-red-300' : 'bg-indigo-600/30 text-indigo-300'}`}>
                                {user?.role}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        label="Open Reports"
                        value={stats.open_reports}
                        icon="📋"
                        href="/staff/reports"
                        urgent={stats.open_reports > 0}
                    />
                    <StatCard
                        label="Active Bans"
                        value={stats.active_bans}
                        icon="🔨"
                        href="/staff/bans"
                    />
                    <StatCard
                        label="Pending Items"
                        value={stats.pending_items}
                        icon="🎁"
                        href="/staff/items"
                        urgent={stats.pending_items > 0}
                    />
                    <StatCard
                        label="Total Users"
                        value={stats.total_users}
                        icon="👥"
                    />
                </div>

                {/* Navigation */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                    <NavCard href="/staff/reports" icon="📋" label="Manage Reports"  desc="Review user-submitted reports" badge={stats.open_reports} />
                    <NavCard href="/staff/bans"    icon="🔨" label="Manage Bans"    desc="Issue and revoke user bans"    />
                    <NavCard href="/staff/items"   icon="🎁" label="Manage Items"   desc="Approve and remove catalog items" badge={stats.pending_items} />
                </div>

                {/* Recent actions log */}
                <div className="rounded-2xl border border-white/10 bg-gray-800">
                    <div className="px-5 py-4 border-b border-white/10">
                        <h2 className="text-base font-bold text-white">Recent Staff Actions</h2>
                    </div>
                    {recentActions.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-10">No recent actions.</p>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {recentActions.map(action => {
                                const meta = ACTION_LABELS[action.action] ?? { label: action.action, icon: '•', color: 'text-gray-400' };
                                return (
                                    <div key={action.id} className="flex items-center gap-3 px-5 py-3">
                                        <span className="text-lg w-6 shrink-0 text-center">{meta.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-white text-sm font-medium">{action.staff?.name ?? '?'}</span>
                                                <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                                            </div>
                                            {action.notes && (
                                                <p className="text-gray-500 text-xs mt-0.5 truncate">{action.notes}</p>
                                            )}
                                        </div>
                                        <span className="text-gray-600 text-xs shrink-0">
                                            {new Date(action.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

function StatCard({ label, value, icon, href, urgent }) {
    const inner = (
        <div className={`rounded-2xl border p-5 transition-all ${
            urgent
                ? 'border-red-500/40 bg-red-500/10 hover:border-red-500/60'
                : 'border-white/10 bg-gray-800 hover:border-indigo-500/30'
        }`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-gray-400 text-xs mb-1">{label}</p>
                    <p className={`text-3xl font-black ${urgent ? 'text-red-300' : 'text-white'}`}>{value}</p>
                </div>
                <span className="text-2xl">{icon}</span>
            </div>
            {urgent && (
                <p className="text-red-400 text-xs font-bold mt-2">⚠ Needs attention</p>
            )}
        </div>
    );
    return href ? <a href={href}>{inner}</a> : inner;
}

function NavCard({ href, icon, label, desc, badge }) {
    return (
        <a
            href={href}
            className="rounded-2xl border border-white/10 bg-gray-800 p-5 hover:border-indigo-500/40 transition-all group block"
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{icon}</span>
                {badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold">
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-white font-bold group-hover:text-indigo-300 transition-colors">{label}</p>
            <p className="text-gray-500 text-xs mt-1">{desc}</p>
        </a>
    );
}
