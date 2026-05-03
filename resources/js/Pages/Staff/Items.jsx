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

    function setF(key, val) { setForm(p => ({ ...p, [key]: val })); }

    function createItem(e) {
        e.preventDefault();
        if (!form.name) return;
        setCreating(true);
        router.post('/staff/catalog', form, { onFinish: () => setCreating(false) });
    }

    function approve(id) { router.post(`/staff/items/${id}/approve`); }

    function remove(id, name) {
        if (!confirm(`Remove "${name}" from the catalog? This cannot be undone.`)) return;
        router.post(`/staff/items/${id}/remove`);
    }

    const pending  = items.data.filter(i => !i.deleted_at && !i.is_approved);
    const approved = items.data.filter(i => !i.deleted_at && i.is_approved);
    const removed  = items.data.filter(i => i.deleted_at);

    return (
        <Layout>
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
                <StaffNav current="items" />

                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <h1 className="text-3xl font-black text-white">🎁 Item Management</h1>
                    {isAdmin && (
                        <button
                            onClick={() => setShowForm(v => !v)}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${showForm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                        >
                            {showForm ? '✕ Close' : '＋ Create Item'}
                        </button>
                    )}
                </div>

                {/* Create item form */}
                {isAdmin && showForm && (
                    <div className="rounded-2xl border border-indigo-500/30 bg-indigo-600/5 p-5 mb-8">
                        <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-5">New Item</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <FormField label="Name *" value={form.name} onChange={v => setF('name', v)} placeholder="Item name" />
                            </div>
                            <FormSelect label="Type" value={form.type} onChange={v => setF('type', v)} options={['regular','limited']} />
                            <FormSelect label="Category" value={form.category} onChange={v => setF('category', v)} options={CATS} />
                            <FormField label="Price (K)" value={form.price} onChange={v => setF('price', v)} type="number" placeholder="0" />
                            {form.type === 'limited' && (
                                <FormField label="Stock (total copies)" value={form.stock} onChange={v => setF('stock', v)} type="number" placeholder="e.g. 100" />
                            )}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Primary Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={form.color_primary} onChange={e => setF('color_primary', e.target.value)}
                                        className="w-10 h-10 rounded-lg border border-white/10 bg-gray-900 cursor-pointer p-0.5" />
                                    <span className="text-gray-400 text-xs font-mono">{form.color_primary}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Secondary Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={form.color_secondary} onChange={e => setF('color_secondary', e.target.value)}
                                        className="w-10 h-10 rounded-lg border border-white/10 bg-gray-900 cursor-pointer p-0.5" />
                                    <span className="text-gray-400 text-xs font-mono">{form.color_secondary}</span>
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs text-gray-400 mb-1">Description</label>
                                <textarea value={form.description} onChange={e => setF('description', e.target.value)}
                                    placeholder="Item description…" rows={2}
                                    className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                                />
                            </div>
                        </div>

                        {/* Preview swatch */}
                        <div className="mt-4 flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl border border-white/10" style={{ background: `linear-gradient(135deg, ${form.color_primary}, ${form.color_secondary})` }} />
                            <div className="text-sm">
                                <p className="text-white font-medium">{form.name || 'Item Name'}</p>
                                <p className="text-gray-400 text-xs">{form.type} · {form.category} · {form.price || '0'} K {form.type === 'limited' && form.stock ? `· ${form.stock} copies` : ''}</p>
                            </div>
                        </div>

                        <button
                            onClick={createItem}
                            disabled={creating || !form.name}
                            className="mt-4 w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                        >
                            {creating ? 'Creating…' : '＋ Create Item'}
                        </button>
                    </div>
                )}

                {/* Pending approval */}
                {pending.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">
                            ⚠ Pending Approval ({pending.length})
                        </h2>
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                            {pending.map(item => <ItemRow key={item.id} item={item} onApprove={approve} onRemove={remove} />)}
                        </div>
                    </div>
                )}

                {/* Approved items */}
                {approved.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                            Catalog Items ({approved.length})
                        </h2>
                        <div className="rounded-2xl border border-white/10 bg-gray-800 overflow-hidden">
                            {approved.map(item => <ItemRow key={item.id} item={item} onApprove={approve} onRemove={remove} />)}
                        </div>
                    </div>
                )}

                {/* Removed */}
                {removed.length > 0 && (
                    <div>
                        <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Removed ({removed.length})</h2>
                        <div className="rounded-2xl border border-white/5 bg-gray-800/50 overflow-hidden opacity-60">
                            {removed.map(item => <ItemRow key={item.id} item={item} onApprove={approve} onRemove={remove} />)}
                        </div>
                    </div>
                )}

                <Pagination links={items.links} />
            </div>
        </Layout>
    );
}

function ItemRow({ item, onApprove, onRemove }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
            {/* Color swatch */}
            <div className="w-8 h-8 rounded-lg shrink-0 border border-white/10"
                style={{ background: `linear-gradient(135deg, ${item.color_primary ?? '#888'}, ${item.color_secondary ?? '#444'})` }}
            />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{item.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                        item.type === 'limited' ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-700 text-gray-400'
                    }`}>{item.type}</span>
                    <span className="text-gray-600 text-xs">{item.category}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span>{item.price?.toLocaleString() ?? 0} K</span>
                    {item.type === 'limited' && item.stock !== null && <span>{item.stock_remaining}/{item.stock} left</span>}
                    <span>by {item.creator?.name ?? 'system'}</span>
                </div>
            </div>

            {/* Status */}
            <div className="shrink-0">
                {item.deleted_at ? (
                    <span className="text-xs text-red-500">Removed</span>
                ) : item.is_approved ? (
                    <span className="text-xs text-emerald-400">✓ Live</span>
                ) : (
                    <span className="text-xs text-amber-400">Pending</span>
                )}
            </div>

            {/* Actions */}
            {!item.deleted_at && (
                <div className="flex gap-1.5 shrink-0">
                    {!item.is_approved && (
                        <button onClick={() => onApprove(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30 transition-colors"
                        >
                            Approve
                        </button>
                    )}
                    <button onClick={() => onRemove(item.id, item.name)}
                        className="px-2.5 py-1 rounded-lg bg-red-600/10 text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-600/20 transition-colors"
                    >
                        Remove
                    </button>
                </div>
            )}
        </div>
    );
}

function FormField({ label, value, onChange, type = 'text', placeholder = '' }) {
    return (
        <div>
            <label className="block text-xs text-gray-400 mb-1">{label}</label>
            <input type={type} value={value} placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
        </div>
    );
}

function FormSelect({ label, value, onChange, options }) {
    return (
        <div>
            <label className="block text-xs text-gray-400 mb-1">{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)}
                className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
                {options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
            </select>
        </div>
    );
}

function StaffNav({ current }) {
    const links = [
        { id: 'index',   href: '/staff',        label: 'Dashboard' },
        { id: 'reports', href: '/staff/reports', label: 'Reports'   },
        { id: 'bans',    href: '/staff/bans',    label: 'Bans'      },
        { id: 'items',   href: '/staff/items',   label: 'Items'     },
    ];
    return (
        <div className="flex gap-1 mb-6 flex-wrap">
            {links.map(l => (
                <a key={l.id} href={l.href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        current === l.id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    {l.label}
                </a>
            ))}
        </div>
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
