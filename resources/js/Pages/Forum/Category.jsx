import { useState } from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoChannel } from '@/hooks/useEchoChannel';

export default function ForumCategory({ category, threads }) {
    const auth = usePage().props;
    const user = auth?.user;

    // Live new-thread notification
    useEchoChannel(`forum.category.${category.id}`, '.thread.created', () => {
        router.reload({ only: ['threads'] });
    });

    return (
        <Layout>
            <div className="page">
                {/* Breadcrumb */}
                <div className="flex gap-2 text-sm text-muted mb-4" style={{ alignItems: 'center' }}>
                    <Link href="/forum">Forum</Link>
                    <span>/</span>
                    <span style={{ color: 'var(--text-2)' }}>{category.name}</span>
                </div>

                <div className="page-header">
                    <div>
                        <h1>{category.name}</h1>
                        {category.description && <div className="page-header__sub">{category.description}</div>}
                    </div>
                    {user && !category.is_locked && (
                        <Link href={`/forum/${category.slug}/create`} className="btn btn--primary btn--sm">
                            New Thread
                        </Link>
                    )}
                </div>

                <div className="card">
                    {threads.data.length === 0 ? (
                        <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                            <p className="text-muted text-sm">No threads yet.</p>
                            {user && !category.is_locked && (
                                <Link href={`/forum/${category.slug}/create`} className="btn btn--primary btn--sm" style={{ marginTop: '1rem', display: 'inline-flex' }}>
                                    Start the first thread
                                </Link>
                            )}
                        </div>
                    ) : (
                        threads.data.map(thread => (
                            <Link
                                key={thread.id}
                                href={`/forum/${category.slug}/${thread.slug}`}
                                className={`thread-row${thread.is_pinned ? ' thread-row--pinned' : ''}${thread.is_locked ? ' thread-row--locked' : ''}`}
                            >
                                <img
                                    src={thread.author?.avatar_thumbnail ?? null}
                                    alt={thread.author?.name}
                                    className="thread-row__avatar"
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                                <div className="thread-row__body">
                                    <div className="thread-row__title">{thread.title}</div>
                                    <div className="thread-row__meta">
                                        by {thread.author?.name ?? 'Unknown'} &middot; {new Date(thread.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="thread-row__stats">
                                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{thread.posts_count ?? 0}</div>
                                    <div>replies</div>
                                    {thread.last_post_at && (
                                        <div style={{ marginTop: 2 }}>{new Date(thread.last_post_at).toLocaleDateString()}</div>
                                    )}
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                <Pagination links={threads.links} />
            </div>
        </Layout>
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
