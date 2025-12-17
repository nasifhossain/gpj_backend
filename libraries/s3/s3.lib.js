const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
require('dotenv').config();

class S3 {
    constructor() {
        this.accessKeyId = process.env.S3_ACCESS_KEY;
        this.secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.bucket = process.env.AWS_S3_BUCKET;

        if (!this.accessKeyId || !this.secretAccessKey) {
            throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required");
        }

        if (!this.bucket) {
            throw new Error("AWS_S3_BUCKET environment variable is required");
        }

        this.client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey
            }
        });
    }

    /**
     * Generate a signed URL for uploading a file to S3
     * @param {string} key - The S3 object key (file path)
     * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
     * @param {string} contentType - MIME type of the file (optional)
     * @returns {Promise<string>} - The signed URL
     */
    async generateUploadSignedUrl(key, expiresIn = 3600, contentType = null) {
        if (!key) {
            throw new Error("Key (file path) is required");
        }

        try {
            const commandParams = {
                Bucket: this.bucket,
                Key: key
            };

            if (contentType) {
                commandParams.ContentType = contentType;
            }

            const command = new PutObjectCommand(commandParams);
            const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
            
            return signedUrl;
        } catch (error) {
            throw new Error(`Failed to generate upload signed URL: ${error.message}`);
        }
    }

    /**
     * Generate a signed URL for downloading a file from S3
     * @param {string} key - The S3 object key (file path)
     * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
     * @returns {Promise<string>} - The signed URL
     */
    async generateDownloadSignedUrl(key, expiresIn = 3600) {
        if (!key) {
            throw new Error("Key (file path) is required");
        }

        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key
            });

            const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
            
            return signedUrl;
        } catch (error) {
            throw new Error(`Failed to generate download signed URL: ${error.message}`);
        }
    }

    /**
     * Get the S3 bucket name
     * @returns {string} - The bucket name
     */
    getBucket() {
        return this.bucket;
    }

    /**
     * Get the AWS region
     * @returns {string} - The region
     */
    getRegion() {
        return this.region;
    }
}

module.exports = S3;
