import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 52) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatCard {
  id: string;
  title: string;
  value: string | number;
  icon: string;
  color: string;
  bg: string;
}

interface QuickAction {
  id: string;
  title: string;
  icon: string;
  color: string;
  route: string;
}

interface UpcomingItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  icon: string;
  color: string;
}

interface ScheduleItem {
  period: string;
  time: string;
  class: string;
  subject: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StaffDashboard() {
  const insets = useSafeAreaInsets();

  const Navigation = useNavigation()

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [greeting, setGreeting] = useState('Good Morning');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
    loadUserDataAndFetchDashboard();
  }, []);

  const loadUserDataAndFetchDashboard = async () => {
    try {
      setLoading(true);
      const [userDataStr, staffIdStr, userIdStr, userRoleStr] = await AsyncStorage.multiGet([
        'userData', 'staffId', 'userId', 'userRole',
      ]);

      const userData = userDataStr[1];
      const staffId = staffIdStr[1];
      const userId = userIdStr[1];
      const userRole = userRoleStr[1];

      if (!userData) {
        Alert.alert('Error', 'User session not found. Please login again.');
        return;
      }

      const parsedUserData = JSON.parse(userData);

      const user = {
        id: parsedUserData.id,
        userId: userId || parsedUserData.id,
        name: `${parsedUserData.first_name} ${parsedUserData.last_name}`,
        firstName: parsedUserData.first_name,
        role: parsedUserData.role || userRole,
        staffType: parsedUserData.staff?.staff_type || parsedUserData.role,
        photo_url: parsedUserData.photo_url,
        department: parsedUserData.staff?.department || 'N/A',
        employeeId: parsedUserData.staff?.employee_id || 'N/A',
        designation: parsedUserData.staff?.designation || 'Staff',
        email: parsedUserData.email,
        phone: parsedUserData.phone,
      };

      setCurrentUser(user);
      const finalStaffId = staffId || parsedUserData.staff?.id;
      await fetchDashboardData(user, finalStaffId);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async (user: any, staffId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${currentYear + 1}`;

      let stats: StatCard[] = [];
      let upcomingItems: UpcomingItem[] = [];
      let todaySchedule: ScheduleItem[] = [];

      switch (user.staffType) {
        case 'teacher':
          stats = await fetchTeacherStats(staffId, today, academicYear);
          todaySchedule = await fetchTeacherSchedule(staffId, today);
          upcomingItems = await fetchTeacherUpcoming(staffId);
          break;
        case 'principal':
          stats = await fetchPrincipalStats(today, academicYear);
          upcomingItems = await fetchPrincipalUpcoming();
          break;
        case 'accountant':
          stats = await fetchAccountantStats(today, academicYear);
          upcomingItems = await fetchAccountantUpcoming();
          break;
        default:
          stats = await fetchGeneralStats(staffId, today);
          upcomingItems = getUpcomingItemsForRole('other');
      }

      const { data: announcements } = await supabase
        .from('announcements')
        .select('id, title, priority, posted_date, category')
        .in('target_audience', ['Staff', 'Both'])
        .eq('status', 'Published')
        .gte('expiry_date', new Date().toISOString())
        .order('posted_date', { ascending: false })
        .limit(3);

      setDashboardData({ stats, upcomingItems, announcements: announcements || [], todaySchedule });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchTeacherStats = async (staffId: string, today: string, academicYear: string): Promise<StatCard[]> => {
    try {
      const { data: classes } = await supabase
        .from('classes').select('id, grade_id, section_id, room_number')
        .eq('teacher_id', staffId).eq('academic_year', academicYear);

      const classIds = classes?.map(c => c.id) || [];

      let studentsCount = 0;
      if (classIds.length > 0) {
        const { count } = await supabase.from('students')
          .select('*', { count: 'exact', head: true })
          .in('class_id', classIds).eq('status', 'active');
        studentsCount = count || 0;
      }

      let pendingCount = 0;
      if (classIds.length > 0) {
        const { data: homework } = await supabase.from('homework').select('id')
          .eq('staff_id', staffId).in('class_id', classIds).eq('status', 'Published');
        const homeworkIds = homework?.map(h => h.id) || [];
        if (homeworkIds.length > 0) {
          const { count } = await supabase.from('homework_submissions')
            .select('*', { count: 'exact', head: true })
            .in('homework_id', homeworkIds).eq('status', 'Pending');
          pendingCount = count || 0;
        }
      }

      let attendancePercentage = 0;
      if (classIds.length > 0) {
        const { data: students } = await supabase.from('students').select('id')
          .in('class_id', classIds).eq('status', 'active');
        if (students && students.length > 0) {
          const studentIds = students.map(s => s.id);
          const { data: attendanceData } = await supabase.from('student_attendance')
            .select('status').in('student_id', studentIds).eq('date', today);
          if (attendanceData && attendanceData.length > 0) {
            const presentCount = attendanceData.filter(a => a.status === 'present').length;
            attendancePercentage = Math.round((presentCount / attendanceData.length) * 100);
          }
        }
      }

      const { count: upcomingExams } = await supabase.from('exams')
        .select('*', { count: 'exact', head: true })
        .eq('examiner_id', staffId).gte('date', today).eq('status', 'scheduled');

      return [
        { id: '1', title: 'My Classes',        value: (classes?.length || 0).toString(), icon: 'google-classroom',       color: '#1e3a8a', bg: '#EFF6FF' },
        { id: '2', title: 'Students',           value: studentsCount.toString(),          icon: 'account-group',          color: '#0891b2', bg: '#ECFEFF' },
        { id: '3', title: 'Pending Reviews',    value: pendingCount.toString(),           icon: 'clipboard-text-outline', color: '#d97706', bg: '#FFFBEB' },
        { id: '4', title: "Today's Attendance", value: `${attendancePercentage}%`,        icon: 'calendar-check-outline', color: '#059669', bg: '#ECFDF5' },
        { id: '5', title: 'Upcoming Exams',     value: (upcomingExams || 0).toString(),   icon: 'file-document-outline',  color: '#dc2626', bg: '#FEF2F2' },
        { id: '6', title: 'Timetable Slots',    value: '—',                              icon: 'timetable',              color: '#7c3aed', bg: '#F5F3FF' },
      ];
    } catch { return getDefaultStats('teacher'); }
  };

  const fetchTeacherSchedule = async (staffId: string, today: string): Promise<ScheduleItem[]> => {
    try {
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const { data: schedule } = await supabase.from('timetable')
        .select('id, class_id, period_id, subject_id, day')
        .eq('staff_id', staffId).eq('day', dayOfWeek);

      if (!schedule || schedule.length === 0) return [];

      const periodIds = [...new Set(schedule.map(s => s.period_id))];
      const subjectIds = [...new Set(schedule.map(s => s.subject_id))];
      const classIds = [...new Set(schedule.map(s => s.class_id))];

      const [{ data: periods }, { data: subjects }, { data: classes }] = await Promise.all([
        supabase.from('periods').select('id, period_number, start_time, end_time').in('id', periodIds),
        supabase.from('subjects').select('id, name').in('id', subjectIds),
        supabase.from('classes').select('id, grade_id, section_id').in('id', classIds),
      ]);

      let grades: any[] = [], sections: any[] = [];
      if (classes && classes.length > 0) {
        const [{ data: g }, { data: s }] = await Promise.all([
          supabase.from('grades').select('id, grade').in('id', [...new Set(classes.map(c => c.grade_id))]),
          supabase.from('sections').select('id, section').in('id', [...new Set(classes.map(c => c.section_id))]),
        ]);
        grades = g || [];
        sections = s || [];
      }

      return schedule.map((item: any) => {
        const period = periods?.find(p => p.id === item.period_id);
        const subject = subjects?.find(s => s.id === item.subject_id);
        const classData = classes?.find(c => c.id === item.class_id);
        const grade = grades.find(g => g.id === classData?.grade_id);
        const section = sections.find(s => s.id === classData?.section_id);
        const n = period?.period_number || 1;
        const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
        return {
          period: `${n}${suffix} Period`,
          time: period ? `${period.start_time.slice(0, 5)} – ${period.end_time.slice(0, 5)}` : '—',
          class: `Class ${grade?.grade || '?'}-${section?.section || '?'}`,
          subject: subject?.name || '—',
        };
      }).sort((a, b) => parseInt(a.period) - parseInt(b.period));
    } catch { return []; }
  };

  const fetchTeacherUpcoming = async (staffId: string): Promise<UpcomingItem[]> => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: exams } = await supabase.from('exams')
        .select('id, name, exam_type, date, class_id, subject_id, start_time')
        .eq('examiner_id', staffId).gte('date', today).order('date').limit(4);

      if (!exams || exams.length === 0) return getUpcomingItemsForRole('teacher');

      const classIds = [...new Set(exams.map(e => e.class_id))];
      const subjectIds = [...new Set(exams.map(e => e.subject_id))];

      const [{ data: classes }, { data: subjects }] = await Promise.all([
        supabase.from('classes').select('id, grade_id, section_id').in('id', classIds),
        supabase.from('subjects').select('id, name').in('id', subjectIds),
      ]);

      let grades: any[] = [], sections: any[] = [];
      if (classes && classes.length > 0) {
        const [{ data: g }, { data: s }] = await Promise.all([
          supabase.from('grades').select('id, grade').in('id', [...new Set(classes.map(c => c.grade_id))]),
          supabase.from('sections').select('id, section').in('id', [...new Set(classes.map(c => c.section_id))]),
        ]);
        grades = g || [];
        sections = s || [];
      }

      return exams.map((exam: any) => {
        const classData = classes?.find(c => c.id === exam.class_id);
        const grade = grades.find(g => g.id === classData?.grade_id);
        const section = sections.find(s => s.id === classData?.section_id);
        const subject = subjects?.find(s => s.id === exam.subject_id);
        return {
          id: exam.id,
          title: `${subject?.name || '—'} Exam`,
          subtitle: `Class ${grade?.grade || '?'}-${section?.section || '?'} · ${exam.exam_type}`,
          time: new Date(exam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          icon: 'file-document-edit-outline',
          color: '#dc2626',
        };
      });
    } catch { return getUpcomingItemsForRole('teacher'); }
  };

  const fetchPrincipalStats = async (today: string, academicYear: string): Promise<StatCard[]> => {
    try {
      const [{ count: staffCount }, { count: studentCount }, { count: pendingLeaves }, { data: att }] = await Promise.all([
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('leave_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('student_attendance').select('status').eq('date', today),
      ]);
      const presentCount = att?.filter(a => a.status === 'present').length || 0;
      const rate = att?.length ? Math.round((presentCount / att.length) * 100) : 0;
      return [
        { id: '1', title: 'Total Staff',       value: staffCount?.toString() || '0',    icon: 'account-tie',     color: '#059669', bg: '#ECFDF5' },
        { id: '2', title: 'Total Students',    value: studentCount?.toString() || '0',  icon: 'account-group',   color: '#0891b2', bg: '#ECFEFF' },
        { id: '3', title: 'Pending Approvals', value: pendingLeaves?.toString() || '0', icon: 'clipboard-check', color: '#d97706', bg: '#FFFBEB' },
        { id: '4', title: 'Attendance Rate',   value: `${rate}%`,                       icon: 'chart-line',      color: '#1e3a8a', bg: '#EFF6FF' },
      ];
    } catch { return getDefaultStats('principal'); }
  };

  const fetchAccountantStats = async (today: string, academicYear: string): Promise<StatCard[]> => {
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [{ data: paid }, { data: pending }, { count: dueToday }] = await Promise.all([
        supabase.from('fee_payment_history').select('paid_amount').eq('payment_status', 'paid').gte('payment_date', startOfMonth),
        supabase.from('fee_payment_history').select('pending_amount').in('payment_status', ['pending', 'partial', 'overdue']),
        supabase.from('fee_payment_history').select('*', { count: 'exact', head: true }).eq('due_date', today).in('payment_status', ['pending', 'partial']),
      ]);
      const totalCollected = paid?.reduce((s, p) => s + Number(p.paid_amount), 0) || 0;
      const totalPending = pending?.reduce((s, p) => s + Number(p.pending_amount), 0) || 0;
      return [
        { id: '1', title: 'Fees Collected', value: `₹${(totalCollected / 100000).toFixed(1)}L`, icon: 'cash-multiple',        color: '#059669', bg: '#ECFDF5' },
        { id: '2', title: 'Pending Fees',   value: `₹${(totalPending / 1000).toFixed(0)}K`,     icon: 'cash-clock',           color: '#d97706', bg: '#FFFBEB' },
        { id: '3', title: 'Due Today',      value: dueToday?.toString() || '0',                 icon: 'alert-circle-outline', color: '#dc2626', bg: '#FEF2F2' },
        { id: '4', title: 'This Month',     value: paid?.length?.toString() || '0',             icon: 'check-circle-outline', color: '#0891b2', bg: '#ECFEFF' },
      ];
    } catch { return getDefaultStats('accountant'); }
  };

  const fetchGeneralStats = async (staffId: string, today: string): Promise<StatCard[]> => getDefaultStats('other');
  const fetchPrincipalUpcoming = async (): Promise<UpcomingItem[]> => getUpcomingItemsForRole('principal');
  const fetchAccountantUpcoming = async (): Promise<UpcomingItem[]> => getUpcomingItemsForRole('accountant');

  const getDefaultStats = (role: string): StatCard[] => {
    switch (role) {
      case 'teacher': return [
        { id: '1', title: 'My Classes',       value: '5',    icon: 'google-classroom',       color: '#1e3a8a', bg: '#EFF6FF' },
        { id: '2', title: 'Students',          value: '142',  icon: 'account-group',          color: '#0891b2', bg: '#ECFEFF' },
        { id: '3', title: 'Pending Reviews',   value: '12',   icon: 'clipboard-text-outline', color: '#d97706', bg: '#FFFBEB' },
        { id: '4', title: 'Attendance Today',  value: '95%',  icon: 'calendar-check-outline', color: '#059669', bg: '#ECFDF5' },
        { id: '5', title: 'Upcoming Exams',    value: '3',    icon: 'file-document-outline',  color: '#dc2626', bg: '#FEF2F2' },
        { id: '6', title: 'Timetable Slots',   value: '6',    icon: 'timetable',              color: '#7c3aed', bg: '#F5F3FF' },
      ];
      case 'principal': return [
        { id: '1', title: 'Total Staff',       value: '48',   icon: 'account-tie',            color: '#059669', bg: '#ECFDF5' },
        { id: '2', title: 'Total Students',    value: '850',  icon: 'account-group',          color: '#0891b2', bg: '#ECFEFF' },
        { id: '3', title: 'Pending Approvals', value: '7',    icon: 'clipboard-check',        color: '#d97706', bg: '#FFFBEB' },
        { id: '4', title: 'Attendance Rate',   value: '92%',  icon: 'chart-line',             color: '#1e3a8a', bg: '#EFF6FF' },
      ];
      case 'accountant': return [
        { id: '1', title: 'Fees Collected',    value: '₹2.4L', icon: 'cash-multiple',         color: '#059669', bg: '#ECFDF5' },
        { id: '2', title: 'Pending Fees',      value: '₹85K',  icon: 'cash-clock',            color: '#d97706', bg: '#FFFBEB' },
        { id: '3', title: 'Due Today',         value: '23',    icon: 'alert-circle-outline',  color: '#dc2626', bg: '#FEF2F2' },
        { id: '4', title: 'This Month',        value: '156',   icon: 'check-circle-outline',  color: '#0891b2', bg: '#ECFEFF' },
      ];
      default: return [
        { id: '1', title: 'Tasks Today',       value: '8',    icon: 'clipboard-list',         color: '#1e3a8a', bg: '#EFF6FF' },
        { id: '2', title: 'Completed',         value: '5',    icon: 'check-circle-outline',   color: '#059669', bg: '#ECFDF5' },
        { id: '3', title: 'Pending',           value: '3',    icon: 'clock-outline',          color: '#d97706', bg: '#FFFBEB' },
        { id: '4', title: 'Attendance',        value: '100%', icon: 'calendar-check-outline', color: '#7c3aed', bg: '#F5F3FF' },
      ];
    }
  };

  const getQuickActionsForRole = (role: string): QuickAction[] => {
    switch (role) {
      case 'teacher': return [
        { id: '1', title: 'Attendance',  icon: 'calendar-check',      color: '#1e3a8a', route: 'Attendance' },
        { id: '2', title: 'Homework',    icon: 'clipboard-text',      color: '#d97706', route: 'Homework' },
        { id: '3', title: 'Timetable',   icon: 'timetable',           color: '#7c3aed', route: 'Timetable' },
        { id: '4', title: 'Exams',       icon: 'file-document-edit',  color: '#dc2626', route: 'Exam' },
        { id: '5', title: 'My Attendance',  icon: 'google-classroom',    color: '#0891b2', route: 'MyAttendance'},
        // { id: '6', title: 'Students',    icon: 'account-group',       color: '#059669', route: 'Students' },
        // { id: '7', title: 'Marks Entry', icon: 'pencil-box-multiple', color: '#6366f1', route: 'Marks' },
        { id: '8', title: 'My Profile',  icon: 'account-circle',      color: '#64748b', route: 'Profile' },
      ];
      case 'principal': return [
        { id: '1', title: 'Approvals',   icon: 'clipboard-check', color: '#d97706', route: 'Approvals' },
        { id: '2', title: 'Staff',       icon: 'account-tie',     color: '#1e3a8a', route: 'Staff' },
        { id: '3', title: 'Reports',     icon: 'chart-bar',       color: '#059669', route: 'Reports' },
        { id: '4', title: 'Attendance',  icon: 'calendar-check',  color: '#0891b2', route: 'Attendance' },
        { id: '5', title: 'Announce',    icon: 'bullhorn',        color: '#dc2626', route: 'Announcements' },
        { id: '6', title: 'My Profile',  icon: 'account-circle',  color: '#64748b', route: 'Profile' },
      ];
      default: return [
        { id: '1', title: 'Attendance',  icon: 'calendar-check', color: '#1e3a8a', route: 'Attendance' },
        { id: '2', title: 'My Profile',  icon: 'account-circle', color: '#64748b', route: 'Profile' },
      ];
    }
  };

  const getUpcomingItemsForRole = (role: string): UpcomingItem[] => {
    switch (role) {
      case 'teacher': return [
        { id: '1', title: 'Class 10-A Science',     subtitle: 'Physics Chapter 5',       time: '9:00 AM',  icon: 'google-classroom',        color: '#1e3a8a' },
        { id: '2', title: 'Review Homework',        subtitle: 'Class 9-B Chemistry',     time: '2:00 PM',  icon: 'clipboard-check-outline', color: '#d97706' },
        { id: '3', title: 'Parent Meeting',         subtitle: 'Student: Rahul Sharma',   time: '4:30 PM',  icon: 'account-group',           color: '#059669' },
      ];
      case 'principal': return [
        { id: '1', title: 'Staff Meeting',          subtitle: 'Monthly Review',          time: '10:00 AM', icon: 'account-tie',             color: '#7c3aed' },
        { id: '2', title: 'Approve Leave Requests', subtitle: '5 pending approvals',     time: '12:00 PM', icon: 'clipboard-check',         color: '#d97706' },
      ];
      case 'accountant': return [
        { id: '1', title: 'Fee Collection Drive',   subtitle: 'Class 1–5 Parents',       time: '9:00 AM',  icon: 'cash-multiple',           color: '#059669' },
        { id: '2', title: 'Salary Disbursement',    subtitle: 'Month: January',          time: '11:00 AM', icon: 'account-cash',            color: '#0891b2' },
      ];
      default: return [
        { id: '1', title: 'Daily Tasks',            subtitle: 'Complete assigned work',  time: '9:00 AM',  icon: 'clipboard-list',          color: '#1e3a8a' },
      ];
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserDataAndFetchDashboard();
    setRefreshing(false);
  };

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const renderStatCard = (card: StatCard) => (
    <TouchableOpacity key={card.id} style={styles.statCard} activeOpacity={0.75}>
      <View style={[styles.statIconWrap, { backgroundColor: card.bg }]}>
        <Icon name={card.icon} size={20} color={card.color} />
      </View>
      <Text style={styles.statValue}>{card.value}</Text>
      <Text style={styles.statLabel}>{card.title}</Text>
    </TouchableOpacity>
  );

  const renderQuickAction = (action: QuickAction) => (
    <TouchableOpacity key={action.id} style={styles.qaCard} activeOpacity={0.75}
      onPress={() => Navigation.navigate(action.route as never)}
    >
      <View style={[styles.qaIconWrap, { backgroundColor: action.color + '18' }]}>
        <Icon name={action.icon} size={22} color={action.color} />
      </View>
      <Text style={styles.qaLabel}>{action.title}</Text>
    </TouchableOpacity>
  );

  const renderUpcomingItem = (item: UpcomingItem, index: number, arr: UpcomingItem[]) => (
    <View key={item.id} style={[styles.listRow, index === arr.length - 1 && { borderBottomWidth: 0 }]}>
      <View style={[styles.listIconWrap, { backgroundColor: item.color + '18' }]}>
        <Icon name={item.icon} size={18} color={item.color} />
      </View>
      <View style={styles.listContent}>
        <Text style={styles.listTitle}>{item.title}</Text>
        <Text style={styles.listSubtitle}>{item.subtitle}</Text>
      </View>
      <View style={[styles.timeBadge, { backgroundColor: item.color + '18' }]}>
        <Text style={[styles.timeBadgeText, { color: item.color }]}>{item.time}</Text>
      </View>
    </View>
  );

  const renderScheduleItem = (item: ScheduleItem, index: number, arr: ScheduleItem[]) => (
    <View key={index} style={[styles.listRow, index === arr.length - 1 && { borderBottomWidth: 0 }]}>
      <View style={styles.scheduleLeft}>
        <View style={styles.periodDot} />
        <View>
          <Text style={styles.listTitle}>{item.period}</Text>
          <Text style={styles.listSubtitle}>{item.time}</Text>
        </View>
      </View>
      <View style={styles.scheduleRight}>
        <Text style={styles.scheduleSubject}>{item.subject}</Text>
        <Text style={styles.scheduleClass}>{item.class}</Text>
      </View>
    </View>
  );

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading || !currentUser) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  const quickActions = getQuickActionsForRole(currentUser.staffType);
  const todaySchedule: ScheduleItem[] = dashboardData?.todaySchedule || [];
  const isTeacher = currentUser.staffType === 'teacher';

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#1e3a8a']}
          tintColor="#1e3a8a"
        />
      }
    >
      {/* ── Hero Banner ──────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <View style={styles.heroInner}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroGreeting}>{greeting} 👋</Text>
            <Text style={styles.heroName}>{currentUser.firstName}</Text>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Icon name="briefcase-outline" size={11} color="#bfdbfe" />
                <Text style={styles.heroBadgeText}>{currentUser.designation}</Text>
              </View>
              <View style={styles.heroBadgeDivider} />
              <View style={styles.heroBadge}>
                <Icon name="card-account-details-outline" size={11} color="#bfdbfe" />
                <Text style={styles.heroBadgeText}>{currentUser.employeeId}</Text>
              </View>
            </View>
          </View>

          {currentUser.photo_url ? (
            <Image source={{ uri: currentUser.photo_url }} style={styles.heroAvatar} />
          ) : (
            <View style={styles.heroAvatarFallback}>
              <Text style={styles.heroAvatarInitials}>
                {currentUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.dateBanner}>
          <Icon name="calendar-today" size={13} color="#93c5fd" />
          <Text style={styles.dateBannerText}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* ── Stats Grid ───────────────────────────────────────────────────── */}
      {dashboardData?.stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            {dashboardData.stats.map(renderStatCard)}
          </View>
        </View>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.qaScroll}>
          {quickActions.map(renderQuickAction)}
        </ScrollView>
      </View>

      {/* ── Today's Schedule (Teacher only) ──────────────────────────────── */}
      {isTeacher && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => Navigation.navigate('Timetable' as never)}>
              <Text style={styles.seeAllText}>Full Timetable</Text>
              <Icon name="chevron-right" size={15} color="#1e3a8a" />
            </TouchableOpacity>
          </View>
          {todaySchedule.length > 0 ? (
            <View style={styles.card}>
              {todaySchedule.map((item, i, arr) => renderScheduleItem(item, i, arr))}
            </View>
          ) : (
            <View style={[styles.card, styles.emptyCard]}>
              <Icon name="calendar-blank-outline" size={32} color="#cbd5e1" />
              <Text style={styles.emptyText}>No classes scheduled today</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Upcoming Tasks / Exams ────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{isTeacher ? 'Upcoming Exams' : 'Upcoming Tasks'}</Text>
          <TouchableOpacity style={styles.seeAll} >
            <Text style={styles.seeAllText}>View All</Text>
            <Icon name="chevron-right" size={15} color="#1e3a8a" />
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {(dashboardData?.upcomingItems || []).map((item: UpcomingItem, i: number, arr: UpcomingItem[]) =>
            renderUpcomingItem(item, i, arr)
          )}
        </View>
      </View>

      {/* ── Announcements ─────────────────────────────────────────────────── */}
      {dashboardData?.announcements?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => Navigation.navigate('Announcements' as never)}>
              <Text style={styles.seeAllText}>See All</Text>
              <Icon name="chevron-right" size={15} color="#1e3a8a" />
            </TouchableOpacity>
          </View>
          {dashboardData.announcements.map((item: any) => (
            <TouchableOpacity key={item.id} style={styles.announcementCard} activeOpacity={0.8} >
              <View style={[
                styles.announcementDot,
                { backgroundColor: item.priority === 'High' ? '#dc2626' : item.priority === 'Medium' ? '#d97706' : '#059669' }
              ]} />
              <View style={styles.announcementBody}>
                <Text style={styles.announcementTitle}>{item.title}</Text>
                <Text style={styles.announcementMeta}>
                  {item.category} · {new Date(item.posted_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  scroll: {},

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b', fontWeight: '500' },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: '#1e3a8a',
    paddingBottom: 0,
    paddingHorizontal: 20,
  },
  heroInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16 },
  heroLeft: { flex: 1, paddingRight: 12 },
  heroGreeting: { fontSize: 13, color: '#93c5fd', fontWeight: '500', marginBottom: 4 },
  heroName: { fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, marginBottom: 8 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroBadgeText: { fontSize: 11, color: '#bfdbfe', fontWeight: '500' },
  heroBadgeDivider: { width: 1, height: 10, backgroundColor: '#3b5fc0', marginHorizontal: 2 },

  heroAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.3)' },
  heroAvatarFallback: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2d4fa1',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  heroAvatarInitials: { fontSize: 20, fontWeight: '800', color: '#ffffff' },

  dateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  dateBannerText: { fontSize: 12, color: '#93c5fd', fontWeight: '500' },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12, letterSpacing: -0.2 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 13, color: '#1e3a8a', fontWeight: '600' },

  // ── Stat Cards ────────────────────────────────────────────────────────────
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 3, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '500', lineHeight: 16 },

  // ── Quick Actions ─────────────────────────────────────────────────────────
  qaScroll: { paddingRight: 16, gap: 10 },
  qaCard: { width: 76, alignItems: 'center', gap: 8 },
  qaIconWrap: { width: 54, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  qaLabel: { fontSize: 11, color: '#334155', textAlign: 'center', fontWeight: '600', lineHeight: 14 },

  // ── Card (generic) ────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyCard: { paddingVertical: 28, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  // ── List Row ─────────────────────────────────────────────────────────────
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  listIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  listContent: { flex: 1 },
  listTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
  listSubtitle: { fontSize: 12, color: '#64748b', fontWeight: '400' },
  timeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  timeBadgeText: { fontSize: 11, fontWeight: '700' },

  // ── Schedule Row ──────────────────────────────────────────────────────────
  scheduleLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  periodDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1e3a8a' },
  scheduleRight: { alignItems: 'flex-end' },
  scheduleSubject: { fontSize: 14, fontWeight: '700', color: '#1e3a8a', marginBottom: 2 },
  scheduleClass: { fontSize: 12, color: '#64748b' },

  // ── Announcements ─────────────────────────────────────────────────────────
  announcementCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  announcementDot: { width: 10, height: 10, borderRadius: 5 },
  announcementBody: { flex: 1 },
  announcementTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 3 },
  announcementMeta: { fontSize: 12, color: '#94a3b8' },
}); 