import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, MapPin } from "lucide-react";

interface LoginFormProps {
    onSuccess?: () => void;
    redirectTo?: string;
}

export function LoginForm({ onSuccess, redirectTo }: LoginFormProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        displayName: "",
        phone: "",
        street: "",
        city: "",
        state: "",
        zipCode: "",
    });

    const { signIn, signUp, updateUserProfile } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isLogin) {
                // Login
                await signIn(formData.email, formData.password);
                toast({
                    title: "Welcome back!",
                    description: "You've successfully logged in.",
                });
            } else {
                // Signup
                if (formData.password !== formData.confirmPassword) {
                    toast({
                        title: "Error",
                        description: "Passwords do not match",
                        variant: "destructive",
                    });
                    setIsLoading(false);
                    return;
                }

                await signUp(formData.email, formData.password, formData.displayName);
                // Persist shipping address collected during sign-up
                if (formData.street || formData.phone) {
                    await updateUserProfile({
                        phone: formData.phone || undefined,
                        address: formData.street ? {
                            street: formData.street,
                            city: formData.city,
                            state: formData.state,
                            zipCode: formData.zipCode,
                            country: 'India'
                        } : undefined
                    });
                }
                toast({
                    title: "Account created!",
                    description: "Welcome to Zaymazone!",
                });
            }

            // Call success callback
            if (onSuccess) {
                onSuccess();
            }

            // Redirect if specified
            if (redirectTo) {
                navigate(redirectTo);
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "An error occurred. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
                <div>
                    <Input
                        type="text"
                        placeholder="Full Name"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        required={!isLogin}
                        disabled={isLoading}
                    />
                </div>
            )}

            <div>
                <Input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={isLoading}
                />
            </div>

            <div>
                <Input
                    type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    disabled={isLoading}
                    minLength={6}
                />
            </div>

            {!isLogin && (
                <div>
                    <Input
                        type="password"
                        placeholder="Confirm Password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required={!isLogin}
                        disabled={isLoading}
                        minLength={6}
                    />
                </div>
            )}

            {/* Shipping address — collected now so checkout is seamless */}
            {!isLogin && (
                <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> Shipping Address
                    </p>
                    <Input
                        type="tel"
                        placeholder="Phone number"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={isLoading}
                    />
                    <Input
                        placeholder="Street address"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        disabled={isLoading}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            placeholder="City"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            disabled={isLoading}
                        />
                        <Input
                            placeholder="State"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            disabled={isLoading}
                        />
                    </div>
                    <Input
                        placeholder="PIN Code"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                        disabled={isLoading}
                        pattern="[0-9]{6}"
                    />
                    <p className="text-xs text-muted-foreground">Optional — you can update this anytime from your profile.</p>
                </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isLogin ? "Logging in..." : "Creating account..."}
                    </>
                ) : (
                    <>{isLogin ? "Login" : "Sign Up"}</>
                )}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-primary hover:underline font-medium"
                    disabled={isLoading}
                >
                    {isLogin ? "Sign up" : "Login"}
                </button>
            </p>
        </form>
    );
}
