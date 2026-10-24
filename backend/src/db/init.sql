-- ==========================================
-- Apartment Management System - Database Init
-- Compatible with PostgreSQL 14+
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (LOWER(role) IN ('admin', 'manager', 'resident'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Buildings
CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    total_floors INTEGER NOT NULL DEFAULT 1 CHECK (total_floors > 0),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_buildings_code ON buildings(code);

-- 3. Apartments
CREATE TABLE IF NOT EXISTS apartments (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
    room_number VARCHAR(20) NOT NULL,
    floor INTEGER NOT NULL CHECK (floor > 0),
    area_sqm NUMERIC(6,2) NOT NULL CHECK (area_sqm > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'maintenance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_building_room UNIQUE (building_id, room_number)
);

CREATE INDEX IF NOT EXISTS idx_apartments_building ON apartments(building_id);
CREATE INDEX IF NOT EXISTS idx_apartments_room ON apartments(room_number);

-- 4. Apartment Residents
CREATE TABLE IF NOT EXISTS apartment_residents (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    relation VARCHAR(20) NOT NULL DEFAULT 'resident' CHECK (relation IN ('owner', 'tenant', 'family_member', 'resident')),
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    is_primary_contact BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_apartment UNIQUE (user_id, apartment_id)
);

CREATE INDEX IF NOT EXISTS idx_apt_res_user ON apartment_residents(user_id);
CREATE INDEX IF NOT EXISTS idx_apt_res_apt ON apartment_residents(apartment_id);

-- 5. Fee Types
CREATE TABLE IF NOT EXISTS fee_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE RESTRICT,
    billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
    billing_year INTEGER NOT NULL CHECK (billing_year >= 2020),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue')),
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_apartment_month_year UNIQUE (apartment_id, billing_month, billing_year)
);

CREATE INDEX IF NOT EXISTS idx_invoices_apartment ON invoices(apartment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- 7. Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    fee_type_id INTEGER NOT NULL REFERENCES fee_types(id) ON DELETE RESTRICT,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00 CHECK (quantity >= 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    note VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_invoice_feetype UNIQUE (invoice_id, fee_type_id)
);

-- 8. Complaints / Maintenance Requests
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'resolved', 'rejected')),
    admin_response TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_complaints_resident ON complaints(resident_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
