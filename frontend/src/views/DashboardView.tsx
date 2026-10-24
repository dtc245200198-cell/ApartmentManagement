import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { NavItem } from '../components/Sidebar';

interface ApartmentInfo {
  id: number;
  room_number: string;
  floor: number;
  area_sqm: string;
  building_code: string;
  building_name: string;
  relation: string;
  is_primary_contact: boolean;
}

interface DashboardData {
  residentMode?: boolean;
  myApartments?: ApartmentInfo[];
  buildings: { total: number };
  apartments: { total: number; occupied: number; vacant: number; maintenance: number };
  residents: { total: number };
  finance: {
    totalInvoices: number;
    unpaidCount: number;
    paidCount: number;
    totalDebt: string;
    totalCollected: string;
  };
  tickets: {
    total: number;
    pending: number;
    processing: number;
    resolved: number;
    rejected: number;
  };
  recentTickets: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    created_at: string;
    resident_name: string;
    room_number?: string;
    admin_response?: string;
  }>;
}

interface DashboardViewProps {
  onNavigate: (tab: NavItem) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: DashboardData }>('/dashboard/stats');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        throw new Error('Không thể tải dữ liệu tổng quan.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối API tổng quan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="state-container loading-state">
        <div className="spinner" />
        <p>Đang tổng hợp dữ liệu thời gian thực từ cơ sở dữ liệu PostgreSQL...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="state-container error-state">
        <div className="state-icon">⚠️</div>
        <h3>Không thể tải dữ liệu tổng quan</h3>
        <p>{error || 'Lỗi kết nối cơ sở dữ liệu'}</p>
        <button className="btn-secondary" onClick={fetchStats}>
          Thử tải lại
        </button>
      </div>
    );
  }

  const formatVND = (amountStr: string | number) => {
    const val = typeof amountStr === 'string' ? parseFloat(amountStr) : amountStr;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgent':
        return <span className="badge badge-urgent">Khẩn cấp</span>;
      case 'high':
        return <span className="badge badge-high">Cao</span>;
      case 'medium':
        return <span className="badge badge-medium">Trung bình</span>;
      default:
        return <span className="badge badge-low">Thấp</span>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'resolved':
        return <span className="badge badge-success">✓ Đã hoàn thành</span>;
      case 'processing':
        return <span className="badge badge-warning">⚙️ Đang xử lý</span>;
      case 'rejected':
        return <span className="badge badge-danger">✕ Từ chối</span>;
      default:
        return <span className="badge badge-info">⏳ Chờ tiếp nhận</span>;
    }
  };

  // ==========================================
  // RESIDENT SPECIFIC DASHBOARD VIEW
  // ==========================================
  if (user?.role === 'resident') {
    return (
      <div className="dashboard-content">
        {/* Welcome & Apartment Card */}
        <div className="resident-welcome-card">
          <div className="welcome-left">
            <h3>Xin chào, {user.full_name || user.username}! 🏠</h3>
            <p>Chào mừng bạn đến với Cổng thông tin Cư Dân Chung Cư Xanh.</p>
            {data.myApartments && data.myApartments.length > 0 ? (
              <div style={{ marginTop: '10px', fontSize: '13px', opacity: 0.95 }}>
                {data.myApartments.map((apt) => (
                  <span key={apt.id} style={{ marginRight: '14px', background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '6px' }}>
                    🏢 <strong>Căn {apt.room_number}</strong> ({apt.building_name} - Tầng {apt.floor}) • {apt.area_sqm} m²
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ marginTop: '8px', fontSize: '13px', opacity: 0.85 }}>
                Chưa có căn hộ nào được liên kết với tài khoản này. Vui lòng liên hệ Ban quản lý.
              </p>
            )}
          </div>
          <div className="resident-quick-stats">
            <div className="r-stat">
              <span>Hóa đơn chưa đóng</span>
              <strong>{data.finance.unpaidCount} hóa đơn</strong>
            </div>
            <div className="r-stat">
              <span>Số tiền cần thanh toán</span>
              <strong className="debt-highlight" style={{ color: '#fef08a' }}>
                {formatVND(data.finance.totalDebt)}
              </strong>
            </div>
          </div>
        </div>

        {/* Resident KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card" onClick={() => onNavigate('invoices')}>
            <div className="kpi-top">
              <span className="kpi-icon icon-invoice">💳</span>
              <span className="kpi-badge badge-danger-soft">Phí Dịch Vụ</span>
            </div>
            <div className="kpi-body">
              <h4 className="kpi-title">Tiền Phí Chưa Thanh Toán</h4>
              <div className="kpi-value debt-highlight">{formatVND(data.finance.totalDebt)}</div>
              <div className="kpi-detail">
                <span>{data.finance.unpaidCount > 0 ? `● ${data.finance.unpaidCount} hóa đơn chờ nộp` : '✓ Đã thanh toán đầy đủ'}</span>
              </div>
            </div>
          </div>

          <div className="kpi-card" onClick={() => onNavigate('tickets')}>
            <div className="kpi-top">
              <span className="kpi-icon icon-ticket">🛠️</span>
              <span className="kpi-badge badge-warning-soft">Sự Cố</span>
            </div>
            <div className="kpi-body">
              <h4 className="kpi-title">Yêu Cầu Sửa Chữa Đang Xử Lý</h4>
              <div className="kpi-value">
                {data.tickets.pending + data.tickets.processing} <small className="unit">phiếu</small>
              </div>
              <div className="kpi-detail">
                <span>{data.tickets.pending} mới • {data.tickets.processing} đang sửa • {data.tickets.resolved} xong</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resident Quick Actions & Recent Tickets */}
        <div className="dashboard-grid-2col">
          <div className="panel-card">
            <div className="panel-header">
              <h3>Thao Tác Nhanh Cho Cư Dân</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn-primary" style={{ textAlign: 'left', padding: '14px 18px' }} onClick={() => onNavigate('tickets')}>
                🛠️ Gửi Phản Ánh / Yêu Cầu Sửa Chữa Mới
              </button>
              <button className="btn-secondary" style={{ textAlign: 'left', padding: '14px 18px' }} onClick={() => onNavigate('invoices')}>
                📄 Xem Chi Tiết Hóa Đơn Điện, Nước, Phí Dịch Vụ
              </button>
              <button className="btn-secondary" style={{ textAlign: 'left', padding: '14px 18px' }} onClick={() => onNavigate('apartments')}>
                🏢 Xem Thông Tin Căn Hộ Của Tôi
              </button>
            </div>
            <div style={{ marginTop: '20px', padding: '14px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              <strong>Lưu ý nộp phí:</strong> Quý cư dân vui lòng thanh toán trực tiếp tại Văn phòng Ban Quản Lý (Tầng 1 Tòa A) hoặc chuyển khoản theo số tài khoản niêm yết của Ban Quản Trị.
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <h3>Phản Ánh Kỹ Thuật Gần Đây Của Bạn</h3>
              <button className="btn-link" onClick={() => onNavigate('tickets')}>
                Xem tất cả ({data.tickets.total}) →
              </button>
            </div>
            {data.recentTickets.length === 0 ? (
              <div className="state-empty-inline">
                <p>Bạn chưa gửi yêu cầu phản ánh sửa chữa nào.</p>
              </div>
            ) : (
              <div className="recent-tickets-list">
                {data.recentTickets.map((t) => (
                  <div key={t.id} className="ticket-item-row">
                    <div className="ticket-info">
                      <div className="ticket-title-line">
                        <strong>{t.title}</strong>
                        {getPriorityBadge(t.priority)}
                      </div>
                      <div className="ticket-meta">
                        {t.admin_response ? (
                          <span style={{ color: 'var(--primary)' }}>💬 BQL đã phản hồi</span>
                        ) : (
                          <span>Đang chờ kỹ thuật viên tiếp nhận</span>
                        )}
                      </div>
                    </div>
                    <div className="ticket-action-side">
                      {getStatusBadge(t.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // ADMIN & MANAGER SYSTEM DASHBOARD
  // ==========================================
  return (
    <div className="dashboard-content">
      {/* Primary KPI Grid (Live from PostgreSQL) */}
      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => onNavigate('apartments')}>
          <div className="kpi-top">
            <span className="kpi-icon icon-building">🏢</span>
            <span className="kpi-badge">Quy mô</span>
          </div>
          <div className="kpi-body">
            <h4 className="kpi-title">Tổng Căn Hộ</h4>
            <div className="kpi-value">{data.apartments.total} <small className="unit">căn</small></div>
            <div className="kpi-detail">
              <span className="text-success">● {data.apartments.occupied} Đang ở</span>
              <span className="text-muted">● {data.apartments.vacant} Trống</span>
            </div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('residents')}>
          <div className="kpi-top">
            <span className="kpi-icon icon-users">👥</span>
            <span className="kpi-badge">Nhân khẩu</span>
          </div>
          <div className="kpi-body">
            <h4 className="kpi-title">Tổng Số Cư Dân</h4>
            <div className="kpi-value">{data.residents.total} <small className="unit">người</small></div>
            <div className="kpi-detail">
              <span>Tỷ lệ lấp đầy: {data.apartments.total > 0 ? Math.round((data.apartments.occupied / data.apartments.total) * 100) : 0}%</span>
            </div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('invoices')}>
          <div className="kpi-top">
            <span className="kpi-icon icon-invoice">💳</span>
            <span className="kpi-badge badge-danger-soft">Tài chính</span>
          </div>
          <div className="kpi-body">
            <h4 className="kpi-title">Công Nợ Chưa Thu</h4>
            <div className="kpi-value debt-highlight">{formatVND(data.finance.totalDebt)}</div>
            <div className="kpi-detail">
              <span className="text-danger">● {data.finance.unpaidCount} hóa đơn chưa nộp</span>
            </div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('tickets')}>
          <div className="kpi-top">
            <span className="kpi-icon icon-ticket">🛠️</span>
            <span className="kpi-badge badge-warning-soft">Kỹ thuật</span>
          </div>
          <div className="kpi-body">
            <h4 className="kpi-title">Yêu Cầu Chờ Xử Lý</h4>
            <div className="kpi-value">{data.tickets.pending + data.tickets.processing} <small className="unit">phiếu</small></div>
            <div className="kpi-detail">
              <span>{data.tickets.pending} mới • {data.tickets.processing} đang sửa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Information & Status Breakdown */}
      <div className="dashboard-grid-2col">
        {/* Occupancy and Apartment breakdown */}
        <div className="panel-card">
          <div className="panel-header">
            <h3>Tình Trạng Bàn Giao Căn Hộ</h3>
            <button className="btn-link" onClick={() => onNavigate('apartments')}>
              Xem chi tiết →
            </button>
          </div>
          <div className="apartment-progress-group">
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill occupied"
                style={{
                  width: `${data.apartments.total > 0 ? (data.apartments.occupied / data.apartments.total) * 100 : 0}%`,
                }}
              />
              <div
                className="progress-bar-fill vacant"
                style={{
                  width: `${data.apartments.total > 0 ? (data.apartments.vacant / data.apartments.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="progress-legend">
              <div className="legend-item">
                <span className="dot dot-occupied" />
                <span>Đang sử dụng ({data.apartments.occupied} căn)</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-vacant" />
                <span>Còn trống ({data.apartments.vacant} căn)</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-maintenance" />
                <span>Bảo trì ({data.apartments.maintenance} căn)</span>
              </div>
            </div>
          </div>

          <div className="finance-summary-box">
            <h4>Tình hình thu phí chung cư</h4>
            <div className="finance-row">
              <span>Đã thu thành công:</span>
              <strong className="text-success">{formatVND(data.finance.totalCollected)}</strong>
            </div>
            <div className="finance-row">
              <span>Hóa đơn đã thanh toán:</span>
              <strong>{data.finance.paidCount} / {data.finance.totalInvoices} hóa đơn</strong>
            </div>
          </div>
        </div>

        {/* Recent Technical Complaints/Tickets */}
        <div className="panel-card">
          <div className="panel-header">
            <h3>Sự Cố & Yêu Cầu Gần Đây</h3>
            <button className="btn-link" onClick={() => onNavigate('tickets')}>
              Xem tất cả ({data.tickets.total}) →
            </button>
          </div>

          {data.recentTickets.length === 0 ? (
            <div className="state-empty-inline">
              <p>Chưa có yêu cầu sửa chữa nào được gửi.</p>
            </div>
          ) : (
            <div className="recent-tickets-list">
              {data.recentTickets.map((t) => (
                <div key={t.id} className="ticket-item-row">
                  <div className="ticket-info">
                    <div className="ticket-title-line">
                      <strong>{t.title}</strong>
                      {getPriorityBadge(t.priority)}
                    </div>
                    <div className="ticket-meta">
                      <span>Cư dân: {t.resident_name}</span>
                      {t.room_number && <span> • Căn: {t.room_number}</span>}
                    </div>
                  </div>
                  <div className="ticket-action-side">
                    {getStatusBadge(t.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
