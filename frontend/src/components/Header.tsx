import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { NavItem } from './Sidebar';
import { Modal } from './Modal';
import { apiRequest } from '../api/client';

interface HeaderProps {
  activeTab: NavItem;
  onToggleSidebar: () => void;
}

const TAB_TITLES: Record<NavItem, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Bảng Điều Khiển Tổng Quan',
    subtitle: 'Theo dõi trực tiếp dữ liệu hoạt động, cư trú và tài chính chung cư',
  },
  apartments: {
    title: 'Quản Lý Tòa Nhà & Căn Hộ',
    subtitle: 'Theo dõi tình trạng bàn giao, diện tích, tầng và danh mục căn hộ',
  },
  residents: {
    title: 'Quản Lý Danh Sách Cư Dân',
    subtitle: 'Hồ sơ chủ hộ, nhân khẩu lưu trú và liên kết căn hộ tương ứng',
  },
  invoices: {
    title: 'Hóa Đơn & Phí Dịch Vụ',
    subtitle: 'Tính toán phí quản lý, phí gửi xe, điện, nước và xác nhận thu phí',
  },
  tickets: {
    title: 'Yêu Cầu & Phản Ánh Kỹ Thuật',
    subtitle: 'Tiếp nhận sự cố kỹ thuật từ cư dân, phân công xử lý và đánh giá',
  },
  users: {
    title: 'Tài Khoản & Phân Quyền Hệ Thống',
    subtitle: 'Quản trị viên, nhân viên ban quản lý và tài khoản cư dân',
  },
};

export const Header: React.FC<HeaderProps> = ({ activeTab, onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwdFeedback, setPwdFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const getRoleBadge = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return <span className="badge-role badge-admin">Quản Trị Viên (Admin)</span>;
      case 'manager':
        return <span className="badge-role badge-manager">Ban Quản Lý (Manager)</span>;
      default:
        return <span className="badge-role badge-resident">Cư Dân (Resident)</span>;
    }
  };

  const currentTab = TAB_TITLES[activeTab] || {
    title: 'Quản Lý Chung Cư',
    subtitle: 'Hệ thống quản lý căn hộ chung cư',
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPwdFeedback({ type: 'error', message: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' });
      return;
    }
    if (passwordForm.new_password.length < 6) {
      setPwdFeedback({ type: 'error', message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }

    setPwdLoading(true);
    setPwdFeedback(null);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        }),
      });
      setPwdFeedback({ type: 'success', message: 'Đổi mật khẩu thành công!' });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => {
        setIsChangePasswordModalOpen(false);
        setPwdFeedback(null);
      }, 1500);
    } catch (err) {
      setPwdFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi đổi mật khẩu' });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <>
      <header className="app-topbar">
        <div className="topbar-left">
          <button className="btn-mobile-toggle" onClick={onToggleSidebar} aria-label="Mở Menu">
            ☰
          </button>
          <div>
            <h1 className="page-heading">
              {user?.role === 'resident' && activeTab === 'apartments'
                ? 'Thông Tin Căn Hộ Của Tôi'
                : user?.role === 'resident' && activeTab === 'invoices'
                ? 'Hóa Đơn Căn Hộ Của Tôi'
                : user?.role === 'resident' && activeTab === 'tickets'
                ? 'Phản Ánh & Sự Cố Của Tôi'
                : currentTab.title}
            </h1>
            <p className="page-subheading">
              {user?.role === 'resident'
                ? `Tài khoản cư dân: ${user.full_name || user.username}`
                : currentTab.subtitle}
            </p>
          </div>
        </div>

        <div className="topbar-right">
          <div className="user-profile-badge">
            <div className="avatar-circle">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.full_name || user?.username}</span>
              {getRoleBadge(user?.role)}
            </div>
          </div>

          <button
            className="btn-action edit"
            style={{ padding: '8px 12px', fontSize: '13px' }}
            onClick={() => {
              setPwdFeedback(null);
              setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
              setIsChangePasswordModalOpen(true);
            }}
            title="Đổi mật khẩu tài khoản"
          >
            🔑 Đổi MK
          </button>

          <button className="btn-logout" onClick={logout} title="Đăng xuất khỏi hệ thống">
            <span>Đăng xuất</span>
            <span className="logout-icon">🚪</span>
          </button>
        </div>
      </header>

      {/* Modal Change Password */}
      <Modal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        title="Đổi Mật Khẩu Tài Khoản"
        maxWidth="460px"
      >
        <form onSubmit={handleChangePassword} className="modal-form">
          {pwdFeedback && (
            <div className={`alert-box ${pwdFeedback.type === 'success' ? 'toast-success' : 'alert-error'}`}>
              <span>{pwdFeedback.type === 'success' ? '✅' : '⚠️'}</span>
              <span>{pwdFeedback.message}</span>
            </div>
          )}

          <div className="form-group">
            <label>Mật khẩu hiện tại (*)</label>
            <input
              type="password"
              placeholder="Nhập mật khẩu đang dùng..."
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Mật khẩu mới (Tối thiểu 6 ký tự) (*)</label>
            <input
              type="password"
              placeholder="Nhập mật khẩu mới..."
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Xác nhận mật khẩu mới (*)</label>
            <input
              type="password"
              placeholder="Nhập lại mật khẩu mới..."
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              required
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsChangePasswordModalOpen(false)}
            >
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={pwdLoading}>
              {pwdLoading ? 'Đang cập nhật...' : 'Xác Nhận Đổi'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
