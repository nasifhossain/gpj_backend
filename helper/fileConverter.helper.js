const axios = require('axios');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const xml2js = require('xml2js');
const S3 = require('../libraries/s3/s3.lib.js');

class FileConverter {
    constructor() {
        this.s3 = new S3();
        
        // Supported MIME types for Gemini (based on Gemini API documentation)
        this.mimeTypes = {
            pdf: 'application/pdf',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            webp: 'image/webp',
            gif: 'image/gif'
        };
        
        // Formats that need text extraction
        this.textExtractionFormats = ['xlsx', 'xls', 'pptx', 'ppt'];
        
        // Formats not yet supported
        this.unsupportedFormats = ['docx', 'doc'];
    }

    /**
     * Get MIME type from file extension
     * @param {string} filename - The filename or path
     * @returns {string} - MIME type
     */
    getMimeTypeFromFilename(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        
        // Check if format is unsupported
        if (this.unsupportedFormats.includes(extension)) {
            throw new Error(`File format '.${extension}' is not supported yet. Supported formats: PDF, PNG, JPG, JPEG, WEBP, GIF, XLSX, XLS.`);
        }
        
        return this.mimeTypes[extension] || 'application/octet-stream';
    }

    /**
     * Extract text content from XLSX file
     * @param {Buffer} buffer - The XLSX file buffer
     * @returns {string} - Extracted text content
     */
    extractTextFromXLSX(buffer) {
        try {
            // Read the workbook from buffer
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            
            let textContent = '';
            
            // Process each sheet
            workbook.SheetNames.forEach((sheetName, index) => {
                const sheet = workbook.Sheets[sheetName];
                
                // Add sheet header
                textContent += `\n${'='.repeat(50)}\n`;
                textContent += `Sheet ${index + 1}: ${sheetName}\n`;
                textContent += `${'='.repeat(50)}\n\n`;
                
                // Convert sheet to CSV format for better readability
                const csv = XLSX.utils.sheet_to_csv(sheet);
                textContent += csv + '\n';
            });
            
            return textContent;
        } catch (error) {
            throw new Error(`Failed to extract text from XLSX: ${error.message}`);
        }
    }

    /**
     * Extract text content from PPTX file
     * @param {Buffer} buffer - The PPTX file buffer
     * @returns {Promise<string>} - Extracted text content
     */
    async extractTextFromPPTX(buffer) {
        try {
            const zip = await JSZip.loadAsync(buffer);
            let textContent = '';
            const parser = new xml2js.Parser();
            
            // Get all slide files
            const slideFiles = Object.keys(zip.files)
                .filter(name => name.match(/ppt\/slides\/slide\d+\.xml/))
                .sort();

            for (let i = 0; i < slideFiles.length; i++) {
                const slideFile = slideFiles[i];
                const slideXml = await zip.files[slideFile].async('text');
                
                textContent += `\n${'='.repeat(50)}\n`;
                textContent += `Slide ${i + 1}\n`;
                textContent += `${'='.repeat(50)}\n\n`;

                try {
                    const result = await parser.parseStringPromise(slideXml);
                    
                    // Extract text from all text elements
                    const extractTextFromNode = (node) => {
                        if (!node) return '';
                        
                        let text = '';
                        
                        if (typeof node === 'string') {
                            return node;
                        }
                        
                        if (Array.isArray(node)) {
                            node.forEach(item => {
                                text += extractTextFromNode(item);
                            });
                            return text;
                        }
                        
                        if (typeof node === 'object') {
                            // Look for text in 'a:t' elements (text runs)
                            if (node['a:t']) {
                                if (Array.isArray(node['a:t'])) {
                                    text += node['a:t'].join(' ') + ' ';
                                } else {
                                    text += node['a:t'] + ' ';
                                }
                            }
                            
                            // Recursively process all properties
                            Object.keys(node).forEach(key => {
                                if (key !== 'a:t') {
                                    text += extractTextFromNode(node[key]);
                                }
                            });
                        }
                        
                        return text;
                    };
                    
                    const slideText = extractTextFromNode(result);
                    textContent += slideText.trim() + '\n\n';
                    
                } catch (parseError) {
                    console.error(`Failed to parse slide ${i + 1}:`, parseError.message);
                    textContent += '[Unable to extract text from this slide]\n\n';
                }
            }
            
            return textContent || '[No text content found in presentation]';
        } catch (error) {
            throw new Error(`Failed to extract text from PPTX: ${error.message}`);
        }
    }

    /**
     * Download a file from S3 using signed URL and convert to Gemini-compatible format
     * @param {string} s3Key - The S3 object key (file path)
     * @param {string} mimeType - MIME type of the file (e.g., 'application/pdf'). If not provided, will auto-detect from filename
     * @returns {Promise<Object|string>} - File data in Gemini format or extracted text for XLSX
     */
    async getFileFromS3ForGemini(s3Key, mimeType = null) {
        try {
            const extension = s3Key.split('.').pop().toLowerCase();
            
            // Generate signed URL for downloading
            const signedUrl = await this.s3.generateDownloadSignedUrl(s3Key, 3600);

            // Download file as buffer
            const response = await axios.get(signedUrl, {
                responseType: 'arraybuffer'
            });

            const buffer = Buffer.from(response.data);

            // Check if this file needs text extraction
            if (this.textExtractionFormats.includes(extension)) {
                if (extension === 'xlsx' || extension === 'xls') {
                    console.log(`Extracting text from XLSX: ${s3Key}`);
                    const textContent = this.extractTextFromXLSX(buffer);
                    return textContent; // Return as plain text
                } else if (extension === 'pptx' || extension === 'ppt') {
                    console.log(`Extracting text from PPTX: ${s3Key}`);
                    const textContent = await this.extractTextFromPPTX(buffer);
                    return textContent; // Return as plain text
                }
            }

            // For supported binary formats (PDF, images), return as inline data
            if (!mimeType) {
                mimeType = this.getMimeTypeFromFilename(s3Key);
                console.log(`Auto-detected MIME type: ${mimeType} for ${s3Key}`);
            }

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
