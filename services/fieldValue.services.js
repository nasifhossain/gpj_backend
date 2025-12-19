const prisma = require('../config/prisma.client').prisma;
const logger = require('../helper/logger.helper');

/**
 * Generate AI prompt by combining all field prompts in a section
 * @param {string} sectionId - The section ID to fetch fields from
 * @param {string} s3Key - The S3 key of the uploaded document
 * @returns {Promise<{prompt: string, fields: Array}>} Combined prompt and field information
 */
const generateAIPromptForSection = async (sectionId, s3Key) => {
  // Validate inputs
  if (!sectionId || typeof sectionId !== 'string') {
    throw new Error('Section ID is required and must be a string');
  }
  
  if (!s3Key || typeof s3Key !== 'string') {
    throw new Error('S3 key is required and must be a string');
  }
  
  logger.info(`Generating AI prompt for section: ${sectionId}, s3Key: ${s3Key}`);
  
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
      briefTitle: section.brief.title
    };
  }
  
  logger.info(`Found ${fieldsWithPrompts.length} fields with prompts`);
  
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
  combinedPrompt += `- Document: ${s3Key}\n\n`;
  
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
    s3Key: s3Key,
    totalFields: fieldsWithPrompts.length
  };
};

module.exports = {
  generateAIPromptForSection
};
