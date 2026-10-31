import React, { useEffect, useState } from 'react';
import PublicPage from '../pages/PublicPage.jsx';
import Login from '../pages/LoginPage.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';

// Individual Modular Page Components
import DirectorDashboardPage from '../pages/DirectorDashboardPage.jsx';
import LeadsPage from '../pages/LeadsPage.jsx';
import SurveysPage from '../pages/SurveysPage.jsx';
import QuotesPage from '../pages/QuotesPage.jsx';
import ProjectsPage from '../pages/ProjectsPage.jsx';
import WarehouseDispatchPage from '../pages/WarehouseDispatchPage.jsx';
import InstallationCrewPage from '../pages/InstallationCrewPage.jsx';
import SupportTicketsPage from '../pages/SupportTicketsPage.jsx';
import WarrantyRegistryPage from '../pages/WarrantyRegistryPage.jsx';
import CustomerPortalPage from '../pages/CustomerPortalPage.jsx';
import SharedReportPage from '../pages/SharedReportPage.jsx';

import '../styles.css';
import { api } from '../shared/api.js';

function getDefaultSection(role) {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'DIRECTOR':
      return 'director';
    case 'SALES_EXECUTIVE':
      return 'leads';
    case 'SURVEY_TECHNICIAN':
      return 'surveys';
    case 'WAREHOUSE_MANAGER':
      return 'dispatches';
    case 'INSTALLATION_TECHNICIAN':
      return 'installations';
    case 'SUPPORT_EXECUTIVE':
      return 'tickets';
    case 'CUSTOMER':
      return 'customer-portal';
    default:
      return 'leads';
  }
}

const sectionTitles = {
  director: "Director's Month-End Review",
  leads: 'Enquiries & Feasibility Pre-Screening',
  surveys: 'Roof Feasibility Surveys',
  quotes: 'Quotations & Bill of Materials (BOM)',
  projects: 'Projects & Advance Payments',
  inventory: 'Warehouse Stock & Inward Receiving',
  dispatches: 'Dispatch Pick List & Serial Scanning',
  installations: 'Installation Crew Workspace',
  warranties: 'Official Hardware Warranty Registry',
  tickets: 'Customer Breakdown & Warranty Claims',
  'customer-portal': 'My Rooftop Solar Journey',
};

function AppShell({ user, onLogout }) {
  const [section, setSection] = useState(() => getDefaultSection(user?.role));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const title = sectionTitles[section] || 'Workspace';

  useEffect(() => {
    document.title = `${title} · SunPower SIMS`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="app-shell">
      {/* Sidebar for Desktop & Mobile Drawer */}
      <div className={`sidebar-wrapper ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <Sidebar
          user={user}
          currentSection={section}
          onNavigate={(key) => {
            setSection(key);
            setMobileNavOpen(false);
          }}
          onLogout={onLogout}
        />
        {mobileNavOpen && (
          <div className="mobile-overlay" onClick={() => setMobileNavOpen(false)} />
        )}
      </div>

      {/* Main Content Area */}
      <main className="app-main">
        <Header
          user={user}
          title={title}
          onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)}
        />

        <div className="page-content">
          {section === 'director' && <DirectorDashboardPage onNavigate={setSection} />}
          {section === 'leads' && <LeadsPage onNavigate={setSection} />}
          {section === 'surveys' && <SurveysPage user={user} onNavigate={setSection} />}
          {section === 'quotes' && <QuotesPage onNavigate={setSection} />}
          {section === 'projects' && <ProjectsPage onNavigate={setSection} />}
          {section === 'inventory' && <WarehouseDispatchPage user={user} onNavigate={setSection} />}
          {section === 'dispatches' && <WarehouseDispatchPage user={user} onNavigate={setSection} />}
          {section === 'installations' && <InstallationCrewPage user={user} onNavigate={setSection} />}
          {section === 'warranties' && <WarrantyRegistryPage onNavigate={setSection} />}
          {section === 'tickets' && <SupportTicketsPage user={user} onNavigate={setSection} />}
          {section === 'customer-portal' && <CustomerPortalPage user={user} onNavigate={setSection} />}
        </div>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('public');
  const [shareToken, setShareToken] = useState(null);

  useEffect(() => {
    // Check if URL has a share token (e.g., /#share=abcdef...)
    function checkHash() {
      const hash = window.location.hash || '';
      if (hash.startsWith('#share=')) {
        const token = hash.replace('#share=', '');
        setShareToken(token);
      } else {
        setShareToken(null);
      }
    }
    checkHash();
    window.addEventListener('hashchange', checkHash);

    // Check logged in user
    api
      .get('/auth/me')
      .then(({ data }) => {
        if (data?.data?.user) {
          setUser(data.data.user);
          setView('app');
        }
      })
      .catch(() => {});

    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Shared report view takes priority if hash token is present
  if (shareToken) {
    return (
      <SharedReportPage
        token={shareToken}
        onBack={() => {
          window.location.hash = '';
          setShareToken(null);
        }}
      />
    );
  }

  if (view === 'login') {
    return (
      <Login
        onSuccess={(nextUser) => {
          setUser(nextUser);
          setView('app');
        }}
        onBack={() => setView('public')}
      />
    );
  }

  if (view === 'app' && user) {
    return (
      <AppShell
        user={user}
        onLogout={async () => {
          try {
            await api.post('/auth/logout');
          } catch {}
          setUser(null);
          setView('public');
        }}
      />
    );
  }

  return <PublicPage onLogin={() => setView('login')} />;
}

export default App;
