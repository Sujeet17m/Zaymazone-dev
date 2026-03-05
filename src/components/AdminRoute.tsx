import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const PageLoadingSkeleton = () => (
  <div className="min-h-screen flex flex-col animate-pulse">
    <div className="h-16 bg-muted border-b" />
    <div className="flex-1 flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      <div className="h-8 bg-muted rounded-lg w-1/4" />
      <div className="h-48 bg-muted rounded-xl" />
    </div>
  </div>
);

interface AdminRouteProps {
  children: React.ReactNode
}

/**
 * Protects /admin — only admin role (Firebase auth) or a valid admin_token may access it.
 *
 * Redirect logic:
 *  - Has valid admin_token in localStorage → allow (standalone admin panel login)
 *  - Not authenticated → show Admin page's own login form (no redirect)
 *  - Authenticated admin → allow
 *  - Authenticated artisan → redirect to /artisan-dashboard
 *  - Authenticated user → redirect to /dashboard
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const hasAdminToken = (() => { try { return !!localStorage.getItem('admin_token'); } catch { return false; } })()

  useEffect(() => {
    if (isLoading) return
    if (hasAdminToken) return            // standalone admin panel login — allow
    if (!isAuthenticated) return         // let Admin page show its own login form
    if (user?.role === 'admin') return   // correct role — allow
    // Authenticated but wrong role — redirect to role-appropriate home
    if (user?.role === 'artisan') {
      navigate('/artisan-dashboard', { replace: true, state: { from: location } })
      return
    }
    navigate('/dashboard', { replace: true, state: { from: location } })
  }, [isLoading, isAuthenticated, user, hasAdminToken, navigate, location])

  if (isLoading) return <PageLoadingSkeleton />
  // Block render if authenticated with a non-admin role (no admin_token)
  if (isAuthenticated && user && user.role !== 'admin' && !hasAdminToken) return <PageLoadingSkeleton />

  return <>{children}</>
}
