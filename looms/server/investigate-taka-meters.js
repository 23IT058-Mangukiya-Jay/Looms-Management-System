import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Taka from './models/Taka.model.js';
import Production from './models/Production.model.js';
import Machine from './models/Machine.model.js';
import QualityType from './models/QualityType.model.js';
import Worker from './models/Worker.model.js';

dotenv.config();

const investigateTakaMeters = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    console.log('🔍 Investigating Taka meter calculations...\n');
    
    // Get all Takas with their expected values
    const allTakas = await Taka.find({}).populate('machine qualityType');
    
    console.log('📊 Current Taka Status:');
    for (const taka of allTakas) {
      console.log(`\n${taka.takaNumber}:`);
      console.log(`  - Target Meters: ${taka.targetMeters}`);
      console.log(`  - DB Total Meters: ${taka.totalMeters}`);
      console.log(`  - Rate per Meter: ${taka.ratePerMeter}`);
      console.log(`  - Total Earnings: ${taka.totalEarnings}`);
      console.log(`  - Status: ${taka.status}`);
      
      // Get production records for this specific Taka
      const productionRecords = await Production.find({ taka: taka._id })
        .populate('machine worker')
        .sort({ date: 1 });
      
      console.log(`  - Production Records: ${productionRecords.length}`);
      
      let calculatedTotal = 0;
      if (productionRecords.length > 0) {
        console.log('  - Production Details:');
        productionRecords.forEach((prod, index) => {
          console.log(`    ${index + 1}. Date: ${prod.date.toDateString()}, Meters: ${prod.metersProduced}, Machine: ${prod.machine?.machineCode}`);
          calculatedTotal += prod.metersProduced;
        });
      }
      
      console.log(`  - Calculated Total: ${calculatedTotal}`);
      
      if (calculatedTotal !== taka.totalMeters) {
        console.log(`  ⚠️  MISMATCH: DB shows ${taka.totalMeters} but should be ${calculatedTotal}`);
      }
      
      // Check if this Taka has exceeded its target
      if (taka.targetMeters > 0 && calculatedTotal > taka.targetMeters) {
        console.log(`  🚨 OVER TARGET: ${calculatedTotal} > ${taka.targetMeters} (${calculatedTotal - taka.targetMeters} meters over)`);
      }
    }
    
    // Check for any orphaned production records
    console.log('\n🔍 Checking for orphaned production records...');
    const allProduction = await Production.find({}).populate('taka');
    const orphanedRecords = allProduction.filter(prod => !prod.taka);
    
    if (orphanedRecords.length > 0) {
      console.log(`⚠️  Found ${orphanedRecords.length} production records without Taka association`);
    } else {
      console.log('✅ All production records have Taka associations');
    }
    
    // Check for production records referencing non-existent Takas
    const invalidTakaRefs = [];
    for (const prod of allProduction) {
      if (prod.taka && !allTakas.find(t => t._id.equals(prod.taka._id))) {
        invalidTakaRefs.push(prod);
      }
    }
    
    if (invalidTakaRefs.length > 0) {
      console.log(`⚠️  Found ${invalidTakaRefs.length} production records referencing invalid Takas`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

investigateTakaMeters();