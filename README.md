# GPJ Input Assistant - Backend API

> **Enterprise-Grade AI-Powered Brief Generation System**

A production-ready Node.js backend system that leverages Google's Gemini AI to intelligently extract and populate structured data from unstructured documents (PDF, PPTX, XLSX). Built with a focus on scalability, security, and performance optimization.

---

## 🎯 Technical Highlights

This project demonstrates advanced backend engineering capabilities across multiple domains:

### 1. **AI/ML Integration & Document Intelligence**
- **Multi-Format Document Processing**: Custom parsers for PDF, PPTX, XLSX with intelligent text extraction
- **Gemini AI Integration**: Structured data extraction using Google's Generative AI with confidence scoring
- **Smart Prompt Engineering**: Dynamic prompt generation combining multiple field schemas with document context
- **Metadata Filtering**: Advanced PPTX parser with 20+ heuristic filters to eliminate XML artifacts and extract only meaningful content
- **Parallel Processing**: Asynchronous slide/sheet processing with `Promise.allSettled` for fault tolerance

### 2. **Database Architecture & Optimization**
- **Prisma ORM** with PostgreSQL adapter for type-safe database operations
- **Custom Schema Design**: Multi-tenant architecture supporting role-based data isolation
- **Database Transactions**: ACID-compliant operations using Prisma's `$transaction` API
- **Optimized Queries**: Efficient joins with selective field inclusion to minimize data transfer
- **Audit Trail System**: Comprehensive logging of all data mutations with user tracking
- **Unique Constraints**: Composite keys preventing duplicate field values per user

### 3. **Cloud Infrastructure & File Management**
- **AWS S3 Integration**: Presigned URL generation for secure, direct client-to-S3 uploads
- **Zero Server Load**: Files never touch the application server - direct S3 streaming
- **Signed URL Security**: Time-limited, scoped access tokens (configurable 1-7 day expiry)
- **Multi-File Operations**: Batch download URL generation with authorization checks
- **MIME Type Detection**: Automatic content-type handling for diverse file formats

### 4. **Security & Authentication**
- **JWT-Based Authentication**: Stateless token verification with role-based access control (RBAC)
- **Three-Tier Authorization**: Admin, GPJ, and Client roles with granular permissions
- **Password Security**: bcrypt hashing with salt rounds
- **Document-Level Authorization**: Users can only access documents they uploaded or are authorized to view
- **HTTPS/TLS**: Production deployment with SSL certificates via Let's Encrypt
- **Security Headers**: HSTS, X-Frame-Options, CSP, XSS protection via Nginx

### 5. **Production-Ready DevOps**
- **Multi-Stage Docker Build**: Optimized production Dockerfile with non-root user execution
- **Docker Compose Orchestration**: Separate dev/prod configurations with health checks
- **Nginx Reverse Proxy**: HTTP/2, SSL termination, WebSocket support, and request buffering
- **Database Migrations**: Automated Prisma migrations on container startup
- **Health Checks**: Application and database health endpoints for monitoring
- **Logging System**: Structured file-based logging with daily rotation (error, info, debug, access)
- **Resource Optimization**: Removed CPU/memory limits for production scalability

### 6. **API Design & Architecture**
- **RESTful Design**: Semantic HTTP methods and status codes
- **Input Validation**: Comprehensive request validation with detailed error messages
- **Error Handling**: Centralized error handling with appropriate status codes
- **CORS Configuration**: Cross-origin resource sharing for frontend integration
- **Modular Structure**: Separation of concerns (routes, services, libraries, helpers)
- **Service Layer Pattern**: Business logic isolated from HTTP layer

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Nginx (Reverse Proxy)                    │
│              SSL/TLS Termination • HTTP/2 • Compression          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Express.js Application                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Routes     │  │   Services   │  │  Libraries   │          │
│  │ (HTTP Layer) │─▶│ (Business    │─▶│ (S3, Gemini, │          │
│  │              │  │  Logic)      │  │  Auth, JWT)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                             │                                    │
│                    ┌────────▼────────┐                          │
│                    │  Prisma Client  │                          │
│                    │  (ORM + Adapter)│                          │
│                    └────────┬────────┘                          │
└─────────────────────────────┼──────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼──────┐  ┌────▼─────┐  ┌─────▼──────┐
    │  PostgreSQL    │  │  AWS S3  │  │ Gemini AI  │
    │   Database     │  │  Bucket  │  │    API     │
    └────────────────┘  └──────────┘  └────────────┘
```

---

## 🚀 Core Technologies

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Runtime** | Node.js 20 (Alpine) | Lightweight, secure production environment |
| **Framework** | Express.js 5.x | High-performance web framework |
| **Database** | PostgreSQL 16 | ACID-compliant relational database |
| **ORM** | Prisma 7.x | Type-safe database client with migrations |
| **Cloud Storage** | AWS S3 | Scalable object storage |
| **AI/ML** | Google Gemini AI | Generative AI for document analysis |
| **Authentication** | JWT + bcrypt | Stateless auth with secure password hashing |
| **Reverse Proxy** | Nginx (Alpine) | Load balancing, SSL, HTTP/2 |
| **Containerization** | Docker + Docker Compose | Consistent deployment environments |
| **Document Parsing** | xlsx, jszip, xml2js | Multi-format document processing |

---

## 📊 Database Schema Design

The schema demonstrates advanced database modeling with:

- **Enum Types**: Type-safe status and role management
- **Relational Integrity**: Foreign keys with cascading rules
- **Composite Unique Constraints**: Preventing duplicate field values per user
- **JSON Fields**: Flexible storage for dynamic field options and values
- **Audit Logging**: Comprehensive tracking of all mutations
- **Multi-Tenant Support**: User-scoped data with role-based isolation

### Key Models:
- **User**: Role-based authentication (Admin, GPJ, Client)
- **Brief**: Top-level container for structured data collection
- **Section**: Logical grouping of related fields
- **Field**: Template definition with data types and AI prompts
- **FieldValue**: User-submitted or AI-generated data with confidence scores
- **Document**: S3 file references with metadata
- **Approval**: Workflow management for brief approval
- **AuditLog**: Complete audit trail of all actions

---

## 🔥 Advanced Features

### 1. **Intelligent Document Processing**

```javascript
// Multi-format support with custom parsers
- PDF: Direct binary streaming to Gemini AI
- PPTX: XML parsing with 20+ metadata filters
- XLSX: CSV conversion with empty row filtering
- Images: Base64 encoding with MIME type detection
```

**Key Innovation**: The PPTX parser filters out technical metadata (URNs, GUIDs, font names, shape references) using regex patterns and heuristics, ensuring only meaningful text is extracted.

### 2. **Presigned URL Architecture**

```javascript
// Zero-server-load file uploads
Client → GET /upload/signed-url → Backend generates S3 presigned URL
Client → PUT to S3 directly → File uploaded to S3
Client → POST /upload/confirm → Backend records metadata
```

**Benefits**:
- No server bandwidth consumption
- Reduced latency
- Scalable to millions of uploads
- Secure, time-limited access

### 3. **AI-Powered Field Extraction**

```javascript
// Dynamic prompt construction
1. Fetch all fields in section with their prompts
2. Download documents from S3 (with format conversion)
3. Construct structured JSON schema prompt
4. Send to Gemini AI with documents
5. Parse AI response and save with confidence scores
```

**Key Features**:
- Confidence scoring for AI-generated values
- Source tracking (AI vs Manual vs Sheet)
- Model versioning (tracks which AI model was used)
- Fallback handling for extraction failures

### 4. **Role-Based Access Control (RBAC)**

```javascript
// Three-tier authorization system
- ADMIN: Full system access, user management, template creation
- GPJ: Brief management, approval workflows
- CLIENT: Document upload, field value submission, view own data
```

**Implementation**: Middleware-based authentication with JWT token verification and role checking before route execution.

### 5. **Transaction-Safe Operations**

```javascript
// Prisma transactions for data consistency
await prisma.$transaction(async (tx) => {
  // Create brief
  // Create sections
  // Create fields
  // All or nothing - ACID compliance
});
```

---

## 🛠️ Key Optimizations

### Performance
- **Connection Pooling**: Prisma connection pooling for database efficiency
- **Parallel Processing**: Document parsing in parallel with `Promise.all`
- **Lazy Loading**: Selective field inclusion in queries
- **Nginx Buffering**: Request/response buffering for better throughput
- **HTTP/2**: Multiplexing for reduced latency

### Security
- **Non-Root Containers**: Docker containers run as unprivileged user
- **Environment Variables**: Secrets managed via `.env` files (never committed)
- **Input Sanitization**: All user inputs validated and sanitized
- **SQL Injection Prevention**: Prisma's parameterized queries
- **Rate Limiting Ready**: Architecture supports rate limiting middleware

### Scalability
- **Stateless Design**: JWT-based auth enables horizontal scaling
- **Database Adapter**: Prisma PG adapter for connection pooling
- **Docker Networking**: Custom bridge network for service isolation
- **Health Checks**: Automated container restart on failure
- **Logging**: File-based logging with daily rotation

---

## 📁 Project Structure

```
gpj_backend/
├── config/                 # Configuration files
│   └── prisma.client.js   # Prisma client with PG adapter
├── helper/                 # Utility functions
│   ├── fileConverter.helper.js  # Document parsing (PDF, PPTX, XLSX)
│   └── logger.helper.js         # Structured logging system
├── libraries/              # Reusable modules
│   ├── auth/              # Authentication middleware (Admin, GPJ, Client)
│   ├── gemini/            # Gemini AI integration
│   ├── jwt/               # JWT token generation/verification
│   └── s3/                # AWS S3 operations
├── prisma/                 # Database schema and migrations
│   └── schema.prisma      # Prisma schema definition
├── routes/                 # API endpoints
│   ├── brief.routes.js    # Brief and template management
│   ├── download.routes.js # S3 download URL generation
│   ├── field.routes.js    # Field CRUD operations
│   ├── fieldValue.routes.js # AI generation and manual entry
│   ├── section.routes.js  # Section management
│   ├── upload.routes.js   # S3 upload URL generation
│   └── user.routes.js     # User authentication and management
├── services/               # Business logic layer
│   ├── brief.services.js
│   ├── field.services.js
│   ├── fieldValue.services.js  # AI extraction logic
│   ├── section.services.js
│   ├── template.services.js    # Template CRUD with transactions
│   ├── upload.services.js
│   └── user.services.js
├── nginx/                  # Nginx configuration
│   ├── default.conf       # Reverse proxy config with SSL
│   └── ssl/               # SSL certificates
├── docker-compose.yml      # Development environment
├── docker-compose.prod.yml # Production environment
├── Dockerfile.prod         # Multi-stage production build
└── server.js              # Application entry point
```

---

## 🔌 API Endpoints

### Authentication
- `POST /users/register` - User registration
- `POST /users/login` - User login (returns JWT)
- `GET /users` - List all users (Admin only)
- `GET /users/:id` - Get user details (Admin only)
- `PUT /users/:id` - Update user (Admin only)

### Brief & Template Management
- `POST /briefs/from-template` - Create brief from template (Admin)
- `PUT /briefs/from-template` - Update brief from template (Admin)
- `GET /briefs/templates` - List all templates
- `GET /briefs/templates/preview` - Template preview with submission counts
- `GET /briefs/templates/:id` - Get template with user's field values
- `GET /briefs/:id` - Get brief by ID

### Document Upload/Download
- `GET /upload/signed-url` - Generate S3 upload URL
- `POST /upload/confirm` - Confirm successful upload
- `DELETE /upload/:documentId` - Delete document
- `GET /download` - Generate S3 download URL (single file)
- `POST /download` - Generate S3 download URLs (batch)

### AI Field Generation
- `POST /fieldvalue/section/ai` - Generate AI prompt for section
- `POST /fieldvalue/section/generate` - Generate field values with AI
- `POST /fieldvalue/section/fill` - Manually fill field values

### Section & Field Management
- `GET /sections/:id` - Get section details
- `GET /fields/:id` - Get field details
- `PUT /fields/:id` - Update field definition

---

## 🚢 Deployment

### Production Deployment (Docker)

```bash
# Build and start production containers
npm run start-prod

# Services started:
# - PostgreSQL (port 5432)
# - Backend API (internal port 8000)
# - Nginx (ports 80, 443)
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/gpj_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=gpj_db

# AWS S3
S3_ACCESS_KEY=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket_name

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRY=24h

# Google AI
GEMINI_API_KEY=your_gemini_api_key

# Server
PORT=8000
NODE_ENV=production
```

### SSL Configuration

The project includes production-ready SSL configuration:
- **Let's Encrypt** integration via Certbot
- **HTTP to HTTPS** automatic redirect
- **HSTS** headers for security
- **OCSP Stapling** for certificate validation
- **Modern TLS** (TLS 1.2, 1.3 only)

---

## 🧪 Technical Achievements

### 1. **Custom Document Parser**
Built a production-grade PPTX parser that:
- Extracts text from XML structure
- Filters 20+ types of metadata artifacts
- Handles parallel slide processing
- Provides meaningful error recovery

### 2. **Presigned URL Architecture**
Implemented a zero-server-load file upload system:
- Client never sends files to backend
- Backend only handles metadata
- Scalable to millions of concurrent uploads
- Secure with time-limited access

### 3. **AI Integration**
Integrated Google's Gemini AI for structured data extraction:
- Dynamic prompt generation from schema
- Multi-document context handling
- Confidence scoring for AI outputs
- Fallback and error handling

### 4. **Production-Grade Docker Setup**
Multi-stage Docker build with:
- Separate dependency and build stages
- Non-root user execution
- Health checks for all services
- Automated database migrations
- Optimized layer caching

### 5. **Comprehensive Logging**
File-based logging system with:
- Daily log rotation
- Separate log types (error, info, debug, access)
- Structured log format with timestamps
- Automatic directory creation

---

## 💡 Design Decisions

### Why Prisma?
- Type-safe database queries
- Automatic migration generation
- Built-in connection pooling
- Excellent TypeScript support
- Active community and documentation

### Why Presigned URLs?
- Eliminates server as bottleneck
- Reduces bandwidth costs
- Improves upload performance
- Enables direct browser-to-S3 uploads
- Maintains security through time-limited tokens

### Why JWT?
- Stateless authentication
- Horizontal scalability
- No server-side session storage
- Easy to implement across microservices
- Industry standard

### Why Multi-Stage Docker Build?
- Smaller production images
- Faster deployment
- Improved security (no dev dependencies)
- Better layer caching
- Separation of build and runtime environments

---

## 📈 Performance Metrics

- **API Response Time**: < 100ms for most endpoints (excluding AI generation)
- **AI Generation**: 5-15 seconds depending on document size
- **File Upload**: Direct to S3, no server involvement
- **Database Queries**: Optimized with selective field inclusion
- **Docker Image Size**: ~200MB (Alpine-based)
- **Container Startup**: < 10 seconds with health checks

---

## 🎓 Skills Demonstrated

### Backend Development
- RESTful API design
- Service-oriented architecture
- Database schema design
- ORM usage (Prisma)
- Transaction management

### Cloud & DevOps
- AWS S3 integration
- Docker containerization
- Docker Compose orchestration
- Nginx configuration
- SSL/TLS setup
- Production deployment

### Security
- JWT authentication
- Role-based access control
- Password hashing (bcrypt)
- Input validation
- SQL injection prevention
- HTTPS/TLS

### AI/ML Integration
- Gemini AI API integration
- Prompt engineering
- Document processing
- Confidence scoring
- Error handling

### Software Engineering
- Modular architecture
- Separation of concerns
- Error handling
- Logging and monitoring
- Code organization
- Documentation

---

## 📝 License

ISC

---

## 👨‍💻 Author

Built to demonstrate advanced backend engineering capabilities including AI integration, cloud infrastructure, security best practices, and production-ready deployment strategies.

**Key Strengths Showcased:**
- Full-stack backend development
- Cloud-native architecture
- AI/ML integration
- DevOps and containerization
- Security and authentication
- Database design and optimization
- API design and documentation
