import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppShell from './components/layout/AppShell'
import PlatformShell from './components/layout/PlatformShell'
import RootRedirect from './components/RootRedirect'
import ErrorBoundary from './components/ErrorBoundary'
import GraceBanner from './components/layout/GraceBanner'
import LockedScreen from './components/layout/LockedScreen'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import PendingApproval from './pages/PendingApproval'
import DashboardHome from './pages/dashboard/Home'
import ParticipantsPage from './pages/participants/ParticipantsPage'
import ParticipantDetailPage from './pages/participants/ParticipantDetailPage'
import PrintBadgesPage from './pages/participants/PrintBadgesPage'
import GroupsPage from './pages/groups/GroupsPage'
import ProgramsPage from './pages/programs/ProgramsPage'
import ContextsPage from './pages/contexts/ContextsPage'
import ContextDetailPage from './pages/contexts/ContextDetailPage'
import KiosksPage from './pages/kiosks/KiosksPage'
import KioskSetupPage from './pages/kiosk/KioskSetupPage'
import KioskScanPage from './pages/kiosk/KioskScanPage'
import OnlineCheckinPage from './pages/online/OnlineCheckinPage'
import ReportsPage from './pages/reports/ReportsPage'
import GradesPage from './pages/grades/GradesPage'
import CaComponentsPage from './pages/grades/CaComponentsPage'
import SettingsPage from './pages/settings/SettingsPage'
import BillingPage from './pages/billing/BillingPage'
import BillingCallbackPage from './pages/billing/BillingCallbackPage'
import TermsPage from './pages/terms/TermsPage'
import StudentRecordPage from './pages/public/StudentRecordPage'
import MessagesPage from './pages/messages/MessagesPage'
import PlatformRoute from './pages/platform/PlatformRoute'
import PlatformHome from './pages/platform/PlatformHome'
import PlatformCustomers from './pages/platform/PlatformCustomers'
import PlatformAccountDetail from './pages/platform/PlatformAccountDetail'
import PlatformInbox from './pages/platform/PlatformInbox'
import { getAccessState, type AccessState } from './lib/api/access'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">Loading...</p>
    </div>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, account, loading } = useAuth()
  const [accessState, setAccessState] = useState<AccessState | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (!account) {
        setChecking(false)
        return
      }
      const { data } = await getAccessState(account.id)
      if (cancelled) return
      setAccessState(data)
      setChecking(false)
    }

    if (loading) return
    if (!account) {
      setChecking(false)
      return
    }

    check()
    return () => {
      cancelled = true
    }
  }, [account, loading])

  if (loading || checking) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (account && account.status === 'pending') {
    return <Navigate to="/pending" replace />
  }

  // Locked: full-page lock screen, no children rendered
  if (accessState === 'locked') {
    return <LockedScreen />
  }

  // Grace: banner on top, children still render (read-only enforcement is per-page)
  if (accessState === 'grace') {
    return (
      <div className="flex h-[100dvh] flex-col">
        <GraceBanner
          expiresAt={account?.access_expires_at ?? null}
          graceDays={account?.lockout_grace_days ?? 7}
        />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    )
  }

  // Active: normal render
  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { session, account, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (session) {
    if (account?.status === 'pending') return <Navigate to="/pending" replace />
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function PendingRoute() {
  const { session, account, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (account && account.status !== 'pending') {
    return <Navigate to="/" replace />
  }
  return <PendingApproval />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/pending" element={<PendingRoute />} />

      <Route path="/kiosk/setup/:token" element={<KioskSetupPage />} />
      <Route path="/kiosk/scan" element={<KioskScanPage />} />

      <Route path="/k/:code" element={<OnlineCheckinPage />} />

      <Route
        path="/platform"
        element={
          <PlatformRoute>
            <PlatformShell />
          </PlatformRoute>
        }
      >
        <Route index element={<PlatformHome />} />
        <Route path="customers" element={<PlatformCustomers />} />
        <Route path="customers/:id" element={<PlatformAccountDetail />} />
        <Route path="inbox" element={<PlatformInbox />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/participants" element={<ParticipantsPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/participants/print" element={<PrintBadgesPage />} />
        <Route path="/participants/:id" element={<ParticipantDetailPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/contexts" element={<ContextsPage />} />
        <Route path="/contexts/:id" element={<ContextDetailPage />} />
        <Route path="/kiosks" element={<KiosksPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/grades" element={<GradesPage />} />
        <Route path="/grades/settings" element={<CaComponentsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/billing/callback" element={<BillingCallbackPage />} />
      </Route>

      <Route path="/s/:systemId" element={<StudentRecordPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}