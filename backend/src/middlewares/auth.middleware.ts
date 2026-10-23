import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'manager' | 'resident';
  full_name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập để truy cập tài nguyên này.'
    });
    return;
  }

  const secret = process.env.JWT_SECRET || 'apartment_management_super_secure_jwt_secret_key_2026';

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      res.status(403).json({
        success: false,
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
      });
      return;
    }

    req.user = decoded as AuthUser;
    next();
  });
};

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const userRole = req.user.role.toLowerCase();
    const isAllowed = allowedRoles.some((r) => r.toLowerCase() === userRole);

    if (!isAllowed) {
      res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này.'
      });
      return;
    }

    next();
  };
};
