import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import dotenv from 'dotenv'
import twilio from 'twilio'
import fastifyStatic from '@fastify/static'
import path from 'path'

dotenv.config()

const fastify = Fastify({ logger: true })

/* ===========================
   Plugins
   =========================== */
fastify.register(cors, { origin: true })
fastify.register(formbody)

fastify.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public'),
  prefix: '/public/'
})

/* ===========================
   Twilio Client
   =========================== */
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

/* ===========================
   Health + Ping
   =========================== */
fastify.get('/', async () => ({ ok: true }))
fastify.get('/ping', async () => ({ pong: true }))

/* ===========================
   CALL – initiate call
   =========================== */
fastify.post('/call', async (request, reply) => {
  const { number } = request.body || {}

  if (!number) {
    return reply.code(400).send({ error: 'number is required' })
  }

  try {
    const call = await twilioClient.calls.create({
      to: number,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: 'https://vagnet-production.up.railway.app/voice',
      method: 'POST'
    })

    reply.send({
      success: true,
      callSid: call.sid
    })
  } catch (err) {
    fastify.log.error(err)
    reply.code(500).send({ error: err.message })
  }
})

/* ===========================
   VOICE – HARDCODED PLAY
   =========================== */
fastify.post('/voice', async (request, reply) => {
  reply
    .code(200)
    .header('Content-Type', 'text/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Play>https://vagnet-production.up.railway.app/public/audio/audio-1765262158067.mp3</Play>
<Pause length="5"/>
</Response>`)
})

/* ===========================
   Start Server
   =========================== */
const start = async () => {
  try {
    await fastify.listen({
      port: process.env.PORT || 8080,
      host: '0.0.0.0'
    })
    console.log('✅ Server running on port 8080 (HARDCODE TEST)')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
