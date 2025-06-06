
'use client';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientStore } from '@/lib/store/patient-store';
import { PatientGrid } from '@/components/patient/PatientGrid';
import { SearchBar } from '@/components/patient/SearchBar';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { Button } from '@/components/ui/button';
import { Plus, Stethoscope } from 'lucide-react';

export default function PatientQueuePage() {
  const navigate = useNavigate();
  const {
    searchQuery,
    filterStatus,
    selectPatient,
    setSearchQuery,
    setFilterStatus,
    getFilteredPatients
  } = usePatientStore();

  const filteredPatients = getFilteredPatients();

  const handlePatientClick = (patient: any) => {
    selectPatient(patient);
    navigate(`/patient-detail/${patient.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                AI Medical Scribe
              </h1>
              <p className="text-sm text-gray-600">Patient Queue</p>
            </div>
          </div>
          
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Patient
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              Today's Appointments
            </h2>
            <p className="text-gray-600">
              {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} scheduled
            </p>
          </div>

          <SearchBar
            searchQuery={searchQuery}
            filterStatus={filterStatus}
            onSearchChange={setSearchQuery}
            onFilterChange={setFilterStatus}
          />

          <PatientGrid
            patients={filteredPatients}
            onPatientClick={handlePatientClick}
          />
        </div>
      </div>

      <BottomNavigation activeTab="patient-queue" />
    </div>
  );
}
