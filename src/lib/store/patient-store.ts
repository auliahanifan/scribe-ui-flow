
import { create } from 'zustand';
import { Patient } from '@/types';
import { mockPatients } from '@/data/mock-patients';

interface PatientStore {
  patients: Patient[];
  selectedPatient: Patient | null;
  searchQuery: string;
  filterStatus: string;
  
  // Actions
  setPatients: (patients: Patient[]) => void;
  selectPatient: (patient: Patient) => void;
  addPatient: (patient: Omit<Patient, 'id'>) => void;
  updatePatientStatus: (id: string, status: Patient['status']) => void;
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: string) => void;
  getFilteredPatients: () => Patient[];
}

export const usePatientStore = create<PatientStore>((set, get) => ({
  patients: mockPatients,
  selectedPatient: null,
  searchQuery: '',
  filterStatus: 'all',
  
  setPatients: (patients) => set({ patients }),
  
  selectPatient: (patient) => set({ selectedPatient: patient }),
  
  addPatient: (patientData) => {
    const newPatient: Patient = {
      ...patientData,
      id: crypto.randomUUID(),
    };
    set((state) => ({
      patients: [...state.patients, newPatient]
    }));
  },
  
  updatePatientStatus: (id, status) => {
    set((state) => ({
      patients: state.patients.map(patient =>
        patient.id === id ? { ...patient, status } : patient
      )
    }));
  },
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setFilterStatus: (status) => set({ filterStatus: status }),
  
  getFilteredPatients: () => {
    const { patients, searchQuery, filterStatus } = get();
    
    return patients.filter(patient => {
      const matchesSearch = patient.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'all' || patient.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }
}));
