import { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoPrivateChannel } from '@/hooks/useEchoChannel';

const STATUS_MAP = {
    pending:   { label: 'Pending',   cls: 'status--pending'   },
    completed: { label: 'Completed', cls: 'status--completed' },
    declined:  { label: 'Declined',  cls: 'status--declined'  },
    cancelled: { label: 'Cancelled', cls: 'status--cancelled' },
    expired:   { label: 'Expired',   cls: 'status--expired'   },
};

export default function TradeShow({ trade }) {
    const auth = usePage().props;
    const user = auth?.user;
    const [busy, setBusy] = useState(false);

    const isSender   = trade.sender_id   === user?.id;
    const isReceiver = trade.receiver_id === user?.id;
    const isPending  = trade.status === 'pending';
    const sm         = STATUS_MAP[trade.status] ?? STATUS_MAP.expired;

    useEchoPrivateChannel(
        user ? `trade.user.${user.id}` : null,
        '.trade.updated',
        d => { if (d.trade_id === trade.id) router.reload({ only: ['trade'] }); }
    );

    function act(url) {
        setBusy(true);
        router.post(url, {}, { onFinish: () => setBusy(false) });
    }

    return (
        <Layout>
            <div className="page page--narrow">
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    <a href="/trade" style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </a>
                    <h1 style={{ flex: 1 }}>Trade #{trade.id}</h1>
                    <span className={`status ${sm.cls}`}>{sm.label}</span>
                </div>

                {/* Note */}
                {trade.sender_note && (
                    <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderLeft: '3px solid var(--accent)', borderRadius: '0 var(--r-md) var(--r-md) 0' }}>
                        <p className="text-sm text-subtle">{trade.sender_note}</p>
                    </div>
                )}

                {/* Parties */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'start', marginBottom: '1.25rem' }}>
                    <PartyCard label={`${trade.sender?.name ?? '?'} offers`} user={trade.sender} items={trade.sender_items} kitties={trade.sender_kitties} isYou={isSender} />
                    <div style={{ fontSize: '1.5rem', color: 'var(--text-3)', paddingTop: '2.5rem', textAlign: 'center' }}>&harr;</div>
                    <PartyCard label={`${trade.receiver?.name ?? '?'} offers`} user={trade.receiver} items={trade.receiver_items} kitties={trade.receiver_kitties} isYou={isReceiver} />
                </div>

                {/* Meta */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <span>Created: {new Date(trade.created_at).toLocaleString()}</span>
                    {trade.expires_at && isPending && <span style={{ color: 'var(--warn)' }}>Expires: {new Date(trade.expires_at).toLocaleString()}</span>}
                </div>

                {/* Actions */}
                {isPending && (
                    <div className="card" style={{ padding: '1rem' }}>
                        <div className="section-label mb-2">Your Action</div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {isReceiver && <>
                                <button disabled={busy} onClick={() => act(`/trade/${trade.id}/accept`)} className="btn btn--primary">
                                    {busy ? '...' : 'Accept Trade'}
                                </button>
                                <button disabled={busy} onClick={() => act(`/trade/${trade.id}/decline`)} className="btn btn--ghost">
                                    {busy ? '...' : 'Decline'}
                                </button>
                            </>}
                            {isSender && (
                                <button disabled={busy} onClick={() => act(`/trade/${trade.id}/cancel`)} className="btn btn--ghost">
                                    {busy ? '...' : 'Cancel Trade'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

function PartyCard({ label, user, items = [], kitties = 0, isYou }) {
    return (
        <div className="card" style={{ border: isYou ? '1px solid var(--accent)' : undefined }}>
            <div className="card__header" style={{ padding: '0.65rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-4)', flexShrink: 0 }}>
                        {user?.avatar_thumbnail
                            ? <img src={user.avatar_thumbnail} alt={user?.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)' }}>
                                {user?.name?.[0]?.toUpperCase() ?? '?'}
                              </div>
                        }
                    </div>
                    <span className="text-sm fw-600">{label}</span>
                </div>
            </div>
            <div className="card__body" style={{ padding: '0.75rem 1rem' }}>
                {items.length === 0 && kitties === 0 && (
                    <p className="text-sm text-muted">Nothing offered</p>
                )}
                {kitties > 0 && (
                    <div style={{ fontWeight: 800, color: 'var(--warn)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        {Number(kitties).toLocaleString()} K
                    </div>
                )}
                {items.map(ti => (
                    <div key={ti.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-4)', overflow: 'hidden', flexShrink: 0 }}>
                            {ti.user_item?.item?.thumbnail_url && <img src={ti.user_item.item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                        </div>
                        <div>
                            <div className="text-sm fw-600">{ti.user_item?.item?.name ?? 'Unknown'}</div>
                            {ti.user_item?.item?.rap > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--warn)' }}>RAP {Number(ti.user_item.item.rap).toLocaleString()} K</div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
