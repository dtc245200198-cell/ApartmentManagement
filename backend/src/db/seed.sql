BEGIN;

-- 1. Tòa nhà
INSERT INTO buildings (code, name, total_floors, description)
VALUES
  ('A', 'Tòa nhà A', 10, 'Tòa căn hộ gia đình'),
  ('B', 'Tòa nhà B', 8, 'Tòa căn hộ hiện đại')
ON CONFLICT (code) DO NOTHING;

-- 2. Căn hộ mẫu
INSERT INTO apartments (building_id, room_number, floor, area_sqm, status)
SELECT b.id, v.room_number, v.floor, v.area_sqm, v.status
FROM (VALUES
  ('A', 'A101', 1, 65.00, 'occupied'),
  ('A', 'A102', 1, 72.50, 'occupied'),
  ('A', 'A201', 2, 80.00, 'vacant'),
  ('A', 'A202', 2, 55.00, 'maintenance'),
  ('B', 'B101', 1, 68.00, 'occupied'),
  ('B', 'B201', 2, 90.00, 'vacant'),
  ('B', 'B301', 3, 75.50, 'occupied')
) AS v(building_code, room_number, floor, area_sqm, status)
JOIN buildings b ON b.code = v.building_code
ON CONFLICT (building_id, room_number) DO NOTHING;

-- 3. Các loại phí
INSERT INTO fee_types (name, unit, unit_price, description)
VALUES
  ('Phí quản lý', 'm2/tháng', 8000, 'Phí quản lý theo diện tích'),
  ('Phí gửi xe máy', 'xe/tháng', 100000, 'Phí gửi xe máy'),
  ('Phí vệ sinh', 'căn hộ/tháng', 50000, 'Phí vệ sinh khu vực chung'),
  ('Phí nước', 'm3', 15000, 'Phí sử dụng nước')
ON CONFLICT (name) DO NOTHING;

-- 4. Gắn cư dân mẫu resident1 với căn hộ A101
INSERT INTO apartment_residents
  (user_id, apartment_id, relation, start_date, is_primary_contact)
SELECT u.id, a.id, 'owner', CURRENT_DATE, true
FROM users u
JOIN apartments a ON a.room_number = 'A101'
JOIN buildings b ON b.id = a.building_id AND b.code = 'A'
WHERE u.username = 'resident1'
ON CONFLICT (user_id, apartment_id) DO NOTHING;

-- 5. Tạo hóa đơn mẫu cho tháng hiện tại
INSERT INTO invoices
  (apartment_id, billing_month, billing_year, total_amount, status, due_date, notes)
SELECT
  a.id,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  0,
  'unpaid',
  CURRENT_DATE + 15,
  'Hóa đơn mẫu phục vụ demo'
FROM apartments a
JOIN buildings b ON b.id = a.building_id
WHERE (b.code = 'A' AND a.room_number IN ('A101', 'A102'))
   OR (b.code = 'B' AND a.room_number = 'B101')
ON CONFLICT (apartment_id, billing_month, billing_year) DO NOTHING;

-- 6. Chi tiết hóa đơn
INSERT INTO invoice_items
  (invoice_id, fee_type_id, quantity, unit_price, amount, note)
SELECT i.id, f.id, a.area_sqm, f.unit_price,
       a.area_sqm * f.unit_price, 'Phí quản lý tháng'
FROM invoices i
JOIN apartments a ON a.id = i.apartment_id
JOIN buildings b ON b.id = a.building_id
JOIN fee_types f ON f.name = 'Phí quản lý'
WHERE i.billing_month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
  AND i.billing_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
  AND ((b.code = 'A' AND a.room_number IN ('A101', 'A102'))
    OR (b.code = 'B' AND a.room_number = 'B101'))
ON CONFLICT (invoice_id, fee_type_id) DO NOTHING;

INSERT INTO invoice_items
  (invoice_id, fee_type_id, quantity, unit_price, amount, note)
SELECT i.id, f.id, 1, f.unit_price, f.unit_price, 'Phí vệ sinh tháng'
FROM invoices i
JOIN apartments a ON a.id = i.apartment_id
JOIN buildings b ON b.id = a.building_id
JOIN fee_types f ON f.name = 'Phí vệ sinh'
WHERE i.billing_month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
  AND i.billing_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
  AND ((b.code = 'A' AND a.room_number IN ('A101', 'A102'))
    OR (b.code = 'B' AND a.room_number = 'B101'))
ON CONFLICT (invoice_id, fee_type_id) DO NOTHING;

-- Cập nhật tổng tiền theo chi tiết hóa đơn
UPDATE invoices i
SET total_amount = (
  SELECT COALESCE(SUM(ii.amount), 0)
  FROM invoice_items ii
  WHERE ii.invoice_id = i.id
)
WHERE i.billing_month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
  AND i.billing_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

-- 7. Phản ánh mẫu của cư dân
INSERT INTO complaints (resident_id, apartment_id, title, content, priority, status)
SELECT u.id, a.id, 'Đèn hành lang bị hỏng',
       'Đèn khu vực hành lang tầng 1 không hoạt động, đề nghị kiểm tra.',
       'medium', 'pending'
FROM users u
JOIN apartments a ON a.room_number = 'A101'
JOIN buildings b ON b.id = a.building_id AND b.code = 'A'
WHERE u.username = 'resident1'
  AND NOT EXISTS (
    SELECT 1 FROM complaints c
    WHERE c.resident_id = u.id
      AND c.title = 'Đèn hành lang bị hỏng'
      AND c.apartment_id = a.id
  );

COMMIT;
