import { NextResponse } from "next/server";

/**
 * GET /api/docs
 * 
 * Documentação OpenAPI/Swagger da API
 */
export async function GET() {
  const openApiSpec = {
    openapi: "3.0.0",
    info: {
      title: "Carreira AI Hub API",
      version: "1.0.0",
      description: "API do middleware proprietário Carreira AI Hub",
    },
    servers: [
      {
        url: process.env.NEXTAUTH_URL || "http://localhost:3000",
        description: "Servidor de desenvolvimento",
      },
    ],
    paths: {
      "/api/chat": {
        post: {
          summary: "Enviar mensagem ao chatbot",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["leadId", "message"],
                  properties: {
                    leadId: { type: "string", format: "uuid" },
                    conversationId: { type: "string", format: "uuid" },
                    message: { type: "string", minLength: 1, maxLength: 2000 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Resposta do chatbot",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      conversationId: { type: "string" },
                      response: { type: "string" },
                      escalated: { type: "boolean" },
                      qualificationScore: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/leads": {
        get: {
          summary: "Listar leads",
          parameters: [
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "source", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "offset", in: "query", schema: { type: "integer" } },
          ],
          responses: {
            "200": {
              description: "Lista de leads",
            },
          },
        },
        post: {
          summary: "Criar novo lead",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "name"],
                  properties: {
                    email: { type: "string", format: "email" },
                    name: { type: "string" },
                    phone: { type: "string" },
                    source: { type: "string", enum: ["WEBSITE", "WHATSAPP", "REFERRAL", "SOCIAL_MEDIA", "OTHER"] },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Lead criado",
            },
          },
        },
      },
      "/api/leads/{id}": {
        get: {
          summary: "Buscar lead por ID",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Lead encontrado",
            },
            "404": {
              description: "Lead não encontrado",
            },
          },
        },
      },
      "/api/leads/{id}/qualify": {
        post: {
          summary: "Qualificar lead",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Lead qualificado",
            },
          },
        },
      },
      "/api/conversations": {
        get: {
          summary: "Listar conversas",
          parameters: [
            { name: "leadId", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Lista de conversas",
            },
          },
        },
        post: {
          summary: "Criar nova conversa",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["leadId"],
                  properties: {
                    leadId: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Conversa criada",
            },
          },
        },
      },
      "/api/webhooks/pipedrive/lead": {
        post: {
          summary: "Webhook: Novo lead do Pipedrive",
          description: "Recebe notificação quando um novo Person é criado no Pipedrive",
          responses: {
            "200": {
              description: "Lead processado",
            },
          },
        },
      },
      "/api/webhooks/pipedrive/deal": {
        post: {
          summary: "Webhook: Deal Won do Pipedrive",
          description: "Recebe notificação quando um Deal é marcado como Won",
          responses: {
            "200": {
              description: "Deal processado",
            },
          },
        },
      },
      "/api/webhooks/whatsapp": {
        post: {
          summary: "Webhook: Mensagem WhatsApp",
          description: "Recebe mensagens do WhatsApp Business API",
          responses: {
            "200": {
              description: "Mensagem processada",
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Lead: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            status: { type: "string", enum: ["NEW", "QUALIFYING", "QUALIFIED", "UNQUALIFIED", "CONVERTED", "LOST"] },
            qualificationScore: { type: "integer", minimum: 0, maximum: 100 },
          },
        },
        Conversation: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            leadId: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["ACTIVE", "RESOLVED", "ESCALATED", "CLOSED"] },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}

