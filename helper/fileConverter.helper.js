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
                
                // Convert sheet to CSV format
                const csv = XLSX.utils.sheet_to_csv(sheet);
                
                // Filter out rows that are only commas (empty rows)
                const lines = csv.split('\n');
                const filteredLines = lines.filter(line => {
                    // Remove a line if it's only commas and whitespace
                    const cleaned = line.replace(/,/g, '').trim();
                    return cleaned.length > 0;
                });
                
                textContent += filteredLines.join('\n') + '\n';
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

            // Helper function to check if text is meaningful (not metadata)
            const isMeaningfulText = (text) => {
                if (!text || typeof text !== 'string') return false;
                
                const trimmed = text.trim();
                
                // Filter out empty or very short text (but allow 2-3 char abbreviations like "AI", "IBM")
                if (trimmed.length < 2) return false;
                
                // Filter out URN schemas
                if (trimmed.startsWith('urn:') || trimmed.includes('urn:schemas')) return false;
                
                // Filter out XML namespaces and schema URLs
                if (trimmed.includes('schemas.openxmlformats.org') || 
                    trimmed.includes('schemas.microsoft.com') ||
                    trimmed.startsWith('http://') ||
                    trimmed.startsWith('https://') && trimmed.length > 100) return false;
                
                // Filter out GUIDs and technical IDs
                if (/^[\{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[\}]?$/.test(trimmed)) return false;
                
                // Filter out hex color codes (6 or 8 digit hex)
                if (/^[0-9A-Fa-f]{6,8}$/.test(trimmed)) return false;
                
                // Filter out locale codes (e.g., en-US, zh-TW, en-IN)
                if (/^[a-z]{2}-[A-Z]{2}$/.test(trimmed)) return false;
                
                // Filter out rId references (e.g., rId2, rId3)
                if (/^rId\d+$/.test(trimmed)) return false;
                
                // Filter out shape references (e.g., "Shape 136", "Google Shape;176;p1")
                if (/^(Google\s+)?Shape[;\s]+\d+/.test(trimmed)) return false;
                if (/^Shape\s+\d+$/.test(trimmed)) return false;
                
                // Filter out PowerPoint shape/object names
                const shapeNames = ['TextBox', 'Rectangle', 'Picture', 'Oval', 'Group'];
                if (shapeNames.some(shape => trimmed.startsWith(shape) && /\d+$/.test(trimmed))) return false;
                
                // Filter out font names
                const fontNames = ['IBM Plex Sans', 'Wingdings', 'Arial', 'Calibri', 'Times New Roman', 'System Font'];
                if (fontNames.some(font => trimmed.includes(font))) return false;
                
                // Filter out pure numbers (positive or negative, especially large ones)
                if (/^-?\d+$/.test(trimmed)) return false;
                
                // Filter out decimal numbers with no context
                if (/^-?\d+\.\d+$/.test(trimmed)) return false;
                
                // Filter out Chinese connector/arrow names (直线箭头连接符)
                if (/^[\u4e00-\u9fa5]+连接符\s*\d*$/.test(trimmed)) return false;
                if (/^[\u4e00-\u9fa5]+箭头[\u4e00-\u9fa5]*\s*\d*$/.test(trimmed)) return false;
                
                // Filter out common single-word PowerPoint metadata
                const metadataWords = [
                    'noStrike', 'title', 'pic', 'auto', 'none', 'base', 'ctr', 'just',
                    'algn', 'anchor', 'anchorCtr', 'dist', 'wrap', 'wrapNone', 'wrapSquare',
                    'wrapThrough', 'wrapTight', 'wrapTopAndBottom'
                ];
                if (metadataWords.includes(trimmed)) return false;
                
                // Filter out common XML tags and technical terms
                const technicalTerms = [
                    'rect', 'square', 'auto', 'none', 'nonenoStrike', 'textNoShape',
                    'horzsquare', 'accent', 'minordk', 'base', 'mainhttp', 'horz', 'vert',
                    'lt', 'dk', 'med', 'Light', 'Regular', 'Bold', 'Italic',
                    '+mn-lt', '+mn-ea', '+mn-cs', 'bg1', 'tx1', 'accent1', 'accent2', 
                    'accent3', 'accent4', 'accent5', 'accent6'
                ];
                if (technicalTerms.includes(trimmed)) return false;
                
                // Filter out design/formatting values (combinations of letters and many zeros)
                if (/^[a-zA-Z]*0{4,}[a-zA-Z]*$/.test(trimmed)) return false;
                
                // Filter out text that's mostly numbers and special characters (less than 40% letters)
                const alphaCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
                const totalLength = trimmed.length;
                
                // If it's short (< 10 chars), require at least 50% letters
                if (totalLength < 10 && alphaCount < totalLength * 0.5) return false;
                
                // If it's longer, require at least 40% letters
                if (totalLength >= 10 && alphaCount < totalLength * 0.4) return false;
                
                // Filter out single characters or special character only strings
                if (trimmed.length === 1 && !/[a-zA-Z0-9]/.test(trimmed)) return false;
                
                // Keep text that has meaningful length and content
                return true;
            };

            // Helper function to extract text from XML nodes
            const extractTextFromNode = (node, collectedTexts = new Set()) => {
                if (!node) return collectedTexts;
                
                if (typeof node === 'string') {
                    if (isMeaningfulText(node)) {
                        collectedTexts.add(node.trim());
                    }
                    return collectedTexts;
                }
                
                if (Array.isArray(node)) {
                    node.forEach(item => {
                        extractTextFromNode(item, collectedTexts);
                    });
                    return collectedTexts;
                }
                
                if (typeof node === 'object') {
                    // Look for text in 'a:t' elements (text runs)
                    if (node['a:t']) {
                        const texts = Array.isArray(node['a:t']) ? node['a:t'] : [node['a:t']];
                        texts.forEach(t => {
                            if (isMeaningfulText(t)) {
                                collectedTexts.add(t.trim());
                            }
                        });
                    }
                    
                    // Recursively process all properties
                    Object.keys(node).forEach(key => {
                        if (key !== 'a:t') {
                            extractTextFromNode(node[key], collectedTexts);
                        }
                    });
                }
                
                return collectedTexts;
            };

            // Process all slides in parallel using Promise.allSettled
            const slidePromises = slideFiles.map(async (slideFile, i) => {
                try {
                    const slideXml = await zip.files[slideFile].async('text');
                    const result = await parser.parseStringPromise(slideXml);
                    const textSet = extractTextFromNode(result, new Set());
                    
                    // Convert Set to array and join with proper spacing
                    const slideTexts = Array.from(textSet);
                    
                    return {
                        slideNumber: i + 1,
                        text: slideTexts.join('\n'),
                        hasContent: slideTexts.length > 0
                    };
                } catch (error) {
                    console.error(`Failed to parse slide ${i + 1}:`, error.message);
                    return {
                        slideNumber: i + 1,
                        text: '[Unable to extract text from this slide]',
                        error: true,
                        hasContent: false
                    };
                }
            });

            const slideResults = await Promise.allSettled(slidePromises);

            // Build text content from results in order
            slideResults.forEach((result, i) => {
                if (result.status === 'fulfilled' && result.value.hasContent) {
                    textContent += `\n${'='.repeat(50)}\n`;
                    textContent += `Slide ${result.value.slideNumber}\n`;
                    textContent += `${'='.repeat(50)}\n\n`;
                    textContent += result.value.text + '\n\n';
                } else if (result.status === 'fulfilled' && result.value.error) {
                    textContent += `\n${'='.repeat(50)}\n`;
                    textContent += `Slide ${result.value.slideNumber}\n`;
                    textContent += `${'='.repeat(50)}\n\n`;
                    textContent += result.value.text + '\n\n';
                } else if (result.status === 'rejected') {
                    console.error(`Slide ${i + 1} promise rejected:`, result.reason);
                    textContent += `\n${'='.repeat(50)}\n`;
                    textContent += `Slide ${i + 1}\n`;
                    textContent += `${'='.repeat(50)}\n\n`;
                    textContent += '[Unable to extract text from this slide]\n\n';
                }
                // Skip slides with no meaningful content
            });
            
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
