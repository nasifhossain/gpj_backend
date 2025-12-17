const S3 = require("../../libraries/s3/s3.lib");


async function testS3() {
    try {
        console.log('Initializing S3...');
        const s3 = new S3();
        
        console.log('Bucket:', s3.getBucket());
        console.log('Region:', s3.getRegion());

        // Test 1: Upload signed URL for Excel
        console.log('\n=== Test 1: Generating Upload Signed URL for Excel ===');
        const uploadKeyExcel = 'test-folder/sample-excel.xlsx';
        const uploadUrlExcel = await s3.generateUploadSignedUrl(uploadKeyExcel, 3600, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        console.log('Excel Upload URL:', uploadUrlExcel);

        // Test 2: Upload signed URL for PowerPoint
        console.log('\n=== Test 2: Generating Upload Signed URL for PowerPoint ===');
        const uploadKeyPPT = 'test-folder/sample-presentation.pptx';
        const uploadUrlPPT = await s3.generateUploadSignedUrl(uploadKeyPPT, 3600, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        console.log('PowerPoint Upload URL:', uploadUrlPPT);
        console.log('\n📌 Use this key in Gemini test: test-folder/sample-presentation.pptx');

        // Test 3: Upload signed URL for PDF
        console.log('\n=== Test 3: Generating Upload Signed URL for PDF ===');
        const uploadKeyPDF = 'test-folder/sample-file.pdf';
        const uploadUrlPDF = await s3.generateUploadSignedUrl(uploadKeyPDF, 3600, 'application/pdf');
        console.log('PDF Upload URL:', uploadUrlPDF);

        // Test 4: Download signed URLs
        console.log('\n=== Test 4: Generating Download Signed URLs ===');
        const downloadUrlExcel = await s3.generateDownloadSignedUrl(uploadKeyExcel, 3600);
        console.log('Excel Download URL:', downloadUrlExcel);
        
        const downloadUrlPPT = await s3.generateDownloadSignedUrl(uploadKeyPPT, 3600);
        console.log('PowerPoint Download URL:', downloadUrlPPT);

        console.log('\n=== Test completed successfully ===');
        console.log('\n📋 Instructions:');
        console.log('1. Use the upload URLs above in Postman (PUT request with file in Body > Binary)');
        console.log('2. After uploading, the files will be available at these keys:');
        console.log('   - Excel: test-folder/sample-excel.xlsx');
        console.log('   - PowerPoint: test-folder/sample-presentation.pptx');
        console.log('   - PDF: test-folder/sample-file.pdf');
        console.log('3. Run: node tests/gemini/test-gemini.js to test Gemini analysis');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

testS3();
