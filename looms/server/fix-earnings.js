import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Production from './models/Production.model.js';
import Machine from './models/Machine.model.js';
import Worker from './models/Worker.model.js';
import Taka from './models/Taka.model.js';
import QualityType from './models/QualityType.model.js';

dotenv.config();

const fixEarningsData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    // Find all production records with 0 earnings
    const recordsToFix = await Production.find({ earnings: 0 });
    console.log(`🔧 Found ${recordsToFix.length} records to fix`);
    
    let fixedCount = 0;
    
    for (const record of recordsToFix) {
      const newEarnings = record.metersProduced * record.ratePerMeter;
      
      await Production.findByIdAndUpdate(record._id, {
        earnings: newEarnings
      });
      
      console.log(`Fixed record ${record._id}: ${record.metersProduced} meters × ${record.ratePerMeter} rate = ${newEarnings} earnings`);
      fixedCount++;
    }
    
    console.log(`\n✅ Fixed ${fixedCount} production records`);
    
    // Verify the fix
    const remainingZeroRecords = await Production.countDocuments({ earnings: 0 });
    const recordsWithEarnings = await Production.countDocuments({ earnings: { $gt: 0 } });
    
    console.log(`\n📊 After fix:`);
    console.log(`  - Records with earnings > 0: ${recordsWithEarnings}`);
    console.log(`  - Records with earnings = 0: ${remainingZeroRecords}`);
    
    // Calculate total earnings
    const totalEarnings = await Production.aggregate([
      { $group: { _id: null, total: { $sum: '$earnings' } } }
    ]);
    
    console.log(`💰 Total earnings in system: ${totalEarnings[0]?.total || 0}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

fixEarningsData();