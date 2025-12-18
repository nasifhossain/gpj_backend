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

module.exports = {
  createBrief
};
