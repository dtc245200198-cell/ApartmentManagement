import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

interface Building {
  id: number;
  code: string;
  name: string;
  total_floors: number;
  description?: string;
  total_apartments: number;
  occupied_apartments: number;
  vacant_apartments: number;
}

interface Apartment {
  id: number;
  room_number: string;
  floor: number;
  area_sqm: string;
  status: 'occupied' | 'vacant' | 'maintenance';
  building_id: number;
  building_code: string;
  building_name: string;
  residents: Array<{
    resident_id: string;
    full_name: string;
    phone?: string;
    relation: string;
    is_primary: boolean;
  }>;
}

export const ApartmentsView: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isResident = user?.role === 'resident';
  const isStaff = isAdmin || isManager;

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddApartmentModalOpen, setIsAddApartmentModalOpen] = useState(false);
  const [isAddBuildingModalOpen, setIsAddBuildingModalOpen] = useState(false);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);

  // Form states
  const [aptForm, setAptForm] = useState({
    building_id: '',
    room_number: '',
    floor: '1',
    area_sqm: '70',
    status: 'vacant' as 'occupied' | 'vacant' | 'maintenance',
  });

  const [buildingForm, setBuildingForm] = useState({
    code: '',
    name: '',
    total_floors: '15',
    description: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, aRes] = await Promise.all([
        apiRequest<{ success: boolean; data: Building[] }>('/buildings'),
        apiRequest<{ success: boolean; data: Apartment[] }>(
          `/apartments?building_id=${selectedBuilding}&status=${selectedStatus}&search=${encodeURIComponent(searchQuery)}`
        ),
      ]);

      if (bRes.success) setBuildings(bRes.data || []);
      if (aRes.success) setApartments(aRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu căn hộ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBuilding, selectedStatus, searchQuery]);

  // Handle Create / Edit Apartment
  const handleSaveApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingApartment) {
        await apiRequest(`/apartments/${editingApartment.id}`, {
          method: 'PUT',
          body: JSON.stringify(aptForm),
        });
        setFeedback({ type: 'success', message: 'Cập nhật căn hộ thành công!' });
      } else {
        await apiRequest('/apartments', {
          method: 'POST',
          body: JSON.stringify(aptForm),
        });
        setFeedback({ type: 'success', message: 'Thêm mới căn hộ thành công!' });
      }
      setIsAddApartmentModalOpen(false);
      setEditingApartment(null);
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi thao tác căn hộ' });
    }
  };

  // Handle Delete Apartment (Admin Only)
  const handleDeleteApartment = async (id: number, room: string) => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Chỉ Quản trị viên (Admin) mới có quyền xóa căn hộ.' });
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa căn hộ ${room}? Thao tác không thể hoàn tác.`)) {
      return;
    }
    try {
      await apiRequest(`/apartments/${id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', message: `Đã xóa căn hộ ${room} thành công.` });
      fetchData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể xóa căn hộ do ràng buộc toàn vẹn dữ liệu.',
      });
    }
  };

  // Handle Create Building
  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/buildings', {
        method: 'POST',
        body: JSON.stringify(buildingForm),
      });
      setFeedback({ type: 'success', message: 'Thêm tòa nhà mới thành công!' });
      setIsAddBuildingModalOpen(false);
      setBuildingForm({ code: '', name: '', total_floors: '15', description: '' });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi tạo tòa nhà' });
    }
  };

  const openEditModal = (apt: Apartment) => {
    setEditingApartment(apt);
    setAptForm({
      building_id: String(apt.building_id),
      room_number: apt.room_number,
      floor: String(apt.floor),
      area_sqm: apt.area_sqm,
      status: apt.status,
    });
    setIsAddApartmentModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'occupied':
        return <span className="badge badge-success">Đang ở</span>;
      case 'maintenance':
        return <span className="badge badge-warning">Đang bảo trì</span>;
      default:
        return <span className="badge badge-secondary">Còn trống</span>;
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

      {/* Buildings Overview Strip (Only for Staff) */}
      {isStaff && (
        <div className="buildings-strip">
          <div className="strip-title-row">
            <h3>Danh mục tòa nhà ({buildings.length})</h3>
            <button className="btn-secondary btn-sm" onClick={() => setIsAddBuildingModalOpen(true)}>
              + Thêm Tòa Nhà
            </button>
          </div>
          <div className="buildings-cards-row">
            {buildings.map((b) => (
              <div
                key={b.id}
                className={`building-summary-pill ${selectedBuilding === String(b.id) ? 'selected' : ''}`}
                onClick={() => setSelectedBuilding(selectedBuilding === String(b.id) ? 'all' : String(b.id))}
              >
                <div className="b-code">{b.code}</div>
                <div className="b-info">
                  <strong>{b.name}</strong>
                  <span>{b.total_floors} tầng • {b.total_apartments} căn ({b.occupied_apartments} đã ở)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action and Filter Bar */}
      {isStaff ? (
        <div className="filter-action-bar">
          <div className="filter-controls">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Tìm theo số căn hộ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả tòa nhà</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} - {b.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="occupied">Đang ở (Occupied)</option>
              <option value="vacant">Còn trống (Vacant)</option>
              <option value="maintenance">Bảo trì (Maintenance)</option>
            </select>
          </div>

          <button
            className="btn-primary"
            onClick={() => {
              setEditingApartment(null);
              setAptForm({
                building_id: buildings[0]?.id ? String(buildings[0].id) : '',
                room_number: '',
                floor: '1',
                area_sqm: '75',
                status: 'vacant',
              });
              setIsAddApartmentModalOpen(true);
            }}
          >
            + Thêm Căn Hộ
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: '12px' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Danh sách căn hộ mà bạn đang đứng tên chủ hộ hoặc được đăng ký cư trú:
          </p>
        </div>
      )}

      {/* Apartments Table / Grid */}
      {loading ? (
        <div className="state-container loading-state">
          <div className="spinner" />
          <p>Đang tải danh sách căn hộ...</p>
        </div>
      ) : error ? (
        <div className="state-container error-state">
          <p>{error}</p>
        </div>
      ) : apartments.length === 0 ? (
        <div className="state-container empty-state">
          <div className="state-icon">🏢</div>
          <h3>Không tìm thấy căn hộ nào</h3>
          <p>{isResident ? 'Tài khoản của bạn chưa được liên kết với căn hộ nào.' : 'Thử điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm.'}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã Căn Hộ</th>
                <th>Tòa Nhà</th>
                <th>Tầng</th>
                <th>Diện Tích</th>
                <th>Trạng Thái</th>
                <th>{isResident ? 'Thành Viên Trong Căn Hộ' : 'Cư Dân Đang Ở'}</th>
                {isStaff && <th className="text-right">Thao Tác</th>}
              </tr>
            </thead>
            <tbody>
              {apartments.map((apt) => (
                <tr key={apt.id}>
                  <td>
                    <div className="room-badge">
                      <strong>{apt.room_number}</strong>
                    </div>
                  </td>
                  <td>
                    <span>{apt.building_code} ({apt.building_name})</span>
                  </td>
                  <td>Tầng {apt.floor}</td>
                  <td>{apt.area_sqm} m²</td>
                  <td>{getStatusBadge(apt.status)}</td>
                  <td>
                    {apt.residents && apt.residents.length > 0 ? (
                      <div className="resident-avatars-wrap">
                        {apt.residents.map((r, i) => (
                          <span
                            key={i}
                            className={`resident-tag ${r.is_primary ? 'primary' : ''}`}
                            title={`${r.full_name} (${r.relation})`}
                          >
                            👤 {r.full_name} {r.is_primary && '★'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">Chưa có cư dân</span>
                    )}
                  </td>
                  {isStaff && (
                    <td className="text-right action-btns-cell">
                      <button
                        className="btn-action edit"
                        onClick={() => openEditModal(apt)}
                        title="Chỉnh sửa căn hộ"
                      >
                        ✏️ Sửa
                      </button>
                      {isAdmin && (
                        <button
                          className="btn-action delete"
                          onClick={() => handleDeleteApartment(apt.id, apt.room_number)}
                          title="Xóa căn hộ"
                        >
                          🗑️ Xóa
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add / Edit Apartment */}
      {isStaff && (
        <Modal
          isOpen={isAddApartmentModalOpen}
          onClose={() => setIsAddApartmentModalOpen(false)}
          title={editingApartment ? `Chỉnh sửa căn hộ ${editingApartment.room_number}` : 'Thêm Căn Hộ Mới'}
        >
          <form onSubmit={handleSaveApartment} className="modal-form">
            <div className="form-group">
              <label>Tòa nhà (*)</label>
              <select
                value={aptForm.building_id}
                onChange={(e) => setAptForm({ ...aptForm, building_id: e.target.value })}
                required
              >
                <option value="">-- Chọn tòa nhà --</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} - {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label>Số phòng / Mã căn (*)</label>
                <input
                  type="text"
                  placeholder="VD: A-101, B-502"
                  value={aptForm.room_number}
                  onChange={(e) => setAptForm({ ...aptForm, room_number: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Tầng (*)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={aptForm.floor}
                  onChange={(e) => setAptForm({ ...aptForm, floor: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label>Diện tích (m²) (*)</label>
                <input
                  type="number"
                  step="0.1"
                  min="10"
                  value={aptForm.area_sqm}
                  onChange={(e) => setAptForm({ ...aptForm, area_sqm: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Trạng thái</label>
                <select
                  value={aptForm.status}
                  onChange={(e) => setAptForm({ ...aptForm, status: e.target.value as Apartment['status'] })}
                >
                  <option value="vacant">Còn trống (Vacant)</option>
                  <option value="occupied">Đang ở (Occupied)</option>
                  <option value="maintenance">Bảo trì (Maintenance)</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsAddApartmentModalOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="btn-primary">
                {editingApartment ? 'Lưu Thay Đổi' : 'Tạo Căn Hộ'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Add Building */}
      {isStaff && (
        <Modal
          isOpen={isAddBuildingModalOpen}
          onClose={() => setIsAddBuildingModalOpen(false)}
          title="Thêm Tòa Nhà Mới"
        >
          <form onSubmit={handleCreateBuilding} className="modal-form">
            <div className="form-group">
              <label>Mã tòa (*)</label>
              <input
                type="text"
                placeholder="VD: BLOCK-B, TOWER-C"
                value={buildingForm.code}
                onChange={(e) => setBuildingForm({ ...buildingForm, code: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Tên tòa nhà (*)</label>
              <input
                type="text"
                placeholder="VD: Tòa Tháp B - Ruby"
                value={buildingForm.name}
                onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Tổng số tầng (*)</label>
              <input
                type="number"
                min="1"
                value={buildingForm.total_floors}
                onChange={(e) => setBuildingForm({ ...buildingForm, total_floors: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Mô tả tiện ích / ghi chú</label>
              <textarea
                rows={3}
                placeholder="Mô tả về tiện ích, thang máy, khu vực..."
                value={buildingForm.description}
                onChange={(e) => setBuildingForm({ ...buildingForm, description: e.target.value })}
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsAddBuildingModalOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="btn-primary">
                Tạo Tòa Nhà
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
