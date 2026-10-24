import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.get('/stats', authenticateToken, getDashboardStats);

export default router;
