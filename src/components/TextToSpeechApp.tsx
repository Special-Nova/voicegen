
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Download, Loader2, Volume2, History, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const VOICES = [
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte' },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda' },
  // Hindi voices
  { id: 'pMsXgVXv3BLzUgSXRplE', name: 'Premiumhindi' },
  { id: 'JhdmE8AMBaGSnvtQQQgp', name: 'Hindivoice' },
  { id: 'custom', name: 'Custom Voice ID' }
];

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
  { code: 'da', name: 'Danish', flag: '🇩🇰' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮' }
];

const MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2' }
];

export default function TextToSpeechApp() {
  const [text, setText] = useState('In the ancient land of Eldoria, where the skies were painted with shades of mystic hues and the forests whispered secrets of old, there existed a dragon named Zephyros. Unlike the fearsome tales of dragons that plagued human hearts with terror, Zephyros was a creature of wonder and wisdom, revered by all who knew of his existence.');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [translateToLanguage, setTranslateToLanguage] = useState('');
  const [enableTranslation, setEnableTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [selectedModel, setSelectedModel] = useState('eleven_multilingual_v2');
  const [speed, setSpeed] = useState([1.0]);
  const [stability, setStability] = useState([0.5]);
  const [clarity, setClarity] = useState([0.75]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const translateText = async () => {
    if (!text.trim()) {
      toast.error('Please enter some text to translate');
      return;
    }

    if (!translateToLanguage) {
      toast.error('Please select a target language for translation');
      return;
    }

    setIsTranslating(true);

    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text: text,
          targetLanguage: translateToLanguage,
          sourceLanguage: 'auto'
        }
      });

      if (error) {
        console.error('Translation error:', error);
        throw new Error(`Failed to translate text: ${error.message}`);
      }

      if (!data || !data.translatedText) {
        throw new Error('No translation data received');
      }

      setTranslatedText(data.translatedText);
      toast.success('Text translated successfully!');
    } catch (error) {
      console.error('Error translating text:', error);
      toast.error(`Failed to translate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const generateSpeech = async () => {
    const textToUse = enableTranslation && translatedText ? translatedText : text;
    
    if (!textToUse.trim()) {
      toast.error('Please enter some text to convert');
      return;
    }

    // Use custom voice ID if selected, otherwise use the selected voice
    const voiceToUse = selectedVoice === 'custom' ? customVoiceId : selectedVoice;
    
    if (selectedVoice === 'custom' && !customVoiceId.trim()) {
      toast.error('Please enter a custom voice ID');
      return;
    }

    setIsGenerating(true);
    
    try {
      console.log('Calling text-to-speech function...');
      
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: textToUse,
          voice_id: voiceToUse,
          model_id: selectedModel,
          voice_settings: {
            stability: stability[0],
            similarity_boost: clarity[0],
            style: 0.0,
            use_speaker_boost: true
          }
        },
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : {}
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to generate speech');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate speech');
      }

      // Convert base64 audio back to blob
      const audioBytes = atob(data.audioData);
      const audioArray = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i);
      }
      
      const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      console.log('Audio generated successfully!');
      toast.success('Audio generated and saved to history!');
    } catch (error) {
      console.error('Error generating speech:', error);
      toast.error(`Failed to generate speech: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = 'generated-speech.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Volume2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">ElevenLabs</h1>
          </div>
          <div className="text-sm text-gray-600 uppercase tracking-wider mb-2">TEXT TO SPEECH</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Text to Speech with high quality, human-like AI voice generator
          </h2>
          
          {/* Navigation */}
          <div className="mb-6">
            <Button
              onClick={() => window.location.href = '/history'}
              variant="outline"
              className="gap-2"
            >
              <History className="h-4 w-4" />
              View History
            </Button>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Text Input */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardContent className="p-6">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter your text here..."
                  className="min-h-[400px] text-base leading-relaxed resize-none border-0 focus-visible:ring-0 p-0"
                />
              </CardContent>
            </Card>
          </div>

          {/* Voice Settings Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600 uppercase tracking-wider">
                  Voice Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Voice Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Voice</label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICES.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Voice ID Input */}
                {selectedVoice === 'custom' && (
                  <div>
                    <Label htmlFor="custom-voice-id" className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Voice ID
                    </Label>
                    <Input
                      id="custom-voice-id"
                      value={customVoiceId}
                      onChange={(e) => setCustomVoiceId(e.target.value)}
                      placeholder="Enter your custom voice ID"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter your ElevenLabs voice ID (e.g., from voice cloning)
                    </p>
                  </div>
                )}

                {/* Translation Section */}
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Languages className="h-5 w-5 text-blue-600" />
                    <Label className="text-sm font-medium text-blue-800">Translation</Label>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="enable-translation"
                        checked={enableTranslation}
                        onChange={(e) => setEnableTranslation(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="enable-translation" className="text-sm">
                        Enable translation before speech generation
                      </Label>
                    </div>

                    {enableTranslation && (
                      <>
                        <div>
                          <Label className="block text-sm font-medium mb-1">
                            Translate to:
                          </Label>
                          <Select value={translateToLanguage} onValueChange={setTranslateToLanguage}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select target language" />
                            </SelectTrigger>
                            <SelectContent>
                              {LANGUAGES.map((lang) => (
                                <SelectItem key={lang.code} value={lang.code}>
                                  {lang.flag} {lang.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          onClick={translateText}
                          disabled={isTranslating || !translateToLanguage}
                          className="w-full"
                          variant="outline"
                        >
                          {isTranslating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Translating...
                            </>
                          ) : (
                            <>
                              <Languages className="mr-2 h-4 w-4" />
                              Translate Text
                            </>
                          )}
                        </Button>

                        {translatedText && (
                          <div className="p-3 bg-white rounded border">
                            <Label className="text-xs text-gray-600 mb-1 block">Translated text:</Label>
                            <p className="text-sm">{translatedText}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>

                {/* Language Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Voice Language Model</label>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          <span className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            {lang.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stability Slider */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stability: {stability[0].toFixed(2)}
                  </label>
                  <Slider
                    value={stability}
                    onValueChange={setStability}
                    max={1}
                    min={0}
                    step={0.01}
                    className="w-full"
                  />
                </div>

                {/* Clarity Slider */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clarity: {clarity[0].toFixed(2)}
                  </label>
                  <Slider
                    value={clarity}
                    onValueChange={setClarity}
                    max={1}
                    min={0}
                    step={0.01}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={generateSpeech}
                disabled={isGenerating || !text.trim()}
                className="w-full bg-black hover:bg-gray-800 text-white py-3"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Speech'
                )}
              </Button>

              {audioUrl && (
                <div className="flex gap-2">
                  <Button
                    onClick={playAudio}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Play
                  </Button>
                  <Button
                    onClick={downloadAudio}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hidden Audio Element */}
        {audioUrl && (
          <audio ref={audioRef} src={audioUrl} controls className="hidden" />
        )}

        {/* Footer */}
        <footer className="text-center mt-12 py-8 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-4">
            EXPERIENCE THE FULL AUDIO AI PLATFORM
          </div>
          <Button className="bg-black hover:bg-gray-800 text-white px-8 py-2">
            Try for Free
          </Button>
        </footer>
      </div>
    </div>
  );
}
