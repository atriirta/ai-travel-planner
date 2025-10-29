// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); // Ensure path is required

// Import Routers
const llmRoutes = require('./routes/llm');
const voiceRoutes = require('./routes/voice');
const plansRoutes = require('./routes/plans');
const expensesRoutes = require('./routes/expenses');

const app = express();
const port = process.env.PORT || 3001;

// --- Core Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health Check Route ---
app.get('/', (req, res) => {
  res.send(`AI Travel Planner Backend Started!`);
});

// --- API Routes ---
app.use('/api/llm', llmRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/expenses', expensesRoutes);

// --- Static File Serving ---
app.use(express.static(path.join(__dirname, 'public')));

// --- SPA Fallback Middleware (MUST BE LAST HANDLER BEFORE LISTEN) ---
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else if (!req.path.startsWith('/api/')) {
    // Handle non-GET, non-API requests if necessary, or just send 404
    res.status(404).send('Not Found');
  } else {
    // If it starts with /api/ but wasn't handled, it's an API 404
    // It might be better handled within specific routers or an error handler
    // but this catch-all can send a generic API 404.
    // Let's rely on the previous routes to handle API 404s and just call next()
     next();
     // Or send a specific message:
     // res.status(404).send('API endpoint not found');
  }
});

// --- Server Listen ---
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});