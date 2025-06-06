
import { Patient } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, Phone, Calendar } from 'lucide-react';

interface PatientCardProps {
  patient: Patient;
  onClick: () => void;
}

export function PatientCard({ patient, onClick }: PatientCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const getStatusColor = (status: Patient['status']) => {
    switch (status) {
      case 'waiting':
        return 'waiting';
      case 'in-progress':
        return 'in-progress';
      case 'completed':
        return 'completed';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: Patient['status']) => {
    switch (status) {
      case 'waiting':
        return 'Waiting';
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  return (
    <Card 
      className="p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] bg-white"
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={patient.avatar} alt={patient.name} />
          <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
            {getInitials(patient.name)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900 truncate">
              {patient.name}
            </h3>
            <Badge variant={getStatusColor(patient.status)}>
              {getStatusText(patient.status)}
            </Badge>
          </div>
          
          <p className="text-sm text-gray-500 mb-3">
            Age {patient.age}
          </p>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>{patient.appointmentTime}</span>
            </div>
            
            {patient.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4" />
                <span>{patient.phone}</span>
              </div>
            )}
            
            {patient.lastVisit && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Last visit: {new Date(patient.lastVisit).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
