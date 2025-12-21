const express = require('express');
const { createBrief, getBriefById } = require('../services/brief.services');
const { createBriefFromTemplate, getAllTemplates, getTemplateById, getAllTemplatesPreview } = require('../services/template.services');
const authenticateAdmin = require('../libraries/auth/adminAuth');
const authenticateClient = require('../libraries/auth/clientAuth');
const logger = require('../helper/logger.helper');

const router = express.Router();

const validateBriefInput = (data) => {
  const errors = [];
  
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Title is required and must be a non-empty string');
  }
  
  if (!data.templateName || typeof data.templateName !== 'string' || data.templateName.trim().length === 0) {
    errors.push('Template name is required and must be a non-empty string');
  }
  
  if (data.title && data.title.length > 255) {
    errors.push('Title must not exceed 255 characters');
  }
  
  if (data.templateName && data.templateName.length > 255) {
    errors.push('Template name must not exceed 255 characters');
  }
  
  return errors;
};

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const validationErrors = validateBriefInput(req.body);
    
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors.join(', ') });
    }
    
    const sanitizedData = {
      title: req.body.title.trim(),
      templateName: req.body.templateName.trim()
    };
    
    const brief = await createBrief(sanitizedData, req.user.id);
    res.status(201).json(brief);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/from-template', authenticateClient, async (req, res) => {
  try {
    const  template = req.body;
    const title = template.title || 'New Brief';
    if (!template || typeof template !== 'object') {
      return res.status(400).json({ error: 'Template object is required' });
    }
    
    if (!template.templateName || typeof template.templateName !== 'string') {
      return res.status(400).json({ error: 'Template name is required' });
    }
    
    if (!Array.isArray(template.sections) || template.sections.length === 0) {
      return res.status(400).json({ error: 'Template must have at least one section' });
    }
    
    const brief = await createBriefFromTemplate(template, req.user.id, title);
    res.status(201).json(brief);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});




router.get('/templates', async (req, res) => {
  try {
    const templates = await getAllTemplates();
    res.status(200).json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


/**
 * Templates Preview
 */
router.get('/templates/preview', async (req, res) => {
  try {
    const templates = await getAllTemplatesPreview();
    res.status(200).json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /briefs/templates/:id
 * Get a specific template by ID with user's saved field values
 */
router.get('/templates/:id', authenticateClient, async (req, res) => {
  try {
    logger.access(`GET /briefs/templates/${req.params.id} - User: ${req.user?.id}`);
    
    const { id } = req.params;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Valid template ID is required' });
    }
    
    const template = await getTemplateById(id, req.user.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    logger.info(`Successfully retrieved template: ${id} for user: ${req.user.id}`);
    
    res.status(200).json({
      message: 'Template retrieved successfully',
      data: template
    });
    
  } catch (error) {
    logger.error(`GET /briefs/templates/:id - Error: ${error.message}`);
    
    res.status(500).json({
      error: error.message || 'Failed to retrieve template'
    });
  }
});


router.get('/templates/:id/user/:userId', authenticateAdmin, async (req, res) => {
  try {
 
    
    const { id, userId } = req.params;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Valid template ID is required' });
    }
    
    const template = await getTemplateById(id, userId);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    logger.info(`Successfully retrieved template: ${id} for user: ${userId}`);
    
    res.status(200).json({
      message: 'Template retrieved successfully',
      data: template
    });
    
  } catch (error) {
    logger.error(`GET /briefs/templates/:id - Error: ${error.message}`);
    
    res.status(500).json({
      error: error.message || 'Failed to retrieve template'
    });
  }
});

/**
 * GET /briefs/:id
 * Get a brief by ID with all sections, fields, and field values
 */
router.get('/:id', authenticateClient, async (req, res) => {
  try {
    logger.access(`GET /briefs/${req.params.id} - User: ${req.user?.id}`);
    
    const { id } = req.params;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Valid brief ID is required' });
    }
    
    const brief = await getBriefById(id, req.user.id);
    
    logger.info(`Successfully retrieved brief: ${id}`);
    
    res.status(200).json({
      message: 'Brief retrieved successfully',
      data: brief
    });
    
  } catch (error) {
    logger.error(`GET /briefs/:id - Error: ${error.message}`);
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      error: error.message || 'Failed to retrieve brief'
    });
  }
});

module.exports = router;
