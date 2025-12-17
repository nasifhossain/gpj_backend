const axios = require('axios');
const S3 = require('../libraries/s3/s3.lib.js');

class FileConverter {
    constructor() {
        this.s3 = new S3();
    }

    /**
     * Download a file from S3 using signed URL and convert to Gemini-compatible format
     * @param {string} s3Key - The S3 object key (file path)
     * @param {string} mimeType - MIME type of the file (e.g., 'application/pdf')
     * @returns {Promise<Object>} - File data in Gemini format
     */
    async getFileFromS3ForGemini(s3Key, mimeType = 'application/pdf') {
        try {
            // Generate signed URL for downloading
            const signedUrl = await this.s3.generateDownloadSignedUrl(s3Key, 3600);

            // Download file as buffer
            const response = await axios.get(signedUrl, {
                responseType: 'arraybuffer'
            });

            const buffer = Buffer.from(response.data);

            // Convert to base64 for Gemini API
            const base64Data = buffer.toString('base64');

            // Return in Gemini's inline data format
            return {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            };
        } catch (error) {
            throw new Error(`Failed to fetch and convert file from S3: ${error.message}`);
        }
    }

    /**
     * Get multiple files from S3 for Gemini
     * @param {Array} fileList - Array of objects with {s3Key, mimeType}
     * @returns {Promise<Array>} - Array of file data in Gemini format
     */
    async getMultipleFilesFromS3ForGemini(fileList) {
        try {
            const filePromises = fileList.map(file => 
                this.getFileFromS3ForGemini(file.s3Key, file.mimeType)
            );
            return await Promise.all(filePromises);
        } catch (error) {
            throw new Error(`Failed to fetch multiple files: ${error.message}`);
        }
    }
}

module.exports = FileConverter;
