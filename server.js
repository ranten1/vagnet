import Fastify from 'fastify'
import cors from '@fastify/cors'
import dotenv from 'dotenv'
import twilio from 'twilio'

dotenv.config()

const fastify = Fastify({ logger: true })

fastify.register(cors, { origin: true })

const PORT = process.env.PORT || 8080

// ✅ Twilio client (חייב להיות לפני ה-endpoints)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// ✅ Health check
fastify.get('/', async () => {
  return { status: 'ok' }
})

// 🚨⬇⬇⬇ כאן בדיוק שמים את הקוד ⬇⬇⬇🚨
fastify.post('/call', async (request, reply) => {
  const { number, prompt } = request.body || {}

  if (!number) {
    return reply.code(400).send({
      success: false,
      error: 'number is required'
    })
  }

  console.log('📞 Initiating real Twilio call to:', number)
  console.log('🧠 Mission:', prompt)

  try {
    const call = await twilioClient.calls.create({
      to: number,
      from: process.env.TWILIO_PHONE_NUMBER,
      applicationSid: process.env.TWILIO_TWIML_APP_SID
    })

    console.log('✅ Twilio call created:', call.sid)

    reply.send({
      success: true,
      callSid: call.sid
    })
  } catch (err) {
    console.error('❌ Twilio call failed:', err)
    reply.code(500).send({
      success: false,
      error: err.message
    })
  }
})
// 🚨⬆⬆⬆ עד כאן הקוד ⬆⬆⬆🚨

// ✅ Optional: Twilio Voice webhook
fastify.post('/voice', async (request, reply) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="he-IL">
    שלום, זו שיחת בדיקה.
  </Say>
</Response>`
  reply.type('text/xml').send(twiml)
})

// ✅ Start server – חייב להיות בסוף
fastify.listen({ port: PORT, host: '0.0.0.0' })
