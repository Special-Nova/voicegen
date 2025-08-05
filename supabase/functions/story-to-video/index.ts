import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, style = 'cinematic' } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Generating story video...');

    // Step 1: Generate script and scene descriptions
    const scriptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are a video scriptwriter. Break the given story into 3-5 short scenes with visual descriptions for video generation. Each scene should be 1-2 sentences with a vivid visual description. Return as JSON array with objects containing "text" and "imagePrompt" fields.'
          },
          {
            role: 'user',
            content: `Create scenes for this story: ${text}`
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!scriptResponse.ok) {
      throw new Error('Failed to generate script');
    }

    const scriptData = await scriptResponse.json();
    const scenes = JSON.parse(scriptData.choices[0].message.content).scenes;

    console.log('Generated scenes:', scenes.length);

    // Step 2: Generate images for each scene
    const images = [];
    for (const scene of scenes) {
      const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: `${scene.imagePrompt}, ${style} style, high quality, detailed`,
          size: '1536x1024',
          quality: 'high',
          output_format: 'webp'
        })
      });

      if (!imageResponse.ok) {
        throw new Error(`Failed to generate image for scene: ${scene.text}`);
      }

      const imageData = await imageResponse.json();
      images.push({
        scene: scene.text,
        imageData: imageData.data[0].b64_json
      });
    }

    console.log('Generated images for all scenes');

    // Step 3: Generate audio narration
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const audioResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/nPczCjzI2devNBz1zQrb', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${elevenLabsApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!audioResponse.ok) {
      throw new Error('Failed to generate audio narration');
    }

    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)));

    console.log('Generated audio narration');

    // Return all components for client-side video assembly
    return new Response(
      JSON.stringify({
        success: true,
        scenes: images,
        audio: audioBase64,
        totalScenes: images.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in story-to-video function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});