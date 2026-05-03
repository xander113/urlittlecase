import { useState } from 'react';
import { router } from '@inertiajs/react';
import Layout from '@/Root';

export default function ForumCreate({ categories, preselected }) {
    const [category, setCategory] = useState(preselected?.id ?? '');
    const [title,    setTitle]    = useState('');
    const [body,     setBody]     = useState('');
    const [busy,     setBusy]     = useState(false);

    const selectedCat = categories.flatMap(c => c.subcategories ?? []).find(s => String(s.id) === String(category));

    function submit(e) {
        e.preventDefault();
        if (!category || !title.trim() || !body.trim()) return;
        setBusy(true);
        router.post(`/forum/${selectedCat?.slug ?? category}/threads`, { title, body }, {
            onFinish: () => setBusy(false),
        });
    }

    return (
        <Layout>
            <div className="page page--narrow">
                <div className="page-header">
                    <h1>New Thread</h1>
                </div>

                <div className="card">
                    <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label className="section-label">Board</label>
                            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                                <option value="">Select a board...</option>
                                {categories.map(cat => (
                                    <optgroup key={cat.id} label={cat.name}>
                                        {(cat.subcategories ?? []).map(sub => (
                                            <option key={sub.id} value={sub.id} disabled={sub.is_locked}>
                                                {sub.name}{sub.is_locked ? ' (locked)' : ''}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="section-label">Title</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Thread title"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                maxLength={150}
                            />
                        </div>

                        <div>
                            <label className="section-label">Post</label>
                            <textarea
                                className="input input--textarea"
                                placeholder="Write your post..."
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                rows={8}
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={submit}
                                disabled={busy || !category || !title.trim() || !body.trim()}
                                className="btn btn--primary"
                            >
                                {busy ? 'Posting...' : 'Post Thread'}
                            </button>
                            <a href="/forum" className="btn btn--ghost">Cancel</a>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
