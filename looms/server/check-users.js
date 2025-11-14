import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.model.js';

dotenv.config();

const checkUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    const users = await User.find({}, 'name email role').lean();
    console.log('📋 Users in database:');
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - Role: ${user.role}`);
    });
    
    // Test password for owner
    const owner = await User.findOne({ email: 'owner@looms.com' }).select('+password');
    if (owner) {
      const isMatch = await owner.matchPassword('owner123');
      console.log(`🔐 Password test for owner@looms.com: ${isMatch ? 'PASS' : 'FAIL'}`);
    }
    
    // Test password for manager
    const manager = await User.findOne({ email: 'manager@looms.com' }).select('+password');
    if (manager) {
      const isMatch = await manager.matchPassword('manager123');
      console.log(`🔐 Password test for manager@looms.com: ${isMatch ? 'PASS' : 'FAIL'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkUsers();