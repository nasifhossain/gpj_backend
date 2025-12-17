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
        const pdfFile = await fileConverter.getFileFromS3ForGemini(pdfS3Key, 'application/pdf');
        
        console.log('Sending PDF with prompt to Gemini...');
        const pdfResponse = await gemini.getResponse(
            'Please analyze this PDF document and provide a summary of its contents.',
            [pdfFile]
        );
        
        console.log('\n=== PDF Analysis Response ===');
        console.log(pdfResponse);
        
        console.log('\n=== Test completed successfully ===');
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testGemini();
