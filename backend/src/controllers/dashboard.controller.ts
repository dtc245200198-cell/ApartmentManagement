import { Response } from 'express';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const isResident = user?.role === 'resident';

    if (isResident && user) {
      // Specialized Resident Dashboard Data
      const [apartmentsRes, invoicesRes, ticketsRes, myRecentTickets] = await Promise.all([
        query(
          `SELECT a.id, a.room_number, a.floor, a.area_sqm, b.code as building_code, b.name as building_name,
                  ar.relation, ar.is_primary_contact
           FROM apartment_residents ar
           JOIN apartments a ON ar.apartment_id = a.id
           JOIN buildings b ON a.building_id = b.id
           WHERE ar.user_id = $1`,
          [user.id]
        ),
        query(
          `SELECT 
            COUNT(*)::int as total,
            COUNT(CASE WHEN status = 'unpaid' THEN 1 END)::int as unpaid_count,
            COUNT(CASE WHEN status = 'paid' THEN 1 END)::int as paid_count,
            COALESCE(SUM(CASE WHEN status = 'unpaid' THEN total_amount ELSE 0 END), 0)::numeric(12,2) as debt
           FROM invoices i
           WHERE i.apartment_id IN (SELECT apartment_id FROM apartment_residents WHERE user_id = $1)`,
          [user.id]
        ),
        query(
          `SELECT 
            COUNT(*)::int as total,
            COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending,
            COUNT(CASE WHEN status = 'processing' THEN 1 END)::int as processing,
            COUNT(CASE WHEN status = 'resolved' THEN 1 END)::int as resolved,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END)::int as rejected
           FROM complaints WHERE resident_id = $1`,
          [user.id]
        ),
        query(
          `SELECT c.id, c.title, c.status, c.priority, c.created_at, c.admin_response,
                  u.full_name as resident_name, a.room_number
           FROM complaints c
           JOIN users u ON c.resident_id = u.id
           LEFT JOIN apartments a ON c.apartment_id = a.id
           WHERE c.resident_id = $1
           ORDER BY c.created_at DESC LIMIT 5`,
          [user.id]
        )
      ]);

      res.json({
        success: true,
        data: {
          residentMode: true,
          myApartments: apartmentsRes.rows,
          finance: {
            totalInvoices: invoicesRes.rows[0].total,
            unpaidCount: invoicesRes.rows[0].unpaid_count,
            paidCount: invoicesRes.rows[0].paid_count,
            totalDebt: invoicesRes.rows[0].debt,
            totalCollected: '0.00'
          },
          tickets: {
            total: ticketsRes.rows[0].total,
            pending: ticketsRes.rows[0].pending,
            processing: ticketsRes.rows[0].processing,
            resolved: ticketsRes.rows[0].resolved,
            rejected: ticketsRes.rows[0].rejected
          },
          recentTickets: myRecentTickets.rows,
          buildings: { total: apartmentsRes.rows.length },
          apartments: { total: apartmentsRes.rows.length, occupied: apartmentsRes.rows.length, vacant: 0, maintenance: 0 },
          residents: { total: 1 }
        }
      });
      return;
    }

    // Admin & Manager Dashboard Data (System-wide)
    const [
      buildingsCount,
      apartmentsStats,
      residentsCount,
      invoiceStats,
      ticketStats,
      recentActivity
    ] = await Promise.all([
      query('SELECT COUNT(*)::int as total FROM buildings'),
      query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(CASE WHEN status = 'occupied' THEN 1 END)::int as occupied,
          COUNT(CASE WHEN status = 'vacant' THEN 1 END)::int as vacant,
          COUNT(CASE WHEN status = 'maintenance' THEN 1 END)::int as maintenance
        FROM apartments
      `),
      query(`SELECT COUNT(*)::int as total FROM users WHERE LOWER(role) = 'resident' AND is_active = true`),
      query(`
        SELECT 
          COUNT(*)::int as total_invoices,
          COUNT(CASE WHEN status = 'unpaid' THEN 1 END)::int as unpaid_count,
          COUNT(CASE WHEN status = 'paid' THEN 1 END)::int as paid_count,
          COALESCE(SUM(CASE WHEN status = 'unpaid' THEN total_amount ELSE 0 END), 0)::numeric(12,2) as total_debt,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0)::numeric(12,2) as total_collected
        FROM invoices
      `),
      query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending,
          COUNT(CASE WHEN status = 'processing' THEN 1 END)::int as processing,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END)::int as resolved,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END)::int as rejected
        FROM complaints
      `),
      query(`
        SELECT 
          c.id, c.title, c.status, c.priority, c.created_at,
          u.full_name as resident_name, a.room_number
        FROM complaints c
        JOIN users u ON c.resident_id = u.id
        LEFT JOIN apartments a ON c.apartment_id = a.id
        ORDER BY c.created_at DESC
        LIMIT 5
      `)
    ]);

    res.json({
      success: true,
      data: {
        residentMode: false,
        buildings: { total: buildingsCount.rows[0].total },
        apartments: {
          total: apartmentsStats.rows[0].total,
          occupied: apartmentsStats.rows[0].occupied,
          vacant: apartmentsStats.rows[0].vacant,
          maintenance: apartmentsStats.rows[0].maintenance
        },
        residents: { total: residentsCount.rows[0].total },
        finance: {
          totalInvoices: invoiceStats.rows[0].total_invoices,
          unpaidCount: invoiceStats.rows[0].unpaid_count,
          paidCount: invoiceStats.rows[0].paid_count,
          totalDebt: invoiceStats.rows[0].total_debt,
          totalCollected: invoiceStats.rows[0].total_collected
        },
        tickets: {
          total: ticketStats.rows[0].total,
          pending: ticketStats.rows[0].pending,
          processing: ticketStats.rows[0].processing,
          resolved: ticketStats.rows[0].resolved,
          rejected: ticketStats.rows[0].rejected
        },
        recentTickets: recentActivity.rows
      }
    });
  } catch (error) {
    console.error('[GetDashboardStats Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy dữ liệu tổng quan.' });
  }
};
