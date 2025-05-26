
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

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

    // Save audio file to Supabase storage
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`
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

    // Save history entry to database
    const { error: dbError } = await supabase
      .from('audio_history')
      .insert({
        user_id: userId,
        text_content: text,
        voice_id: voice_id,
        voice_name: voiceName,
        model_id: model_id,
        file_path: filePath,
        file_size: audioBuffer.byteLength
      })

    if (dbError) {
      console.error('Database insert error:', dbError)
      // Don't throw error here, just log it - we still want to return the audio
    }

    console.log('Successfully generated audio, size:', audioBuffer.byteLength, 'bytes')
    console.log('Saved to storage:', filePath)

    return new Response(JSON.stringify({ 
      success: true,
      audioData: base64Audio,
      contentType: 'audio/mpeg',
      filePath: filePath
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
