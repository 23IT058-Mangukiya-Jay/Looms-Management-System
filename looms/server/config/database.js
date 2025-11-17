import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.log('Trying to connect without authentication...');
    
    // Try alternative connection without auth
    try {
      const altConn = await mongoose.connect('mongodb://127.0.0.1:27017/looms_management', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log(` MongoDB Connected (alternative): ${altConn.connection.host}`);
    } catch (altError) {
      console.error(` Alternative connection failed: ${altError.message}`);
      console.log(' Please ensure MongoDB is running without authentication for development');
      process.exit(1);
    }
  }
};

export default connectDB;
