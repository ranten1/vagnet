import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import dotenv from 'dotenv'

// 🔥 הוכחה חד-משמעית שזה הקובץ שרץ
console.log('🔥 ACTUAL SERVER.JS LOADED – /CALL SHOULD EXIST 🔥')

dotenv.config()

const fastify = Fastify({ logger: true })

// Plugins
fastify.register(websocket)
fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
})

const PORT = process.env.PORT || 8080

// ✅ Health check
fastify.get('/', async () => {
  return {
    status: 'ok',
    message: 'Voice Agent Server is running'
  }
})

// ✅ /call – בדיקה קשיחה
fastify.post('/call', async (request, reply) => {
  console.log('🔥 /CALL HIT CONFIRMED 🔥')
  console.log('Body:', request.body)

  reply.send({
    ok: true,
    message: 'Call endpoint is working'
  })
})

// ✅ Twilio Voice Webhook (בדיקה)
fastify.post('/voice', async (request, reply) => {
  console.log('📞 Incoming Twilio Voice Webhook')

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="he-IL">
    שלום. זהו שרת בדיקה. החיבור תקין.
  </Say>
</Response>`

  reply.type('text/xml').send(twiml)
})

// ✅ Start server (חייב להיות בסוף)
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`✅ Server running on port ${PORT}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
