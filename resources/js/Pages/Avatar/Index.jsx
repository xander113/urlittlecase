import { useState, useMemo, useCallback } from 'react';
import { router } from '@inertiajs/react';
import Layout from '@/Root';
import Avatar3DViewer from '@/components/Avatar3DViewer';

const SLOTS = ['hat','face','shirt','pants','shoes','accessory'];
const SLOT_LABELS = { hat:'Hat', face:'Face', shirt:'Shirt', pants:'Pants', shoes:'Shoes', accessory:'Accessory' };

const BODY_COLORS = [
    '#f5cba7','#fad7a0','#e8b98a','#c68642','#8d5524',
    '#d7bde2','#a9cce3','#a9dfbf','#f1948a','#aed6f1',
    '#ffffff','#cccccc','#888888','#444444','#111111',
];

export default function AvatarIndex({ avatar, inventory }) {
    const [equipped, setEquipped] = useState({
        hat:       avatar.hat_user_item_id       ?? null,
        face:      avatar.face_user_item_id      ?? null,
        shirt:     avatar.shirt_user_item_id     ?? null,
        pants:     avatar.pants_user_item_id     ?? null,
        shoes:     avatar.shoes_user_item_id     ?? null,
        accessory: avatar.accessory_user_item_id ?? null,
    });
    const [bodyColor,  setBodyColor]  = useState(avatar.body_color ?? '#D9D9D9');
    const [activeSlot, setActiveSlot] = useState('hat');
    const [saving,     setSaving]     = useState(false);
    const [listTarget, setListTarget] = useState(null);
    const [listPrice,  setListPrice]  = useState('');
    const [listing,    setListing]    = useState(false);

    const flat = useMemo(() => Object.values(inventory).flat(), [inventory]);
    const getUI = id => flat.find(u => u.id === id) ?? null;

    const slotColors = useMemo(() => {
        const out = {};
        SLOTS.forEach(slot => {
            const id = equipped[slot];
            if (!id) { out[slot] = null; return; }
            const ui = getUI(id);
            out[slot] = ui?.item
                ? { primary: ui.item.color_primary, secondary: ui.item.color_secondary }
                : null;
        });
        return out;
    }, [equipped, flat]); // eslint-disable-line

    const slotItems = inventory[activeSlot] ?? [];

    function toggle(id) {
        setEquipped(p => ({ ...p, [activeSlot]: p[activeSlot] === id ? null : id }));
    }

    const save = useCallback(() => {
        setSaving(true);
        const payload = { body_color: bodyColor };
        Object.entries(equipped).forEach(([slot, id]) => { if (id) payload[`${slot}_user_item_id`] = id; });
        router.post('/avatar/save', payload, {
            onSuccess: () => {
                // Trigger SOAP thumbnail generation
                const soapXml = buildSoap(equipped, bodyColor);
                fetch('/rcc/soap', { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: soapXml })
                    .catch(() => {/* silent */});
            },
            onFinish: () => setSaving(false),
        });
    }, [equipped, bodyColor]);

    function listItem() {
        if (!listPrice || parseInt(listPrice) < 1) return;
        setListing(true);
        router.post('/market/list', { user_item_id: listTarget, price: parseInt(listPrice) }, {
            onSuccess: () => { setListTarget(null); setListPrice(''); },
            onFinish:  () => setListing(false),
        });
    }

    const wearing = SLOTS.filter(s => equipped[s]).map(s => ({ slot: s, ui: getUI(equipped[s]) })).filter(x => x.ui);

    return (
        <Layout>
            <div className="page" style={{ display: 'grid', gridTemplateColumns: '220px 1fr 220px', gap: '1.25rem' }}>

                {/* ── Left: slot picker + inventory ─────────────────────── */}
                <div>
                    <div className="card mb-4">
                        <div className="card__header" style={{ padding: '0.65rem 0.75rem' }}>
                            <span className="text-sm fw-700">Slot</span>
                        </div>
                        <div>
                            {SLOTS.map(slot => (
                                <button
                                    key={slot}
                                    onClick={() => setActiveSlot(slot)}
                                    style={{
                                        display: 'flex', width: '100%', alignItems: 'center',
                                        gap: '0.5rem', padding: '0.5rem 0.75rem',
                                        background: activeSlot === slot ? 'var(--accent-lt)' : 'transparent',
                                        border: 'none', borderBottom: '1px solid var(--border)',
                                        cursor: 'pointer', textAlign: 'left',
                                        color: activeSlot === slot ? 'var(--accent)' : 'var(--text-2)',
                                        fontWeight: activeSlot === slot ? 700 : 500,
                                        fontSize: '0.83rem',
                                    }}
                                >
                                    <span style={{
                                        width: 7, height: 7, borderRadius: '50%',
                                        background: equipped[slot] ? 'var(--success)' : 'var(--border)',
                                        flexShrink: 0,
                                    }} />
                                    {SLOT_LABELS[slot]}
                                    {equipped[slot] && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--success)' }}>On</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Slot inventory */}
                    <div className="card">
                        <div className="card__header" style={{ padding: '0.65rem 0.75rem' }}>
                            <span className="text-sm fw-700">{SLOT_LABELS[activeSlot]}</span>
                            <span className="text-xs text-muted">{slotItems.length}</span>
                        </div>
                        {slotItems.length === 0 ? (
                            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                                <p className="text-sm text-muted">No items.</p>
                                <a href="/catalog" className="btn btn--ghost btn--sm" style={{ marginTop: '0.5rem', display: 'inline-flex' }}>Shop Catalog</a>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', padding: '0.5rem' }}>
                                {slotItems.map(ui => {
                                    const on = equipped[activeSlot] === ui.id;
                                    return (
                                        <div
                                            key={ui.id}
                                            onClick={() => !ui.is_listed && toggle(ui.id)}
                                            style={{
                                                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                                                borderRadius: 'var(--r-sm)',
                                                background: on ? 'var(--accent-lt)' : 'var(--bg-3)',
                                                cursor: ui.is_listed ? 'not-allowed' : 'pointer',
                                                opacity: ui.is_listed ? 0.55 : 1,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div style={{ aspectRatio: '1', background: 'var(--bg-4)', position: 'relative' }}>
                                                {ui.item?.thumbnail_url
                                                    ? <img src={ui.item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                    : null
                                                }
                                                {ui.is_listed && (
                                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>Listed</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ padding: '0.3rem 0.4rem', fontSize: '0.72rem' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ui.item?.name ?? '?'}</div>
                                                {ui.item?.type === 'limited' && !ui.is_listed && !on && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setListTarget(ui.id); setListPrice(''); }}
                                                        style={{ fontSize: '0.68rem', color: 'var(--warn)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                    >
                                                        Sell
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Center: 3D viewer ─────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h1 style={{ marginBottom: 0 }}>Avatar Editor</h1>
                    <Avatar3DViewer
                        bodyColor={bodyColor}
                        slotColors={slotColors}
                        style={{ width: '100%', height: '460px' }}
                    />
                    <p className="text-xs text-muted" style={{ textAlign: 'center' }}>Click and drag to rotate &middot; Scroll to zoom</p>
                    <button onClick={save} disabled={saving} className="btn btn--primary">
                        {saving ? 'Saving...' : 'Save Avatar'}
                    </button>
                    {/* List modal */}
                    {listTarget && (
                        <div className="card">
                            <div className="card__header"><h3 className="text-sm fw-700">List on Market</h3></div>
                            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <input type="number" className="input" placeholder="Price in Kitties" min={1} value={listPrice} onChange={e => setListPrice(e.target.value)} />
                                <div className="flex gap-2">
                                    <button onClick={listItem} disabled={listing || !listPrice} className="btn btn--primary btn--sm">
                                        {listing ? '...' : 'List'}
                                    </button>
                                    <button onClick={() => setListTarget(null)} className="btn btn--ghost btn--sm">Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right: body color + wearing ───────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="card">
                        <div className="card__header"><span className="text-sm fw-700">Skin Color</span></div>
                        <div className="card__body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
                                {BODY_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setBodyColor(c)}
                                        title={c}
                                        style={{
                                            width: '100%', aspectRatio: '1', background: c,
                                            borderRadius: 'var(--r-sm)',
                                            border: bodyColor === c ? '2px solid var(--accent)' : '1px solid var(--border)',
                                            cursor: 'pointer',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {wearing.length > 0 && (
                        <div className="card">
                            <div className="card__header"><span className="text-sm fw-700">Wearing</span></div>
                            <div>
                                {wearing.map(({ slot, ui }) => (
                                    <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                                        <span className="text-xs text-muted" style={{ width: 55, flexShrink: 0 }}>{SLOT_LABELS[slot]}</span>
                                        <span className="text-sm fw-600 truncate" style={{ color: 'var(--text)' }}>{ui.item?.name ?? '?'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="card">
                        <div className="card__header"><span className="text-sm fw-700">Help</span></div>
                        <div className="card__body">
                            <ol style={{ paddingLeft: '1rem', fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.8 }}>
                                <li>Pick a slot on the left</li>
                                <li>Click an item to equip</li>
                                <li>Adjust skin color</li>
                                <li>Save your avatar</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function buildSoap(equipped, bodyColor) {
    return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:YLCRCCService"><soap:Body><tns:RenderAvatarRequest><body_color>${bodyColor}</body_color>${equipped.hat?`<hat_id>${equipped.hat}</hat_id>`:''}</tns:RenderAvatarRequest></soap:Body></soap:Envelope>`;
}
