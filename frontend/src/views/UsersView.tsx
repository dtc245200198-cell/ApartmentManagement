import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

interface AccountUser {
  id: string;
  username: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'manager' | 'resident';
  is_active: boolean;
  created_at: string;
}

export const UsersView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  // Form State
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    role: 'manager' as AccountUser['role'],
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: AccountUser[] }>(
        `/auth/users?role=${roleFilter}&search=${encodeURIComponent(searchQuery)}`
      );
      if (res.success) setUsers(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [roleFilter, searchQuery]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      });
      setFeedback({ type: 'success', message: 'Tạo tài khoản người dùng thành công!' });
      setIsAddUserModalOpen(false);
      setUserForm({
        username: '',
        password: '',
        full_name: '',
        email: '',
        phone: '',
        role: 'manager',
      });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi tạo tài khoản' });
    }
  };

  const handleToggleStatus = async (user: AccountUser) => {
    const newStatus = !user.is_active;
    const actionText = newStatus ? 'mở khóa' : 'khóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản "${user.username}"?`)) {
      return;
    }

    try {
      await apiRequest(`/auth/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: newStatus }),
      });
      setFeedback({ type: 'success', message: `Đã ${actionText} tài khoản thành công.` });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái tài khoản' });
    }
  };

  const handleDeleteUser = async (user: AccountUser) => {
    if (!window.confirm(`Xóa vĩnh viễn tài khoản "${user.username}" (${user.full_name})? Thao tác không thể hoàn tác.`)) {
      return;
    }

    try {
      await apiRequest(`/auth/users/${user.id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', message: 'Đã xóa tài khoản thành công.' });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi xóa tài khoản' });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return <span className="badge-role badge-admin">Quản Trị Viên (Admin)</span>;
      case 'manager':
        return <span className="badge-role badge-manager">Ban Quản Lý (Manager)</span>;
      default:
        return <span className="badge-role badge-resident">Cư Dân (Resident)</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  return (
    <div className="view-container">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`toast-banner ${feedback.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{feedback.message}</span>
          <button className="btn-close-toast" onClick={() => setFeedback(null)}>&times;</button>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="filter-action-bar">
        <div className="filter-controls">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Tìm theo họ tên, username, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tất cả các vai trò</option>
            <option value="admin">Quản trị viên (ADMIN)</option>
            <option value="manager">Ban quản lý (MANAGER)</option>
            <option value="resident">Cư dân (RESIDENT)</option>
          </select>
        </div>

        <button className="btn-primary" onClick={() => setIsAddUserModalOpen(true)}>
          + Tạo Tài Khoản Mới
        </button>
      </div>

      {/* Table of Users */}
      {loading ? (
        <div className="state-container loading-state">
          <div className="spinner" />
          <p>Đang tải danh sách tài khoản hệ thống...</p>
        </div>
      ) : error ? (
        <div className="state-container error-state">
          <p>{error}</p>
        </div>
      ) : users.length === 0 ? (
        <div className="state-container empty-state">
          <div className="state-icon">🔐</div>
          <h3>Không tìm thấy tài khoản nào</h3>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Họ Và Tên</th>
                <th>Tên Đăng Nhập</th>
                <th>Vai Trò Phân Quyền</th>
                <th>Liên Hệ</th>
                <th>Trạng Thái</th>
                <th>Ngày Tạo</th>
                <th className="text-right">Thao Tác Quản Trị</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="user-name-cell">
                        <div className="resident-avatar">{u.full_name.charAt(0)}</div>
                        <strong>{u.full_name}</strong>
                        {isSelf && <small className="badge badge-info" style={{ marginLeft: '6px' }}>Bạn</small>}
                      </div>
                    </td>
                    <td>
                      <code>{u.username}</code>
                    </td>
                    <td>{getRoleBadge(u.role)}</td>
                    <td>
                      <div>{u.phone ? `📞 ${u.phone}` : '—'}</div>
                      {u.email && <small className="text-muted">✉️ {u.email}</small>}
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="badge badge-success">Đang hoạt động</span>
                      ) : (
                        <span className="badge badge-danger">Đã khóa</span>
                      )}
                    </td>
                    <td>{formatDate(u.created_at)}</td>
                    <td className="text-right action-btns-cell">
                      <button
                        className={`btn-action ${u.is_active ? 'delete' : 'pay'}`}
                        onClick={() => handleToggleStatus(u)}
                        disabled={isSelf && u.is_active}
                        title={u.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                      >
                        {u.is_active ? '🔒 Khóa' : '🔓 Mở'}
                      </button>
                      <button
                        className="btn-action delete"
                        onClick={() => handleDeleteUser(u)}
                        disabled={isSelf}
                        title={isSelf ? 'Không thể tự xóa chính mình' : 'Xóa tài khoản'}
                      >
                        🗑️ Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add User */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Tạo Tài Khoản & Phân Quyền Mới"
      >
        <form onSubmit={handleCreateUser} className="modal-form">
          <div className="form-group">
            <label>Họ và tên (*)</label>
            <input
              type="text"
              placeholder="VD: Lê Thị Quản Lý"
              value={userForm.full_name}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              required
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label>Tên đăng nhập (*)</label>
              <input
                type="text"
                placeholder="VD: manager_le"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Mật khẩu khởi tạo (*)</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu..."
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Vai trò phân quyền (*)</label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value as AccountUser['role'] })}
            >
              <option value="manager">Ban quản lý (MANAGER) - Xem, quản lý căn hộ, cư dân, hóa đơn, sự cố</option>
              <option value="admin">Quản trị viên (ADMIN) - Toàn quyền quản trị hệ thống và người dùng</option>
              <option value="resident">Cư dân (RESIDENT) - Xem căn hộ và hóa đơn của chính mình, gửi sự cố</option>
            </select>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label>Số điện thoại</label>
              <input
                type="tel"
                placeholder="09..."
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="email@chungcu.vn"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setIsAddUserModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-primary">
              Tạo Tài Khoản
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
