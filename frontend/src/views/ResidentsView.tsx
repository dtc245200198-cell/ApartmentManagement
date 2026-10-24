import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Modal } from '../components/Modal';

interface Resident {
  id: string;
  username: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  apartments: Array<{
    relation_id: number;
    apartment_id: number;
    room_number: string;
    building_code: string;
    building_name: string;
    relation: string;
    start_date: string;
    is_primary_contact: boolean;
  }>;
}

interface ApartmentOption {
  id: number;
  room_number: string;
  building_code: string;
}

export const ResidentsView: React.FC = () => {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [apartmentOptions, setApartmentOptions] = useState<ApartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRelation, setSelectedRelation] = useState('all');

  // Modals
  const [isAddResidentModalOpen, setIsAddResidentModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedResidentForAssign, setSelectedResidentForAssign] = useState<Resident | null>(null);

  // Forms
  const [residentForm, setResidentForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    apartment_id: '',
    relation: 'owner',
    is_primary_contact: true,
  });

  const [assignForm, setAssignForm] = useState({
    apartment_id: '',
    relation: 'family_member',
    is_primary_contact: false,
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, aRes] = await Promise.all([
        apiRequest<{ success: boolean; data: Resident[] }>(
          `/residents?search=${encodeURIComponent(searchQuery)}&relation=${selectedRelation}`
        ),
        apiRequest<{ success: boolean; data: ApartmentOption[] }>('/apartments'),
      ]);

      if (rRes.success) setResidents(rRes.data || []);
      if (aRes.success) setApartmentOptions(aRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu cư dân');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, selectedRelation]);

  // Create Resident
  const handleCreateResident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/residents', {
        method: 'POST',
        body: JSON.stringify(residentForm),
      });
      setFeedback({ type: 'success', message: 'Tạo hồ sơ cư dân thành công!' });
      setIsAddResidentModalOpen(false);
      setResidentForm({
        username: '',
        password: '',
        full_name: '',
        email: '',
        phone: '',
        apartment_id: '',
        relation: 'owner',
        is_primary_contact: true,
      });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi tạo cư dân' });
    }
  };

  // Assign resident to an additional apartment
  const handleAssignApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResidentForAssign) return;

    try {
      await apiRequest('/residents/assign', {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedResidentForAssign.id,
          apartment_id: parseInt(assignForm.apartment_id, 10),
          relation: assignForm.relation,
          is_primary_contact: assignForm.is_primary_contact,
        }),
      });
      setFeedback({ type: 'success', message: 'Gán căn hộ thành công!' });
      setIsAssignModalOpen(false);
      setSelectedResidentForAssign(null);
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi gán căn hộ' });
    }
  };

  // Unassign relation
  const handleUnassign = async (relationId: number, room: string, name: string) => {
    if (!window.confirm(`Hủy liên kết căn hộ ${room} đối với cư dân ${name}?`)) return;

    try {
      await apiRequest(`/residents/unassign/${relationId}`, { method: 'DELETE' });
      setFeedback({ type: 'success', message: 'Đã hủy liên kết cư trú.' });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi hủy liên kết' });
    }
  };

  // Delete / Deactivate resident
  const handleDeleteResident = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa hoặc vô hiệu hóa hồ sơ của cư dân ${name}?`)) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/residents/${id}`, {
        method: 'DELETE',
      });
      setFeedback({ type: 'success', message: res.message || 'Xóa cư dân thành công.' });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi xóa cư dân' });
    }
  };

  const getRelationLabel = (r: string) => {
    switch (r) {
      case 'owner':
        return <span className="relation-tag owner">Chủ hộ</span>;
      case 'tenant':
        return <span className="relation-tag tenant">Người thuê</span>;
      case 'family_member':
        return <span className="relation-tag family">Thành viên gia đình</span>;
      default:
        return <span className="relation-tag other">Lưu trú</span>;
    }
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
              placeholder="Tìm theo họ tên, SĐT, username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            value={selectedRelation}
            onChange={(e) => setSelectedRelation(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tất cả mối quan hệ</option>
            <option value="owner">Chủ hộ (Owner)</option>
            <option value="tenant">Khách thuê (Tenant)</option>
            <option value="family_member">Thành viên gia đình (Family)</option>
          </select>
        </div>

        <button
          className="btn-primary"
          onClick={() => {
            setResidentForm({
              username: '',
              password: 'password123',
              full_name: '',
              email: '',
              phone: '',
              apartment_id: apartmentOptions[0]?.id ? String(apartmentOptions[0].id) : '',
              relation: 'owner',
              is_primary_contact: true,
            });
            setIsAddResidentModalOpen(true);
          }}
        >
          + Thêm Cư Dân Mới
        </button>
      </div>

      {/* Table of Residents */}
      {loading ? (
        <div className="state-container loading-state">
          <div className="spinner" />
          <p>Đang tải danh sách cư dân...</p>
        </div>
      ) : error ? (
        <div className="state-container error-state">
          <p>{error}</p>
        </div>
      ) : residents.length === 0 ? (
        <div className="state-container empty-state">
          <div className="state-icon">👥</div>
          <h3>Chưa có dữ liệu cư dân</h3>
          <p>Nhấn "+ Thêm Cư Dân Mới" để tạo hồ sơ lưu trú đầu tiên.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Họ Và Tên</th>
                <th>Tài Khoản Đăng Nhập</th>
                <th>Số Điện Thoại / Email</th>
                <th>Căn Hộ Đang Cư Trú</th>
                <th>Trạng Thái</th>
                <th className="text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="user-name-cell">
                      <div className="resident-avatar">{r.full_name.charAt(0)}</div>
                      <strong>{r.full_name}</strong>
                    </div>
                  </td>
                  <td>
                    <code>{r.username}</code>
                  </td>
                  <td>
                    <div>📞 {r.phone || 'Chưa cập nhật'}</div>
                    {r.email && <small className="text-muted">✉️ {r.email}</small>}
                  </td>
                  <td>
                    {r.apartments && r.apartments.length > 0 ? (
                      <div className="resident-units-list">
                        {r.apartments.map((apt) => (
                          <div key={apt.relation_id} className="unit-pill">
                            <strong>{apt.room_number}</strong>
                            {getRelationLabel(apt.relation)}
                            {apt.is_primary_contact && <span className="star-badge" title="Đại diện liên hệ chính">★</span>}
                            <button
                              type="button"
                              className="btn-unassign"
                              onClick={() => handleUnassign(apt.relation_id, apt.room_number, r.full_name)}
                              title="Hủy liên kết căn hộ này"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="badge badge-secondary">Chưa gán căn hộ</span>
                    )}
                  </td>
                  <td>
                    {r.is_active ? (
                      <span className="badge badge-success">Đang hoạt động</span>
                    ) : (
                      <span className="badge badge-danger">Đã khóa</span>
                    )}
                  </td>
                  <td className="text-right action-btns-cell">
                    <button
                      className="btn-action edit"
                      onClick={() => {
                        setSelectedResidentForAssign(r);
                        setAssignForm({
                          apartment_id: apartmentOptions[0]?.id ? String(apartmentOptions[0].id) : '',
                          relation: 'family_member',
                          is_primary_contact: false,
                        });
                        setIsAssignModalOpen(true);
                      }}
                      title="Gán thêm căn hộ cư trú"
                    >
                      🔗 Gán căn
                    </button>
                    <button
                      className="btn-action delete"
                      onClick={() => handleDeleteResident(r.id, r.full_name)}
                      title="Xóa cư dân"
                    >
                      🗑️ Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add Resident */}
      <Modal
        isOpen={isAddResidentModalOpen}
        onClose={() => setIsAddResidentModalOpen(false)}
        title="Thêm Hồ Sơ Cư Dân Mới"
      >
        <form onSubmit={handleCreateResident} className="modal-form">
          <div className="form-group">
            <label>Họ và tên (*)</label>
            <input
              type="text"
              placeholder="VD: Nguyễn Thanh An"
              value={residentForm.full_name}
              onChange={(e) => setResidentForm({ ...residentForm, full_name: e.target.value })}
              required
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label>Tên đăng nhập (*)</label>
              <input
                type="text"
                placeholder="VD: resident_a101"
                value={residentForm.username}
                onChange={(e) => setResidentForm({ ...residentForm, username: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Mật khẩu khởi tạo (*)</label>
              <input
                type="password"
                placeholder="Mật khẩu ban đầu"
                value={residentForm.password}
                onChange={(e) => setResidentForm({ ...residentForm, password: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label>Số điện thoại</label>
              <input
                type="tel"
                placeholder="090..."
                value={residentForm.phone}
                onChange={(e) => setResidentForm({ ...residentForm, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="cudan@chungcu.vn"
                value={residentForm.email}
                onChange={(e) => setResidentForm({ ...residentForm, email: e.target.value })}
              />
            </div>
          </div>

          <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
          <h4>Thông tin căn hộ cư trú ban đầu (Tùy chọn)</h4>

          <div className="form-row-2col">
            <div className="form-group">
              <label>Gán vào căn hộ</label>
              <select
                value={residentForm.apartment_id}
                onChange={(e) => setResidentForm({ ...residentForm, apartment_id: e.target.value })}
              >
                <option value="">-- Chưa gán ngay --</option>
                {apartmentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.room_number} ({a.building_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Vai trò cư trú</label>
              <select
                value={residentForm.relation}
                onChange={(e) => setResidentForm({ ...residentForm, relation: e.target.value })}
                disabled={!residentForm.apartment_id}
              >
                <option value="owner">Chủ sở hữu căn hộ (Owner)</option>
                <option value="tenant">Khách thuê căn hộ (Tenant)</option>
                <option value="family_member">Thành viên gia đình (Family)</option>
                <option value="resident">Lưu trú tạm thời (Resident)</option>
              </select>
            </div>
          </div>

          <div className="checkbox-wrap">
            <label>
              <input
                type="checkbox"
                checked={residentForm.is_primary_contact}
                onChange={(e) => setResidentForm({ ...residentForm, is_primary_contact: e.target.checked })}
                disabled={!residentForm.apartment_id}
              />
              Đặt làm người đại diện liên hệ chính của căn hộ
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setIsAddResidentModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-primary">
              Tạo Hồ Sơ Cư Dân
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Assign Apartment */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Gán căn hộ cho cư dân: ${selectedResidentForAssign?.full_name}`}
      >
        <form onSubmit={handleAssignApartment} className="modal-form">
          <div className="form-group">
            <label>Chọn căn hộ (*)</label>
            <select
              value={assignForm.apartment_id}
              onChange={(e) => setAssignForm({ ...assignForm, apartment_id: e.target.value })}
              required
            >
              <option value="">-- Chọn căn hộ --</option>
              {apartmentOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.room_number} ({a.building_code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Mối quan hệ cư trú (*)</label>
            <select
              value={assignForm.relation}
              onChange={(e) => setAssignForm({ ...assignForm, relation: e.target.value })}
            >
              <option value="owner">Chủ hộ (Owner)</option>
              <option value="tenant">Người thuê (Tenant)</option>
              <option value="family_member">Thành viên gia đình (Family)</option>
              <option value="resident">Lưu trú khác (Resident)</option>
            </select>
          </div>

          <div className="checkbox-wrap">
            <label>
              <input
                type="checkbox"
                checked={assignForm.is_primary_contact}
                onChange={(e) => setAssignForm({ ...assignForm, is_primary_contact: e.target.checked })}
              />
              Người đại diện liên hệ chính của căn hộ
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setIsAssignModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-primary">
              Xác Nhận Gán
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
