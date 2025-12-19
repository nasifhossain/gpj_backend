const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/user.routes');
const briefRoutes = require('./routes/brief.routes');
const sectionRoutes = require('./routes/section.routes');
const fieldRoutes = require('./routes/field.routes');
const fieldValueRoutes = require('./routes/fieldValue.routes');
const uploadRoutes = require('./routes/upload.routes');
const logger = require('./helper/logger.helper');

const app = express();
const PORT = process.env.PORT || 8000;
app.use(cors());
app.use(express.json());

// Health check endpoint (no DB queries for fast response)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Sample route
app.get('/', async (req, res) => {
  const prisma = require('./config/prisma.client').prisma;
  const users = await prisma.user.count();
  logger.access(`GET / - Users count: ${users}`);
  res.send('Hello World!, Users: ' + JSON.stringify(users));
});

// Routes
app.use('/users', userRoutes);
app.use('/briefs', briefRoutes);
app.use('/sections', sectionRoutes);
app.use('/fields', fieldRoutes);
app.use('/fieldvalue', fieldValueRoutes);
app.use('/upload', uploadRoutes);

// Start the server
app.listen(PORT, () => {
  const message = `Server is running on port ${PORT}`;
  console.log(message);
  logger.info(message);
});