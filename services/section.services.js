const prisma = require('../config/prisma.client').prisma;

const createSection = async (sectionData) => {
  const { briefId, sectionName, orderIndex } = sectionData;
  
  const brief = await prisma.brief.findUnique({
    where: { id: briefId }
  });
  
  if (!brief) {
    throw new Error('Brief not found');
  }
  
  const section = await prisma.section.create({
    data: {
      briefId,
      sectionName,
      orderIndex
    },
    include: {
      brief: {
        select: {
          id: true,
          title: true,
          templateName: true,
          status: true
        }
      }
    }
  });
  
  return section;
};

const createMultipleSections = async (briefId, sectionsData) => {
  const brief = await prisma.brief.findUnique({
    where: { id: briefId }
  });
  
  if (!brief) {
    throw new Error('Brief not found');
  }
  
  const existingSections = await prisma.section.findMany({
    where: { briefId },
    orderBy: { orderIndex: 'desc' },
    take: 1
  });
  
  const startOrderIndex = existingSections.length > 0 ? existingSections[0].orderIndex + 1 : 0;
  
  const sections = await prisma.section.createMany({
    data: sectionsData.map((section, index) => ({
      briefId,
      sectionName: section.sectionName,
      orderIndex: startOrderIndex + index
    }))
  });
  
  const createdSections = await prisma.section.findMany({
    where: { briefId },
    include: {
      brief: {
        select: {
          id: true,
          title: true,
          templateName: true,
          status: true
        }
      }
    },
    orderBy: { orderIndex: 'asc' }
  });
  
  return createdSections;
};

module.exports = {
  createSection,
  createMultipleSections
};
