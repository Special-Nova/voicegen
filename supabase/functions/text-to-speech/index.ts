
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Split text into chunks at sentence boundaries
function splitTextIntoChunks(text: string, maxChunkSize: number = 10000): string[] {
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    // If a single sentence is longer than maxChunkSize, split it by words
    if (sentence.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      
      const words = sentence.split(' ')
      for (const word of words) {
        if ((currentChunk + ' ' + word).length > maxChunkSize) {
          if (currentChunk) {
            chunks.push(currentChunk.trim())
          }
          currentChunk = word
        } else {
          currentChunk = currentChunk ? currentChunk + ' ' + word : word
        }
      }
    } else if ((currentChunk + sentence).length > maxChunkSize) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += sentence
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { text, voice_id, model_id, voice_settings } = await req.json()

    if (!text) {
      throw new Error('Text is required')
    }

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured')
    }

    // Get authorization header for user authentication
    const authHeader = req.headers.get('Authorization')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from token if provided
    let userId = null
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    // Split text into chunks if longer than 10,000 characters
    const textChunks = splitTextIntoChunks(text, 10000)
    console.log(`Processing ${textChunks.length} chunk(s) of text`)

    const chunks = []
    
    // Process each chunk
    for (let i = 0; i < textChunks.length; i++) {
      const chunkText = textChunks[i]
      console.log(`Generating speech for chunk ${i + 1}/${textChunks.length} (${chunkText.length} chars)`)
      console.log('Using voice ID:', voice_id)
      console.log('Using model:', model_id)

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: chunkText,
          model_id: model_id,
          voice_settings: voice_settings
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('ElevenLabs API error:', response.status, errorText)
        throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`)
      }

      // Get the audio data as array buffer
      const audioBuffer = await response.arrayBuffer()
      
      // Convert array buffer to Uint8Array for safer processing
      const uint8Array = new Uint8Array(audioBuffer)
      
      // Convert to base64 using a more efficient method
      const base64Chunks = []
      const chunkSize = 8192
      
      for (let j = 0; j < uint8Array.length; j += chunkSize) {
        const chunk = uint8Array.slice(j, j + chunkSize)
        base64Chunks.push(String.fromCharCode.apply(null, Array.from(chunk)))
      }
      
      const base64Audio = btoa(base64Chunks.join(''))

      // Save audio file to Supabase storage
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-chunk-${i + 1}.mp3`
      const filePath = userId ? `${userId}/${fileName}` : `anonymous/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filePath, uint8Array, {
          contentType: 'audio/mpeg',
          cacheControl: '3600'
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw new Error(`Failed to save audio file: ${uploadError.message}`)
      }

      console.log(`Chunk ${i + 1} saved to storage:`, filePath)

      chunks.push({
        index: i,
        audioData: base64Audio,
        filePath: filePath,
        size: audioBuffer.byteLength,
        textLength: chunkText.length
      })
    }

    // Get voice name from predefined voices
    const voices = [
      { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian' },
      { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
      { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte' },
      { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
      { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
      { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
      { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda' }
    ];
    const voiceName = voices.find(v => v.id === voice_id)?.name || 'Unknown'

    // Save history entry to database for the complete text
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0)
    const { error: dbError } = await supabase
      .from('audio_history')
      .insert({
        user_id: userId,
        text_content: text,
        voice_id: voice_id,
        voice_name: voiceName,
        model_id: model_id,
        file_path: chunks[0].filePath, // Store first chunk's path as reference
        file_size: totalSize
      })

    if (dbError) {
      console.error('Database insert error:', dbError)
      // Don't throw error here, just log it - we still want to return the audio
    }

    console.log(`Successfully generated ${chunks.length} audio chunk(s), total size:`, totalSize, 'bytes')

    return new Response(JSON.stringify({ 
      success: true,
      chunks: chunks,
      totalChunks: chunks.length,
      contentType: 'audio/mpeg'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in text-to-speech function:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
