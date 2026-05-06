# Chatbot API Documentation

The DeepSkyn chatbot allows users to have AI-powered conversations about skincare, analyze their skin concerns, and get personalized routine recommendations.

## Endpoints

### POST /chatbot/message
Send a message to the chatbot and receive a response.

**Authentication:** Required (Keycloak JWT)

**Request Body:**
```json
{
  "message": "What skincare routine should I follow?",
  "conversationId": "optional-existing-conversation-id"
}
```

**Response:**
```json
{
  "conversationId": "conversation-uuid",
  "message": {
    "role": "assistant",
    "content": "Based on your skin analysis...",
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "userMessage": {
    "role": "user",
    "content": "What skincare routine should I follow?",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /chatbot/conversations
Get all conversations for the authenticated user.

**Authentication:** Required (Keycloak JWT)

**Response:**
```json
[
  {
    "id": "conversation-uuid",
    "messages": [...],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### GET /chatbot/conversation/:id
Get a specific conversation by ID.

**Authentication:** Required (Keycloak JWT)

**Parameters:**
- `id`: Conversation UUID

**Response:**
```json
{
  "id": "conversation-uuid",
  "userId": "user-uuid",
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "Hi! How can I help with your skincare today?",
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Features

- **Personalized Responses:** Uses user's skin analysis data and reminders for context
- **Conversation History:** Maintains chat history for continuity
- **AI-Powered:** Uses Gemini AI for intelligent responses
- **Skincare Focus:** Specializes in skincare advice, routines, and product recommendations

## Message Format

Each message in a conversation has the following structure:
```json
{
  "role": "user" | "assistant",
  "content": "message text",
  "timestamp": "ISO date string"
}
```