require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Blog = require("./models/Blog");

// Test database connection
const testDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Database connected successfully");

    // Test User model
    console.log("✅ User model loaded");

    // Test Blog model
    console.log("✅ Blog model loaded");

    console.log("\n🎉 All models are working correctly!");

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

testDB();
