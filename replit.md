# Tooluse Caesar 2

A web-based tool management system for LLM agents with Mistral-compatible function calls and an integrated MCP server.

## Overview

Tooluse Caesar 2 allows developers to define, test, and deploy tools for LLM agents without local setup. It provides a clean UI for tool management and exposes APIs that agents can use directly.

## Key Features

- **Tool Definition**: Create tools with Mistral-compatible metadata (name, description, JSON Schema parameters)
- **HTTP Configuration**: Define endpoint, method, headers, and body templates for API calls
- **Pre/Post Processing**: JavaScript functions for data transformation before/after API calls
- **Fake Responses**: Static responses for rapid prototyping without external API calls
- **MCP Server**: Automatic endpoint providing active tools in Mistral function call format
- **API-Key Security**: All API calls require API key in URL path (404 otherwise)

## Project Structure

```
├── client/                 # React frontend
│   └── src/
│       ├── components/     # Reusable UI components
│       │   ├── app-sidebar.tsx      # Navigation sidebar
│       │   ├── theme-provider.tsx   # Dark/light mode support
│       │   └── theme-toggle.tsx     # Theme toggle button
│       └── pages/
│           ├── dashboard.tsx        # Tool overview
│           ├── tool-editor.tsx      # Create/edit tools
│           ├── tool-execute.tsx     # Execute tools with UI
│           └── settings.tsx         # API key management
├── server/                 # Express backend
│   ├── routes.ts           # API routes including MCP endpoints
│   └── storage.ts          # In-memory storage with sample tools
└── shared/
    └── schema.ts           # TypeScript types and Zod schemas
```

## API Endpoints

### Internal Management API (prefix: /api)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tools | List all tools |
| GET | /api/tools/:id | Get single tool |
| POST | /api/tools | Create new tool |
| PUT | /api/tools/:id | Update tool |
| PATCH | /api/tools/:id | Toggle active status |
| DELETE | /api/tools/:id | Delete tool |
| POST | /api/tools/:id/execute | Execute tool internally |
| GET | /api/settings/api-key | Get API key |
| POST | /api/settings/api-key/regenerate | Regenerate API key |

### MCP Server Endpoints (require API key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /:apiKey/tools | List active tools in Mistral format |
| POST | /:apiKey/tools/:toolName | Execute tool by name |

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

## Development

- Frontend runs on Vite with React + TypeScript
- Backend uses Express.js
- Styling with Tailwind CSS and shadcn/ui components
- State management with TanStack Query

## Running the Application

The app starts automatically with `npm run dev` which runs both frontend and backend on port 5000.
