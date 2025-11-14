import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Taka from './models/Taka.model.js';
import Production from './models/Production.model.js';
import Machine from './models/Machine.model.js';
import QualityType from './models/QualityType.model.js';

dotenv.config();

const checkTakaData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    // Check total Taka records
    const totalTakas = await Taka.countDocuments();
    console.log(`📊 Total Taka records: ${totalTakas}`);
    
    // Check sample Taka records with earnings
    const sampleTakas = await Taka.find({}).limit(5).populate('machine qualityType');
    console.log('\n🔍 Sample Taka Records:');
    sampleTakas.forEach((taka, index) => {
      console.log(`${index + 1}. ${taka.takaNumber}: ${taka.totalMeters} meters × ${taka.ratePerMeter} rate = ${taka.totalEarnings} earnings`);
    });
    
    // Check earnings status
    const takasWithEarnings = await Taka.find({ totalEarnings: { $gt: 0 } }).countDocuments();
    const takasWithZeroEarnings = await Taka.find({ totalEarnings: { $lte: 0 } }).countDocuments();
    
    console.log(`\n💰 Takas with earnings > 0: ${takasWithEarnings}`);
    console.log(`💸 Takas with earnings = 0: ${takasWithZeroEarnings}`);
    
    // Check if Takas have production records and update their totalMeters
    console.log('\n🔄 Checking Taka meter totals from production...');
    
    const allTakas = await Taka.find({});
    for (const taka of allTakas) {
      // Get total meters produced for this taka
      const productionTotal = await Production.aggregate([
        { $match: { taka: taka._id } },
        { $group: { _id: null, totalMeters: { $sum: '$metersProduced' } } }
      ]);
      
      const actualMeters = productionTotal[0]?.totalMeters || 0;
      console.log(`${taka.takaNumber}: DB meters=${taka.totalMeters}, Production meters=${actualMeters}`);
      
      // If there's a discrepancy, we need to update
      if (taka.totalMeters !== actualMeters) {
        console.log(`  ⚠️  Mismatch detected! Should update ${taka.takaNumber}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkTakaData();