import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sellerApi } from '@/services/api';

const SignInArtisan = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect already-authenticated users away from this page
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      const home = user.role === 'admin' ? '/admin'
        : user.role === 'artisan' ? '/artisan-dashboard'
        : '/dashboard';
      navigate(from || home, { replace: true });
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

      // Cross-account guard: if the email exists only as a customer (not as an artisan),
      // redirect the user to the customer sign-in page.
      try {
        const check = await sellerApi.checkEmail(email);
        if (check.existsAsCustomer && !check.existsAsArtisan) {
          toast.error('This email is registered as a customer account. Please sign in at the customer sign-in page.');
          return;
        }
      } catch {
        // Network failure — allow sign-in attempt to proceed
      }

      await signIn(email, password, 'artisan');
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      navigate(from || '/artisan-dashboard', { replace: true });
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <img
          src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
          alt="Artisan at work"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white text-center">
          <Palette className="w-16 h-16 mb-6 text-orange-200" />
          <h1 className="text-4xl font-bold mb-4">Welcome Back, Artisan</h1>
          <p className="text-xl opacity-90 max-w-md">
            Continue sharing your beautiful crafts with the world through Zaymazone
          </p>
        </div>
      </div>

      {/* Right side - Sign In Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                <Palette className="w-8 h-8 text-orange-600" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-foreground">Artisan Sign In</h2>
            <p className="mt-2 text-muted-foreground">
              Access your artisan dashboard
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
                className="text-sm text-orange-600 hover:text-orange-500"
              >
                Forgot your password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>



          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              New artisan?{' '}
              <Link to="/sign-up-artisan" className="text-orange-600 hover:text-orange-500 font-medium">
                Join as artisan
              </Link>
            </p>
            <p className="mt-2 text-muted-foreground">
              Regular user?{' '}
              <Link to="/sign-in" className="text-primary hover:text-primary/80 font-medium">
                Sign in as customer
              </Link>
            </p>
          </div>

          <div className="mt-8 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800">
            <h3 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
              Benefits of joining as an Artisan:
            </h3>
            <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
              <li>• Showcase your handcrafted products</li>
              <li>• Reach customers across India</li>
              <li>• Manage orders and inventory</li>
              <li>• Connect with fellow artisans</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInArtisan;