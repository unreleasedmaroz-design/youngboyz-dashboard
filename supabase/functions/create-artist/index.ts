import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Admin-only: create (or reset) an artist login with an email + password the admin can hand over.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { headers: { ...cors, 'Content-Type': 'application/json' }, status })

function genPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(len))
  return Array.from(bytes, (n) => chars[n % chars.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) throw new Error('Missing authorization')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: userError } = await admin.auth.getUser(auth.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Unauthorized')

    const { data: me, error: meError } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (meError || me?.role !== 'admin') throw new Error('Admin access required')

    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const artistName = String(body.artistName || '').trim()
    const password = String(body.password || '').trim() || genPassword()
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('A valid artist email is required')
    if (password.length < 8) throw new Error('Password must be at least 8 characters')

    // Does this email already have an account?
    let existingId: string | null = null
    const { data: prof } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
    if (prof?.id) existingId = prof.id
    if (!existingId) {
      for (let page = 1; page <= 20 && !existingId; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        const hit = data?.users?.find((u) => u.email?.toLowerCase() === email)
        if (hit) existingId = hit.id
        if (!data?.users?.length || data.users.length < 1000) break
      }
    }

    let userId: string
    let created = false
    if (existingId) {
      const { error } = await admin.auth.admin.updateUserById(existingId, { password, email_confirm: true })
      if (error) throw error
      userId = existingId
    } else {
      if (!artistName) throw new Error('Artist name is required for a new account')
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { artist_name: artistName, role: 'artist' },
      })
      if (error) throw error
      userId = data.user.id
      created = true
    }

    // Never downgrade an existing admin; only set the name if one was given.
    const { data: cur } = await admin.from('profiles').select('role,artist_name').eq('id', userId).maybeSingle()
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      email,
      artist_name: artistName || cur?.artist_name || email.split('@')[0],
      role: cur?.role || 'artist',
    })
    if (profileError) throw profileError

    return json({ ok: true, created, userId, email, password })
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message || 'Request failed' }, 400)
  }
})
