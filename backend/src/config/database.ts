import mongoose from 'mongoose';
import config from './index';
import logger from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  try {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Connection events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
      logger.error(`MongoDB connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
      logger.warn('MongoDB disconnected');
    });
    
  } catch (error: any) {
    console.error(`FATAL: Failed to connect to MongoDB: ${error.message}`);
    console.error(`Connection string starts with: ${config.mongoUri?.substring(0, 40)}...`);
    logger.error(`Error connecting to MongoDB: ${error}`);
    process.exit(1);
  }
};

export default connectDB;
