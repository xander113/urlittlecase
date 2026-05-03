import { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import Layout from '@/Root';

export default function TradeCreate({ myItems, partner, balance }) {
    const auth = usePage().props;
    const user = auth?.user;

    const [partnerSearch,  setPartnerSearch]  = useState(partner?.name ?? '');
    const [partnerData,    setPartnerData]    = useState(partner ?? null);
    const [searchResults,  setSearchResults]  = useState([]);
    const [searching,      setSearching]      = useState(false);
    const [mySelected,     setMySelected]     = useState([]);
    const [theirSelected,  setTheirSelected]  = useState([]);
    const [myKitties,      setMyKitties]      = useState(0);
    const [theirKitties,   setTheirKitties]   = useState(0);
    const [note,           setNote]           = useState('');
    const [submitting,     setSubmitting]     = useState(false);

    async function searchPartner() {
        if (partnerSearch.trim().length < 2) return;
        setSearching(true);
        try {
            const res = await window.axios.get('/staff/users/search', { params: { q: partnerSearch } });
            setSearchResults(res.data.filter(u => u.id !== user?.id));
        } catch { setSearchResults([]); }
        finally { setSearching(false); }
    }

    async function selectPartner(u) {
        setPartnerData(u);
        setPartnerSearch(u.name);
        setSearchResults([]);
        setTheirSelected([]);
        // Fetch their tradeable items
        try {
            const res = await window.axios.get(`/trade/create?user_id=${u.id}`, {
                headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '' }
            });
            if (res.data?.props?.partner?.items) {
                setPartnerData({ ...u, items: res.data.props.partner.items });
            }
        } catch { /* fallback: partner.items may be empty */ }
    }

    function toggleMyItem(id) {
        setMySelected(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
        );
    }

    function toggleTheirItem(id) {
        setTheirSelected(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
        );
    }

    function submitTrade(e) {
        e.preventDefault();
        if (!partnerData || mySelected.length === 0 || theirSelected.length === 0) return;
        setSubmitting(true);
        router.post('/trade', {
            receiver_id:      partnerData.id,
            sender_item_ids:  mySelected,
            receiver_item_ids: theirSelected,
            sender_kitties:   myKitties   || 0,
            receiver_kitties: theirKitties || 0,
            sender_note:      note || null,
        }, { onFinish: () => setSubmitting(false) });
    }

    return (
        <Layout>
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <a href="/trade" className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </a>
                    <div>
                        <h1 className="text-3xl font-black text-white">New Trade</h1>
                        <p className="text-gray-400 text-sm">Offer limited items to another player</p>
                    </div>
                </div>

                {/* Partner Search */}
                <div className="rounded-2xl border border-white/10 bg-gray-800 p-5 mb-6">
                    <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-3">1. Who do you want to trade with?</h2>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Search by username…"
                            value={partnerSearch}
                            onChange={e => setPartnerSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && searchPartner()}
                            className="flex-1 bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button onClick={searchPartner} disabled={searching} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors">
                            {searching ? '…' : 'Find'}
                        </button>
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-2 rounded-xl border border-white/10 bg-gray-900 overflow-hidden">
                            {searchResults.map(u => (
                                <button key={u.id} onClick={() => selectPartner(u)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0">
                                    <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                        {u.name?.[0]?.toUpperCase()}
                                    </span>
                                    <span className="text-white text-sm font-medium">{u.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {partnerData && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
                            <span>✓</span> Trading with <strong>{partnerData.name}</strong>
                        </div>
                    )}
                </div>

                {partnerData && (
                    <>
                        {/* Item selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <ItemSelector
                                title="Your Items"
                                subtitle="Select up to 4 items to offer"
                                items={myItems}
                                selected={mySelected}
                                onToggle={toggleMyItem}
                                emptyMsg="You have no tradeable limited items."
                            />
                            <ItemSelector
                                title={`${partnerData.name}'s Items`}
                                subtitle="Select up to 4 items to request"
                                items={partnerData.items ?? []}
                                selected={theirSelected}
                                onToggle={toggleTheirItem}
                                emptyMsg="This user has no tradeable limited items."
                            />
                        </div>

                        {/* Kitties + note */}
                        <div className="rounded-2xl border border-white/10 bg-gray-800 p-5 mb-6">
                            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-4">3. Add Kitties (optional)</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">You add (balance: {Number(balance).toLocaleString()} K)</label>
                                    <input
                                        type="number" min={0} max={balance}
                                        value={myKitties}
                                        onChange={e => setMyKitties(Number(e.target.value))}
                                        className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">They add (Kitties requested)</label>
                                    <input
                                        type="number" min={0}
                                        value={theirKitties}
                                        onChange={e => setTheirKitties(Number(e.target.value))}
                                        className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Note (optional)</label>
                                <textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    maxLength={300}
                                    placeholder="Add a message to your trade offer…"
                                    className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                                    rows={2}
                                />
                            </div>
                        </div>

                        {/* Summary + submit */}
                        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-600/10 p-5">
                            <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-3">Trade Summary</h2>
                            <div className="flex flex-col sm:flex-row gap-4 mb-4 text-sm">
                                <div className="flex-1 bg-gray-900/60 rounded-xl p-3">
                                    <p className="text-gray-400 mb-1">You offer:</p>
                                    <p className="text-white font-medium">{mySelected.length} item{mySelected.length !== 1 ? 's' : ''}{myKitties > 0 ? ` + ${myKitties.toLocaleString()} K` : ''}</p>
                                </div>
                                <div className="flex items-center justify-center text-2xl">🔄</div>
                                <div className="flex-1 bg-gray-900/60 rounded-xl p-3">
                                    <p className="text-gray-400 mb-1">You receive:</p>
                                    <p className="text-white font-medium">{theirSelected.length} item{theirSelected.length !== 1 ? 's' : ''}{theirKitties > 0 ? ` + ${theirKitties.toLocaleString()} K` : ''}</p>
                                </div>
                            </div>
                            <button
                                onClick={submitTrade}
                                disabled={submitting || mySelected.length === 0 || theirSelected.length === 0}
                                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-500 disabled:opacity-50 transition-all"
                            >
                                {submitting ? 'Sending…' : '🔄 Send Trade Offer'}
                            </button>
                            <p className="text-xs text-gray-500 text-center mt-2">Trade expires in 72 hours if not accepted.</p>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
}

function ItemSelector({ title, subtitle, items, selected, onToggle, emptyMsg }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-gray-800 p-4">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-1">{title}</h2>
            <p className="text-xs text-gray-500 mb-3">{subtitle}</p>
            {items.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">{emptyMsg}</p>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                    {items.map(ui => {
                        const isSelected = selected.includes(ui.id);
                        const disabled   = !isSelected && selected.length >= 4;
                        return (
                            <button
                                key={ui.id}
                                onClick={() => !disabled && onToggle(ui.id)}
                                disabled={disabled}
                                className={`rounded-xl border p-1.5 transition-all text-left ${
                                    isSelected  ? 'border-indigo-500 bg-indigo-600/20' :
                                    disabled    ? 'border-white/5 opacity-40' :
                                    'border-white/10 hover:border-indigo-500/40 bg-gray-700/50'
                                }`}
                            >
                                <div className="aspect-square rounded-lg bg-gray-700 flex items-center justify-center overflow-hidden mb-1">
                                    {ui.item?.thumbnail_url
                                        ? <img src={ui.item.thumbnail_url} alt="" className="w-full h-full object-contain" />
                                        : <span className="text-2xl">🎁</span>
                                    }
                                </div>
                                <p className="text-xs text-white font-medium truncate">{ui.item?.name ?? '?'}</p>
                                {ui.item?.rap > 0 && <p className="text-xs text-amber-400">{ui.item.rap.toLocaleString()} K</p>}
                                {isSelected && <p className="text-xs text-indigo-400 font-bold">✓ Selected</p>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
