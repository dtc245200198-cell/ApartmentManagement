import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

interface FeeType {
  id: number;
  name: string;
  unit: string;
  unit_price: string;
  description?: string;
}

interface InvoiceItem {
  id: number;
  fee_type_id: number;
  fee_name: string;
  unit: string;
  quantity: string;
  unit_price: string;
  amount: string;
  note?: string;
}

interface Invoice {
  id: number;
  apartment_id: number;
  room_number: string;
  building_code: string;
  building_name: string;
  floor: number;
  billing_month: number;
  billing_year: number;
  total_amount: string;
  status: 'unpaid' | 'paid' | 'overdue';
  due_date: string;
  paid_at?: string;
  notes?: string;
  items: InvoiceItem[];
}

interface ApartmentOption {
  id: number;
  room_number: string;
  building_code: string;
  area_sqm: string;
}

export const InvoicesView: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
  const isResident = user?.role === 'resident';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('2026');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<Invoice | null>(null);

  // Form State
  const [invoiceForm, setInvoiceForm] = useState({
    apartment_id: '',
    billing_month: String(new Date().getMonth() + 1),
    billing_year: '2026',
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    notes: 'Hóa đơn dịch vụ chung cư định kỳ',
    items: [] as Array<{
      fee_type_id: number;
      fee_name: string;
      unit: string;
      quantity: number;
      unit_price: number;
      note: string;
    }>,
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, feeRes, aptRes] = await Promise.all([
        apiRequest<{ success: boolean; data: Invoice[] }>(
          `/invoices?status=${statusFilter}&billing_month=${monthFilter}&billing_year=${yearFilter}`
        ),
        apiRequest<{ success: boolean; data: FeeType[] }>('/invoices/fee-types'),
        apiRequest<{ success: boolean; data: ApartmentOption[] }>('/apartments'),
      ]);

      if (invRes.success) setInvoices(invRes.data || []);
      if (feeRes.success) setFeeTypes(feeRes.data || []);
      if (aptRes.success) setApartments(aptRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải danh sách hóa đơn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, monthFilter, yearFilter]);

  // Open modal and prefill initial standard fees
  const handleOpenCreateModal = () => {
    const defaultApt = apartments[0];
    const initialItems = feeTypes.map((ft) => {
      let qty = 1;
      if (ft.unit === 'm2' && defaultApt) {
        qty = parseFloat(defaultApt.area_sqm) || 70;
      }
      return {
        fee_type_id: ft.id,
        fee_name: ft.name,
        unit: ft.unit,
        quantity: qty,
        unit_price: parseFloat(ft.unit_price) || 0,
        note: '',
      };
    });

    setInvoiceForm({
      apartment_id: defaultApt ? String(defaultApt.id) : '',
      billing_month: String(new Date().getMonth() + 1),
      billing_year: '2026',
      due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      notes: 'Hóa đơn định kỳ dịch vụ chung cư',
      items: initialItems,
    });
    setIsCreateModalOpen(true);
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    const updated = [...invoiceForm.items];
    updated[index].quantity = Math.max(0, newQty);
    setInvoiceForm({ ...invoiceForm, items: updated });
  };

  const calculateTotal = () => {
    return invoiceForm.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  // Submit create invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.apartment_id) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn căn hộ cần lập hóa đơn.' });
      return;
    }

    try {
      await apiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify(invoiceForm),
      });
      setFeedback({ type: 'success', message: 'Tạo hóa đơn thành công!' });
      setIsCreateModalOpen(false);
      fetchData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Lỗi khi tạo hóa đơn.',
      });
    }
  };

  // Confirm payment
  const handleConfirmPayment = async (id: number, room: string, amount: string) => {
    if (!window.confirm(`Xác nhận đã nhận đủ số tiền ${formatVND(amount)} cho căn hộ ${room}?`)) {
      return;
    }

    try {
      await apiRequest(`/invoices/${id}/pay`, { method: 'PATCH' });
      setFeedback({ type: 'success', message: `Đã xác nhận thanh toán thành công hóa đơn #${id}.` });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi xác nhận thanh toán.' });
    }
  };

  const formatVND = (amount: string | number) => {
    const val = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="unpaid">Chưa thanh toán (Chờ nộp)</option>
            <option value="paid">Đã thanh toán thành công</option>
          </select>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tất cả các tháng</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="filter-select"
          >
            <option value="2026">Năm 2026</option>
            <option value="2025">Năm 2025</option>
          </select>
        </div>

        {isAdminOrManager && (
          <button className="btn-primary" onClick={handleOpenCreateModal}>
            + Tạo Hóa Đơn Dịch Vụ
          </button>
        )}
      </div>

      {/* Invoices Data Table */}
      {loading ? (
        <div className="state-container loading-state">
          <div className="spinner" />
          <p>Đang tải dữ liệu hóa đơn...</p>
        </div>
      ) : error ? (
        <div className="state-container error-state">
          <p>{error}</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="state-container empty-state">
          <div className="state-icon">💳</div>
          <h3>Không có hóa đơn nào</h3>
          <p>{isResident ? 'Căn hộ của bạn không có hóa đơn nào theo tiêu chí tìm kiếm.' : 'Không tìm thấy hóa đơn phù hợp.'}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã HĐ</th>
                <th>Căn Hộ</th>
                <th>Kỳ Hóa Đơn</th>
                <th>Tổng Số Tiền</th>
                <th>Hạn Nộp</th>
                <th>Trạng Thái</th>
                <th>Ngày Nộp</th>
                <th className="text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong>#{inv.id}</strong>
                  </td>
                  <td>
                    <div className="room-cell">
                      <strong>{inv.room_number}</strong>
                      <small className="text-muted"> ({inv.building_code})</small>
                    </div>
                  </td>
                  <td>
                    Tháng {inv.billing_month}/{inv.billing_year}
                  </td>
                  <td>
                    <strong className={inv.status === 'unpaid' ? 'text-danger' : 'text-success'}>
                      {formatVND(inv.total_amount)}
                    </strong>
                  </td>
                  <td>{formatDate(inv.due_date)}</td>
                  <td>
                    {inv.status === 'paid' ? (
                      <span className="badge badge-success">✓ Đã thanh toán</span>
                    ) : (
                      <span className="badge badge-danger">● Chưa thanh toán</span>
                    )}
                  </td>
                  <td>{formatDate(inv.paid_at)}</td>
                  <td className="text-right action-btns-cell">
                    <button
                      className="btn-action view"
                      onClick={() => setSelectedInvoiceDetail(inv)}
                      title="Xem chi tiết các khoản phí"
                    >
                      📄 Chi tiết
                    </button>
                    {isAdminOrManager && inv.status === 'unpaid' && (
                      <button
                        className="btn-action pay"
                        onClick={() => handleConfirmPayment(inv.id, inv.room_number, inv.total_amount)}
                        title="Xác nhận thu tiền"
                      >
                        💵 Thu tiền
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal View Invoice Detail */}
      <Modal
        isOpen={Boolean(selectedInvoiceDetail)}
        onClose={() => setSelectedInvoiceDetail(null)}
        title={`Chi tiết Hóa đơn #${selectedInvoiceDetail?.id} - Căn ${selectedInvoiceDetail?.room_number}`}
        maxWidth="620px"
      >
        {selectedInvoiceDetail && (
          <div className="invoice-detail-view">
            <div className="invoice-detail-header">
              <div>
                <strong>Tòa nhà:</strong> {selectedInvoiceDetail.building_name} ({selectedInvoiceDetail.building_code})
              </div>
              <div>
                <strong>Kỳ phí:</strong> Tháng {selectedInvoiceDetail.billing_month}/{selectedInvoiceDetail.billing_year}
              </div>
              <div>
                <strong>Hạn thanh toán:</strong> {formatDate(selectedInvoiceDetail.due_date)}
              </div>
              <div>
                <strong>Trạng thái:</strong>{' '}
                {selectedInvoiceDetail.status === 'paid' ? (
                  <span className="badge badge-success">Đã nộp ngày {formatDate(selectedInvoiceDetail.paid_at)}</span>
                ) : (
                  <span className="badge badge-danger">Chưa nộp tiền</span>
                )}
              </div>
            </div>

            <table className="invoice-items-table">
              <thead>
                <tr>
                  <th>Khoản Phí</th>
                  <th>Số Lượng</th>
                  <th>Đơn Giá</th>
                  <th className="text-right">Thành Tiền</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoiceDetail.items && selectedInvoiceDetail.items.length > 0 ? (
                  selectedInvoiceDetail.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{item.fee_name}</strong>
                      </td>
                      <td>
                        {item.quantity} {item.unit}
                      </td>
                      <td>{formatVND(item.unit_price)}</td>
                      <td className="text-right">
                        <strong>{formatVND(item.amount)}</strong>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      Hóa đơn tổng hợp không có chi tiết khoản mục
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3}>Tổng Cộng:</th>
                  <th className="text-right text-danger" style={{ fontSize: '18px' }}>
                    {formatVND(selectedInvoiceDetail.total_amount)}
                  </th>
                </tr>
              </tfoot>
            </table>

            {selectedInvoiceDetail.notes && (
              <p className="invoice-notes">
                <em>Ghi chú: {selectedInvoiceDetail.notes}</em>
              </p>
            )}

            {isResident && selectedInvoiceDetail.status === 'unpaid' && (
              <div style={{ marginTop: '16px', padding: '14px', background: '#fef3c7', borderRadius: 'var(--radius-md)', border: '1px solid #fde68a', fontSize: '13px', color: '#92400e' }}>
                <strong>Hướng dẫn thanh toán cho Cư dân:</strong>
                <p style={{ margin: '4px 0 0' }}>
                  Quý cư dân vui lòng đến nộp phí trực tiếp tại <strong>Văn phòng Ban Quản Lý (Tầng 1 Tòa A)</strong> trong giờ hành chính, hoặc chuyển khoản vào tài khoản ngân hàng của Ban Quản Lý kèm nội dung: <code>CAN {selectedInvoiceDetail.room_number} PHI T{selectedInvoiceDetail.billing_month}</code>.
                </p>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedInvoiceDetail(null)}>
                Đóng
              </button>
              {isAdminOrManager && selectedInvoiceDetail.status === 'unpaid' && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    const id = selectedInvoiceDetail.id;
                    const room = selectedInvoiceDetail.room_number;
                    const amt = selectedInvoiceDetail.total_amount;
                    setSelectedInvoiceDetail(null);
                    handleConfirmPayment(id, room, amt);
                  }}
                >
                  Xác Nhận Đã Thu Tiền
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Create Invoice (Staff Only) */}
      {isAdminOrManager && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Lập Hóa Đơn Dịch Vụ Mới"
          maxWidth="680px"
        >
          <form onSubmit={handleCreateInvoice} className="modal-form">
            <div className="form-row-2col">
              <div className="form-group">
                <label>Căn hộ nhận hóa đơn (*)</label>
                <select
                  value={invoiceForm.apartment_id}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, apartment_id: e.target.value })}
                  required
                >
                  <option value="">-- Chọn căn hộ --</option>
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      Căn {a.room_number} ({a.building_code} - {a.area_sqm} m²)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label>Tháng</label>
                  <select
                    value={invoiceForm.billing_month}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, billing_month: e.target.value })}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Năm</label>
                  <input
                    type="number"
                    value={invoiceForm.billing_year}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, billing_year: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Hạn nộp tiền (*)</label>
              <input
                type="date"
                value={invoiceForm.due_date}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                required
              />
            </div>

            <h4 style={{ margin: '14px 0 8px 0' }}>Khoản mục tính phí định kỳ:</h4>
            <div className="fee-items-list-editor">
              {invoiceForm.items.map((item, idx) => (
                <div key={idx} className="fee-item-editor-row">
                  <div className="fee-name-col">
                    <strong>{item.fee_name}</strong>
                    <small>Đơn giá: {formatVND(item.unit_price)} / {item.unit}</small>
                  </div>
                  <div className="fee-qty-col">
                    <label>Số lượng ({item.unit}):</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItemQty(idx, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="fee-amt-col">
                    <span>Thành tiền:</span>
                    <strong>{formatVND(item.quantity * item.unit_price)}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="invoice-total-summary">
              <span>Tổng cộng hóa đơn:</span>
              <strong className="total-highlight">{formatVND(calculateTotal())}</strong>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label>Ghi chú hóa đơn</label>
              <textarea
                rows={2}
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="btn-primary">
                Tạo Hóa Đơn ({formatVND(calculateTotal())})
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
