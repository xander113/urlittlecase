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
            setSearchResults(res.data.filter(u => u.id !== user?.id).slice(0, 8));
        } catch { setSearchResults([]); }
        finally { setSearching(false); }
    }

    async function selectPartner(u) {
        setPartnerData({ ...u, items: [] });
        setPartnerSearch(u.name);
        setSearchResults([]);
        setTheirSelected([]);
        try {
            const res = await window.axios.get(`/trade/create?user_id=${u.id}`, {
                headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '' },
            });
            if (res.data?.props?.partner?.items) {
                setPartnerData(prev => ({ ...prev, items: res.data.props.partner.items }));
            }
        } catch {}
    }

    function toggleMy(id) {
        setMySelected(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 4 ? [...p, id] : p);
    }

    function toggleTheir(id) {
        setTheirSelected(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 4 ? [...p, id] : p);
    }

    function submit() {
        if (!partnerData || mySelected.length === 0 || theirSelected.length === 0) return;
        setSubmitting(true);
        router.post('/trade', {
            receiver_id:       partnerData.id,
            sender_item_ids:   mySelected,
            receiver_item_ids: theirSelected,
            sender_kitties:    myKitties   || 0,
            receiver_kitties:  theirKitties || 0,
            sender_note:       note || null,
        }, { onFinish: () => setSubmitting(false) });
    }

    return (
        <Layout>
            <div className="page page--narrow">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                    <a href="/trade" style={{ color: 'var(--text-3)', display: 'flex' }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </a>
                    <h1>New Trade</h1>
                </div>

                {/* Step 1: Partner */}
                <div className="card mb-4">
                    <div className="card__header"><h3>Step 1 — Who to trade with</h3></div>
                    <div className="card__body">
                        <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
                            <input
                                type="text" className="input"
                                placeholder="Search username..."
                                value={partnerSearch}
                                onChange={e => setPartnerSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && searchPartner()}
                            />
                            <button onClick={searchPartner} disabled={searching} className="btn btn--secondary">
                                {searching ? '...' : 'Find'}
                            </button>
                        </div>
                        {searchResults.length > 0 && (
                            <div className="card" style={{ marginTop: '0.5rem', overflow: 'hidden' }}>
                                {searchResults.map(u => (
                                    <div
                                        key={u.id}
                                        onClick={() => selectPartner(u)}
                                        style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background var(--t)' }}
                                        onMouseOver={e => e.currentTarget.style.background = 'var(--bg-3)'}
                                        onMouseOut={e => e.currentTarget.style.background = ''}
                                    >
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-4)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', flexShrink: 0 }}>
                                            {u.name[0]?.toUpperCase()}
                                        </div>
                                        <span className="text-sm fw-600">{u.name}</span>
                                        {u.role !== 'user' && <span className="badge badge--accent" style={{ marginLeft: 'auto' }}>{u.role}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {partnerData && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.83rem', color: 'var(--success)', fontWeight: 600 }}>
                                Trading with: {partnerData.name}
                            </div>
                        )}
                    </div>
                </div>

                {partnerData && (
                    <>
                        {/* Step 2: Items */}
                        <div className="card mb-4">
                            <div className="card__header"><h3>Step 2 — Select items</h3></div>
                            <div className="card__body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <ItemSelector
                                        title="Your items (offer)"
                                        items={myItems}
                                        selected={mySelected}
                                        onToggle={toggleMy}
                                        emptyMsg="You have no tradeable limiteds."
                                    />
                                    <ItemSelector
                                        title={`${partnerData.name}'s items (request)`}
                                        items={partnerData.items ?? []}
                                        selected={theirSelected}
                                        onToggle={toggleTheir}
                                        emptyMsg="This user has no tradeable limiteds."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Step 3: Kitties + note */}
                        <div className="card mb-4">
                            <div className="card__header"><h3>Step 3 — Add Kitties (optional)</h3></div>
                            <div className="card__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="section-label">You add (balance: {Number(balance).toLocaleString()} K)</label>
                                    <input type="number" className="input" min={0} max={balance} value={myKitties} onChange={e => setMyKitties(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="section-label">They add (requested)</label>
                                    <input type="number" className="input" min={0} value={theirKitties} onChange={e => setTheirKitties(Number(e.target.value))} />
                                </div>
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label className="section-label">Note (optional)</label>
                                    <textarea className="input input--textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Message to the other player..." maxLength={300} />
                                </div>
                            </div>
                        </div>

                        {/* Summary + submit */}
                        <div className="card">
                            <div className="card__body">
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, background: 'var(--bg-3)', borderRadius: 'var(--r-md)', padding: '0.75rem' }}>
                                        <div className="section-label mb-1">You offer</div>
                                        <div className="fw-700">{mySelected.length} item{mySelected.length !== 1 ? 's' : ''}{myKitties > 0 ? ` + ${Number(myKitties).toLocaleString()} K` : ''}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.2rem', color: 'var(--text-3)' }}>&harr;</div>
                                    <div style={{ flex: 1, background: 'var(--bg-3)', borderRadius: 'var(--r-md)', padding: '0.75rem' }}>
                                        <div className="section-label mb-1">You receive</div>
                                        <div className="fw-700">{theirSelected.length} item{theirSelected.length !== 1 ? 's' : ''}{theirKitties > 0 ? ` + ${Number(theirKitties).toLocaleString()} K` : ''}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={submit}
                                    disabled={submitting || mySelected.length === 0 || theirSelected.length === 0}
                                    className="btn btn--primary btn--lg"
                                    style={{ width: '100%' }}
                                >
                                    {submitting ? 'Sending...' : 'Send Trade Offer'}
                                </button>
                                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.5rem' }}>
                                    Trade expires in 72 hours if not accepted.
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
}

function ItemSelector({ title, items, selected, onToggle, emptyMsg }) {
    return (
        <div>
            <div className="section-label mb-2">{title} (max 4)</div>
            {items.length === 0 ? (
                <p className="text-sm text-muted">{emptyMsg}</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', maxHeight: 240, overflowY: 'auto' }}>
                    {items.map(ui => {
                        const on      = selected.includes(ui.id);
                        const maxed   = !on && selected.length >= 4;
                        return (
                            <div
                                key={ui.id}
                                onClick={() => !maxed && onToggle(ui.id)}
                                style={{
                                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                                    borderRadius: 'var(--r-sm)',
                                    background: on ? 'var(--accent-lt)' : 'var(--bg-3)',
                                    cursor: maxed ? 'not-allowed' : 'pointer',
                                    opacity: maxed ? 0.45 : 1,
                                    overflow: 'hidden',
                                    transition: 'border-color var(--t)',
                                }}
                            >
                                <div style={{ aspectRatio: '1', background: 'var(--bg-4)' }}>
                                    {ui.item?.thumbnail_url && <img src={ui.item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                </div>
                                <div style={{ padding: '0.25rem 0.35rem', fontSize: '0.68rem' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ui.item?.name ?? '?'}</div>
                                    {ui.item?.rap > 0 && <div style={{ color: 'var(--warn)' }}>{Number(ui.item.rap).toLocaleString()} K</div>}
                                    {on && <div style={{ color: 'var(--accent)', fontWeight: 700 }}>Selected</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
