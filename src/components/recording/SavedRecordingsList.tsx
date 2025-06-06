import { useState } from 'react';
import { SavedRecording } from '@/lib/store/recording-store';
import { AudioPlayer } from './AudioPlayer';
import { Button } from '@/components/ui/button';
import { Clock, Calendar } from 'lucide-react';

interface SavedRecordingsListProps {
  recordings: SavedRecording[];
  onPlay: (recordingId: string) => void;
  onStop: () => void;
}

export function SavedRecordingsList({ 
  recordings, 
  onPlay, 
  onStop 
}: SavedRecordingsListProps) {
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);

  const handlePlay = (recordingId: string) => {
    setActiveRecordingId(recordingId);
    onPlay(recordingId);
  };

  const handlePlaybackEnd = () => {
    setActiveRecordingId(null);
    onStop();
  };

  if (recordings.length === 0) {
    return (
      <div className="text-center p-6 border rounded-lg bg-gray-50">
        <p className="text-gray-500">No saved recordings yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Saved Recordings</h3>
      
      {recordings.map((recording) => (
        <div 
          key={recording.id} 
          className="border rounded-lg p-4 bg-white"
        >
          {activeRecordingId === recording.id ? (
            <AudioPlayer 
              recording={recording} 
              onPlaybackEnd={handlePlaybackEnd} 
            />
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{recording.title}</div>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(recording.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{Math.floor(recording.duration / 60)}:{(recording.duration % 60).toString().padStart(2, '0')}</span>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={() => handlePlay(recording.id)}
                size="sm"
                variant="outline"
              >
                Play
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
