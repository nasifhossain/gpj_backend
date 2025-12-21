const S3 = require('../libraries/s3/s3.lib.js');
const prisma = require('../config/prisma.client').prisma;
const logger = require('../helper/logger.helper');
const { randomUUID } = require('crypto');

const s3Instance = new S3();

const generateUploadUrl = async ({ key, expiresIn, contentType }) => {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('Key is required and must be a non-empty string');
  }

  const sanitizedKey = key.trim();
  
  // Extract filename and extension
  const lastDotIndex = sanitizedKey.lastIndexOf('.');
  const filename = lastDotIndex !== -1 ? sanitizedKey.substring(0, lastDotIndex) : sanitizedKey;
  const extension = lastDotIndex !== -1 ? sanitizedKey.substring(lastDotIndex + 1) : '';
  
  // Generate UUID
  const uuid = randomUUID();
  
  // Create key with format: filename_uuid.extension
  const keyWithUUID = extension ? `${filename}_${uuid}.${extension}` : `${filename}_${uuid}`;
  
  const expiration = expiresIn || 3600;
  
  const signedUrl = await s3Instance.generateUploadSignedUrl(
    keyWithUUID, 
    expiration, 
    contentType
  );
  
  return {
    url: signedUrl,
    key: keyWithUUID,
    originalKey: sanitizedKey,
    expiresIn: expiration,
    bucket: s3Instance.getBucket()
  };
};

const saveDocument = async ({ briefId, fileName, fileType, s3Key, sectionId, userId }) => {
  // Validate inputs
  if (!briefId || typeof briefId !== 'string') {
    throw new Error('Brief ID is required and must be a string');
  }
  
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('File name is required and must be a string');
  }
  
  if (!s3Key || typeof s3Key !== 'string') {
    throw new Error('S3 key is required and must be a string');
  }
  
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required and must be a string');
  }
  
  // Validate sectionId if provided (optional)
  if (sectionId !== undefined && sectionId !== null) {
    if (typeof sectionId !== 'string' || sectionId.trim().length === 0) {
      throw new Error('Section ID must be a non-empty string if provided');
    }
  }
   
  // Validate file type
  const validFileTypes = ['PDF', 'PPTX', 'XLSX', 'IMAGE'];
  const upperFileType = fileType.toUpperCase();
  
  if (!validFileTypes.includes(upperFileType)) {
    throw new Error(`Invalid file type. Allowed: ${validFileTypes.join(', ')}`);
  }
  
  // Check if brief exists
  const brief = await prisma.brief.findUnique({
    where: { id: briefId }
  });
  
  if (!brief) {
    throw new Error(`Brief not found with ID: ${briefId}`);
  }
  
  // If sectionId is provided, verify it exists and belongs to the brief
  if (sectionId) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId }
    });
    
    if (!section) {
      throw new Error(`Section not found with ID: ${sectionId}`);
    }
    
    if (section.briefId !== briefId) {
      throw new Error(`Section ${sectionId} does not belong to brief ${briefId}`);
    }
    
    logger.info(`Saving document: ${fileName} for brief: ${briefId}, section: ${sectionId}`);
  } else {
    logger.info(`Saving document: ${fileName} for brief: ${briefId} (no section)`);
  }
  
  // Save document reference
  logger.info(`Saving document: ${fileName} for brief: ${briefId}, section: ${sectionId}, user: ${userId}`);
  const document = await prisma.document.create({
    data: {
      briefId,
      fileName,
      fileType: upperFileType,
      s3Key,
      sectionId: sectionId || null, // Set to null if not provided
      uploadedById: userId
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      brief: {
        select: {
          id: true,
          title: true
        }
      },
      section: sectionId ? {
        select: {
          id: true,
          sectionName: true
        }
      } : false
    }
  });
  
  logger.info(`Document saved successfully: ${document.id}`);
  
  return document;
};

module.exports = {
  generateUploadUrl,
  saveDocument
};
