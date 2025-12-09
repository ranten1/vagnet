import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import dotenv from 'dotenv'
import twilio from 'twilio'
import fastifyStatic from '@fastify/static'
import path from 'path'
import fs from 'fs'

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
   Health
   =========================== */
fastify.get('/', async () => {
  return { ok: true }
})

fastify.get('/ping', async () => {
  return { pong: true }
})

/* ===========================
   ElevenLabs – generate audio
   =========================== */
fastify.get('/generate-audio', async (request, reply) => {
  const text =
    request.query.text || 'שלום, זו בדיקת קול בעברית'

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
  const filePath = path.join('public', 'audio', filename)

  await fs.promises.writeFile(filePath, buffer)

  reply.send({
    file: filename,
    url: `https://vagnet-production.up.railway.app/public/audio/${filename}`
  })
})

/* ===========================
   Call
   =========================== */
fastify.post('/call', async (request, reply) => {
  const { number, prompt } = request.body || {}

  if (!number) {
    return reply.code(400).send({ error: 'number required' })
  }

  const text =
    prompt || 'שלום, זו שיחה אוטומטית עם קול אנושי בעברית'

  // create audio first
  const audioRes = await fetch(
    `https://vagnet-production.up.railway.app/generate-audio?text=${encodeURIComponent(
      text
    )}`
  )
  const audioData = await audioRes.json()

  const call = await twilioClient.calls.create({
    to: number,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: `https://vagnet-production.up.railway.app/voice?audio=${encodeURIComponent(
      audioData.url
    )}`,
    method: 'POST'
  })

  reply.send({ success: true, sid: call.sid })
})

/* ===========================
   Voice (Twilio)
   =========================== */
fastify.post('/voice', async (request, reply) => {
  const audioUrl = request.query.audio

  reply
    .code(200)
    .header('Content-Type', 'text/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Pause length="5"/>
</Response>`)
})

/* ===========================
   Start
   =========================== */
fastify.listen(
  { port: process.env.PORT || 8080, host: '0.0.0.0' }
)
