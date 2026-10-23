import React from 'react';
import { useAuth } from '../context/AuthContext';

export type NavItem = 'dashboard' | 'apartments' | 'residents' | 'invoices' | 'tickets' | 'users';

interface SidebarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isResident = user?.role === 'resident';

  // Menu items with role-based visibility
  const menuItems: {
    id: NavItem;
    label: string;
    icon: string;
    adminOnly?: boolean;
    staffOnly?: boolean;
  }[] = [
    { id: 'dashboard', label: isResident ? 'Tổng quan cá nhân' : 'Tổng quan hệ thống', icon: '📊' },
    { id: 'apartments', label: isResident ? 'Căn hộ của tôi' : 'Tòa nhà & Căn hộ', icon: '🏢' },
    { id: 'residents', label: 'Quản lý Cư dân', icon: '👥', staffOnly: true },
    { id: 'invoices', label: isResident ? 'Hóa đơn & Dịch vụ' : 'Quản lý Hóa đơn', icon: '💳' },
    { id: 'tickets', label: isResident ? 'Yêu cầu của tôi' : 'Xử lý Sự cố & Bảo trì', icon: '🛠️' },
    { id: 'users', label: 'Tài khoản & Phân quyền', icon: '🔐', adminOnly: true },
  ];

  const handleSelect = (tab: NavItem) => {
    setActiveTab(tab);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">🏢</div>
          <div className="brand-text">
            <h2>Chung Cư Xanh</h2>
            <span>Smart Living Hub</span>
          </div>
        </div>

        {user && (
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-name" title={user.full_name || user.username}>
                {user.full_name || user.username}
              </span>
              <span className="sidebar-user-role">
                {user.role === 'admin'
                  ? 'Quản Trị Viên (Admin)'
                  : user.role === 'manager'
                  ? 'Ban Quản Lý'
                  : 'Cư Dân'}
              </span>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          <div className="nav-label">MENU CHỨC NĂNG</div>
          {menuItems.map((item) => {
            // Strictly hide admin-only items from Manager & Resident
            if (item.adminOnly && !isAdmin) return null;
            // Strictly hide staff-only items from Resident
            if (item.staffOnly && isResident) return null;

            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-button ${isActive ? 'active' : ''}`}
                onClick={() => handleSelect(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-text">{item.label}</span>
                {isActive && <span className="active-pill" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="system-pill">
            <span className="live-dot" />
            PostgreSQL • Online
          </div>
          <p className="copyright">Đề tài 36 • Triển khai HT</p>
        </div>
      </aside>

      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
    </>
  );
};
