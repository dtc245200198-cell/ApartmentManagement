import { Response } from 'express';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// ----------------- TÒA NHÀ (BUILDINGS) -----------------
export const getBuildings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    let sql = `
      SELECT b.*, 
        COUNT(a.id)::int as total_apartments,
        COUNT(CASE WHEN a.status = 'occupied' THEN 1 END)::int as occupied_apartments,
        COUNT(CASE WHEN a.status = 'vacant' THEN 1 END)::int as vacant_apartments
      FROM buildings b
      LEFT JOIN apartments a ON a.building_id = b.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    // Resident restriction: only see buildings they reside in
    if (user && user.role === 'resident') {
      params.push(user.id);
      sql += ` AND b.id IN (
        SELECT apt.building_id FROM apartments apt 
        JOIN apartment_residents ar ON apt.id = ar.apartment_id 
        WHERE ar.user_id = $${params.length}
      )`;
    }

    sql += ` GROUP BY b.id ORDER BY b.code ASC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GetBuildings Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách tòa nhà.' });
  }
};

export const createBuilding = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { code, name, total_floors, description } = req.body;
    if (!code || !name || !total_floors) {
      res.status(400).json({ success: false, message: 'Mã tòa, tên tòa và số tầng là bắt buộc.' });
      return;
    }

    const result = await query(
      `INSERT INTO buildings (code, name, total_floors, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), parseInt(total_floors, 10), description || null]
    );
    res.status(201).json({ success: true, message: 'Thêm tòa nhà thành công.', data: result.rows[0] });
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') {
      res.status(400).json({ success: false, message: 'Mã tòa nhà này đã tồn tại.' });
      return;
    }
    console.error('[CreateBuilding Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thêm tòa nhà.' });
  }
};

export const deleteBuilding = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const check = await query('SELECT COUNT(*)::int as count FROM apartments WHERE building_id = $1', [id]);
    if (check.rows[0].count > 0) {
      res.status(400).json({
        success: false,
        message: `Không thể xóa tòa nhà vì đang có ${check.rows[0].count} căn hộ trực thuộc. Vui lòng chuyển hoặc xóa các căn hộ trước.`
      });
      return;
    }

    const result = await query('DELETE FROM buildings WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy tòa nhà.' });
      return;
    }
    res.json({ success: true, message: 'Xóa tòa nhà thành công.' });
  } catch (error) {
    console.error('[DeleteBuilding Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa tòa nhà.' });
  }
};

// ----------------- CĂN HỘ (APARTMENTS) -----------------
export const getApartments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { building_id, status, search } = req.query;
    const user = req.user;

    let sql = `
      SELECT 
        a.id, a.room_number, a.floor, a.area_sqm, a.status, a.created_at,
        b.id as building_id, b.code as building_code, b.name as building_name,
        COALESCE(
          json_agg(
            json_build_object(
              'resident_id', u.id,
              'full_name', u.full_name,
              'phone', u.phone,
              'relation', ar.relation,
              'is_primary', ar.is_primary_contact
            )
          ) FILTER (WHERE u.id IS NOT NULL), '[]'
        ) as residents
      FROM apartments a
      JOIN buildings b ON a.building_id = b.id
      LEFT JOIN apartment_residents ar ON a.id = ar.apartment_id
      LEFT JOIN users u ON ar.user_id = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    // Security check: Resident can ONLY see their own linked apartments!
    if (user && user.role === 'resident') {
      params.push(user.id);
      sql += ` AND a.id IN (SELECT apartment_id FROM apartment_residents WHERE user_id = $${params.length})`;
    }

    if (building_id && building_id !== 'all') {
      params.push(building_id);
      sql += ` AND a.building_id = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND a.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      sql += ` AND (a.room_number ILIKE $${params.length} OR b.name ILIKE $${params.length})`;
    }

    sql += ` GROUP BY a.id, b.id ORDER BY b.code ASC, a.floor ASC, a.room_number ASC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GetApartments Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách căn hộ.' });
  }
};

export const getApartmentById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Security check: If resident, verify they reside in this apartment
    if (user && user.role === 'resident') {
      const checkAccess = await query(
        'SELECT 1 FROM apartment_residents WHERE apartment_id = $1 AND user_id = $2',
        [id, user.id]
      );
      if (checkAccess.rows.length === 0) {
        res.status(403).json({
          success: false,
          message: 'Bạn không có quyền truy cập thông tin của căn hộ này.'
        });
        return;
      }
    }

    const result = await query(
      `SELECT a.*, b.code as building_code, b.name as building_name
       FROM apartments a
       JOIN buildings b ON a.building_id = b.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy căn hộ.' });
      return;
    }

    // Get residents of this apartment
    const residents = await query(
      `SELECT ar.*, u.full_name, u.email, u.phone, u.username
       FROM apartment_residents ar
       JOIN users u ON ar.user_id = u.id
       WHERE ar.apartment_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        residents: residents.rows
      }
    });
  } catch (error) {
    console.error('[GetApartmentById Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy chi tiết căn hộ.' });
  }
};

export const createApartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { building_id, room_number, floor, area_sqm, status } = req.body;

    if (!building_id || !room_number || !floor || !area_sqm) {
      res.status(400).json({
        success: false,
        message: 'Tòa nhà, số phòng, tầng và diện tích không được để trống.'
      });
      return;
    }

    const validStatus = ['vacant', 'occupied', 'maintenance'].includes(status) ? status : 'vacant';

    const result = await query(
      `INSERT INTO apartments (building_id, room_number, floor, area_sqm, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [building_id, room_number.trim(), parseInt(floor, 10), parseFloat(area_sqm), validStatus]
    );

    res.status(201).json({
      success: true,
      message: 'Thêm căn hộ thành công.',
      data: result.rows[0]
    });
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') {
      res.status(400).json({
        success: false,
        message: 'Số căn hộ này đã tồn tại trong tòa nhà được chọn.'
      });
      return;
    }
    console.error('[CreateApartment Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo căn hộ.' });
  }
};

export const updateApartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { building_id, room_number, floor, area_sqm, status } = req.body;

    const result = await query(
      `UPDATE apartments 
       SET building_id = COALESCE($1, building_id),
           room_number = COALESCE($2, room_number),
           floor = COALESCE($3, floor),
           area_sqm = COALESCE($4, area_sqm),
           status = COALESCE($5, status)
       WHERE id = $6 RETURNING *`,
      [
        building_id,
        room_number ? room_number.trim() : null,
        floor ? parseInt(floor, 10) : null,
        area_sqm ? parseFloat(area_sqm) : null,
        status,
        id
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy căn hộ cần sửa.' });
      return;
    }

    res.json({
      success: true,
      message: 'Cập nhật căn hộ thành công.',
      data: result.rows[0]
    });
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') {
      res.status(400).json({
        success: false,
        message: 'Số căn hộ trùng lặp trong cùng tòa nhà.'
      });
      return;
    }
    console.error('[UpdateApartment Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật căn hộ.' });
  }
};

export const deleteApartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Integrity check 1: Check if residents exist in this apartment
    const residentsCheck = await query(
      'SELECT COUNT(*)::int as count FROM apartment_residents WHERE apartment_id = $1',
      [id]
    );
    if (residentsCheck.rows[0].count > 0) {
      res.status(400).json({
        success: false,
        message: `Không thể xóa căn hộ vì đang có ${residentsCheck.rows[0].count} cư dân cư trú. Vui lòng chuyển cư dân trước.`
      });
      return;
    }

    // Integrity check 2: Check if invoices exist
    const invoicesCheck = await query(
      'SELECT COUNT(*)::int as count FROM invoices WHERE apartment_id = $1',
      [id]
    );
    if (invoicesCheck.rows[0].count > 0) {
      res.status(400).json({
        success: false,
        message: `Không thể xóa căn hộ vì đang có ${invoicesCheck.rows[0].count} hóa đơn liên quan để đảm bảo toàn vẹn dữ liệu kế toán.`
      });
      return;
    }

    const result = await query('DELETE FROM apartments WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy căn hộ.' });
      return;
    }

    res.json({ success: true, message: 'Xóa căn hộ thành công.' });
  } catch (error) {
    console.error('[DeleteApartment Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa căn hộ.' });
  }
};
