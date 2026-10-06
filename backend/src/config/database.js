const mongoose = require('mongoose');

const readPositiveInteger = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sistema_gestion';
    mongoose.set('strictQuery', true);
    mongoose.set('autoIndex', process.env.NODE_ENV !== 'production');
    mongoose.set('autoCreate', process.env.NODE_ENV !== 'production');

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: readPositiveInteger('MONGODB_SERVER_SELECTION_TIMEOUT_MS', 10000),
      connectTimeoutMS: readPositiveInteger('MONGODB_CONNECT_TIMEOUT_MS', 10000),
      socketTimeoutMS: readPositiveInteger('MONGODB_SOCKET_TIMEOUT_MS', 45000),
      maxPoolSize: readPositiveInteger('MONGODB_MAX_POOL_SIZE', 10),
      minPoolSize: readPositiveInteger('MONGODB_MIN_POOL_SIZE', 1),
      retryWrites: true
    });
    console.log(` MongoDB Connected: ${conn.connection.host}`);
    console.log(` Database: ${conn.connection.name}`);

    conn.connection.on('disconnected', () => {
      console.error('MongoDB disconnected. The application will retry database operations when the connection returns.');
    });
    conn.connection.on('error', error => {
      console.error('MongoDB connection error:', error.message);
    });

    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
};

module.exports = { connectDB };