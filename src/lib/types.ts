
export interface Department {
  id: string;
  name: string;
}

export interface Class {
  id: string;
  departmentId: string;
  name: string;
  teacherId?: string;
}

export interface Student {
  id: string;
  name: string;
  departmentId: string;
  classId: string;
  registerNo: string;
  gender: 'MALE' | 'FEMALE';
  parentPhoneNumber?: string;
  mentor?: string;
  admissionType?: 'CENTAC' | 'Management';
}

export interface Staff {
  id: string; // This can be a generated ID
  name: string;
  email: string;
  role: 'admin' | 'viewer' | 'teacher' | 'dean';
  classId?: string; // Only for teachers
  password?: string; 
}

export type FeeCategory = 'tuition' | 'exam' | 'transport' | 'hostel' | 'registration';

export interface FeeItem {
  total: number;
  paid: number;
  balance: number;
}

export interface Fee {
  id: string; // Should be the same as studentId
  studentId: string;
  studentName: string;
  classId: string;
  registerNo: string;
  
  tuition: FeeItem;
  exam: FeeItem;
  transport: FeeItem;
  hostel: FeeItem;
  registration: FeeItem;
  
  concession: number;
  totalAmount: number; // Calculated total
  totalPaid: number; // Calculated total
  totalBalance: number; // Calculated total

  updatedAt: any; // Firestore Timestamp
  recordedBy: string; // staff name
}

export interface FeeTransaction {
  id: string;
  feeId: string; // studentId
  feeType: FeeCategory;
  amount: number;
  date: string; // YYYY-MM-DD
  recordedBy: string; // staff name
  timestamp: any;
}


export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  registerNo: string;
  gender: 'MALE' | 'FEMALE';
  departmentName: string;
  className: string;
  date: string;
  time: string;
  markedBy: string;
  status: 'Informed' | 'Not Informed' | 'Letter Given';
  timestamp: any;
}

export interface WorkingDay {
    id: string;
    isWorkingDay: boolean;
    timestamp: Date;
}

export interface AttendanceSubmission {
  id:string; // Composite key like `${classId}_${date}`
  classId: string;
  departmentId: string;
  date: string; // format YYYY-MM-DD
  submittedBy: string; // staffId
  submittedAt: any; // Firestore Timestamp
  presentCount: number;
  absentCount: number;
}
