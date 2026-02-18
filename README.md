# Blogging API

A RESTful API for a blogging platform built with Node.js, Express, and MongoDB.

## 🚀 Live Demo
**API URL:** https://tunmise-blogging-api.onrender.com

## GitHub Repository
https://github.com/TunmiseAyeni/blogging-api

## Features
-  User authentication with JWT (1-hour expiration)
- Create, read, update, delete blogs
- Blog states (draft/published)
- Pagination, search by author/title/tags
-  Ordering by read_count, reading_time, timestamp
- Automatic reading time calculation
- 43 passing tests with 83% coverage

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login user

### Blogs (Public)
- `GET /api/blogs` - Get all published blogs
  - Query params: `page`, `limit`, `author`, `title`, `tags`, `order_by`, `order`
- `GET /api/blogs/:id` - Get a single published blog (increments read_count)

### Blogs (Protected - Requires Authentication)
- `POST /api/blogs` - Create a new blog (default state: draft)
- `GET /api/blogs/user/my-blogs` - Get logged-in user's blogs
  - Query params: `page`, `limit`, `state`
- `PUT /api/blogs/:id` - Update a blog (owner only)
- `DELETE /api/blogs/:id` - Delete a blog (owner only)

## Technologies Used
- Node.js & Express.js
- MongoDB with Mongoose
- JWT for authentication
- Bcrypt for password hashing
- Jest & Supertest for testing

## Local Development

1. Clone the repository
```bash
git clone https://github.com/TunmiseAyeni/blogging-api.git
cd blogging-api
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file
```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
JWT_EXPIRE=1h
NODE_ENV=development
```

4. Run the server
```bash
npm run dev
```

5. Run tests
```bash
npm test
```

## Test Coverage
- 43 tests passing
- 83% code coverage
- All endpoints tested

## Author
Tunmise Ayeni

## License
MIT