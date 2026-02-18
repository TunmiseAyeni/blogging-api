require("dotenv").config({ path: ".env.test" });
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");

// Suppress console.error during tests (expected errors)
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});

// Connect before all tests
beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
});

// Clear database after each test
afterEach(async () => {
  await User.deleteMany({});
});

// Disconnect after all tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// Helper: create a test user
const createTestUser = async () => {
  return await request(app).post("/api/auth/signup").send({
    first_name: "John",
    last_name: "Doe",
    email: "john.doe@test.com",
    password: "password123",
  });
};

// ==================== SIGNUP TESTS ====================
describe("POST /api/auth/signup", () => {
  it("should register a new user successfully", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@test.com",
      password: "password123",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.user).toHaveProperty("id");
    expect(res.body.data.user.email).toBe("john.doe@test.com");
    expect(res.body.data.user.first_name).toBe("John");
    expect(res.body.data.user.last_name).toBe("Doe");
    expect(res.body.data).toHaveProperty("token");
    // Password should NOT be in response
    expect(res.body.data.user).not.toHaveProperty("password");
  });

  it("should fail if email already exists", async () => {
    // Create user first
    await createTestUser();

    // Try to create again with same email
    const res = await request(app).post("/api/auth/signup").send({
      first_name: "Jane",
      last_name: "Doe",
      email: "john.doe@test.com", // Same email
      password: "password456",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("User already exists with this email");
  });

  it("should fail if required fields are missing", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "john.doe@test.com",
      password: "password123",
      // Missing first_name and last_name
    });

    expect(res.statusCode).toBe(500);
    expect(res.body.status).toBe("error");
  });

  it("should fail if email is invalid", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      first_name: "John",
      last_name: "Doe",
      email: "invalid-email", // Invalid email format
      password: "password123",
    });

    expect(res.statusCode).toBe(500);
    expect(res.body.status).toBe("error");
  });

  it("should fail if password is less than 6 characters", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@test.com",
      password: "123", // Too short
    });

    expect(res.statusCode).toBe(500);
    expect(res.body.status).toBe("error");
  });
});

// ==================== LOGIN TESTS ====================
describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    // Create a user before each login test
    await createTestUser();
  });

  it("should login successfully with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "john.doe@test.com",
      password: "password123",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("Login successful");
    expect(res.body.data).toHaveProperty("token");
    expect(res.body.data.user.email).toBe("john.doe@test.com");
    // Password should NOT be in response
    expect(res.body.data.user).not.toHaveProperty("password");
  });

  it("should fail with wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "john.doe@test.com",
      password: "wrongpassword",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("should fail with non-existent email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nonexistent@test.com",
      password: "password123",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("should fail if email is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({
      password: "password123",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Please provide email and password");
  });

  it("should fail if password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "john.doe@test.com",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Please provide email and password");
  });

  it("should return a valid JWT token", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "john.doe@test.com",
      password: "password123",
    });

    const token = res.body.data.token;

    // Token should be a string with 3 parts (header.payload.signature)
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });
});
