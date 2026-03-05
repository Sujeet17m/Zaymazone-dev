import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      setIsLoading(true);
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to send reset email';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-card rounded-2xl border shadow-sm p-8">
            {sent ? (
              // ── Success state ───────────────────────────────────────────────
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-foreground">Check your inbox</h1>
                <p className="text-muted-foreground">
                  We've sent a password reset link to{' '}
                  <span className="font-medium text-foreground">{email}</span>.
                  The link will expire in 1 hour.
                </p>
                <p className="text-sm text-muted-foreground">
                  Didn't receive it? Check your spam folder or{' '}
                  <button
                    onClick={() => setSent(false)}
                    className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                  >
                    try again
                  </button>
                  .
                </p>
                <Button asChild className="w-full mt-4">
                  <Link to="/sign-in">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Sign In
                  </Link>
                </Button>
              </div>
            ) : (
              // ── Form state ─────────────────────────────────────────────────
              <>
                <div className="mb-8 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground">Forgot your password?</h1>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    No worries — enter your account email and we'll send you a reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="priya@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="h-11"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/sign-in"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Sign In
                  </Link>
                </div>

                <div className="mt-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/sign-up" className="text-primary hover:text-primary/80 font-medium transition-colors">
                      Sign up
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Artisan link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Are you an artisan?{' '}
            <Link to="/sign-in-artisan" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Artisan sign in
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ForgotPassword;
