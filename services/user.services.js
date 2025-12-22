
const prisma = require('../config/prisma.client').prisma;
const bcrypt = require('bcrypt');
const { generateToken } = require('../libraries/jwt/jwt');
// const prisma = new PrismaClient();

const createUser = async (userData) => {
  const { name, email, role, password } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  if (existingUser) {
    throw new Error('User already exists');
  }
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      password: hashedPassword
    }
  });
  const userWithoutPassword = { ...user, password: undefined, createdAt: undefined }
  return userWithoutPassword;
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
  const { password: _, createdAt, ...userWithoutPassword } = user;
  const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role }, { expiresIn: '24h' });
  userWithoutPassword.token = token;
  return userWithoutPassword;
};

const updateUser = async (id, userData) => {
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id }
  });

  if (!existingUser) {
    throw new Error('User not found');
  }

  // Prepare update data object
  const updateData = {};

  // Handle name update
  if (userData.name !== undefined) {
    if (!userData.name || userData.name.trim() === '') {
      throw new Error('Name cannot be empty');
    }
    updateData.name = userData.name.trim();
  }

  // Handle email update
  if (userData.email !== undefined) {
    if (!userData.email || userData.email.trim() === '') {
      throw new Error('Email cannot be empty');
    }

    // Check if email is already taken by another user
    const emailExists = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (emailExists && emailExists.id !== id) {
      throw new Error('Email already in use');
    }

    updateData.email = userData.email.trim();
  }

  // Handle password update
  if (userData.password !== undefined) {
    if (!userData.password || userData.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    updateData.password = await bcrypt.hash(userData.password, 10);
  }

  // Handle role update (only if provided)
  if (userData.role !== undefined) {
    const validRoles = ['ADMIN', 'CLIENT'];
    if (!validRoles.includes(userData.role)) {
      throw new Error('Invalid role. Must be ADMIN or CLIENT');
    }
    updateData.role = userData.role;
  }

  // If no valid fields to update
  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid fields to update');
  }

  // Update user
  const user = await prisma.user.update({
    where: { id },
    data: updateData
  });

  // Return user without sensitive data
  const { password: _, createdAt, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

const getAllUsers = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  });
  return users;
};

module.exports = {
  createUser,
  loginUser,
  updateUser,
  getAllUsers
};
