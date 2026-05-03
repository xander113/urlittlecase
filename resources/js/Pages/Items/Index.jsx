import { useState } from 'react';
import { usePage, router, Link } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoChannel } from '@/hooks/useEchoChannel';

const CATEGORIES = ['hat','face','shirt','pants','shoes','accessory','gear'];
const CAT_ICONS  = { hat:'🎩', face:'😊', shirt:'👕', pants:'👖', shoes:'👟', accessory:'📿', gear:'⚙️' };

export default function ItemsIndex({ items, filters }) {
    const [search,   setSearch]   = useState(filters.search   ?? '');
    const [category, setCategory] = useState(filters.category ?? '');
    const [type,     setType]     = useState(filters.type     ?? '');
    const [buying,   setBuying]   = useState(null);

    useEchoChannel('catalog', '.item.purchased', () => router.reload({ only: ['items'] }));

    function applyFilters() {
        router.get('/catalog', { search, category, type }, { preserveState: true, replace: true });
    }

    return (
        <Layout>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-white">Catalog</h1>
                        <p className="text-gray-400 text-sm mt-1">Browse and purchase items for your avatar</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <input
                        type="text"
                        placeholder="🔍 Search items…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyFilters()}
                        className="flex-1 min-w-[180px] bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <select
                        value={category}
                        onChange={e => { setCategory(e.target.value); }}
                        className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
                    >
                        <option value="">All Categories</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </select>
                    <select
                        value={type}
                        onChange={e => setType(e.target.value)}
                        className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
                    >
                        <option value="">All Types</option>
                        <option value="regular">Regular</option>
                        <option value="limited">⭐ Limited</option>
                    </select>
                    <button
                        onClick={applyFilters}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
                    >
                        Search
                    </button>
                </div>

                {/* Category pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <CategoryPill label="All" value="" current={category} onClick={() => { setCategory(''); router.get('/catalog', { search, type, category: '' }, { preserveState: true, replace: true }); }} />
                    {CATEGORIES.map(c => (
                        <CategoryPill key={c} label={`${CAT_ICONS[c]} ${c}`} value={c} current={category}
                            onClick={() => { setCategory(c); router.get('/catalog', { search, type, category: c }, { preserveState: true, replace: true }); }}
                        />
                    ))}
                </div>

                {/* Grid */}
                {items.data.length === 0 ? (
                    <div className="text-center py-20">
                        <span className="text-5xl">🔍</span>
                        <p className="text-gray-400 mt-4">No items found. Try different filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {items.data.map(item => (
                            <ItemCard key={item.id} item={item} buying={buying} setBuying={setBuying} />
                        ))}
                    </div>
                )}

                <Pagination links={items.links} />
            </div>
        </Layout>
    );
}

function CategoryPill({ label, value, current, onClick }) {
    const active = current === value;
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${
                active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 border border-white/10 hover:border-indigo-500/50 hover:text-white'
            }`}
        >
            {label}
        </button>
    );
}

function ItemCard({ item }) {
    return (
        <Link
            href={`/catalog/${item.id}`}
            className="group block rounded-xl border border-white/10 bg-gray-800 hover:border-indigo-500/40 transition-all overflow-hidden"
        >
            <div className="relative aspect-square bg-gray-700 overflow-hidden">
                {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt={item.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${item.color_primary ?? '#6366f1'}33, transparent)` }}>
                        <span className="text-4xl">🎁</span>
                    </div>
                )}
                {item.type === 'limited' && (
                    <div className="absolute top-1.5 right-1.5">
                        <span className="px-1.5 py-0.5 rounded text-xs font-black bg-amber-500 text-gray-900">LTD</span>
                    </div>
                )}
                {item.stock_remaining !== null && item.stock_remaining <= 5 && item.stock_remaining > 0 && (
                    <div className="absolute bottom-1.5 left-1.5">
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white">{item.stock_remaining} left!</span>
                    </div>
                )}
            </div>
            <div className="p-2.5">
                <p className="text-white text-xs font-semibold truncate">{item.name}</p>
                <p className="text-indigo-400 text-xs font-bold mt-0.5">{item.price > 0 ? `${item.price.toLocaleString()} K` : 'Free'}</p>
                {item.type === 'limited' && item.rap > 0 && (
                    <p className="text-amber-400 text-xs">RAP {item.rap.toLocaleString()}</p>
                )}
            </div>
        </Link>
    );
}

function Pagination({ links }) {
    if (!links || links.length <= 3) return null;
    return (
        <div className="flex flex-wrap gap-1 mt-8 justify-center">
            {links.map((link, i) => (
                <button
                    key={i}
                    disabled={!link.url || link.active}
                    onClick={() => link.url && router.visit(link.url)}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        link.active  ? 'bg-indigo-600 text-white font-bold' :
                        !link.url    ? 'text-gray-600 cursor-default' :
                        'bg-gray-800 text-gray-300 border border-white/10 hover:border-indigo-500/50 hover:text-white cursor-pointer'
                    }`}
                />
            ))}
        </div>
    );
}
