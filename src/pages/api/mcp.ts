import type { NextApiRequest, NextApiResponse } from 'next';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { PrismaClient } from "@prisma/client";
import { getVoiceProvider } from "../../lib/adapters";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();

// One MCP Server per SSE connection: a Server can only be connected to a
// single transport ("Already connected to a transport" on the second GET),
// so the previous module-level singleton 500'd every reconnect. Handlers are
// registered inside this factory so each connection gets a fresh instance.
function createMcpServer(): Server {
  const server = new Server(
    {
      name: "jules-mls-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  registerHandlers(server);
  return server;
}

function registerHandlers(server: Server) {
// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_mls_inventory",
        description: "Query the LeadCaller CRM Lead database for leads matching a neighborhood (city) or zipcode. (Named for MLS-inventory intent; live MLS data requires the RESO feed, not yet connected - results are CRM leads, never fabricated listings.)",
        inputSchema: {
          type: "object",
          properties: {
            neighborhood: { type: "string", description: "The neighborhood name (e.g., 'Downtown')" },
            zipcode: { type: "string", description: "The 5-digit zipcode" },
          }
        },
      },
      {
        name: "list_callable_leads",
        description: "List CRM leads that can be called right now: has a phone number and status is not 'Do Not Contact'. Read-only; makes no calls.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max leads to return (default 10, max 50)" },
          }
        },
      },
      {
        name: "start_outbound_call",
        description: "Start an outbound AI voice call to one lead via Vapi. WRITE ACTION with an approval gate: you must pass confirm: true (the human operator approved this call). Refuses when the lead is Do Not Contact, has no phone, or Vapi is not configured - it never places a simulated/mock call.",
        inputSchema: {
          type: "object",
          properties: {
            leadId: { type: "string", description: "The CRM lead ID to call" },
            confirm: { type: "boolean", description: "Must be true - explicit human approval to place this call" },
          },
          required: ["leadId", "confirm"]
        },
      },
      {
        name: "get_lead_call_history",
        description: "Read a lead's call history (outcomes and durations) from the CRM CallLog. Read-only.",
        inputSchema: {
          type: "object",
          properties: {
            leadId: { type: "string", description: "The CRM lead ID" },
          },
          required: ["leadId"]
        },
      },
      {
        name: "check_agent_availability",
        description: "Query the human real estate agent's calendar to check for available time slots before attempting to set a showing or appointment.",
        inputSchema: {
          type: "object",
          properties: {
            date: { type: "string", description: "The requested date in YYYY-MM-DD format (e.g., '2026-05-25')" },
            userId: { type: "string", description: "The internal ID of the agent whose calendar we are querying." }
          }
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query_mls_inventory") {
    // Real query against the LeadCaller CRM Lead table (this app has no MLS
    // listing table; the previous implementation returned hardcoded fake
    // listings for Downtown/Macomb/anywhere, which violated the project's
    // no-fabricated-data rule). Matches leads by zip or city ("neighborhood").
    // Honest empty result when nothing matches - never invented listings.
    const neighborhood = request.params.arguments?.neighborhood as string | undefined;
    const zipcode = request.params.arguments?.zipcode as string | undefined;

    try {
      const leads = await prisma.lead.findMany({
        where: {
          AND: [
            zipcode ? { zip: zipcode } : {},
            neighborhood ? { city: { contains: neighborhood } } : {},
          ],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          first_name: true, last_name: true, property_address: true,
          city: true, state: true, zip: true, budget: true, status: true, lead_type: true,
        },
      });

      if (leads.length === 0) {
        return {
          content: [{ type: "text", text: `No leads in the CRM match ${[neighborhood, zipcode].filter(Boolean).join(' / ') || 'that criteria'}. (This tool queries the LeadCaller CRM Lead database; live MLS inventory requires the RESO feed, which is not connected yet.)` }],
        };
      }

      const lines = leads.map((l, i) =>
        `${i + 1}: ${l.property_address || `${l.first_name} ${l.last_name}`} (${l.city || '?'}, ${l.state || '?'} ${l.zip || ''}) - ${l.lead_type}, status ${l.status}${l.budget ? `, budget ${l.budget}` : ''}`
      );
      return {
        content: [{ type: "text", text: `Found ${leads.length} CRM lead(s) matching ${[neighborhood, zipcode].filter(Boolean).join(' / ')}:\n${lines.join('\n')}\n(Source: LeadCaller CRM Lead database - not live MLS inventory.)` }],
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: "Error querying the CRM lead database." }],
      };
    }
  }

  if (request.params.name === "check_agent_availability") {
    const date = request.params.arguments?.date as string || "today";
    const userId = request.params.arguments?.userId as string;

    if (!userId) {
        return {
            content: [{ type: "text", text: "Error: Missing agent userId required to check calendar." }]
        };
    }

    try {
        const settings = await prisma.integrationSettings.findFirst({
            where: { provider: 'google_calendar_token', userId }
        });

        const token = settings?.apiKey;

        if (!token) {
            // No calendar connected: report that honestly instead of
            // fabricating open slots (previous mock fallback invented times).
            return {
                content: [{ type: "text", text: `Calendar is not connected for this agent (no Google Calendar integration), so availability for ${date} cannot be checked yet. Connect Google Calendar in Settings > Integrations to enable live availability.` }]
            };
        }

        // Parse date for start/end of day constraints
        const targetDate = new Date(date === "today" ? Date.now() : date);
        const timeMin = new Date(targetDate.setHours(8, 0, 0, 0)).toISOString(); // 8 AM
        const timeMax = new Date(targetDate.setHours(18, 0, 0, 0)).toISOString(); // 6 PM

        // Real Google API Free/Busy Query
        const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              timeMin,
              timeMax,
              items: [{ id: 'primary' }]
            }),
        });

        if (!response.ok) {
             return {
                content: [{ type: "text", text: `Error: Unable to access calendar at this time. (API returned ${response.status})` }]
            };
        }

        const data = await response.json();
        const busySlots = data.calendars?.primary?.busy || [];

        if (busySlots.length === 0) {
             return {
                content: [{ type: "text", text: `The agent is completely free on ${date} between 8 AM and 6 PM.` }]
            };
        }

        const busyText = busySlots.map((slot: any) => `- ${new Date(slot.start).toLocaleTimeString()} to ${new Date(slot.end).toLocaleTimeString()}`).join("\n");

        return {
            content: [
                {
                    type: "text",
                    text: `On ${date}, the agent is currently busy during these times:\n${busyText}\n\nYou may offer any other time slot between 8 AM and 6 PM.`
                }
            ]
        };

    } catch (e) {
        return {
            content: [{ type: "text", text: `Error checking calendar.` }]
        };
    }
  }

  if (request.params.name === "list_callable_leads") {
    const limit = Math.min((request.params.arguments?.limit as number) || 10, 50);
    const leads = await prisma.lead.findMany({
      where: { phone: { not: null }, status: { not: 'Do Not Contact' } },
      take: limit,
      orderBy: [{ urgency_score: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, first_name: true, last_name: true, phone: true, city: true, state: true, status: true, lead_type: true },
    });
    if (leads.length === 0) {
      return { content: [{ type: "text", text: "No callable leads right now (every lead either has no phone or is Do Not Contact)." }] };
    }
    const lines = leads.map((l, i) => `${i + 1}: [${l.id}] ${l.first_name} ${l.last_name} - ${l.phone} (${l.city || '?'}, ${l.state || '?'}) - ${l.lead_type}, status ${l.status}`);
    return { content: [{ type: "text", text: `${leads.length} callable lead(s):\n${lines.join('\n')}` }] };
  }

  if (request.params.name === "get_lead_call_history") {
    const leadId = request.params.arguments?.leadId as string;
    const logs = await prisma.callLog.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    if (logs.length === 0) {
      return { content: [{ type: "text", text: `No calls logged for lead ${leadId} yet.` }] };
    }
    const lines = logs.map((c) => `- ${c.createdAt.toISOString()} outcome=${c.outcome || 'unknown'} duration=${c.duration ?? '?'}s`);
    return { content: [{ type: "text", text: `${logs.length} call(s) for lead ${leadId}:\n${lines.join('\n')}` }] };
  }

  if (request.params.name === "start_outbound_call") {
    const leadId = request.params.arguments?.leadId as string;
    const confirm = request.params.arguments?.confirm as boolean | undefined;

    // Approval gate: an AI may never place a call on its own initiative.
    if (confirm !== true) {
      return {
        content: [{ type: "text", text: "Approval required: outbound calls place a real phone call to a real person. Ask the human operator to approve, then call again with confirm: true. No call was placed." }],
      };
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return { content: [{ type: "text", text: `Lead ${leadId} not found. No call placed.` }] };
    }
    if (lead.status === 'Do Not Contact') {
      return { content: [{ type: "text", text: `Lead ${leadId} is marked Do Not Contact. Refusing to call.` }] };
    }
    if (!lead.phone) {
      return { content: [{ type: "text", text: `Lead ${leadId} has no phone number. No call placed.` }] };
    }

    // Telephony must be genuinely configured - never fall back to a mock
    // call and report success (the workflow provider does that; MCP must not).
    const settings = await prisma.integrationSettings.findMany({
      where: { provider: { in: ['vapi', 'vapi_assistant_id', 'vapi_phone_number_id'] }, userId: lead.userId || undefined },
    });
    const have = (p: string) => settings.some((s) => s.provider === p && !!s.apiKey);
    if (!have('vapi') || !have('vapi_assistant_id') || !have('vapi_phone_number_id')) {
      return {
        content: [{ type: "text", text: "Voice calling is not configured for this workspace yet: Vapi API key, assistant ID, and phone number ID are required (Settings in LeadCaller). No call was placed and no simulated call was made." }],
      };
    }

    const placed = await getVoiceProvider().callLead(leadId);
    if (!placed) {
      return { content: [{ type: "text", text: `Call to lead ${leadId} could not be initiated (provider returned failure). No call is in progress.` }] };
    }
    await prisma.leadActivity.create({
      data: { leadId, type: 'call', description: 'Outbound AI voice call initiated via MCP (operator-approved)' },
    });
    return {
      content: [{ type: "text", text: `Outbound call initiated to ${lead.first_name} ${lead.last_name} (${lead.phone}). The call outcome will arrive via the Vapi webhook and land in the lead's call history (get_lead_call_history).` }],
    };
  }

  throw new Error("Tool not found");
});
}

// Store global transport instances (in memory - ephemeral for dev)
let globalTransport: SSEServerTransport | null = null;

/**
 * MCP requires authentication: a NextAuth session cookie (browser /
 * same-origin clients) OR `Authorization: Bearer <LC_MCP_TOKEN>` for
 * external AI clients. This endpoint was previously wide open - lead
 * names and phone numbers were readable by anyone who connected.
 */
async function requireMcpAuth(req: NextApiRequest): Promise<boolean> {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (process.env.LC_MCP_TOKEN && bearer && bearer === process.env.LC_MCP_TOKEN) return true;
  const token = await getToken({
    req: req as never,
    secret: process.env.NEXTAUTH_SECRET || 'default_dev_secret_change_me_in_prod',
  });
  return !!token;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireMcpAuth(req))) {
    res.status(401).json({ error: 'Unauthorized - MCP requires a LeadCaller session or LC_MCP_TOKEN bearer' });
    return;
  }

  if (req.method === 'GET') {
    // Fresh server per connection (see createMcpServer note). Message
    // endpoint must carry the production mount prefix when present:
    // NEXTAUTH_URL is https://<domain>/leadcaller in prod, unset locally.
    let messageEndpoint = "/api/mcp";
    try {
      const base = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).pathname.replace(/\/$/, "") : "";
      if (base) messageEndpoint = `${base}/api/mcp`;
    } catch { /* keep default */ }
    globalTransport = new SSEServerTransport(messageEndpoint, res as any);
    await createMcpServer().connect(globalTransport);

    // SSEServerTransport will take over the response and keep it open
    return;
  } else if (req.method === 'POST') {
    if (!globalTransport) {
      res.status(400).json({ error: "SSE connection not established" });
      return;
    }

    try {
      // Pages API already parses the body
      await globalTransport.handlePostMessage(req as any, res as any, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process message" });
      }
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
