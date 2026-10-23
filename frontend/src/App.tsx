import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, type NavItem } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { ApartmentsView } from './views/ApartmentsView';
import { ResidentsView } from './views/ResidentsView';
import { InvoicesView } from './views/InvoicesView';
import { TicketsView } from './views/TicketsView';
import { UsersView } from './views/UsersView';
import './App.css';

function MainApp() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavItem>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="full-screen-loader">
        <div className="spinner" />
        <p>Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  // Strict Frontend Role Guards
  let effectiveTab: NavItem = activeTab;

  // Residents cannot access residents or users tabs
  if (user.role === 'resident' && (activeTab === 'residents' || activeTab === 'users')) {
    effectiveTab = 'dashboard';
  }

  // Managers cannot access admin-only users tab
  if (user.role === 'manager' && activeTab === 'users') {
    effectiveTab = 'dashboard';
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={effectiveTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="app-main-wrapper">
        <Header
          activeTab={effectiveTab}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="app-content-body">
          {effectiveTab === 'dashboard' && <DashboardView onNavigate={(tab) => setActiveTab(tab)} />}
          {effectiveTab === 'apartments' && <ApartmentsView />}
          {effectiveTab === 'residents' && user.role !== 'resident' && <ResidentsView />}
          {effectiveTab === 'invoices' && <InvoicesView />}
          {effectiveTab === 'tickets' && <TicketsView />}
          {effectiveTab === 'users' && user.role === 'admin' && <UsersView />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
