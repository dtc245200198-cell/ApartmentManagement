import { Router } from 'express';
import { getTickets, getTicketById, createTicket, updateTicketStatus } from '../controllers/ticket.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getTickets);
router.get('/:id', authenticateToken, getTicketById);
router.post('/', authenticateToken, createTicket);
router.patch('/:id/status', authenticateToken, authorizeRoles('admin', 'manager'), updateTicketStatus);

export default router;
