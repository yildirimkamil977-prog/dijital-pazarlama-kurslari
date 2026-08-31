import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, X, ShoppingCart, LayoutDashboard, LogOut, GraduationCap, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useSite } from "@/context/SiteContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { to: "/", label: "Anasayfa" },
  { to: "/kurslar", label: "Kurslar" },
  { to: "/canli-grup-egitimleri", label: "Canlı Grup Eğitimleri" },
  { to: "/hakkimda", label: "Hakkımda" },
  { to: "/iletisim", label: "İletişim" },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { settings } = useSite();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate("/"); };

  return (
    <header className="relative inset-x-0 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-[72px] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group" data-testid="navbar-logo">
          <span className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center gold-glow">
            <GraduationCap className="w-5 h-5 text-ink" strokeWidth={2.5} />
          </span>
          <span className="font-heading font-bold text-lg tracking-tight text-foreground leading-none">
            {settings.site_name || "Akademi"}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={`nav-${l.label}`}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  isActive ? "text-gold" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/sepet" className="relative p-2.5 rounded-lg hover:bg-secondary transition-colors duration-200" data-testid="navbar-cart">
            <ShoppingCart className="w-5 h-5 text-foreground" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 text-[11px] font-bold rounded-full bg-gold text-ink flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-secondary hover:bg-accent transition-colors duration-200" data-testid="navbar-user-menu">
                  <span className="w-7 h-7 rounded-full bg-gold text-ink flex items-center justify-center text-xs font-bold">
                    {(user.name || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:block text-sm font-medium max-w-[100px] truncate">{user.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("/yonetim")} data-testid="menu-admin">
                    <LayoutDashboard className="w-4 h-4 mr-2" /> Yönetim Paneli
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate("/panel")} data-testid="menu-panel">
                  <User className="w-4 h-4 mr-2" /> Öğrenci Panelim
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout" className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate("/giris")} data-testid="navbar-login" className="text-sm">Giriş Yap</Button>
              <Button onClick={() => navigate("/kayit-ol")} data-testid="navbar-register" className="bg-gold hover:bg-gold-hover text-ink font-semibold rounded-full">Üye Ol</Button>
            </div>
          )}

          <button className="md:hidden p-2" onClick={() => setOpen(!open)} data-testid="navbar-mobile-toggle">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden glass border-t border-white/10 px-5 py-4 space-y-1">
          {navLinks.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}
              className="block px-4 py-3 rounded-lg text-sm font-medium hover:bg-secondary">
              {l.label}
            </NavLink>
          ))}
          {!user && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); navigate("/giris"); }}>Giriş Yap</Button>
              <Button className="flex-1 bg-gold text-ink font-semibold" onClick={() => { setOpen(false); navigate("/kayit-ol"); }}>Üye Ol</Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
