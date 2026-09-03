import * as React from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { EngineStatusProvider } from "@/contexts/EngineStatusContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import HomePage from "@/pages/public/HomePage";
import FeaturesPage from "@/pages/public/FeaturesPage";
import GalleryPage from "@/pages/public/GalleryPage";
import AboutPage from "@/pages/public/AboutPage";
import LoginPage from "@/pages/auth/LoginPage";
import SignUpPage from "@/pages/auth/SignUpPage";
import { ForgotPasswordPage, ResetPasswordPage } from "@/pages/auth/PasswordPages";
import DashboardHome from "@/pages/studio/DashboardHome";
import CreatePage from "@/pages/studio/CreatePage";
import MyCreationsPage from "@/pages/studio/MyCreationsPage";
import StoryboardDetailPage from "@/pages/studio/StoryboardDetailPage";
import HistoryPage from "@/pages/studio/HistoryPage";
import SettingsPage from "@/pages/studio/SettingsPage";
import AdminPage from "@/pages/studio/AdminPage";

/* Static hosts sometimes serve the built file at /index.html — normalise it. */
if (typeof window !== "undefined" && /\.html$/i.test(window.location.pathname)) {
  window.history.replaceState(null, "", "/" + window.location.search + window.location.hash);
}

function SplashScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <LogoMark className="h-12 w-12 [&_svg]:h-7 [&_svg]:w-7" />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Imagine • Generate • Create</p>
      </div>
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

function RedirectIfAuthed() {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  if (user) return <Navigate to="/studio" replace />;
  return <Outlet />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => window.scrollTo({ top: 0 }), [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <Compass className="h-10 w-10 text-primary" />
      <h1 className="mt-5 font-display text-3xl font-bold">Lost in the scene</h1>
      <p className="mt-2 text-muted-foreground">That page doesn't exist. Let's get you back to the studio.</p>
      <Button className="mt-6" asChild>
        <a href="/">Go home</a>
      </Button>
    </div>
  );
}

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="top-center"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: "rounded-2xl border-border font-sans" } }}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <EngineStatusProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public site */}
            <Route element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="features" element={<FeaturesPage />} />
              <Route path="gallery" element={<GalleryPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="create" element={<Navigate to="/studio/create" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* Auth */}
            <Route element={<RedirectIfAuthed />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="signup" element={<SignUpPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
            </Route>
            <Route path="reset-password" element={<ResetPasswordPage />} />

            {/* Studio (protected) */}
            <Route element={<RequireAuth />}>
              <Route path="studio" element={<DashboardLayout />}>
                <Route index element={<DashboardHome />} />
                <Route path="create" element={<CreatePage />} />
                <Route path="creations" element={<MyCreationsPage tab="all" />} />
                <Route path="images" element={<MyCreationsPage tab="images" />} />
                <Route path="videos" element={<MyCreationsPage tab="videos" />} />
                <Route path="storyboards" element={<MyCreationsPage tab="storyboards" />} />
                <Route path="storyboards/:id" element={<StoryboardDetailPage />} />
                <Route path="favorites" element={<MyCreationsPage tab="favorites" />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Routes>
          <ThemedToaster />
        </BrowserRouter>
        </EngineStatusProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
