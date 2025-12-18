const express = require('express');
const { createField, createMultipleFields } = require('../services/field.services');
const authenticateAdmin = require('../libraries/auth/adminAuth');

const router = express.Router();

const validateFieldInput = (data) => {
  const errors = [];
  
  if (!data.sectionId || typeof data.sectionId !== 'string' || data.sectionId.trim().length === 0) {
    errors.push('Section ID is required and must be a non-empty string');
  }
  
  if (!data.fieldKey || typeof data.fieldKey !== 'string' || data.fieldKey.trim().length === 0) {
    errors.push('Field key is required and must be a non-empty string');
  }
  
  if (!data.label || typeof data.label !== 'string' || data.label.trim().length === 0) {
    errors.push('Label is required and must be a non-empty string');
  }
  
  if (!data.dataType || typeof data.dataType !== 'string' || data.dataType.trim().length === 0) {
    errors.push('Data type is required and must be a non-empty string');
  }
  
  if (!data.fieldType || typeof data.fieldType !== 'string' || data.fieldType.trim().length === 0) {
    errors.push('Field type is required and must be a non-empty string');
  }
  
  if (data.options !== undefined && data.options !== null && typeof data.options !== 'object') {
    errors.push('Options must be a valid JSON object');
  }
  
  if (data.prompt !== undefined && data.prompt !== null && typeof data.prompt !== 'string') {
    errors.push('Prompt must be a string');
  }
  
  return errors;
};

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const validationErrors = validateFieldInput(req.body);
    
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors.join(', ') });
    }
    
    const sanitizedData = {
      sectionId: req.body.sectionId.trim(),
      fieldKey: req.body.fieldKey.trim(),
      label: req.body.label.trim(),
      dataType: req.body.dataType.trim(),
      fieldType: req.body.fieldType.trim(),
      options: req.body.options || null,
      prompt: req.body.prompt ? req.body.prompt.trim() : null
    };
    
    const field = await createField(sanitizedData);
    res.status(201).json(field);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bulk', authenticateAdmin, async (req, res) => {
  try {
    const { sectionId, fields } = req.body;
    
    if (!sectionId || typeof sectionId !== 'string' || sectionId.trim().length === 0) {
      return res.status(400).json({ error: 'Section ID is required and must be a non-empty string' });
    }
    
    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ error: 'Fields must be a non-empty array' });
    }
    
    const allErrors = [];
    fields.forEach((field, index) => {
      if (!field.fieldKey || typeof field.fieldKey !== 'string' || field.fieldKey.trim().length === 0) {
        allErrors.push(`Field ${index + 1}: Field key is required and must be a non-empty string`);
      }
      
      if (!field.label || typeof field.label !== 'string' || field.label.trim().length === 0) {
        allErrors.push(`Field ${index + 1}: Label is required and must be a non-empty string`);
      }
      
      if (!field.dataType || typeof field.dataType !== 'string' || field.dataType.trim().length === 0) {
        allErrors.push(`Field ${index + 1}: Data type is required and must be a non-empty string`);
      }
      
      if (!field.fieldType || typeof field.fieldType !== 'string' || field.fieldType.trim().length === 0) {
        allErrors.push(`Field ${index + 1}: Field type is required and must be a non-empty string`);
      }
      
      if (field.options !== undefined && field.options !== null && typeof field.options !== 'object') {
        allErrors.push(`Field ${index + 1}: Options must be a valid JSON object`);
      }
      
      if (field.prompt !== undefined && field.prompt !== null && typeof field.prompt !== 'string') {
        allErrors.push(`Field ${index + 1}: Prompt must be a string`);
      }
    });
    
    if (allErrors.length > 0) {
      return res.status(400).json({ error: allErrors.join(', ') });
    }
    
    const sanitizedFields = fields.map(field => ({
      fieldKey: field.fieldKey.trim(),
      label: field.label.trim(),
      dataType: field.dataType.trim(),
      fieldType: field.fieldType.trim(),
      options: field.options || null,
      prompt: field.prompt ? field.prompt.trim() : null
    }));
    
    const createdFields = await createMultipleFields(sectionId.trim(), sanitizedFields);
    res.status(201).json(createdFields);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
