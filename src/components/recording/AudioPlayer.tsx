import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SavedRecording } from '@/lib/store/recording-store';
import { RealAudioService } from '@/lib/services/real-audio-service';

interface AudioPlayerProps {
  recording: SavedRecording;
  onPlaybackEnd?: () => void;
}

export function AudioPlayer({ recording, onPlaybackEnd }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recording.duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Create audio element
        const audio = new Audio();
        
        // Check if it's a base64 string from localStorage or a blob URL
        if (recording.url.startsWith('data:')) {
          // Convert base64 to a temporary blob URL for playback
          const blob = await RealAudioService.blobFromBase64(recording.url);
          audio.src = URL.createObjectURL(blob);
        } else {
          audio.src = recording.url;
        }
        
        audioRef.current = audio;

        // Set up event listeners
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('canplaythrough', () => {
          // Use the actual audio duration if available, fallback to the stored duration
          setDuration(audio.duration || recording.duration);
        });
        
        // Handle errors
        audio.addEventListener('error', (e) => {
          console.error('Error loading audio:', e);
        });
      } catch (error) {
        console.error('Error setting up audio:', error);
      }
    };
    
    setupAudio();

    // Clean up
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', updateProgress);
        audioRef.current.removeEventListener('ended', handleEnded);
        
        // Release object URL to avoid memory leaks
        if (audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
    };
  }, [recording.url]);

  const updateProgress = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (onPlaybackEnd) {
      onPlaybackEnd();
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.min(
        Math.max(0, audioRef.current.currentTime + seconds),
        audioRef.current.duration
      );
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 w-full">
      <div className="text-sm font-medium mb-2">{recording.title}</div>
      <audio className="hidden" src={recording.url} controls ref={audioRef} />
      
      <div className="flex items-center gap-2 mb-2">
        <Button 
          onClick={() => skip(-10)} 
          variant="ghost" 
          size="sm" 
          className="p-1"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button
          onClick={togglePlayback}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            isPlaying ? "bg-blue-600" : "bg-blue-500"
          )}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 text-white" />
          ) : (
            <Play className="h-4 w-4 text-white" />
          )}
        </Button>
        
        <Button 
          onClick={() => skip(10)} 
          variant="ghost" 
          size="sm" 
          className="p-1"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        
        <div className="text-xs font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
      
      <input
        type="range"
        min="0"
        max={duration || 100}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}
