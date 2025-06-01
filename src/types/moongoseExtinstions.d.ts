import { PopulateOptions } from 'mongoose';

// Extend Mongoose's type definitions to properly include refPath
declare module 'mongoose' {
  interface PopulateOptions {
    refPath?: string;
    match?: any;
    options?: any;
  }
}

interface ExtendedPopulateOptions extends PopulateOptions {
    refPath?: string;
  }