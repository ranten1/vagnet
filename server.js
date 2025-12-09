import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import formbody from '@fastify/formbody'
import cors from '@fastify/cors'
import dotenv from 'dotenv'
import twilio from 'twilio'

dotenv.config()

const fastify = Fastify({ logger: true })

/* ===========================
   Plugins
   =========================== */
fastify.register(cors, { origin: true })
fastify.register(formbody)
fastify.register(websocket)

/* ===========================
   Twilio client
   =========================== */
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

/* ===========================
   Health
   =========================== */
fastify.get('/ping', async () => ({ pong: true }))

/* ===========================
   Outbound Call
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

    reply.send({ success: true, callSid: call.sid })
  } catch (err) {
    fastify.log.error(err)
    reply.code(500).send({ error: err.message })
  }
})

/* ===========================
   Twilio Voice Webhook
   =========================== */
fastify.post('/voice', async (request, reply) => {
  reply
    .type('text/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://vagnet-production.up.railway.app/stream" />
  </Connect>
</Response>`)
})

/* ===========================
   ✅ Media Stream (μ-law BEEP)
   =========================== */
fastify.get('/stream', { websocket: true }, (connection) => {
  console.log('🎧 Twilio Media Stream connected')

  connection.socket.on('message', (message) => {
    const data = JSON.parse(message.toString())

    if (data.event === 'start') {
      console.log('▶ Stream START')

      // ✅ μ-law 8kHz beep – בוודאות נשמע
      const payload =
        'f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39='

      connection.socket.send(
        JSON.stringify({
          event: 'media',
          streamSid: data.streamSid,
          media: {
            payload
          }
        })
      )
    }

    if (data.event === 'stop') {
      console.log('⏹ Stream STOP')
    }
  })

  connection.socket.on('close', () => {
    console.log('🔌 Stream disconnected')
  })
})

/* ===========================
   Start server
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
