const prisma = require('../config/prisma.client').prisma;
const logger = require('../helper/logger.helper');
const FileConverter = require('../helper/fileConverter.helper');
const Gemini = require('../libraries/gemini/gemini.lib');

/**
 * Generate AI prompt by combining all field prompts in a section
 * @param {string} sectionId - The section ID to fetch fields from
 * @param {Array<string>} s3Keys - Array of S3 keys of uploaded documents
 * @returns {Promise<{prompt: string, fields: Array}>} Combined prompt and field information
 */
const generateAIPromptForSection = async (sectionId, s3Keys) => {
  // Validate inputs
  if (!sectionId || typeof sectionId !== 'string') {
    throw new Error('Section ID is required and must be a string');
  }
  
  if (!Array.isArray(s3Keys) || s3Keys.length === 0) {
    throw new Error('S3 keys must be a non-empty array');
  }
  
  logger.info(`Generating AI prompt for section: ${sectionId}, s3Keys: ${s3Keys.join(', ')}`);
  
  // Fetch section with its fields
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      fields: {
        orderBy: { fieldKey: 'asc' }
      },
      brief: {
        select: {
          id: true,
          title: true,
          templateName: true
        }
      }
    }
  });
  
  if (!section) {
    throw new Error(`Section not found with ID: ${sectionId}`);
  }
  
  logger.info(`Found section: ${section.sectionName} with ${section.fields.length} fields`);
  
  // Filter fields that have prompts
  const fieldsWithPrompts = section.fields.filter(field => field.prompt && field.prompt.trim().length > 0);
  
  if (fieldsWithPrompts.length === 0) {
    logger.info(`No fields with prompts found in section: ${section.sectionName}`);
    return {
      prompt: null,
      fields: [],
      sectionName: section.sectionName,
      briefTitle: section.brief.title,
      totalDocuments: 0
    };
  }
  
  logger.info(`Found ${fieldsWithPrompts.length} fields with prompts`);
  
  // Fetch and process documents from S3
  logger.info(`Fetching ${s3Keys.length} documents from S3...`);
  const fileConverter = new FileConverter();
  const documentContents = [];
  
  for (let i = 0; i < s3Keys.length; i++) {
    try {
      const s3Key = s3Keys[i];
      logger.info(`Processing document ${i + 1}/${s3Keys.length}: ${s3Key}`);
      
      const fileContent = await fileConverter.getFileFromS3ForGemini(s3Key);
      
      // Check if it's extracted text or binary file
      if (typeof fileContent === 'string') {
        // Text extraction (XLSX, PPTX)
        documentContents.push({
          name: s3Key,
          type: 'text',
          content: fileContent
        });
      } else {
        // Binary file (PDF, images)
        documentContents.push({
          name: s3Key,
          type: 'binary',
          mimeType: fileContent.inlineData.mimeType,
          content: `[Binary file: ${s3Key}]`
        });
      }
      
      logger.info(`Successfully processed: ${s3Key}`);
    } catch (error) {
      logger.error(`Failed to fetch document ${s3Keys[i]}: ${error.message}`);
      documentContents.push({
        name: s3Keys[i],
        type: 'error',
        content: `[Error: Could not fetch this document - ${error.message}]`
      });
    }
  }
  
  logger.info(`Successfully processed ${documentContents.length} documents`);
  
  // Group fields by fieldHeading
  const fieldsByHeading = fieldsWithPrompts.reduce((acc, field) => {
    const heading = field.fieldHeading || 'General';
    if (!acc[heading]) {
      acc[heading] = [];
    }
    acc[heading].push(field);
    return acc;
  }, {});
  
  // Build the combined prompt
  let combinedPrompt = `# AI Extraction Task\n\n`;
  combinedPrompt += `## Context\n`;
  combinedPrompt += `- Brief: ${section.brief.title}\n`;
  combinedPrompt += `- Section: ${section.sectionName}\n`;
  combinedPrompt += `- Documents: ${s3Keys.length} file(s)\n\n`;
  
  // Add document contents
  combinedPrompt += `## Document Contents\n\n`;
  documentContents.forEach((doc, index) => {
    combinedPrompt += `### Document ${index + 1}: ${doc.name}\n`;
    if (doc.type === 'text') {
      combinedPrompt += `\n${doc.content}\n\n`;
    } else if (doc.type === 'binary') {
      combinedPrompt += `Type: ${doc.mimeType}\n`;
      combinedPrompt += `Note: This is a binary file (PDF/Image). The AI model will analyze it directly.\n\n`;
    } else if (doc.type === 'error') {
      combinedPrompt += `${doc.content}\n\n`;
    }
    combinedPrompt += `${'='.repeat(80)}\n\n`;
  });
  combinedPrompt += `\n`;
  
  combinedPrompt += `## Instructions\n`;
  combinedPrompt += `IMPORTANT: Please carefully and thoroughly analyze all provided documents (including PDFs, spreadsheets, and presentations). Take your time to review every section, page, and data point.\n\n`;
  combinedPrompt += `For each field below:\n`;
  combinedPrompt += `1. Extract ONLY the exact information as specified in the instruction\n`;
  combinedPrompt += `2. If you find the information clearly and confidently, provide the exact value\n`;
  combinedPrompt += `3. If you have ANY doubt, uncertainty, or cannot find clear evidence of the information, respond with 'Nil' for that field\n`;
  combinedPrompt += `4. Do NOT guess or make assumptions - if unsure, use 'Nil'\n`;
  combinedPrompt += `5. For PDFs, make sure to scan all pages and sections carefully\n\n`;
  
  combinedPrompt += `## Fields to Extract\n\n`;
  
  // Add fields grouped by heading
  Object.entries(fieldsByHeading).forEach(([heading, fields]) => {
    combinedPrompt += `### ${heading}\n\n`;
    
    fields.forEach((field, index) => {
      combinedPrompt += `**${index + 1}. ${field.label}** (${field.dataType})\n`;
      combinedPrompt += `   - Field Key: \`${field.fieldKey}\`\n`;
      combinedPrompt += `   - Type: ${field.fieldType}\n`;
      
      if (field.options?.dropdownOptions) {
        combinedPrompt += `   - Available Options: ${JSON.stringify(field.options.dropdownOptions)}\n`;
      }
      
      combinedPrompt += `   - Instruction: ${field.prompt}\n\n`;
    });
  });
  
  combinedPrompt += `## Output Format\n`;
  combinedPrompt += `Please provide the extracted data in JSON format with the following structure:\n`;
  combinedPrompt += `\`\`\`json\n`;
  combinedPrompt += `{\n`;
  fieldsWithPrompts.forEach((field, index) => {
    const isLast = index === fieldsWithPrompts.length - 1;
    combinedPrompt += `  "${field.fieldKey}": <extracted_value>${isLast ? '' : ','}\n`;
  });
  combinedPrompt += `}\n`;
  combinedPrompt += `\`\`\`\n`;
  
  // Log the generated prompt
  const promptLogMessage = `\n${'='.repeat(80)}\nGENERATED AI PROMPT\n${'='.repeat(80)}\n${combinedPrompt}\n${'='.repeat(80)}\n`;
  
  console.log(promptLogMessage);
  logger.info(promptLogMessage);
  
  // Return the prompt and field information
  return {
    prompt: combinedPrompt,
    fields: fieldsWithPrompts.map(field => ({
      id: field.id,
      fieldKey: field.fieldKey,
      label: field.label,
      fieldHeading: field.fieldHeading,
      dataType: field.dataType,
      fieldType: field.fieldType,
      prompt: field.prompt
    })),
    sectionName: section.sectionName,
    briefTitle: section.brief.title,
    s3Keys: s3Keys,
    totalDocuments: documentContents.length,
    totalFields: fieldsWithPrompts.length
  };
};

/**
 * Generate field values using AI by analyzing documents
 * @param {string} sectionId - The section ID to fetch fields from
 * @param {Array<string>} s3Keys - Array of S3 keys of uploaded documents
 * @returns {Promise<{extractedData: Object, prompt: string, fields: Array}>} Extracted field values and metadata
 */
const generateFieldValuesWithAI = async (sectionId, s3Keys) => {
  // Generate the prompt with document contents
  const promptData = await generateAIPromptForSection(sectionId, s3Keys);
  
  if (!promptData.prompt) {
    throw new Error('No fields with prompts found in this section');
  }
  
  logger.info(`Initializing Gemini AI for section: ${sectionId}`);
  
  // Initialize Gemini
  const gemini = new Gemini();
  gemini.initialize('gemini-flash-latest');
  
  const fileConverter = new FileConverter();
  const binaryFiles = [];
  
  // Fetch binary files (PDF, images) for Gemini
  // Text content (XLSX, PPTX) is already embedded in the prompt
  logger.info(`Processing ${s3Keys.length} document(s) for binary files...`);
  
  // Process all files in parallel using Promise.allSettled
  const filePromises = s3Keys.map(s3Key => 
    fileConverter.getFileFromS3ForGemini(s3Key)
      .then(fileContent => ({ s3Key, fileContent, status: 'fulfilled' }))
      .catch(error => ({ s3Key, error, status: 'rejected' }))
  );
  
  const results = await Promise.allSettled(filePromises);
  
  // Process results
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
      const { s3Key, fileContent } = result.value;
      
      // Only add binary files (PDF, images) - text is already in prompt
      if (typeof fileContent !== 'string') {
        binaryFiles.push(fileContent);
        logger.info(`Added binary file for Gemini: ${s3Key}`);
      } else {
        logger.info(`Skipped text file (already in prompt): ${s3Key}`);
      }
    } else {
      const s3Key = result.value?.s3Key || s3Keys[index];
      const errorMsg = result.value?.error?.message || result.reason?.message || 'Unknown error';
      logger.error(`Failed to fetch file for Gemini: ${s3Key} - ${errorMsg}`);
    }
  });
  
  logger.info(`Sending prompt to Gemini AI with ${binaryFiles.length} binary file(s)`);
  
  try {
    // Get AI response - pass binary files only if they exist
    const aiResponse = await gemini.getResponse(
      promptData.prompt, 
      binaryFiles.length > 0 ? binaryFiles : []
    );
    
    logger.info('Received response from Gemini AI');
    logger.info(`AI Response length: ${aiResponse.length} characters`);
    
    // Extract JSON from response
    let extractedData = null;
    
    // Try to find JSON in the response
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        extractedData = JSON.parse(jsonMatch[1].trim());
        logger.info('Successfully extracted JSON from AI response');
      } catch (parseError) {
        logger.error(`Failed to parse JSON from AI response: ${parseError.message}`);
      }
    }
    
    // If no JSON block found, try parsing the entire response
    if (!extractedData) {
      try {
        extractedData = JSON.parse(aiResponse);
        logger.info('Successfully parsed entire AI response as JSON');
      } catch (parseError) {
        logger.error(`Failed to parse entire response as JSON: ${parseError.message}`);
        // Return raw response if JSON parsing fails
        extractedData = { raw_response: aiResponse };
      }
    }
    
    // Log the extracted data
    const extractedDataLog = `\n${'='.repeat(80)}\nEXTRACTED FIELD VALUES\n${'='.repeat(80)}\n${JSON.stringify(extractedData, null, 2)}\n${'='.repeat(80)}\n`;
    console.log(extractedDataLog);
    logger.info(extractedDataLog);
    
    return {
      extractedData,
      rawResponse: aiResponse,
      prompt: promptData.prompt,
      fields: promptData.fields,
      sectionName: promptData.sectionName,
      briefTitle: promptData.briefTitle,
      totalFields: promptData.totalFields,
      totalDocuments: promptData.totalDocuments
    };
    
  } catch (error) {
    logger.error(`Gemini AI error: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    throw new Error(`Failed to generate field values with AI: ${error.message}`);
  }
};

module.exports = {
  generateAIPromptForSection,
  generateFieldValuesWithAI
};
