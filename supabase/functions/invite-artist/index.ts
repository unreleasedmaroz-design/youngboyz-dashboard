import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) throw new Error('Missing authorization')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)
    const token = auth.replace('Bearer ', '')
    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    const { data: me, error: meError } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (meError || me?.role !== 'admin') throw new Error('Admin access required')

    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const artistName = String(body.artistName || '').trim()
    if (!email || !artistName) throw new Error('Artist name and email are required')

    const siteUrl = (Deno.env.get('SITE_URL') || supabaseUrl).replace(/\/$/, '')
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { artist_name: artistName, role: 'artist' },
      redirectTo: `${siteUrl}/set-password`,
    })
    if (inviteError) throw inviteError

    const { error: profileError } = await admin.from('profiles').upsert({
      id: invited.user.id,
      artist_name: artistName,
      email,
      role: 'artist',
    })
    if (profileError) throw profileError

    return new Response(JSON.stringify({ ok: true, userId: invited.user.id, message: 'Invitation sent.' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Invite failed' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
