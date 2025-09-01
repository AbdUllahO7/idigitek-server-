import UserModel from '../models/user.model';
import { UserRole, UserStatus } from '../types/user.types';
import mongoose from 'mongoose';
import logger from '../config/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Connect to MongoDB
 */
const connectToDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/idigitek';
    
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });
    
    console.log('✅ Connected to MongoDB successfully!');
    
    // Wait for connection to be ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        mongoose.connection.once('open', resolve);
      });
    }
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
};

/**
 * Script to insert the idigitekAdmin user
 * Run this once to create the admin user in your database
 */
const insertAdminUser = async () => {
  try {
    // Check if admin user already exists
    const existingAdmin = await UserModel.findOne({ 
      email: 'idigitekAdmin@idigitek.com' 
    });
    
    if (existingAdmin) {
      console.log('Admin user already exists!');
      return;
    }

    // Create the admin user
    const adminUser = new UserModel({
      email: 'idigitekAdmin@idigitek.com',
      password: 'idigitek176984', 
      firstName: 'IDigi',
      lastName: 'Admin',
      role: 'idigitekAdmin', // Make sure this role exists in your UserRole enum
      status: UserStatus.ACTIVE, // Set as active immediately
      isEmailVerified: true, // Admin doesn't need email verification
      failedLoginAttempts: 0,
      createdAt: new Date(),
    });

    // Save the admin user
    await adminUser.save();
    
    console.log('Admin user created successfully!');
    console.log('Email:', adminUser.email);
    console.log('Role:', adminUser.role);
    console.log('Status:', adminUser.status);
    
    return adminUser;
    
  } catch (error) {
    console.error('Error creating admin user:', error);
    logger.error('Failed to create admin user:', error);
    throw error;
  }
};

// Alternative: Using the existing register service
const insertAdminUserViaService = async () => {
  try {
    const authService = (await import('../services/auth.service')).default;
    
    const adminData = {
      email: 'idigitekAdmin@idigitek.com',
      password: 'idigitek176984',
      firstName: 'IDigi',
      lastName: 'Admin',
    };

    const result = await authService.register(adminData);
    
    // Update the user to have admin role and active status
    const user = await UserModel.findById(result.user.id);
    if (user) {
      user.role = UserRole.IDIGITEKADMIN;
      user.status = UserStatus.ACTIVE;
      user.isEmailVerified = true;
      await user.save();
      
      console.log('Admin user created and updated successfully!');
      console.log('User ID:', user._id);
      console.log('Email:', user.email);
      console.log('Role:', user.role);
    }
    
    return result;
    
  } catch (error) {
    console.error('Error creating admin user via service:', error);
    throw error;
  }
};

// Main execution function
const main = async () => {
  try {
    // Connect to database first
    await connectToDatabase();
    
    console.log('Creating admin user...');
    await insertAdminUser();
    
    console.log('✅ Script completed successfully!');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    // Always close the database connection
    if (mongoose.connection.readyState === 1) {
      console.log('Closing database connection...');
      await mongoose.connection.close();
      console.log('Database connection closed.');
    }
    process.exit(0);
  }
};

// Export functions for use in other scripts
export { insertAdminUser, insertAdminUserViaService };

// Run the script if called directly
if (require.main === module) {
  main();
}