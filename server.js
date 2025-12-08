import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import twilio from 'twilio'
import dotenv from 'dotenv'

dotenv.config()

const fastify = Fastify({ logger: true })
fastify.register(websocket)

const PORT = process.env.PORT || 8080

// Health check
fastify.get('/', async () => {
  return { status: 'ok', message: 'Voice Agent Server is running' }
})

// Twilio Voice Webhook
fastify.post('/voice', async (request, reply) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="he-IL" voice="Polly.Carmit">
    שלום, זהו סרבר בדיקה. החיבור ל-Twilio עובד בהצלחה.
  </Say>
  <Pause length="1"/>
  <Say language="he-IL">
    ניתן כעת להוסיף לוגיקת סוכן קולי.
  </Say>
</Response>`

  reply
    .type('text/xml')
    .send(twiml)
})

// WebSocket endpoint (להרחבה עתידית – Media Streams)
fastify.get('/media', { websocket: true }, (connection) => {
  console.log('WebSocket connected')

  connection.socket.on('message', (message) => {
    console.log('Received WS message:', message.toString())
  })
})

// Start server
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
