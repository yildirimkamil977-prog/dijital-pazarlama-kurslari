import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { SiteProvider } from "@/context/SiteContext";
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute";
import PublicLayout from "@/components/layout/PublicLayout";

import Home from "@/pages/Home";
import About from "@/pages/About";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import PaymentResult from "@/pages/PaymentResult";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import LegalPage from "@/pages/LegalPage";
import AuthCallback from "@/pages/AuthCallback";
import StudentPanel from "@/pages/student/StudentPanel";
import CoursePlayer from "@/pages/student/CoursePlayer";
import AdminPanel from "@/pages/admin/AdminPanel";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/hakkimda" element={<About />} />
        <Route path="/kurslar" element={<Courses />} />
        <Route path="/kurslar/:slug" element={<CourseDetail />} />
        <Route path="/sepet" element={<Cart />} />
        <Route path="/sozlesmeler/:type" element={<LegalPage />} />
        <Route path="/giris" element={<Login />} />
        <Route path="/kayit-ol" element={<Register />} />
      </Route>

      <Route path="/odeme" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
      <Route path="/odeme/sonuc" element={<ProtectedRoute><PaymentResult /></ProtectedRoute>} />
      <Route path="/panel" element={<ProtectedRoute><StudentPanel /></ProtectedRoute>} />
      <Route path="/panel/izle/:courseId" element={<ProtectedRoute><CoursePlayer /></ProtectedRoute>} />
      <Route path="/yonetim/*" element={<AdminRoute><AdminPanel /></AdminRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
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
