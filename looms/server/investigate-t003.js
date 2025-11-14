import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Taka from './models/Taka.model.js';
import Production from './models/Production.model.js';
import Machine from './models/Machine.model.js';
import QualityType from './models/QualityType.model.js';
import Worker from './models/Worker.model.js';

dotenv.config();

const investigateT003 = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    // Find T003 specifically
    const takaT003 = await Taka.findOne({ takaNumber: 'T003' }).populate('machine qualityType');
    if (!takaT003) {
      console.log('❌ T003 not found');
      return;
    }
    
    console.log('\n📋 T003 Details:');
    console.log(`  Taka Number: ${takaT003.takaNumber}`);
    console.log(`  Current Total Meters: ${takaT003.totalMeters}`);
    console.log(`  Target Meters: ${takaT003.targetMeters}`);
    console.log(`  Rate Per Meter: ${takaT003.ratePerMeter}`);
    console.log(`  Current Total Earnings: ${takaT003.totalEarnings}`);
    console.log(`  Status: ${takaT003.status}`);
    
    // Find all production records for T003
    const productionRecords = await Production.find({ taka: takaT003._id })
      .populate('machine worker qualityType')
      .sort({ date: 1 });
    
    console.log(`\n🔍 Production Records for T003 (${productionRecords.length} records):`);
    
    let totalMetersFromProduction = 0;
    productionRecords.forEach((record, index) => {
      console.log(`${index + 1}. Date: ${record.date.toDateString()}`);
      console.log(`   Machine: ${record.machine?.machineCode || 'N/A'}`);
      console.log(`   Worker: ${record.worker?.name || 'N/A'}`);
      console.log(`   Meters: ${record.metersProduced}`);
      console.log(`   Shift: ${record.shift}`);
      console.log(`   Rate: ${record.ratePerMeter}`);
      console.log(`   Earnings: ${record.earnings}`);
      console.log(`   ---`);
      
      totalMetersFromProduction += record.metersProduced;
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total meters from production records: ${totalMetersFromProduction}`);
    console.log(`  T003 database totalMeters: ${takaT003.totalMeters}`);
    console.log(`  Expected meters (if should be 500): 500`);
    console.log(`  Discrepancy: ${totalMetersFromProduction - 500}`);
    
    // Check if there are duplicate or incorrect records
    if (totalMetersFromProduction !== 500) {
      console.log('\n⚠️  ISSUE FOUND: Production records total does not match expected 500 meters');
      console.log('   This could be due to:');
      console.log('   1. Incorrect production data entry');
      console.log('   2. Duplicate production records');
      console.log('   3. Wrong taka assignment in production records');
    }
    
    // Show other Takas for comparison
    console.log('\n📋 Other Takas for reference:');
    const allTakas = await Taka.find({ takaNumber: { $ne: 'T003' } }).select('takaNumber totalMeters targetMeters');
    allTakas.forEach(taka => {
      console.log(`  ${taka.takaNumber}: ${taka.totalMeters}/${taka.targetMeters} meters`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

investigateT003();