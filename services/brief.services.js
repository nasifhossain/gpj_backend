const prisma = require('../config/prisma.client').prisma;

const createBrief = async (briefData, userId) => {
  const { title, templateName } = briefData;
  
  const brief = await prisma.brief.create({
    data: {
      title,
      templateName,
      createdById: userId,
      status: 'DRAFT'
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  });
  
  return brief;
};

/**
 * Get brief by ID with all sections, fields, and field values
 * @param {string} briefId - The brief ID
 * @param {string} userId - The user ID to filter field values
 * @returns {Promise<Object>} Brief with sections, fields, and values
 */
const getBriefById = async (briefId, userId) => {
  const brief = await prisma.brief.findUnique({
    where: { id: briefId },
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
          fields: {
            orderBy: { fieldKey: 'asc' },
            include: {
              values: {
                where: {
                  updatedById: userId
                },
                include: {
                  updatedBy: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                },
                orderBy: {
                  updatedAt: 'desc'
                },
                take: 1 // Get only the latest value
              }
            }
          }
        }
      },
      documents: {
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          uploadedAt: 'desc'
        }
      }
    }
  });
  
  if (!brief) {
    throw new Error(`Brief not found with ID: ${briefId}`);
  }
  
  // Transform the response to flatten field values
  const transformedBrief = {
    ...brief,
    sections: brief.sections.map(section => ({
      ...section,
      fields: section.fields.map(field => ({
        id: field.id,
        fieldKey: field.fieldKey,
        label: field.label,
        fieldHeading: field.fieldHeading,
        dataType: field.dataType,
        fieldType: field.fieldType,
        options: field.options,
        prompt: field.prompt,
        value: field.values[0] || null // Latest value or null
      }))
    }))
  };
  
  return transformedBrief;
};

module.exports = {
  createBrief,
  getBriefById
};
