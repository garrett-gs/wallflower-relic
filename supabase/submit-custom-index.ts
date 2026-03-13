import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const {
      first_name, last_name, email, phone,
      event_type, event_date, venue, message,
    } = body

    const client_name = [first_name, last_name].filter(Boolean).join(' ')

    // Upsert customer by email
    let customer_id = null
    if (email) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .ilike('email', email.trim())
        .maybeSingle()

      if (existing) {
        customer_id = existing.id
      } else {
        const { data: newCust } = await supabase
          .from('customers')
          .insert([{
            name: client_name,
            email: email.trim(),
            phone: phone || '',
            type: 'Individual',
            status: 'active',
            notes: [],
          }])
          .select('id')
          .single()
        if (newCust) customer_id = newCust.id
      }
    }

    // Insert into custom_work
    const { error } = await supabase.from('custom_work').insert([{
      client_name,
      client_email: email || '',
      client_phone: phone || '',
      event_type: event_type || '',
      project_description: message || '',
      timeline: event_date || '',
      status: 'new',
      source: 'website',
      customer_id,
      materials: [],
    }])

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
