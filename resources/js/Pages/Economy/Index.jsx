import { router } from '@inertiajs/react';
import Layout from '@/Root';

const TYPE_META = {
    purchase:     { label: 'Purchase',    icon: '🛍', color: 'text-red-400 bg-red-500/10'      },
    sale:         { label: 'Sale',        icon: '💸', color: 'text-emerald-400 bg-emerald-500/10' },
    trade:        { label: 'Trade',       icon: '🔄', color: 'text-indigo-400 bg-indigo-500/10' },
    grant:        { label: 'Grant',       icon: '🎁', color: 'text-purple-400 bg-purple-500/10' },
    admin_grant:  { label: 'Admin Grant', icon: '⭐', color: 'text-purple-400 bg-purple-500/10' },
    admin_deduct: { label: 'Deducted',    icon: '⚠️', color: 'text-red-400 bg-red-500/10'      },
    refund:       { label: 'Refund',      icon: '↩️', color: 'text-amber-400 bg-amber-500/10'   },
};

export default function EconomyIndex({ balance, transactions }) {
    const recent = transactions.data.slice(0, 5);
    const totalIn  = transactions.data.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = transactions.data.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    return (
        <Layout>
            <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
                <h1 className="text-3xl font-black text-white mb-1">Wallet</h1>
                <p className="text-gray-400 text-sm mb-8">Your Kitties balance and transaction history</p>

                {/* Balance hero */}
                <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-amber-400/70 text-sm font-medium uppercase tracking-widest mb-1">Current Balance</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-white">{Number(balance).toLocaleString()}</span>
                            <span className="text-amber-400 text-xl font-bold">K</span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1">Kitties — the currency of YourLittleCase!</p>
                    </div>
                    <div className="flex gap-4 sm:flex-col sm:text-right">
                        <div>
                            <p className="text-xs text-gray-500">Earned (this page)</p>
                            <p className="text-emerald-400 font-bold text-sm">+{totalIn.toLocaleString()} K</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Spent (this page)</p>
                            <p className="text-red-400 font-bold text-sm">−{totalOut.toLocaleString()} K</p>
                        </div>
                    </div>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                    <QuickLink href="/catalog" icon="🛍" label="Buy Items"   />
                    <QuickLink href="/market"  icon="📈" label="Market"      />
                    <QuickLink href="/trade"   icon="🔄" label="Trade"       />
                    <QuickLink href="/avatar"  icon="🧍" label="Avatar"      />
                </div>

                {/* Transactions */}
                <h2 className="text-lg font-extrabold text-white mb-4">Transaction History</h2>

                {transactions.data.length === 0 ? (
                    <div className="text-center py-16 rounded-2xl border border-white/10 bg-gray-800">
                        <span className="text-4xl">📭</span>
                        <p className="text-gray-400 mt-3">No transactions yet.</p>
                        <a href="/catalog" className="text-indigo-400 text-sm mt-2 inline-block hover:underline">Browse the catalog to get started →</a>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-white/10 bg-gray-800 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left">Type</th>
                                    <th className="px-4 py-3 text-left hidden sm:table-cell">Description</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-right hidden md:table-cell">Balance After</th>
                                    <th className="px-4 py-3 text-right hidden lg:table-cell">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {transactions.data.map(tx => {
                                    const meta = TYPE_META[tx.type] ?? { label: tx.type, icon: '•', color: 'text-gray-400 bg-gray-700/30' };
                                    return (
                                        <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold ${meta.color}`}>
                                                    <span>{meta.icon}</span>
                                                    <span className="hidden sm:inline">{meta.label}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 hidden sm:table-cell max-w-[200px]">
                                                <span className="truncate block" title={tx.description}>{tx.description}</span>
                                            </td>
                                            <td className={`px-4 py-3 text-right font-black text-base ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {tx.amount >= 0 ? '+' : ''}{Number(tx.amount).toLocaleString()}
                                                <span className="text-xs font-normal ml-1">K</span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-500 text-xs hidden md:table-cell">
                                                {Number(tx.balance_after).toLocaleString()} K
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600 text-xs hidden lg:table-cell">
                                                {new Date(tx.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <Pagination links={transactions.links} />
            </div>
        </Layout>
    );
}

function QuickLink({ href, icon, label }) {
    return (
        <a
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-gray-800 p-3 hover:border-indigo-500/40 hover:bg-gray-750 transition-all group"
        >
            <span className="text-2xl">{icon}</span>
            <span className="text-xs font-medium text-gray-400 group-hover:text-white transition-colors">{label}</span>
        </a>
    );
}

function Pagination({ links }) {
    if (!links || links.length <= 3) return null;
    return (
        <div className="flex flex-wrap gap-1 mt-6 justify-center">
            {links.map((link, i) => (
                <button
                    key={i}
                    disabled={!link.url || link.active}
                    onClick={() => link.url && router.visit(link.url)}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                        link.active  ? 'bg-indigo-600 text-white font-bold' :
                        !link.url    ? 'text-gray-600 cursor-default' :
                        'bg-gray-800 text-gray-300 border border-white/10 hover:border-indigo-500/50 cursor-pointer'
                    }`}
                />
            ))}
        </div>
    );
}
