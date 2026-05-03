import { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoPrivateChannel } from '@/hooks/useEchoChannel';

const STATUS = {
    pending:   { label: 'Pending',   icon: '⏳', color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
    completed: { label: 'Completed', icon: '✅', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
    declined:  { label: 'Declined',  icon: '❌', color: 'text-red-300 bg-red-500/10 border-red-500/30'       },
    cancelled: { label: 'Cancelled', icon: '🚫', color: 'text-gray-400 bg-gray-700/30 border-gray-600/30'   },
    expired:   { label: 'Expired',   icon: '⌛', color: 'text-gray-500 bg-gray-700/20 border-gray-700/20'   },
};

export default function TradeShow({ trade }) {
    const auth = usePage().props;
    const user = auth?.user;
    const [busy, setBusy] = useState(false);

    const isSender   = trade.sender_id   === user?.id;
    const isReceiver = trade.receiver_id === user?.id;
    const isPending  = trade.status === 'pending';
    const s          = STATUS[trade.status] ?? STATUS.expired;

    useEchoPrivateChannel(
        user ? `trade.user.${user.id}` : null,
        '.trade.updated',
        data => { if (data.trade_id === trade.id) router.reload({ only: ['trade'] }); }
    );

    function act(url) {
        setBusy(true);
        router.post(url, {}, { onFinish: () => setBusy(false) });
    }

    return (
        <Layout>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <a href="/trade" className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </a>
                    <div className="flex-1">
                        <h1 className="text-2xl font-black text-white">Trade #{trade.id}</h1>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full border text-sm font-bold ${s.color}`}>
                        {s.icon} {s.label}
                    </span>
                </div>

                {/* Note */}
                {trade.sender_note && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-5 flex gap-2 text-sm">
                        <span className="text-amber-400 shrink-0">💬</span>
                        <p className="text-amber-200/80">{trade.sender_note}</p>
                    </div>
                )}

                {/* Trade parties */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-start mb-6">
                    <PartyCard
                        label={`${trade.sender?.name ?? '?'} offers`}
                        user={trade.sender}
                        items={trade.sender_items}
                        kitties={trade.sender_kitties}
                        highlight={isSender}
                    />
                    <div className="flex justify-center items-center py-4 text-3xl text-gray-600">⇄</div>
                    <PartyCard
                        label={`${trade.receiver?.name ?? '?'} offers`}
                        user={trade.receiver}
                        items={trade.receiver_items}
                        kitties={trade.receiver_kitties}
                        highlight={isReceiver}
                    />
                </div>

                {/* Timestamps */}
                <div className="text-xs text-gray-500 mb-6 flex gap-4 flex-wrap">
                    <span>Created: {new Date(trade.created_at).toLocaleString()}</span>
                    {trade.expires_at && isPending && (
                        <span className="text-amber-500">Expires: {new Date(trade.expires_at).toLocaleString()}</span>
                    )}
                </div>

                {/* Actions */}
                {isPending && (
                    <div className="rounded-2xl border border-white/10 bg-gray-800 p-5">
                        <h3 className="text-sm font-bold text-gray-300 mb-4">Your Response</h3>
                        <div className="flex flex-wrap gap-3">
                            {isReceiver && (
                                <>
                                    <button
                                        disabled={busy}
                                        onClick={() => act(`/trade/${trade.id}/accept`)}
                                        className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-50 transition-all"
                                    >
                                        {busy ? '…' : '✅ Accept Trade'}
                                    </button>
                                    <button
                                        disabled={busy}
                                        onClick={() => act(`/trade/${trade.id}/decline`)}
                                        className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-bold hover:bg-red-600/30 hover:text-red-300 disabled:opacity-50 transition-all"
                                    >
                                        {busy ? '…' : '❌ Decline'}
                                    </button>
                                </>
                            )}
                            {isSender && (
                                <button
                                    disabled={busy}
                                    onClick={() => act(`/trade/${trade.id}/cancel`)}
                                    className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-bold hover:bg-gray-600 disabled:opacity-50 transition-all"
                                >
                                    {busy ? '…' : '🚫 Cancel Trade'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

function PartyCard({ label, user, items = [], kitties = 0, highlight }) {
    return (
        <div className={`rounded-2xl border p-4 ${highlight ? 'border-indigo-500/40 bg-indigo-600/5' : 'border-white/10 bg-gray-800'}`}>
            <div className="flex items-center gap-2 mb-3">
                {user?.avatar_thumbnail ? (
                    <img src={user.avatar_thumbnail} alt={user.name} className="w-8 h-8 rounded-full object-cover bg-gray-700" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs font-bold">
                        {user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                )}
                <h3 className="text-sm font-bold text-gray-300">{label}</h3>
            </div>

            {items.length === 0 && kitties === 0 ? (
                <p className="text-gray-600 text-sm italic text-center py-4">Nothing offered</p>
            ) : (
                <div className="space-y-2">
                    {kitties > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <span className="text-amber-400 font-black text-sm">🐱 {kitties.toLocaleString()} K</span>
                        </div>
                    )}
                    {items.map(ti => (
                        <div key={ti.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-700/50">
                            {ti.user_item?.item?.thumbnail_url ? (
                                <img src={ti.user_item.item.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-contain bg-gray-600" />
                            ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-600 flex items-center justify-center text-xl">🎁</div>
                            )}
                            <div>
                                <p className="text-white text-sm font-medium">{ti.user_item?.item?.name ?? 'Unknown'}</p>
                                {ti.user_item?.item?.rap > 0 && (
                                    <p className="text-amber-400 text-xs">RAP: {ti.user_item.item.rap.toLocaleString()} K</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
