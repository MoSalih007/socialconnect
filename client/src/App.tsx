import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';

// Auth Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { VerifyEmail } from './pages/VerifyEmail';
import { ResendVerification } from './pages/ResendVerification';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';

// Main Pages
import { Feed } from './pages/Feed';
import { Profile } from './pages/Profile';
import { CreatePost } from './pages/CreatePost';
import { Messages } from './pages/Messages';
import { Notifications } from './pages/Notifications';
import { Search } from './pages/Search';
import { SavedPosts } from './pages/SavedPosts';
import { Settings } from './pages/Settings';
import { PostDetail } from './pages/PostDetail';
import { EditProfile } from './pages/EditProfile';
import { BlockedUsers } from './pages/BlockedUsers';
import { FollowRequests } from './pages/FollowRequests';
import { HashtagPage } from './pages/HashtagPage';

// Admin Pages
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ReportsQueue } from './pages/admin/ReportsQueue';
import { UserManagement } from './pages/admin/UserManagement';
import { ContentModeration } from './pages/admin/ContentModeration';
import { AuditLog } from './pages/admin/AuditLog';

// Layout
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  if (!token) return <Navigate to='/login' />;
  if (!user?.is_admin) return <Navigate to='/' />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-screen'>
      <Navbar />
      <main className='pt-16 pb-20 md:pb-0'>{children}</main>
      <MobileNav />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode='wait'>
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/resend-verification" element={<ResendVerification />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><Layout><Feed /></Layout></ProtectedRoute>} />
        <Route path="/create" element={<ProtectedRoute><Layout><CreatePost /></Layout></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><Layout><Messages /></Layout></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Layout><Search /></Layout></ProtectedRoute>} />
        <Route path="/saved" element={<ProtectedRoute><Layout><SavedPosts /></Layout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
        <Route path="/settings/edit" element={<ProtectedRoute><Layout><EditProfile /></Layout></ProtectedRoute>} />
        <Route path="/settings/blocked" element={<ProtectedRoute><Layout><BlockedUsers /></Layout></ProtectedRoute>} />
        <Route path="/settings/follow-requests" element={<ProtectedRoute><Layout><FollowRequests /></Layout></ProtectedRoute>} />
        <Route path="/hashtag/:tag" element={<ProtectedRoute><Layout><HashtagPage /></Layout></ProtectedRoute>} />

        <Route path="/post/:id" element={<ProtectedRoute><Layout><PostDetail /></Layout></ProtectedRoute>} />
        <Route path="/profile/:username" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="reports" element={<ReportsQueue />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="moderation" element={<ContentModeration />} />
          <Route path="audit-log" element={<AuditLog />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  );
}

function ThemeInitializer() {
  const theme = useUIStore(s => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeInitializer />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2500,
          style: {
            background: 'var(--color-surface-card)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            fontSize: '14px',
            boxShadow: 'var(--shadow-card)',
          },
        }}
      />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

export default App;