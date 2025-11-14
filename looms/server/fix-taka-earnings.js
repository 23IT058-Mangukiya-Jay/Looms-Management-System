import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Taka from './models/Taka.model.js';
import Production from './models/Production.model.js';
import Machine from './models/Machine.model.js';
import QualityType from './models/QualityType.model.js';

dotenv.config();

const fixTakaEarnings = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    const allTakas = await Taka.find({});
    console.log(`🔧 Found ${allTakas.length} Takas to update`);
    
    let updatedCount = 0;
    
    for (const taka of allTakas) {
      // Calculate total meters from production records for this taka
      const productionTotal = await Production.aggregate([
        { $match: { taka: taka._id } },
        { $group: { _id: null, totalMeters: { $sum: '$metersProduced' } } }
      ]);
      
      const actualTotalMeters = productionTotal[0]?.totalMeters || 0;
      const newEarnings = actualTotalMeters * taka.ratePerMeter;
      
      // Update the taka with correct totalMeters and totalEarnings
      await Taka.findByIdAndUpdate(taka._id, {
        totalMeters: actualTotalMeters,
        totalEarnings: newEarnings
      });
      
      console.log(`Fixed ${taka.takaNumber}: ${actualTotalMeters} meters × ${taka.ratePerMeter} rate = ${newEarnings} earnings`);
      updatedCount++;
    }
    
    console.log(`\n✅ Updated ${updatedCount} Taka records`);
    
    // Verify the fix
    const remainingZeroEarnings = await Taka.countDocuments({ totalEarnings: 0 });
    const takasWithEarnings = await Taka.countDocuments({ totalEarnings: { $gt: 0 } });
    
    console.log(`\n📊 After fix:`);
    console.log(`  - Takas with earnings > 0: ${takasWithEarnings}`);
    console.log(`  - Takas with earnings = 0: ${remainingZeroEarnings}`);
    
    // Calculate total Taka earnings
    const totalTakaEarnings = await Taka.aggregate([
      { $group: { _id: null, total: { $sum: '$totalEarnings' } } }
    ]);
    
    console.log(`💰 Total Taka earnings in system: ${totalTakaEarnings[0]?.total || 0}`);
    
    // Show updated sample
    console.log('\n🔍 Updated Sample Taka Records:');
    const updatedSamples = await Taka.find({}).limit(5);
    updatedSamples.forEach((taka, index) => {
      console.log(`${index + 1}. ${taka.takaNumber}: ${taka.totalMeters} meters × ${taka.ratePerMeter} rate = ${taka.totalEarnings} earnings`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

fixTakaEarnings();