const express = require('express');
const userRoutes = require('./routes/user.routes');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// Sample route
app.get('/', async (req, res) => {
  const prisma = require('./config/prisma.client').prisma;
  const users = await prisma.user.count();
  res.send('Hello World!, Users: ' + JSON.stringify(users));
});

// Routes
app.use('/users', userRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});