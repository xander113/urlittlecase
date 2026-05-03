import { useState, useRef, useEffect } from 'react';
import { createInertiaApp, Link, usePage } from '@inertiajs/react';
import { Inertia } from '@inertiajs/inertia';
import { USALProvider } from '@usal/react';
import _ from 'lodash';
import useWindowResizeThreshold, { publicImages, sparkNotification } from './Grabs.jsx';
import { ThemeProvider, ThemeToggle } from './hooks/useTheme.jsx';
import { useNotifications } from './hooks/useNotifications.js';
import { createRoot } from 'react-dom/client';

const PUBLIC_LINKS = [
    { id: 'catalog', label: 'Catalog', href: '/catalog' },
    { id: 'market',  label: 'Market',  href: '/market'  },
];
const AUTH_LINKS = [
    { id: 'trade',   label: 'Trade',   href: '/trade'   },
    { id: 'avatar',  label: 'Avatar',  href: '/avatar'  },
    { id: 'forum',   label: 'Forum',   href: '/forum'   },
];
const STAFF_LINKS = [
    { id: 'staff',   label: 'Staff',   href: '/staff'   },
];

createInertiaApp({
    resolve: name => {
        const pages = import.meta.glob(`./Pages/**/*.jsx`, {eager: true})
        return pages[`./Pages/${name}.jsx`]
    },
    setup({el, App, props}) {
        createRoot(el).render(<App {...props}/>);
    }
})

export default function Layout({ children, option, contextHolder }) {
    const auth    = usePage().props;
    const user    = auth?.user ?? null;
    const alerts  = auth?.alerts ?? [];
    const mobile  = useWindowResizeThreshold(768);

    const [mobileOpen,    setMobileOpen]    = useState(false);
    const [userMenuOpen,  setUserMenuOpen]  = useState(false);
    const [notifOpen,     setNotifOpen]     = useState(false);
    const userMenuRef = useRef(null);
    const notifRef    = useRef(null);

    const { notifications, dismiss, clear } = useNotifications();
    const unreadCount = notifications.filter(n => !n.read).length;

    const navLinks = [
        ...PUBLIC_LINKS,
        ...(user ? AUTH_LINKS : []),
        ...(user && ['moderator','admin'].includes(user.role) ? STAFF_LINKS : []),
    ];

    const current = typeof window !== 'undefined'
        ? window.location.pathname.split('/')[1] || ''
        : '';

    useEffect(() => {
        function handler(e) {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
            if (notifRef.current    && !notifRef.current.contains(e.target))    setNotifOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function logout() {
        Inertia.post('/api/account/logout', null, {
            method: 'POST',
            onFinish: () => {
                sparkNotification('info', 'Signed out', "You're now signed out.");
                setTimeout(() => Inertia.visit('/', { method: 'GET' }), 1200);
            },
        });
    }

    if (option === 'no-options') {
        return (
            <ThemeProvider>
                <USALProvider>
                    <main id="root" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
                        {contextHolder}{children}
                    </main>
                </USALProvider>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            {/* ── Nav ──────────────────────────────────────────────────── */}
            <nav className="ylc-nav">
                <div className="ylc-nav__inner">
                    {/* Logo */}
                    <Link href="/" className="ylc-nav__logo">YourLittleCase!</Link>

                    {/* Desktop links */}
                    {!mobile && (
                        <div className="ylc-nav__links">
                            {navLinks.map(l => (
                                <Link
                                    key={l.id}
                                    href={l.href}
                                    className={`ylc-nav__link${current === l.id ? ' active' : ''}`}
                                >
                                    {l.label}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Right side */}
                    <div className="ylc-nav__right">
                        <ThemeToggle />

                        {user ? (
                            <>
                                {/* Kitties balance */}
                                <Link href="/economy" className="ylc-nav__balance">
                                    {Number(user.kitties ?? 0).toLocaleString()} K
                                </Link>

                                {/* Notification bell */}
                                <div ref={notifRef} style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setNotifOpen(v => !v)}
                                        style={{
                                            background: 'none', border: '1px solid var(--border)',
                                            borderRadius: 'var(--r-sm)', padding: '4px 8px',
                                            cursor: 'pointer', position: 'relative',
                                            color: 'var(--text-2)',
                                        }}
                                        aria-label="Notifications"
                                    >
                                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                        {unreadCount > 0 && <span className="notif-dot" />}
                                    </button>

                                    {notifOpen && (
                                        <NotificationPanel
                                            notifications={notifications}
                                            onDismiss={dismiss}
                                            onClear={clear}
                                        />
                                    )}
                                </div>

                                {/* User menu */}
                                <div ref={userMenuRef} style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setUserMenuOpen(v => !v)}
                                        className="ylc-nav__avatar-btn"
                                    >
                                        {user.avatar_thumbnail
                                            ? <img src={user.avatar_thumbnail} alt={user.name} />
                                            : (user.name?.[0]?.toUpperCase() ?? '?')
                                        }
                                    </button>

                                    {userMenuOpen && (
                                        <div className="ylc-dropdown">
                                            <div className="ylc-dropdown__item ylc-dropdown__item--header">
                                                {user.name}
                                                {user.role !== 'user' && (
                                                    <span className="badge badge--accent" style={{ marginLeft: 6, verticalAlign: 'middle' }}>
                                                        {user.role}
                                                    </span>
                                                )}
                                            </div>
                                            <Link href={`/users/${user.name}`} className="ylc-dropdown__item">Profile</Link>
                                            <Link href="/avatar"  className="ylc-dropdown__item">Avatar Editor</Link>
                                            <Link href="/economy" className="ylc-dropdown__item">Wallet</Link>
                                            <Link href="/trade"   className="ylc-dropdown__item">Trades</Link>
                                            {['moderator','admin'].includes(user.role) && (
                                                <Link href="/staff" className="ylc-dropdown__item">Staff Panel</Link>
                                            )}
                                            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
                                                <button onClick={logout} className="ylc-dropdown__item ylc-dropdown__item--danger">
                                                    Sign Out
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <Link href="/login"    className="btn btn--ghost btn--sm">Log In</Link>
                                <Link href="/register" className="btn btn--primary btn--sm">Sign Up</Link>
                            </>
                        )}

                        {/* Mobile hamburger */}
                        {mobile && (
                            <button
                                onClick={() => setMobileOpen(v => !v)}
                                style={{
                                    background: 'none', border: '1px solid var(--border)',
                                    borderRadius: 'var(--r-sm)', padding: '5px 8px',
                                    cursor: 'pointer', color: 'var(--text-2)',
                                }}
                                aria-label="Menu"
                            >
                                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    {mobileOpen
                                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                    }
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile drawer */}
                {mobile && mobileOpen && (
                    <div className="ylc-nav__links open">
                        {navLinks.map(l => (
                            <Link
                                key={l.id}
                                href={l.href}
                                className={`ylc-nav__link${current === l.id ? ' active' : ''}`}
                                onClick={() => setMobileOpen(false)}
                            >
                                {l.label}
                            </Link>
                        ))}
                        {user && (
                            <button onClick={logout} className="ylc-nav__link" style={{ cursor: 'pointer', color: 'var(--danger)', background: 'none', border: 'none', textAlign: 'left', width: '100%' }}>
                                Sign Out
                            </button>
                        )}
                    </div>
                )}
            </nav>

            {/* ── Alerts ───────────────────────────────────────────────── */}
            {alerts.map((a, i) => (
                <div key={i} className={`alert alert-${a.type}`}>
                    {a.title && <strong>{a.title}:</strong>}
                    <span>{a.body}</span>
                </div>
            ))}

            {/* ── Main ─────────────────────────────────────────────────── */}
            <USALProvider>
                <main id="root" style={{ minHeight: 'calc(100vh - var(--nav-h))', background: 'var(--bg)' }}>
                    {contextHolder}
                    {children}
                </main>
            </USALProvider>
        </ThemeProvider>
    );
}

/* ── Notification panel ───────────────────────────────────────────────────── */
function NotificationPanel({ notifications, onDismiss, onClear }) {
    return (
        <div className="notif-panel">
            <div className="notif-panel__header">
                <span>Notifications</span>
                {notifications.length > 0 && (
                    <button onClick={onClear} style={{ fontSize: '0.73rem', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Clear all
                    </button>
                )}
            </div>
            <div className="notif-panel__list">
                {notifications.length === 0 ? (
                    <div className="notif-panel__empty">No notifications.</div>
                ) : (
                    notifications.map(n => (
                        <div
                            key={n.id}
                            className={`notif-panel__item${!n.read ? ' notif-panel__item--unread' : ''}`}
                            onClick={() => onDismiss(n.id)}
                        >
                            {!n.read && <div className="notif-panel__dot" />}
                            <div>
                                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.82rem' }}>{n.message}</div>
                                {n.at && <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 2 }}>{new Date(n.at).toLocaleString()}</div>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
