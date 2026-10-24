import { Response } from 'express';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const getTickets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, priority, apartment_id, search } = req.query;
    const user = req.user;

    let sql = `
      SELECT 
        c.*,
        u.full_name as resident_name, u.phone as resident_phone, u.username as resident_username,
        a.room_number, a.floor,
        b.code as building_code, b.name as building_name
      FROM complaints c
      JOIN users u ON c.resident_id = u.id
      LEFT JOIN apartments a ON c.apartment_id = a.id
      LEFT JOIN buildings b ON a.building_id = b.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    // Resident restriction: Residents can only see their own tickets!
    if (user && user.role.toLowerCase() === 'resident') {
      params.push(user.id);
      sql += ` AND c.resident_id = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND c.status = $${params.length}`;
    }

    if (priority && priority !== 'all') {
      params.push(priority);
      sql += ` AND c.priority = $${params.length}`;
    }

    if (apartment_id && apartment_id !== 'all') {
      params.push(apartment_id);
      sql += ` AND c.apartment_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      sql += ` AND (c.title ILIKE $${params.length} OR c.content ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR a.room_number ILIKE $${params.length})`;
    }

    sql += ` ORDER BY 
      CASE c.status
        WHEN 'pending' THEN 1
        WHEN 'processing' THEN 2
        WHEN 'resolved' THEN 3
        WHEN 'rejected' THEN 4
        ELSE 5
      END,
      c.created_at DESC
    `;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GetTickets Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách yêu cầu sửa chữa.' });
  }
};

export const getTicketById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    const result = await query(
      `SELECT c.*, u.full_name as resident_name, u.phone as resident_phone, u.username as resident_username,
              a.room_number, a.floor, b.code as building_code, b.name as building_name
       FROM complaints c
       JOIN users u ON c.resident_id = u.id
       LEFT JOIN apartments a ON c.apartment_id = a.id
       LEFT JOIN buildings b ON a.building_id = b.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu sửa chữa.' });
      return;
    }

    const ticket = result.rows[0];

    // Security check: Resident can only view their own ticket
    if (user && user.role.toLowerCase() === 'resident' && ticket.resident_id !== user.id) {
      res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập yêu cầu sửa chữa của cư dân khác.'
      });
      return;
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('[GetTicketById Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy chi tiết yêu cầu.' });
  }
};

export const createTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { apartment_id, title, content, priority } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
      return;
    }

    if (!title || !content) {
      res.status(400).json({ success: false, message: 'Tiêu đề và nội dung mô tả sự cố không được để trống.' });
      return;
    }

    // Determine target apartment
    let targetApartmentId = apartment_id ? parseInt(apartment_id, 10) : null;

    if (user.role === 'resident') {
      if (targetApartmentId) {
        // Verify resident belongs to this apartment
        const aptCheck = await query(
          'SELECT 1 FROM apartment_residents WHERE user_id = $1 AND apartment_id = $2',
          [user.id, targetApartmentId]
        );
        if (aptCheck.rows.length === 0) {
          res.status(403).json({
            success: false,
            message: 'Bạn chỉ được phép gửi yêu cầu sửa chữa cho căn hộ mà bạn đang cư trú.'
          });
          return;
        }
      } else {
        // Auto-assign resident's apartment
        const apt = await query('SELECT apartment_id FROM apartment_residents WHERE user_id = $1 LIMIT 1', [user.id]);
        if (apt.rows.length > 0) {
          targetApartmentId = apt.rows[0].apartment_id;
        }
      }
    }

    const validPriority = ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium';

    const result = await query(
      `INSERT INTO complaints (resident_id, apartment_id, title, content, priority, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [user.id, targetApartmentId, title.trim(), content.trim(), validPriority]
    );

    res.status(201).json({
      success: true,
      message: 'Gửi yêu cầu sửa chữa thành công.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[CreateTicket Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gửi yêu cầu sửa chữa.' });
  }
};

export const updateTicketStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, admin_response } = req.body;

    const validStatuses = ['pending', 'processing', 'resolved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ. Chỉ chấp nhận: pending, processing, resolved, rejected.'
      });
      return;
    }

    // Check existing ticket status
    const currentTicket = await query('SELECT status FROM complaints WHERE id = $1', [id]);
    if (currentTicket.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu sửa chữa.' });
      return;
    }

    const currentStatus = currentTicket.rows[0].status;

    // Validate state transitions
    if (currentStatus === 'resolved' && status === 'pending') {
      res.status(400).json({
        success: false,
        message: 'Yêu cầu đã hoàn thành không thể chuyển ngược về trạng thái chờ tiếp nhận.'
      });
      return;
    }

    const isResolved = status === 'resolved';

    const result = await query(
      `UPDATE complaints 
       SET status = $1, 
           admin_response = COALESCE($2, admin_response),
           resolved_at = CASE WHEN $3 = true THEN CURRENT_TIMESTAMP ELSE resolved_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [status, admin_response || null, isResolved, id]
    );

    res.json({
      success: true,
      message: 'Cập nhật trạng thái yêu cầu thành công.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[UpdateTicketStatus Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật yêu cầu.' });
  }
};
