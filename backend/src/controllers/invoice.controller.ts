import { Response } from 'express';
import { query, pool } from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const getFeeTypes = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM fee_types ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GetFeeTypes Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh mục phí.' });
  }
};

export const getInvoices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, billing_month, billing_year, apartment_id, search } = req.query;
    const user = req.user;

    let sql = `
      SELECT 
        i.*,
        a.room_number, a.floor,
        b.code as building_code, b.name as building_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ii.id,
              'fee_type_id', ft.id,
              'fee_name', ft.name,
              'unit', ft.unit,
              'quantity', ii.quantity,
              'unit_price', ii.unit_price,
              'amount', ii.amount,
              'note', ii.note
            )
          ) FILTER (WHERE ii.id IS NOT NULL), '[]'
        ) as items
      FROM invoices i
      JOIN apartments a ON i.apartment_id = a.id
      JOIN buildings b ON a.building_id = b.id
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN fee_types ft ON ii.fee_type_id = ft.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    // Security check: If resident, restrict only to apartments they live in!
    if (user && user.role.toLowerCase() === 'resident') {
      params.push(user.id);
      sql += ` AND i.apartment_id IN (SELECT apartment_id FROM apartment_residents WHERE user_id = $${params.length})`;
    }

    if (apartment_id && apartment_id !== 'all') {
      params.push(apartment_id);
      sql += ` AND i.apartment_id = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }

    if (billing_month && billing_month !== 'all') {
      params.push(billing_month);
      sql += ` AND i.billing_month = $${params.length}`;
    }

    if (billing_year && billing_year !== 'all') {
      params.push(billing_year);
      sql += ` AND i.billing_year = $${params.length}`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      sql += ` AND (a.room_number ILIKE $${params.length} OR b.name ILIKE $${params.length} OR i.notes ILIKE $${params.length})`;
    }

    sql += ` GROUP BY i.id, a.id, b.id ORDER BY i.billing_year DESC, i.billing_month DESC, a.room_number ASC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GetInvoices Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách hóa đơn.' });
  }
};

export const getInvoiceById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    const find = await query(
      `SELECT i.*, a.room_number, a.floor, b.code as building_code, b.name as building_name
       FROM invoices i
       JOIN apartments a ON i.apartment_id = a.id
       JOIN buildings b ON a.building_id = b.id
       WHERE i.id = $1`,
      [id]
    );

    if (find.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' });
      return;
    }

    const invoice = find.rows[0];

    // Security check: If resident, verify they live in this apartment
    if (user && user.role.toLowerCase() === 'resident') {
      const checkResident = await query(
        'SELECT 1 FROM apartment_residents WHERE apartment_id = $1 AND user_id = $2',
        [invoice.apartment_id, user.id]
      );
      if (checkResident.rows.length === 0) {
        res.status(403).json({
          success: false,
          message: 'Bạn không có quyền truy cập thông tin hóa đơn của căn hộ khác.'
        });
        return;
      }
    }

    const items = await query(
      `SELECT ii.*, ft.name as fee_name, ft.unit
       FROM invoice_items ii
       JOIN fee_types ft ON ii.fee_type_id = ft.id
       WHERE ii.invoice_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...invoice,
        items: items.rows
      }
    });
  } catch (error) {
    console.error('[GetInvoiceById Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy chi tiết hóa đơn.' });
  }
};

export const createInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { apartment_id, billing_month, billing_year, due_date, notes, items } = req.body;

    if (!apartment_id || !billing_month || !billing_year || !due_date) {
      res.status(400).json({
        success: false,
        message: 'Căn hộ, tháng, năm và hạn thanh toán là bắt buộc.'
      });
      return;
    }

    // Check duplicate invoice for same apartment and billing period
    const duplicateCheck = await client.query(
      'SELECT id FROM invoices WHERE apartment_id = $1 AND billing_month = $2 AND billing_year = $3',
      [apartment_id, parseInt(billing_month, 10), parseInt(billing_year, 10)]
    );

    if (duplicateCheck.rows.length > 0) {
      res.status(400).json({
        success: false,
        message: `Hóa đơn cho căn hộ này trong kỳ ${billing_month}/${billing_year} đã tồn tại (Mã HĐ: #${duplicateCheck.rows[0].id}). Tránh tạo hóa đơn trùng lặp.`
      });
      return;
    }

    await client.query('BEGIN');

    // Calculate total amount from items if provided
    let totalAmount = 0;
    const validatedItems: { fee_type_id: number; quantity: number; unit_price: number; amount: number; note: string }[] = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unit_price) || 0;
        const amt = qty * price;
        totalAmount += amt;
        validatedItems.push({
          fee_type_id: parseInt(item.fee_type_id, 10),
          quantity: qty,
          unit_price: price,
          amount: amt,
          note: item.note || ''
        });
      }
    } else {
      totalAmount = parseFloat(req.body.total_amount) || 0;
    }

    const invoiceResult = await client.query(
      `INSERT INTO invoices (apartment_id, billing_month, billing_year, total_amount, status, due_date, notes)
       VALUES ($1, $2, $3, $4, 'unpaid', $5, $6) RETURNING *`,
      [apartment_id, parseInt(billing_month, 10), parseInt(billing_year, 10), totalAmount, due_date, notes || null]
    );

    const newInvoice = invoiceResult.rows[0];

    // Insert items
    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, fee_type_id, quantity, unit_price, amount, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newInvoice.id, item.fee_type_id, item.quantity, item.unit_price, item.amount, item.note]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Tạo hóa đơn thành công.',
      data: newInvoice
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CreateInvoice Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo hóa đơn.' });
  } finally {
    client.release();
  }
};

export const confirmPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const find = await query('SELECT id, status, total_amount FROM invoices WHERE id = $1', [id]);
    if (find.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' });
      return;
    }

    if (find.rows[0].status === 'paid') {
      res.status(400).json({ success: false, message: 'Hóa đơn này đã được thanh toán trước đó.' });
      return;
    }

    const result = await query(
      `UPDATE invoices 
       SET status = 'paid', paid_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json({
      success: true,
      message: 'Xác nhận thanh toán hóa đơn thành công.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[ConfirmPayment Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xác nhận thanh toán.' });
  }
};
