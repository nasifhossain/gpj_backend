const Gemini = require('./libraries/gemini.lib.js');

async function testGemini() {
    try {
        console.log('Initializing Gemini...');
        const gemini = new Gemini();
        gemini.initialize('gemini-flash-latest');

        console.log('Sending prompt to Gemini...');
        const response = await gemini.getResponse('EXPLAIN primary key and foreign key in database with examples.');
        
        console.log('\n=== Response ===');
        console.log(response);
        console.log('\n=== Test completed successfully ===');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

testGemini();
