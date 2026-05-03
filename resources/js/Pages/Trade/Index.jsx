import { usePage, router, Link } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoPrivateChannel } from '@/hooks/useEchoChannel';

const STATUS = {
    pending:   { label: 'Pending',   color: 'bg-amber-500/20 text-amber-300 border-amber-500/30'   },
    completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    declined:  { label: 'Declined',  color: 'bg-red-500/20 text-red-300 border-red-500/30'         },
    cancelled: { label: 'Cancelled', color: 'bg-gray-600/30 text-gray-400 border-gray-500/20'     },
    expired:   { label: 'Expired',   color: 'bg-gray-600/20 text-gray-500 border-gray-600/20'     },
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
    const completed = trades.data.filter(t => t.status !== 'pending');

    return (
        <Layout>
            <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-white">Trades</h1>
                        <p className="text-gray-400 text-sm mt-1">Manage your item trades</p>
                    </div>
                    <Link
                        href="/trade/create"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <span>＋</span> New Trade
                    </Link>
                </div>

                {trades.data.length === 0 ? (
                    <div className="text-center py-20">
                        <span className="text-5xl">🤝</span>
                        <p className="text-gray-400 mt-4">No trades yet.</p>
                        <Link href="/trade/create" className="text-indigo-400 text-sm mt-2 inline-block hover:underline">Start your first trade →</Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {pending.length > 0 && (
                            <div>
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Pending ({pending.length})</h2>
                                <div className="space-y-2">
                                    {pending.map(t => <TradeRow key={t.id} trade={t} currentUserId={user?.id} />)}
                                </div>
                            </div>
                        )}
                        {completed.length > 0 && (
                            <div>
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">History</h2>
                                <div className="space-y-2">
                                    {completed.map(t => <TradeRow key={t.id} trade={t} currentUserId={user?.id} />)}
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

function TradeRow({ trade, currentUserId }) {
    const isSender = trade.sender_id === currentUserId;
    const partner  = isSender ? trade.receiver : trade.sender;
    const s        = STATUS[trade.status] ?? STATUS.expired;

    const senderCount   = trade.sender_items?.length   ?? 0;
    const receiverCount = trade.receiver_items?.length ?? 0;

    return (
        <Link href={`/trade/${trade.id}`} className="block group">
            <div className="rounded-xl border border-white/10 bg-gray-800 p-4 hover:border-indigo-500/40 transition-all group-hover:bg-gray-750">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        {/* Partner avatar */}
                        {partner?.avatar_thumbnail ? (
                            <img src={partner.avatar_thumbnail} alt={partner.name} className="w-10 h-10 rounded-full object-cover bg-gray-700 shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {partner?.name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                        )}
                        <div>
                            <div className="text-white font-semibold text-sm">
                                {isSender ? `→ to ${partner?.name ?? '?'}` : `← from ${partner?.name ?? '?'}`}
                            </div>
                            <div className="text-gray-500 text-xs mt-0.5">
                                {new Date(trade.created_at).toLocaleDateString()}
                                {trade.status === 'pending' && trade.expires_at && (
                                    <span className="text-amber-500 ml-2">· expires {new Date(trade.expires_at).toLocaleDateString()}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-gray-400 text-xs">
                            {senderCount} item{senderCount !== 1 ? 's' : ''}
                            {trade.sender_kitties > 0 && ` + ${trade.sender_kitties.toLocaleString()}K`}
                            {' ↔ '}
                            {receiverCount} item{receiverCount !== 1 ? 's' : ''}
                            {trade.receiver_kitties > 0 && ` + ${trade.receiver_kitties.toLocaleString()}K`}
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${s.color}`}>
                            {s.label}
                        </span>
                        {trade.status === 'pending' && !isSender && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Action needed" />
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}

function Pagination({ links }) {
    if (!links || links.length <= 3) return null;
    return (
        <div className="flex flex-wrap gap-1 mt-6 justify-center">
            {links.map((link, i) => (
                <button key={i} disabled={!link.url || link.active} onClick={() => link.url && router.visit(link.url)}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                    className={`px-3 py-1.5 rounded-lg text-sm ${link.active ? 'bg-indigo-600 text-white font-bold' : !link.url ? 'text-gray-600 cursor-default' : 'bg-gray-800 text-gray-300 border border-white/10 hover:border-indigo-500/50 cursor-pointer'}`}
                />
            ))}
        </div>
    );
}
