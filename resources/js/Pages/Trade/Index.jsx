import { usePage, Link, router } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoPrivateChannel } from '@/hooks/useEchoChannel';

const STATUS_MAP = {
    pending:   { label: 'Pending',   cls: 'status--pending'   },
    completed: { label: 'Completed', cls: 'status--completed' },
    declined:  { label: 'Declined',  cls: 'status--declined'  },
    cancelled: { label: 'Cancelled', cls: 'status--cancelled' },
    expired:   { label: 'Expired',   cls: 'status--expired'   },
};

export default function TradeIndex({ trades }) {
    const auth = usePage().props;
    const user = auth?.user;

    useEchoPrivateChannel(
        user ? `trade.user.${user.id}` : null,
        '.trade.updated',
        () => router.reload({ only: ['trades'] })
    );

    const pending   = trades.data.filter(t => t.status === 'pending');
    const history   = trades.data.filter(t => t.status !== 'pending');

    return (
        <Layout>
            <div className="page page--narrow">
                <div className="page-header">
                    <div>
                        <h1>Trades</h1>
                        <div className="page-header__sub">Active and historical trades</div>
                    </div>
                    <Link href="/trade/create" className="btn btn--primary btn--sm">New Trade</Link>
                </div>

                {trades.data.length === 0 ? (
                    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <p className="text-muted">No trades yet.</p>
                        <Link href="/trade/create" className="btn btn--primary btn--sm" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
                            Start a trade
                        </Link>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {pending.length > 0 && (
                            <div>
                                <div className="section-label mb-2">Pending ({pending.length})</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {pending.map(t => <TradeRow key={t.id} trade={t} userId={user?.id} />)}
                                </div>
                            </div>
                        )}
                        {history.length > 0 && (
                            <div>
                                <div className="section-label mb-2">History</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {history.map(t => <TradeRow key={t.id} trade={t} userId={user?.id} />)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <Pagination links={trades.links} />
            </div>
        </Layout>
    );
}

function TradeRow({ trade, userId }) {
    const isSender = trade.sender_id === userId;
    const partner  = isSender ? trade.receiver : trade.sender;
    const sm       = STATUS_MAP[trade.status] ?? STATUS_MAP.expired;
    const sItems   = trade.sender_items?.length ?? 0;
    const rItems   = trade.receiver_items?.length ?? 0;
    const actionNeeded = trade.status === 'pending' && !isSender;

    return (
        <Link href={`/trade/${trade.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card--hover" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', position: 'relative' }}>
                {actionNeeded && (
                    <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)' }} />
                )}
                <UserAvatar user={partner} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>
                        {isSender ? `To ${partner?.name ?? '?'}` : `From ${partner?.name ?? '?'}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 1 }}>
                        {sItems} item{sItems !== 1 ? 's' : ''}
                        {trade.sender_kitties > 0 ? ` + ${Number(trade.sender_kitties).toLocaleString()} K` : ''}
                        {' for '}
                        {rItems} item{rItems !== 1 ? 's' : ''}
                        {trade.receiver_kitties > 0 ? ` + ${Number(trade.receiver_kitties).toLocaleString()} K` : ''}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{new Date(trade.created_at).toLocaleDateString()}</span>
                    <span className={`status ${sm.cls}`}>{sm.label}</span>
                </div>
            </div>
        </Link>
    );
}

function UserAvatar({ user, size = 28 }) {
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-4)', flexShrink: 0 }}>
            {user?.avatar_thumbnail
                ? <img src={user.avatar_thumbnail} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: 'var(--text-3)' }}>
                    {user?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
            }
        </div>
    );
}

function Pagination({ links }) {
    if (!links || links.length <= 3) return null;
    return (
        <div className="pagination">
            {links.map((l, i) => (
                <button key={i} disabled={!l.url || l.active} className={l.active ? 'active' : ''}
                    onClick={() => l.url && router.visit(l.url)} dangerouslySetInnerHTML={{ __html: l.label }}
                />
            ))}
        </div>
    );
}
