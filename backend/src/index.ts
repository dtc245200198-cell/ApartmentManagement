import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { runMigrations } from './db/migrate';

const PORT = process.env.PORT || 5000;

// Verify migrations and then listen
runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Backend] Apartment Management API is running on http://localhost:${PORT}`);
      console.log(`[Backend] Health check available at http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error('[Backend Init Failed]:', err);
    // Still start app even if migration encounters an issue
    app.listen(PORT, () => {
      console.log(`[Backend] Apartment Management API running on http://localhost:${PORT}`);
    });
  });
