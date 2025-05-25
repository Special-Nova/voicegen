
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('Generating speech for text:', text.substring(0, 50) + '...')
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
        text: text,
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
    const chunks = []
    const chunkSize = 8192
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize)
      chunks.push(String.fromCharCode.apply(null, Array.from(chunk)))
    }
    
    const base64Audio = btoa(chunks.join(''))

    console.log('Successfully generated audio, size:', audioBuffer.byteLength, 'bytes')

    return new Response(JSON.stringify({ 
      success: true,
      audioData: base64Audio,
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
