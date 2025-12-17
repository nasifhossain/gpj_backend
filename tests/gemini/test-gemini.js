const Gemini = require("../../libraries/gemini/gemini.lib.js");
const FileConverter = require("../../helper/fileConverter.helper.js");

async function testGemini() {
    try {
        console.log('Initializing services...');
        const gemini = new Gemini();
        const fileConverter = new FileConverter();
        
        gemini.initialize('gemini-flash-latest');

        // Test 1: Text-only prompt
        console.log('\n=== Test 1: Text-only prompt ===');
        const textResponse = await gemini.getResponse('What is a database?');
        console.log('Response:', textResponse.substring(0, 200) + '...');

        // Test 2: Prompt with PDF from S3
        console.log('\n=== Test 2: Prompt with PDF from S3 ===');
        
        // Replace this with an actual PDF key from your S3 bucket
        const pdfS3Key = 'test-folder/sample-file.pdf';
        
        console.log(`Fetching PDF from S3: ${pdfS3Key}`);
        const pdfFile = await fileConverter.getFileFromS3ForGemini(pdfS3Key); // Auto-detects MIME type
        
        console.log('Sending PDF with prompt to Gemini...');
        const pdfResponse = await gemini.getResponse(
            'Please analyze this PDF document and provide a summary of its contents.',
            [pdfFile]
        );
        
        console.log('\n=== PDF Analysis Response ===');
        console.log(pdfResponse.substring(0, 300) + '...');

        // Test 3: Prompt with XLSX from S3 (text extraction)
        console.log('\n=== Test 3: Prompt with XLSX from S3 ===');
        
        // Replace this with an actual XLSX key from your S3 bucket
        const xlsxS3Key = 'test-folder/sample-excel.xlsx';
        
        console.log(`Fetching XLSX from S3: ${xlsxS3Key}`);
        const xlsxContent = await fileConverter.getFileFromS3ForGemini(xlsxS3Key); // Returns extracted text
        
        console.log('Extracted XLSX Content Preview:');
        console.log(xlsxContent.substring(0, 500) + '...\n');
        
        console.log('Sending XLSX data with prompt to Gemini...');
        const xlsxResponse = await gemini.getResponse(
            `Here is the content from an Excel spreadsheet:\n\n${xlsxContent}\n\nPlease analyze this data and provide a summary of key insights, patterns, and important information.`
        );
        
        console.log('\n=== XLSX Analysis Response ===');
        console.log(xlsxResponse.substring(0, 300) + '...');

        // Test 4: Prompt with PPTX from S3 (text extraction)
        console.log('\n=== Test 4: Prompt with PPTX from S3 ===');
        
        // Replace this with an actual PPTX key from your S3 bucket
        const pptxS3Key = 'test-folder/sample-presentation.pptx';
        
        console.log(`Fetching PPTX from S3: ${pptxS3Key}`);
        const pptxContent = await fileConverter.getFileFromS3ForGemini(pptxS3Key); // Returns extracted text
        
        console.log('Extracted PPTX Content Preview:');
        console.log(pptxContent.substring(0, 500) + '...\n');
        
        console.log('Sending PPTX data with prompt to Gemini...');
        const pptxResponse = await gemini.getResponse(
            `Here is the content from a PowerPoint presentation:\n\n${pptxContent}\n\nPlease analyze this presentation and provide a summary of the main topics, key points, and overall structure.`
        );
        
        console.log('\n=== PPTX Analysis Response ===');
        console.log(pptxResponse);
        
        console.log('\n=== Test completed successfully ===');
        console.log('\nSupported formats: PDF, PNG, JPG, JPEG, WEBP, GIF (binary), XLSX/XLS, PPTX/PPT (text extraction)');
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testGemini();
