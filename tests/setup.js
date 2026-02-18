const mongoose = require("mongoose");

// Connect to test database before all tests
beforeAll(async () => {
  const mongoUri = process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);
});

// Clean up database after each test
//this will delete all the data in the database after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Disconnect after all tests
//this will close the connection to the database after all tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});
