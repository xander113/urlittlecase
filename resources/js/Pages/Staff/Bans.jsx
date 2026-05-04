import { useState } from 'react';
import { router } from '@inertiajs/react';
import Layout from '@/Root';

export default function StaffBans({ bans }) {
    const [search,    setSearch]   = useState('');
    const [results,   setResults]  = useState([]);
    const [searching, setSearching]= useState(false);
    const [form,      setForm]     = useState({ user_id: '', user_name: '', reason: '', expires_at: '' });
    const [submitting,setSubmitting]= useState(false);

    async function searchUsers() {
        if (search.trim().length < 2) return;
        setSearching(true);
        try {
            const res = await window.axios.get('/staff/users/search', { params: { q: search } });
            setResults(res.data);
        } catch { setResults([]); }
        finally { setSearching(false); }
    }

    function selectUser(u) {
        setForm(p => ({ ...p, user_id: u.id, user_name: u.name }));
        setResults([]);
        setSearch(u.name);
    }

    function submitBan() {
        if (!form.user_id || !form.reason) return;
        setSubmitting(true);
        router.post('/staff/bans/ban', {
            user_id:    form.user_id,
            reason:     form.reason,
            expires_at: form.expires_at || undefined,
        }, {
            onSuccess: () => setForm({ user_id: '', user_name: '', reason: '', expires_at: '' }),
            onFinish:  () => setSubmitting(false),
        });
    }

    function unban(userId) {
        if (!confirm('Unban this user?')) return;
        router.post('/staff/bans/unban', { user_id: userId });
    }

    return (
        <Layout>
            <div className="page">
                <StaffNav current="bans" />
                <h1 style={{ marginBottom: '1.25rem' }}>Bans</h1>

                <div className="card mb-6" style={{ maxWidth: 500 }}>
                    <div className="card__header"><h3>Issue Ban</h3></div>
                    <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="text" className="input" placeholder="Search username..." value={search}
                                    onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUsers()} />
                                <button onClick={searchUsers} disabled={searching} className="btn btn--secondary">{searching ? '...' : 'Find'}</button>
                            </div>
                            {results.length > 0 && (
                                <div className="card" style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 2, zIndex: 50, overflow: 'hidden' }}>
                                    {results.map(u => (
                                        <div key={u.id} onClick={() => selectUser(u)}
                                            style={{ padding: '0.45rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.83rem', fontWeight: 500 }}
                                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-3)'}
                                            onMouseOut={e => e.currentTarget.style.background = ''}>
                                            {u.name} {u.is_banned && '(banned)'}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {form.user_name && <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>Selected: {form.user_name}</div>}
                        </div>
                        <textarea className="input input--textarea" rows={2} placeholder="Reason *" value={form.reason}
                            onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
                        <div>
                            <label className="section-label">Expires (blank = permanent)</label>
                            <input type="datetime-local" className="input" value={form.expires_at}
                                onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} />
                        </div>
                        <button onClick={submitBan} disabled={submitting || !form.user_id || !form.reason} className="btn btn--danger">
                            {submitting ? 'Issuing...' : 'Issue Ban'}
                        </button>
                    </div>
                </div>

                <h2 style={{ marginBottom: '0.75rem' }}>Active Bans</h2>
                {bans.data.length === 0 ? (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><p className="text-muted">No active bans.</p></div>
                ) : (
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <table className="table">
                            <thead>
                                <tr><th>User</th><th>Reason</th><th>Issued By</th><th>Expires</th><th></th></tr>
                            </thead>
                            <tbody>
                                {bans.data.map(b => (
                                    <tr key={b.id}>
                                        <td style={{ textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>{b.user?.name ?? '?'}</td>
                                        <td style={{ textAlign: 'left', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.reason}</td>
                                        <td style={{ textAlign: 'left', color: 'var(--text-3)' }}>{b.staff?.name ?? '?'}</td>
                                        <td style={{ textAlign: 'left', fontWeight: 700, fontSize: '0.8rem', color: b.expires_at ? 'var(--warn)' : 'var(--danger)' }}>
                                            {b.expires_at ? new Date(b.expires_at).toLocaleDateString() : 'Permanent'}
                                        </td>
                                        <td>
                                            <button onClick={() => unban(b.user_id)} className="btn btn--ghost btn--sm">Unban</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination links={bans.links} />
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
