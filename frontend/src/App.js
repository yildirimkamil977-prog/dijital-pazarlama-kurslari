import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { SiteProvider } from "@/context/SiteContext";
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import PublicLayout from "@/components/layout/PublicLayout";

import Home from "@/pages/Home";
import CourseDetail from "@/pages/CourseDetail";
import GroupDetail from "@/pages/GroupDetail";

const About = lazy(() => import("@/pages/About"));
const Courses = lazy(() => import("@/pages/Courses"));
const InstructorPage = lazy(() => import("@/pages/InstructorPage"));
const GroupList = lazy(() => import("@/pages/GroupList"));
const Cart = lazy(() => import("@/pages/Cart"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const PaymentResult = lazy(() => import("@/pages/PaymentResult"));
const TransferNotify = lazy(() => import("@/pages/TransferNotify"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const LegalPage = lazy(() => import("@/pages/LegalPage"));
const Contact = lazy(() => import("@/pages/Contact"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const StudentPanel = lazy(() => import("@/pages/student/StudentPanel"));
const StudentSettings = lazy(() => import("@/pages/student/StudentSettings"));
const CoursePlayer = lazy(() => import("@/pages/student/CoursePlayer"));
const AdminPanel = lazy(() => import("@/pages/admin/AdminPanel"));

const Fallback = () => <div className="flex justify-center py-40 min-h-[60vh]"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <Suspense fallback={<Fallback />}><AuthCallback /></Suspense>;
  }
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/hakkimda" element={<About />} />
          <Route path="/kurslar" element={<Courses />} />
          <Route path="/kurslar/:slug" element={<CourseDetail />} />
          <Route path="/egitmen/:slug" element={<InstructorPage />} />
          <Route path="/canli-grup-egitimleri" element={<GroupList />} />
          <Route path="/canli-grup-egitimleri/:slug" element={<GroupDetail />} />
          <Route path="/sepet" element={<Cart />} />
          <Route path="/iletisim" element={<Contact />} />
          <Route path="/odeme" element={<Checkout />} />
          <Route path="/odeme/sonuc" element={<PaymentResult />} />
          <Route path="/havale-bildirimi" element={<TransferNotify />} />
          <Route path="/sozlesmeler/:type" element={<LegalPage />} />
          <Route path="/giris" element={<Login />} />
          <Route path="/kayit-ol" element={<Register />} />
          <Route path="/sifremi-unuttum" element={<ForgotPassword />} />
          <Route path="/sifre-sifirla" element={<ResetPassword />} />
          <Route path="/panel" element={<ProtectedRoute><StudentPanel /></ProtectedRoute>} />
          <Route path="/panel/ayarlar" element={<ProtectedRoute><StudentSettings /></ProtectedRoute>} />
        </Route>

        <Route path="/panel/izle/:courseId" element={<ProtectedRoute><CoursePlayer /></ProtectedRoute>} />
        <Route path="/yonetim/*" element={<AdminRoute><AdminPanel /></AdminRoute>} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <SiteProvider>
        <AuthProvider>
          <CartProvider>
            <AppRouter />
            <Toaster position="top-right" richColors />
          </CartProvider>
        </AuthProvider>
      </SiteProvider>
    </BrowserRouter>
  );
}

export default App;
