import { router } from '@inertiajs/react';
import Layout from '@/Root';

const TX_META = {
    purchase:     { label: 'Purchase',   color: 'var(--danger)' },
    sale:         { label: 'Sale',       color: 'var(--success)' },
    trade:        { label: 'Trade',      color: 'var(--accent)' },
    grant:        { label: 'Grant',      color: 'var(--warn)' },
    admin_grant:  { label: 'Admin Grant',color: 'var(--warn)' },
    admin_deduct: { label: 'Deducted',   color: 'var(--danger)' },
    refund:       { label: 'Refund',     color: 'var(--warn)' },
};

export default function EconomyIndex({ balance, transactions }) {
    const totalIn  = transactions.data.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = transactions.data.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    return (
        <Layout>
            <div className="page page--narrow">
                <h1 style={{ marginBottom: '0.25rem' }}>Wallet</h1>
                <div className="page-header__sub" style={{ marginBottom: '1.5rem' }}>Your Kitties balance and transaction history</div>

                {/* Balance */}
                <div className="card mb-4" style={{ padding: '1.5rem', borderLeft: '3px solid var(--warn)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '0.25rem' }}>Balance</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                        {Number(balance).toLocaleString()}
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-3)', marginLeft: '0.4rem' }}>K</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem' }}>
                        <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Earned this page</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }}>+{totalIn.toLocaleString()} K</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Spent this page</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--danger)' }}>&minus;{totalOut.toLocaleString()} K</div>
                        </div>
                    </div>
                </div>

                {/* Quick links */}
                <div className="grid-4 mb-4">
                    {[['Catalog','/catalog'],['Market','/market'],['Trade','/trade'],['Avatar','/avatar']].map(([l, h]) => (
                        <a key={l} href={h} className="card" style={{ padding: '0.75rem', textAlign: 'center', textDecoration: 'none' }}>
                            <div className="text-sm fw-600" style={{ color: 'var(--text)' }}>{l}</div>
                        </a>
                    ))}
                </div>

                <h2 style={{ marginBottom: '0.75rem' }}>Transaction History</h2>

                {transactions.data.length === 0 ? (
                    <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
                        <p className="text-muted">No transactions yet.</p>
                    </div>
                ) : (
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                    <th style={{ textAlign: 'right' }}>Balance</th>
                                    <th style={{ textAlign: 'right' }}>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.data.map(tx => {
                                    const meta = TX_META[tx.type] ?? { label: tx.type, color: 'var(--text-3)' };
                                    return (
                                        <tr key={tx.id}>
                                            <td style={{ textAlign: 'left' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                    {meta.label}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'left', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <span title={tx.description} className="text-sm">{tx.description}</span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: tx.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                {tx.amount >= 0 ? '+' : ''}{Number(tx.amount).toLocaleString()} K
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-3)' }}>
                                                {Number(tx.balance_after).toLocaleString()} K
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-3)' }}>
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

function Pagination({ links }) {
    if (!links || links.length <= 3) return null;
    return (
        <div className="pagination">
            {links.map((l, i) => (
                <button key={i} disabled={!l.url || l.active} className={l.active ? 'active' : ''}
                    onClick={() => l.url && router.visit(l.url)} dangerouslySetInnerHTML={{ __html: l.label }}
                />
            ))}
        </div>
    );
}
