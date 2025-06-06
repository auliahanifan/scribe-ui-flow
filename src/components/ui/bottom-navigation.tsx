
import { Button } from '@/components/ui/button';
import { Users, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BottomNavigationProps {
  activeTab: 'patient-queue' | 'patient-detail';
}

export function BottomNavigation({ activeTab }: BottomNavigationProps) {
  const navigate = useNavigate();

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex justify-center gap-8">
        <Button
          variant={activeTab === 'patient-queue' ? 'default' : 'ghost'}
          onClick={() => navigate('/patient-queue')}
          className={cn(
            'flex flex-col items-center gap-1 h-auto py-2 px-4',
            activeTab === 'patient-queue' ? 'text-blue-600' : 'text-gray-600'
          )}
        >
          <Users className="h-5 w-5" />
          <span className="text-xs">Queue</span>
        </Button>
        
        <Button
          variant={activeTab === 'patient-detail' ? 'default' : 'ghost'}
          onClick={() => navigate(-1)}
          className={cn(
            'flex flex-col items-center gap-1 h-auto py-2 px-4',
            activeTab === 'patient-detail' ? 'text-blue-600' : 'text-gray-600'
          )}
        >
          <User className="h-5 w-5" />
          <span className="text-xs">Patient</span>
        </Button>
      </div>
    </div>
  );
}
