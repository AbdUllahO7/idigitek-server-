import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import SectionModel from '../models/sections.model';
import SubSectionModel from '../models/subSections.model';
import ContentElementModel from '../models/ContentElement.model';
import ContentTranslationModel from '../models/ContentTranslation.model';

export async function createOptimizedIndexes() {
  try {
    await connectDatabase();
    
    console.log('Creating optimized indexes...');
    
    // Create indexes for all models
    await Promise.all([
      SectionModel.createIndexes(),
      SubSectionModel.createIndexes(),
      ContentElementModel.createIndexes(),
      ContentTranslationModel.createIndexes()
    ]);
    
    console.log('All indexes created successfully');
    
    // Get index information
    const collections = [
      { name: 'Sections', model: SectionModel },
      { name: 'SubSections', model: SubSectionModel },
      { name: 'ContentElement', model: ContentElementModel },
      { name: 'ContentTranslation', model: ContentTranslationModel }
    ];
    
    for (const collection of collections) {
      const indexes = await collection.model.collection.getIndexes();
      console.log(`${collection.name} indexes:`, Object.keys(indexes));
    }
    
  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run this script: npm run create-indexes
if (require.main === module) {
  createOptimizedIndexes();
}