const prisma = require('../config/prisma.client').prisma;

const generateFieldKey = (inputName) => {
  if (!inputName) return `field_${Date.now()}`;
  return inputName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const createBriefFromTemplate = async (templateData, userId, title) => {
  const { templateName, sections } = templateData;
  
  return await prisma.$transaction(async (tx) => {
    const brief = await tx.brief.create({
      data: {
        title: title || templateName,
        templateName,
        createdById: userId,
        status: 'DRAFT'
      }
    });
    
    const existingSections = await tx.section.findMany({
      where: { briefId: brief.id },
      orderBy: { orderIndex: 'desc' },
      take: 1
    });
    
    const startOrderIndex = existingSections.length > 0 ? existingSections[0].orderIndex + 1 : 0;
    
    const createdSections = await Promise.all(
      sections.map((sectionData, index) =>
        tx.section.create({
          data: {
            briefId: brief.id,
            sectionName: sectionData.sectionName,
            orderIndex: startOrderIndex + index
          }
        })
      )
    );
    
    await Promise.all(
      createdSections.map((section, sectionIndex) => {
        const sectionData = sections[sectionIndex];
        
        if (!sectionData.inputFields || !Array.isArray(sectionData.inputFields)) {
          return Promise.resolve();
        }
        
        const fieldsToCreate = [];
        
        for (const inputFieldGroup of sectionData.inputFields) {
          if (inputFieldGroup.fields && Array.isArray(inputFieldGroup.fields)) {
            for (const field of inputFieldGroup.fields) {
              const fieldKey = generateFieldKey(field.inputName || inputFieldGroup.fieldsHeading);
              
              const options = {};
              if (field.options) options.dropdownOptions = field.options;
              if (field.helperText) options.helperText = field.helperText;
              if (field.inputValue !== undefined) options.defaultValue = field.inputValue;
              
              fieldsToCreate.push({
                sectionId: section.id,
                fieldKey,
                label: field.inputName || inputFieldGroup.fieldsHeading || 'Untitled Field',
                fieldHeading: inputFieldGroup.fieldsHeading || 'Basic Details',
                dataType: field.dataType || 'String',
                fieldType: field.fieldType || 'input',
                options: Object.keys(options).length > 0 ? options : null,
                prompt: field.prompt || null
              });
            }
          }
        }
        
        if (fieldsToCreate.length > 0) {
          return tx.field.createMany({
            data: fieldsToCreate
          });
        }
        
        return Promise.resolve();
      })
    )
    
    return await tx.brief.findUnique({
      where: { id: brief.id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            fields: true
          }
        }
      }
    });
  });
};

const getAllTemplates = async () => {
  const briefs = await prisma.brief.findMany({
    include: {
      sections: {
        orderBy: { orderIndex: 'asc' },
        include: {
          fields: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return briefs.map(brief => ({
    id: brief.id,
    title: brief.title,
    templateName: brief.templateName,
    sections: brief.sections.map(section => {
      // Group fields by fieldHeading
      const fieldsByHeading = section.fields.reduce((acc, field) => {
        const heading = field.fieldHeading || 'Basic Details';
        if (!acc[heading]) {
          acc[heading] = [];
        }
        acc[heading].push(field);
        return acc;
      }, {});
      
      return {
        sectionName: section.sectionName,
        id: section.id,
        inputFields: Object.entries(fieldsByHeading).map(([heading, fields]) => ({
          fieldsHeading: heading,
          fields: fields.map(field => ({
            inputName: field.label,
            dataType: field.dataType,
            fieldType: field.fieldType,
            options: field.options?.dropdownOptions || undefined,
            helperText: field.options?.helperText || undefined,
            inputValue: field.options?.defaultValue || undefined,
            prompt: field.prompt || undefined
          }))
        }))
      };
    })
  }));
};

const getTemplateById = async (id,userId) => {
  const brief = await prisma.brief.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { orderIndex: 'asc' },
        include: {
          fields: {
            include: {
              values: {
                where: {
                  updatedById: userId
                },
                orderBy: {
                  updatedAt: 'desc'
                },
                take: 1 // Get only the most recent value from this user
              }
            }
          }
        }
      }
    }
  });
  
  return brief;
};
module.exports = {
  createBriefFromTemplate,
  getAllTemplates,
  getTemplateById
};
