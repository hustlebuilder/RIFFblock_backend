# RIFFblock Backend

The backend API service for the RIFFblock platform, handling user authentication, riff uploads, NFT minting, staking, and token transactions.

## Overview

The RIFFblock backend is built with Express.js, TypeScript, and Prisma ORM. It provides RESTful API endpoints for the frontend application and integrates with blockchain services for NFT minting and token transactions.


## Key Features

- **User Authentication**: JWT-based authentication system
- **File Storage**: AWS S3 integration for audio file storage
- **Blockchain Integration**: Ethereum blockchain integration for NFTs and tokens
- **Database**: PostgreSQL database with Prisma ORM
- **API Documentation**: Swagger/OpenAPI documentation
- **Middleware**: Request validation, authentication, and error handling

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- AWS S3 bucket (for file storage)
- Ethereum wallet and provider (for blockchain integration)

### Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
5. Update the environment variables in `.env`
6. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
7. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

### Development

Start the development server:

```bash
npm run dev
```

The API will be available at [http://localhost:4000](http://localhost:4000) by default.

### Building for Production

```bash
npm run build
```

To start the production server:

```bash
npm start
```

### Environment Variables

- `PORT`: Server port (default: 4000)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token generation
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region
- `AWS_S3_BUCKET`: S3 bucket name
- `NFT_CONTRACT_ADDRESS`: Address of the NFT contract
- `BLOCKCHAIN_PROVIDER_URL`: Ethereum provider URL

## API Endpoints

### Authentication
- `POST /api/auth/register`: Register a new user
- `POST /api/auth/login`: Login and get JWT token
- `GET /api/auth/me`: Get current user info

### Users
- `GET /api/users`: Get all users
- `GET /api/users/:id`: Get user by ID
- `PUT /api/users/:id`: Update user
- `DELETE /api/users/:id`: Delete user

### Riffs
- `POST /api/riffs`: Upload a new riff
- `GET /api/riffs`: Get all riffs
- `GET /api/riffs/:id`: Get riff by ID
- `PUT /api/riffs/:id`: Update riff
- `DELETE /api/riffs/:id`: Delete riff

### NFTs
- `POST /api/nfts/mint`: Mint a riff as NFT
- `GET /api/nfts`: Get all NFTs
- `GET /api/nfts/:id`: Get NFT by ID

### Staking
- `POST /api/staking/stake`: Stake tokens on a riff
- `POST /api/staking/unstake`: Unstake tokens
- `GET /api/staking/rewards`: Get staking rewards

### Tokens
- `GET /api/tokens/balance`: Get token balance
- `POST /api/tokens/transfer`: Transfer tokens
- `POST /api/tokens/tip`: Tip an artist

## Technologies

- **Express.js**: Web framework for Node.js
- **TypeScript**: Type-safe JavaScript
- **Prisma**: ORM for database access
- **PostgreSQL**: Relational database
- **JWT**: Authentication tokens
- **AWS SDK**: S3 integration for file storage
- **Ethers.js**: Ethereum blockchain integration
- **Swagger/OpenAPI**: API documentation
- **Jest**: Testing framework
