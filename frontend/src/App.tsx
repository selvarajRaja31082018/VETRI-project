import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RoleRoute } from './routes/RoleRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { useAuth } from './hooks/useAuth';
import { ROLE_HOME } from './utils/constants';

import { LoginPage } from './pages/auth/LoginPage';

import { GateOverviewPage } from './pages/gate/GateOverviewPage';
import { RegisterVisitorPage } from './pages/gate/RegisterVisitorPage';
import { ReturningVisitorPage } from './pages/gate/ReturningVisitorPage';
import { TodaysVisitorsPage } from './pages/gate/TodaysVisitorsPage';
import { RestrictedEntriesPage } from './pages/gate/RestrictedEntriesPage';

import { OfficeDashboardPage } from './pages/office/OfficeDashboardPage';
import { PendingRequestsPage } from './pages/office/PendingRequestsPage';
import { VisitorQueuePage } from './pages/office/VisitorQueuePage';
import { AppointmentsPage } from './pages/office/AppointmentsPage';
import { VisitorHistoryPage } from './pages/office/VisitorHistoryPage';

import { RepresentativeDashboardPage } from './pages/representative/RepresentativeDashboardPage';
import { MeetingQueuePage } from './pages/representative/MeetingQueuePage';
import { MeetingWorkspacePage } from './pages/representative/MeetingWorkspacePage';
import { AssignedVisitorsPage } from './pages/representative/AssignedVisitorsPage';
import { ResolvedRequestsPage } from './pages/representative/ResolvedRequestsPage';

import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { UsersPage } from './pages/admin/UsersPage';
import { RepresentativesPage } from './pages/admin/RepresentativesPage';
import { AdminVisitorsPage } from './pages/admin/AdminVisitorsPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { AnalyticsPage } from './pages/admin/AnalyticsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SettingsPage } from './pages/admin/SettingsPage';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[user.roleCode]} replace />;
}

function NotFoundPage() {
  return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <h2>Page not found</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>The page you are looking for does not exist.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<HomeRedirect />} />

              <Route element={<DashboardLayout />}>
                <Route element={<RoleRoute allow={['G']} />}>
                  <Route path="/gate/overview" element={<GateOverviewPage />} />
                  <Route path="/gate/visitors/new" element={<RegisterVisitorPage />} />
                  <Route path="/gate/visitors/returning" element={<ReturningVisitorPage />} />
                  <Route path="/gate/visitors/today" element={<TodaysVisitorsPage />} />
                  <Route path="/gate/restricted" element={<RestrictedEntriesPage />} />
                </Route>

                <Route element={<RoleRoute allow={['P']} />}>
                  <Route path="/office/dashboard" element={<OfficeDashboardPage />} />
                  <Route path="/office/requests" element={<PendingRequestsPage />} />
                  <Route path="/office/queue" element={<VisitorQueuePage />} />
                  <Route path="/office/appointments" element={<AppointmentsPage />} />
                  <Route path="/office/history" element={<VisitorHistoryPage />} />
                </Route>

                <Route element={<RoleRoute allow={['R']} />}>
                  <Route path="/representative/dashboard" element={<RepresentativeDashboardPage />} />
                  <Route path="/representative/meetings" element={<MeetingQueuePage />} />
                  <Route path="/representative/meetings/:id" element={<MeetingWorkspacePage />} />
                  <Route path="/representative/assigned" element={<AssignedVisitorsPage />} />
                  <Route path="/representative/resolved" element={<ResolvedRequestsPage />} />
                </Route>

                <Route element={<RoleRoute allow={['A']} />}>
                  <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                  <Route path="/admin/users" element={<UsersPage />} />
                  <Route path="/admin/representatives" element={<RepresentativesPage />} />
                  <Route path="/admin/visitors" element={<AdminVisitorsPage />} />
                  <Route path="/admin/reports" element={<ReportsPage />} />
                  <Route path="/admin/analytics" element={<AnalyticsPage />} />
                  <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
                  <Route path="/admin/settings" element={<SettingsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
