import { useState, useEffect, createContext, useContext } from 'react';

const ThemeContext = createContext({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
    const [dark, setDark] = useState(() => {
        try {
            const saved = localStorage.getItem('ylc_theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const html = document.documentElement;
        if (dark) {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }
        try { localStorage.setItem('ylc_theme', dark ? 'dark' : 'light'); } catch {}
    }, [dark]);

    function toggle() { setDark(v => !v); }

    return (
        <ThemeContext.Provider value={{ dark, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeToggle({ className }) {
    const { dark, toggle } = useTheme();
    return (
        <button
            className={`theme-toggle ${className ?? ''}`}
            onClick={toggle}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
        />
    );
}
