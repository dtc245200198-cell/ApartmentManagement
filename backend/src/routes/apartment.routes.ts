import { Router } from 'express';
import {
  getBuildings,
  createBuilding,
  deleteBuilding,
  getApartments,
  getApartmentById,
  createApartment,
  updateApartment,
  deleteApartment
} from '../controllers/apartment.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Building routes
router.get('/buildings', authenticateToken, getBuildings);
router.post('/buildings', authenticateToken, authorizeRoles('admin', 'manager'), createBuilding);
router.delete('/buildings/:id', authenticateToken, authorizeRoles('admin'), deleteBuilding);

// Apartment routes
router.get('/apartments', authenticateToken, getApartments);
router.get('/apartments/:id', authenticateToken, getApartmentById);
router.post('/apartments', authenticateToken, authorizeRoles('admin', 'manager'), createApartment);
router.put('/apartments/:id', authenticateToken, authorizeRoles('admin', 'manager'), updateApartment);
router.delete('/apartments/:id', authenticateToken, authorizeRoles('admin'), deleteApartment);

export default router;
