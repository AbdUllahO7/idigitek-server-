# Secure Express API with TypeScript and MongoDB

A secure RESTful API built with Express.js, TypeScript, and MongoDB with full user authentication and authorization features.

## Features

- **TypeScript Integration**: Fully typed codebase for better developer experience and fewer bugs
- **Secure Authentication**:
  - JWT-based authentication with access and refresh tokens
  - Password hashing and salt
  - Account locking after failed attempts
  - Email verification
  - Password reset functionality
- **User Management**:
  - User registration, login, and logout
  - Profile management
  - Role-based access control (User/Admin)
  - User status management (Active/Inactive/Suspended/Pending)
- **Security Measures**:
  - Input validation and sanitization
  - Rate limiting
  - XSS protection
  - NoSQL injection protection
  - CORS configuration
  - Helmet security headers
- **Structured Error Handling**:
  - Centralized error handling
  - Consistent API responses
- **Logging**:
  - Request logging
  - Error logging
  - Structured logging with Winston
- **Advanced Features**:
  - Pagination
  - Filtering
  - Sorting
  - Search
- **Developer Experience**:
  - Clear project structure
  - Environment configuration
  - Comprehensive documentation
  - Type definitions

## Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Request handlers
├── middleware/       # Express middleware
├── models/           # Mongoose models
├── routes/           # API routes
├── services/         # Business logic
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── validators/       # Request validation
├── app.ts            # Express app
└── server.ts         # Server entry point
```

## Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd secure-express-ts-api
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your own settings

### Development

Start the development server:
```bash
npm run dev
# or
yarn dev
```

The server will be available at `http://localhost:3000` (or the port you configured).

### Production Build

Build the project:
```bash
npm run build
# or
yarn build
```

Start the production server:
```bash
npm start
# or
yarn start
```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/v1/auth/register` | Register a new user | Public |
| POST | `/api/v1/auth/login` | Login user | Public |
| POST | `/api/v1/auth/logout` | Logout user | Private |
| POST | `/api/v1/auth/refresh-token` | Refresh access token | Public |
| POST | `/api/v1/auth/forgot-password` | Request password reset | Public |
| POST | `/api/v1/auth/reset-password` | Reset password with token | Public |
| POST | `/api/v1/auth/change-password` | Change user password | Private |
| POST | `/api/v1/auth/verify-email` | Verify email with token | Public |
| POST | `/api/v1/auth/resend-verification` | Resend verification email | Private |

### User Management

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/users/me` | Get current user profile | Private |
| PUT | `/api/v1/users/me` | Update user profile | Private |
| GET | `/api/v1/users` | Get all users (paginated) | Admin |
| GET | `/api/v1/users/:id` | Get user by ID | Admin/Owner |
| PUT | `/api/v1/users/:id/role` | Update user role | Admin |
| PUT | `/api/v1/users/:id/status` | Update user status | Admin |
| DELETE | `/api/v1/users/:id` | Delete user | Admin |

## Security Considerations

- Make sure to change the `JWT_SECRET` in production
- Configure CORS to allow only trusted origins in production
- Set appropriate rate limits based on your application needs
- Use HTTPS in production environments
- Regularly update dependencies for security patches

## License

MIT

## Contact

Your Name or Team Name - your.email@example.com