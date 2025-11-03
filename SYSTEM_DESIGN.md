# System Design Document

## Mailautomation - IITK Webmail Automation & AI Summarization App

---

## 1. Architecture Overview

### 1.1 System Architecture

The application follows a **client-server architecture** with a clear separation between frontend and backend components.

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              React Frontend (Vite)                    │  │
│  │  • Login Page                                        │  │
│  │  • Home Dashboard                                    │  │
│  │  • Email Cards & Sidebar                             │  │
│  │  • Email Compose Modal                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP/REST API
                           │ (JWT Authentication)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                         SERVER                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Express.js Backend (Node.js)                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │  │
│  │  │ Auth Routes  │  │ Email Routes │  │ Middleware│ │  │
│  │  └──────────────┘  └──────────────┘  └───────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐          │
│    │ Email  │      │OpenRouter│      │  SMTP   │          │
│    │Service │      │ Service  │      │ Service │          │
│    └────┬────┘      └────┬────┘      └────┬────┘          │
│         │                 │                 │               │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
    ┌─────────┐       ┌──────────┐      ┌─────────┐
    │ IITK    │       │ OpenRouter│      │ IITK    │
    │ IMAP    │       │ MiniMax M2│      │ MMTP    │
    │ Server  │       │   API     │      │ Server  │
    └─────────┘       └──────────┘      └─────────┘
```

### 1.2 Technology Stack

#### Frontend Technologies
- **React 18.3.1**: Component-based UI library for building interactive user interfaces
- **TypeScript**: Type-safe JavaScript for better code quality and maintainability
- **Vite 5.4.2**: Fast build tool and dev server for modern web development
- **TailwindCSS 3.4.1**: Utility-first CSS framework for rapid UI development
- **Framer Motion 12.23.24**: Animation library for smooth UI transitions
- **Lucide React**: Modern icon library for consistent iconography

**Reasons for Frontend Choices:**
- **React**: Industry standard, large ecosystem, excellent for component reusability
- **TypeScript**: Catches errors at compile-time, improves developer experience
- **Vite**: Much faster than Create React App, excellent HMR (Hot Module Replacement)
- **TailwindCSS**: Rapid development without custom CSS files, responsive design made easy
- **Framer Motion**: Professional animations with minimal code

#### Backend Technologies
- **Node.js**: JavaScript runtime for server-side execution
- **Express.js 4.21.1**: Minimal web framework for building REST APIs
- **TypeScript**: Type safety across the entire stack
- **TSX**: TypeScript execution for Node.js without compilation

**Reasons for Backend Choices:**
- **Node.js + Express**: Simple, lightweight, and familiar for JavaScript developers
- **TypeScript**: Same language across frontend and backend, reduces context switching
- **Express**: Minimal overhead, perfect for REST APIs, large middleware ecosystem

#### Email & Communication Protocols
- **IMAP (node-imap 0.8.19)**: Protocol for fetching emails from IITK mail server
- **SMTP/MMTP (nodemailer 7.0.10)**: Protocol for sending emails
- **Mailparser 3.7.1**: Parses raw email content into structured data

**Reasons for Email Protocol Choices:**
- **IMAP**: Standard protocol, supports folder operations, allows fetching only new emails
- **SMTP/MMTP**: Standard protocol for sending emails, well-supported by IITK infrastructure
- **Mailparser**: Handles complex email formats (HTML, attachments, MIME)

#### AI Integration
- **OpenRouter MiniMax M2 (Free)**: AI model for email analysis and reply generation

**Reasons for AI Choice:**
- **OpenRouter**: Provides access to multiple AI models through unified API
- **MiniMax M2**: Free tier available, good performance for text analysis tasks
- **Unified API**: Easy to switch models if needed without code changes

#### Authentication & Security
- **JWT (jsonwebtoken 9.0.2)**: Token-based authentication
- **bcryptjs 2.4.3**: Password hashing (for future enhancements)

**Reasons for Security Choices:**
- **JWT**: Stateless authentication, scalable, works well with SPAs
- **bcryptjs**: Industry-standard password hashing (currently not used but included for future)

---

## 2. Data Design

### 2.1 Data Models

#### Email Interface
```typescript
interface Email {
  id: string;                    // Unique identifier (stable across fetches)
  sender: string;                // Email sender address
  subject: string;               // Email subject line
  body: string;                  // Full email body content
  date: Date;                    // Email date (server-received timestamp)
  category?: EmailCategory;       // AI-categorized type
  summary?: string;              // AI-generated summary
  extractedEvents?: string[];    // Events extracted from email content
}
```

**Design Decisions:**
- **Stable ID**: Uses messageId or composite key (subject+date+sender) to prevent duplicates on refresh
- **Optional AI fields**: Category, summary, and events are optional to handle failures gracefully
- **Date as Date object**: Preserves timezone information and enables accurate sorting

#### EmailCategory Type
```typescript
type EmailCategory = 
  | 'Important-Academics'    // Lectures, classes, labs
  | 'Important-Deadline'     // Submissions, registrations
  | 'Event'                  // Meetings, workshops, conferences
  | 'General';               // Other emails
```

**Design Decisions:**
- **Hierarchical categories**: "Important-" prefix allows filtering important emails together
- **Academic focus**: Specifically designed for student use cases

#### AIResponse Interface
```typescript
interface AIResponse {
  category: EmailCategory;
  summary: string;
  events?: string[];
}
```

**Design Decisions:**
- **Structured response**: Ensures consistent AI output format
- **Optional events**: Not all emails contain events

### 2.2 Data Flow

#### Email Fetching Flow
```
1. User Login → JWT Token Generated
2. Frontend Request → Backend API
3. Backend → IMAP Connection (new connection each time)
4. IMAP Server → Raw Email Data
5. Backend → Parse Emails (mailparser)
6. Backend → AI Analysis (OpenRouter) - Cached for performance
7. Backend → Return Structured Data
8. Frontend → Display Emails
```

#### Email Sending Flow
```
1. User Clicks Reply → Password Prompt
2. User Enters Password → Frontend Request
3. Backend → Validate JWT
4. Backend → MMTP Connection
5. Backend → Send Email (nodemailer)
6. Backend → Return Success/Error
7. Frontend → Show Success Message
```

### 2.3 Caching Strategy

**In-Memory Cache for AI Analysis:**
- **Location**: `server/routes/emails.ts` - `emailSummaryCache` Map
- **Key**: Email ID (stable identifier)
- **Value**: Cached AI analysis result
- **Benefits**: 
  - Avoids redundant API calls for same emails
  - Faster response on refresh
  - Reduces OpenRouter API costs
- **Limitations**: Cache cleared on server restart (ephemeral)

**Why This Approach:**
- Email content doesn't change once received
- AI analysis is expensive (API calls, processing time)
- In-memory cache is fast and simple for this use case

---

## 3. Component Breakdown

### 3.1 Frontend Components

#### 3.1.1 Page Components

**Login.tsx**
- **Purpose**: User authentication entry point
- **Responsibilities**: 
  - Email/password input validation
  - API authentication request
  - Token storage in localStorage
  - Navigation to Home on success
- **Key Features**: Error handling, loading states

**Home.tsx**
- **Purpose**: Main dashboard for email management
- **Responsibilities**:
  - Email fetching and state management
  - Progressive loading (40 emails in batches of 4)
  - Auto-refresh polling (30 seconds)
  - Email filtering and sorting
  - Event collection from emails
- **State Management**: Multiple useState hooks for emails, loading, filtering
- **Key Features**: 
  - Batch processing for better UX
  - Page visibility API for efficient polling
  - Functional state updates to prevent stale closures

#### 3.1.2 UI Components

**Header.tsx**
- **Purpose**: Navigation and actions bar
- **Features**: 
  - Refresh button (with loading state)
  - Theme toggle (light/dark mode)
  - Logout button
  - User email display

**EmailCard.tsx**
- **Purpose**: Display individual email summary
- **Props**: sender, subject, summary, date, category, originalBody
- **Features**: 
  - Category badges with color coding
  - Date formatting (time if today, date otherwise)
  - Reply button
  - Dark mode support

**Sidebar.tsx**
- **Purpose**: Display upcoming events and important dates
- **Features**: 
  - Categorizes events (Important Days vs Other Events)
  - Academic event detection
  - Scrollable event list
  - Visual distinction (exam/deadline/event)

**EmailComposeModal.tsx**
- **Purpose**: AI-powered email reply generation
- **Features**: 
  - Multi-step flow (prompt → generated → refine)
  - AI reply generation with refinement
  - Password confirmation before sending
  - Success/error feedback
  - Email preview

**ThemeContext.tsx**
- **Purpose**: Global theme management
- **Features**: 
  - Light/dark mode toggle
  - Persistence in localStorage
  - CSS variable management
  - System preference detection

### 3.2 Backend Components

#### 3.2.1 Routes

**auth.ts**
- **Endpoints**:
  - `POST /api/auth/login`: Authenticate with IITK credentials
- **Flow**: 
  1. Validate credentials by attempting IMAP connection
  2. Generate JWT token
  3. Return token to client

**emails.ts**
- **Endpoints**:
  - `POST /api/emails/fetch-progressive`: Progressive batch loading (4 emails/batch)
  - `POST /api/emails/fetch-new`: Refresh only new emails since last fetch
  - `POST /api/emails/send`: Send email via MMTP
  - `POST /api/emails/generate-reply`: Generate AI email reply
- **Authentication**: All endpoints protected by JWT middleware

#### 3.2.2 Services

**emailService.ts**
- **Purpose**: IMAP email fetching and parsing
- **Key Functions**:
  - `connectToIMAP()`: Establishes secure IMAP connection
  - `fetchEmails()`: Fetches last 40 emails from inbox
  - `fetchUserEmails()`: High-level function with timeout handling
- **Design Decisions**:
  - Always creates new IMAP connection (ensures fresh data)
  - Stable email IDs (prevents duplicates)
  - Timeout handling (3 minutes total)

**openRouterService.ts**
- **Purpose**: AI-powered email analysis and reply generation
- **Key Functions**:
  - `analyzeEmail()`: Categorizes and summarizes emails
  - `generateEmailReply()`: Creates AI-generated replies
- **Design Decisions**:
  - Token/character limits to fit model constraints
  - Structured prompts for consistent output
  - Error handling and fallbacks

**smtpService.ts**
- **Purpose**: Email sending via MMTP
- **Key Functions**:
  - `sendEmail()`: Sends email through IITK MMTP server
- **Design Decisions**:
  - Username extraction (removes @iitk.ac.in for auth)
  - Port 465 with SSL/TLS
  - Detailed error messages for debugging

#### 3.2.3 Middleware

**auth.ts**
- **Purpose**: JWT authentication middleware
- **Flow**: 
  1. Extract token from Authorization header
  2. Verify token signature
  3. Attach user email to request object
  4. Continue to route handler or return 401

**asyncHandler.ts**
- **Purpose**: Wraps async route handlers
- **Benefits**: Centralized error handling, prevents unhandled promise rejections

---

## 4. Chosen Technologies & Rationale

### 4.1 Frontend Framework: React + TypeScript

**Why React?**
- **Component Reusability**: EmailCard, Sidebar can be reused easily
- **State Management**: Built-in hooks (useState, useEffect) handle complex state
- **Large Ecosystem**: Vast library support (Framer Motion, Lucide React)
- **Performance**: Virtual DOM optimization, efficient re-renders
- **Developer Experience**: Excellent tooling (React DevTools)

**Why TypeScript?**
- **Type Safety**: Catches errors before runtime (EmailCategory, Email interface)
- **IntelliSense**: Better IDE autocomplete and refactoring
- **Maintainability**: Self-documenting code through types
- **Refactoring**: Safer code changes with type checking

### 4.2 Build Tool: Vite

**Why Vite?**
- **Speed**: Instant server start, fast HMR (Hot Module Replacement)
- **Modern**: ES modules, native ESM support
- **Optimization**: Automatic code splitting, tree shaking
- **Developer Experience**: Better error messages, faster builds

**Alternatives Considered:**
- Create React App: Slower, more configuration overhead
- Webpack: More complex, slower development builds

### 4.3 Styling: TailwindCSS

**Why TailwindCSS?**
- **Rapid Development**: No custom CSS files needed
- **Consistency**: Pre-defined design system (colors, spacing)
- **Responsive**: Built-in responsive utilities
- **Dark Mode**: Easy dark mode support with `dark:` prefix
- **Bundle Size**: Tree-shaking removes unused styles

**Alternatives Considered:**
- CSS Modules: More verbose, separate files
- Styled Components: Runtime overhead, harder to debug

### 4.4 Backend Framework: Express.js

**Why Express?**
- **Minimal**: Lightweight, fast, perfect for REST APIs
- **Middleware**: Easy to add authentication, CORS, error handling
- **Flexibility**: Unopinionated, allows custom architecture
- **Mature**: Stable, well-documented, large community

**Alternatives Considered:**
- Nest.js: Too opinionated, overkill for this project
- Fastify: Faster but less ecosystem support

### 4.5 Email Protocols: IMAP + SMTP

**Why IMAP?**
- **Standard Protocol**: Works with all email servers
- **Folder Support**: Can access different mailboxes
- **Efficient**: Can fetch only new emails (UID-based)
- **Bidirectional Sync**: Can mark emails as read, move folders

**Why SMTP/MMTP?**
- **Standard Protocol**: Universal email sending protocol
- **IITK Compatible**: Works with IITK mail infrastructure
- **Reliable**: Well-established, proven technology

**Alternatives Considered:**
- Gmail API: Would require OAuth, specific to Gmail
- POP3: Doesn't support folder sync, less efficient

### 4.6 AI Integration: OpenRouter + MiniMax M2

**Why OpenRouter?**
- **Model Agnostic**: Easy to switch AI models without code changes
- **Unified API**: Single API for multiple providers
- **Rate Limiting**: Built-in rate limit handling
- **Free Tier**: MiniMax M2 has free tier suitable for development

**Why MiniMax M2?**
- **Free Tier**: No cost for development and testing
- **Performance**: Good for text analysis and generation
- **Multilingual**: Supports various languages if needed

**Alternatives Considered:**
- OpenAI GPT: More expensive, requires API key
- Gemini: Was considered initially but switched to OpenRouter for flexibility

### 4.7 Authentication: JWT

**Why JWT?**
- **Stateless**: No server-side session storage needed
- **Scalable**: Works well with distributed systems
- **SPA-Friendly**: Perfect for single-page applications
- **Self-Contained**: User info embedded in token

**Alternatives Considered:**
- Session-based: Requires server-side storage, less scalable
- OAuth: More complex, requires third-party providers

---

## 5. System Design Patterns

### 5.1 Progressive Loading Pattern

**Implementation**: Batch processing (4 emails per batch)
- **Benefits**: 
  - Faster initial render (users see emails sooner)
  - Better perceived performance
  - Reduces server load spikes
- **Trade-offs**: 
  - More HTTP requests
  - More complex state management

### 5.2 Caching Pattern

**Implementation**: In-memory cache for AI results
- **Benefits**: 
  - Faster responses for cached emails
  - Reduces API costs
  - Better user experience
- **Trade-offs**: 
  - Memory usage (minimal for this use case)
  - Cache cleared on restart (acceptable trade-off)

### 5.3 Polling Pattern

**Implementation**: 30-second auto-refresh with Page Visibility API
- **Benefits**: 
  - Automatic email updates
  - Efficient (only polls when tab visible)
  - No WebSocket infrastructure needed
- **Trade-offs**: 
  - Not real-time (30-second delay)
  - Uses network resources (minimal)

### 5.4 Error Boundary Pattern

**Implementation**: Try-catch blocks with user-friendly error messages
- **Benefits**: 
  - Graceful error handling
  - Better user experience
  - Easier debugging

---

## 6. Security Considerations

### 6.1 Authentication Security
- **JWT Tokens**: Signed with secret, short expiration (could be improved)
- **Password Storage**: Currently in localStorage (not ideal, but acceptable for prototype)
- **IMAP Validation**: Credentials validated by attempting connection

### 6.2 API Security
- **CORS**: Configured for development (needs production config)
- **Rate Limiting**: Not implemented (could be added)
- **Input Validation**: Basic validation, could be enhanced

### 6.3 Data Security
- **Environment Variables**: Sensitive data in `.env` (not committed)
- **Email Content**: Passed through AI API (consider privacy implications)
- **HTTPS**: Required in production for secure connections

---

## 7. Performance Optimizations

### 7.1 Frontend Optimizations
- **Progressive Loading**: Show emails as they arrive
- **Virtual Scrolling**: Not implemented (could be added for large lists)
- **Code Splitting**: Automatic with Vite
- **Image Optimization**: Not applicable (no images)

### 7.2 Backend Optimizations
- **AI Caching**: Reduces redundant API calls
- **Batch Processing**: Processes multiple emails concurrently
- **Connection Reuse**: Could be improved (currently creates new IMAP connection each time)
- **Timeout Handling**: Prevents hanging requests

---

## 8. Scalability Considerations

### 8.1 Current Limitations
- **In-Memory Cache**: Lost on restart, not shared across instances
- **Single Server**: Not designed for horizontal scaling
- **IMAP Connection**: One connection per request (could pool connections)

### 8.2 Future Scalability Options
- **Redis Cache**: Replace in-memory cache for multi-instance support
- **Connection Pooling**: Reuse IMAP connections
- **Background Jobs**: Move AI processing to queue system (Bull, Agenda)
- **Database**: Store email metadata in database instead of in-memory

---

## 9. Deployment Considerations

### 9.1 Environment Setup
- **Required Environment Variables**: Listed in README
- **Port Configuration**: Configurable via PORT env variable
- **Build Process**: Separate frontend and backend builds

### 9.2 Production Recommendations
- **HTTPS**: Use reverse proxy (Nginx) with SSL certificate
- **PM2**: Process manager for Node.js backend
- **Environment Variables**: Secure storage (not in code)
- **Monitoring**: Add logging service (Winston, Pino)
- **Error Tracking**: Add error tracking (Sentry)

---

## 10. Conclusion

This system design provides a solid foundation for an email automation application with AI integration. The architecture is simple yet effective, using modern web technologies and best practices. The modular design allows for easy extension and maintenance.

**Key Strengths:**
- Clear separation of concerns
- Type safety across the stack
- Progressive enhancement for better UX
- Caching for performance

**Areas for Improvement:**
- Database integration for persistence
- Better error handling and monitoring
- Production-ready security enhancements
- Horizontal scalability support

---

## Appendix: Technology Versions

- React: 18.3.1
- TypeScript: 5.5.3
- Vite: 5.4.2
- Express: 4.21.1
- Node.js: 18+ (recommended)
- TailwindCSS: 3.4.1
- OpenRouter MiniMax M2: Free tier

