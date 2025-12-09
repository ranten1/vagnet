import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import dotenv from 'dotenv'
import twilio from 'twilio'
import fs from 'fs'
import path from 'path'

dotenv.config()

const fastify = Fastify({ logger: true })

fastify.register(cors, { origin: true })
fastify.register(formbody)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

/* ===========================
   Health
   =========================== */
fastify.get('/ping', async () => ({ pong: true }))

/* ===========================
   AUDIO — GET + HEAD + RANGE
   =========================== */
fastify.route({
  method: ['GET', 'HEAD'],
  url: '/audio/:file',
  handler: async (request, reply) => {
    const filePath = path.join(
      process.cwd(),
      'public',
      'audio',
      request.params.file
    )

    if (!fs.existsSync(filePath)) {
      return reply.code(404).send()
    }

    const stat = fs.statSync(filePath)
    const fileSize = stat.size
    const range = request.headers.range

    reply.headers({
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Length': fileSize,
      'Cache-Control': 'no-store'
    })

    // HEAD request
    if (request.method === 'HEAD') {
      return reply.code(200).send()
    }

    // Range request
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

      reply.code(206)
      reply.headers({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': end - start + 1
      })

      return reply.send(
        fs.createReadStream(filePath, { start, end })
      )
    }

    // Normal GET
    return reply.send(fs.createReadStream(filePath))
  }
})

/* ===========================
   CALL (HARDCODE FILE)
   =========================== */
fastify.post('/call', async (request, reply) => {
  const { number } = request.body || {}
  if (!number) return reply.code(400).send()

  const filename = 'audio-1765262158067.mp3' // שכבר בדקת בדפדפן

  const call = await twilioClient.calls.create({
    to: number,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: `https://vagnet-production.up.railway.app/voice?file=${filename}`,
    method: 'POST'
  })

  reply.send({ ok: true, sid: call.sid })
})

/* ===========================
   VOICE
   =========================== */
fastify.post('/voice', async (request, reply) => {
  const file = request.query.file

  reply
    .type('text/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>https://vagnet-production.up.railway.app/audio/${file}</Play>
  <Pause length="5"/>
</Response>`)
})

/* ===========================
   Start
   =========================== */
fastify.listen({
  port: process.env.PORT || 8080,
  host: '0.0.0.0'
})
