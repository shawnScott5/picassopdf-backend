import mongoose from "mongoose";
import config from '../config/config.js';

// Connect to MongoDB Atlas
const db = async () => {
    await mongoose.connect(config.mongoUrl, { 
        useNewUrlParser: true,
        useUnifiedTopology: true
      })
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.log(err));
}

export default db;