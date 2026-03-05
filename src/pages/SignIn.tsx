import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sellerApi } from '@/services/api';
import { auth } from '@/lib/firebase';

/** Returns the default dashboard path for a given role. */
const roleHome = (role?: string) => {
  if (role === 'admin') return '/admin';
  if (role === 'artisan') return '/artisan-dashboard';
  return '/dashboard';
};

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signInWithGoogle, signOut, user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If the user is already authenticated, send them to their dashboard immediately
  // so they never see the sign-in form while logged in (avoids redirect loops).
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      navigate(from || roleHome(user.role), { replace: true });
    }
  }, [authLoading, isAuthenticated, user, location.state, navigate]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);

      // Cross-account guard: reject if email belongs to an artisan account
      try {
        const check = await sellerApi.checkEmail(email);
        if (check.existsAsArtisan) {
          toast.error('This email is registered as an artisan account. Please sign in at the artisan sign-in page.');
          return;
        }
      } catch {
        // Network failure — allow sign-in attempt to proceed
      }

      await signIn(email, password, 'user');
      // After signIn the AuthContext sets user; redirect to deep-link or role home
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      navigate(from || '/dashboard', { replace: true });
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle('user');

      // Cross-account guard: reject if the Google email belongs to an artisan account
      const googleEmail = auth.currentUser?.email;
      if (googleEmail) {
        try {
          const check = await sellerApi.checkEmail(googleEmail);
          if (check.existsAsArtisan) {
            await signOut();
            toast.error('This Google account is registered as an artisan. Please sign in at the artisan sign-in page.');
            return;
          }
        } catch {
          // Network failure — allow navigation to proceed
        }
      }

      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      navigate(from || '/dashboard', { replace: true });
    } catch (error: any) {
      console.error('Google sign in error:', error);
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('Google Sign-In is not available in this environment. Please use email/password sign-in.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/20 via-primary/10 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <img
          src="https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
          alt="Artisan crafts"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome Back</h1>
          <p className="text-xl opacity-90 max-w-md">
            Discover authentic handcrafted treasures from skilled artisans across India
          </p>
        </div>
      </div>

      {/* Right side - Sign In Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground">Sign In</h2>
            <p className="mt-2 text-muted-foreground">
              Access your Zaymazone account
            </p>
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-6">
            <div>
              <Label htmlFor="email">Email address</Label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:text-primary/80"
              >
                Forgot your password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full mt-4"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              *Google Sign-In may not work in development environments. Use email/password instead.
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/sign-up" className="text-primary hover:text-primary/80 font-medium">
                Sign up
              </Link>
            </p>
            <p className="mt-2 text-muted-foreground">
              Are you an artisan?{' '}
              <Link to="/sign-in-artisan" className="text-primary hover:text-primary/80 font-medium">
                Sign in as Artisan
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;