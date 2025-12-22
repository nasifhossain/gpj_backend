const express = require('express');
const { createUser, loginUser, updateUser, getAllUsers } = require('../services/user.services');
const authenticateAdmin = require('../libraries/auth/adminAuth');
const authenticateClient = require('../libraries/auth/clientAuth');
const logger = require('../helper/logger.helper');

const router = express.Router();


router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
})

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await createUser({ name, email, password, role: 'CLIENT' });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
})

router.post('/login', async (req, res) => {
  try {
    const user = await loginUser(req.body.email, req.body.password);
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const user = await updateUser(req.params.id, req.body);
    res.status(200).json(user);
  } catch (err) {
    logger.error('Error in PUT /:id, message: ' + err.message);

    // Return 400 for validation errors, 500 for server errors
    const statusCode = err.message.includes('not found') ||
      err.message.includes('cannot be empty') ||
      err.message.includes('already in use') ||
      err.message.includes('must be at least') ||
      err.message.includes('Invalid role') ||
      err.message.includes('No valid fields') ? 400 : 500;

    res.status(statusCode).json({ error: err.message });
  }
})

router.put('/profile', authenticateClient, async (req, res) => {
  try {
    // Validate that at least one field is provided
    const { name, email, password } = req.body;

    if (!name && !email && !password) {
      return res.status(400).json({ error: 'At least one field (name, email, or password) must be provided' });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (password !== undefined) updateData.password = password;

    const user = await updateUser(req.user.id, updateData);
    res.status(200).json(user);
  } catch (err) {
    logger.error('Error in PUT /profile, message: ' + err.message);

    // Return 400 for validation errors, 500 for server errors
    const statusCode = err.message.includes('not found') ||
      err.message.includes('cannot be empty') ||
      err.message.includes('already in use') ||
      err.message.includes('must be at least') ||
      err.message.includes('No valid fields') ? 400 : 500;

    res.status(statusCode).json({ error: err.message });
  }
})

module.exports = router;
