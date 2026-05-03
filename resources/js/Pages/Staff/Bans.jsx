import { useState } from 'react';
import { router } from '@inertiajs/react';
import Layout from '@/Root';

export default function StaffBans({ bans }) {
    const [search,   setSearch]   = useState('');
    const [results,  setResults]  = useState([]);
    const [searching, setSearching] = useState(false);
    const [banForm,  setBanForm]  = useState({ user_id: '', user_name: '', reason: '', expires_at: '' });
    const [submitting, setSubmitting] = useState(false);

    async function searchUsers() {
        if (search.trim().length < 2) return;
        setSearching(true);
        try {
            const res = await window.axios.get('/staff/users/search', { params: { q: search } });
            setResults(res.data);
        } catch { setResults([]); }
        finally { setSearching(false); }
    }

    function selectUser(u) {
        setBanForm(p => ({ ...p, user_id: u.id, user_name: u.name }));
        setResults([]);
        setSearch(u.name);
    }

    function submitBan(e) {
        e.preventDefault();
        if (!banForm.user_id || !banForm.reason) return;
        setSubmitting(true);
        router.post('/staff/bans/ban', {
            user_id:    banForm.user_id,
            reason:     banForm.reason,
            expires_at: banForm.expires_at || undefined,
        }, { onFinish: () => { setSubmitting(false); setBanForm({ user_id: '', user_name: '', reason: '', expires_at: '' }); setSearch(''); } });
    }

    function unban(userId) {
        if (!confirm('Unban this user?')) return;
        router.post('/staff/bans/unban', { user_id: userId });
    }

    return (
        <Layout>
            <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
                <StaffNav current="bans" />

                <h1 className="text-3xl font-black text-white mb-6">🔨 Ban Management</h1>

                {/* Issue ban form */}
                <div className="rounded-2xl border border-white/10 bg-gray-800 p-5 mb-8">
                    <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-4">Issue a Ban</h2>

                    <div className="space-y-3">
                        {/* User search */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">User</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="Search by username…"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && searchUsers()}
                                        className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                                    />
                                    {results.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/10 bg-gray-900 shadow-2xl z-10 overflow-hidden">
                                            {results.map(u => (
                                                <button key={u.id} onClick={() => selectUser(u)}
                                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left border-b border-white/5 last:border-0 text-sm"
                                                >
                                                    <span className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                        {u.name?.[0]?.toUpperCase()}
                                                    </span>
                                                    <span className="text-white">{u.name}</span>
                                                    {u.is_banned && <span className="ml-auto text-red-400 text-xs font-bold">BANNED</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button onClick={searchUsers} disabled={searching}
                                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                                >
                                    {searching ? '…' : 'Find'}
                                </button>
                            </div>
                            {banForm.user_name && (
                                <p className="text-emerald-400 text-xs mt-1">✓ Selected: {banForm.user_name}</p>
                            )}
                        </div>

                        {/* Reason */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Reason *</label>
                            <textarea
                                value={banForm.reason}
                                onChange={e => setBanForm(p => ({ ...p, reason: e.target.value }))}
                                placeholder="Describe why this user is being banned…"
                                rows={2}
                                className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                            />
                        </div>

                        {/* Expiry */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Expires (leave blank for permanent)</label>
                            <input
                                type="datetime-local"
                                value={banForm.expires_at}
                                onChange={e => setBanForm(p => ({ ...p, expires_at: e.target.value }))}
                                className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <button
                            onClick={submitBan}
                            disabled={submitting || !banForm.user_id || !banForm.reason}
                            className="w-full py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 disabled:opacity-40 transition-colors"
                        >
                            {submitting ? 'Banning…' : '🔨 Issue Ban'}
                        </button>
                    </div>
                </div>

                {/* Active bans list */}
                <h2 className="text-lg font-extrabold text-white mb-4">Active Bans</h2>

                {bans.data.length === 0 ? (
                    <div className="text-center py-12 rounded-2xl border border-white/10 bg-gray-800">
                        <span className="text-4xl">✅</span>
                        <p className="text-gray-400 mt-3">No active bans.</p>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-white/10 bg-gray-800 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left">User</th>
                                    <th className="px-4 py-3 text-left hidden sm:table-cell">Reason</th>
                                    <th className="px-4 py-3 text-left hidden md:table-cell">By</th>
                                    <th className="px-4 py-3 text-left">Expires</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {bans.data.map(ban => (
                                    <tr key={ban.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-white">{ban.user?.name ?? '?'}</td>
                                        <td className="px-4 py-3 text-gray-400 hidden sm:table-cell max-w-[180px]">
                                            <span className="truncate block" title={ban.reason}>{ban.reason}</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{ban.staff?.name ?? '?'}</td>
                                        <td className="px-4 py-3">
                                            {ban.expires_at
                                                ? <span className="text-amber-400 font-medium">{new Date(ban.expires_at).toLocaleDateString()}</span>
                                                : <span className="text-red-400 font-bold">Permanent</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => unban(ban.user_id)}
                                                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30 transition-colors"
                                            >
                                                Unban
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <Pagination links={bans.links} />
            </div>
        </Layout>
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
