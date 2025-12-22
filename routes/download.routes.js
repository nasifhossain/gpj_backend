const express = require('express');
const S3 = require('../libraries/s3/s3.lib');
const authenticateClient = require('../libraries/auth/clientAuth');
const logger = require('../helper/logger.helper');
const prisma = require('../config/prisma.client').prisma;

const router = express.Router();
const s3 = new S3();

/**
 * GET /download
 * Generate a signed download URL from S3 key
 * Query params: s3Key (required), expiresIn (optional, default: 3600 seconds)
 */
router.get('/', authenticateClient, async (req, res) => {
    try {
        const { s3Key, expiresIn } = req.query;

        // Validate s3Key
        if (!s3Key || typeof s3Key !== 'string' || s3Key.trim() === '') {
            return res.status(400).json({
                error: 's3Key query parameter is required and must be a non-empty string'
            });
        }

        // Check if document exists and verify authorization
        const document = await prisma.document.findUnique({
            where: { s3Key: s3Key.trim() },
            include: { uploadedBy: true }
        });

        if (!document) {
            logger.warn(`Document not found for s3Key: ${s3Key}, user: ${req.user.id}`);
            return res.status(404).json({
                error: 'Document not found'
            });
        }

        // Check if user is authorized (must be uploader or admin)
        const isUploader = document.uploadedById === req.user.id;
        const isAdmin = req.user.role === 'ADMIN';

        if (!isUploader && !isAdmin) {
            logger.warn(`Unauthorized download attempt for s3Key: ${s3Key}, user: ${req.user.id}, uploader: ${document.uploadedById}`);
            return res.status(403).json({
                error: 'You are not authorized to download this document'
            });
        }

        // Validate expiresIn if provided
        let expirationTime = 3600; // Default 1 hour
        if (expiresIn) {
            const parsedExpiry = parseInt(expiresIn, 10);
            if (isNaN(parsedExpiry) || parsedExpiry <= 0) {
                return res.status(400).json({
                    error: 'expiresIn must be a positive number (in seconds)'
                });
            }
            // Max 7 days (604800 seconds)
            if (parsedExpiry > 604800) {
                return res.status(400).json({
                    error: 'expiresIn cannot exceed 7 days (604800 seconds)'
                });
            }
            expirationTime = parsedExpiry;
        }

        logger.info(`Generating download URL for s3Key: ${s3Key}, user: ${req.user.id}, authorized: ${isUploader ? 'uploader' : 'admin'}`);

        // Generate signed download URL
        const downloadUrl = await s3.generateDownloadSignedUrl(s3Key.trim(), expirationTime);

        logger.info(`Successfully generated download URL for s3Key: ${s3Key}`);

        res.status(200).json({
            message: 'Download URL generated successfully',
            data: {
                downloadUrl,
                s3Key: s3Key.trim(),
                fileName: document.fileName,
                fileType: document.fileType,
                expiresIn: expirationTime,
                expiresAt: new Date(Date.now() + expirationTime * 1000).toISOString()
            }
        });

    } catch (err) {
        logger.error('Error in GET /download, message: ' + err.message);

        // Return appropriate status codes
        const statusCode = err.message.includes('Key') ||
            err.message.includes('required') ? 400 : 500;

        res.status(statusCode).json({ error: err.message });
    }
});

/**
 * POST /download
 * Generate signed download URLs for multiple S3 keys
 * Body: { s3Keys: string[], expiresIn?: number }
 */
router.post('/', authenticateClient, async (req, res) => {
    try {
        const { s3Keys, expiresIn } = req.body;

        // Validate s3Keys array
        if (!Array.isArray(s3Keys) || s3Keys.length === 0) {
            return res.status(400).json({
                error: 's3Keys must be a non-empty array of strings'
            });
        }

        // Validate each s3Key
        for (const key of s3Keys) {
            if (!key || typeof key !== 'string' || key.trim() === '') {
                return res.status(400).json({
                    error: 'All s3Keys must be non-empty strings'
                });
            }
        }

        // Limit to 50 files at a time
        if (s3Keys.length > 50) {
            return res.status(400).json({
                error: 'Cannot generate URLs for more than 50 files at once'
            });
        }

        // Validate expiresIn if provided
        let expirationTime = 3600; // Default 1 hour
        if (expiresIn) {
            const parsedExpiry = parseInt(expiresIn, 10);
            if (isNaN(parsedExpiry) || parsedExpiry <= 0) {
                return res.status(400).json({
                    error: 'expiresIn must be a positive number (in seconds)'
                });
            }
            if (parsedExpiry > 604800) {
                return res.status(400).json({
                    error: 'expiresIn cannot exceed 7 days (604800 seconds)'
                });
            }
            expirationTime = parsedExpiry;
        }

        logger.info(`Generating download URLs for ${s3Keys.length} files, user: ${req.user.id}`);

        // Check authorization for all documents
        const documents = await prisma.document.findMany({
            where: {
                s3Key: { in: s3Keys.map(key => key.trim()) }
            },
            include: { uploadedBy: true }
        });

        // Create a map for quick lookup
        const documentMap = new Map(documents.map(doc => [doc.s3Key, doc]));

        const isAdmin = req.user.role === 'ADMIN';

        // Generate signed URLs for all keys with authorization check
        const downloadUrls = await Promise.all(
            s3Keys.map(async (s3Key) => {
                try {
                    const trimmedKey = s3Key.trim();
                    const document = documentMap.get(trimmedKey);

                    // Check if document exists
                    if (!document) {
                        logger.warn(`Document not found for s3Key: ${trimmedKey}, user: ${req.user.id}`);
                        return {
                            s3Key: trimmedKey,
                            error: 'Document not found',
                            success: false
                        };
                    }

                    // Check authorization
                    const isUploader = document.uploadedById === req.user.id;
                    if (!isUploader && !isAdmin) {
                        logger.warn(`Unauthorized download attempt for s3Key: ${trimmedKey}, user: ${req.user.id}`);
                        return {
                            s3Key: trimmedKey,
                            error: 'Not authorized to download this document',
                            success: false
                        };
                    }

                    // Generate download URL
                    const downloadUrl = await s3.generateDownloadSignedUrl(trimmedKey, expirationTime);
                    return {
                        s3Key: trimmedKey,
                        downloadUrl,
                        fileName: document.fileName,
                        fileType: document.fileType,
                        success: true
                    };
                } catch (error) {
                    logger.error(`Failed to generate URL for ${s3Key}: ${error.message}`);
                    return {
                        s3Key: s3Key.trim(),
                        error: error.message,
                        success: false
                    };
                }
            })
        );

        // Separate successful and failed URLs
        const successful = downloadUrls.filter(item => item.success);
        const failed = downloadUrls.filter(item => !item.success);

        logger.info(`Generated ${successful.length}/${s3Keys.length} download URLs successfully`);

        res.status(200).json({
            message: `Generated ${successful.length}/${s3Keys.length} download URLs successfully`,
            data: {
                successful,
                failed,
                expiresIn: expirationTime,
                expiresAt: new Date(Date.now() + expirationTime * 1000).toISOString()
            }
        });

    } catch (err) {
        logger.error('Error in POST /download, message: ' + err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
