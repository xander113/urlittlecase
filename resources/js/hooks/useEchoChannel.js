import { useEffect, useRef } from 'react';

/**
 * Subscribe to a public Echo channel and listen for an event.
 * Automatically cleans up on unmount.
 *
 * @param {string|null} channelName  - null = skip
 * @param {string}      eventName
 * @param {Function}    handler
 * @param {Array}       deps
 */
export function useEchoChannel(channelName, eventName, handler, deps = []) {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        if (!channelName || !window.Echo) return;

        const channel = window.Echo.channel(channelName);
        channel.listen(eventName, (data) => handlerRef.current(data));

        return () => {
            try {
                window.Echo.leaveChannel(channelName);
            } catch (_) {}
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelName, eventName, ...deps]);
}

/**
 * Subscribe to a private Echo channel.
 */
export function useEchoPrivateChannel(channelName, eventName, handler, deps = []) {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        if (!channelName || !window.Echo) return;

        const channel = window.Echo.private(channelName);
        channel.listen(eventName, (data) => handlerRef.current(data));

        return () => {
            try {
                window.Echo.leaveChannel(`private-${channelName}`);
            } catch (_) {}
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelName, eventName, ...deps]);
}
