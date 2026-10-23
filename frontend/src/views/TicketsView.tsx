import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

interface Ticket {
  id: number;
  resident_id: string;
  resident_name: string;
  resident_phone?: string;
  apartment_id?: number;
  room_number?: string;
  building_code?: string;
  building_name?: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  admin_response?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

interface ApartmentOption {
  id: number;
  room_number: string;
  building_code: string;
}

export const TicketsView: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
  const isResident = user?.role === 'resident';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicketForUpdate, setSelectedTicketForUpdate] = useState<Ticket | null>(null);

  // Forms
  const [ticketForm, setTicketForm] = useState({
    apartment_id: '',
    title: '',
    content: '',
    priority: 'medium' as Ticket['priority'],
  });

  const [updateForm, setUpdateForm] = useState({
    status: 'processing' as Ticket['status'],
    admin_response: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, aRes] = await Promise.all([
        apiRequest<{ success: boolean; data: Ticket[] }>(
          `/tickets?status=${statusFilter}&priority=${priorityFilter}&search=${encodeURIComponent(searchQuery)}`
        ),
        apiRequest<{ success: boolean; data: ApartmentOption[] }>('/apartments'),
      ]);

      if (tRes.success) setTickets(tRes.data || []);
      if (aRes.success) setApartments(aRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải danh sách yêu cầu sửa chữa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, priorityFilter, searchQuery]);

  // Create Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.title.trim() || !ticketForm.content.trim()) {
      setFeedback({ type: 'error', message: 'Vui lòng điền tiêu đề và mô tả sự cố.' });
      return;
    }

    try {
      await apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify(ticketForm),
      });
      setFeedback({ type: 'success', message: 'Gửi yêu cầu sửa chữa thành công! BQL sẽ phản hồi sớm nhất.' });
      setIsCreateModalOpen(false);
      setTicketForm({ apartment_id: '', title: '', content: '', priority: 'medium' });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi gửi yêu cầu' });
    }
  };

  // Staff Update Ticket
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketForUpdate) return;

    try {
      await apiRequest(`/tickets/${selectedTicketForUpdate.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(updateForm),
      });
      setFeedback({ type: 'success', message: 'Cập nhật tiến độ xử lý thành công!' });
      setSelectedTicketForUpdate(null);
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi cập nhật yêu cầu' });
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgent':
        return <span className="badge badge-urgent">🔥 Khẩn cấp</span>;
      case 'high':
        return <span className="badge badge-high">⚠️ Cao</span>;
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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
              placeholder={isResident ? 'Tìm theo tiêu đề...' : 'Tìm theo tiêu đề, cư dân, căn hộ...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ tiếp nhận (Pending)</option>
            <option value="processing">Đang xử lý (Processing)</option>
            <option value="resolved">Hoàn thành (Resolved)</option>
            <option value="rejected">Từ chối (Rejected)</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tất cả mức ưu tiên</option>
            <option value="urgent">Khẩn cấp (Urgent)</option>
            <option value="high">Ưu tiên cao (High)</option>
            <option value="medium">Bình thường (Medium)</option>
            <option value="low">Thấp (Low)</option>
          </select>
        </div>

        <button
          className="btn-primary"
          onClick={() => {
            setTicketForm({
              apartment_id: apartments[0]?.id ? String(apartments[0].id) : '',
              title: '',
              content: '',
              priority: 'medium',
            });
            setIsCreateModalOpen(true);
          }}
        >
          + Gửi Yêu Cầu Sửa Chữa
        </button>
      </div>

      {/* Ticket Cards / List */}
      {loading ? (
        <div className="state-container loading-state">
          <div className="spinner" />
          <p>Đang tải danh sách sự cố & yêu cầu...</p>
        </div>
      ) : error ? (
        <div className="state-container error-state">
          <p>{error}</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="state-container empty-state">
          <div className="state-icon">🛠️</div>
          <h3>Không có yêu cầu sửa chữa nào</h3>
          <p>{isResident ? 'Bạn chưa gửi yêu cầu phản ánh nào.' : 'Chưa có sự cố nào cần xử lý.'}</p>
        </div>
      ) : (
        <div className="tickets-grid">
          {tickets.map((t) => (
            <div key={t.id} className={`ticket-card status-${t.status}`}>
              <div className="ticket-card-header">
                <div className="ticket-badges">
                  {getStatusBadge(t.status)}
                  {getPriorityBadge(t.priority)}
                </div>
                <span className="ticket-time">{formatDate(t.created_at)}</span>
              </div>

              <h4 className="ticket-card-title">{t.title}</h4>
              <p className="ticket-card-content">{t.content}</p>

              <div className="ticket-card-meta">
                <div>
                  <strong>Người gửi:</strong> {t.resident_name}{' '}
                  {t.resident_phone && <small>({t.resident_phone})</small>}
                </div>
                <div>
                  <strong>Căn hộ:</strong>{' '}
                  {t.room_number ? (
                    <span className="room-highlight">{t.room_number}</span>
                  ) : (
                    <span className="text-muted">Khu vực chung</span>
                  )}
                </div>
              </div>

              {t.admin_response && (
                <div className="ticket-admin-response-box">
                  <strong>Phản hồi của Ban Quản Lý:</strong>
                  <p>{t.admin_response}</p>
                  {t.resolved_at && (
                    <small className="text-muted">
                      Thời gian hoàn tất: {formatDate(t.resolved_at)}
                    </small>
                  )}
                </div>
              )}

              {isAdminOrManager && (
                <div className="ticket-card-footer">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedTicketForUpdate(t);
                      setUpdateForm({
                        status: t.status,
                        admin_response: t.admin_response || '',
                      });
                    }}
                  >
                    ✏️ Cập nhật tiến độ & Phản hồi
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Create Ticket */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Gửi Yêu Cầu Sửa Chữa / Phản Ánh Kỹ Thuật"
      >
        <form onSubmit={handleCreateTicket} className="modal-form">
          <div className="form-group">
            <label>Căn hộ xảy ra sự cố</label>
            <select
              value={ticketForm.apartment_id}
              onChange={(e) => setTicketForm({ ...ticketForm, apartment_id: e.target.value })}
            >
              {isResident ? (
                apartments.map((a) => (
                  <option key={a.id} value={a.id}>
                    Căn hộ của bạn: {a.room_number} ({a.building_code})
                  </option>
                ))
              ) : (
                <>
                  <option value="">-- Căn hộ hoặc khu vực công cộng --</option>
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      Căn {a.room_number} ({a.building_code})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="form-group">
            <label>Tiêu đề sự cố (*)</label>
            <input
              type="text"
              placeholder="VD: Rò rỉ ống nước bồn rửa, chập điện hành lang..."
              value={ticketForm.title}
              onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Mức độ ưu tiên (*)</label>
            <select
              value={ticketForm.priority}
              onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as Ticket['priority'] })}
            >
              <option value="low">Thấp (Chưa gấp)</option>
              <option value="medium">Trung bình (Bình thường)</option>
              <option value="high">Cao (Cần khắc phục sớm)</option>
              <option value="urgent">Khẩn cấp (Nguy cơ ngập, chập cháy, an toàn)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Mô tả chi tiết sự cố (*)</label>
            <textarea
              rows={4}
              placeholder="Mô tả cụ thể hiện trạng, vị trí, thời điểm bắt đầu xuất hiện sự cố..."
              value={ticketForm.content}
              onChange={(e) => setTicketForm({ ...ticketForm, content: e.target.value })}
              required
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-primary">
              Gửi Yêu Cầu Cho Ban Quản Lý
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Update Ticket Progress (Staff / Manager) */}
      {isAdminOrManager && (
        <Modal
          isOpen={Boolean(selectedTicketForUpdate)}
          onClose={() => setSelectedTicketForUpdate(null)}
          title={`Cập nhật yêu cầu: #${selectedTicketForUpdate?.id} - ${selectedTicketForUpdate?.title}`}
        >
          <form onSubmit={handleUpdateStatus} className="modal-form">
            <div className="form-group">
              <label>Trạng thái xử lý (*)</label>
              <select
                value={updateForm.status}
                onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value as Ticket['status'] })}
              >
                <option value="pending">Chờ tiếp nhận (Pending)</option>
                <option value="processing">Đang điều phối xử lý (Processing)</option>
                <option value="resolved">Đã hoàn thành / Đã sửa xong (Resolved)</option>
                <option value="rejected">Từ chối xử lý (Rejected)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Nội dung phản hồi / Ghi nhận kết quả</label>
              <textarea
                rows={4}
                placeholder="Ghi nhận phương án xử lý, thời gian dự kiến kỹ thuật viên đến hoặc kết quả nghiệm thu..."
                value={updateForm.admin_response}
                onChange={(e) => setUpdateForm({ ...updateForm, admin_response: e.target.value })}
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setSelectedTicketForUpdate(null)}>
                Hủy
              </button>
              <button type="submit" className="btn-primary">
                Lưu Cập Nhật
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
