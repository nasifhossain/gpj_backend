const S3 = require("../../libraries/s3/s3.lib");


async function testS3() {
    try {
        console.log('Initializing S3...');
        const s3 = new S3();
        
        console.log('Bucket:', s3.getBucket());
        console.log('Region:', s3.getRegion());

        // Test upload signed URL generation
        console.log('\n=== Generating Upload Signed URL ===');
        const uploadKey = 'test-folder/sample-excel.xlsx';
        const uploadUrl = await s3.generateUploadSignedUrl(uploadKey, 3600, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        console.log('Upload URL:', uploadUrl);

        // Test download signed URL generation
        console.log('\n=== Generating Download Signed URL ===');
        const downloadKey = 'test-folder/sample-excel.xlsx';
        const downloadUrl = await s3.generateDownloadSignedUrl(downloadKey, 3600);
        console.log('Download URL:', downloadUrl);

        console.log('\n=== Test completed successfully ===');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

testS3();
