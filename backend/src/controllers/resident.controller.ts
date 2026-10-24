import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const getResidents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, apartment_id, relation } = req.query;
    const user = req.user;

    let sql = `
      SELECT 
        u.id, u.username, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'relation_id', ar.id,
              'apartment_id', a.id,
              'room_number', a.room_number,
              'building_code', b.code,
              'building_name', b.name,
              'relation', ar.relation,
              'start_date', ar.start_date,
              'is_primary_contact', ar.is_primary_contact
            )
          ) FILTER (WHERE a.id IS NOT NULL), '[]'
        ) as apartments
      FROM users u
      LEFT JOIN apartment_residents ar ON u.id = ar.user_id
      LEFT JOIN apartments a ON ar.apartment_id = a.id
      LEFT JOIN buildings b ON a.building_id = b.id
      WHERE LOWER(u.role) = 'resident'
    `;
    const params: unknown[] = [];

    // Security check: Resident can only view themselves and roommates in the same apartment
    if (user && user.role === 'resident') {
      params.push(user.id);
      sql += ` AND u.id IN (
        SELECT user_id FROM apartment_residents WHERE apartment_id IN (
          SELECT apartment_id FROM apartment_residents WHERE user_id = $${params.length}
        )
      )`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      sql += ` AND (u.full_name ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
    }

    if (apartment_id && apartment_id !== 'all') {
      params.push(apartment_id);
      sql += ` AND ar.apartment_id = $${params.length}`;
    }

    if (relation && relation !== 'all') {
      params.push(relation);
      sql += ` AND ar.relation = $${params.length}`;
    }

    sql += ` GROUP BY u.id ORDER BY u.full_name ASC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GetResidents Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách cư dân.' });
  }
};

export const createResident = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { username, password, full_name, email, phone, apartment_id, relation, is_primary_contact } = req.body;

    if (!username || !password || !full_name) {
      res.status(400).json({
        success: false,
        message: 'Tên đăng nhập, mật khẩu và họ tên cư dân là bắt buộc.'
      });
      return;
    }

    const check = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    if (check.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại trong hệ thống.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Force role to 'resident' to prevent privilege escalation
    const userResult = await query(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, 'resident', true)
       RETURNING id, username, full_name, email, phone, role, created_at`,
      [username.trim(), passwordHash, full_name.trim(), email || null, phone || null]
    );

    const newUser = userResult.rows[0];

    // If an apartment is specified, create relationship
    if (apartment_id) {
      const validRelation = ['owner', 'tenant', 'family_member', 'resident'].includes(relation)
        ? relation
        : 'resident';

      await query(
        `INSERT INTO apartment_residents (user_id, apartment_id, relation, is_primary_contact)
         VALUES ($1, $2, $3, $4)`,
        [newUser.id, apartment_id, validRelation, Boolean(is_primary_contact)]
      );

      // Update apartment status to 'occupied' if currently 'vacant'
      await query(
        `UPDATE apartments SET status = 'occupied' WHERE id = $1 AND status = 'vacant'`,
        [apartment_id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Thêm cư dân thành công.',
      data: newUser
    });
  } catch (error) {
    console.error('[CreateResident Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo cư dân.' });
  }
};

export const updateResident = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, is_active } = req.body;

    const result = await query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           is_active = COALESCE($4, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND LOWER(role) = 'resident'
       RETURNING id, username, full_name, email, phone, role, is_active`,
      [full_name ? full_name.trim() : null, email, phone, is_active, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy cư dân.' });
      return;
    }

    res.json({ success: true, message: 'Cập nhật thông tin cư dân thành công.', data: result.rows[0] });
  } catch (error) {
    console.error('[UpdateResident Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật cư dân.' });
  }
};

export const deleteResident = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if resident has complaints or unpaid invoices
    const complaintsCheck = await query('SELECT COUNT(*)::int as count FROM complaints WHERE resident_id = $1', [id]);
    if (complaintsCheck.rows[0].count > 0) {
      // Soft-delete (deactivate) instead of hard delete to preserve audit history
      await query('UPDATE users SET is_active = false WHERE id = $1', [id]);
      res.json({
        success: true,
        message: 'Cư dân đã có lịch sử phản ánh sửa chữa nên tài khoản được chuyển sang trạng thái Vô hiệu hóa (Deactivated).'
      });
      return;
    }

    const result = await query("DELETE FROM users WHERE id = $1 AND LOWER(role) = 'resident' RETURNING id", [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy cư dân.' });
      return;
    }

    res.json({ success: true, message: 'Xóa cư dân thành công.' });
  } catch (error) {
    console.error('[DeleteResident Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa cư dân.' });
  }
};

export const assignApartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { user_id, apartment_id, relation, is_primary_contact } = req.body;

    if (!user_id || !apartment_id) {
      res.status(400).json({ success: false, message: 'Mã cư dân và mã căn hộ là bắt buộc.' });
      return;
    }

    const validRelation = ['owner', 'tenant', 'family_member', 'resident'].includes(relation)
      ? relation
      : 'resident';

    await query(
      `INSERT INTO apartment_residents (user_id, apartment_id, relation, is_primary_contact)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, apartment_id) DO UPDATE
       SET relation = $3, is_primary_contact = $4`,
      [user_id, apartment_id, validRelation, Boolean(is_primary_contact)]
    );

    // Update apartment status
    await query(`UPDATE apartments SET status = 'occupied' WHERE id = $1`, [apartment_id]);

    res.json({ success: true, message: 'Gán cư dân vào căn hộ thành công.' });
  } catch (error) {
    console.error('[AssignApartment Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gán cư dân vào căn hộ.' });
  }
};

export const unassignApartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { relation_id } = req.params;

    const find = await query('SELECT apartment_id FROM apartment_residents WHERE id = $1', [relation_id]);
    if (find.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy liên kết cư trú.' });
      return;
    }

    const apartmentId = find.rows[0].apartment_id;
    await query('DELETE FROM apartment_residents WHERE id = $1', [relation_id]);

    // Check remaining residents; if 0, update apartment status to 'vacant'
    const remain = await query('SELECT COUNT(*)::int as count FROM apartment_residents WHERE apartment_id = $1', [apartmentId]);
    if (remain.rows[0].count === 0) {
      await query(`UPDATE apartments SET status = 'vacant' WHERE id = $1`, [apartmentId]);
    }

    res.json({ success: true, message: 'Hủy gán cư dân khỏi căn hộ thành công.' });
  } catch (error) {
    console.error('[UnassignApartment Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi hủy liên kết cư trú.' });
  }
};
