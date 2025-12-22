const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/user.routes');
const briefRoutes = require('./routes/brief.routes');
const sectionRoutes = require('./routes/section.routes');
const fieldRoutes = require('./routes/field.routes');
const fieldValueRoutes = require('./routes/fieldValue.routes');
const uploadRoutes = require('./routes/upload.routes');
const downloadRoutes = require('./routes/download.routes');
const logger = require('./helper/logger.helper');

const app = express();
const PORT = process.env.PORT || 8000;
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Health check endpoint (no DB queries for fast response)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Root route - serves the landing page
app.get('/', async (req, res) => {
  const prisma = require('./config/prisma.client').prisma;
  const users = await prisma.user.count();
  logger.access(`GET / - Users count: ${users}`);

  // Send the HTML file
  res.sendFile(__dirname + '/public/index.html');
});

// Routes
app.use('/users', userRoutes);
app.use('/briefs', briefRoutes);
app.use('/sections', sectionRoutes);
app.use('/fields', fieldRoutes);
app.use('/fieldvalue', fieldValueRoutes);
app.use('/upload', uploadRoutes);
app.use('/download', downloadRoutes);

// Start the server
app.listen(PORT, () => {
  const message = `Server is running on port ${PORT}`;
  console.log(message);
  logger.info(message);
});