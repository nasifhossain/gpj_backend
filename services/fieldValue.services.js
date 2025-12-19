const prisma = require('../config/prisma.client').prisma;
const logger = require('../helper/logger.helper');
const FileConverter = require('../helper/fileConverter.helper');

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
  combinedPrompt += `Please analyze the provided document and extract the following information. For each field, follow the specific instructions provided. If the information is not found, respond with 'Nil' for that field.\n\n`;
  
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

module.exports = {
  generateAIPromptForSection
};
