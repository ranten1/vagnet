import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import dotenv from 'dotenv'
import twilio from 'twilio'

dotenv.config()

const fastify = Fastify({ logger: true })

/* ===========================
   Plugins – חייב לפני routes
   =========================== */
fastify.register(cors, { origin: true })
fastify.register(formbody)

/* ===========================
   Twilio Client
   =========================== */
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

/* ===========================
   Health Check
   =========================== */
fastify.get('/', async () => {
  return { status: 'ok', message: 'Server is running' }
})

/* ===========================
   /call – יצירת שיחה יוצאת
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
   /voice – Twilio Webhook
   =========================== */
fastify.post('/voice', async (request, reply) => {
  console.log('📞 /voice called by Twilio')
  console.log('Twilio body:', request.body)

  reply
    .code(200)
    .header('Content-Type', 'text/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-US">
    Hello ?
  </Say>
  <Pause length="10"/>
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
    console.log('✅ Server running on port 8080')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
