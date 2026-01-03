# Tooluse Caesar 2

A web-based tool management system for LLM agents with Mistral-compatible function calls and an integrated MCP server.

## Overview

Tooluse Caesar 2 allows developers to define, test, and deploy tools for LLM agents without local setup. It provides a clean UI for tool management and exposes APIs that agents can use directly.

## Key Features

- **Tool Definition**: Create tools with Mistral-compatible metadata (name, description, JSON Schema parameters)
- **Tool Chains**: Combine multiple tools into sequential workflows with output-to-input mapping
- **HTTP Configuration**: Define endpoint, method, headers, and body templates for API calls
- **Pre/Post Processing**: JavaScript functions for data transformation before/after API calls
- **Fake Responses**: Static responses for rapid prototyping without external API calls
- **MCP Server**: Automatic endpoint providing active tools and chains in Mistral function call format
- **Authentication**: Session-based authentication with admin user created from environment variables
- **User Management**: Admin can create additional users via Settings page
- **API-Key Security**: MCP endpoints require API key in URL path (404 otherwise)

## Authentication

The application uses session-based authentication:
- **Admin User**: Created automatically on startup from `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables
- **User Management**: Logged-in users can create/delete other users via Settings page
- **No Public Registration**: Registration is disabled; only existing users can create new accounts

## Project Structure

```
├── client/                 # React frontend
│   └── src/
│       ├── components/     # Reusable UI components
│       │   ├── app-sidebar.tsx      # Navigation sidebar
│       │   ├── theme-provider.tsx   # Dark/light mode support
│       │   └── theme-toggle.tsx     # Theme toggle button
│       └── pages/
│           ├── login.tsx            # Login page (no registration)
│           ├── dashboard.tsx        # Tool overview
│           ├── tool-editor.tsx      # Create/edit tools
│           ├── tool-execute.tsx     # Execute tools with UI
│           ├── chains-dashboard.tsx # Chain overview
│           ├── chain-editor.tsx     # Create/edit chains
│           ├── chain-execute.tsx    # Execute chains with UI
│           └── settings.tsx         # API key and user management
├── server/                 # Express backend
│   ├── auth.ts             # Passport.js authentication setup
│   ├── routes.ts           # API routes including MCP endpoints
│   ├── storage.ts          # PostgreSQL storage with Drizzle ORM
│   └── db.ts               # Database connection
└── shared/
    └── schema.ts           # TypeScript types and Zod schemas
```

## API Endpoints

### Authentication (prefix: /api/auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login with username/password |
| POST | /api/auth/logout | Logout current session |
| GET | /api/auth/user | Get current authenticated user |

### User Management (prefix: /api/users, requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/users | List all users |
| POST | /api/users | Create new user |
| DELETE | /api/users/:id | Delete user |

### Tool Management (prefix: /api/tools, requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tools | List all tools |
| GET | /api/tools/:id | Get single tool |
| POST | /api/tools | Create new tool |
| PUT | /api/tools/:id | Update tool |
| PATCH | /api/tools/:id | Toggle active status |
| DELETE | /api/tools/:id | Delete tool |
| POST | /api/tools/:id/execute | Execute tool internally |

### Chain Management (prefix: /api/chains, requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/chains | List all chains |
| GET | /api/chains/:id | Get single chain |
| POST | /api/chains | Create new chain |
| PUT | /api/chains/:id | Update chain |
| PATCH | /api/chains/:id | Toggle active status |
| DELETE | /api/chains/:id | Delete chain |
| POST | /api/chains/:id/execute | Execute chain |

### Settings (prefix: /api/settings, requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/settings/api-key | Get API key |
| POST | /api/settings/api-key/regenerate | Regenerate API key |

### MCP Server Endpoints (require API key in path)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /:apiKey/tools | List active tools and chains in Mistral format |
| POST | /:apiKey/tools/:toolName | Execute tool or chain by name |

## Tool Schema

Tools follow the Mistral function call specification:

```json
{
  "type": "function",
  "function": {
    "name": "tool_name",
    "description": "What the tool does",
    "parameters": {
      "type": "object",
      "properties": {
        "param1": {
          "type": "string",
          "description": "Parameter description"
        }
      },
      "required": ["param1"]
    }
  }
}
```

## Chain Schema

Chains combine multiple tools into sequential workflows:

```json
{
  "name": "workflow_chain",
  "description": "Chain description",
  "steps": [
    {
      "toolId": "uuid-of-first-tool",
      "inputMapping": {},
      "continueOnError": false
    },
    {
      "toolId": "uuid-of-second-tool",
      "inputMapping": { "param": "$.previousOutput" },
      "continueOnError": false
    }
  ],
  "isActive": true
}
```

Input mapping uses `$.fieldName` syntax to reference outputs from the previous step.

## Environment Variables

| Variable | Description |
|----------|-------------|
| ADMIN_USERNAME | Username for auto-created admin user |
| ADMIN_PASSWORD | Password for auto-created admin user |
| SESSION_SECRET | Secret for session encryption |
| DATABASE_URL | PostgreSQL connection string |

## Development

- Frontend runs on Vite with React + TypeScript
- Backend uses Express.js with Passport.js for authentication
- Database: PostgreSQL with Drizzle ORM
- Styling with Tailwind CSS and shadcn/ui components
- State management with TanStack Query

## Running the Application

The app starts automatically with `npm run dev` which runs both frontend and backend on port 5000.
