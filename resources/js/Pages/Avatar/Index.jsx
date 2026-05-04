import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { router, usePage } from '@inertiajs/react';
import Layout from '@/Root';
import Avatar3DViewer from '@/components/Avatar3DViewer';

const SLOTS       = ['hat','face','shirt','pants','shoes','accessory'];
const SLOT_LABELS = { hat:'Hat', face:'Face', shirt:'Shirt', pants:'Pants', shoes:'Shoes', accessory:'Accessory' };
const BODY_COLORS = [
    '#f5cba7','#fad7a0','#e8b98a','#c68642','#8d5524',
    '#d7bde2','#a9cce3','#a9dfbf','#f1948a','#aed6f1',
    '#ffffff','#cccccc','#888888','#444444','#1a1a1a',
];

/* ─────────────────────────────────────────────────────────────────────────────
 * Thumbnail regeneration — calls /avatar/thumbnail (JSON) via window.axios.
 *
 * WHY NOT SOAP:
 *   The browser cannot reliably call /rcc/soap directly because:
 *   1. native fetch() does not add the X-XSRF-TOKEN header Laravel requires.
 *   2. simplexml_load_string has edge cases that cause silent failures.
 *   3. Architecturally, clients should not talk to RCCService directly
 *      (same pattern as Roblox: browser → web server → RCCService).
 *
 *   window.axios is used here because it is already configured by Laravel's
 *   bootstrap.js to include the X-XSRF-TOKEN header automatically,
 *   making every request CSRF-safe without any manual token handling.
 ───────────────────────────────────────────────────────────────────────────── */
async function fetchThumbnail(bodyColor, slotColors) {
    try {
        // Build a clean slot_colors map — only include slots that have a color
        const clean = {};
        Object.entries(slotColors).forEach(([slot, val]) => {
            if (val && val.primary) clean[slot] = val;
        });

        const res = await window.axios.post('/avatar/thumbnail', {
            body_color:  bodyColor,
            slot_colors: clean,
        });

        return res.data?.url ?? null;
    } catch (err) {
        // 503 = Python RCC service down (graceful — will try again next change)
        if (err.response?.status === 503) return null;
        console.warn('[Avatar] Thumbnail generation failed:', err.response?.data?.error ?? err.message);
        return null;
    }
}

/* ─────────────────────────────────────────────────────────────────────────── */

export default function AvatarIndex({ avatar, inventory }) {
    const auth = usePage().props;

    const [equipped, setEquipped] = useState({
        hat:       avatar.hat_user_item_id       ?? null,
        face:      avatar.face_user_item_id      ?? null,
        shirt:     avatar.shirt_user_item_id     ?? null,
        pants:     avatar.pants_user_item_id     ?? null,
        shoes:     avatar.shoes_user_item_id     ?? null,
        accessory: avatar.accessory_user_item_id ?? null,
    });
    const [bodyColor,    setBodyColor]    = useState(avatar.body_color ?? '#D9D9D9');
    const [activeSlot,   setActiveSlot]   = useState('hat');
    const [saving,       setSaving]       = useState(false);
    const [listTarget,   setListTarget]   = useState(null);
    const [listPrice,    setListPrice]    = useState('');
    const [listing,      setListing]      = useState(false);
    const [thumbUrl,     setThumbUrl]     = useState(
        avatar.thumbnail_path ? `/storage/${avatar.thumbnail_path}` : null
    );
    const [thumbLoading, setThumbLoading] = useState(false);

    const rccTimer = useRef(null);

    const flat  = useMemo(() => Object.values(inventory).flat(), [inventory]);
    const getUI = useCallback(id => flat.find(u => u.id === id) ?? null, [flat]);

    const slotColors = useMemo(() => {
        const out = {};
        SLOTS.forEach(slot => {
            const id = equipped[slot];
            if (!id) { out[slot] = null; return; }
            const ui = getUI(id);
            out[slot] = ui?.item
                ? { primary: ui.item.color_primary ?? '#D9D9D9', secondary: ui.item.color_secondary ?? '#888888' }
                : null;
        });
        return out;
    }, [equipped, getUI]);

    const slotItems = inventory[activeSlot] ?? [];
    const wearing   = SLOTS.filter(s => equipped[s]).map(s => ({ slot: s, ui: getUI(equipped[s]) })).filter(x => x.ui);

    /* ── Debounced thumbnail regeneration via JSON endpoint ─────────────────
     * 900ms debounce — batches rapid equip/color changes into one RCC call.
     * Uses window.axios (CSRF-safe, unlike native fetch).
     */
    useEffect(() => {
        if (rccTimer.current) clearTimeout(rccTimer.current);
        rccTimer.current = setTimeout(async () => {
            setThumbLoading(true);
            const url = await fetchThumbnail(bodyColor, slotColors);
            if (url) setThumbUrl(url);
            setThumbLoading(false);
        }, 900);
        return () => { if (rccTimer.current) clearTimeout(rccTimer.current); };
    }, [equipped, bodyColor]); // eslint-disable-line

    function toggleEquip(id) {
        setEquipped(p => ({ ...p, [activeSlot]: p[activeSlot] === id ? null : id }));
    }

    const saveAvatar = useCallback(() => {
        setSaving(true);
        const payload = { body_color: bodyColor };
        Object.entries(equipped).forEach(([slot, id]) => {
            if (id) payload[`${slot}_user_item_id`] = id;
        });
        router.post('/avatar/save', payload, { onFinish: () => setSaving(false) });
    }, [equipped, bodyColor]);

    function listItem() {
        if (!listPrice || parseInt(listPrice) < 1) return;
        setListing(true);
        router.post('/market/list', { user_item_id: listTarget, price: parseInt(listPrice) }, {
            onSuccess: () => { setListTarget(null); setListPrice(''); },
            onFinish:  () => setListing(false),
        });
    }

    return (
        <Layout>
            <div className="page" style={{ display: 'grid', gridTemplateColumns: '200px 1fr 220px', gap: '1.25rem', alignItems: 'start' }}>

                {/* ── Left: slot tabs + inventory ───────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="card" style={{ overflow: 'hidden' }}>
                        {SLOTS.map(slot => (
                            <button key={slot} onClick={() => setActiveSlot(slot)} style={{
                                display: 'flex', width: '100%', alignItems: 'center',
                                justifyContent: 'space-between', padding: '0.5rem 0.75rem',
                                background: activeSlot === slot ? 'var(--accent-lt)' : 'transparent',
                                border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                                color: activeSlot === slot ? 'var(--accent)' : 'var(--text-2)',
                                fontWeight: activeSlot === slot ? 700 : 500, fontSize: '0.83rem', textAlign: 'left',
                                transition: 'all var(--t)',
                            }}>
                                <span>{SLOT_LABELS[slot]}</span>
                                {equipped[slot] && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />}
                            </button>
                        ))}
                    </div>

                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                            <span className="text-sm fw-700">{SLOT_LABELS[activeSlot]}</span>
                            <span className="text-xs text-muted">{slotItems.length}</span>
                        </div>
                        {slotItems.length === 0 ? (
                            <div style={{ padding: '1.25rem', textAlign: 'center' }}>
                                <p className="text-sm text-muted">None owned.</p>
                                <a href="/catalog" className="btn btn--ghost btn--sm" style={{ marginTop: '0.5rem', display: 'inline-flex' }}>Shop</a>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', padding: '0.4rem', maxHeight: '340px', overflowY: 'auto' }}>
                                {slotItems.map(ui => {
                                    const on      = equipped[activeSlot] === ui.id;
                                    const isListed = ui.is_listed;
                                    return (
                                        <div key={ui.id} onClick={() => !isListed && toggleEquip(ui.id)} style={{
                                            border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                                            borderRadius: 'var(--r-sm)', background: on ? 'var(--accent-lt)' : 'var(--bg-3)',
                                            cursor: isListed ? 'not-allowed' : 'pointer', opacity: isListed ? 0.5 : 1,
                                            overflow: 'hidden', transition: 'border-color var(--t)',
                                        }}>
                                            <div style={{ aspectRatio: '1', background: 'var(--bg-4)', overflow: 'hidden' }}>
                                                {ui.item?.thumbnail_url
                                                    ? <img src={ui.item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                    : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${ui.item?.color_primary ?? '#888'} 50%, ${ui.item?.color_secondary ?? '#555'} 50%)` }} />
                                                }
                                            </div>
                                            <div style={{ padding: '0.25rem 0.35rem', fontSize: '0.68rem' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ui.item?.name ?? '?'}</div>
                                                {on      && <div style={{ color: 'var(--success)', fontWeight: 700 }}>Equipped</div>}
                                                {isListed && <div style={{ color: 'var(--warn)',    fontWeight: 600 }}>Listed</div>}
                                                {!on && !isListed && ui.item?.type === 'limited' && (
                                                    <button onClick={e => { e.stopPropagation(); setListTarget(ui.id); setListPrice(''); }}
                                                        style={{ fontSize: '0.65rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
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

                    {listTarget && (
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                                <span className="text-sm fw-700">List on Market</span>
                            </div>
                            <div style={{ padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <input type="number" className="input" placeholder="Price in Kitties" min={1} value={listPrice} onChange={e => setListPrice(e.target.value)} />
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button onClick={listItem} disabled={listing || !listPrice} className="btn btn--primary btn--sm" style={{ flex: 1 }}>{listing ? '...' : 'List'}</button>
                                    <button onClick={() => setListTarget(null)} className="btn btn--ghost btn--sm" style={{ flex: 1 }}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Center: 3D viewer + save ──────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                        <h1 style={{ marginBottom: '0.1rem' }}>Avatar Editor</h1>
                        <p className="text-xs text-muted">Drag to rotate &middot; Scroll to zoom</p>
                    </div>
                    <Avatar3DViewer bodyColor={bodyColor} slotColors={slotColors} style={{ width: '100%', height: '460px' }} />
                    <button onClick={saveAvatar} disabled={saving} className="btn btn--primary" style={{ width: '100%' }}>
                        {saving ? 'Saving...' : 'Save Avatar'}
                    </button>
                </div>

                {/* ── Right: headshot + skin + wearing ─────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                    {/* Live RCC-rendered thumbnail */}
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-sm fw-700">Profile Thumbnail</span>
                            {thumbLoading && <span className="text-xs text-muted">Rendering...</span>}
                        </div>
                        <div style={{ aspectRatio: '1', background: 'var(--bg-3)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {thumbUrl ? (
                                <img src={thumbUrl} alt="Profile thumbnail" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: thumbLoading ? 0.4 : 1, transition: 'opacity 0.2s' }} />
                            ) : (
                                <p className="text-xs text-muted" style={{ textAlign: 'center', padding: '1rem' }}>
                                    {thumbLoading ? 'Rendering...' : 'Equip items to generate'}
                                </p>
                            )}
                            {thumbLoading && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.08)' }}>
                                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.75s linear infinite' }} />
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.68rem', color: 'var(--text-3)', textAlign: 'center' }}>
                            Updates automatically &bull; Persisted on save
                        </div>
                    </div>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

                    {/* Skin color */}
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                            <span className="text-sm fw-700">Skin Color</span>
                        </div>
                        <div style={{ padding: '0.65rem', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem' }}>
                            {BODY_COLORS.map(c => (
                                <button key={c} onClick={() => setBodyColor(c)} title={c} style={{
                                    width: '100%', aspectRatio: '1', background: c, borderRadius: 'var(--r-sm)',
                                    border: bodyColor === c ? '2px solid var(--accent)' : '1px solid var(--border)',
                                    cursor: 'pointer', transition: 'border-color var(--t)',
                                }} />
                            ))}
                        </div>
                    </div>

                    {/* Wearing summary */}
                    {wearing.length > 0 && (
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                                <span className="text-sm fw-700">Wearing</span>
                            </div>
                            {wearing.map(({ slot, ui }) => (
                                <div key={slot} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                                    <span className="text-xs text-muted" style={{ width: 52 }}>{SLOT_LABELS[slot]}</span>
                                    <span className="text-sm fw-600 truncate" style={{ color: 'var(--text)', flex: 1, marginLeft: '0.4rem' }}>{ui.item?.name ?? '?'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
