import { router } from '@inertiajs/react';
import Layout from '@/Root';

export default function StaffReports({ reports }) {
    function dismiss(id) {
        if (!confirm('Dismiss this report?')) return;
        router.post(`/staff/reports/${id}/dismiss`);
    }
    function ban(userId, name) {
        const reason = window.prompt(`Reason for banning ${name}:`);
        if (!reason) return;
        router.post('/staff/bans/ban', { user_id: userId, reason });
    }

    return (
        <Layout>
            <div className="page">
                <StaffNav current="reports" />
                <div className="page-header">
                    <h1>Reports</h1>
                    <span className="badge badge--danger">{reports.data.length} open</span>
                </div>

                {reports.data.length === 0 ? (
                    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <p className="text-muted">No open reports.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {reports.data.map(r => (
                            <div key={r.id} className="card">
                                <div className="card__header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '0.83rem', color: 'var(--text-2)' }}>
                                        <strong style={{ color: 'var(--text-3)', marginRight: 4 }}>#{r.id}</strong>
                                        By <strong>{r.reporter?.name ?? '?'}</strong>
                                        {r.reported_user && (
                                            <> against <strong>{r.reported_user.name}</strong>
                                                <span className="badge badge--neutral" style={{ marginLeft: 4, verticalAlign: 'middle' }}>{r.reported_user.role}</span>
                                                {r.reported_user.is_banned && <span className="badge badge--danger" style={{ marginLeft: 4, verticalAlign: 'middle' }}>banned</span>}
                                            </>
                                        )}
                                        {r.reported_item_id && (
                                            <> &middot; <a href={`/catalog/${r.reported_item_id}`} style={{ color: 'var(--accent)' }}>Item #{r.reported_item_id}</a></>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginLeft: 'auto' }}>
                                        {new Date(r.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="card__body">
                                    <p className="text-sm fw-600" style={{ color: 'var(--text)', marginBottom: r.details ? '0.25rem' : 0 }}>{r.reason}</p>
                                    {r.details && <p className="text-sm text-subtle">{r.details}</p>}
                                </div>
                                <div className="card__footer">
                                    <button onClick={() => dismiss(r.id)} className="btn btn--ghost btn--sm">Dismiss</button>
                                    {r.reported_user && !r.reported_user.is_banned && (
                                        <button onClick={() => ban(r.reported_user.id, r.reported_user.name)} className="btn btn--danger btn--sm">Ban User</button>
                                    )}
                                    {r.reported_user && r.reported_user.is_banned && (
                                        <button onClick={() => router.post('/staff/bans/unban', { user_id: r.reported_user.id })} className="btn btn--secondary btn--sm">Unban</button>
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
    return (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {[['index','/staff','Dashboard'],['reports','/staff/reports','Reports'],['bans','/staff/bans','Bans'],['items','/staff/items','Items']].map(([id, href, label]) => (
                <a key={id} href={href} style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--r-sm)', fontSize: '0.83rem', fontWeight: current === id ? 700 : 400, background: current === id ? 'var(--accent)' : 'var(--bg-3)', color: current === id ? 'var(--accent-text)' : 'var(--text-2)', textDecoration: 'none', border: '1px solid var(--border)' }}>{label}</a>
            ))}
        </div>
    );
}

function Pagination({ links }) {
    if (!links || links.length <= 3) return null;
    return (
        <div className="pagination">
            {links.map((l, i) => (
                <button key={i} disabled={!l.url || l.active} className={l.active ? 'active' : ''} onClick={() => l.url && router.visit(l.url)} dangerouslySetInnerHTML={{ __html: l.label }} />
            ))}
        </div>
    );
}
