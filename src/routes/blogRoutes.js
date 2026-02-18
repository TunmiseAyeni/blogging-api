const express = require("express");
const {
  createBlog,
  getAllBlogs,
  getBlog,
  getMyBlogs,
  updateBlog,
  deleteBlog,
} = require("../controllers/blogController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.get("/", getAllBlogs); // Get all published blogs
router.get("/:id", getBlog); // Get single published blog

// Protected routes (require authentication)
router.post("/", protect, createBlog); // Create blog
router.get("/user/my-blogs", protect, getMyBlogs); // Get user's own blogs
router.put("/:id", protect, updateBlog); // Update blog
router.delete("/:id", protect, deleteBlog); // Delete blog

module.exports = router;
