import { useState, useEffect, useRef } from 'react';
import { usePage } from '@inertiajs/react';

export function useNotifications() {
    const [notifications, setNotifications] = useState([]);
    const auth   = usePage().props;
    const userId = auth?.user?.id ?? null;
    const chanRef = useRef(null);

    // Initial load from API
    useEffect(() => {
        if (!userId) return;
        window.axios?.get('/notifications').then(res => {
            const data = res.data?.data ?? [];
            setNotifications(data.map(n => ({ ...n, read: n.is_read })));
        }).catch(() => {});
    }, [userId]);

    // Live push via Reverb private channel
    useEffect(() => {
        if (!userId || !window.Echo) return;
        const channelName = `notifications.${userId}`;
        try {
            chanRef.current = window.Echo.private(channelName);
            chanRef.current.listen('.notification', (data) => {
                setNotifications(prev => [
                    { ...data, id: `live_${Date.now()}`, read: false },
                    ...prev.slice(0, 49),
                ]);
            });
        } catch (e) {
            console.warn('useNotifications: Echo error', e);
        }
        return () => {
            try { window.Echo.leaveChannel(`private-${channelName}`); } catch {}
        };
    }, [userId]);

    function dismiss(id) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        // Mark read on server
        window.axios?.post('/notifications/read').catch(() => {});
    }

    function clear() {
        setNotifications([]);
        window.axios?.post('/notifications/read').catch(() => {});
    }

    return { notifications, dismiss, clear };
}
