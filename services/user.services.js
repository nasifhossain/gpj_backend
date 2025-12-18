
const prisma = require('../config/prisma.client').prisma;
 const bcrypt = require('bcrypt');
// const prisma = new PrismaClient();

const createUser = async (userData) => {
  const { name, email, role,password } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      password: hashedPassword
    }
  });
  
  return user;
};

module.exports = {
  createUser
};
