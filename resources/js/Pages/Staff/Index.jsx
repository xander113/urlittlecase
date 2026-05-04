import { usePage } from '@inertiajs/react';
import Layout from '@/Root';

const ACTION_META = {
    ban:           'User Banned',
    unban:         'User Unbanned',
    item_approve:  'Item Approved',
    item_remove:   'Item Removed',
    grant_kitties: 'Kitties Granted',
    grant_item:    'Item Granted',
    dismiss_report:'Report Dismissed',
};

export default function StaffIndex({ stats, recentActions }) {
    const auth    = usePage().props;
    const user    = auth?.user;
    const isAdmin = user?.role === 'admin';

    return (
        <Layout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <h1>Staff Panel</h1>
                        <div className="page-header__sub">
                            Signed in as <strong>{user?.name}</strong> &middot;
                            <span className="badge badge--accent" style={{ marginLeft: 6, verticalAlign: 'middle' }}>{user?.role}</span>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid-4 mb-6">
                    <StatCard label="Open Reports"  value={stats.open_reports}  href="/staff/reports" urgent={stats.open_reports > 0} />
                    <StatCard label="Active Bans"   value={stats.active_bans}   href="/staff/bans" />
                    <StatCard label="Pending Items"  value={stats.pending_items}  href="/staff/items" urgent={stats.pending_items > 0} />
                    <StatCard label="Total Users"    value={stats.total_users} />
                </div>

                {/* Nav */}
                <div className="grid-3 mb-6">
                    <NavCard href="/staff/reports" label="Reports"    desc="Review user-submitted reports" badge={stats.open_reports} />
                    <NavCard href="/staff/bans"    label="Bans"       desc="Manage account suspensions" />
                    <NavCard href="/staff/items"   label="Items"      desc="Approve and manage catalog items" badge={stats.pending_items} />
                </div>

                {/* Recent actions */}
                <h2 style={{ marginBottom: '0.75rem' }}>Recent Staff Actions</h2>
                <div className="card" style={{ overflow: 'hidden' }}>
                    {recentActions.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <p className="text-muted">No recent actions.</p>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Staff</th>
                                    <th>Action</th>
                                    <th>Notes</th>
                                    <th style={{ textAlign: 'right' }}>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentActions.map(a => (
                                    <tr key={a.id}>
                                        <td style={{ textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>{a.staff?.name ?? '?'}</td>
                                        <td style={{ textAlign: 'left' }}>
                                            <span className="badge badge--neutral">{ACTION_META[a.action] ?? a.action}</span>
                                        </td>
                                        <td style={{ textAlign: 'left', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                            {a.notes ?? '—'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                                            {new Date(a.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </Layout>
    );
}

function StatCard({ label, value, href, urgent }) {
    const inner = (
        <div className="card" style={{ padding: '1rem', borderLeft: urgent ? '3px solid var(--danger)' : undefined, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: urgent ? 'var(--danger)' : 'var(--text)' }}>{Number(value).toLocaleString()}</div>
            <div className="text-sm text-muted" style={{ marginTop: 2 }}>{label}</div>
            {urgent && <div style={{ fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 700, marginTop: 4 }}>Needs attention</div>}
        </div>
    );
    return href ? <a href={href} style={{ textDecoration: 'none' }}>{inner}</a> : inner;
}

function NavCard({ href, label, desc, badge }) {
    return (
        <a href={href} className="card card--hover" style={{ padding: '1.25rem', textDecoration: 'none', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <h3 style={{ color: 'var(--text)' }}>{label}</h3>
                {badge > 0 && <span className="badge badge--danger">{badge}</span>}
            </div>
            <p className="text-sm text-muted">{desc}</p>
        </a>
    );
}
