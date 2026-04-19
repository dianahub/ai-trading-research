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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/admin/outreach" element={<AdminOutreach />} />
        <Route path="/admin/partners" element={<AdminPartners />} />
        <Route path="/partners" element={<PartnersLanding />} />
        <Route path="/partners/apply" element={<PartnersApply />} />
        <Route path="/partners/dashboard" element={<PartnersDashboard />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
