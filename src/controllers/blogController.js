const Blog = require("../models/Blog");

// @desc    Create a new blog
// @route   POST /api/blogs
// @access  Private
const createBlog = async (req, res) => {
    try {
      // Extract blog data from request body, 
    const { title, description, tags, body } = req.body;

    // Create blog with authenticated user as author
    const blog = await Blog.create({
      title,
      description,
      tags,
      body,
      author: req.user._id, // From auth middleware
    });

    res.status(201).json({
      status: "success",
      message: "Blog created successfully",
      data: {
        blog,
      },
    });
  } catch (error) {
    console.error(error);

    // Handle duplicate title error
    if (error.code === 11000) {//11000 is the error code for duplicate key
      return res.status(400).json({
        status: "error",
        message: "A blog with this title already exists",
      });
    }
//if error is not a duplicate key error
    res.status(500).json({
      status: "error",
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get all published blogs (public)
// @route   GET /api/blogs
// @access  Public
const getAllBlogs = async (req, res) => {
  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 20,
      author,
      title,
      tags,
      order_by = "timestamp",
      order = "desc",
    } = req.query;

    // Build filter object, filtering based on state
    const filter = { state: "published" };

    // Search by author (case-insensitive, partial match)
    if (author) {
      // We'll need to search in User model and get matching user IDs
      const User = require("../models/User");
        const users = await User.find({
          //search by first name or last name and return matching user IDs
        $or: [
          { first_name: new RegExp(author, "i") },
          { last_name: new RegExp(author, "i") },
            ],
            //select only the _id field
      }).select("_id");

      //map the user IDs to an array
        const userIds = users.map((user) => user._id);
        //filter the blogs by author using the user IDs
      filter.author = { $in: userIds };
    }

    // Search by title (case-insensitive, partial match)
    if (title) {
      filter.title = new RegExp(title, "i");
    }

    // Search by tags (case-insensitive)
      if (tags) {
        //split the tags string by comma and trim each tag
      const tagArray = tags.split(",").map((tag) => tag.trim());
      //filter the blogs by tags using the tag array
      filter.tags = { $in: tagArray.map((tag) => new RegExp(tag, "i")) };
    }

      // Build sort object
      //sort the blogs based on the order_by query parameter
      const sortOrder = order === "asc" ? 1 : -1;
      //set the default sort field to createdAt to sort the blogs by timestamp
    let sortField = "createdAt"; // Default to timestamp

      //sort the blogs based on the order_by query parameter
    if (order_by === "read_count") {
        sortField = "read_count";
    } else if (order_by === "reading_time") {
      sortField = "reading_time";
    } else if (order_by === "timestamp") {
      sortField = "createdAt";
    }
    //sort the blogs based on the order_by query parameter
    const sort = { [sortField]: sortOrder };

      // Calculate pagination.. skip the number of blogs based on the page number
    const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute query
      //populate the author field with the first_name, last_name, and email fields,
      //sort the blogs based on the sort object,
      //limit the number of blogs based on the limit query parameter,
      //skip the number of blogs based on the skip variable
    const blogs = await Blog.find(filter)
      .populate("author", "first_name last_name email")
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip);

      // Get total count for pagination info..count the number of blogs based on the filter
      const total = await Blog.countDocuments(filter);

      //return the blogs and pagination info
    res.status(200).json({
      status: "success",
      data: {
        blogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get a single published blog
// @route   GET /api/blogs/:id
// @access  Public
const getBlog = async (req, res) => {
    //find the blog by id and populate the author field with the first_name, last_name, and email fields
  try {
    const blog = await Blog.findById(req.params.id).populate(
      "author",
      "first_name last_name email",
    );
      //if blog is not found
    if (!blog) {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

    // Only show published blogs to public
    // (Owner can see their own drafts via getMyBlogs endpoint)
    if (blog.state !== "published") {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

      // Increment read count
    blog.read_count += 1;
    await blog.save();

      //return the blog
    res.status(200).json({
      status: "success",
      data: {
        blog,
      },
    });
  } catch (error) {
    console.error(error);

    // Handle invalid ObjectId
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get logged-in user's blogs
// @route   GET /api/blogs/my-blogs
// @access  Private
const getMyBlogs = async (req, res) => {
    try {
      //extract query parameters, default values are 1 for page and 20 for limit
    const { page = 1, limit = 20, state } = req.query;

    // Build filter - only user's own blogs
    const filter = { author: req.user._id };

        //filter by state if provided, if state is draft or published then add to filter
    if (state && (state === "draft" || state === "published")) {
      filter.state = state;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query, sort the blogs by createdAt in descending order, limit the number of blogs based on the limit query parameter, skip the number of blogs based on the skip variable
    const blogs = await Blog.find(filter)
      .sort({ createdAt: -1 }) // Most recent first
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count, count the number of blogs based on the filter
    const total = await Blog.countDocuments(filter);

    res.status(200).json({
      status: "success",
      data: {
        blogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update a blog
// @route   PUT /api/blogs/:id
// @access  Private (Owner only)
const updateBlog = async (req, res) => {
  try {
    let blog = await Blog.findById(req.params.id);
    //if blog is not found
    if (!blog) {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

    // Check if user is the owner
    if (blog.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You are not authorized to update this blog",
      });
    }

      //extract the body fields, if any of the fields are not provided then use the existing value
    const { title, description, tags, body, state } = req.body;

    // Only update fields that are provided, if any of the fields are not provided then use the existing value
    if (title) blog.title = title;
    if (description !== undefined) blog.description = description;
    if (tags) blog.tags = tags;
    if (body) blog.body = body;
    if (state && (state === "draft" || state === "published")) {
      blog.state = state;
    }

    await blog.save();

    res.status(200).json({
      status: "success",
      message: "Blog updated successfully",
      data: {
        blog,
      },
    });
  } catch (error) {
    console.error(error);

    // Handle duplicate title error
    if (error.code === 11000) {
      return res.status(400).json({
        status: "error",
        message: "A blog with this title already exists",
      });
    }

    // Handle invalid ObjectId
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete a blog
// @route   DELETE /api/blogs/:id
// @access  Private (Owner only)
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

    // Check if user is the owner
    if (blog.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You are not authorized to delete this blog",
      });
    }

    await blog.deleteOne();

    res.status(200).json({
      status: "success",
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error(error);

    // Handle invalid ObjectId
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createBlog,
  getAllBlogs,
  getBlog,
  getMyBlogs,
  updateBlog,
  deleteBlog,
};
