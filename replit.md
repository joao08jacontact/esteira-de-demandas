# Overview

This is a unified management platform for JaContact that combines three key modules:

1. **Esteira de Demandas** - A task pipeline/kanban system for managing daily operational demands across different teams and operations
2. **Dashboard GLPI** - A real-time monitoring dashboard for GLPI ticketing system with filtering, statistics, and data visualization
3. **BI Cadastro** - Power BI project management system with visual canvas planning, data source tracking, and status workflow management

The platform provides a cohesive interface for tracking internal demands, external support tickets, and BI development projects, enabling comprehensive operational and analytical oversight.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React 18+ with TypeScript, using Vite as the build tool and development server.

**UI Component System**: Shadcn/ui (Radix UI primitives) with Material Design principles. Components follow the "new-york" style variant with dark mode as the primary theme. All UI components are located in `client/src/components/ui/` and use Tailwind CSS for styling with custom CSS variables for theming.

**Routing**: Wouter for lightweight client-side routing. Three main routes:
- `/` - Esteira de Demandas (task pipeline)
- `/dashboard` - GLPI Dashboard
- `/bi-cadastro` - BI Cadastro (Power BI project management)

**State Management**: 
- TanStack Query (React Query) for server state and API data fetching with automatic caching and refetching
- Local React state (useState) for UI state
- Firebase Firestore real-time listeners for Esteira de Demandas task synchronization

**Styling Approach**: Tailwind CSS with custom design tokens defined in CSS variables. The design follows a cohesive color palette with both light and dark mode support, though dark mode is the primary interface. Typography uses Inter font family from Google Fonts.

**Layout Structure**: SidebarProvider wraps the entire app, providing a unified navigation sidebar (16rem width) that allows switching between the two modules. The sidebar includes theme toggle functionality.

## Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js. The server uses ES modules (type: "module" in package.json).

**API Architecture**: RESTful API endpoints under `/api/*` prefix:
- `/api/tickets` - Fetch and filter GLPI tickets
- `/api/stats` - Retrieve ticket statistics
- `/api/categories` - Get GLPI ticket categories
- `/api/users` - Get GLPI technicians/users
- `/api/bis` - CRUD operations for Power BI projects
- `/api/bases/:id/status` - Update data source status
- `/api/canvas` - Save and retrieve visual planning canvas data

**Development vs Production**: 
- Development: Vite middleware integrated into Express for HMR and fast refresh
- Production: Static files served from `dist/public` after build

**Error Handling**: Global error handler middleware catches all errors and returns JSON responses with appropriate HTTP status codes.

**Logging**: Custom request logging middleware tracks API requests with timing information, automatically truncating long log lines to 80 characters.

## Data Storage Solutions

**Esteira de Demandas**: Firebase Firestore (NoSQL cloud database)
- Structure: `workspaces/{workspaceId}/days/{YYYY-MM-DD}/tasks/*`
- Real-time synchronization using Firestore's `onSnapshot` listeners
- Workspace isolation via query parameter `?ws=` in URL
- Supports recurring tasks with series tracking (daily/weekly patterns)

**GLPI Integration**: External GLPI API (no local database for tickets)
- Session-based authentication using user tokens and app tokens
- Direct `/Ticket/` endpoint used for fetching tickets with proper data structure
- Server-side filtering applied for all ticket parameters (status, priority, type, category, assignedTo, assignedGroup, dates)
- Ticket data fetched on-demand with configurable auto-refresh (30-second intervals)
- Statistics calculated server-side from filtered ticket data

**BI Cadastro Module**: In-memory storage using `MemStorage` class
- Tracks Power BI projects (BIs) with metadata: name, responsible, operation type, dates, status
- Manages data sources (bases) per BI with status tracking (aguardando, pendente, concluído)
- Automatically marks BI as complete when all bases reach "concluído" status
- Stores visual canvas data (nodes and edges) for BI planning with ReactFlow
- Supports marking BIs as inactive without deletion

**User Data** (Optional/Future): Drizzle ORM configured for PostgreSQL
- Schema defined in `shared/schema.ts` for potential user authentication
- Currently uses in-memory storage (`MemStorage` class) as placeholder
- Neon Database serverless driver configured but not actively used

## External Dependencies

**Third-Party Services**:
- **Firebase/Firestore**: Cloud-hosted NoSQL database for task management. Requires environment variables for configuration (VITE_FIREBASE_*).
- **GLPI API**: External ticketing system integration. Requires `GLPI_API_URL`, `GLPI_USER_TOKEN`, and `GLPI_APP_TOKEN` environment variables.
- **Neon Database**: PostgreSQL serverless database (configured but optional). Requires `DATABASE_URL` environment variable.

**Key Libraries**:
- **@radix-ui/**: Primitive UI components (dialogs, dropdowns, popovers, etc.)
- **@tanstack/react-query**: Server state management and caching
- **@xyflow/react**: ReactFlow library for interactive node-based canvas in BI planning
- **axios**: HTTP client for GLPI API requests
- **drizzle-orm** & **drizzle-kit**: TypeScript ORM for PostgreSQL with schema migrations
- **firebase**: SDK for Firestore integration
- **wouter**: Minimal routing library
- **recharts**: Charting library for data visualization in dashboard
- **tailwindcss**: Utility-first CSS framework
- **zod**: TypeScript-first schema validation

**Build Tools**:
- **Vite**: Frontend build tool and dev server with HMR
- **esbuild**: Backend bundler for production builds
- **TypeScript**: Type-safe development across frontend and backend
- **tsx**: TypeScript execution for Node.js development

**Design Rationale**: The architecture separates concerns between external ticket management (GLPI), internal task coordination (Firebase), and BI project tracking (in-memory storage), allowing each system to be optimized independently. The unified frontend provides a single interface with consistent navigation while maintaining flexibility in backend data sources.

# Recent Changes (October 19, 2025)

## BI Cadastro Module Integration
- Integrated third module from external repository (https://github.com/joao08jacontact/CRIACAOBI.git)
- Added complete schema definitions for BIs, data sources (bases), and canvas elements
- Implemented 7 backend API routes for CRUD operations and status management
- Created 4 frontend components: BiForm, BiTable, BiCanvas, CustomNode
- Added ReactFlow-based visual canvas for BI planning with drag-and-drop nodes
- Implemented automatic BI completion workflow when all bases reach "concluído" status
- Added Database icon navigation item to unified sidebar
- End-to-end testing passed: BI creation, status updates, automatic completion, canvas operations