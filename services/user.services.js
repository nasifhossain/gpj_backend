
const prisma = require('../config/prisma.client').prisma;
 const bcrypt = require('bcrypt');
const generateToken = require('../libraries/jwt/genarate_token');
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

const loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid password');
  }
  const { password: _,createdAt, ...userWithoutPassword } = user;
  const token = generateToken({ id: user.id, email: user.email, role: user.role }, { expiresIn: '6h' });
  userWithoutPassword.token = token; 
  return userWithoutPassword;
};

module.exports = {
  createUser,
  loginUser
};
