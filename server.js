import Fastify from 'fastify'
import cors from '@fastify/cors'
import dotenv from 'dotenv'
import twilio from 'twilio'
import formbody from '@fastify/formbody'

dotenv.config()

const fastify = Fastify({ logger: true })

// ✅ פלאגינים – חייבים להיות לפני ה-routes
fastify.register(cors, { origin: true })
fastify.register(formbody)

// ✅ Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// ✅ Health check
fastify.get('/', async () => {
  return { status: 'ok' }
})

/* ===========================
   ✅ /call – חיוג יוצא
   =========================== */

fastify.post('/call', async (request, reply) => {
  const { number } = request.body || {}

  if (!number) {
    return reply.code(400).send({ error: 'number missing' })
  }

  console.log('📞 REAL CALL →', number)

  try {
    const call = await twilioClient.calls.create({
      to: number,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: 'https://vagnet-production.up.railway.app/voice',
      method: 'POST'
    })

    console.log('✅ TWILIO SID:', call.sid)

    reply.send({
      success: true,
      callSid: call.sid
    })
  } catch (err) {
    console.error('❌ TWILIO ERROR:', err)
    reply.code(500).send({ error: err.message })
  }
})

/* ===========================
   ✅ /voice – Twilio Webhook
   =========================== */

fastify.post('/voice', async (request, reply) => {
  console.log('📞 Twilio /voice webhook received')
  console.log('Headers:', request.headers)
  console.log('Body:', request.body)

  reply
    .code(200)
    .type('text/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="he-IL">
    שלום, זו שיחת בדיקה. החיבור עובד מושלם.
  </Say>
</Response>`)
})

/* ===========================
   ✅ הפעלת השרת – תמיד בסוף
   =========================== */

fastify.listen({ port: process.env.PORT || 8080, host: '0.0.0.0' })
