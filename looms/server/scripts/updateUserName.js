import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.model.js';

dotenv.config();

async function updateUserName() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node scripts/updateUserName.js <email> "Full Name"');
    process.exit(1);
  }

  const [email, ...nameParts] = args;
  const fullName = nameParts.join(' ').trim();

  if (!email || !fullName) {
    console.log('Email and full name are required.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/looms';

  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User with email "${email}" not found.`);
      process.exit(1);
    }

    user.name = fullName;
    await user.save();

    console.log(`Updated user ${email} name -> "${fullName}"`);
    process.exit(0);
  } catch (err) {
    console.error('Error updating user name:', err.message || err);
    process.exit(1);
  }
}

updateUserName();
