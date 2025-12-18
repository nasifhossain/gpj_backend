const prisma = require('../config/prisma.client').prisma;

const createField = async (fieldData) => {
  const { sectionId, fieldKey, label, dataType, fieldType, options, prompt } = fieldData;
  
  const section = await prisma.section.findUnique({
    where: { id: sectionId }
  });
  
  if (!section) {
    throw new Error('Section not found');
  }
  
  const field = await prisma.field.create({
    data: {
      sectionId,
      fieldKey,
      label,
      dataType,
      fieldType,
      options,
      prompt
    },
    include: {
      section: {
        select: {
          id: true,
          sectionName: true,
          briefId: true
        }
      }
    }
  });
  
  return field;
};

const createMultipleFields = async (sectionId, fieldsData) => {
  const section = await prisma.section.findUnique({
    where: { id: sectionId }
  });
  
  if (!section) {
    throw new Error('Section not found');
  }
  
  const fields = await prisma.field.createMany({
    data: fieldsData.map(field => ({
      sectionId,
      fieldKey: field.fieldKey,
      label: field.label,
      dataType: field.dataType,
      fieldType: field.fieldType,
      options: field.options || null,
      prompt: field.prompt || null
    }))
  });
  
  const createdFields = await prisma.field.findMany({
    where: { sectionId },
    include: {
      section: {
        select: {
          id: true,
          sectionName: true,
          briefId: true
        }
      }
    }
  });
  
  return createdFields;
};

module.exports = {
  createField,
  createMultipleFields
};
