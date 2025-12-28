# EaseClassifieds - Project Overview

## Project Description

EaseClassifieds is a full-stack classifieds super app that aggregates property and vehicle listings. The system features AI-powered smart search via Google Gemini API integration, a subscription-based daily curated feed system, phone authentication, and a clean, accessible mobile interface.

## Repository Structure

This project uses a **separate repositories** architecture with two independent Git repositories:

```
sandbox/
├── easeclassifieds/          # Frontend Repository (React/Tailwind CSS)
│   ├── .git/                 # Frontend Git repository
│   ├── README.md             # Frontend documentation
│   ├── docs/                 # Frontend documentation
│   └── ...                   # Frontend source code
│
└── easeclassifieds-api/      # Backend Repository (NestJS)
    ├── .git/                 # Backend Git repository
    ├── README.md             # Backend documentation
    ├── docs/                 # Backend documentation
    └── ...                   # Backend source code
```

### Why Separate Repositories?

The decision to use separate repositories instead of a monorepo was made for the following reasons:

1. **Independent Version Control**: Each project can have its own release cycle and versioning
2. **Team Separation**: Frontend and backend teams can work independently without conflicts
3. **Deployment Flexibility**: Each service can be deployed independently
4. **Repository Size**: Keeps each repository focused and manageable
5. **Access Control**: Different access permissions can be set per repository
6. **CI/CD Independence**: Separate CI/CD pipelines for frontend and backend

### Alternative: Monorepo Structure

If a monorepo structure is preferred in the future, the projects can be consolidated using tools like:
- **Lerna**: JavaScript monorepo management
- **Nx**: Monorepo build system
- **Turborepo**: High-performance build system for JavaScript/TypeScript

## Project Components

### Frontend (`easeclassifieds`)

- **Technology**: React 19, TypeScript, Tailwind CSS, Vite
- **Location**: `./sandbox/easeclassifieds`
- **Repository**: Independent Git repository
- **Documentation**: See `easeclassifieds/README.md` and `easeclassifieds/docs/`

**Key Features**:
- AI-powered smart search via Google Gemini API
- Mobile-first responsive design
- Phone authentication UI
- Subscription-based curated feed interface

### Backend (`easeclassifieds-api`)

- **Technology**: NestJS, TypeScript, PostgreSQL, Redis, BullMQ
- **Location**: `./sandbox/easeclassifieds-api`
- **Repository**: Independent Git repository
- **Documentation**: See `easeclassifieds-api/README.md` and `easeclassifieds-api/docs/`

**Key Features**:
- RESTful API endpoints
- Phone authentication backend
- Database management with TypeORM
- AI service integration
- Subscription management
- Background job processing
- File storage with AWS S3

## Getting Started

### Prerequisites

- **Node.js**: Version 18.x or higher
- **PostgreSQL**: Database server
- **Redis**: Cache and job queue
- **npm/pnpm**: Package managers
- **Git**: Version control

### Setup Instructions

1. **Clone Frontend Repository**:
   ```bash
   cd easeclassifieds
   npm install
   cp .env.example .env.local  # Configure environment variables
   npm run dev
   ```

2. **Clone Backend Repository**:
   ```bash
   cd easeclassifieds-api
   pnpm install
   cp .env.example .env  # Configure environment variables
   pnpm run migration:run
   pnpm run start:dev
   ```

3. **Configure Environment Variables**:
   - Frontend: See `easeclassifieds/README.md`
   - Backend: See `easeclassifieds-api/README.md`

## Development Workflow

### Working with Separate Repositories

1. **Frontend Development**:
   - Work in `easeclassifieds/` directory
   - Use `npm` for package management
   - Follow frontend coding standards (see `easeclassifieds/docs/CODING_STANDARDS.md`)

2. **Backend Development**:
   - Work in `easeclassifieds-api/` directory
   - Use `pnpm` for package management
   - Follow backend coding standards (see `easeclassifieds-api/docs/CODING_STANDARDS.md`)

3. **Integration Testing**:
   - Ensure both services are running
   - Frontend typically runs on `http://localhost:5173`
   - Backend API typically runs on `http://localhost:3000`

## Documentation

### Frontend Documentation
- **README**: `easeclassifieds/README.md`
- **Architecture**: `easeclassifieds/docs/ARCHITECTURE.md`
- **Coding Standards**: `easeclassifieds/docs/CODING_STANDARDS.md`
- **Project Structure**: `easeclassifieds/docs/PROJECT_STRUCTURE.md`

### Backend Documentation
- **README**: `easeclassifieds-api/README.md`
- **Architecture**: `easeclassifieds-api/docs/ARCHITECTURE.md`
- **Coding Standards**: `easeclassifieds-api/docs/CODING_STANDARDS.md`
- **Project Structure**: `easeclassifieds-api/docs/PROJECT_STRUCTURE.md`

## Version Control

### Git Configuration

Each repository maintains its own:
- `.gitignore` file (configured for respective tech stack)
- Git history and branches
- CI/CD pipelines (if configured)

### Branching Strategy

**Frontend** (`easeclassifieds`):
- `master` - Production-ready code
- Feature branches: `feature/feature-name`
- Bugfix branches: `fix/bug-description`

**Backend** (`easeclassifieds-api`):
- `dev` - Development branch
- `master` - Production-ready code
- Feature branches: `feature/feature-name`
- Bugfix branches: `fix/bug-description`

## Communication Between Services

The frontend communicates with the backend via:
- **REST API**: HTTP requests to backend endpoints
- **WebSocket**: Real-time features (if configured)
- **CORS**: Configured for cross-origin requests

## Deployment

Each service can be deployed independently:

- **Frontend**: Static files served via CDN or web server
- **Backend**: Containerized application (Docker) or serverless

## Contributing

When contributing to this project:

1. Follow the coding standards for the respective repository
2. Update documentation when making significant changes
3. Write tests for new features
4. Ensure both services work together after changes

## License

Private - UNLICENSED
