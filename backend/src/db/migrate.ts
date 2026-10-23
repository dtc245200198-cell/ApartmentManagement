import { pool } from '../config/db';
import bcrypt from 'bcryptjs';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    // 1. Ensure role check allows 'admin', 'manager', 'resident' (case-insensitive)
    await client.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (LOWER(role) IN ('admin', 'manager', 'resident'));
    `);

    // 2. Add apartment_id and priority to complaints table if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='complaints' AND column_name='apartment_id'
        ) THEN
          ALTER TABLE complaints ADD COLUMN apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='complaints' AND column_name='priority'
        ) THEN
          ALTER TABLE complaints ADD COLUMN priority VARCHAR(20) DEFAULT 'medium';
        END IF;
      END $$;
    `);

    // 3. Ensure default test accounts have correct display names (preserving existing passwords)
    const checkAdmin = await client.query("SELECT id FROM users WHERE username = 'admin'");
    if (checkAdmin.rows.length === 0) {
      const adminHash = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO users (username, password_hash, full_name, email, phone, role, is_active)
        VALUES ('admin', $1, 'admin', 'admin@chungcu.vn', '0901234567', 'admin', true)
      `, [adminHash]);
    } else {
      await client.query("UPDATE users SET full_name = 'admin' WHERE username = 'admin'");
    }

    const checkManager = await client.query("SELECT id FROM users WHERE username = 'manager'");
    if (checkManager.rows.length === 0) {
      const managerHash = await bcrypt.hash('manager123', 10);
      await client.query(`
        INSERT INTO users (username, password_hash, full_name, email, phone, role, is_active)
        VALUES ('manager', $1, 'Ban quản lý', 'manager@chungcu.vn', '0912345678', 'manager', true)
      `, [managerHash]);
    } else {
      await client.query("UPDATE users SET full_name = 'Ban quản lý' WHERE username = 'manager'");
    }

    const checkResident1 = await client.query("SELECT id FROM users WHERE username = 'resident1'");
    if (checkResident1.rows.length === 0) {
      const residentHash = await bcrypt.hash('resident123', 10);
      await client.query(`
        INSERT INTO users (username, password_hash, full_name, email, phone, role, is_active)
        VALUES ('resident1', $1, 'Nguyễn Thanh An', 'an.nguyen@chungcu.vn', '0987654321', 'resident', true)
      `, [residentHash]);
    } else {
      await client.query("UPDATE users SET full_name = 'Nguyễn Thanh An' WHERE username = 'resident1'");
    }

    console.log('[Migration] Database schema and constraints verified (preserving existing passwords).');
  } catch (err) {
    console.error('[Migration Error]:', err);
  } finally {
    client.release();
  }
}
