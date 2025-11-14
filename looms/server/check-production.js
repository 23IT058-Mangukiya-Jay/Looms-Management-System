import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Production from './models/Production.model.js';
import Machine from './models/Machine.model.js';
import Worker from './models/Worker.model.js';
import Taka from './models/Taka.model.js';
import QualityType from './models/QualityType.model.js';

dotenv.config();

const checkProductionData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    // Check total production records
    const totalRecords = await Production.countDocuments();
    console.log(`📊 Total production records: ${totalRecords}`);
    
    // Check sample production records with earnings
    const sampleRecords = await Production.find({}).limit(5).populate('machine worker taka qualityType');
    console.log('\n🔍 Sample Production Records:');
    sampleRecords.forEach((record, index) => {
      console.log(`${index + 1}. Date: ${record.date.toDateString()}, Meters: ${record.metersProduced}, Rate: ${record.ratePerMeter}, Earnings: ${record.earnings}`);
    });
    
    // Check earnings calculation
    const recordsWithEarnings = await Production.find({ earnings: { $gt: 0 } }).countDocuments();
    const recordsWithZeroEarnings = await Production.find({ earnings: { $lte: 0 } }).countDocuments();
    
    console.log(`\n💰 Records with earnings > 0: ${recordsWithEarnings}`);
    console.log(`💸 Records with earnings = 0: ${recordsWithZeroEarnings}`);
    
    // Check today's data
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    
    const todayRecords = await Production.find({
      date: { $gte: startOfToday, $lte: endOfToday }
    });
    
    console.log(`\n📅 Today's records: ${todayRecords.length}`);
    
    // Check if earnings field is being calculated properly
    const recordsNeedingEarningsUpdate = await Production.find({
      $expr: { $ne: ['$earnings', { $multiply: ['$metersProduced', '$ratePerMeter'] }] }
    });
    
    console.log(`🔧 Records needing earnings update: ${recordsNeedingEarningsUpdate.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkProductionData();