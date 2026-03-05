import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { scrollToTop } from "@/lib/scrollUtils";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Twitter, 
  Instagram, 
  Youtube,
  Heart,
  Star,
  Award,
  Shield,
  Truck,
  Crown,
  Sparkles,
  ArrowRight,
  Send
} from "lucide-react";
import { motion } from "framer-motion";
import { getImageUrl } from "@/lib/api";

const footerSections = [
  {
    title: "Company",
    icon: <Crown className="h-5 w-5" />,
    links: [
      { name: "About Us", path: "/about", icon: <Heart className="h-4 w-4" /> },
      { name: "Our Artisans", path: "/artisans", icon: <Award className="h-4 w-4" /> },
      { name: "Contact", path: "/contact", icon: <Mail className="h-4 w-4" /> },
      { name: "Careers", path: "/careers", icon: <Star className="h-4 w-4" /> }
    ]
  },
  {
    title: "Customer Care", 
    icon: <Shield className="h-5 w-5" />,
    links: [
      { name: "Help Center", path: "/help", icon: <Phone className="h-4 w-4" /> },
      { name: "Shipping Info", path: "/shipping", icon: <Truck className="h-4 w-4" /> },
      { name: "Returns", path: "/returns", icon: <ArrowRight className="h-4 w-4" /> },
      { name: "Size Guide", path: "/size-guide", icon: <Star className="h-4 w-4" /> }
    ]
  },
  {
    title: "Shop Categories",
    icon: <Sparkles className="h-5 w-5" />,
    links: [
      { name: "All Products", path: "/shop", icon: <Star className="h-4 w-4" /> },
      { name: "Pottery & Ceramics", path: "/shop?category=pottery", icon: <Award className="h-4 w-4" /> },
      { name: "Textiles & Fabrics", path: "/shop?category=textiles", icon: <Heart className="h-4 w-4" /> },
      { name: "Jewelry & Accessories", path: "/shop?category=jewelry", icon: <Crown className="h-4 w-4" /> }
    ]
  },
  {
    title: "For Sellers",
    icon: <Award className="h-5 w-5" />,
    links: [
      { name: "Start Selling", path: "/seller-onboarding", icon: <ArrowRight className="h-4 w-4" /> },
      { name: "Seller Dashboard", path: "/seller-dashboard", icon: <Star className="h-4 w-4" /> },
      { name: "Resources", path: "/seller-resources", icon: <Shield className="h-4 w-4" /> },
      { name: "Success Stories", path: "/success-stories", icon: <Crown className="h-4 w-4" /> }
    ]
  }
];

const socialLinks = [
  { name: "Facebook", icon: <Facebook className="h-5 w-5" />, url: "#", color: "hover:text-blue-600" },
  { name: "Instagram", icon: <Instagram className="h-5 w-5" />, url: "#", color: "hover:text-pink-600" },
  { name: "Twitter", icon: <Twitter className="h-5 w-5" />, url: "#", color: "hover:text-blue-400" },
  { name: "Youtube", icon: <Youtube className="h-5 w-5" />, url: "#", color: "hover:text-red-600" }
];

const trustBadges = [
  { icon: <Shield className="h-6 w-6" />, title: "Secure Payment", desc: "256-bit SSL encryption" },
  { icon: <Truck className="h-6 w-6" />, title: "Free Shipping", desc: "On orders over ₹999" },
  { icon: <Award className="h-6 w-6" />, title: "Authentic Crafts", desc: "Verified artisans only" },
  { icon: <Heart className="h-6 w-6" />, title: "Satisfaction", desc: "30-day return policy" }
];

export const Footer = () => {
  return (
    <footer className="relative bg-gradient-to-br from-background via-muted/50 to-background border-t border-border/50 dark:bg-gradient-to-br dark:from-background dark:via-background/90 dark:to-background/95 dark:border-border/40">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-primary-glow/[0.02] dark:from-primary/[0.05] dark:via-transparent dark:to-primary-glow/[0.05]" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Trust Badges */}
        <motion.div
          className="py-12 border-b border-border/30"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {trustBadges.map((badge, index) => (
              <motion.div
                key={badge.title}
                className="flex flex-col items-center text-center p-4 rounded-xl bg-background/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-300 group dark:bg-background/80 dark:backdrop-blur-lg dark:border-border/40 dark:hover:border-primary/40 dark:hover:shadow-dark-glow"
                whileHover={{ scale: 1.02, y: -2 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="p-3 rounded-full bg-gradient-to-r from-primary/10 to-primary-glow/10 text-primary mb-3 group-hover:from-primary/20 group-hover:to-primary-glow/20 transition-all duration-300 dark:from-primary/20 dark:to-primary-glow/20 dark:group-hover:from-primary/30 dark:group-hover:to-primary-glow/30 dark:drop-shadow-lg">
                  {badge.icon}
                </div>
                <h4 className="font-semibold text-foreground mb-1 dark:text-foreground drop-shadow-sm dark:drop-shadow-lg">{badge.title}</h4>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground drop-shadow-sm">{badge.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Join Seller Section */}
        <motion.div
          className="text-center py-16 border-b border-border/30 dark:border-border/40"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="max-w-3xl mx-auto">
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-primary-glow/10 text-primary font-medium text-sm mb-6 dark:from-primary/20 dark:to-primary-glow/20 dark:text-primary dark:drop-shadow-lg"
              whileHover={{ scale: 1.05 }}
            >
              <Crown className="h-4 w-4 drop-shadow-sm dark:drop-shadow-lg" />
              <span className="drop-shadow-sm dark:drop-shadow-lg">Artisan Partnership Program</span>
              <Sparkles className="h-4 w-4 drop-shadow-sm dark:drop-shadow-lg" />
            </motion.div>
            
            <h2 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-foreground via-primary to-primary-glow bg-clip-text text-transparent mb-6 dark:from-foreground dark:via-primary dark:to-primary-glow drop-shadow-sm dark:drop-shadow-lg">
              Join Our Artisan Community
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed dark:text-muted-foreground drop-shadow-sm dark:drop-shadow-lg">
              Transform your passion into profit. Connect with customers worldwide and showcase your authentic craftsmanship.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-600 hover:to-primary text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 dark:shadow-dark-glow dark:hover:shadow-dark-floating" 
                  asChild
                >
                  <Link to="/seller-onboarding" className="flex items-center gap-2">
                    <Crown className="h-5 w-5" />
                    Start Selling Today
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/5 px-6 py-6 text-lg rounded-xl dark:border-primary/40 dark:text-primary dark:hover:bg-primary/10 dark:hover:shadow-dark-glow" asChild>
                  <Link to="/artisans">View Success Stories</Link>
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>
        
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Brand Section */}
            <motion.div 
              className="lg:col-span-2"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center mb-6">
                <motion.div whileHover={{ scale: 1.05 }}>
                  <Link to="/" onClick={scrollToTop} className="flex items-center group">
                    <img 
                      src="/logo.png" 
                      alt="ZAYMAZONE Logo" 
                      className="h-28 w-auto object-contain group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="ml-3">
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent dark:from-primary dark:to-primary-glow drop-shadow-sm dark:drop-shadow-lg">
                        ZAYMAZONE
                      </h3>
                      <p className="text-sm text-muted-foreground font-medium dark:text-muted-foreground drop-shadow-sm dark:drop-shadow-lg">
                        Crafting Culture. Empowering Artisans.
                      </p>
                    </div>
                  </Link>
                </motion.div>
              </div>
              
              <p className="text-muted-foreground mb-8 leading-relaxed text-lg dark:text-muted-foreground drop-shadow-sm dark:drop-shadow-lg">
                Discover authentic handcrafted treasures from talented artisans across India. Each piece tells a story of tradition, skill, and cultural heritage.
              </p>
              
              {/* Newsletter Signup */}
              <div className="mb-8">
                <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2 dark:text-foreground drop-shadow-sm dark:drop-shadow-lg">
                  <Mail className="h-5 w-5 text-primary dark:text-primary drop-shadow-sm dark:drop-shadow-lg" />
                  Stay Updated
                </h4>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter your email" 
                    className="flex-1 bg-background/50 border-border/50 focus:border-primary/50 dark:bg-background/80 dark:border-border/40 dark:focus:border-primary/60"
                  />
                  <Button className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-600 hover:to-primary text-white px-6 dark:shadow-dark-glow">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 dark:text-muted-foreground drop-shadow-sm">
                  Get exclusive offers and artisan stories delivered to your inbox.
                </p>
              </div>
              
              {/* Social Links */}
              <div>
                <h4 className="font-semibold text-foreground mb-4 dark:text-foreground drop-shadow-sm dark:drop-shadow-lg">Follow Us</h4>
                <div className="flex gap-3">
                  {socialLinks.map((social) => (
                    <motion.a
                      key={social.name}
                      href={social.url}
                      className={`p-3 rounded-full bg-background/50 border border-border/50 hover:border-primary/30 transition-all duration-300 ${social.color} dark:bg-background/80 dark:border-border/40 dark:hover:border-primary/40 dark:hover:shadow-dark-glow`}
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {social.icon}
                    </motion.a>
                  ))}
                </div>
              </div>
            </motion.div>
            
            {/* Footer Sections */}
            <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-3 gap-8">
              {footerSections.map((section, index) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <h4 className="font-semibold text-foreground mb-6 flex items-center gap-2 dark:text-foreground drop-shadow-sm dark:drop-shadow-lg">
                    <span className="text-primary dark:text-primary drop-shadow-sm dark:drop-shadow-lg">{section.icon}</span>
                    {section.title}
                  </h4>
                  <ul className="space-y-4">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        <Link
                          to={link.path}
                          className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors duration-300 group dark:text-muted-foreground dark:hover:text-primary dark:hover:shadow-dark-glow"
                        >
                          <span className="text-primary/60 group-hover:text-primary group-hover:scale-110 transition-all duration-300 dark:text-primary/80 dark:group-hover:text-primary drop-shadow-sm dark:drop-shadow-lg">
                            {link.icon}
                          </span>
                          <span className="group-hover:translate-x-1 transition-transform duration-300 drop-shadow-sm dark:drop-shadow-lg">
                            {link.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <motion.div
          className="py-8 border-t border-border/30 dark:border-border/40"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-6 text-sm text-muted-foreground dark:text-muted-foreground drop-shadow-sm">
              <p>© 2024 Zaymazone. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <Link to="/terms" className="hover:text-primary transition-colors dark:hover:text-primary">Terms</Link>
                <Link to="/privacy" className="hover:text-primary transition-colors dark:hover:text-primary">Privacy</Link>
                <Link to="/privacy" className="hover:text-primary transition-colors dark:hover:text-primary">Cookies</Link>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-muted-foreground drop-shadow-sm">
              <span>Made with</span>
              <Heart className="h-4 w-4 text-red-500 animate-pulse" />
              <span>in India</span>
              <Badge variant="secondary" className="bg-gradient-to-r from-primary/10 to-primary-glow/10 text-primary border-0 dark:from-primary/20 dark:to-primary-glow/20 dark:text-primary dark:drop-shadow-lg">
                <Star className="h-3 w-3 mr-1" />
                4.9/5 Rating
              </Badge>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};