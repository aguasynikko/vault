import { useState } from "react";
import { GalleryVerticalEnd } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { LoginForm } from "@/components/login-form";
import { SignupForm } from "@/components/signup-form";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import MyFiles from "@/pages/MyFiles";
import SharedWithMe from "@/pages/SharedWithMe";
import Favorites from "@/pages/Favorites";
import TrashArchive from "@/pages/TrashArchive";
import Workspaces from "@/pages/Workspaces";
import { SupabaseProvider } from "@/services/supabase-store";
import ColleaguesPage from "@/pages/Colleagues";
import Recents from "@/pages/Recents";
import SettingsPage from "@/pages/Settings";
import HelpDocs from "@/pages/HelpDocs";
import Search from "@/pages/Search";
import AccountPage from "@/pages/Account";

function AppContent() {
  const { user, logout, isLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const location = useLocation();
  
  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin mb-4">
              <GalleryVerticalEnd className="size-8" />
            </div>
            <p>Loading...</p>
          </div>
        </div>
        <div style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
        }}>
          <ModeToggle />
        </div>
      </ThemeProvider>
    )
  }
  
  const pageTitle = location.pathname.startsWith("/files")
     ? "My Vault"
     : location.pathname.startsWith("/shared")
     ? "Shared with Me"
     : location.pathname.startsWith("/favorites")
     ? "Favorites"
     : location.pathname.startsWith("/trash")
     ? "Trash"
     : location.pathname.startsWith("/workspaces")
     ? "Workspaces"
     : location.pathname.startsWith("/team")
     ? "Colleagues"
     : location.pathname.startsWith("/recents")
     ? "Recents"
     : location.pathname.startsWith("/search")
     ? "Search"
     : location.pathname.startsWith("/settings")
     ? "Settings"
     : location.pathname.startsWith("/help")
     ? "Help / Docs"
     : location.pathname.startsWith("/account")
     ? "Account"
     : "Dashboard";

  if (user) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <SupabaseProvider>
          <SidebarProvider>
            <AppSidebar onLogout={logout} />
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2 px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-2 h-4" />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="/">Vault</BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
              </header>
              <div className="flex flex-1 flex-col">
                {/* Wrap all routes with FileSystemProvider for compatibility */}
                <RoutesWrapper />
              </div>
            </SidebarInset>
          </SidebarProvider>
        </SupabaseProvider>
        <div style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
        }}>
          <ModeToggle />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex justify-center gap-2 md:justify-start">
            <a href="#" className="flex items-center gap-2 font-medium">
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-4" />
              </div>
              vault
            </a>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs">
              {isLogin ? (
                <LoginForm onSignupClick={() => setIsLogin(false)} onLogin={() => {}} />
              ) : (
                <SignupForm onSigninClick={() => setIsLogin(true)} />
              )}
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <img
            src="/wallpaper.jpg"
            alt="Image"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
      <div style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1000,
      }}>
        <ModeToggle />
      </div>
    </ThemeProvider>
  );
}

function RoutesWrapper() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/files" replace />} />
      <Route path="/files" element={<MyFiles />} />
      <Route path="/shared" element={<SharedWithMe />} />
      <Route path="/favorites" element={<Favorites />} />
      <Route path="/trash" element={<TrashArchive />} />
      <Route path="/workspaces" element={<Workspaces />} />
      <Route path="/team" element={<ColleaguesPage />} />
      <Route path="/recents" element={<Recents />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/help" element={<HelpDocs />} />
      <Route path="/search" element={<Search />} />
      <Route path="/account" element={<AccountPage />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
