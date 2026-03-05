import { Link, useLocation } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Home, Search, ArrowLeft, Package, Brush, HelpCircle } from "lucide-react";

/** Map common path prefixes to the nearest real route. */
const ROUTE_HINTS: Array<{ pattern: RegExp; label: string; to: string }> = [
  { pattern: /^\/product/,   label: "Browse Products",  to: "/shop" },
  { pattern: /^\/artisan/,   label: "Meet Artisans",    to: "/artisans" },
  { pattern: /^\/order/,     label: "My Orders",        to: "/orders" },
  { pattern: /^\/blog/,      label: "Blog",             to: "/blog" },
  { pattern: /^\/account/,   label: "My Account",       to: "/dashboard" },
  { pattern: /^\/sign/,      label: "Sign In",          to: "/sign-in" },
  { pattern: /^\/category/,  label: "Categories",       to: "/categories" },
  { pattern: /^\/help/,      label: "Help & Support",   to: "/help" },
];

const NotFound = () => {
  const location = useLocation();
  const triedPath = location.pathname;

  // Find the best matching hint for the attempted path
  const hint = ROUTE_HINTS.find(h => h.pattern.test(triedPath));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto">
          {/* Large 404 */}
          <div className="mb-6">
            <div className="text-[120px] font-bold leading-none bg-gradient-to-br from-primary via-primary/70 to-primary/30 bg-clip-text text-transparent select-none">
              404
            </div>
            <div className="w-24 h-1.5 bg-gradient-to-r from-primary to-primary/30 mx-auto rounded-full mt-1" />
          </div>

          {/* Error Message */}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Page not found
          </h1>
          <p className="text-muted-foreground mb-3 leading-relaxed">
            The page you're looking for has wandered off — like a craft piece finding its new home.
          </p>

          {/* Show the attempted path */}
          {triedPath && triedPath !== "/" && (
            <div className="inline-flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm text-muted-foreground mb-6 font-mono">
              <span>Tried:</span>
              <span className="text-foreground font-medium truncate max-w-[260px]">{triedPath}</span>
            </div>
          )}

          {/* Smart suggestion based on attempted path */}
          {hint && (
            <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              Were you looking for{" "}
              <Link
                to={hint.to}
                className="font-semibold text-primary hover:underline underline-offset-4 transition-colors"
              >
                {hint.label}
              </Link>
              ?
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/">
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link to="/shop">
                <Search className="w-4 h-4 mr-2" />
                Browse Products
              </Link>
            </Button>
            {window.history.length > 1 && (
              <Button
                variant="ghost"
                size="lg"
                className="w-full sm:w-auto text-muted-foreground"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            )}
          </div>

          {/* Quick Links */}
          <div className="border-t border-border pt-8">
            <p className="text-sm text-muted-foreground mb-5">Or try one of these popular pages:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { to: "/artisans",         label: "Meet Artisans",   icon: <Brush className="w-4 h-4" /> },
                { to: "/categories",       label: "Categories",       icon: <Package className="w-4 h-4" /> },
                { to: "/about",            label: "About Us",         icon: <Home className="w-4 h-4" /> },
                { to: "/help",             label: "Help & Support",   icon: <HelpCircle className="w-4 h-4" /> },
              ].map(({ to, label, icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <span className="text-primary group-hover:scale-110 transition-transform">{icon}</span>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotFound;
