const express = require('express');
const { createSection, createMultipleSections } = require('../services/section.services');
const authenticateAdmin = require('../libraries/auth/adminAuth');

const router = express.Router();

const validateSectionInput = (data) => {
  const errors = [];
  
  if (!data.briefId || typeof data.briefId !== 'string' || data.briefId.trim().length === 0) {
    errors.push('Brief ID is required and must be a non-empty string');
  }
  
  if (!data.sectionName || typeof data.sectionName !== 'string' || data.sectionName.trim().length === 0) {
    errors.push('Section name is required and must be a non-empty string');
  }
  
  if (data.orderIndex === undefined || data.orderIndex === null) {
    errors.push('Order index is required');
  }
  
  if (typeof data.orderIndex !== 'number' || !Number.isInteger(data.orderIndex)) {
    errors.push('Order index must be an integer');
  }
  
  if (data.orderIndex < 0) {
    errors.push('Order index must be a non-negative integer');
  }
  
  if (data.sectionName && data.sectionName.length > 255) {
    errors.push('Section name must not exceed 255 characters');
  }
  
  return errors;
};

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const validationErrors = validateSectionInput(req.body);
    
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors.join(', ') });
    }
    
    const sanitizedData = {
      briefId: req.body.briefId.trim(),
      sectionName: req.body.sectionName.trim(),
      orderIndex: req.body.orderIndex
    };
    
    const section = await createSection(sanitizedData);
    res.status(201).json(section);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bulk', authenticateAdmin, async (req, res) => {
  try {
    const { briefId, sections } = req.body;
    
    if (!briefId || typeof briefId !== 'string' || briefId.trim().length === 0) {
      return res.status(400).json({ error: 'Brief ID is required and must be a non-empty string' });
    }
    
    if (!Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ error: 'Sections must be a non-empty array' });
    }
    
    const allErrors = [];
    sections.forEach((section, index) => {
      if (!section.sectionName || typeof section.sectionName !== 'string' || section.sectionName.trim().length === 0) {
        allErrors.push(`Section ${index + 1}: Section name is required and must be a non-empty string`);
      }
      
      if (section.sectionName && section.sectionName.length > 255) {
        allErrors.push(`Section ${index + 1}: Section name must not exceed 255 characters`);
      }
    });
    
    if (allErrors.length > 0) {
      return res.status(400).json({ error: allErrors.join(', ') });
    }
    
    const sanitizedSections = sections.map(section => ({
      sectionName: section.sectionName.trim()
    }));
    
    const createdSections = await createMultipleSections(briefId.trim(), sanitizedSections);
    res.status(201).json(createdSections);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
