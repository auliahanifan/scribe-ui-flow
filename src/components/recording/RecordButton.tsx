
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecordButtonProps {
  status: 'idle' | 'recording' | 'processing';
  onToggleRecording: () => void;
  recordingDuration?: number;
}

export function RecordButton({ status, onToggleRecording, recordingDuration = 0 }: RecordButtonProps) {
  const [displayDuration, setDisplayDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status === 'recording') {
      interval = setInterval(() => {
        setDisplayDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDisplayDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getButtonContent = () => {
    switch (status) {
      case 'recording':
        return <Square className="h-8 w-8" />;
      case 'processing':
        return <Loader2 className="h-8 w-8 animate-spin" />;
      default:
        return <Mic className="h-8 w-8" />;
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'recording':
        return 'Stop Recording';
      case 'processing':
        return 'Processing...';
      default:
        return 'Start Recording';
    }
  };

  const getButtonStyles = () => {
    switch (status) {
      case 'recording':
        return 'bg-red-500 hover:bg-red-600 text-white animate-pulse';
      case 'processing':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Button
        onClick={onToggleRecording}
        disabled={status === 'processing'}
        className={cn(
          'w-20 h-20 rounded-full shadow-lg transition-all duration-300 hover:shadow-xl active:scale-95',
          getButtonStyles()
        )}
      >
        {getButtonContent()}
      </Button>
      
      <div className="text-center">
        <p className="text-sm font-medium text-gray-900 mb-1">
          {getButtonText()}
        </p>
        
        {status === 'recording' && (
          <p className="text-lg font-mono text-red-600">
            {formatDuration(displayDuration)}
          </p>
        )}
      </div>
    </div>
  );
}
