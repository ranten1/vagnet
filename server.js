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
   Outbound call
   =========================== */
fastify.post('/call', async (request, reply) => {
  const { number } = request.body || {}
  if (!number) {
    return reply.code(400).send({ error: 'number is required' })
  }

  const call = await twilioClient.calls.create({
    to: number,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: 'https://vagnet-production.up.railway.app/voice',
    method: 'POST'
  })

  reply.send({ success: true, callSid: call.sid })
})

/* ===========================
   Voice → Media Stream
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
   ElevenLabs → μ-law (PoC)
   =========================== */
async function elevenLabsToMulawBase64(text) {
  const res = await fetch(
    'https://api.elevenlabs.io/v1/text-to-speech/JgAHWUAGTYZQ4STOPsRF/stream',
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2'
      })
    }
  )

  const chunks = []
  for await (const chunk of res.body) {
    chunks.push(chunk)
  }

  const audioBuffer = Buffer.concat(chunks)

  // ⚠️ PoC פשוט:
  // מניחים שהאודיו כבר 8k או קרוב – רק לצורך בדיקה
  // (בשלב הבא נעשה downsample + μ-law כמו שצריך)
  return audioBuffer.toString('base64')
}

/* ===========================
   Media Stream WS
   =========================== */
fastify.get('/stream', { websocket: true }, (connection) => {
  console.log('🎧 Twilio Media Stream connected')

  let streamSid = null
  let started = false

  connection.socket.on('message', async (msg) => {
    const data = JSON.parse(msg.toString())

    if (data.event === 'start') {
      streamSid = data.streamSid
      console.log('▶ Stream started')

      if (!started) {
        started = true

        const base64Audio = await elevenLabsToMulawBase64(
          'שלום, אני סוכן קולי חכם. איך אפשר לעזור לך?'
        )

        const mediaMsg = {
          event: 'media',
          streamSid,
          media: {
            payload: base64Audio
          }
        }

        connection.socket.send(JSON.stringify(mediaMsg))
      }
    }

    if (data.event === 'stop') {
      console.log('⏹ Stream stopped')
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
    console.log('✅ Voice Agent server running')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
