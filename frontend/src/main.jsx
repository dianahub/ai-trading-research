import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import TermsPage from './pages/TermsPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import AboutPage from './pages/AboutPage.jsx'
import AdminOutreach from './pages/AdminOutreach.jsx'
import PartnersLanding from './pages/PartnersLanding.jsx'
import PartnersApply from './pages/PartnersApply.jsx'
import PartnersDashboard from './pages/PartnersDashboard.jsx'
import AdminPartners from './pages/AdminPartners.jsx'
import AdminAstrologers from './pages/AdminAstrologers.jsx'
import AdminFreeSignups from './pages/AdminFreeSignups.jsx'
import AdminPage from './pages/AdminPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import MagicLoginPage from './pages/MagicLoginPage.jsx'
import BetaPage from './pages/BetaPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import JoinPage from './pages/JoinPage.jsx'
import AdminCommissions from './pages/AdminCommissions.jsx'
import AdminPendingUsers from './pages/AdminPendingUsers.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminConfig from './pages/AdminConfig.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/outreach" element={<AdminOutreach />} />
        <Route path="/admin/partners" element={<AdminPartners />} />
        <Route path="/admin/astrologers" element={<AdminAstrologers />} />
        <Route path="/admin/free-signups" element={<AdminFreeSignups />} />
        <Route path="/partners" element={<PartnersLanding />} />
        <Route path="/partners/apply" element={<PartnersApply />} />
        {/* Protected routes — require login when AUTH_ENABLED=true */}
        <Route path="/partners/dashboard" element={<ProtectedRoute><PartnersDashboard /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
        {/* Auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/magic-login" element={<MagicLoginPage />} />
        {/* Beta */}
        <Route path="/beta" element={<BetaPage />} />
        <Route path="/join" element={<BetaPage />} />
        <Route path="/join/:slug" element={<JoinPage />} />
        {/* Admin */}
        <Route path="/admin/commissions" element={<AdminCommissions />} />
        <Route path="/admin/pending-users" element={<AdminPendingUsers />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/config" element={<AdminConfig />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
