const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware with CSP configured for external scripts
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://servicodados.ibge.gov.br"]
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Self-ping para manter o serviço acordado (evita hibernação no Render)
if (process.env.NODE_ENV === 'production') {
    const PING_INTERVAL = 14 * 60 * 1000; // 14 minutos (Render hiberna após 15)
    const PING_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || 'https://unificador-media-pro.onrender.com';

    setInterval(async () => {
        try {
            const url = `${PING_URL}/api/health`;
            const response = await fetch(url);
            if (response.ok) {
                console.log(`[Self-ping] OK - ${new Date().toISOString()}`);
            }
        } catch (error) {
            console.log(`[Self-ping] Erro: ${error.message}`);
        }
    }, PING_INTERVAL);

    console.log(`[Self-ping] Ativado - intervalo de 14 minutos - ${PING_URL}`);
}

// API routes
app.use('/api', routes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    // Serve static files from root (where index.html, quest.html, css/, js/ are)
    app.use(express.static(path.join(__dirname, '../..')));

    // Fallback to index.html for non-API routes
    app.get('*', (req, res, next) => {
        // Skip API routes
        if (req.path.startsWith('/api')) {
            return next();
        }
        res.sendFile(path.join(__dirname, '../../index.html'));
    });
}

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
