const prisma = require('../config/prisma.client').prisma;
const logger = require('../helper/logger.helper');
const FileConverter = require('../helper/fileConverter.helper');
const Gemini = require('../libraries/gemini/gemini.lib');

/**
 * Save extracted field values to database
 * @param {string} sectionId - The section ID
 * @param {string} briefId - The brief ID (not used in current schema, kept for future)
 * @param {Object} extractedData - The extracted field values {fieldKey: value}
 * @param {string} modelUsed - The AI model used
 * @param {string} userId - The user ID performing the action
 * @returns {Promise<{saved: number, skipped: number, errors: Array}>} Save results
 */
const saveFieldValues = async (sectionId, briefId, extractedData, modelUsed = 'gemini-flash-latest', userId) => {
  logger.info(`Saving field values for section: ${sectionId}, brief: ${briefId}`);
  
  const results = {
    saved: 0,
    skipped: 0,
    updated: 0,
    errors: []
  };
  
  // Get all fields in this section with their IDs
  const fields = await prisma.field.findMany({
    where: { sectionId },
    select: {
      id: true,
      fieldKey: true
    }
  });
  
  logger.info(`Found ${fields.length} fields in section`);
  
  // Create a map of fieldKey -> fieldId
  const fieldMap = {};
  fields.forEach(field => {
    fieldMap[field.fieldKey] = field.id;
  });
  
  // Process each extracted field value
  for (const [fieldKey, value] of Object.entries(extractedData)) {
    try {
      const fieldId = fieldMap[fieldKey];
      
      if (!fieldId) {
        logger.error(`Field not found for key: ${fieldKey} in section: ${sectionId}`);
        results.errors.push({ fieldKey, error: 'Field not found' });
        continue;
      }
      
      // Check if field value already exists (only by fieldId since briefId is not in FieldValue model)
      const existingValue = await prisma.fieldValue.findFirst({
        where: {
          fieldId
        }
      });
      
      // Skip if source is MANUAL (user input should not be overwritten)
      if (existingValue && existingValue.source === 'MANUAL') {
        logger.info(`Skipping field ${fieldKey}: source is MANUAL`);
        results.skipped++;
        continue;
      }
      
      // Determine confidence based on value
      let confidence = 0.85;
      if (value === 'Nil' || value === null || value === '') {
        confidence = 0.3;
      }
      
      // Create or update the field value
      if (existingValue) {
        await prisma.fieldValue.update({
          where: {
            id: existingValue.id
          },
          data: {
            value: value === null ? '' : String(value),
            source: 'AI',
            confidence,
            modelUsed,
            updatedById: userId
          }
        });
        logger.info(`Updated field value for ${fieldKey}`);
        results.updated++;
      } else {
        await prisma.fieldValue.create({
          data: {
            fieldId,
            value: value === null ? '' : String(value),
            source: 'AI',
            confidence,
            modelUsed,
            updatedById: userId
          }
        });
        logger.info(`Created field value for ${fieldKey}`);
        results.saved++;
      }
      
    } catch (error) {
      logger.error(`Error saving field value for ${fieldKey}: ${error.message}`);
      results.errors.push({ fieldKey, error: error.message });
    }
  }
  
  logger.info(`Field values saved: ${results.saved}, updated: ${results.updated}, skipped: ${results.skipped}, errors: ${results.errors.length}`);
  
  return results;
};

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
  
  // Process all files in parallel using Promise.allSettled
  const documentPromises = s3Keys.map((s3Key, index) => 
    fileConverter.getFileFromS3ForGemini(s3Key)
      .then(fileContent => {
        logger.info(`Processing document ${index + 1}/${s3Keys.length}: ${s3Key}`);
        return { s3Key, fileContent, status: 'fulfilled' };
      })
      .catch(error => ({ s3Key, error, status: 'rejected' }))
  );
  
  const results = await Promise.allSettled(documentPromises);
  
  // Process results and build documentContents array
  const documentContents = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
      const { s3Key, fileContent } = result.value;
      
      // Check if it's PPTX with images
      if (fileContent && typeof fileContent === 'object' && fileContent.type === 'pptx') {
        // PPTX with text and images
        documentContents.push({
          name: s3Key,
          type: 'pptx',
          content: fileContent.text,
          images: fileContent.images,
          imageCount: fileContent.imageCount
        });
        logger.info(`Successfully processed PPTX file: ${s3Key} with ${fileContent.imageCount} images`);
      } else if (typeof fileContent === 'string') {
        // Text extraction (XLSX)
        documentContents.push({
          name: s3Key,
          type: 'text',
          content: fileContent
        });
        logger.info(`Successfully processed text file: ${s3Key}`);
      } else {
        // Binary file (PDF, images)
        documentContents.push({
          name: s3Key,
          type: 'binary',
          mimeType: fileContent.inlineData.mimeType,
          content: `[Binary file: ${s3Key}]`
        });
        logger.info(`Successfully processed binary file: ${s3Key}`);
      }
    } else {
      const s3Key = result.value?.s3Key || s3Keys[index];
      const errorMsg = result.value?.error?.message || result.reason?.message || 'Unknown error';
      logger.error(`Failed to fetch document ${s3Key}: ${errorMsg}`);
      documentContents.push({
        name: s3Key,
        type: 'error',
        content: `[Error: Could not fetch this document - ${errorMsg}]`
      });
    }
  });
  
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
    } else if (doc.type === 'pptx') {
      combinedPrompt += `Type: PowerPoint Presentation\n`;
      combinedPrompt += `Extracted Text:\n${doc.content}\n`;
      if (doc.imageCount > 0) {
        combinedPrompt += `\nNote: This presentation contains ${doc.imageCount} image(s) that will be analyzed separately.\n`;
      }
      combinedPrompt += `\n`;
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
  combinedPrompt += `5. For PDFs, make sure to scan all pages and sections carefully, Pdf may have non text elements so be careful\n\n`;
  
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
    sectionId: section.id,
    briefTitle: section.brief.title,
    briefId: section.brief.id,
    s3Keys: s3Keys,
    totalDocuments: documentContents.length,
    totalFields: fieldsWithPrompts.length
  };
};

/**
 * Generate field values using AI by analyzing documents
 * @param {string} sectionId - The section ID to fetch fields from
 * @param {Array<string>} s3Keys - Array of S3 keys of uploaded documents
 * @param {string} userId - The user ID performing the action
 * @returns {Promise<{extractedData: Object, prompt: string, fields: Array}>} Extracted field values and metadata
 */
const generateFieldValuesWithAI = async (sectionId, s3Keys, userId) => {
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
      
      // Check if it's PPTX with images
      if (fileContent && typeof fileContent === 'object' && fileContent.type === 'pptx') {
        // Add PPTX images to Gemini files array
        if (fileContent.images && fileContent.images.length > 0) {
          binaryFiles.push(...fileContent.images);
          logger.info(`Added ${fileContent.images.length} images from PPTX: ${s3Key}`);
        } else {
          logger.info(`PPTX has no images (text already in prompt): ${s3Key}`);
        }
      } else if (typeof fileContent === 'string') {
        // Text file - already in prompt
        logger.info(`Skipped text file (already in prompt): ${s3Key}`);
      } else if (fileContent && fileContent.inlineData) {
        // Binary file (PDF, standalone images)
        binaryFiles.push(fileContent);
        logger.info(`Added binary file for Gemini: ${s3Key}`);
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
    
    // Save field values to database if extraction was successful
    let saveResults = null;
    if (extractedData && !extractedData.raw_response && userId) {
      try {
        logger.info('Saving extracted field values to database...');
        saveResults = await saveFieldValues(
          promptData.sectionId,
          promptData.briefId,
          extractedData,
          'gemini-flash-latest',
          userId
        );
        logger.info(`Save completed: ${saveResults.saved} created, ${saveResults.updated} updated, ${saveResults.skipped} skipped`);
      } catch (saveError) {
        logger.error(`Failed to save field values: ${saveError.message}`);
        // Don't throw - return the extracted data even if save fails
      }
    } else if (!userId) {
      logger.warn('userId not provided, skipping field value save');
    }
    
    return {
      extractedData,
      saveResults,
      rawResponse: aiResponse,
      prompt: promptData.prompt,
      fields: promptData.fields,
      sectionName: promptData.sectionName,
      briefTitle: promptData.briefTitle,
      briefId: promptData.briefId,
      sectionId: promptData.sectionId,
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
  generateFieldValuesWithAI,
  saveFieldValues
};
