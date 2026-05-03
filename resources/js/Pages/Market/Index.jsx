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
        if (!confirm('Buy this item?')) return;
        setBusy(listingId);
        router.post(`/market/${listingId}/buy`, {}, { onFinish: () => setBusy(null) });
    }

    function handleCancel(listingId) {
        if (!confirm('Cancel your listing?')) return;
        router.post(`/market/${listingId}/cancel`);
    }

    return (
        <Layout>
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-white">Market</h1>
                        <p className="text-gray-400 text-sm mt-1">Buy and sell limited items between players</p>
                    </div>
                    {user && (
                        <a href="/avatar" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                            Manage inventory → Avatar
                        </a>
                    )}
                </div>

                {/* Search */}
                <div className="flex gap-2 mb-6">
                    <input
                        type="text"
                        placeholder="🔍 Search market…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && router.get('/market', { search }, { preserveState: true, replace: true })}
                        className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                        onClick={() => router.get('/market', { search }, { preserveState: true, replace: true })}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
                    >
                        Search
                    </button>
                </div>

                {/* Listings */}
                {listings.data.length === 0 ? (
                    <div className="text-center py-20">
                        <span className="text-5xl">📭</span>
                        <p className="text-gray-400 mt-4">No listings available.</p>
                        <a href="/catalog" className="text-indigo-400 text-sm mt-2 inline-block hover:underline">Browse catalog to find items →</a>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-white/10 bg-gray-800 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left">Item</th>
                                    <th className="px-4 py-3 text-left hidden sm:table-cell">Category</th>
                                    <th className="px-4 py-3 text-left hidden md:table-cell">Seller</th>
                                    <th className="px-4 py-3 text-right">Price</th>
                                    <th className="px-4 py-3 text-right hidden md:table-cell">RAP</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {listings.data.map(listing => (
                                    <tr key={listing.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {listing.item?.thumbnail_url ? (
                                                    <img src={listing.item.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-contain bg-gray-700" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg">🎁</div>
                                                )}
                                                <a href={`/catalog/${listing.item_id}`} className="font-semibold text-white hover:text-indigo-300 transition-colors">
                                                    {listing.item?.name ?? '—'}
                                                </a>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 capitalize hidden sm:table-cell">
                                            {listing.item?.category ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{listing.seller?.name ?? '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-black text-amber-400">{listing.price.toLocaleString()} K</span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500 text-xs hidden md:table-cell">
                                            {listing.item?.rap > 0 ? `${listing.item.rap.toLocaleString()} K` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {user && user.id === listing.seller_id ? (
                                                <button
                                                    onClick={() => handleCancel(listing.id)}
                                                    className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs font-semibold hover:bg-red-600/30 hover:text-red-300 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleBuy(listing.id)}
                                                    disabled={busy === listing.id}
                                                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-gray-900 text-xs font-bold hover:bg-amber-400 disabled:opacity-50 transition-colors"
                                                >
                                                    {busy === listing.id ? '…' : 'Buy'}
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
        <div className="flex flex-wrap gap-1 mt-6 justify-center">
            {links.map((link, i) => (
                <button key={i} disabled={!link.url || link.active} onClick={() => link.url && router.visit(link.url)}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${link.active ? 'bg-indigo-600 text-white font-bold' : !link.url ? 'text-gray-600 cursor-default' : 'bg-gray-800 text-gray-300 border border-white/10 hover:border-indigo-500/50 cursor-pointer'}`}
                />
            ))}
        </div>
    );
}
