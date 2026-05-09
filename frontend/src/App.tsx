import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { authService } from './services/authService';

// Layout components (to be created)
import Layout from './components/layout/Layout';
import AuthLayout from './components/layout/AuthLayout';

// Pages (to be created)
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import CompleteRegistration from './pages/auth/CompleteRegistration';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/jobs/Jobs';
import JobDetail from './pages/jobs/JobDetail';
import JobForm from './pages/jobs/JobForm';
import CompanyJobs from './pages/jobs/CompanyJobs';
import CandidateJobs from './pages/jobs/CandidateJobs';
import ApplyJob from './pages/jobs/ApplyJob';
import Applications from './pages/applications/Applications';
import ApplicationDetail from './pages/applications/ApplicationDetail';
import Interviews from './pages/interviews/Interviews';
import InterviewDetail from './pages/interviews/InterviewDetail';
import VideoMeetingRoom from './pages/interviews/VideoMeetingRoom';
import Questions from './pages/questions/Questions';
import CandidateSourcing from './pages/sourcing/CandidateSourcing';
import OfferManagement from './pages/offers/OfferManagement';
import HRManagement from './pages/admin/HRManagement';
import AdminDashboard from './pages/admin/AdminDashboard';
import SuperAdminPanel from './pages/superadmin/SuperAdminPanel';
import Profile from './pages/Profile';
import ProctoringCheck from './pages/proctoring/ProctoringCheck';
import ProctoringDashboard from './pages/proctoring/ProctoringDashboard';
import NotFound from './pages/NotFound';

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Role-based route guard — redirects unauthorized roles to dashboard
const RoleGuard = ({ children, roles }: { children: React.ReactNode; roles: string[] }) => {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

// Dashboard redirect - admin roles skip dashboard
const DashboardRedirect = () => {
  const { user } = useAuthStore();
  if (user?.role === 'admin' && !user?.companyId) {
    return <Navigate to="/superadmin" replace />;
  }
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  return <Dashboard />;
};

function App() {
  const { setUser, token, isAuthenticated } = useAuthStore();

  // Fetch current user on mount if authenticated
  const { data: userData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authService.getCurrentUser,
    enabled: isAuthenticated && !!token,
  });

  useEffect(() => {
    if (userData) {
      setUser(userData);
    }
  }, [userData, setUser]);

  return (
    <Routes>
      {/* Public routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/complete-registration" element={<CompleteRegistration />} />
      </Route>

      {/* Proctoring check - Public route */}
      <Route path="/proctoring-check/:interviewId" element={<ProctoringCheck />} />

      {/* Company-specific job listings - Public route */}
      <Route path="/company/:slug/jobs" element={<CompanyJobs />} />

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardRedirect />} />
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/candidate/jobs" element={<CandidateJobs />} />
        <Route path="/jobs/:id/apply" element={<ApplyJob />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/new" element={<RoleGuard roles={['admin', 'hr', 'employer']}><JobForm /></RoleGuard>} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/jobs/:id/edit" element={<RoleGuard roles={['admin', 'hr', 'employer']}><JobForm /></RoleGuard>} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/applications/:id" element={<ApplicationDetail />} />
        <Route path="/interviews" element={<Interviews />} />
        <Route path="/interviews/:id" element={<InterviewDetail />} />
        <Route path="/interviews/:id/room" element={<VideoMeetingRoom />} />
        <Route path="/questions" element={<RoleGuard roles={['admin', 'hr', 'employer']}><Questions /></RoleGuard>} />
        <Route path="/sourcing" element={<RoleGuard roles={['admin', 'hr', 'employer']}><CandidateSourcing /></RoleGuard>} />
        <Route path="/offers" element={<RoleGuard roles={['admin', 'hr', 'employer']}><OfferManagement /></RoleGuard>} />
        <Route path="/proctoring/monitor" element={<RoleGuard roles={['admin', 'hr', 'employer']}><ProctoringDashboard /></RoleGuard>} />
        <Route path="/admin" element={<RoleGuard roles={['admin']}><AdminDashboard /></RoleGuard>} />
        <Route path="/admin/hr-management" element={<RoleGuard roles={['admin']}><HRManagement /></RoleGuard>} />
        <Route path="/superadmin" element={<RoleGuard roles={['admin']}><SuperAdminPanel /></RoleGuard>} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
