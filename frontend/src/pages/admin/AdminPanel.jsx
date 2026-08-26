import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, BookOpen, Users, CreditCard, Tag, Settings, GraduationCap, LogOut, Home, UserCog, CalendarClock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCourses from "@/pages/admin/AdminCourses";
import CourseEditor from "@/pages/admin/CourseEditor";
import AdminStudents from "@/pages/admin/AdminStudents";
import AdminPayments from "@/pages/admin/AdminPayments";
import AdminDiscounts from "@/pages/admin/AdminDiscounts";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminInstructors from "@/pages/admin/AdminInstructors";
import AdminConsulting from "@/pages/admin/AdminConsulting";

const nav = [
  { to: "/yonetim", label: "Genel Bakış", icon: LayoutDashboard, end: true },
  { to: "/yonetim/kurslar", label: "Kurslar", icon: BookOpen },
  { to: "/yonetim/egitmenler", label: "Eğitmenler", icon: UserCog },
  { to: "/yonetim/danismanlik", label: "Danışmanlık", icon: CalendarClock },
  { to: "/yonetim/ogrenciler", label: "Öğrenciler", icon: Users },
  { to: "/yonetim/odemeler", label: "Ödemeler", icon: CreditCard },
  { to: "/yonetim/indirimler", label: "İndirim Kodları", icon: Tag },
  { to: "/yonetim/ayarlar", label: "Site Ayarları", icon: Settings },
];

export default function AdminPanel() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 shrink-0 border-r border-white/10 bg-ink-surface/40 flex flex-col fixed inset-y-0 z-30 hidden md:flex">
        <div className="h-16 flex items-center gap-2.5 px-6 border-b border-white/10">
          <span className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center"><GraduationCap className="w-4 h-4 text-ink" strokeWidth={2.5} /></span>
          <span className="font-heading font-bold tracking-tight">Yönetim</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-testid={`admin-nav-${n.label}`}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${isActive ? "bg-gold text-ink" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
              <n.icon className="w-4 h-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-1">
          <button onClick={() => navigate("/")} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200"><Home className="w-4 h-4" /> Siteye Dön</button>
          <button onClick={async () => { await logout(); navigate("/"); }} data-testid="admin-logout" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors duration-200"><LogOut className="w-4 h-4" /> Çıkış</button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 glass border-b border-white/10 overflow-x-auto">
        <div className="flex gap-1 p-2 w-max">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap ${isActive ? "bg-gold text-ink" : "text-muted-foreground"}`}>
              <n.icon className="w-3.5 h-3.5" /> {n.label}
            </NavLink>
          ))}
        </div>
      </div>

      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <div className="p-5 sm:p-8 max-w-6xl mx-auto">
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="kurslar" element={<AdminCourses />} />
            <Route path="kurslar/yeni" element={<CourseEditor />} />
            <Route path="kurslar/:id" element={<CourseEditor />} />
            <Route path="egitmenler" element={<AdminInstructors />} />
            <Route path="danismanlik" element={<AdminConsulting />} />
            <Route path="ogrenciler" element={<AdminStudents />} />
            <Route path="odemeler" element={<AdminPayments />} />
            <Route path="indirimler" element={<AdminDiscounts />} />
            <Route path="ayarlar" element={<AdminSettings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
