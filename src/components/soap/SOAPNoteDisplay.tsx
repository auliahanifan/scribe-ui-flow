
import { SOAPNote } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText } from 'lucide-react';

interface SOAPNoteDisplayProps {
  soapNote: SOAPNote | null;
}

export function SOAPNoteDisplay({ soapNote }: SOAPNoteDisplayProps) {
  if (!soapNote) {
    return (
      <Card className="h-full min-h-[400px] bg-gray-50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No SOAP Note Generated
          </h3>
          <p className="text-gray-500 max-w-sm">
            Start recording a patient consultation to automatically generate a SOAP note.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-gray-900">
            SOAP Note
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>{new Date(soapNote.generatedAt).toLocaleString()}</span>
          </div>
        </div>
        <Badge variant="completed" className="w-fit">
          AI Generated
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">S</span>
            Subjective
          </h4>
          <p className="text-gray-700 leading-relaxed">
            {soapNote.subjective}
          </p>
        </div>
        
        <Separator />
        
        <div>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">O</span>
            Objective
          </h4>
          <p className="text-gray-700 leading-relaxed">
            {soapNote.objective}
          </p>
        </div>
        
        <Separator />
        
        <div>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold">A</span>
            Assessment
          </h4>
          <p className="text-gray-700 leading-relaxed">
            {soapNote.assessment}
          </p>
        </div>
        
        <Separator />
        
        <div>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold">P</span>
            Plan
          </h4>
          <div className="text-gray-700 leading-relaxed whitespace-pre-line">
            {soapNote.plan}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
