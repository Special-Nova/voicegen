
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Play, Trash2, History, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AudioHistoryEntry {
  id: string;
  text_content: string;
  voice_name: string;
  model_id: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<AudioHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('audio_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load audio history');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = async (filePath: string, id: string) => {
    try {
      setPlayingId(id);
      
      const { data, error } = await supabase.storage
        .from('audio-files')
        .download(filePath);

      if (error) {
        throw error;
      }

      const url = URL.createObjectURL(data);
      const audio = new Audio(url);
      
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
      };
      
      audio.onerror = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
        toast.error('Failed to play audio');
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      toast.error('Failed to play audio');
      setPlayingId(null);
    }
  };

  const downloadAudio = async (filePath: string, textContent: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('audio-files')
        .download(filePath);

      if (error) {
        throw error;
      }

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${textContent.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Audio downloaded successfully');
    } catch (error) {
      console.error('Error downloading audio:', error);
      toast.error('Failed to download audio');
    }
  };

  const deleteEntry = async (id: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('audio-files')
        .remove([filePath]);

      if (storageError) {
        console.warn('Failed to delete file from storage:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('audio_history')
        .delete()
        .eq('id', id);

      if (dbError) {
        throw dbError;
      }

      setHistory(prev => prev.filter(entry => entry.id !== id));
      toast.success('Audio entry deleted successfully');
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete audio entry');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-gray-600">Loading audio history...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <History className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Audio History</h1>
          </div>
          <p className="text-gray-600">View and manage your previously generated audio files</p>
        </header>

        {history.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Volume2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Audio History</h3>
              <p className="text-gray-500 mb-4">You haven't generated any audio files yet.</p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-black hover:bg-gray-800 text-white"
              >
                Create Your First Audio
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Generated Audio Files ({history.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Text Content</TableHead>
                      <TableHead>Voice</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={entry.text_content}>
                            {entry.text_content.length > 60 
                              ? `${entry.text_content.substring(0, 60)}...` 
                              : entry.text_content}
                          </div>
                        </TableCell>
                        <TableCell>{entry.voice_name}</TableCell>
                        <TableCell>{entry.model_id}</TableCell>
                        <TableCell>{formatFileSize(entry.file_size)}</TableCell>
                        <TableCell>{formatDate(entry.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => playAudio(entry.file_path, entry.id)}
                              disabled={playingId === entry.id}
                              title="Play audio"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadAudio(entry.file_path, entry.text_content)}
                              title="Download audio"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteEntry(entry.id, entry.file_path)}
                              title="Delete audio"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center mt-8">
          <Button 
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="px-8 py-2"
          >
            Back to Text-to-Speech
          </Button>
        </div>
      </div>
    </div>
  );
}
