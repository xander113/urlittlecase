import { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoChannel } from '@/hooks/useEchoChannel';

export default function MarketIndex({ listings, filters }) {
    const auth = usePage().props;
    const user = auth?.user;
    const [search, setSearch] = useState(filters.search ?? '');
    const [busy,   setBusy]   = useState(null);

    useEchoChannel('market.item.*', '.market.updated', () => router.reload({ only: ['listings'] }));

    function handleBuy(listingId) {
        if (!user) { router.visit('/login'); return; }
        if (!confirm('Purchase this item?')) return;
        setBusy(listingId);
        router.post(`/market/${listingId}/buy`, {}, { onFinish: () => setBusy(null) });
    }

    function handleCancel(listingId) {
        if (!confirm('Cancel this listing?')) return;
        router.post(`/market/${listingId}/cancel`);
    }

    return (
        <Layout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <h1>Market</h1>
                        <div className="page-header__sub">Buy and sell limited items</div>
                    </div>
                    {user && <a href="/avatar" className="btn btn--ghost btn--sm">Sell from Inventory</a>}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <input
                        type="text" className="input"
                        placeholder="Search market..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && router.get('/market', { search }, { preserveState: true, replace: true })}
                        style={{ maxWidth: 320 }}
                    />
                    <button className="btn btn--primary" onClick={() => router.get('/market', { search }, { preserveState: true, replace: true })}>
                        Search
                    </button>
                </div>

                {listings.data.length === 0 ? (
                    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <p className="text-muted">No listings available.</p>
                        <a href="/catalog" className="btn btn--ghost btn--sm" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>Browse Catalog</a>
                    </div>
                ) : (
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th>Seller</th>
                                    <th style={{ textAlign: 'right' }}>Price</th>
                                    <th style={{ textAlign: 'right' }}>RAP</th>
                                    <th style={{ textAlign: 'right' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {listings.data.map(l => (
                                    <tr key={l.id}>
                                        <td style={{ textAlign: 'left' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: 'var(--r-sm)',
                                                    background: `linear-gradient(135deg, ${l.item?.color_primary ?? '#888'} 50%, ${l.item?.color_secondary ?? '#555'} 50%)`,
                                                    border: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden',
                                                }}>
                                                    {l.item?.thumbnail_url && <img src={l.item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                                </div>
                                                <a href={`/catalog/${l.item_id}`} style={{ fontWeight: 600, color: 'var(--text)' }}>{l.item?.name ?? '—'}</a>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'left', color: 'var(--text-3)', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                                            {l.item?.category ?? '—'}
                                        </td>
                                        <td style={{ textAlign: 'left' }}>
                                            <a href={`/users/${l.seller?.name}`} style={{ color: 'var(--text-2)' }}>{l.seller?.name ?? '—'}</a>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>
                                            {Number(l.price).toLocaleString()} K
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-3)' }}>
                                            {l.item?.rap > 0 ? `${Number(l.item.rap).toLocaleString()} K` : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {user && user.id === l.seller_id ? (
                                                <button onClick={() => handleCancel(l.id)} className="btn btn--ghost btn--sm">Cancel</button>
                                            ) : (
                                                <button
                                                    onClick={() => handleBuy(l.id)}
                                                    disabled={busy === l.id || !user}
                                                    className="btn btn--primary btn--sm"
                                                >
                                                    {busy === l.id ? '...' : 'Buy'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <Pagination links={listings.links} />
            </div>
        </Layout>
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
