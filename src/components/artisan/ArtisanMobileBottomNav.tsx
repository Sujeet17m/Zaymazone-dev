// ── Module 14: Artisan Mobile Bottom Navigation ───────────────────────────────
// Touch-optimised, keyboard-accessible bottom navigation for the artisan
// dashboard on small screens.  Hidden on lg+ where the sidebar is shown.
import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Menu,
} from 'lucide-react';
import type { ArtisanSection } from './ArtisanSidebar';

interface ArtisanMobileBottomNavProps {
  activeSection: ArtisanSection;
  onNavigate: (s: ArtisanSection) => void;
  onMenuOpen: () => void;
  pendingOrders?: number;
  lowStockCount?: number;
}

interface NavItem {
  id: ArtisanSection | '__menu__';
  label: string;
  icon: React.ElementType;
  isMenu?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { id: 'orders',    label: 'Orders',    icon: ShoppingCart },
  { id: 'products',  label: 'Products',  icon: Package },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: '__menu__',  label: 'More',      icon: Menu, isMenu: true },
];

export function ArtisanMobileBottomNav({
  activeSection,
  onNavigate,
  onMenuOpen,
  pendingOrders = 0,
  lowStockCount = 0,
}: ArtisanMobileBottomNavProps) {
  const navRef = useRef<HTMLElement>(null);

  const getBadge = (id: string): number => {
    if (id === 'orders')   return pendingOrders;
    if (id === 'products') return lowStockCount;
    return 0;
  };

  // Arrow-key navigation between buttons
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const buttons = navRef.current?.querySelectorAll<HTMLButtonElement>('button[data-nav-item]');
    if (!buttons) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(idx + 1) % buttons.length]?.focus();
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(idx - 1 + buttons.length) % buttons.length]?.focus();
    }
  };

  return (
    <nav
      ref={navRef}
      className="artisan-mobile-nav lg:hidden"
      aria-label="Artisan dashboard navigation"
    >
      {NAV_ITEMS.map(({ id, label, icon: Icon, isMenu }, idx) => {
        const isActive = !isMenu && id === activeSection;
        const badge = getBadge(id);

        return (
          <button
            key={id}
            type="button"
            data-nav-item="true"
            aria-label={badge > 0 ? `${label}, ${badge} pending` : label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => (isMenu ? onMenuOpen() : onNavigate(id as ArtisanSection))}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'artisan-mobile-nav__item',
              isActive && 'artisan-mobile-nav__item--active',
            )}
          >
            <span className="relative inline-flex items-center justify-center">
              <Icon className="h-5 w-5" aria-hidden="true" />
              {badge > 0 && (
                <span className="artisan-mobile-nav__badge" aria-hidden="true">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span className="artisan-mobile-nav__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
