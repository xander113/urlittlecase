import { Link } from '@inertiajs/react';
import Layout from '@/Root';

export default function ForumIndex({ categories }) {
    return (
        <Layout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <h1>Forum</h1>
                        <div className="page-header__sub">Community discussion boards</div>
                    </div>
                    <Link href="/forum/create" className="btn btn--primary btn--sm">New Thread</Link>
                </div>

                {categories.map(cat => (
                    <div key={cat.id} className="forum-category mb-4">
                        <div className="forum-category__header">{cat.name}</div>
                        {cat.description && (
                            <div style={{ padding: '0.45rem 1rem', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-3)' }}>
                                {cat.description}
                            </div>
                        )}

                        {cat.subcategories && cat.subcategories.length > 0 ? (
                            cat.subcategories.map(sub => (
                                <Link key={sub.id} href={`/forum/${sub.slug}`} className="forum-row" style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
                                    <div className="forum-row__icon">
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                        </svg>
                                    </div>
                                    <div className="forum-row__main">
                                        <div className="forum-row__title">{sub.name}</div>
                                        {sub.description && <div className="forum-row__sub">{sub.description}</div>}
                                        {sub.latest_thread && (
                                            <div className="forum-row__sub" style={{ marginTop: 2 }}>
                                                Latest: <strong>{sub.latest_thread.title}</strong> by {sub.latest_thread.author_name}
                                            </div>
                                        )}
                                    </div>
                                    <div className="forum-row__count">
                                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{sub.threads_count ?? 0}</div>
                                        <div>threads</div>
                                        <div style={{ marginTop: 2 }}>{sub.posts_count ?? 0} posts</div>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="forum-row">
                                <div className="forum-row__main">
                                    <div className="forum-row__sub">No boards in this category.</div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Layout>
    );
}
