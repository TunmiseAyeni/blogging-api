require("dotenv").config({ path: ".env.test" });
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Blog = require("../src/models/Blog");

// Connect before all tests
beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

// Clear database after each test - CRITICAL: Order matters!
afterEach(async () => {
  // Delete blogs first (they reference users)
  await Blog.deleteMany({});
  // Then delete users
  await User.deleteMany({});
});

// Disconnect after all tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// ==================== HELPERS ====================
// Helper: signup and return token + user
const signupAndLogin = async (userData = {}) => {
  const defaultUser = {
    first_name: "John",
    last_name: "Doe",
    email: `john.doe.${Date.now()}@test.com`, // Unique email each time
    password: "password123",
  };

  const user = { ...defaultUser, ...userData };

  const res = await request(app).post("/api/auth/signup").send(user);

  return {
    token: res.body.data.token,
    user: res.body.data.user,
  };
};

// Helper: create a blog
const createBlog = async (token, blogData = {}) => {
  const defaultBlog = {
    title: `Test Blog Title ${Date.now()}`, // Unique title each time
    description: "Test blog description",
    tags: ["test", "nodejs"],
    body: "This is the body of the test blog post. It has enough words to calculate reading time correctly.",
  };

  const blog = { ...defaultBlog, ...blogData };

  const res = await request(app)
    .post("/api/blogs")
    .set("Authorization", `Bearer ${token}`)
    .send(blog);

  return res.body.data?.blog;
};

// Helper: create and publish a blog
const createAndPublishBlog = async (token, blogData = {}) => {
  const blog = await createBlog(token, blogData);

  const res = await request(app)
    .put(`/api/blogs/${blog._id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ state: "published" });

  return res.body.data?.blog;
};

// ==================== CREATE BLOG TESTS ====================
describe("POST /api/blogs", () => {
  it("should create a blog successfully when logged in", async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .post("/api/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "My First Blog",
        description: "A great blog post",
        tags: ["nodejs", "javascript"],
        body: "This is my first blog post body with enough content to test.",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.blog.title).toBe("My First Blog");
    expect(res.body.data.blog.state).toBe("draft");
    expect(res.body.data.blog.read_count).toBe(0);
    expect(res.body.data.blog).toHaveProperty("reading_time");
    expect(res.body.data.blog).toHaveProperty("author");
  });

  it("should fail to create blog without authentication", async () => {
    const res = await request(app).post("/api/blogs").send({
      title: "My Blog",
      body: "Blog body content here.",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Not authorized, no token");
  });

  it("should fail to create blog without required fields", async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .post("/api/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Blog without body",
      });

    expect(res.statusCode).toBe(500);
    expect(res.body.status).toBe("error");
  });

  it("should fail to create blog with duplicate title", async () => {
    const { token } = await signupAndLogin();

    const uniqueTitle = `Unique Title ${Date.now()}`;

    // Create first blog
    await createBlog(token, { title: uniqueTitle });

    // Try to create with same title
    const res = await request(app)
      .post("/api/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: uniqueTitle,
        body: "Different body content here.",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("A blog with this title already exists");
  });

  it("should automatically calculate reading time", async () => {
    const { token } = await signupAndLogin();

    // ~200 words = ~1 minute reading time
    const body = "word ".repeat(200);

    const res = await request(app)
      .post("/api/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: `Reading Time Test ${Date.now()}`,
        body,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.blog.reading_time).toBeGreaterThanOrEqual(1);
    expect(res.body.data.blog.reading_time).toBeLessThanOrEqual(2);
  });
});

// ==================== GET ALL BLOGS TESTS ====================
describe("GET /api/blogs", () => {
  it("should return only published blogs", async () => {
    const { token } = await signupAndLogin();

    // Create draft blog
    await createBlog(token, { title: `Draft Blog ${Date.now()}` });

    // Create published blog
    await createAndPublishBlog(token, {
      title: `Published Blog ${Date.now()}`,
    });

    // Get all blogs WITHOUT auth
    const res = await request(app).get("/api/blogs");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.blogs).toHaveLength(1);
    expect(res.body.data.blogs[0].state).toBe("published");
  });

  it("should return blogs without authentication", async () => {
    const { token } = await signupAndLogin();
    await createAndPublishBlog(token);

    const res = await request(app).get("/api/blogs");

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blogs.length).toBeGreaterThan(0);
  });

  it("should return author details with blogs", async () => {
    const { token } = await signupAndLogin();
    await createAndPublishBlog(token);

    const res = await request(app).get("/api/blogs");

    const blog = res.body.data.blogs[0];
    expect(blog.author).toHaveProperty("first_name");
    expect(blog.author).toHaveProperty("last_name");
    expect(blog.author).toHaveProperty("email");
    expect(blog.author).not.toHaveProperty("password");
  });

  it("should paginate results correctly", async () => {
    const { token } = await signupAndLogin();

    // Create 3 published blogs
    await createAndPublishBlog(token, { title: `Blog One ${Date.now()}` });
    await createAndPublishBlog(token, { title: `Blog Two ${Date.now()}` });
    await createAndPublishBlog(token, { title: `Blog Three ${Date.now()}` });

    // Get page 1 with limit 2
    const res = await request(app).get("/api/blogs?page=1&limit=2");

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blogs).toHaveLength(2);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.limit).toBe(2);
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.pages).toBe(2);
  });

  it("should search blogs by title", async () => {
    const { token } = await signupAndLogin();
    const uniqueId = Date.now();

    await createAndPublishBlog(token, {
      title: `JavaScript Fundamentals ${uniqueId}`,
    });
    await createAndPublishBlog(token, { title: `Python Basics ${uniqueId}` });

    const res = await request(app).get("/api/blogs?title=JavaScript");

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blogs.length).toBeGreaterThan(0);
    expect(res.body.data.blogs[0].title).toContain("JavaScript");
  });

  it("should search blogs by tags", async () => {
    const { token } = await signupAndLogin();

    await createAndPublishBlog(token, {
      title: `Node Blog ${Date.now()}`,
      tags: ["nodejs", "backend"],
    });
    await createAndPublishBlog(token, {
      title: `React Blog ${Date.now()}`,
      tags: ["react", "frontend"],
    });

    const res = await request(app).get("/api/blogs?tags=nodejs");

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blogs.length).toBeGreaterThan(0);
  });

  it("should order blogs by read_count", async () => {
    const { token } = await signupAndLogin();

    // Create and publish blogs
    const blog1 = await createAndPublishBlog(token, {
      title: `Blog One ${Date.now()}`,
    });
    const blog2 = await createAndPublishBlog(token, {
      title: `Blog Two ${Date.now()}`,
    });

    // Read blog2 twice to increase its read_count
    await request(app).get(`/api/blogs/${blog2._id}`);
    await request(app).get(`/api/blogs/${blog2._id}`);

    // Get blogs ordered by read_count descending
    const res = await request(app).get(
      "/api/blogs?order_by=read_count&order=desc",
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blogs[0].read_count).toBeGreaterThan(0);
  });
});

// ==================== GET SINGLE BLOG TESTS ====================
describe("GET /api/blogs/:id", () => {
  it("should return a published blog with author info", async () => {
    const { token } = await signupAndLogin();
    const blog = await createAndPublishBlog(token);

    const res = await request(app).get(`/api/blogs/${blog._id}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.blog.title).toBe(blog.title);
    expect(res.body.data.blog.author).toHaveProperty("first_name");
    expect(res.body.data.blog.author).toHaveProperty("last_name");
  });

  it("should increment read_count by 1", async () => {
    const { token } = await signupAndLogin();
    const blog = await createAndPublishBlog(token);

    expect(blog.read_count).toBe(0);

    // Read the blog
    const res = await request(app).get(`/api/blogs/${blog._id}`);

    expect(res.body.data.blog.read_count).toBe(1);

    // Read again
    const res2 = await request(app).get(`/api/blogs/${blog._id}`);

    expect(res2.body.data.blog.read_count).toBe(2);
  });

  it("should not return draft blogs", async () => {
    const { token } = await signupAndLogin();
    const blog = await createBlog(token);

    const res = await request(app).get(`/api/blogs/${blog._id}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Blog not found");
  });

  it("should return 404 for non-existent blog", async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app).get(`/api/blogs/${fakeId}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Blog not found");
  });
});

// ==================== GET MY BLOGS TESTS ====================
describe("GET /api/blogs/user/my-blogs", () => {
  it("should return all blogs for logged in user", async () => {
    const { token } = await signupAndLogin();

    // Create draft and published blogs
    await createBlog(token, { title: `My Draft ${Date.now()}` });
    await createAndPublishBlog(token, { title: `My Published ${Date.now()}` });

    const res = await request(app)
      .get("/api/blogs/user/my-blogs")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blogs).toHaveLength(2);
  });

  it("should filter my blogs by state - draft", async () => {
    const { token } = await signupAndLogin();

    await createBlog(token, { title: `My Draft ${Date.now()}` });
    await createAndPublishBlog(token, { title: `My Published ${Date.now()}` });

    const res = await request(app)
      .get("/api/blogs/user/my-blogs?state=draft")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blogs).toHaveLength(1);
    expect(res.body.data.blogs[0].state).toBe("draft");
  });

  it("should filter my blogs by state - published", async () => {
    const { token } = await signupAndLogin();

    await createBlog(token, { title: `My Draft ${Date.now()}` });
    await createAndPublishBlog(token, { title: `My Published ${Date.now()}` });

    const res = await request(app)
      .get("/api/blogs/user/my-blogs?state=published")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blogs).toHaveLength(1);
    expect(res.body.data.blogs[0].state).toBe("published");
  });

  it("should not return other users blogs", async () => {
    // Create user1 and their blog
    const { token: token1 } = await signupAndLogin({
      email: `user1.${Date.now()}@test.com`,
    });
    await createBlog(token1, { title: `User1 Blog ${Date.now()}` });

    // Create user2
    const { token: token2 } = await signupAndLogin({
      email: `user2.${Date.now()}@test.com`,
    });

    // User2 should only see their own blogs (none)
    const res = await request(app)
      .get("/api/blogs/user/my-blogs")
      .set("Authorization", `Bearer ${token2}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blogs).toHaveLength(0);
  });

  it("should fail without authentication", async () => {
    const res = await request(app).get("/api/blogs/user/my-blogs");

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Not authorized, no token");
  });

  it("should paginate my blogs correctly", async () => {
    const { token } = await signupAndLogin();

    await createBlog(token, { title: `Blog One ${Date.now()}` });
    await createBlog(token, { title: `Blog Two ${Date.now()}` });
    await createBlog(token, { title: `Blog Three ${Date.now()}` });

    const res = await request(app)
      .get("/api/blogs/user/my-blogs?page=1&limit=2")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data.blogs).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.pages).toBe(2);
  });
});

// ==================== UPDATE BLOG TESTS ====================
describe("PUT /api/blogs/:id", () => {
  it("should update blog content successfully", async () => {
    const { token } = await signupAndLogin();
    const blog = await createBlog(token);

    const res = await request(app)
      .put(`/api/blogs/${blog._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: `Updated Title ${Date.now()}`,
        description: "Updated description",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blog.description).toBe("Updated description");
  });

  it("should update blog state to published", async () => {
    const { token } = await signupAndLogin();
    const blog = await createBlog(token);

    expect(blog.state).toBe("draft");

    const res = await request(app)
      .put(`/api/blogs/${blog._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ state: "published" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blog.state).toBe("published");
  });

  it("should fail to update blog without authentication", async () => {
    const { token } = await signupAndLogin();
    const blog = await createBlog(token);

    const res = await request(app)
      .put(`/api/blogs/${blog._id}`)
      .send({ title: "Updated" });

    expect(res.statusCode).toBe(401);
  });

  it("should fail if user is not the blog owner", async () => {
    // Create blog with user1
    const { token: token1 } = await signupAndLogin({
      email: `user1.${Date.now()}@test.com`,
    });
    const blog = await createBlog(token1);

    // Try to update with user2
    const { token: token2 } = await signupAndLogin({
      email: `user2.${Date.now()}@test.com`,
    });

    const res = await request(app)
      .put(`/api/blogs/${blog._id}`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ title: "Hacked Title" });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("You are not authorized to update this blog");
  });

  it("should recalculate reading time when body is updated", async () => {
    const { token } = await signupAndLogin();
    const blog = await createBlog(token);

    // Update with ~400 words = ~2 minutes
    const newBody = "word ".repeat(400);

    const res = await request(app)
      .put(`/api/blogs/${blog._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: newBody });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.blog.reading_time).toBeGreaterThanOrEqual(2);
    expect(res.body.data.blog.reading_time).toBeLessThanOrEqual(3);
  });
});

// ==================== DELETE BLOG TESTS ====================
describe("DELETE /api/blogs/:id", () => {
  it("should delete blog successfully", async () => {
    const { token } = await signupAndLogin();
    const blog = await createBlog(token);

    const res = await request(app)
      .delete(`/api/blogs/${blog._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Blog deleted successfully");

    // Verify it's actually deleted
    const checkRes = await request(app).get(`/api/blogs/${blog._id}`);
    expect(checkRes.statusCode).toBe(404);
  });

  it("should fail to delete without authentication", async () => {
    const { token } = await signupAndLogin();
    const blog = await createBlog(token);

    const res = await request(app).delete(`/api/blogs/${blog._id}`);

    expect(res.statusCode).toBe(401);
  });

  it("should fail if user is not the blog owner", async () => {
    // Create blog with user1
    const { token: token1 } = await signupAndLogin({
      email: `user1.${Date.now()}@test.com`,
    });
    const blog = await createBlog(token1);

    // Try to delete with user2
    const { token: token2 } = await signupAndLogin({
      email: `user2.${Date.now()}@test.com`,
    });

    const res = await request(app)
      .delete(`/api/blogs/${blog._id}`)
      .set("Authorization", `Bearer ${token2}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("You are not authorized to delete this blog");
  });

  it("should return 404 for non-existent blog", async () => {
    const { token } = await signupAndLogin();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .delete(`/api/blogs/${fakeId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Blog not found");
  });

  it("should delete blog in both draft and published state", async () => {
    const { token } = await signupAndLogin();

    // Delete draft blog
    const draftBlog = await createBlog(token, {
      title: `Draft To Delete ${Date.now()}`,
    });
    const draftRes = await request(app)
      .delete(`/api/blogs/${draftBlog._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(draftRes.statusCode).toBe(200);

    // Delete published blog
    const publishedBlog = await createAndPublishBlog(token, {
      title: `Published To Delete ${Date.now()}`,
    });
    const publishedRes = await request(app)
      .delete(`/api/blogs/${publishedBlog._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(publishedRes.statusCode).toBe(200);
  });
});
