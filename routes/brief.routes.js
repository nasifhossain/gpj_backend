const express = require('express');
const { createBrief } = require('../services/brief.services');
const { createBriefFromTemplate } = require('../services/template.services');
const authenticateAdmin = require('../libraries/auth/adminAuth');

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

router.post('/from-template', authenticateAdmin, async (req, res) => {
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

module.exports = router;
