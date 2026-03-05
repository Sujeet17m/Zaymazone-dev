/**
 * RouteProgressBar — Module 13: Routing UX
 *
 * A thin NProgress-style branded top-progress bar that appears on
 * every React Router route transition. Uses DOM refs for dynamic
 * width updates so no JSX inline styles are needed (styles live in
 * index.css under .route-progress-* classes).
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function RouteProgressBar() {
  const location = useLocation();
  const barRef  = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const prevPath = useRef(location.pathname + location.search);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const applyWidth = (pct: number) => {
    if (!barRef.current || !glowRef.current) return;
    barRef.current.style.width      = `${pct}%`;
    barRef.current.style.transition = pct === 100
      ? 'width 0.2s ease-out'
      : 'width 0.4s ease-in-out';
    glowRef.current.style.right   = `${100 - pct}%`;
    glowRef.current.style.opacity = pct > 0 && pct < 100 ? '1' : '0';
  };

  const finish = () => {
    applyWidth(100);
    const t = setTimeout(() => {
      if (railRef.current) railRef.current.style.display = 'none';
      applyWidth(0);
    }, 380);
    timers.current.push(t);
  };

  const start = () => {
    clearAll();
    if (railRef.current) railRef.current.style.display = 'block';
    applyWidth(0);
    const schedule = (pct: number, delay: number) => {
      const t = setTimeout(() => applyWidth(pct), delay);
      timers.current.push(t);
    };
    schedule(15,   50);
    schedule(40,  250);
    schedule(65,  700);
    schedule(80, 1300);
  };

  useEffect(() => {
    const next = location.pathname + location.search;
    if (next !== prevPath.current) {
      prevPath.current = next;
      start();
      const t = setTimeout(finish, 180);
      timers.current.push(t);
    }
    return clearAll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return (
    <div ref={railRef} className="route-progress-rail" aria-live="polite" aria-label="Page loading">
      <div ref={barRef}  className="route-progress-fill" />
      <div ref={glowRef} className="route-progress-glow" />
    </div>
  );
}
