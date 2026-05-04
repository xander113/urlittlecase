import { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoChannel } from '@/hooks/useEchoChannel';

export default function ItemShow({ item, priceHistory, cheapestListing }) {
    const auth = usePage().props;
    const user = auth?.user;

    const [listing,    setListing]    = useState(cheapestListing);
    const [purchasing, setPurchasing] = useState(false);
    const [buying,     setBuying]     = useState(false);

    useEchoChannel(`market.item.${item.id}`, '.market.updated', () =>
        router.reload({ only: ['cheapestListing', 'item'] })
    );

    function purchase() {
        if (!user) { router.visit('/login'); return; }
        setPurchasing(true);
        router.post(`/catalog/${item.id}/purchase`, {}, { onFinish: () => setPurchasing(false) });
    }

    function buy(listingId) {
        if (!user) { router.visit('/login'); return; }
        setBuying(true);
        router.post(`/market/${listingId}/buy`, {}, { onFinish: () => setBuying(false) });
    }

    const maxPrice = Math.max(...(priceHistory.map(p => p.price) || [1]), 1);

    return (
        <Layout>
            <div className="page">
                {/* Breadcrumb */}
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>
                    <a href="/catalog" style={{ color: 'var(--text-3)' }}>Catalog</a>
                    <span>/</span>
                    <span style={{ color: 'var(--text-2)' }}>{item.name}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>

                    {/* Thumbnail */}
                    <div>
                        <div style={{
                            aspectRatio: '1', borderRadius: 'var(--r-lg)',
                            border: '1px solid var(--border)', background: 'var(--bg-3)',
                            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '0.75rem',
                        }}>
                            {item.thumbnail_url
                                ? <img src={item.thumbnail_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${item.color_primary}44, ${item.color_secondary}44)` }} />
                            }
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: item.color_primary, border: '1px solid var(--border)' }} />
                            <span>{item.color_primary}</span>
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: item.color_secondary, border: '1px solid var(--border)', marginLeft: '0.5rem' }} />
                            <span>{item.color_secondary}</span>
                        </div>
                    </div>

                    {/* Info */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                            <h1 style={{ flex: 1 }}>{item.name}</h1>
                            {item.type === 'limited' && <span className="badge badge--ltd">Limited</span>}
                        </div>

                        {item.description && (
                            <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                                {item.description}
                            </p>
                        )}

                        {/* Stats */}
                        <div className="card" style={{ marginBottom: '1.25rem' }}>
                            <table className="table">
                                <tbody>
                                    <StatRow label="Price"    value={item.price > 0 ? `${Number(item.price).toLocaleString()} K` : 'Free'} accent />
                                    <StatRow label="Category" value={item.category.charAt(0).toUpperCase() + item.category.slice(1)} />
                                    <StatRow label="Creator"  value={item.creator?.name ?? 'System'} />
                                    {item.type === 'limited' && <>
                                        <StatRow label="Stock" value={`${item.stock_remaining ?? '?'} / ${item.stock ?? '?'} remaining`} />
                                        <StatRow label="RAP"   value={item.rap > 0 ? `${Number(item.rap).toLocaleString()} K` : 'No sales yet'} highlight />
                                        {listing && <StatRow label="Lowest Resale" value={`${Number(listing.price).toLocaleString()} K — ${listing.seller?.name}`} highlight />}
                                    </>}
                                </tbody>
                            </table>
                        </div>

                        {/* Actions */}
                        {user ? (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {item.type === 'regular' && item.is_for_sale && (
                                    <button onClick={purchase} disabled={purchasing} className="btn btn--primary btn--lg">
                                        {purchasing ? 'Purchasing...' : `Buy — ${Number(item.price).toLocaleString()} K`}
                                    </button>
                                )}
                                {item.type === 'limited' && listing && (
                                    <button onClick={() => buy(listing.id)} disabled={buying} className="btn btn--primary btn--lg">
                                        {buying ? 'Purchasing...' : `Buy Resale — ${Number(listing.price).toLocaleString()} K`}
                                    </button>
                                )}
                                {item.type === 'limited' && !listing && (
                                    <a href="/market" className="btn btn--secondary btn--lg">Check Market</a>
                                )}
                                <a href="/trade" className="btn btn--ghost btn--lg">Trade</a>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                                <p className="text-sm text-muted" style={{ marginBottom: '0.75rem' }}>Log in to purchase or trade this item.</p>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                    <a href="/login"    className="btn btn--primary btn--sm">Log In</a>
                                    <a href="/register" className="btn btn--ghost btn--sm">Sign Up</a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RAP Chart */}
                {item.type === 'limited' && priceHistory.length > 0 && (
                    <div style={{ marginTop: '2rem' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Price History</h2>
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px', borderBottom: '1px solid var(--border)' }}>
                                {priceHistory.slice(-60).map((p, i) => (
                                    <div
                                        key={i}
                                        title={`${Number(p.price).toLocaleString()} K — ${p.date}`}
                                        style={{
                                            flex: 1, minWidth: 3,
                                            background: 'var(--accent)',
                                            borderRadius: '2px 2px 0 0',
                                            height: `${Math.max(4, Math.round((p.price / maxPrice) * 100))}%`,
                                            cursor: 'default',
                                            opacity: 0.85,
                                        }}
                                    />
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.4rem' }}>
                                <span>{priceHistory[0]?.date}</span>
                                <span>Current RAP: <strong style={{ color: 'var(--warn)' }}>{Number(item.rap).toLocaleString()} K</strong></span>
                                <span>{priceHistory[priceHistory.length-1]?.date}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

function StatRow({ label, value, accent, highlight }) {
    return (
        <tr>
            <td style={{ width: 130, color: 'var(--text-3)', fontWeight: 400 }}>{label}</td>
            <td style={{ fontWeight: 600, color: accent ? 'var(--accent)' : highlight ? 'var(--warn)' : 'var(--text)' }}>
                {value}
            </td>
        </tr>
    );
}
