import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: 'Tên đăng nhập và mật khẩu không được để trống.'
      });
      return;
    }

    const result = await query(
      `SELECT id, username, password_hash, full_name, email, phone, role, is_active 
       FROM users WHERE LOWER(username) = LOWER($1)`,
      [username.trim()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      });
      return;
    }

    const user = result.rows[0];

    if (!user.is_active) {
      res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ Quản trị viên.'
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      });
      return;
    }

    const secret = process.env.JWT_SECRET || 'apartment_management_super_secure_jwt_secret_key_2026';
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role.toLowerCase(),
        full_name: user.full_name
      },
      secret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role.toLowerCase()
        }
      }
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ trong quá trình đăng nhập.'
    });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
      return;
    }

    const result = await query(
      `SELECT id, username, full_name, email, phone, role, is_active, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[GetProfile Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy thông tin.' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
      return;
    }

    const { full_name, email, phone } = req.body;

    const result = await query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, username, full_name, email, phone, role, is_active`,
      [full_name ? full_name.trim() : null, email ? email.trim() : null, phone ? phone.trim() : null, req.user.id]
    );

    res.json({
      success: true,
      message: 'Cập nhật thông tin cá nhân thành công.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[UpdateProfile Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật thông tin.' });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
      return;
    }

    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới.'
      });
      return;
    }

    if (new_password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự.'
      });
      return;
    }

    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
      return;
    }

    const isMatch = await bcrypt.compare(current_password, userRes.rows[0].password_hash);
    if (!isMatch) {
      res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không chính xác.'
      });
      return;
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      newHash,
      req.user.id
    ]);

    res.json({
      success: true,
      message: 'Đổi mật khẩu thành công.'
    });
  } catch (error) {
    console.error('[ChangePassword Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đổi mật khẩu.' });
  }
};

export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { role, search } = req.query;
    let sql = `
      SELECT id, username, full_name, email, phone, role, is_active, created_at 
      FROM users WHERE 1=1
    `;
    const params: unknown[] = [];

    if (role && role !== 'all') {
      params.push(String(role).toLowerCase());
      sql += ` AND LOWER(role) = $${params.length}`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      sql += ` AND (username ILIKE $${params.length} OR full_name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GetUsers Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách tài khoản.' });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { username, password, full_name, email, phone, role } = req.body;

    if (!username || !password || !full_name || !role) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ tên đăng nhập, mật khẩu, họ tên và vai trò.'
      });
      return;
    }

    const normalizedRole = String(role).toLowerCase();
    if (!['admin', 'manager', 'resident'].includes(normalizedRole)) {
      res.status(400).json({
        success: false,
        message: 'Vai trò chỉ có thể là ADMIN, MANAGER hoặc RESIDENT.'
      });
      return;
    }

    // Protection: Only ADMIN can assign ADMIN role
    if (normalizedRole === 'admin' && req.user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Chỉ Quản trị viên (Admin) mới có quyền cấp vai trò ADMIN.'
      });
      return;
    }

    const existing = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    if (existing.rows.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Tên đăng nhập này đã được sử dụng.'
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, username, full_name, email, phone, role, is_active, created_at`,
      [username.trim(), passwordHash, full_name.trim(), email || null, phone || null, normalizedRole]
    );

    res.status(201).json({
      success: true,
      message: 'Tạo tài khoản thành công.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[CreateUser Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo tài khoản.' });
  }
};

export const toggleUserStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      res.status(400).json({ success: false, message: 'Trạng thái is_active không hợp lệ.' });
      return;
    }

    const userCheck = await query('SELECT role, is_active FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
      return;
    }

    const targetUser = userCheck.rows[0];

    // Protection: Cannot deactivate the last active ADMIN
    if (targetUser.role.toLowerCase() === 'admin' && !is_active) {
      const adminCount = await query("SELECT COUNT(*)::int as count FROM users WHERE LOWER(role) = 'admin' AND is_active = true");
      if (adminCount.rows[0].count <= 1) {
        res.status(400).json({
          success: false,
          message: 'Không thể khóa tài khoản Quản trị viên (Admin) duy nhất còn hoạt động trong hệ thống.'
        });
        return;
      }
    }

    const result = await query(
      `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 
       RETURNING id, username, full_name, role, is_active`,
      [is_active, id]
    );

    res.json({
      success: true,
      message: is_active ? 'Mở khóa tài khoản thành công.' : 'Khóa tài khoản thành công.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[ToggleUserStatus Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật trạng thái tài khoản.' });
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Protection: Cannot delete own account
    if (req.user?.id === id) {
      res.status(400).json({ success: false, message: 'Không thể tự xóa tài khoản của chính mình khi đang đăng nhập.' });
      return;
    }

    const userCheck = await query('SELECT role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
      return;
    }

    // Protection: Cannot delete last Admin
    if (userCheck.rows[0].role.toLowerCase() === 'admin') {
      const adminCount = await query("SELECT COUNT(*)::int as count FROM users WHERE LOWER(role) = 'admin'");
      if (adminCount.rows[0].count <= 1) {
        res.status(400).json({
          success: false,
          message: 'Không thể xóa tài khoản Quản trị viên (Admin) cuối cùng của hệ thống.'
        });
        return;
      }
    }

    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'Xóa tài khoản người dùng thành công.' });
  } catch (error) {
    console.error('[DeleteUser Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa người dùng.' });
  }
};
