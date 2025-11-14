import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Taka from './models/Taka.model.js';
import Production from './models/Production.model.js';

dotenv.config();

const fixTakaCompletions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    console.log('🔧 Fixing Taka meter calculations and completion status...\n');
    
    // Get all Takas
    const allTakas = await Taka.find({});
    
    for (const taka of allTakas) {
      console.log(`\n🔍 Processing ${taka.takaNumber}:`);
      console.log(`  Target: ${taka.targetMeters} meters`);
      
      // Get production records for this Taka, sorted by date
      const productionRecords = await Production.find({ taka: taka._id })
        .sort({ date: 1 });
      
      console.log(`  Found: ${productionRecords.length} production records`);
      
      if (productionRecords.length === 0) {
        // No production records, ensure Taka is reset properly
        taka.totalMeters = 0;
        taka.totalEarnings = 0;
        taka.status = taka.targetMeters > 0 ? 'Active' : 'Completed';
        await taka.save();
        console.log(`  ✅ Reset ${taka.takaNumber} to 0 meters`);
        continue;
      }
      
      // Calculate cumulative meters and find completion point
      let cumulativeMeters = 0;
      let completionIndex = -1;
      let recordsToKeep = [];
      let recordsToRemove = [];
      
      for (let i = 0; i < productionRecords.length; i++) {
        const record = productionRecords[i];
        const newTotal = cumulativeMeters + record.metersProduced;
        
        if (newTotal <= taka.targetMeters) {
          // This record fits within the target
          cumulativeMeters = newTotal;
          recordsToKeep.push(record);
          
          if (newTotal === taka.targetMeters) {
            // Exactly reached target, mark completion
            completionIndex = i;
            break;
          }
        } else if (cumulativeMeters < taka.targetMeters) {
          // This record would exceed target, but we haven't reached it yet
          // Adjust this record to exactly reach the target
          const remainingMeters = taka.targetMeters - cumulativeMeters;
          record.metersProduced = remainingMeters;
          record.earnings = remainingMeters * taka.ratePerMeter;
          cumulativeMeters = taka.targetMeters;
          recordsToKeep.push(record);
          completionIndex = i;
          
          console.log(`  🔧 Adjusted record ${i + 1}: reduced to ${remainingMeters} meters to meet target`);
          await record.save();
          break;
        } else {
          // We've already reached the target, this record shouldn't count
          recordsToRemove.push(record);
        }
      }
      
      // Remove excess production records (after completion)
      if (completionIndex >= 0) {
        for (let i = completionIndex + 1; i < productionRecords.length; i++) {
          recordsToRemove.push(productionRecords[i]);
        }
      }
      
      if (recordsToRemove.length > 0) {
        console.log(`  🗑️  Removing ${recordsToRemove.length} excess production records`);
        for (const record of recordsToRemove) {
          await Production.deleteOne({ _id: record._id });
        }
      }
      
      // Update Taka with correct totals
      taka.totalMeters = cumulativeMeters;
      taka.totalEarnings = cumulativeMeters * taka.ratePerMeter;
      taka.status = cumulativeMeters >= taka.targetMeters ? 'Completed' : 'Active';
      
      await taka.save();
      
      console.log(`  ✅ Updated ${taka.takaNumber}:`);
      console.log(`     - Total Meters: ${taka.totalMeters}`);
      console.log(`     - Total Earnings: ${taka.totalEarnings}`);
      console.log(`     - Status: ${taka.status}`);
      console.log(`     - Records kept: ${recordsToKeep.length}`);
      console.log(`     - Records removed: ${recordsToRemove.length}`);
    }
    
    // Handle orphaned production records
    console.log('\n🔍 Checking for orphaned production records...');
    const orphanedRecords = await Production.find({ taka: null });
    
    if (orphanedRecords.length > 0) {
      console.log(`⚠️  Found ${orphanedRecords.length} orphaned production records`);
      console.log('These will be deleted as they have no associated Taka:');
      
      for (const record of orphanedRecords) {
        console.log(`  - Date: ${record.date.toDateString()}, Meters: ${record.metersProduced}`);
        await Production.deleteOne({ _id: record._id });
      }
      
      console.log('✅ Deleted all orphaned production records');
    }
    
    // Final summary
    console.log('\n📊 Final Taka Status:');
    const updatedTakas = await Taka.find({}).sort({ takaNumber: 1 });
    
    for (const taka of updatedTakas) {
      const prodCount = await Production.countDocuments({ taka: taka._id });
      console.log(`${taka.takaNumber}: ${taka.totalMeters}/${taka.targetMeters} meters, ${taka.totalEarnings} earnings, ${taka.status}, ${prodCount} records`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

fixTakaCompletions();