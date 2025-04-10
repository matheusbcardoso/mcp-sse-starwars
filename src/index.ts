import express, { Request, Response } from "express";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import cors from "cors";
import { RequestRedirect } from 'node-fetch';

const PORT = 3000;
const BASE_URL = "https://swapi.dev/api/";

const server = new McpServer({
  name: "example-server",
  version: "1.0.0"
});

server.tool(
  "buscar_personagem_por_nome",
  { nome: z.string().describe("Nome de um personagem de starwars") },
  async ({ nome }) => {
    
    const requestOptions = {
      method: "GET"      
    };

    try {
      const response = await fetch(`${BASE_URL}people/?name=${nome}`, requestOptions);
      const result = await response.text();
      return {
        content: [{ type: "text", text: `Personagem consultado: ${result}` }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        content: [{ type: "text", text: `Erro na consulta: ${errorMessage}` }]
      };
    }
  
  }
);


// Adicionar um prompt específico para consultas de cliente
server.prompt(
  "starwars",
  { query: z.string() },
  ({ query }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Instruções: Você é um assistente de consulta ao universo Star Wars.

                Quando eu solicitar informações sobre um personagem, use a ferramenta "buscar_personagem_por_nome" fornecendo o nome informado.

                Quando eu solicitar informações sobre um planeta, use a ferramenta "buscar_planeta_por_nome" fornecendo o nome informado.

                Quando eu solicitar informações sobre uma nave, use a ferramenta "buscar_nave_por_nome" fornecendo o nome informado.
                
                Minha consulta é: ${query}`
        }
      }
    ]
  })
);

// ##################################################
// Create an Express server
const app = express();

// Configure CORS middleware to allow all origins
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  })
);

// Middleware para pegar o header X-API-Key
app.use((req, res, next) => {
  const apiKeyHeader = req.header('X-API-Key') || req.header('Apikey');
  if (apiKeyHeader) {
    // apiKey = apiKeyHeader;    
  }
  next();
});

// Add a simple root route handler
app.get("/", (req, res) => {
  res.json({
    name: "MCP SSE Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      "/": "Server information (this response)",
      "/sse": "Server-Sent Events endpoint for MCP connection",
      "/messages": "POST endpoint for MCP messages",
    },
    tools: [
      { name: "consultar cliente por cpf", description: "Consulta informações de um cliente pelo CPF ou CNPJ" },
    ],
  });
});

// Simplificado: apenas uma conexão global
let transport: SSEServerTransport | null = null;

app.get("/sse", async (req: Request, res: Response) => {
  // Criar um novo transporte para esta conexão
  transport = new SSEServerTransport('/messages', res);
  
  res.on("close", () => {
    transport = null;
  });
  
  try {
    await server.connect(transport);
  } catch (error: any) {
    console.error("Error connecting transport:", error);
    res.status(500).send("Error connecting transport");
  }
});

app.post("/messages", async (req: Request, res: Response) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    console.error("No active transport connection");
    res.status(400).send('No active transport connection');
  }
});

app.listen(PORT);
console.log(`Server started on http://localhost:${PORT}  🚀`);
console.log(`Connect to SSE stream at http://localhost:${PORT}/sse`);
console.log(`Press Ctrl+C to stop the server`);