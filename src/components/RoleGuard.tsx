import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const PageLoadingSkeleton = () => (
  <div className="min-h-screen flex flex-col animate-pulse">
    <div className="h-16 bg-muted border-b" />
    <div className="flex-1 flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      <div className="h-8 bg-muted rounded-lg w-1/4" />
      <div className="h-48 bg-muted rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted rounded-lg" />)}
      </div>
    </div>
  </div>
);

interface RoleGuardProps {
  /** Roles that are permitted to view this route. */
  allow: Array<'user' | 'artisan' | 'admin'>
  children: React.ReactNode
}

/**
 * Blocks access to a route based on the authenticated user's role.
 *
 * Redirect logic:
 *  - Not authenticated           → /sign-in  (with `from` state for deep-link return)
 *  - admin trying artisan page   → /admin
 *  - non-artisan on artisan page → role-appropriate home
 *  - non-user on user-only page  → role-appropriate home
 */
export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || !user) {
      // Preserve the requested URL so SignIn can redirect back after login
      navigate('/sign-in', { replace: true, state: { from: location } })
      return
    }
    if (!allow.includes(user.role)) {
      // Redirect to the correct home based on role
      if (user.role === 'admin') {
        navigate('/admin', { replace: true })
      } else if (user.role === 'artisan') {
        navigate('/artisan-dashboard', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    }
  }, [isLoading, isAuthenticated, user, allow, navigate, location])

  if (isLoading) return <PageLoadingSkeleton />
  if (!isAuthenticated || !user) return <PageLoadingSkeleton />
  if (!allow.includes(user.role)) return <PageLoadingSkeleton />

  return <>{children}</>
}
