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
   Health Check
   =========================== */
fastify.get('/', async () => {
  return { status: 'ok', message: 'Server running' }
})

/* ===========================
   /call – יוצר אודיו ואז מחייג
   =========================== */
fastify.post('/call', async (request, reply) => {
  const { number, prompt } = request.body || {}

  if (!number) {
    return reply.code(400).send({ error: 'number is required' })
  }

  const text =
    prompt ||
    'שלום, זו שיחה אוטומטית עם קול אנושי בעברית. תודה שהקדשת לנו זמן.'

  try {
    /* --- 1. Generate audio with ElevenLabs --- */
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

    if (!response.ok) {
      throw new Error('ElevenLabs audio generation failed')
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const filename = `audio-${Date.now()}.mp3`
    const filePath = path.join(
      process.cwd(),
      'public',
      'audio',
      filename
    )

    await fs.promises.writeFile(filePath, buffer)

    const audioUrl =
      `https://vagnet-production.up.railway.app/public/audio/${filename}`

    /* --- 2. Create Twilio Call --- */
    const call = await twilioClient.calls.create({
      to: number,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `https://vagnet-production.up.railway.app/voice?audio=${encodeURIComponent(
        audioUrl
      )}`,
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
   מנגן MP3 קיים בלבד
   =========================== */
fastify.post('/voice', async (request, reply) => {
  const audioUrl =
    request.query.audio ||
    request.body?.audio ||
    null

  if (!audioUrl) {
    return reply
      .code(200)
      .header('Content-Type', 'text/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-US">
    Audio file not found.
  </Say>
</Response>`)
  }

  reply
    .code(200)
    .header('Content-Type', 'text/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Pause length="3"/>
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
