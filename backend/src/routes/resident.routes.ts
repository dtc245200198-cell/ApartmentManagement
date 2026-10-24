import { Router } from 'express';
import {
  getResidents,
  createResident,
  updateResident,
  deleteResident,
  assignApartment,
  unassignApartment
} from '../controllers/resident.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getResidents);
router.post('/', authenticateToken, authorizeRoles('admin', 'manager'), createResident);
router.put('/:id', authenticateToken, authorizeRoles('admin', 'manager'), updateResident);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteResident);

// Apartment residence assignments
router.post('/assign', authenticateToken, authorizeRoles('admin', 'manager'), assignApartment);
router.delete('/unassign/:relation_id', authenticateToken, authorizeRoles('admin', 'manager'), unassignApartment);

export default router;
