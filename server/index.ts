import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import authRoutes from './routes/auth.js';
import emailRoutes from './routes/emails.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Validate PORT - don't use privileged ports (80, 443, etc.)
const portNumber = parseInt(PORT.toString(), 10);
if (portNumber < 1024 && portNumber !== 0) {
  console.error(`Error: Port ${PORT} is a privileged port and requires admin privileges.`);
  console.error(`Fix: Set PORT=3001 in your .env file or remove PORT to use default.`);
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Request logging middleware - removed verbose logging

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mailautomation API is running' });
});

// 404 handler for API routes that don't match (must come before catch-all)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found', path: req.path });
});

// Serve static files from the dist folder (production build)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all handler: serve index.html for all non-API routes (for SPA routing)
app.get('*', (req, res) => {
  // Only serve index.html if dist folder exists (production build)
  const indexPath = path.join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // In development, just return a message
    res.json({ 
      message: 'MailMind API Server',
      note: 'In development, run the Vite dev server separately (npm run dev)',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth/login',
        emails: '/api/emails'
      }
    });
  }
});

// Error handling middleware - must be last
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  // Only send response if headers haven't been sent
  if (!res.headersSent) {
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message || 'An unexpected error occurred'
    });
  } else {
    // If headers already sent, log the error
    console.error('Error after response headers sent:', err);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

