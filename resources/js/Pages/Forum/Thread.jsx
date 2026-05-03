import { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import Layout from '@/Root';
import { useEchoChannel } from '@/hooks/useEchoChannel';

export default function ForumThread({ thread, posts, category }) {
    const auth = usePage().props;
    const user = auth?.user;
    const isStaff = user && ['moderator','admin'].includes(user.role);

    const [body,     setBody]     = useState('');
    const [replying, setReplying] = useState(false);

    // Live post streaming
    useEchoChannel(`forum.thread.${thread.id}`, '.post.created', () => {
        router.reload({ only: ['posts'] });
    });

    function submitReply(e) {
        e.preventDefault();
        if (!body.trim()) return;
        setReplying(true);
        router.post(`/forum/${category.slug}/${thread.slug}/reply`, { body }, {
            onSuccess: () => setBody(''),
            onFinish:  () => setReplying(false),
        });
    }

    function deletePost(postId) {
        if (!confirm('Delete this post?')) return;
        router.delete(`/forum/posts/${postId}`);
    }

    function pinThread() { router.post(`/forum/${category.slug}/${thread.slug}/pin`); }
    function lockThread() { router.post(`/forum/${category.slug}/${thread.slug}/lock`); }

    return (
        <Layout>
            <div className="page page--narrow">
                {/* Breadcrumb */}
                <div className="flex gap-2 text-sm text-muted mb-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <a href="/forum" style={{ color: 'var(--text-3)' }}>Forum</a>
                    <span>/</span>
                    <a href={`/forum/${category.slug}`} style={{ color: 'var(--text-3)' }}>{category.name}</a>
                    <span>/</span>
                    <span style={{ color: 'var(--text-2)' }}>{thread.title}</span>
                </div>

                {/* Thread header */}
                <div className="card mb-4">
                    <div className="card__header">
                        <h1 style={{ fontSize: '1.15rem' }}>{thread.title}</h1>
                        <div className="flex gap-2" style={{ flexShrink: 0 }}>
                            {thread.is_pinned  && <span className="badge badge--accent">Pinned</span>}
                            {thread.is_locked  && <span className="badge badge--neutral">Locked</span>}
                            {isStaff && (
                                <>
                                    <button onClick={pinThread}  className="btn btn--ghost btn--sm">{thread.is_pinned  ? 'Unpin'   : 'Pin'}</button>
                                    <button onClick={lockThread} className="btn btn--ghost btn--sm">{thread.is_locked ? 'Unlock' : 'Lock'}</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Posts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    {posts.data.map((post, i) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            isFirst={i === 0 && posts.current_page === 1}
                            currentUser={user}
                            isStaff={isStaff}
                            onDelete={deletePost}
                        />
                    ))}
                </div>

                <Pagination links={posts.links} />

                {/* Reply form */}
                {user && !thread.is_locked ? (
                    <div className="card mt-4">
                        <div className="card__header"><h3 className="text-sm fw-700">Post a Reply</h3></div>
                        <div className="card__body">
                            <textarea
                                className="input input--textarea"
                                placeholder="Write your reply..."
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                rows={4}
                                style={{ marginBottom: '0.75rem' }}
                            />
                            <button
                                onClick={submitReply}
                                disabled={replying || !body.trim()}
                                className="btn btn--primary btn--sm"
                            >
                                {replying ? 'Posting...' : 'Post Reply'}
                            </button>
                        </div>
                    </div>
                ) : thread.is_locked ? (
                    <div className="card mt-4">
                        <div className="card__body text-sm text-muted">This thread is locked.</div>
                    </div>
                ) : !user ? (
                    <div className="card mt-4">
                        <div className="card__body text-sm text-muted">
                            <a href="/login">Log in</a> to reply.
                        </div>
                    </div>
                ) : null}
            </div>
        </Layout>
    );
}

function PostCard({ post, isFirst, currentUser, isStaff, onDelete }) {
    const canDelete = isStaff || (currentUser && currentUser.id === post.author_id);

    return (
        <div className="card" style={{ display: 'flex', overflow: 'hidden' }}>
            {/* Author sidebar */}
            <div style={{
                width: 120, flexShrink: 0,
                background: 'var(--bg-3)',
                borderRight: '1px solid var(--border)',
                padding: '1rem 0.75rem',
                textAlign: 'center',
            }}>
                <a href={`/users/${post.author?.name}`}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 'var(--r-sm)',
                        background: 'var(--bg-4)', margin: '0 auto 0.5rem',
                        overflow: 'hidden', border: '1px solid var(--border)',
                    }}>
                        {post.author?.avatar_thumbnail && (
                            <img src={post.author.avatar_thumbnail} alt={post.author.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        )}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word' }}>
                        {post.author?.name ?? 'Unknown'}
                    </div>
                </a>
                {post.author?.role !== 'user' && (
                    <div className="badge badge--accent" style={{ marginTop: 4, display: 'inline-block' }}>
                        {post.author.role}
                    </div>
                )}
                <div className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                    {post.author?.posts_count ?? 0} posts
                </div>
            </div>

            {/* Post body */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    padding: '0.5rem 0.75rem',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <span className="text-xs text-muted">{new Date(post.created_at).toLocaleString()}</span>
                    <div className="flex gap-2">
                        {isFirst && <span className="badge badge--neutral text-xs">Original Post</span>}
                        {canDelete && (
                            <button onClick={() => onDelete(post.id)} className="btn btn--ghost btn--sm" style={{ color: 'var(--danger)' }}>
                                Delete
                            </button>
                        )}
                    </div>
                </div>
                <div style={{ padding: '0.9rem 0.75rem', fontSize: '0.88rem', color: 'var(--text-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {post.body}
                </div>
            </div>
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
