import { Link, usePage } from '@inertiajs/react';
import Layout from '@/Root';

export default function HomeIndex({ featuredLimiteds = [], featuredRegular = [], stats = {} }) {
    const auth = usePage().props;
    const user = auth?.user;

    return (
        <Layout>
            {/* ── Hero ────────────────────────────────────────────────── */}
            <div style={{
                background: 'var(--bg-2)',
                borderBottom: '1px solid var(--border)',
            }}>
                <div className="page" style={{ paddingTop: '4rem', paddingBottom: '4rem', textAlign: 'center' }}>
                    <div className="section-label" style={{ marginBottom: '0.75rem', justifyContent: 'center', display: 'flex' }}>
                        Item Economy Platform
                    </div>
                    <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '1rem', color: 'var(--text)' }}>
                        YourLittleCase!
                    </h1>
                    <p style={{ fontSize: '1rem', color: 'var(--text-2)', maxWidth: '480px', margin: '0 auto 2rem', lineHeight: 1.7 }}>
                        Trade and collect limited items, customize your 3D avatar, and build your economy.
                    </p>
                    <div className="flex" style={{ gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {user ? (
                            <>
                                <Link href="/catalog" className="btn btn--primary btn--lg">Browse Catalog</Link>
                                <Link href="/avatar"  className="btn btn--ghost btn--lg">Edit Avatar</Link>
                            </>
                        ) : (
                            <>
                                <Link href="/register" className="btn btn--primary btn--lg">Create Account</Link>
                                <Link href="/catalog"  className="btn btn--ghost btn--lg">Browse Catalog</Link>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Stats bar ────────────────────────────────────────────── */}
            <div style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border)' }}>
                <div className="page" style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
                    <div className="grid-4">
                        <StatItem label="Players"  value={stats.users ?? 0} />
                        <StatItem label="Items"    value={stats.items ?? 0} />
                        <StatItem label="Trades"   value={stats.trades ?? 0} />
                        <StatItem label="Listings" value={stats.listings ?? 0} />
                    </div>
                </div>
            </div>

            <div className="page">
                {/* ── Featured Limiteds ─────────────────────────────────── */}
                {featuredLimiteds.length > 0 && (
                    <section style={{ marginBottom: '2.5rem' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2>Featured Limiteds</h2>
                            <Link href="/catalog?type=limited" className="btn btn--ghost btn--sm">View all</Link>
                        </div>
                        <div className="grid-6">
                            {featuredLimiteds.map(item => <ItemCard key={item.id} item={item} />)}
                        </div>
                    </section>
                )}

                {/* ── How it works ──────────────────────────────────────── */}
                <section style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ marginBottom: '1.25rem' }}>How It Works</h2>
                    <div className="grid-3">
                        <HowStep n="01" title="Collect Items" body="Browse the catalog and purchase regular and limited items using Kitties." />
                        <HowStep n="02" title="Trade & Sell"  body="List your limiteds on the market or trade directly with other players." />
                        <HowStep n="03" title="Customize"     body="Equip items to your 3D avatar and express your style." />
                    </div>
                </section>

                {/* ── New Arrivals ──────────────────────────────────────── */}
                {featuredRegular.length > 0 && (
                    <section style={{ marginBottom: '2.5rem' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2>New Arrivals</h2>
                            <Link href="/catalog" className="btn btn--ghost btn--sm">Full catalog</Link>
                        </div>
                        <div className="grid-6">
                            {featuredRegular.map(item => <ItemCard key={item.id} item={item} />)}
                        </div>
                    </section>
                )}

                {/* ── CTA ───────────────────────────────────────────────── */}
                {!user && (
                    <section>
                        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                            <h2 style={{ marginBottom: '0.5rem' }}>Ready to start?</h2>
                            <p className="text-subtle text-sm" style={{ marginBottom: '1.5rem' }}>
                                Sign up free and receive your starting Kitties.
                            </p>
                            <Link href="/register" className="btn btn--primary btn--lg">Create Free Account</Link>
                        </div>
                    </section>
                )}
            </div>

            {/* Footer */}
            <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)', marginTop: '3rem' }}>
                <div className="page" style={{ paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
                    <div className="flex items-center justify-between text-xs text-muted flex-wrap gap-4">
                        <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>YourLittleCase!</span>
                        <div className="flex gap-4">
                            <Link href="/catalog">Catalog</Link>
                            <Link href="/market">Market</Link>
                            <Link href="/forum">Forum</Link>
                        </div>
                        <span>&copy; {new Date().getFullYear()} YourLittleCase!</span>
                    </div>
                </div>
            </footer>
        </Layout>
    );
}

function StatItem({ label, value }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)' }}>{Number(value).toLocaleString()}</div>
            <div className="text-xs text-muted" style={{ marginTop: '2px' }}>{label}</div>
        </div>
    );
}

function HowStep({ n, title, body }) {
    return (
        <div className="card card__body" style={{ padding: '1.25rem' }}>
            <div className="section-label" style={{ marginBottom: '0.5rem' }}>{n}</div>
            <h3 style={{ marginBottom: '0.4rem' }}>{title}</h3>
            <p className="text-sm text-subtle">{body}</p>
        </div>
    );
}

function ItemCard({ item }) {
    return (
        <Link href={`/catalog/${item.id}`} className="item-card">
            <div className="item-card__thumb">
                {item.thumbnail_url
                    ? <img src={item.thumbnail_url} alt={item.name} />
                    : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${item.color_primary ?? '#6366f1'}44, transparent)` }} />
                }
                {item.type === 'limited' && <span className="item-card__ltd">LTD</span>}
            </div>
            <div className="item-card__info">
                <div className="item-card__name">{item.name}</div>
                <div className="item-card__price">{item.price > 0 ? `${item.price.toLocaleString()} K` : 'Free'}</div>
                {item.type === 'limited' && item.rap > 0 && <div className="item-card__rap">RAP {item.rap.toLocaleString()}</div>}
            </div>
        </Link>
    );
}
