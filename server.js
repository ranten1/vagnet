import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import dotenv from 'dotenv'
import twilio from 'twilio'
import fastifyStatic from '@fastify/static'
import path from 'path'
import fs from 'fs'
import fetch from 'node-fetch'

dotenv.config()

const fastify = Fastify({ logger: true })

/* ===========================
   GLOBAL STATE (Stage 1)
   =========================== */
let lastAudioFile = null

/* ===========================
   Plugins – חייב לפני routes
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
   Health Check
   =========================== */
fastify.get('/', async () => {
  return { status: 'ok', message: 'Server is running (Stage 1)' }
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
   /generate-audio – ElevenLabs
   יוצר MP3 ושומר אותו
   =========================== */
fastify.get('/generate-audio', async (request, reply) => {
  const text =
    request.query.text ||
    'שלום, זו שיחה אוטומטית בקול אנושי בעברית'

  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/JgAHWUAGTYZQ4STOPsRF',
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

    const buffer = Buffer.from(await response.arrayBuffer())
    const filename = `audio-${Date.now()}.mp3`
    const filePath = path.join(
      process.cwd(),
      'public',
      'audio',
      filename
    )

    await fs.promises.writeFile(filePath, buffer)

    // ✅ שמירת שם הקובץ האחרון
    lastAudioFile = filename

    reply.send({
      url: `https://vagnet-production.up.railway.app/public/audio/${filename}`
    })
  } catch (err) {
    fastify.log.error(err)
    reply.code(500).send({ error: 'Audio generation failed' })
  }
})

/* ===========================
   /voice – Twilio Webhook
   מנגן MP3 סטטי בלבד
   =========================== */
fastify.post('/voice', async (request, reply) => {
  // אם מסיבה כלשהי האודיו לא מוכן – fallback
  if (!lastAudioFile) {
    return reply
      .code(200)
      .header('Content-Type', 'text/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-US">
    Audio is not ready yet. Please try again later.
  </Say>
</Response>`)
  }

  reply
    .code(200)
    .header('Content-Type', 'text/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>
    https://vagnet-production.up.railway.app/public/audio/${lastAudioFile}
  </Play>
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
    console.log('✅ Server running on port 8080 (Stage 1)')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
