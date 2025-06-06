
import { Patient } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, Phone, Mail } from 'lucide-react';

interface PatientHeaderProps {
  patient: Patient;
}

export function PatientHeader({ patient }: PatientHeaderProps) {
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
    <div className="flex items-center gap-4 p-6 bg-white border-b border-gray-200">
      <Avatar className="h-16 w-16">
        <AvatarImage src={patient.avatar} alt={patient.name} />
        <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-lg">
          {getInitials(patient.name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            {patient.name}
          </h1>
          <Badge variant={getStatusColor(patient.status)}>
            {getStatusText(patient.status)}
          </Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
          <span className="font-medium">Age {patient.age}</span>
          
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{patient.appointmentTime}</span>
          </div>
          
          {patient.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              <span>{patient.phone}</span>
            </div>
          )}
          
          {patient.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              <span>{patient.email}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
