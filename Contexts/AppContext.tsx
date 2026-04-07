// import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { supabase } from '../services/supabase';

// // ============================================================================
// // TYPE DEFINITIONS
// // ============================================================================

// // User & Staff Types
// interface User {
//   id: string;
//   userId: string;
//   name: string;
//   firstName: string;
//   lastName: string;
//   role: string;
//   staffType: string;
//   photo_url: string | null;
//   department: string;
//   employeeId: string;
//   designation: string;
//   email: string;
//   phone: string;
// }

// interface StaffData {
//   id: string;
//   user_id: string;
//   first_name: string;
//   last_name: string;
//   email: string;
//   phone: string;
//   photo_url: string | null;
//   role: string;
//   staff?: {
//     id: string;
//     staff_type: string;
//     department: string;
//     employee_id: string;
//     designation: string;
//   };
// }

// // Dashboard Types
// interface DashboardCard {
//   id: string;
//   title: string;
//   value: string | number;
//   icon: string;
//   color: string;
//   route?: string;
// }

// interface QuickAction {
//   id: string;
//   title: string;
//   icon: string;
//   color: string;
//   route: string;
// }

// interface UpcomingItem {
//   id: string;
//   title: string;
//   subtitle: string;
//   time: string;
//   icon: string;
//   color: string;
// }

// interface DashboardData {
//   stats: DashboardCard[];
//   upcomingItems: UpcomingItem[];
//   announcements: any[];
//   todaySchedule: any[];
// }

// // Attendance Types
// interface Student {
//   id: string;
//   user_id: string;
//   admission_number: string;
//   roll_number: string;
//   class_id: string;
//   status: string;
//   user: {
//     id: string;
//     first_name: string;
//     last_name: string;
//     photo_url: string | null;
//   };
//   class: {
//     id: string;
//     grade: {
//       grade: string;
//     };
//     section: {
//       section: string;
//     };
//   };
// }

// interface Class {
//   id: string;
//   grade: {
//     grade: string;
//   };
//   section: {
//     section: string;
//   };
//   room_number: string;
// }

// interface AttendanceData {
//   selectedClass: Class | null;
//   students: Student[];
//   presentStudents: Set<string>;
//   selectedDate: Date;
// }

// // Homework Types
// interface Period {
//   id: string;
//   period_number: number;
//   start_time: string;
//   end_time: string;
// }

// interface Subject {
//   id: string;
//   name: string;
//   code: string;
// }

// interface TodayClass {
//   id: string;
//   class_id: string;
//   subject_id: string;
//   period_id: string;
//   day: string;
//   grade_name: string;
//   section_name: string;
//   subject_name: string;
//   subject_code: string;
//   period_number: number;
//   start_time: string;
//   end_time: string;
//   room_number: string;
// }

// interface Homework {
//   id: string;
//   date: string;
//   subject_id: string;
//   class_id: string;
//   title: string;
//   description: string;
//   status: string;
//   subject_name: string;
//   class_name: string;
//   total_students: number;
//   submitted_count: number;
//   created_at: string;
// }

// interface HomeworkSubmission {
//   id: string;
//   student_id: string;
//   student_name: string;
//   admission_number: string;
//   status: 'Pending' | 'Submitted' | 'Late';
//   submitted_at: string | null;
//   remarks: string | null;
// }

// interface HomeworkData {
//   todayClasses: TodayClass[];
//   yesterdayHomework: Homework[];
//   homeworkList: Homework[];
//   selectedHomework: Homework | null;
//   submissions: HomeworkSubmission[];
// }

// // Timetable Types
// interface TimetableEntry {
//   id: string;
//   day: string;
//   period?: Period;
//   class?: {
//     id: string;
//     room_number: string;
//     grade?: { grade: string };
//     section?: { section: string };
//   };
//   subject?: Subject;
// }

// interface TimetableData {
//   timetableEntries: TimetableEntry[];
//   periods: Period[];
//   selectedDay: string;
//   currentTime: Date;
// }

// // Payroll Types
// interface Payroll {
//   id: string;
//   staff_id: string;
//   month: number;
//   year: number;
//   total_working_days: number;
//   present_days: number;
//   absent_days: number;
//   leaves: number;
//   base_salary: number;
//   allowances: number;
//   deductions: number;
//   gross_salary: number;
//   net_salary: number;
//   payment_status: 'pending' | 'approved' | 'paid' | 'cancelled';
//   payment_date?: string;
//   payment_method?: string;
//   transaction_id?: string;
//   remarks?: string;
//   created_at: string;
// }

// interface PayrollData {
//   payrolls: Payroll[];
//   selectedPayroll: Payroll | null;
//   filterYear: number;
//   totalEarnings: number;
// }

// // ============================================================================
// // CONTEXT TYPE DEFINITION
// // ============================================================================

// interface AppContextType {
//   // User Data
//   user: User | null;
//   staffId: string;
//   userId: string;
//   setUser: (user: User | null) => void;
//   setStaffId: (id: string) => void;
//   setUserId: (id: string) => void;
//   loadUserData: () => Promise<void>;

//   // Dashboard Data
//   dashboardData: DashboardData | null;
//   setDashboardData: (data: DashboardData | null) => void;
//   fetchDashboardData: (user: User, staffId: string) => Promise<void>;
//   refreshDashboard: () => Promise<void>;

//   // Attendance Data
//   attendanceData: AttendanceData;
//   setAttendanceData: (data: AttendanceData) => void;
//   classes: Class[];
//   setClasses: (classes: Class[]) => void;
//   fetchTeacherClasses: (staffId: string) => Promise<void>;
//   fetchStudents: (classId: string, date: Date) => Promise<Student[]>;
//   saveAttendance: (
//     students: Student[],
//     presentStudents: Set<string>,
//     date: Date,
//     userId: string
//   ) => Promise<boolean>;

//   // Homework Data
//   homeworkData: HomeworkData;
//   setHomeworkData: (data: HomeworkData) => void;
//   fetchTodayClasses: (staffId: string) => Promise<TodayClass[]>;
//   fetchYesterdayHomework: (staffId: string) => Promise<Homework[]>;
//   fetchHomeworkList: (staffId: string) => Promise<Homework[]>;
//   fetchSubmissions: (homeworkId: string, classId: string) => Promise<HomeworkSubmission[]>;
//   uploadHomework: (
//     classItem: TodayClass,
//     date: Date,
//     title: string,
//     description: string,
//     staffId: string
//   ) => Promise<boolean>;
//   markSubmission: (
//     submissionId: string,
//     studentId: string,
//     homeworkId: string,
//     currentStatus: string
//   ) => Promise<boolean>;

//   // Timetable Data
//   timetableData: TimetableData;
//   setTimetableData: (data: TimetableData) => void;
//   fetchTimetable: (staffId: string, day: string) => Promise<void>;
//   getCurrentPeriod: () => TimetableEntry | undefined;
//   getNextPeriod: () => TimetableEntry | undefined;

//   // Payroll Data
//   payrollData: PayrollData;
//   setPayrollData: (data: PayrollData) => void;
//   fetchPayrolls: (staffId: string, year?: number) => Promise<void>;
//   calculateTotalEarnings: () => number;

//   // Global Loading States
//   loading: boolean;
//   setLoading: (loading: boolean) => void;

//   // Utility Functions
//   clearAllData: () => void;
//   refreshAllData: () => Promise<void>;
// }

// // ============================================================================
// // CREATE CONTEXT
// // ============================================================================

// const AppContext = createContext<AppContextType | undefined>(undefined);

// // ============================================================================
// // PROVIDER COMPONENT
// // ============================================================================

// export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
//   // ==================== STATE ====================
  
//   // User State
//   const [user, setUser] = useState<User | null>(null);
//   const [staffId, setStaffId] = useState<string>('');
//   const [userId, setUserId] = useState<string>('');

//   // Dashboard State
//   const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

//   // Attendance State
//   const [attendanceData, setAttendanceData] = useState<AttendanceData>({
//     selectedClass: null,
//     students: [],
//     presentStudents: new Set<string>(),
//     selectedDate: new Date(),
//   });
//   const [classes, setClasses] = useState<Class[]>([]);

//   // Homework State
//   const [homeworkData, setHomeworkData] = useState<HomeworkData>({
//     todayClasses: [],
//     yesterdayHomework: [],
//     homeworkList: [],
//     selectedHomework: null,
//     submissions: [],
//   });

//   // Timetable State
//   const [timetableData, setTimetableData] = useState<TimetableData>({
//     timetableEntries: [],
//     periods: [],
//     selectedDay: '',
//     currentTime: new Date(),
//   });

//   // Payroll State
//   const [payrollData, setPayrollData] = useState<PayrollData>({
//     payrolls: [],
//     selectedPayroll: null,
//     filterYear: new Date().getFullYear(),
//     totalEarnings: 0,
//   });

//   // Global Loading
//   const [loading, setLoading] = useState<boolean>(false);

//   // ==================== USER FUNCTIONS ====================

//   const loadUserData = async () => {
//     try {
//       setLoading(true);
//       const [userDataStr, staffIdStr, userIdStr, userRoleStr] = await AsyncStorage.multiGet([
//         'userData',
//         'staffId',
//         'userId',
//         'userRole',
//       ]);

//       const userData = userDataStr[1];
//       const staffIdValue = staffIdStr[1];
//       const userIdValue = userIdStr[1];
//       const userRole = userRoleStr[1];

//       if (userData) {
//         const parsedUserData = JSON.parse(userData) as StaffData;

//         const userObj: User = {
//           id: parsedUserData.id,
//           userId: userIdValue || parsedUserData.id,
//           name: `${parsedUserData.first_name} ${parsedUserData.last_name}`,
//           firstName: parsedUserData.first_name,
//           lastName: parsedUserData.last_name,
//           role: parsedUserData.role || userRole || '',
//           staffType: parsedUserData.staff?.staff_type || parsedUserData.role || '',
//           photo_url: parsedUserData.photo_url,
//           department: parsedUserData.staff?.department || 'N/A',
//           employeeId: parsedUserData.staff?.employee_id || 'N/A',
//           designation: parsedUserData.staff?.designation || 'N/A',
//           email: parsedUserData.email,
//           phone: parsedUserData.phone,
//         };

//         setUser(userObj);
//         setStaffId(staffIdValue || parsedUserData.staff?.id || '');
//         setUserId(userIdValue || parsedUserData.id);
//       }
//     } catch (error) {
//       console.error('Error loading user data:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ==================== DASHBOARD FUNCTIONS ====================

//   const fetchDashboardData = async (user: User, staffId: string) => {
//     try {
//       setLoading(true);
//       const today = new Date().toISOString().split('T')[0];
//       const currentYear = new Date().getFullYear();
//       const academicYear = `${currentYear}-${currentYear + 1}`;

//       let stats: DashboardCard[] = [];
//       let upcomingItems: UpcomingItem[] = [];
//       let todaySchedule: any[] = [];

//       // Fetch based on staff type
//       switch (user.staffType) {
//         case 'teacher':
//           stats = await fetchTeacherStats(staffId, today, academicYear);
//           todaySchedule = await fetchTeacherSchedule(staffId, today);
//           upcomingItems = await fetchTeacherUpcoming(staffId);
//           break;
//         case 'principal':
//           stats = await fetchPrincipalStats(today, academicYear);
//           upcomingItems = await fetchPrincipalUpcoming();
//           break;
//         case 'accountant':
//           stats = await fetchAccountantStats(today, academicYear);
//           upcomingItems = await fetchAccountantUpcoming();
//           break;
//         default:
//           stats = await fetchGeneralStats(staffId, today);
//           break;
//       }

//       // Fetch announcements
//       const { data: announcements } = await supabase
//         .from('announcements')
//         .select('id, title, priority, posted_date')
//         .in('target_audience', ['Staff', 'Both'])
//         .eq('status', 'Published')
//         .gte('expiry_date', new Date().toISOString())
//         .order('posted_date', { ascending: false })
//         .limit(3);

//       setDashboardData({
//         stats,
//         upcomingItems,
//         announcements: announcements || [],
//         todaySchedule,
//       });
//     } catch (error) {
//       console.error('Error fetching dashboard data:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const refreshDashboard = async () => {
//     if (user && staffId) {
//       await fetchDashboardData(user, staffId);
//     }
//   };

//   // Dashboard Helper Functions
//   const fetchTeacherStats = async (
//     staffId: string,
//     today: string,
//     academicYear: string
//   ): Promise<DashboardCard[]> => {
//     // Implementation from StaffDashboard.tsx
//     return [
//       { id: '1', title: 'My Classes', value: '5', icon: 'google-classroom', color: '#4CAF50' },
//       { id: '2', title: 'Students', value: '142', icon: 'account-group', color: '#2196F3' },
//       { id: '3', title: 'Pending Homework', value: '12', icon: 'clipboard-text', color: '#FF9800' },
//       { id: '4', title: 'Attendance Today', value: '95%', icon: 'calendar-check', color: '#9C27B0' },
//     ];
//   };

//   const fetchPrincipalStats = async (today: string, academicYear: string): Promise<DashboardCard[]> => {
//     return [
//       { id: '1', title: 'Total Staff', value: '48', icon: 'account-tie', color: '#4CAF50' },
//       { id: '2', title: 'Total Students', value: '850', icon: 'account-group', color: '#2196F3' },
//       { id: '3', title: 'Pending Approvals', value: '7', icon: 'clipboard-check', color: '#FF9800' },
//       { id: '4', title: 'Attendance Rate', value: '92%', icon: 'chart-line', color: '#9C27B0' },
//     ];
//   };

//   const fetchAccountantStats = async (today: string, academicYear: string): Promise<DashboardCard[]> => {
//     return [
//       { id: '1', title: 'Fees Collected', value: '₹2.4L', icon: 'cash-multiple', color: '#4CAF50' },
//       { id: '2', title: 'Pending Fees', value: '₹85K', icon: 'cash-clock', color: '#FF9800' },
//       { id: '3', title: 'Due Today', value: '23', icon: 'alert-circle', color: '#F44336' },
//       { id: '4', title: 'Payments Processed', value: '156', icon: 'check-circle', color: '#2196F3' },
//     ];
//   };

//   const fetchGeneralStats = async (staffId: string, today: string): Promise<DashboardCard[]> => {
//     return [
//       { id: '1', title: 'Tasks Today', value: '8', icon: 'clipboard-list', color: '#4CAF50' },
//       { id: '2', title: 'Completed', value: '5', icon: 'check-circle', color: '#2196F3' },
//       { id: '3', title: 'Pending', value: '3', icon: 'clock-outline', color: '#FF9800' },
//       { id: '4', title: 'Attendance', value: '100%', icon: 'calendar-check', color: '#9C27B0' },
//     ];
//   };

//   const fetchTeacherSchedule = async (staffId: string, today: string) => {
//     return [];
//   };

//   const fetchTeacherUpcoming = async (staffId: string): Promise<UpcomingItem[]> => {
//     return [];
//   };

//   const fetchPrincipalUpcoming = async (): Promise<UpcomingItem[]> => {
//     return [];
//   };

//   const fetchAccountantUpcoming = async (): Promise<UpcomingItem[]> => {
//     return [];
//   };

//   // ==================== ATTENDANCE FUNCTIONS ====================

//   const fetchTeacherClasses = async (staffId: string) => {
//     try {
//       setLoading(true);
//       const currentYear = new Date().getFullYear();
//       const academicYear = `${currentYear}-${currentYear + 1}`;

//       const { data, error } = await supabase
//         .from('classes')
//         .select(`
//           id,
//           room_number,
//           grade:grades!classes_grade_id_fkey(grade),
//           section:sections!classes_section_id_fkey(section)
//         `)
//         .eq('teacher_id', staffId)
//         .eq('academic_year', academicYear)
//         .order('grade(grade)', { ascending: true });

//       if (error) throw error;
//       setClasses(data || []);
//     } catch (error) {
//       console.error('Error fetching classes:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchStudents = async (classId: string, date: Date): Promise<Student[]> => {
//     try {
//       const dateString = date.toISOString().split('T')[0];

//       const { data: studentsData, error: studentsError } = await supabase
//         .from('students')
//         .select(`
//           id,
//           user_id,
//           admission_number,
//           roll_number,
//           class_id,
//           status,
//           users!students_user_id_fkey(
//             id,
//             first_name,
//             last_name,
//             photo_url
//           )
//         `)
//         .eq('class_id', classId)
//         .eq('status', 'active')
//         .order('roll_number', { ascending: true });

//       if (studentsError) throw studentsError;
//       return studentsData || [];
//     } catch (error) {
//       console.error('Error fetching students:', error);
//       return [];
//     }
//   };

//   const saveAttendance = async (
//     students: Student[],
//     presentStudents: Set<string>,
//     date: Date,
//     userId: string
//   ): Promise<boolean> => {
//     try {
//       const dateString = date.toISOString().split('T')[0];

//       const attendanceRecords = students.map(student => ({
//         student_id: student.id,
//         date: dateString,
//         status: presentStudents.has(student.id) ? 'present' : 'absent',
//         marked_by: userId,
//       }));

//       const { error } = await supabase
//         .from('student_attendance')
//         .upsert(attendanceRecords, { onConflict: 'student_id,date' });

//       if (error) throw error;
//       return true;
//     } catch (error) {
//       console.error('Error saving attendance:', error);
//       return false;
//     }
//   };

//   // ==================== HOMEWORK FUNCTIONS ====================

//   const fetchTodayClasses = async (staffId: string): Promise<TodayClass[]> => {
//     try {
//       const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

//       const { data, error } = await supabase
//         .from('timetable')
//         .select(`
//           id,
//           class_id,
//           subject_id,
//           period_id,
//           day,
//           classes!timetable_class_id_fkey(
//             id,
//             room_number,
//             grades!classes_grade_id_fkey(grade),
//             sections!classes_section_id_fkey(section)
//           ),
//           subjects!timetable_subject_id_fkey(
//             id,
//             name,
//             code
//           ),
//           periods!timetable_period_id_fkey(
//             id,
//             period_number,
//             start_time,
//             end_time
//           )
//         `)
//         .eq('staff_id', staffId)
//         .eq('day', today);

//       if (error) throw error;

//       return (data || []).map((item: any) => ({
//         id: item.id,
//         class_id: item.class_id,
//         subject_id: item.subject_id,
//         period_id: item.period_id,
//         day: item.day,
//         grade_name: item.classes?.grades?.grade || '',
//         section_name: item.classes?.sections?.section || '',
//         subject_name: item.subjects?.name || '',
//         subject_code: item.subjects?.code || '',
//         period_number: item.periods?.period_number || 0,
//         start_time: item.periods?.start_time || '',
//         end_time: item.periods?.end_time || '',
//         room_number: item.classes?.room_number || '',
//       }));
//     } catch (error) {
//       console.error('Error fetching today classes:', error);
//       return [];
//     }
//   };

//   const fetchYesterdayHomework = async (staffId: string): Promise<Homework[]> => {
//     try {
//       const yesterday = new Date();
//       yesterday.setDate(yesterday.getDate() - 1);
//       const yesterdayDate = yesterday.toISOString().split('T')[0];

//       const { data, error } = await supabase
//         .from('homework')
//         .select(`
//           id,
//           date,
//           subject_id,
//           class_id,
//           title,
//           description,
//           status,
//           created_at,
//           subjects!homework_subject_id_fkey(name),
//           classes!homework_class_id_fkey(
//             id,
//             grades!classes_grade_id_fkey(grade),
//             sections!classes_section_id_fkey(section)
//           )
//         `)
//         .eq('staff_id', staffId)
//         .eq('date', yesterdayDate)
//         .order('created_at', { ascending: false });

//       if (error) throw error;
//       return data || [];
//     } catch (error) {
//       console.error('Error fetching yesterday homework:', error);
//       return [];
//     }
//   };

//   const fetchHomeworkList = async (staffId: string): Promise<Homework[]> => {
//     try {
//       const { data, error } = await supabase
//         .from('homework')
//         .select(`
//           id,
//           date,
//           subject_id,
//           class_id,
//           title,
//           description,
//           status,
//           created_at,
//           subjects!homework_subject_id_fkey(name),
//           classes!homework_class_id_fkey(
//             id,
//             grades!classes_grade_id_fkey(grade),
//             sections!classes_section_id_fkey(section)
//           )
//         `)
//         .eq('staff_id', staffId)
//         .order('date', { ascending: false })
//         .limit(20);

//       if (error) throw error;
//       return data || [];
//     } catch (error) {
//       console.error('Error fetching homework list:', error);
//       return [];
//     }
//   };

//   const fetchSubmissions = async (homeworkId: string, classId: string): Promise<HomeworkSubmission[]> => {
//     try {
//       const { data: students, error: studentsError } = await supabase
//         .from('students')
//         .select(`
//           id,
//           admission_number,
//           users!students_user_id_fkey(
//             first_name,
//             last_name
//           )
//         `)
//         .eq('class_id', classId)
//         .eq('status', 'active')
//         .order('admission_number', { ascending: true });

//       if (studentsError) throw studentsError;

//       const { data: existingSubmissions } = await supabase
//         .from('homework_submissions')
//         .select('*')
//         .eq('homework_id', homeworkId);

//       const submissionMap = new Map(
//         (existingSubmissions || []).map(sub => [sub.student_id, sub])
//       );

//       return (students || []).map((student: any) => {
//         const submission = submissionMap.get(student.id);
//         return {
//           id: submission?.id || `pending-${student.id}`,
//           student_id: student.id,
//           student_name: `${student.users?.first_name || ''} ${student.users?.last_name || ''}`.trim(),
//           admission_number: student.admission_number,
//           status: submission?.status || 'Pending',
//           submitted_at: submission?.submitted_at || null,
//           remarks: submission?.remarks || null,
//         };
//       });
//     } catch (error) {
//       console.error('Error fetching submissions:', error);
//       return [];
//     }
//   };

//   const uploadHomework = async (
//     classItem: TodayClass,
//     date: Date,
//     title: string,
//     description: string,
//     staffId: string
//   ): Promise<boolean> => {
//     try {
//       const { data: newHomework, error: insertError } = await supabase
//         .from('homework')
//         .insert({
//           date: date.toISOString().split('T')[0],
//           subject_id: classItem.subject_id,
//           class_id: classItem.class_id,
//           staff_id: staffId,
//           title: title.trim(),
//           description: description.trim(),
//           status: 'Published',
//         })
//         .select()
//         .single();

//       if (insertError) throw insertError;

//       const { data: students } = await supabase
//         .from('students')
//         .select('id')
//         .eq('class_id', classItem.class_id)
//         .eq('status', 'active');

//       if (students && students.length > 0) {
//         const submissions = students.map(student => ({
//           homework_id: newHomework.id,
//           student_id: student.id,
//           status: 'Pending',
//         }));

//         const { error: submissionsError } = await supabase
//           .from('homework_submissions')
//           .insert(submissions);

//         if (submissionsError) throw submissionsError;
//       }

//       return true;
//     } catch (error) {
//       console.error('Error uploading homework:', error);
//       return false;
//     }
//   };

//   const markSubmission = async (
//     submissionId: string,
//     studentId: string,
//     homeworkId: string,
//     currentStatus: string
//   ): Promise<boolean> => {
//     try {
//       const newStatus = currentStatus === 'Submitted' ? 'Pending' : 'Submitted';
//       const isNewSubmission = submissionId.startsWith('pending-');

//       if (isNewSubmission) {
//         const { error } = await supabase
//           .from('homework_submissions')
//           .insert({
//             homework_id: homeworkId,
//             student_id: studentId,
//             status: newStatus,
//             submitted_at: newStatus === 'Submitted' ? new Date().toISOString() : null,
//           });

//         if (error) throw error;
//       } else {
//         const { error } = await supabase
//           .from('homework_submissions')
//           .update({
//             status: newStatus,
//             submitted_at: newStatus === 'Submitted' ? new Date().toISOString() : null,
//           })
//           .eq('id', submissionId);

//         if (error) throw error;
//       }

//       return true;
//     } catch (error) {
//       console.error('Error marking submission:', error);
//       return false;
//     }
//   };

//   // ==================== TIMETABLE FUNCTIONS ====================

//   const fetchTimetable = async (staffId: string, day: string) => {
//     try {
//       setLoading(true);

//       const { data: periodsData, error: periodsError } = await supabase
//         .from('periods')
//         .select('*')
//         .order('period_number', { ascending: true });

//       if (periodsError) throw periodsError;

//       const { data: timetableData, error: timetableError } = await supabase
//         .from('timetable')
//         .select(`
//           id,
//           day,
//           periods!timetable_period_id_fkey(
//             id,
//             period_number,
//             start_time,
//             end_time
//           ),
//           classes!timetable_class_id_fkey(
//             id,
//             room_number,
//             grades!classes_grade_id_fkey(grade),
//             sections!classes_section_id_fkey(section)
//           ),
//           subjects!timetable_subject_id_fkey(
//             id,
//             name,
//             code
//           )
//         `)
//         .eq('staff_id', staffId)
//         .eq('day', day)
//         .order('period_id', { ascending: true });

//       if (timetableError) throw timetableError;

//       setTimetableData({
//         timetableEntries: timetableData || [],
//         periods: periodsData || [],
//         selectedDay: day,
//         currentTime: new Date(),
//       });
//     } catch (error) {
//       console.error('Error fetching timetable:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const getCurrentPeriod = () => {
//     const now = timetableData.currentTime;
//     const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
//       now.getMinutes()
//     ).padStart(2, '0')}:00`;

//     return timetableData.timetableEntries.find((entry: any) => {
//       const startTime = entry.period?.start_time;
//       const endTime = entry.period?.end_time;
//       return currentTimeStr >= startTime && currentTimeStr <= endTime;
//     });
//   };

//   const getNextPeriod = () => {
//     const now = timetableData.currentTime;
//     const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
//       now.getMinutes()
//     ).padStart(2, '0')}:00`;

//     return timetableData.timetableEntries.find((entry: any) => {
//       return currentTimeStr < entry.period?.start_time;
//     });
//   };

//   // ==================== PAYROLL FUNCTIONS ====================

//   const fetchPayrolls = async (staffId: string, year?: number) => {
//     try {
//       setLoading(true);

//       let query = supabase
//         .from('payrolls')
//         .select('*')
//         .eq('staff_id', staffId);

//       if (year) {
//         query = query.eq('year', year);
//       }

//       query = query.order('year', { ascending: false }).order('month', { ascending: false });

//       const { data, error } = await query;

//       if (error) throw error;

//       const totalEarnings = (data || [])
//         .filter(p => p.payment_status === 'paid')
//         .reduce((sum, p) => sum + p.net_salary, 0);

//       setPayrollData({
//         payrolls: data || [],
//         selectedPayroll: null,
//         filterYear: year || new Date().getFullYear(),
//         totalEarnings,
//       });
//     } catch (error) {
//       console.error('Error fetching payrolls:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const calculateTotalEarnings = () => {
//     return payrollData.payrolls
//       .filter(p => p.payment_status === 'paid')
//       .reduce((sum, p) => sum + p.net_salary, 0);
//   };

//   // ==================== UTILITY FUNCTIONS ====================

//   const clearAllData = () => {
//     setUser(null);
//     setStaffId('');
//     setUserId('');
//     setDashboardData(null);
//     setAttendanceData({
//       selectedClass: null,
//       students: [],
//       presentStudents: new Set<string>(),
//       selectedDate: new Date(),
//     });
//     setClasses([]);
//     setHomeworkData({
//       todayClasses: [],
//       yesterdayHomework: [],
//       homeworkList: [],
//       selectedHomework: null,
//       submissions: [],
//     });
//     setTimetableData({
//       timetableEntries: [],
//       periods: [],
//       selectedDay: '',
//       currentTime: new Date(),
//     });
//     setPayrollData({
//       payrolls: [],
//       selectedPayroll: null,
//       filterYear: new Date().getFullYear(),
//       totalEarnings: 0,
//     });
//   };

//   const refreshAllData = async () => {
//     if (user && staffId) {
//       await Promise.all([
//         refreshDashboard(),
//         fetchTeacherClasses(staffId),
//         fetchPayrolls(staffId),
//       ]);
//     }
//   };

//   // ==================== CONTEXT VALUE ====================

//   const value: AppContextType = {
//     // User
//     user,
//     staffId,
//     userId,
//     setUser,
//     setStaffId,
//     setUserId,
//     loadUserData,

//     // Dashboard
//     dashboardData,
//     setDashboardData,
//     fetchDashboardData,
//     refreshDashboard,

//     // Attendance
//     attendanceData,
//     setAttendanceData,
//     classes,
//     setClasses,
//     fetchTeacherClasses,
//     fetchStudents,
//     saveAttendance,

//     // Homework
//     homeworkData,
//     setHomeworkData,
//     fetchTodayClasses,
//     fetchYesterdayHomework,
//     fetchHomeworkList,
//     fetchSubmissions,
//     uploadHomework,
//     markSubmission,

//     // Timetable
//     timetableData,
//     setTimetableData,
//     fetchTimetable,
//     getCurrentPeriod,
//     getNextPeriod,

//     // Payroll
//     payrollData,
//     setPayrollData,
//     fetchPayrolls,
//     calculateTotalEarnings,

//     // Global
//     loading,
//     setLoading,

//     // Utilities
//     clearAllData,
//     refreshAllData,
//   };

//   return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
// };

// // ============================================================================
// // CUSTOM HOOK
// // ============================================================================

// export const useApp = (): AppContextType => {
//   const context = useContext(AppContext);
//   if (context === undefined) {
//     throw new Error('useApp must be used within an AppProvider');
//   }
//   return context;
// };

// export default AppContext;