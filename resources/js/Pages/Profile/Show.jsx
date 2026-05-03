import { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoPrivateChannel } from '@/hooks/useEchoChannel';

export default function ProfileShow({ profile, inventory, friendStatus, isSelf }) {
    const auth = usePage().props;
    const user = auth?.user;

    const [friendBusy,  setFriendBusy]  = useState(false);
    const [reportOpen,  setReportOpen]  = useState(false);
    const [reportReason,setReportReason]= useState('');
    const [reportDetail,setReportDetail]= useState('');
    const [reporting,   setReporting]   = useState(false);

    function sendFriend() {
        setFriendBusy(true);
        router.post(`/users/${profile.name}/friend`, {}, {
            onFinish: () => setFriendBusy(false),
        });
    }

    function removeFriend() {
        if (!confirm('Remove this friend?')) return;
        setFriendBusy(true);
        router.post(`/users/${profile.name}/unfriend`, {}, {
            onFinish: () => setFriendBusy(false),
        });
    }

    function submitReport(e) {
        e.preventDefault();
        if (!reportReason) return;
        setReporting(true);
        router.post('/report', {
            reported_user_id: profile.id,
            reason: reportReason,
            details: reportDetail,
        }, {
            onSuccess: () => { setReportOpen(false); setReportReason(''); setReportDetail(''); },
            onFinish:  () => setReporting(false),
        });
    }

    const friendLabel = {
        none:     'Add Friend',
        pending:  'Request Sent',
        incoming: 'Accept Request',
        friends:  'Friends',
    }[friendStatus] ?? 'Add Friend';

    return (
        <Layout>
            <div className="page page--narrow">
                {/* Profile card */}
                <div className="profile-header" style={{ marginBottom: '1.5rem' }}>
                    <div className="profile-header__banner" style={{ background: 'var(--bg-3)' }} />
                    <div className="profile-header__body">
                        {/* 3D Avatar thumbnail */}
                        <div style={{
                            width: 72, height: 72, borderRadius: 'var(--r-md)',
                            border: '3px solid var(--bg-2)', background: 'var(--bg-3)',
                            overflow: 'hidden', flexShrink: 0,
                        }}>
                            {profile.avatar_thumbnail
                                ? <img src={profile.avatar_thumbnail} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                : <div style={{ width: '100%', height: '100%', background: 'var(--bg-4)' }} />
                            }
                        </div>

                        <div className="profile-header__info">
                            <div className="profile-header__name">{profile.name}</div>
                            <div className="profile-header__role">
                                {profile.role !== 'user' && (
                                    <span className="badge badge--accent" style={{ marginRight: 6 }}>{profile.role}</span>
                                )}
                                Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </div>
                        </div>

                        {user && !isSelf && (
                            <div className="profile-header__actions">
                                <a href={`/trade/create?user_id=${profile.id}`} className="btn btn--primary btn--sm">
                                    Trade
                                </a>
                                {friendStatus === 'friends' ? (
                                    <button onClick={removeFriend} disabled={friendBusy} className="btn btn--ghost btn--sm">
                                        {friendBusy ? '...' : 'Unfriend'}
                                    </button>
                                ) : (
                                    <button onClick={sendFriend} disabled={friendBusy || friendStatus === 'pending'} className="btn btn--ghost btn--sm">
                                        {friendBusy ? '...' : friendLabel}
                                    </button>
                                )}
                                <button onClick={() => setReportOpen(v => !v)} className="btn btn--ghost btn--sm" style={{ color: 'var(--danger)' }}>
                                    Report
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Report form */}
                {reportOpen && (
                    <div className="card mb-4">
                        <div className="card__header"><h3>Report User</h3></div>
                        <div className="card__body">
                            <div style={{ marginBottom: '0.75rem' }}>
                                <label className="section-label">Reason</label>
                                <select className="input" value={reportReason} onChange={e => setReportReason(e.target.value)}>
                                    <option value="">Select a reason...</option>
                                    <option value="scamming">Scamming</option>
                                    <option value="harassment">Harassment</option>
                                    <option value="inappropriate_content">Inappropriate Content</option>
                                    <option value="exploiting">Exploiting</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: '0.75rem' }}>
                                <label className="section-label">Details (optional)</label>
                                <textarea className="input input--textarea" value={reportDetail} onChange={e => setReportDetail(e.target.value)} rows={3} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={submitReport} disabled={reporting || !reportReason} className="btn btn--danger btn--sm">
                                    {reporting ? '...' : 'Submit Report'}
                                </button>
                                <button onClick={() => setReportOpen(false)} className="btn btn--ghost btn--sm">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem' }}>
                    {/* Stats sidebar */}
                    <div>
                        <div className="card mb-4">
                            <div className="card__header"><h3 className="text-sm fw-700">Stats</h3></div>
                            <div>
                                <StatRow label="Kitties" value={profile.is_banned ? '—' : `${Number(profile.kitties ?? 0).toLocaleString()} K`} />
                                <StatRow label="Items"   value={inventory.length} />
                                <StatRow label="Friends" value={profile.friends_count ?? 0} />
                            </div>
                        </div>

                        {profile.is_banned && (
                            <div className="card">
                                <div className="card__body">
                                    <span className="badge badge--danger">Account Suspended</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Inventory */}
                    <div>
                        <div className="card">
                            <div className="card__header">
                                <h3 className="text-sm fw-700">Inventory</h3>
                                <span className="text-xs text-muted">{inventory.length} items</span>
                            </div>
                            <div className="card__body">
                                {inventory.length === 0 ? (
                                    <p className="text-sm text-muted">This user has no items.</p>
                                ) : (
                                    <div className="grid-4" style={{ gap: '0.5rem' }}>
                                        {inventory.slice(0, 20).map(ui => (
                                            <a key={ui.id} href={`/catalog/${ui.item_id}`} className="item-card">
                                                <div className="item-card__thumb">
                                                    {ui.item?.thumbnail_url
                                                        ? <img src={ui.item.thumbnail_url} alt={ui.item.name} />
                                                        : <div style={{ width: '100%', height: '100%', background: 'var(--bg-4)' }} />
                                                    }
                                                    {ui.item?.type === 'limited' && <span className="item-card__ltd">LTD</span>}
                                                </div>
                                                <div className="item-card__info">
                                                    <div className="item-card__name">{ui.item?.name ?? '?'}</div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function StatRow({ label, value }) {
    return (
        <div className="flex items-center justify-between" style={{ padding: '0.55rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm text-subtle">{label}</span>
            <span className="text-sm fw-600">{value}</span>
        </div>
    );
}
