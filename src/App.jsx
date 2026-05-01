import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LedgerFilterProvider } from './context/LedgerFilterContext'
import { ReceiptsProvider } from './context/ReceiptsContext'
import { DimensionsProvider } from './context/DimensionsContext'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import HomePage from './pages/HomePage'
import ReviewPage from './pages/ReviewPage'
import LedgerPage from './pages/LedgerPage'
import SettingsPage from './pages/SettingsPage'
import ReceiptPage from './pages/ReceiptPage'
import DimensionsPage from './pages/DimensionsPage'
import ExportPage from './pages/ExportPage'
import GuidePage from './pages/GuidePage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted text-sm">Chargement...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <LedgerFilterProvider>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {!session ? (
            <Route path="*" element={<AuthPage />} />
          ) : (
            <Route element={<ReceiptsProvider><DimensionsProvider><Layout /></DimensionsProvider></ReceiptsProvider>}>
              <Route path="/" element={<HomePage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/ledger" element={<LedgerPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/receipt/:id" element={<ReceiptPage />} />
              <Route path="/dimensions" element={<DimensionsPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/guide" element={<GuidePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          )}
        </Routes>
      </LedgerFilterProvider>
    </BrowserRouter>
  )
}
