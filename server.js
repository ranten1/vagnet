import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import dotenv from 'dotenv'

dotenv.config()

const fastify = Fastify({ logger: true })

fastify.register(websocket)
fastify.register(cors, { origin: true })

const PORT = process.env.PORT || 8080

// ✅ Health check
fastify.get('/', async () => {
  return { status: 'ok', message: 'Voice Agent Server is running' }
})

// ✅ Endpoint for app / agent
fastify.post('/call', async (request, reply) => {
  console.log('✅ Incoming call request:', request.body)

  return {
    success: true,
    message: 'Call request received'
  }
})

// ✅ Twilio webhook
fastify.post('/voice', async (request, reply) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="he-IL">
    שלום, זהו שרת בדיקה. החיבור עובד.
  </Say>
</Response>`

  reply.type('text/xml').send(twiml)
})

// ✅ Start server
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
