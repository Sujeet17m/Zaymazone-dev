import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Mail, Lock, MapPin, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { authSchemas, sanitizeObject, logEvent, ClientRateLimiter } from "@/lib/security";

interface AuthDialogProps {
  children: React.ReactNode;
}

export const AuthDialog = ({ children }: AuthDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, updateUserProfile } = useAuth();
  const limiter = new ClientRateLimiter(5, 60_000);

  const [signInData, setSignInData] = useState({
    email: "",
    password: ""
  });

  const [signUpData, setSignUpData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zipCode: ""
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limiter.allow("auth:signin")) {
      toast.error("Too many attempts. Please wait a minute.");
      return;
    }
    setIsLoading(true);

    try {
      const parsed = authSchemas.signIn.safeParse(sanitizeObject(signInData));
      if (!parsed.success) {
        toast.error("Please check your email and password.");
        return;
      }
      await signIn(parsed.data.email, parsed.data.password);
      toast.success("Welcome back!");
      setIsOpen(false);
      setSignInData({ email: "", password: "" });
    } catch (error) {
      logEvent({ level: "warn", message: "Sign-in failed", context: { error: String(error) } });
      toast.error("Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limiter.allow("auth:signup")) {
      toast.error("Too many attempts. Please wait a minute.");
      return;
    }

    setIsLoading(true);

    try {
      const parsed = authSchemas.signUp.safeParse(sanitizeObject(signUpData));
      if (!parsed.success) {
        toast.error(parsed.error.errors[0]?.message ?? "Please fix the highlighted fields.");
        return;
      }
      await signUp(parsed.data.email, parsed.data.password, parsed.data.name);
      // Save shipping address collected during sign-up
      if (signUpData.street || signUpData.phone) {
        await updateUserProfile({
          phone: signUpData.phone || undefined,
          address: signUpData.street ? {
            street: signUpData.street,
            city: signUpData.city,
            state: signUpData.state,
            zipCode: signUpData.zipCode,
            country: 'India'
          } : undefined
        });
      }
      toast.success("Account created successfully!");
      setIsOpen(false);
      setSignUpData({ name: "", email: "", password: "", confirmPassword: "", phone: "", street: "", city: "", state: "", zipCode: "" });
    } catch (error) {
      logEvent({ level: "error", message: "Sign-up failed", context: { error: String(error) } });
      toast.error("Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to ZAYMAZONE</DialogTitle>
          <DialogDescription>
            Sign in to your account or create a new one to get started.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10"
                    value={signInData.email}
                    onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    className="pl-10"
                    value={signInData.password}
                    onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your full name"
                    className="pl-10"
                    value={signUpData.name}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    className="pl-10"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="Confirm your password"
                    className="pl-10"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Shipping address — collected at registration so checkout is frictionless */}
              <div className="space-y-3 pt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Shipping Address
                </p>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="Phone number (e.g. 9876543210)"
                    className="pl-10"
                    value={signUpData.phone}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <Input
                  id="signup-street"
                  placeholder="Street address"
                  value={signUpData.street}
                  onChange={(e) => setSignUpData(prev => ({ ...prev, street: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="signup-city"
                    placeholder="City"
                    value={signUpData.city}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, city: e.target.value }))}
                  />
                  <Input
                    id="signup-state"
                    placeholder="State"
                    value={signUpData.state}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, state: e.target.value }))}
                  />
                </div>
                <Input
                  id="signup-zip"
                  placeholder="PIN Code (e.g. 400001)"
                  value={signUpData.zipCode}
                  onChange={(e) => setSignUpData(prev => ({ ...prev, zipCode: e.target.value }))}
                  pattern="[0-9]{6}"
                />
                <p className="text-xs text-muted-foreground">Optional — saves you time at checkout. You can add or update this from your profile anytime.</p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};