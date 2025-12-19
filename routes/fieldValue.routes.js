const express = require('express');
const { generateAIPromptForSection } = require('../services/fieldValue.services');
const authenticateAdmin = require('../libraries/auth/adminAuth');
const logger = require('../helper/logger.helper');

const router = express.Router();

/**
 * Validate AI generation request input
 */
const validateAIGenerationInput = (data) => {
  const errors = [];
  
  if (!data.sectionId || typeof data.sectionId !== 'string' || data.sectionId.trim().length === 0) {
    errors.push('Section ID is required and must be a non-empty string');
  }
  
  if (!data.s3Key || typeof data.s3Key !== 'string' || data.s3Key.trim().length === 0) {
    errors.push('S3 key is required and must be a non-empty string');
  }
  
  return errors;
};

/**
 * POST /fieldvalue/section/ai
 * Generate AI prompt for a section to extract field values from document
 * 
 * Request Body:
 * {
 *   "sectionId": "uuid-string",
 *   "s3Key": "path/to/document.pdf"
 * }
 */
router.post('/section/ai', authenticateAdmin, async (req, res) => {
  try {
    logger.access(`POST /fieldvalue/section/ai - User: ${req.user?.id}`);
    
    const validationErrors = validateAIGenerationInput(req.body);
    if (validationErrors.length > 0) {
      logger.info(`Validation failed: ${JSON.stringify(validationErrors)}`);
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }
    
    const { sectionId, s3Key } = req.body;
    
    const result = await generateAIPromptForSection(sectionId, s3Key);
    
    if (!result.prompt) {
      logger.info(`No fields with prompts found for section: ${sectionId}`);
      return res.status(200).json({
        message: 'No fields with prompts found in this section',
        sectionName: result.sectionName,
        briefTitle: result.briefTitle,
        totalFields: 0
      });
    }
    
    logger.info(`Successfully generated AI prompt for section: ${sectionId}, fields: ${result.totalFields}`);
    
    res.status(200).json({
      message: 'AI prompt generated successfully',
      data: {
        sectionName: result.sectionName,
        briefTitle: result.briefTitle,
        totalFields: result.totalFields,
        prompt: result.prompt,
        fields: result.fields,
        s3Key: result.s3Key
      }
    });
    
  } catch (error) {
    logger.error(`POST /fieldvalue/section/ai - Error: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      error: error.message || 'Failed to generate AI prompt',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

module.exports = router;
