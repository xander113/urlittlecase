import { useState } from 'react';
import { router, Link } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoChannel } from '@/hooks/useEchoChannel';

const CATEGORIES = ['hat','face','shirt','pants','shoes','accessory','gear'];

export default function ItemsIndex({ items, filters }) {
    const [search,   setSearch]   = useState(filters.search   ?? '');
    const [category, setCategory] = useState(filters.category ?? '');
    const [type,     setType]     = useState(filters.type     ?? '');

    useEchoChannel('catalog', '.item.purchased', () => router.reload({ only: ['items'] }));

    function apply(overrides = {}) {
        router.get('/catalog', { search, category, type, ...overrides }, { preserveState: true, replace: true });
    }

    return (
        <Layout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <h1>Catalog</h1>
                        <div className="page-header__sub">Browse and purchase items</div>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <input
                        type="text"
                        className="input"
                        style={{ flex: '1 1 200px', maxWidth: 280 }}
                        placeholder="Search items..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && apply()}
                    />
                    <select className="input" style={{ width: 'auto' }} value={category} onChange={e => { setCategory(e.target.value); apply({ category: e.target.value }); }}>
                        <option value="">All Categories</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </select>
                    <select className="input" style={{ width: 'auto' }} value={type} onChange={e => { setType(e.target.value); apply({ type: e.target.value }); }}>
                        <option value="">All Types</option>
                        <option value="regular">Regular</option>
                        <option value="limited">Limited</option>
                    </select>
                    <button className="btn btn--primary" onClick={() => apply()}>Search</button>
                </div>

                {/* Category pills */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    {['', ...CATEGORIES].map(c => (
                        <button
                            key={c || 'all'}
                            onClick={() => { setCategory(c); apply({ category: c }); }}
                            style={{
                                padding: '0.25rem 0.7rem',
                                borderRadius: 'var(--r-sm)',
                                border: '1px solid var(--border)',
                                background: category === c ? 'var(--accent)' : 'var(--bg-2)',
                                color: category === c ? 'var(--accent-text)' : 'var(--text-2)',
                                fontSize: '0.78rem',
                                fontWeight: category === c ? 700 : 400,
                                cursor: 'pointer',
                                transition: 'all var(--t)',
                            }}
                        >
                            {c ? c.charAt(0).toUpperCase()+c.slice(1) : 'All'}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                {items.data.length === 0 ? (
                    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <p className="text-muted">No items found. Try different filters.</p>
                    </div>
                ) : (
                    <div className="grid-6">
                        {items.data.map(item => <ItemCard key={item.id} item={item} />)}
                    </div>
                )}

                <Pagination links={items.links} />
            </div>
        </Layout>
    );
}

function ItemCard({ item }) {
    return (
        <Link href={`/catalog/${item.id}`} className="item-card">
            <div className="item-card__thumb">
                {item.thumbnail_url
                    ? <img src={item.thumbnail_url} alt={item.name} />
                    : <ColorSwatch primary={item.color_primary} secondary={item.color_secondary} />
                }
                {item.type === 'limited' && <span className="item-card__ltd">LTD</span>}
                {item.stock_remaining <= 5 && item.stock_remaining > 0 && item.stock !== null && (
                    <span style={{ position: 'absolute', bottom: 4, left: 4, background: 'var(--danger)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '1px 4px', borderRadius: '2px' }}>
                        {item.stock_remaining} left
                    </span>
                )}
            </div>
            <div className="item-card__info">
                <div className="item-card__name">{item.name}</div>
                <div className="item-card__price">{item.price > 0 ? `${Number(item.price).toLocaleString()} K` : 'Free'}</div>
                {item.type === 'limited' && item.rap > 0 && (
                    <div className="item-card__rap">RAP {Number(item.rap).toLocaleString()}</div>
                )}
            </div>
        </Link>
    );
}

function ColorSwatch({ primary, secondary }) {
    return (
        <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${primary ?? '#888'} 50%, ${secondary ?? '#555'} 50%)` }} />
    );
}

function Pagination({ links }) {
    if (!links || links.length <= 3) return null;
    return (
        <div className="pagination">
            {links.map((l, i) => (
                <button
                    key={i}
                    disabled={!l.url || l.active}
                    className={l.active ? 'active' : ''}
                    onClick={() => l.url && router.visit(l.url)}
                    dangerouslySetInnerHTML={{ __html: l.label }}
                />
            ))}
        </div>
    );
}
