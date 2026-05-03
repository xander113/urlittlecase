import { router } from '@inertiajs/react';
import Layout from '@/Root';

export default function StaffReports({ reports }) {
    function dismiss(id) {
        if (!confirm('Dismiss this report?')) return;
        router.post(`/staff/reports/${id}/dismiss`);
    }

    function banFromReport(userId, name) {
        const reason = window.prompt(`Reason for banning ${name}:`);
        if (!reason) return;
        router.post('/staff/bans/ban', { user_id: userId, reason });
    }

    return (
        <Layout>
            <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
                <StaffNav current="reports" />

                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-black text-white">📋 Open Reports</h1>
                    <span className="px-3 py-1 rounded-full bg-red-600/20 text-red-300 text-sm font-bold border border-red-500/30">
                        {reports.data.length} open
                    </span>
                </div>

                {reports.data.length === 0 ? (
                    <div className="text-center py-20 rounded-2xl border border-white/10 bg-gray-800">
                        <span className="text-4xl">✅</span>
                        <p className="text-gray-400 mt-3">No open reports. You're all caught up!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reports.data.map(report => (
                            <div key={report.id} className="rounded-2xl border border-white/10 bg-gray-800 p-5">
                                {/* Header row */}
                                <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap text-sm">
                                            <span className="text-gray-500">#{report.id}</span>
                                            <span className="text-gray-500">·</span>
                                            <span className="text-gray-400">
                                                By <strong className="text-white">{report.reporter?.name ?? '?'}</strong>
                                            </span>
                                            {report.reported_user && (
                                                <>
                                                    <span className="text-gray-500">·</span>
                                                    <span className="text-gray-400">
                                                        Against <strong className="text-white">{report.reported_user.name}</strong>
                                                        <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs font-bold ${
                                                            report.reported_user.is_banned
                                                                ? 'bg-red-600/30 text-red-300'
                                                                : 'bg-gray-700 text-gray-400'
                                                        }`}>
                                                            {report.reported_user.is_banned ? 'BANNED' : report.reported_user.role}
                                                        </span>
                                                    </span>
                                                </>
                                            )}
                                            {report.reported_item_id && (
                                                <>
                                                    <span className="text-gray-500">·</span>
                                                    <a href={`/catalog/${report.reported_item_id}`} className="text-indigo-400 hover:underline">
                                                        Item #{report.reported_item_id}
                                                    </a>
                                                </>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1">{new Date(report.created_at).toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="rounded-xl border border-white/5 bg-gray-900/50 p-3 mb-4">
                                    <p className="text-white font-semibold text-sm">{report.reason}</p>
                                    {report.details && (
                                        <p className="text-gray-400 text-sm mt-1">{report.details}</p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => dismiss(report.id)}
                                        className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs font-semibold hover:bg-gray-600 transition-colors"
                                    >
                                        ✓ Dismiss
                                    </button>
                                    {report.reported_user && !report.reported_user.is_banned && (
                                        <button
                                            onClick={() => banFromReport(report.reported_user.id, report.reported_user.name)}
                                            className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 border border-red-500/30 text-xs font-semibold hover:bg-red-600/30 transition-colors"
                                        >
                                            🔨 Ban User
                                        </button>
                                    )}
                                    {report.reported_user && report.reported_user.is_banned && (
                                        <button
                                            onClick={() => router.post('/staff/bans/unban', { user_id: report.reported_user.id })}
                                            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30 transition-colors"
                                        >
                                            ✅ Unban
                                        </button>
                                    )}
                                    {report.reported_item_id && (
                                        <a
                                            href={`/catalog/${report.reported_item_id}`}
                                            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold hover:bg-indigo-600/30 transition-colors"
                                        >
                                            View Item
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <Pagination links={reports.links} />
            </div>
        </Layout>
    );
}

function StaffNav({ current }) {
    const links = [
        { id: 'index',   href: '/staff',         label: 'Dashboard' },
        { id: 'reports', href: '/staff/reports',  label: 'Reports'   },
        { id: 'bans',    href: '/staff/bans',     label: 'Bans'      },
        { id: 'items',   href: '/staff/items',    label: 'Items'     },
    ];
    return (
        <div className="flex gap-1 mb-6 flex-wrap">
            {links.map(l => (
                <a key={l.id} href={l.href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        current === l.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    {l.label}
                </a>
            ))}
        </div>
    );
}

function Pagination({ links }) {
    if (!links || links.length <= 3) return null;
    return (
        <div className="flex flex-wrap gap-1 mt-6 justify-center">
            {links.map((link, i) => (
                <button key={i} disabled={!link.url || link.active} onClick={() => link.url && router.visit(link.url)}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                    className={`px-3 py-1.5 rounded-lg text-sm ${link.active ? 'bg-indigo-600 text-white font-bold' : !link.url ? 'text-gray-600 cursor-default' : 'bg-gray-800 text-gray-300 border border-white/10 hover:border-indigo-500/50 cursor-pointer'}`}
                />
            ))}
        </div>
    );
}
