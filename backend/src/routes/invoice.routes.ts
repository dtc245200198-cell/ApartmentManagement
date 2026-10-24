import { Router } from 'express';
import { getInvoices, getInvoiceById, createInvoice, confirmPayment, getFeeTypes } from '../controllers/invoice.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get('/fee-types', authenticateToken, getFeeTypes);
router.get('/', authenticateToken, getInvoices);
router.get('/:id', authenticateToken, getInvoiceById);
router.post('/', authenticateToken, authorizeRoles('admin', 'manager'), createInvoice);
router.patch('/:id/pay', authenticateToken, authorizeRoles('admin', 'manager'), confirmPayment);

export default router;
