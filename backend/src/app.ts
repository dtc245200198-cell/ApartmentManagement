import express, { Application, Request, Response } from 'express';
import cors from 'cors';

// Import route handlers
import authRoutes from './routes/auth.routes';
import apartmentRoutes from './routes/apartment.routes';
import residentRoutes from './routes/resident.routes';
import invoiceRoutes from './routes/invoice.routes';
import ticketRoutes from './routes/ticket.routes';
import dashboardRoutes from './routes/dashboard.routes';

const app: Application = express();

// Middlewares
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Apartment Management System API',
    status: 'Running',
    version: '1.0.0',
    phase: 'Full System Implementation'
  });
});

// Health check endpoint (preserved as requested)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'UP',
    service: 'apartment-management-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api', apartmentRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dashboard', dashboardRoutes);

export default app;
