import { Router } from 'express';
import {
  login,
  getProfile,
  updateProfile,
  changePassword,
  getUsers,
  createUser,
  toggleUserStatus,
  deleteUser
} from '../controllers/auth.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.post('/login', login);

// Authenticated user profile routes
router.get('/me', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);

// User administration routes (Strictly Admin only)
router.get('/users', authenticateToken, authorizeRoles('admin'), getUsers);
router.post('/users', authenticateToken, authorizeRoles('admin'), createUser);
router.patch('/users/:id/status', authenticateToken, authorizeRoles('admin'), toggleUserStatus);
router.delete('/users/:id', authenticateToken, authorizeRoles('admin'), deleteUser);

export default router;
