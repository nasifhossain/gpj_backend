const express = require('express');
const { generateUploadUrl, saveDocument } = require('../services/upload.services');
const authenticateClient = require('../libraries/auth/clientAuth');
const logger = require('../helper/logger.helper');

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

router.post('/confirm', authenticateClient, async (req, res) => {
  try {
    logger.access(`POST /upload/confirm - User: ${req.user?.userId}`);
    
    const { briefId, fileName, fileType, s3Key } = req.body;
    
    // Validate required fields
    const missingFields = [];
    if (!briefId) missingFields.push('briefId');
    if (!fileName) missingFields.push('fileName');
    if (!fileType) missingFields.push('fileType');
    if (!s3Key) missingFields.push('s3Key');
    
    if (missingFields.length > 0) {
      logger.info(`Missing required fields: ${missingFields.join(', ')}`);
      return res.status(400).json({
        error: 'Validation failed',
        details: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    logger.info('user details:', req.user);
    const document = await saveDocument({
      briefId,
      fileName,
      fileType,
      s3Key,
      userId: req.user.id
    });
    
    logger.info(`Document confirmed and saved: ${document.id}`);
    
    res.status(201).json({
      message: 'Document uploaded and saved successfully',
      data: document
    });
    
  } catch (error) {
    logger.error(`POST /upload/confirm - Error: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      error: error.message || 'Failed to save document',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

module.exports = router;
