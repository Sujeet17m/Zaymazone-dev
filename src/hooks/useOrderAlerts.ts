// ── Module 9: Real-time Order Alerts Hook ────────────────────────────────────
import { useRef, useEffect, useCallback, useState } from 'react';
import type { Order } from '@/lib/api';

export interface OrderAlertState {
  /** True when at least one new placed order has arrived since last clearAlert(). */
  alertActive: boolean;
  /** IDs of placed orders that arrived since last clear. */
  newOrderIds: string[];
  /** Dismiss the visual alert (does NOT prevent future triggered ones). */
  clearAlert: () => void;
}

/**
 * Watches a stream of orders and fires a visual + optional audio alert
 * whenever a previously-unseen 'placed' order appears in the list.
 *
 * The first call initialises the "seen" baseline without triggering alerts —
 * subsequent updates that contain new placed-order IDs will fire the alert.
 */
export function useOrderAlerts(orders: Order[], soundEnabled = true): OrderAlertState {
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const [alertActive, setAlertActive] = useState(false);
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);

  /** Play a two-tone chime using the Web Audio API (silent on browsers that block it). */
  const playAlert = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();

      const beep = (freq: number, startAt: number, duration: number) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0,    ctx.currentTime + startAt);
        gain.gain.linearRampToValueAtTime(0.18,  ctx.currentTime + startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startAt);
        osc.stop(ctx.currentTime + startAt + duration + 0.05);
      };

      beep(880,  0,    0.18);   // A5
      beep(1046, 0.22, 0.22);   // C6
    } catch {
      // Audio blocked or unsupported — silently skip
    }
  }, [soundEnabled]);

  const clearAlert = useCallback(() => {
    setAlertActive(false);
    setNewOrderIds([]);
  }, []);

  useEffect(() => {
    if (orders.length === 0) return;

    const placedOrders = orders.filter((o) => o.status === 'placed');

    // First call: prime the seen-set silently (no alert on initial load)
    if (!initialized.current) {
      placedOrders.forEach((o) => seenIds.current.add(o._id));
      initialized.current = true;
      return;
    }

    // Subsequent calls: find newly arrived placed orders
    const arrived: string[] = [];
    placedOrders.forEach((o) => {
      if (!seenIds.current.has(o._id)) {
        seenIds.current.add(o._id);
        arrived.push(o._id);
      }
    });

    if (arrived.length > 0) {
      setNewOrderIds((prev) => [...new Set([...prev, ...arrived])]);
      setAlertActive(true);
      playAlert();
    }
  }, [orders, playAlert]);

  return { alertActive, newOrderIds, clearAlert };
}
