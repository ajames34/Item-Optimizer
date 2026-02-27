'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { clerkMiddleware } = require('@clerk/express');
const { isPg, close: closeDb } = require('./db/client');

const inventoryRoutes = require('./routes/inventory');
const salesRoutes = require('./routes/sales');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';

// ── CORS ────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
}));

app.use(express.json());

// ── Clerk JWT verification (runs on every request) ──────────────
// Decodes and verifies the Bearer token from the Authorization header.
// Does NOT block unauthenticated requests here — individual routes
// call requireAuth() to enforce authentication.
app.use(clerkMiddleware());

// ── API Routes ──────────────────────────────────────────────────
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check (public)
app.get('/api/health', (_req, res) =>
    res.json({
        status: 'OK',
        env: process.env.NODE_ENV || 'development',
        db: isPg ? 'postgresql' : 'sqlite',
        timestamp: new Date().toISOString(),
    })
);

// ── Static Frontend (production only) ──────────────────────────
if (isProd) {
    const distPath = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── Error handlers ──────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    if (!isProd) console.error(err.stack);
    res.status(500).json({ error: isProd ? 'Internal server error' : err.message });
});

// ── Start ───────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log(`🚀 API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`   DB engine:       ${isPg ? 'PostgreSQL' : 'SQLite (local)'}`);
    console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`);
    console.log(`   Clerk auth:      ${process.env.CLERK_SECRET_KEY ? '✅ enabled' : '⚠️  CLERK_SECRET_KEY not set'}`);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM — shutting down …');
    server.close(async () => { await closeDb(); process.exit(0); });
});
