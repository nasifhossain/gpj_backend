const express = require('express');
const { generateUploadUrl } = require('../services/upload.services');
const authenticateClient = require('../libraries/auth/clientAuth');

const router = express.Router();

router.post('/signed-url', authenticateClient, async (req, res) => {
  try {
    const { key, expiresIn, contentType } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }
    
    const result = await generateUploadUrl({ key, expiresIn, contentType });
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
