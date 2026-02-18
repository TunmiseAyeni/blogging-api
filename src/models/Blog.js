const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to User model
      required: true,
    },
    state: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    read_count: {
      type: Number,
      default: 0,
    },
    reading_time: {
      type: Number, // in minutes
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    body: {
      type: String,
      required: [true, "Body is required"],
    },
  },
  {
    timestamps: true,
  },
);

// Calculate reading time before saving
blogSchema.pre('save', function() {
  if (this.isModified('body')) {
    // Average reading speed: 200 words per minute
    const wordsPerMinute = 200;
    const wordCount = this.body.split(/\s+/).length;
    this.reading_time = Math.ceil(wordCount / wordsPerMinute);
  }
});

module.exports = mongoose.model("Blog", blogSchema);
