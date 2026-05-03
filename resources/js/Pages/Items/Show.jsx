import { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoChannel } from '@/hooks/useEchoChannel';

export default function ItemShow({ item, priceHistory, cheapestListing }) {
    const auth = usePage().props;
    const user = auth?.user;
    const [listing,    setListing]    = useState(cheapestListing);
    const [buying,     setBuying]     = useState(false);
    const [purchasing, setPurchasing] = useState(false);

    useEchoChannel(`market.item.${item.id}`, '.market.updated', () =>
        router.reload({ only: ['cheapestListing', 'item'] })
    );

    function handlePurchase() {
        if (!user) { router.visit('/login'); return; }
        setPurchasing(true);
        router.post(`/catalog/${item.id}/purchase`, {}, { onFinish: () => setPurchasing(false) });
    }

    function handleBuy(listingId) {
        if (!user) { router.visit('/login'); return; }
        setBuying(true);
        router.post(`/market/${listingId}/buy`, {}, { onFinish: () => setBuying(false) });
    }

    const maxPrice = Math.max(...(priceHistory.map(p => p.price) || [1]), 1);

    return (
        <Layout>
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                    <a href="/catalog" className="hover:text-indigo-400 transition-colors">Catalog</a>
                    <span>/</span>
                    <span className="text-gray-300">{item.name}</span>
                </nav>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* ── Thumbnail ─────────────────────────────────────────── */}
                    <div>
                        <div className="rounded-2xl border border-white/10 bg-gray-800 overflow-hidden aspect-square flex items-center justify-center">
                            {item.thumbnail_url ? (
                                <img src={item.thumbnail_url} alt={item.name} className="w-full h-full object-contain" />
                            ) : (
                                <div
                                    className="w-full h-full flex items-center justify-center text-6xl"
                                    style={{ background: `linear-gradient(135deg, ${item.color_primary}33, transparent)` }}
                                >
                                    🎁
                                </div>
                            )}
                        </div>

                        {/* Color swatches */}
                        <div className="flex items-center gap-3 mt-3 px-1">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <div className="w-4 h-4 rounded-full border border-white/20" style={{ background: item.color_primary }} />
                                Primary
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <div className="w-4 h-4 rounded-full border border-white/20" style={{ background: item.color_secondary }} />
                                Secondary
                            </div>
                        </div>
                    </div>

                    {/* ── Info ──────────────────────────────────────────────── */}
                    <div>
                        <div className="flex items-start gap-3 mb-2">
                            <h1 className="text-3xl font-black text-white flex-1">{item.name}</h1>
                            {item.type === 'limited' && (
                                <span className="shrink-0 mt-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-gray-900 uppercase">
                                    Limited
                                </span>
                            )}
                        </div>

                        {item.description && (
                            <p className="text-gray-400 text-sm leading-relaxed mb-5">{item.description}</p>
                        )}

                        {/* Stats table */}
                        <div className="rounded-xl border border-white/10 bg-gray-800 divide-y divide-white/10 mb-5">
                            <StatRow label="Price"    value={item.price > 0 ? `${item.price.toLocaleString()} K` : 'Free'} accent />
                            <StatRow label="Category" value={item.category.charAt(0).toUpperCase() + item.category.slice(1)} />
                            <StatRow label="Creator"  value={item.creator?.name ?? 'System'} />
                            {item.type === 'limited' && <>
                                <StatRow label="Stock" value={`${item.stock_remaining ?? '?'} / ${item.stock ?? '?'} remaining`} />
                                <StatRow label="RAP"   value={item.rap > 0 ? `${item.rap.toLocaleString()} K` : 'No sales yet'} highlight />
                                {listing && <StatRow label="Lowest Resale" value={`${listing.price.toLocaleString()} K (by ${listing.seller?.name})`} highlight />}
                            </>}
                        </div>

                        {/* Purchase actions */}
                        {user ? (
                            <div className="flex flex-wrap gap-3">
                                {item.type === 'regular' && item.is_for_sale && (
                                    <button
                                        onClick={handlePurchase}
                                        disabled={purchasing}
                                        className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/25"
                                    >
                                        {purchasing ? 'Buying…' : `🛍 Buy — ${item.price.toLocaleString()} K`}
                                    </button>
                                )}
                                {item.type === 'limited' && listing && (
                                    <button
                                        onClick={() => handleBuy(listing.id)}
                                        disabled={buying}
                                        className="flex-1 py-3 rounded-xl bg-amber-500 text-gray-900 font-bold text-base hover:bg-amber-400 disabled:opacity-50 transition-all"
                                    >
                                        {buying ? 'Buying…' : `⭐ Buy — ${listing.price.toLocaleString()} K`}
                                    </button>
                                )}
                                {item.type === 'limited' && !listing && (
                                    <a
                                        href="/market"
                                        className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-bold text-base hover:bg-gray-600 transition-all text-center"
                                    >
                                        📈 Check Market
                                    </a>
                                )}
                                <a
                                    href="/trade"
                                    className="px-5 py-3 rounded-xl bg-gray-700 border border-white/10 text-gray-300 font-bold text-base hover:bg-gray-600 transition-all"
                                >
                                    🔄 Trade
                                </a>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-indigo-500/30 bg-indigo-600/10 p-4 text-center">
                                <p className="text-indigo-300 text-sm mb-3">Log in to purchase or trade this item.</p>
                                <div className="flex gap-3 justify-center">
                                    <a href="/login"    className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500 transition-colors">Log In</a>
                                    <a href="/register" className="px-5 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm font-bold hover:bg-gray-600 transition-colors">Sign Up</a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RAP Price History ─────────────────────────────────────── */}
                {item.type === 'limited' && priceHistory.length > 0 && (
                    <div className="mt-10">
                        <h2 className="text-xl font-extrabold text-white mb-4">📊 Price History (RAP)</h2>
                        <div className="rounded-2xl border border-white/10 bg-gray-800 p-5">
                            <div className="flex items-end gap-1 h-32">
                                {priceHistory.slice(-60).map((point, i) => (
                                    <div
                                        key={i}
                                        title={`${point.price.toLocaleString()} K — ${point.date}`}
                                        className="flex-1 min-w-[4px] rounded-t-sm bg-indigo-500 hover:bg-indigo-400 transition-colors cursor-default"
                                        style={{ height: `${Math.max(8, Math.round((point.price / maxPrice) * 100))}%` }}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-2">
                                <span>{priceHistory[0]?.date}</span>
                                <span>Current RAP: <strong className="text-amber-400">{item.rap.toLocaleString()} K</strong></span>
                                <span>{priceHistory[priceHistory.length - 1]?.date}</span>
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
        <div className="flex items-center justify-between px-4 py-3">
            <span className="text-gray-400 text-sm">{label}</span>
            <span className={`text-sm font-bold ${accent ? 'text-indigo-400 text-base' : highlight ? 'text-amber-400' : 'text-white'}`}>
                {value}
            </span>
        </div>
    );
}
