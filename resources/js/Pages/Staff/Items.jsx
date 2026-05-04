import { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import Layout from '@/Root';

const CATS = ['hat','face','shirt','pants','shoes','accessory','gear'];

export default function StaffItems({ items }) {
    const auth    = usePage().props;
    const isAdmin = auth?.user?.role === 'admin';

    const [showForm, setShowForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({
        name: '', description: '', type: 'regular', category: 'hat',
        price: '', stock: '', color_primary: '#6366f1', color_secondary: '#4338ca', is_for_sale: true,
    });

    function setF(k, v) { setForm(p => ({ ...p, [k]: v })); }

    function create(e) {
        e.preventDefault();
        if (!form.name) return;
        setCreating(true);
        router.post('/staff/catalog', form, { onFinish: () => setCreating(false) });
    }

    function approve(id) { router.post(`/staff/items/${id}/approve`); }
    function remove(id, name) {
        if (!confirm(`Remove "${name}"?`)) return;
        router.post(`/staff/items/${id}/remove`);
    }

    const pending  = items.data.filter(i => !i.deleted_at && !i.is_approved);
    const approved = items.data.filter(i => !i.deleted_at &&  i.is_approved);
    const removed  = items.data.filter(i =>  i.deleted_at);

    return (
        <Layout>
            <div className="page">
                <StaffNav current="items" />

                <div className="page-header">
                    <h1>Items</h1>
                    {isAdmin && (
                        <button onClick={() => setShowForm(v => !v)} className="btn btn--primary btn--sm">
                            {showForm ? 'Close Form' : 'Create Item'}
                        </button>
                    )}
                </div>

                {/* Create form */}
                {isAdmin && showForm && (
                    <div className="card mb-6" style={{ maxWidth: 560 }}>
                        <div className="card__header">
                            <h3>New Item</h3>
                        </div>
                        <div className="card__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ gridColumn: '1/-1' }}>
                                <label className="section-label">Name *</label>
                                <input type="text" className="input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Item name" />
                            </div>

                            <div>
                                <label className="section-label">Type</label>
                                <select className="input" value={form.type} onChange={e => setF('type', e.target.value)}>
                                    <option value="regular">Regular</option>
                                    <option value="limited">Limited</option>
                                </select>
                            </div>

                            <div>
                                <label className="section-label">Category</label>
                                <select className="input" value={form.category} onChange={e => setF('category', e.target.value)}>
                                    {CATS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="section-label">Price (K)</label>
                                <input type="number" className="input" value={form.price} onChange={e => setF('price', e.target.value)} placeholder="0" />
                            </div>

                            {form.type === 'limited' && (
                                <div>
                                    <label className="section-label">Stock (copies)</label>
                                    <input type="number" className="input" value={form.stock} onChange={e => setF('stock', e.target.value)} placeholder="e.g. 100" />
                                </div>
                            )}

                            <div>
                                <label className="section-label">Primary Color</label>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="color"
                                        value={form.color_primary}
                                        onChange={e => setF('color_primary', e.target.value)}
                                        style={{ width: 38, height: 38, padding: 2, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', cursor: 'pointer' }}
                                    />
                                    <span className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>{form.color_primary}</span>
                                </div>
                            </div>

                            <div>
                                <label className="section-label">Secondary Color</label>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="color"
                                        value={form.color_secondary}
                                        onChange={e => setF('color_secondary', e.target.value)}
                                        style={{ width: 38, height: 38, padding: 2, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', cursor: 'pointer' }}
                                    />
                                    <span className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>{form.color_secondary}</span>
                                </div>
                            </div>

                            <div style={{ gridColumn: '1/-1' }}>
                                <label className="section-label">Description</label>
                                <textarea
                                    className="input input--textarea"
                                    rows={2}
                                    value={form.description}
                                    onChange={e => setF('description', e.target.value)}
                                    placeholder="Optional description"
                                />
                            </div>

                            {/* Preview swatch */}
                            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 'var(--r-md)',
                                    border: '1px solid var(--border)',
                                    background: `linear-gradient(135deg, ${form.color_primary} 50%, ${form.color_secondary} 50%)`,
                                }} />
                                <div>
                                    <div className="text-sm fw-600" style={{ color: 'var(--text)' }}>{form.name || 'Untitled Item'}</div>
                                    <div className="text-xs text-muted">{form.type} &middot; {form.category} &middot; {form.price || '0'} K{form.type === 'limited' && form.stock ? ` &middot; ${form.stock} copies` : ''}</div>
                                </div>
                            </div>
                        </div>
                        <div className="card__footer">
                            <button onClick={create} disabled={creating || !form.name} className="btn btn--primary">
                                {creating ? 'Creating...' : 'Create Item'}
                            </button>
                            <button onClick={() => setShowForm(false)} className="btn btn--ghost">Cancel</button>
                        </div>
                    </div>
                )}

                {/* Pending items */}
                {pending.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div className="section-label" style={{ color: 'var(--warn)', marginBottom: '0.5rem' }}>
                            Pending Approval ({pending.length})
                        </div>
                        <div className="card" style={{ overflow: 'hidden', borderColor: 'var(--warn)' }}>
                            <ItemTable items={pending} onApprove={approve} onRemove={remove} showApprove />
                        </div>
                    </div>
                )}

                {/* Approved items */}
                {approved.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div className="section-label mb-2">Catalog ({approved.length})</div>
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <ItemTable items={approved} onApprove={approve} onRemove={remove} />
                        </div>
                    </div>
                )}

                {/* Removed items */}
                {removed.length > 0 && (
                    <div>
                        <div className="section-label mb-2" style={{ color: 'var(--text-3)' }}>
                            Removed ({removed.length})
                        </div>
                        <div className="card" style={{ overflow: 'hidden', opacity: 0.55 }}>
                            <ItemTable items={removed} onApprove={approve} onRemove={remove} />
                        </div>
                    </div>
                )}

                <Pagination links={items.links} />
            </div>
        </Layout>
    );
}

function ItemTable({ items, onApprove, onRemove, showApprove = false }) {
    return (
        <table className="table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th>Status</th>
                    <th>Creator</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {items.map(item => (
                    <tr key={item.id}>
                        <td style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: 'var(--r-sm)',
                                    border: '1px solid var(--border)', flexShrink: 0,
                                    background: `linear-gradient(135deg, ${item.color_primary ?? '#888'} 50%, ${item.color_secondary ?? '#555'} 50%)`,
                                }} />
                                <span className="fw-600" style={{ color: 'var(--text)' }}>{item.name}</span>
                            </div>
                        </td>
                        <td style={{ textAlign: 'left' }}>
                            <span className={`badge badge--${item.type === 'limited' ? 'ltd' : 'neutral'}`}>
                                {item.type}
                            </span>
                        </td>
                        <td style={{ textAlign: 'left', textTransform: 'capitalize', color: 'var(--text-2)' }}>
                            {item.category}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                            {Number(item.price ?? 0).toLocaleString()} K
                        </td>
                        <td style={{ textAlign: 'left' }}>
                            {item.deleted_at
                                ? <span className="badge badge--danger">Removed</span>
                                : item.is_approved
                                    ? <span className="badge badge--success">Live</span>
                                    : <span className="badge badge--warn">Pending</span>
                            }
                        </td>
                        <td style={{ textAlign: 'left', color: 'var(--text-3)', fontSize: '0.78rem' }}>
                            {item.creator?.name ?? 'system'}
                        </td>
                        <td>
                            {!item.deleted_at && (
                                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                                    {!item.is_approved && (
                                        <button onClick={() => onApprove(item.id)} className="btn btn--ghost btn--sm">
                                            Approve
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onRemove(item.id, item.name)}
                                        className="btn btn--ghost btn--sm"
                                        style={{ color: 'var(--danger)' }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function StaffNav({ current }) {
    return (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {[
                ['index',   '/staff',         'Dashboard'],
                ['reports', '/staff/reports',  'Reports'],
                ['bans',    '/staff/bans',     'Bans'],
                ['items',   '/staff/items',    'Items'],
            ].map(([id, href, label]) => (
                <a key={id} href={href} style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '0.83rem',
                    fontWeight: current === id ? 700 : 400,
                    background: current === id ? 'var(--accent)' : 'var(--bg-3)',
                    color: current === id ? 'var(--accent-text)' : 'var(--text-2)',
                    textDecoration: 'none',
                    border: '1px solid var(--border)',
                    transition: 'all var(--t)',
                }}>
                    {label}
                </a>
            ))}
        </div>
    );
}

function Pagination({ links }) {
    if (!links || links.length <= 3) return null;
    return (
        <div className="pagination">
            {links.map((l, i) => (
                <button
                    key={i}
                    disabled={!l.url || l.active}
                    className={l.active ? 'active' : ''}
                    onClick={() => l.url && router.visit(l.url)}
                    dangerouslySetInnerHTML={{ __html: l.label }}
                />
            ))}
        </div>
    );
}
