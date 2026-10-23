// Automated integration test for Apartment Management System
// Validating 14 mandatory test cases for ADMIN, MANAGER, and RESIDENT roles
const http = require('http');

async function runTests() {
  console.log('--- STARTING 14 MANDATORY RBAC & BUSINESS INTEGRATION TESTS ---');

  const app = require('./dist/app.js').default;
  const server = http.createServer(app);

  const PORT = 5089;
  await new Promise((resolve) => server.listen(PORT, resolve));
  const BASE_URL = `http://localhost:${PORT}/api`;

  let passCount = 0;
  let failCount = 0;

  async function test(testNum, name, fn) {
    try {
      await fn();
      console.log(`[PASS] Test ${testNum}: ${name}`);
      passCount++;
    } catch (e) {
      console.error(`[FAIL] Test ${testNum}: ${name} ->`, e.message);
      failCount++;
    }
  }

  let adminToken = '';
  let managerToken = '';
  let residentToken = '';

  try {
    // Test 14: Health check & legacy endpoints
    await test(14, 'Legacy functions & health check API /api/health remain operational', async () => {
      const res = await fetch(`${BASE_URL}/health`).then((r) => r.json());
      if (res.status !== 'UP' || res.service !== 'apartment-management-backend') {
        throw new Error('Health check returned invalid response: ' + JSON.stringify(res));
      }
    });

    // Test 1: Admin login & access admin functions
    await test(1, 'Admin login & access administration endpoints', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      }).then((r) => r.json());
      if (!res.success || !res.data.token || res.data.user.role !== 'admin') {
        throw new Error('Admin login failed: ' + res.message);
      }
      adminToken = res.data.token;

      // Access admin user list
      const usersRes = await fetch(`${BASE_URL}/auth/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (usersRes.status !== 200) {
        throw new Error(`Admin failed to access /auth/users, status: ${usersRes.status}`);
      }
    });

    // Test 2: Manager login & authorized operations
    await test(2, 'Manager login & authorized operational tasks', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'manager', password: 'manager123' }),
      }).then((r) => r.json());
      if (!res.success || !res.data.token || res.data.user.role !== 'manager') {
        throw new Error('Manager login failed: ' + res.message);
      }
      managerToken = res.data.token;

      // Manager can view apartments
      const aptsRes = await fetch(`${BASE_URL}/apartments`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      if (aptsRes.status !== 200) {
        throw new Error('Manager could not view apartments');
      }
    });

    // Test 3: Resident login & personal dashboard
    await test(3, 'Resident login & personal dashboard summary', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'resident1', password: 'resident123' }),
      }).then((r) => r.json());
      if (!res.success || !res.data.token || res.data.user.role !== 'resident') {
        throw new Error('Resident login failed: ' + res.message);
      }
      residentToken = res.data.token;

      // Personal dashboard
      const dashRes = await fetch(`${BASE_URL}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${residentToken}` },
      }).then((r) => r.json());
      if (!dashRes.success || !dashRes.data.residentMode) {
        throw new Error('Resident dashboard did not return scoped residentMode data');
      }
    });

    // Test 4: Resident cannot create or delete apartments
    await test(4, 'RBAC: Resident cannot create or delete apartments (403 Forbidden)', async () => {
      const createRes = await fetch(`${BASE_URL}/apartments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${residentToken}`,
        },
        body: JSON.stringify({ building_id: 1, room_number: 'HACK-1', floor: 1, area_sqm: 60 }),
      });
      if (createRes.status !== 403) {
        throw new Error(`Expected 403 on create apartment, got ${createRes.status}`);
      }

      const deleteRes = await fetch(`${BASE_URL}/apartments/1`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${residentToken}` },
      });
      if (deleteRes.status !== 403) {
        throw new Error(`Expected 403 on delete apartment, got ${deleteRes.status}`);
      }
    });

    // Test 5: Resident cannot create invoices or confirm payment
    await test(5, 'RBAC: Resident cannot create invoices or confirm payment (403 Forbidden)', async () => {
      const createRes = await fetch(`${BASE_URL}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${residentToken}`,
        },
        body: JSON.stringify({ apartment_id: 1, billing_month: 11, billing_year: 2026, due_date: '2026-11-20' }),
      });
      if (createRes.status !== 403) {
        throw new Error(`Expected 403 on create invoice, got ${createRes.status}`);
      }

      const payRes = await fetch(`${BASE_URL}/invoices/1/pay`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${residentToken}` },
      });
      if (payRes.status !== 403) {
        throw new Error(`Expected 403 on confirm payment, got ${payRes.status}`);
      }
    });

    // Test 6: Resident cannot view invoice of another apartment by ID
    await test(6, 'Security: Resident cannot view invoice of another apartment by URL/ID parameter (403 Forbidden)', async () => {
      // Find or create an invoice for an apartment that resident1 does not reside in
      // resident1 lives in apartment 1. Let's create an invoice for apartment 2 if not exists
      let foreignInvoiceId = null;
      const allInvoices = await fetch(`${BASE_URL}/invoices`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((r) => r.json());

      const foreignInv = allInvoices.data.find((inv) => inv.apartment_id !== 1);
      if (foreignInv) {
        foreignInvoiceId = foreignInv.id;
      } else {
        // Create an invoice for apartment 2
        const createInv = await fetch(`${BASE_URL}/invoices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            apartment_id: 2,
            billing_month: 12,
            billing_year: 2026,
            due_date: '2026-12-25',
            total_amount: 500000,
          }),
        }).then((r) => r.json());
        foreignInvoiceId = createInv.data.id;
      }

      // Now resident1 attempts to fetch this foreign invoice
      const res = await fetch(`${BASE_URL}/invoices/${foreignInvoiceId}`, {
        headers: { Authorization: `Bearer ${residentToken}` },
      });

      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden for foreign invoice access, got ${res.status}`);
      }
    });

    // Test 7: Resident cannot view or modify tickets of another resident
    await test(7, 'Security: Resident cannot view or modify tickets of another resident (403 Forbidden)', async () => {
      // Create a ticket by admin/manager on behalf of another user or find one
      const ticketRes = await fetch(`${BASE_URL}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: 'Sự cố quản trị viên',
          content: 'Kiểm tra đường truyền internet BQL',
          priority: 'low',
        }),
      }).then((r) => r.json());
      const adminTicketId = ticketRes.data.id;

      // Resident attempts to view admin's ticket
      const viewRes = await fetch(`${BASE_URL}/tickets/${adminTicketId}`, {
        headers: { Authorization: `Bearer ${residentToken}` },
      });
      if (viewRes.status !== 403) {
        throw new Error(`Expected 403 when viewing another user's ticket, got ${viewRes.status}`);
      }

      // Resident attempts to update ticket status
      const editRes = await fetch(`${BASE_URL}/tickets/${adminTicketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${residentToken}`,
        },
        body: JSON.stringify({ status: 'resolved' }),
      });
      if (editRes.status !== 403) {
        throw new Error(`Expected 403 when updating ticket status, got ${editRes.status}`);
      }
    });

    // Test 8: Manager cannot grant ADMIN role
    await test(8, 'RBAC: Manager cannot grant ADMIN role (403 Forbidden)', async () => {
      const res = await fetch(`${BASE_URL}/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${managerToken}`,
        },
        body: JSON.stringify({
          username: `illegal_admin_${Date.now()}`,
          password: 'password123',
          full_name: 'Hacked Admin',
          role: 'admin',
        }),
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 when Manager creates user/admin, got ${res.status}`);
      }
    });

    // Test 9: Request without JWT is rejected (401 Unauthorized)
    await test(9, 'Security: Request without JWT token is rejected (401 Unauthorized)', async () => {
      const res = await fetch(`${BASE_URL}/apartments`);
      if (res.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
      }
    });

    // Test 10: Invalid or expired JWT is rejected (403 Forbidden)
    await test(10, 'Security: Invalid or expired JWT token is rejected (403 Forbidden)', async () => {
      const res = await fetch(`${BASE_URL}/apartments`, {
        headers: { Authorization: 'Bearer this_is_a_completely_fake_and_invalid_jwt_token' },
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden for bad JWT, got ${res.status}`);
      }
    });

    // Test 11: Data Integrity: Cannot delete occupied apartment with resident
    await test(11, 'Data Integrity: Cannot delete occupied apartment with resident records', async () => {
      const res = await fetch(`${BASE_URL}/apartments/1`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.status !== 400 || !data.message.includes('cư dân cư trú')) {
        throw new Error(`Expected 400 with integrity message, got: ${res.status} - ${data.message}`);
      }
    });

    // Test 12: Cannot create duplicate invoice for same apartment and period
    await test(12, 'Business Logic: Cannot create duplicate invoice for same apartment & period', async () => {
      // First ensure month 10 / year 2026 invoice exists for apartment 1
      const res = await fetch(`${BASE_URL}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          apartment_id: 1,
          billing_month: 10,
          billing_year: 2026,
          due_date: '2026-10-30',
          total_amount: 1000000,
        }),
      });
      const data = await res.json();
      if (res.status !== 400 || !data.message.includes('đã tồn tại')) {
        throw new Error(`Expected 400 duplicate invoice message, got: ${res.status} - ${data.message}`);
      }
    });

    // Test 13: Dashboard returns real aggregated data from PostgreSQL
    await test(13, 'Analytics: Dashboard returns real database aggregation metrics', async () => {
      const res = await fetch(`${BASE_URL}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((r) => r.json());
      if (
        !res.success ||
        typeof res.data.buildings.total !== 'number' ||
        typeof res.data.apartments.total !== 'number' ||
        typeof res.data.finance.totalDebt !== 'string'
      ) {
        throw new Error('Dashboard stats did not return valid aggregated schema');
      }
    });
  } finally {
    server.close();
    console.log(`\n======================================================`);
    console.log(`TEST SUMMARY: ${passCount}/14 PASSED, ${failCount} FAILED`);
    console.log(`======================================================`);
    process.exit(failCount === 0 ? 0 : 1);
  }
}

runTests();
