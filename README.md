# Blogging API

A RESTful API for a blogging platform built with Node.js, Express, and MongoDB.

## Live Demo

<!-- **Heroku URL:** https://your-app-name.herokuapp.com -->

## Features

- User authentication with JWT
- Create, read, update, delete blogs
- Blog states (draft/published)
- Pagination, search, and filtering
- Reading time calculation
- Comprehensive test coverage (83%)

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login user

### Blogs (Public)

- `GET /api/blogs` - Get all published blogs (with pagination, search, ordering)
- `GET /api/blogs/:id` - Get a single published blog

### Blogs (Protected - Requires Authentication)

- `POST /api/blogs` - Create a new blog
- `GET /api/blogs/user/my-blogs` - Get logged-in user's blogs
- `PUT /api/blogs/:id` - Update a blog
- `DELETE /api/blogs/:id` - Delete a blog

## Technologies Used

- Node.js
- Express.js
- MongoDB (Mongoose)
- JWT for authentication
- Jest & Supertest for testing
- Bcrypt for password hashing

