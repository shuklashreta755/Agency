import { useEffect, useRef } from 'react';
import { getCurrentPosition } from '../utils/geo';
import { getSocket } from '../api/socket';
import api from '../api/axios';

// How often an agent's device reports its GPS position while online.
const BROADCAST_INTERVAL_MS = 15000;

/**
 * Periodically reads the current agent's GPS position and reports it so
 * brokers can see it on the Agent Tracking map. This is the piece that
 * actually populates AgentLocation — without it, an "online" agent has a
 * live socket connection but no recorded coordinates, so Agent Tracking
 * has nothing to show.
 *
 * Reuses the same getCurrentPosition() promise wrapper used elsewhere
 * (e.g. Site Visit check-in) for consistent permission/error handling.
 * Reports over the live socket when connected — so brokers see it in real
 * time via the existing 'location:updated' listener — and falls back to
 * the REST endpoint otherwise, so a momentarily disconnected/reconnecting
 * socket doesn't just drop the update.
 *
 * @param {boolean} enabled - pass true only for agents (brokers don't
 *   broadcast a location); false/omitted does nothing and cleans up any
 *   existing timer.
 */
export function useAgentLocationBroadcast(enabled) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return undefined;

    let cancelled = false;

    const broadcast = async () => {
      try {
        const { lat, lng } = await getCurrentPosition();
        if (cancelled) return;

        const socket = getSocket();
        if (socket?.connected) {
          socket.emit('location:update', { lat, lng });
        } else {
          await api.post('/tracking', { lat, lng });
        }
      } catch {
        // Permission denied, GPS unavailable, etc. — skip this round rather
        // than nagging the agent; we'll simply try again on the next tick.
      }
    };

    broadcast();
    timerRef.current = setInterval(broadcast, BROADCAST_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [enabled]);
}
