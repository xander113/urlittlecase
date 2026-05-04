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

// Roblox-equivalent thumbnail types
const THUMB_TYPES = [
    { id: 'full_body', label: 'Full Body'  },
    { id: 'headshot',  label: 'Headshot'   },
    { id: 'bust',      label: 'Bust'       },
];

// Standard sizes matching Roblox thumbnail API
const THUMB_SIZES = [150, 180, 352, 420, 720];

/* ─── Thumbnail fetcher — POST /avatar/thumbnail (JSON via axios) ─────────── */
async function fetchThumbnail(bodyColor, slotColors, thumbnailType, size, yRotDeg, distanceScale, bgColor) {
    const clean = {};
    Object.entries(slotColors).forEach(([slot, val]) => {
        if (val && val.primary) clean[slot] = val;
    });

    try {
        const res = await window.axios.post('/avatar/thumbnail', {
            body_color:     bodyColor,
            slot_colors:    clean,
            thumbnail_type: thumbnailType,
            size:           size,
            y_rot_deg:      yRotDeg,
            distance_scale: distanceScale,
            bg_color:       bgColor || undefined,
        });
        return res.data?.url ?? null;
    } catch (err) {
        if (err.response?.status === 503) return null;
        console.warn('[Avatar] Thumbnail failed:', err.response?.data?.error ?? err.message);
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

    // Thumbnail panel state
    const [thumbUrl,       setThumbUrl]       = useState(
        avatar.thumbnail_path ? `/storage/${avatar.thumbnail_path}` : null
    );
    const [thumbLoading,   setThumbLoading]   = useState(false);
    const [thumbType,      setThumbType]      = useState('full_body');
    const [thumbSize,      setThumbSize]      = useState(420);
    const [thumbYRot,      setThumbYRot]      = useState(0);
    const [thumbDScale,    setThumbDScale]    = useState(1.0);
    const [thumbBg,        setThumbBg]        = useState('transparent');

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

    /* ── Debounced RCC thumbnail render — fires on any change ─────────────── */
    useEffect(() => {
        if (rccTimer.current) clearTimeout(rccTimer.current);
        rccTimer.current = setTimeout(async () => {
            setThumbLoading(true);
            const url = await fetchThumbnail(bodyColor, slotColors, thumbType, thumbSize, thumbYRot, thumbDScale, thumbBg);
            if (url) setThumbUrl(url);
            setThumbLoading(false);
        }, 900);
        return () => { if (rccTimer.current) clearTimeout(rccTimer.current); };
    }, [equipped, bodyColor, thumbType, thumbSize, thumbYRot, thumbDScale, thumbBg]); // eslint-disable-line

    function toggleEquip(id) {
        setEquipped(p => ({ ...p, [activeSlot]: p[activeSlot] === id ? null : id }));
    }

    const saveAvatar = useCallback(() => {
        setSaving(true);
        const payload = { body_color: bodyColor };
        Object.entries(equipped).forEach(([slot, id]) => { if (id) payload[`${slot}_user_item_id`] = id; });
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
            <div className="page" style={{ display: 'grid', gridTemplateColumns: '200px 1fr 240px', gap: '1.25rem', alignItems: 'start' }}>

                {/* ── Left: slot tabs + inventory ───────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="card" style={{ overflow: 'hidden' }}>
                        {SLOTS.map(slot => (
                            <button key={slot} onClick={() => setActiveSlot(slot)} style={{
                                display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                                padding: '0.5rem 0.75rem', background: activeSlot === slot ? 'var(--accent-lt)' : 'transparent',
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
                                    const on = equipped[activeSlot] === ui.id;
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
                                                {on       && <div style={{ color: 'var(--success)', fontWeight: 700 }}>Equipped</div>}
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

                {/* ── Right: RCC thumbnail panel + skin + controls ──────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                    {/* Live 3D thumbnail */}
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-sm fw-700">Thumbnail</span>
                            {thumbLoading && <span className="text-xs text-muted">Rendering...</span>}
                        </div>

                        {/* Type switcher */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                            {THUMB_TYPES.map(t => (
                                <button key={t.id} onClick={() => setThumbType(t.id)} style={{
                                    flex: 1, padding: '0.35rem 0', fontSize: '0.7rem', fontWeight: thumbType === t.id ? 700 : 400,
                                    background: thumbType === t.id ? 'var(--accent-lt)' : 'transparent',
                                    color: thumbType === t.id ? 'var(--accent)' : 'var(--text-3)',
                                    border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer',
                                    transition: 'all var(--t)',
                                }}>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Thumbnail preview */}
                        <div style={{
                            aspectRatio: '1', background: thumbBg === 'transparent' ? 'repeating-conic-gradient(var(--bg-3) 0% 25%, var(--bg-4) 0% 50%) 0 0 / 16px 16px' : thumbBg,
                            position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {thumbUrl ? (
                                <img src={thumbUrl} alt={`${thumbType} thumbnail`} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: thumbLoading ? 0.4 : 1, transition: 'opacity 0.2s' }} />
                            ) : (
                                <p className="text-xs text-muted" style={{ textAlign: 'center', padding: '1rem' }}>
                                    {thumbLoading ? 'Rendering 3D...' : 'Equip items to preview'}
                                </p>
                            )}
                            {thumbLoading && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.06)' }}>
                                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.75s linear infinite' }} />
                                </div>
                            )}
                        </div>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

                        {/* Camera controls */}
                        <div style={{ padding: '0.65rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {/* Size */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label className="text-xs text-muted" style={{ width: 52, flexShrink: 0 }}>Size</label>
                                <select className="input" style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
                                    value={thumbSize} onChange={e => setThumbSize(Number(e.target.value))}>
                                    {THUMB_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
                                </select>
                            </div>

                            {/* Y rotation */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label className="text-xs text-muted" style={{ width: 52, flexShrink: 0 }}>Rotation</label>
                                <input type="range" min={-60} max={60} step={5} value={thumbYRot}
                                    onChange={e => setThumbYRot(Number(e.target.value))}
                                    style={{ flex: 1 }} />
                                <span className="text-xs text-muted" style={{ width: 30, textAlign: 'right' }}>{thumbYRot}&deg;</span>
                            </div>

                            {/* Distance scale */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label className="text-xs text-muted" style={{ width: 52, flexShrink: 0 }}>Zoom</label>
                                <input type="range" min={0.5} max={2.5} step={0.1} value={thumbDScale}
                                    onChange={e => setThumbDScale(Number(e.target.value))}
                                    style={{ flex: 1 }} />
                                <span className="text-xs text-muted" style={{ width: 30, textAlign: 'right' }}>{thumbDScale.toFixed(1)}x</span>
                            </div>

                            {/* Background */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label className="text-xs text-muted" style={{ width: 52, flexShrink: 0 }}>BG</label>
                                <select className="input" style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
                                    value={thumbBg} onChange={e => setThumbBg(e.target.value)}>
                                    <option value="transparent">Transparent</option>
                                    <option value="#ffffff">White</option>
                                    <option value="#f0f0f0">Light Gray</option>
                                    <option value="#1a1a2e">Dark</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.68rem', color: 'var(--text-3)', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                            Rendered in 3D &bull; Updates automatically
                        </div>
                    </div>

                    {/* Skin color picker */}
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
                </div>

            </div>
        </Layout>
    );
}
