import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { broadcastEvent } from '@/lib/sse/emitter';
import { GeocodingAdapter } from '@/lib/adapters/geocoding';

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Simulate parsing a common CRM payload format (e.g. Follow Up Boss / Zillow)
    const firstName = body.firstName || body.person?.firstName || 'Unknown';
    const lastName = body.lastName || body.person?.lastName || 'Lead';
    const email = body.emails?.[0]?.value || body.person?.emails?.[0]?.value || null;
    const phone = body.phones?.[0]?.value || body.person?.phones?.[0]?.value || null;

    // Attempt to parse intent from tags or source
    const rawTags = (body.tags || []).join(' ').toLowerCase();
    const source = (body.source || '').toLowerCase();

    let leadType = 'Buyer'; // Default
    if (rawTags.includes('seller') || source.includes('home value') || source.includes('listing')) {
      leadType = 'Seller';
    }

    let targetWorkflow = null;
    if (leadType === 'Buyer') {
      targetWorkflow = await prisma.followUpWorkflow.findFirst({ where: { name: 'Buyer 10-Day Blitz' } });
    } else if (leadType === 'Seller') {
      targetWorkflow = await prisma.followUpWorkflow.findFirst({ where: { name: 'Seller 14-Day Follow-Up' } });
    }

    // Default to the first user in the system (the admin) to prevent orphaned leads
    const defaultUser = await prisma.user.findFirst();

    // Geocode if address is provided
    let lat: number | null = null;
    let lon: number | null = null;
    if (body.addresses?.[0]) {
      const addr = body.addresses[0];
      const coords = await GeocodingAdapter.geocode(addr.street, addr.city, addr.state, addr.zip);
      if (coords) {
         lat = coords.latitude;
         lon = coords.longitude;
      }
    }

    const lead = await prisma.lead.create({
      data: {
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        property_address: body.addresses?.[0]?.street,
        city: body.addresses?.[0]?.city,
        state: body.addresses?.[0]?.state,
        zip: body.addresses?.[0]?.zip,
        latitude: lat,
        longitude: lon,
        lead_type: leadType,
        lead_source: body.source || 'CRM Webhook',
        status: 'New',
        userId: defaultUser?.id,
        activeWorkflowId: targetWorkflow ? targetWorkflow.id : undefined,
        currentWorkflowDay: targetWorkflow ? 0 : undefined,
        next_follow_up_at: targetWorkflow ? new Date() : undefined,
      },
    });

    // Broadcast to SSE map clients
    broadcastEvent('new_lead', lead);

    if (targetWorkflow) {
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: 'Workflow Started',
          description: `Assigned to ${targetWorkflow.name} via Webhook`
        }
      });
    }

    if (defaultUser?.id) {
      await prisma.notification.create({
        data: {
          userId: defaultUser.id,
          title: 'New Lead Ingested',
          message: `${firstName} ${lastName} was received via CRM Webhook.`,
          linkUrl: `/leads/${lead.id}`
        }
      });
    }

    return NextResponse.json({ success: true, leadId: lead.id, message: 'Lead received and processed.' }, { status: 201 });
  } catch (error) {
    console.error('CRM Webhook Error:', error);
    return NextResponse.json({ error: 'Failed to process CRM webhook payload' }, { status: 500 });
  }
}
