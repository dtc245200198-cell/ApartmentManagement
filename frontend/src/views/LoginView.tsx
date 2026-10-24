import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const result = await login(username.trim(), password.trim());
    if (!result.success) {
      setErrorMsg(result.message || 'Đăng nhập không thành công.');
      setLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg(null);
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="brand-badge">🏢</div>
          <h2>Hệ Thống Quản Lý Căn Hộ</h2>
          <p>Cổng thông tin quản trị và vận hành chung cư số</p>
        </div>

        {errorMsg && (
          <div className="alert-box alert-error">
            <span>⚠️</span>
            <div>{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin / manager / resident1"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu..."
              required
            />
          </div>

          <button type="submit" className="btn-primary btn-submit" disabled={loading}>
            {loading ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}
          </button>
        </form>

        <div className="quick-accounts">
          <span className="quick-title">Chọn nhanh tài khoản mẫu:</span>
          <div className="quick-btns">
            <button
              type="button"
              className="btn-quick admin"
              onClick={() => handleQuickFill('admin', 'admin123')}
            >
              👑 Quản trị viên (admin)
            </button>
            <button
              type="button"
              className="btn-quick manager"
              onClick={() => handleQuickFill('manager', 'manager123')}
            >
              💼 Ban Quản Lý (Ban quản lý)
            </button>
            <button
              type="button"
              className="btn-quick resident"
              onClick={() => handleQuickFill('resident1', 'resident123')}
            >
              🏠 Cư Dân (Nguyễn Thanh An)
            </button>
          </div>
        </div>

        <div className="login-footer">
          <span>Triển khai và quản trị hệ thống phần mềm • Đề tài 36</span>
        </div>
      </div>
    </div>
  );
};
