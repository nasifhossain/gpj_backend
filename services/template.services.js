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

const updateBriefFromTemplate = async (briefId, templateData, title) => {
  const { templateName, sections } = templateData;

  return await prisma.$transaction(async (tx) => {
    // Update the brief
    const brief = await tx.brief.update({
      where: { id: briefId },
      data: {
        title: title || templateName,
        templateName
      }
    });

    // Get existing sections to track which ones to keep/update/delete
    const existingSections = await tx.section.findMany({
      where: { briefId: brief.id },
      include: { fields: true }
    });

    const existingSectionIds = existingSections.map(s => s.id);
    const incomingSectionIds = sections.filter(s => s.id).map(s => s.id);

    // Delete sections that are not in the incoming data
    const sectionsToDelete = existingSectionIds.filter(id => !incomingSectionIds.includes(id));
    if (sectionsToDelete.length > 0) {
      await tx.section.deleteMany({
        where: { id: { in: sectionsToDelete } }
      });
    }

    // Process each section
    const processedSections = await Promise.all(
      sections.map(async (sectionData, index) => {
        let section;

        if (sectionData.id) {
          // Update existing section
          section = await tx.section.update({
            where: { id: sectionData.id },
            data: {
              sectionName: sectionData.sectionName,
              orderIndex: index
            }
          });
        } else {
          // Create new section
          section = await tx.section.create({
            data: {
              briefId: brief.id,
              sectionName: sectionData.sectionName,
              orderIndex: index
            }
          });
        }

        return { section, sectionData };
      })
    );

    // Process fields for each section
    await Promise.all(
      processedSections.map(async ({ section, sectionData }) => {
        if (!sectionData.inputFields || !Array.isArray(sectionData.inputFields)) {
          return Promise.resolve();
        }

        // Get existing fields for this section
        const existingFields = await tx.field.findMany({
          where: { sectionId: section.id }
        });

        const existingFieldIds = existingFields.map(f => f.id);
        const fieldsToCreate = [];
        const fieldsToUpdate = [];

        // Collect all incoming field IDs
        const incomingFieldIds = [];
        for (const inputFieldGroup of sectionData.inputFields) {
          if (inputFieldGroup.fields && Array.isArray(inputFieldGroup.fields)) {
            for (const field of inputFieldGroup.fields) {
              if (field.id) {
                incomingFieldIds.push(field.id);
              }
            }
          }
        }

        // Delete fields that are not in the incoming data
        const fieldsToDelete = existingFieldIds.filter(id => !incomingFieldIds.includes(id));
        if (fieldsToDelete.length > 0) {
          await tx.field.deleteMany({
            where: { id: { in: fieldsToDelete } }
          });
        }

        // Process each field
        for (const inputFieldGroup of sectionData.inputFields) {
          if (inputFieldGroup.fields && Array.isArray(inputFieldGroup.fields)) {
            for (const field of inputFieldGroup.fields) {
              const fieldKey = generateFieldKey(field.inputName || inputFieldGroup.fieldsHeading);

              const options = {};
              if (field.options) options.dropdownOptions = field.options;
              if (field.helperText) options.helperText = field.helperText;
              if (field.inputValue !== undefined) options.defaultValue = field.inputValue;

              const fieldData = {
                fieldKey,
                label: field.inputName || inputFieldGroup.fieldsHeading || 'Untitled Field',
                fieldHeading: inputFieldGroup.fieldsHeading || 'Basic Details',
                dataType: field.dataType || 'String',
                fieldType: field.fieldType || 'input',
                options: Object.keys(options).length > 0 ? options : null,
                prompt: field.prompt || null
              };

              if (field.id) {
                // Update existing field
                fieldsToUpdate.push(
                  tx.field.update({
                    where: { id: field.id },
                    data: fieldData
                  })
                );
              } else {
                // Create new field
                fieldsToCreate.push({
                  sectionId: section.id,
                  ...fieldData
                });
              }
            }
          }
        }

        // Execute all field updates
        if (fieldsToUpdate.length > 0) {
          await Promise.all(fieldsToUpdate);
        }

        // Execute all field creates
        if (fieldsToCreate.length > 0) {
          await tx.field.createMany({
            data: fieldsToCreate
          });
        }

        return Promise.resolve();
      })
    );

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
            id: field.id,
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

const getAllTemplatesPreview = async () => {
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

  // Get submission users for all briefs in parallel
  const briefsWithSubmissions = await Promise.all(
    briefs.map(async (brief) => {
      // Get all field IDs for this brief
      const fieldIds = brief.sections.flatMap(section =>
        section.fields.map(field => field.id)
      );

      // Get unique user IDs who have submitted field values
      let submissions = [];
      if (fieldIds.length > 0) {
        const uniqueUserIds = await prisma.fieldValue.groupBy({
          by: ['updatedById'],
          where: {
            fieldId: {
              in: fieldIds
            }
          }
        }).then(results => results.map(r => r.updatedById));

        // Fetch user details for each unique user
        if (uniqueUserIds.length > 0) {
          submissions = await prisma.user.findMany({
            where: {
              id: {
                in: uniqueUserIds
              }
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          });
        }
      }

      return {
        id: brief.id,
        title: brief.title,
        templateName: brief.templateName,
        submissions,
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
      };
    })
  );

  return briefsWithSubmissions;
};

const getTemplateById = async (id, userId) => {
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
  updateBriefFromTemplate,
  getAllTemplates,
  getTemplateById,
  getAllTemplatesPreview
};
