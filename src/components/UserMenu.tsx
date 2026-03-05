import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Package, LogOut, Palette, BarChart3, Heart, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { getImageUrl } from "@/lib/api";

export const UserMenu = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    // After clearing auth state, send the user to the home page
    // so protected-route guards never pick up an unauthenticated user on a
    // restricted page and cause a redirect loop back to /sign-in.
    navigate('/', { replace: true });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDashboardLink = () => {
    return user?.role === 'artisan' ? '/artisan-dashboard' : '/dashboard';
  };

  const getProfileLink = () => {
    return user?.role === 'artisan' ? '/artisan/profile' : '/profile';
  };

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={getImageUrl(user?.avatar)} alt={user?.name} />
            <AvatarFallback className={user?.role === 'artisan' ? 'bg-orange-600 text-white' : 'bg-primary text-primary-foreground'}>
              {user ? getInitials(user.name) : <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-2 bg-background/98 backdrop-blur-xl border-primary/20 shadow-xl z-[100]" align="end" sideOffset={8} forceMount>
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={getImageUrl(user?.avatar)} alt={user?.name} />
              <AvatarFallback className={user?.role === 'artisan' ? 'bg-primary text-white' : 'bg-primary text-primary-foreground'}>
                {user ? getInitials(user.name) : <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none">{user?.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
              <p className="text-xs leading-none text-primary capitalize font-medium">
                {user?.role} Account
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-primary/20" />
        
        <DropdownMenuItem className="cursor-pointer py-3 px-2 rounded-lg hover:bg-primary/5 transition-colors" asChild>
          <Link to={getDashboardLink()}>
            {user?.role === 'artisan' ? (
              <Palette className="mr-3 h-4 w-4 text-primary" />
            ) : (
              <User className="mr-3 h-4 w-4 text-primary" />
            )}
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>

        {user?.role === 'artisan' ? (
          <>
            <DropdownMenuItem className="cursor-pointer py-3 px-2 rounded-lg hover:bg-primary/5 transition-colors" asChild>
              <Link to="/artisan/products">
                <Package className="mr-3 h-4 w-4 text-primary" />
                <span>My Products</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer py-3 px-2 rounded-lg hover:bg-primary/5 transition-colors" asChild>
              <Link to="/artisan/orders">
                <BarChart3 className="mr-3 h-4 w-4 text-primary" />
                <span>Orders</span>
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem className="cursor-pointer py-3 px-2 rounded-lg hover:bg-primary/5 transition-colors" asChild>
              <Link to="/orders">
                <Package className="mr-3 h-4 w-4 text-primary" />
                <span>My Orders</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer py-3 px-2 rounded-lg hover:bg-primary/5 transition-colors" asChild>
              <Link to="/wishlist">
                <Heart className="mr-3 h-4 w-4 text-primary" />
                <span>Wishlist</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer py-3 px-2 rounded-lg hover:bg-primary/5 transition-colors" asChild>
              <Link to="/addresses">
                <MapPin className="mr-3 h-4 w-4 text-primary" />
                <span>Addresses</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuItem className="cursor-pointer py-3 px-2 rounded-lg hover:bg-primary/5 transition-colors" asChild>
          <Link to={getProfileLink()}>
            <User className="mr-3 h-4 w-4 text-primary" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-primary/20" />
        <DropdownMenuItem 
          className="cursor-pointer py-3 px-2 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5 transition-colors"
          onClick={handleSignOut}
        >
          <LogOut className="mr-3 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};