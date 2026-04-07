import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../services/supabase';

interface Period {
  id: string;
  period_number: number;
  start_time: string;
  end_time: string;
}

interface Grade {
  grade: string;
}

interface Section {
  section: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Class {
  id: string;
  room_number: string;
  grades?: Grade;
  sections?: Section;
}

interface TimetableEntry {
  id: string;
  day: string;
  periods?: Period;
  classes?: Class;
  subjects?: Subject;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUBJECT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
];

export default function TimetablePage({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [timetableData, setTimetableData] = useState<TimetableEntry[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDayPicker, setShowDayPicker] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const dayIndex = new Date().getDay();
    setSelectedDay(dayIndex === 0 ? 'Monday' : DAYS_OF_WEEK[dayIndex - 1]);
    fetchStaffId();
  }, []);

  useEffect(() => {
    if (staffId && selectedDay) fetchTimetable();
  }, [staffId, selectedDay]);

  const fetchStaffId = async () => {
    try {
      const storedStaffId = await AsyncStorage.getItem('staffId');
      if (storedStaffId) {
        setStaffId(storedStaffId);
      } else {
        Alert.alert('Error', 'Staff ID not found. Please login again.');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching staff ID:', error);
      Alert.alert('Error', 'Failed to load staff data');
    }
  };

  const fetchTimetable = async () => {
    if (!staffId || !selectedDay) return;
    try {
      setLoading(true);

      const { data: periodsData, error: periodsError } = await supabase
        .from('periods').select('*').order('period_number', { ascending: true });
      if (periodsError) throw periodsError;
      setPeriods(periodsData || []);

      const { data: timetableData, error: timetableError } = await supabase
        .from('timetable')
        .select(`
          id, day,
          periods!timetable_period_id_fkey(id, period_number, start_time, end_time),
          classes!timetable_class_id_fkey(id, room_number, grades!classes_grade_id_fkey(grade), sections!classes_section_id_fkey(section)),
          subjects!timetable_subject_id_fkey(id, name, code)
        `)
        .eq('staff_id', staffId)
        .eq('day', selectedDay)
        .order('period_id', { ascending: true });

      if (timetableError) throw timetableError;

      const transformedData = (timetableData || []).map(entry => ({
        ...entry,
        period: entry.periods,
        class: { ...entry.classes, grade: entry.classes?.grades, section: entry.classes?.sections },
        subject: entry.subjects,
      }));

      setTimetableData(transformedData as any);
    } catch (error) {
      console.error('Error fetching timetable:', error);
      Alert.alert('Error', 'Failed to load timetable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTimetable();
    setRefreshing(false);
  }, [staffId, selectedDay]);

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getCurrentPeriod = () => {
    const now = currentTime;
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    return timetableData.find((entry: any) => {
      const s = entry.period?.start_time;
      const e = entry.period?.end_time;
      return currentTimeStr >= s && currentTimeStr <= e;
    });
  };

  const isCurrentPeriod = (entry: any) => getCurrentPeriod()?.id === entry.id;

  const isPastPeriod = (entry: any) => {
    const now = currentTime;
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    return currentTimeStr > entry.period?.end_time;
  };

  const getNextPeriod = () => {
    const now = currentTime;
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    return timetableData.find((entry: any) => currentTimeStr < entry.period?.start_time);
  };

  const getSubjectColor = (index: number) => SUBJECT_COLORS[index % SUBJECT_COLORS.length];

  const getTodayDayName = () => {
    const dayIndex = new Date().getDay();
    return dayIndex === 0 ? 'Monday' : DAYS_OF_WEEK[dayIndex - 1];
  };

  const getTodayStats = () => {
    const total = timetableData.length;
    const completed = timetableData.filter((entry: any) => isPastPeriod(entry)).length;
    const current = getCurrentPeriod() ? 1 : 0;
    const upcoming = total - completed - current;
    return { total, completed, current, upcoming };
  };

  const calculateProgress = (startTime: string, endTime: string): number => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const total = eh * 60 + em - (sh * 60 + sm);
    const elapsed = currentMinutes - (sh * 60 + sm);
    return Math.round(Math.min(Math.max((elapsed / total) * 100, 0), 100));
  };

  const isToday = selectedDay === getTodayDayName();

  if (loading) {
    return (
      <View style={[S.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={S.loadingText}>Loading timetable...</Text>
      </View>
    );
  }

  const stats = getTodayStats();
  const nextPeriod = getNextPeriod();

  return (
    <View style={S.container}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[S.header, { paddingTop: insets.top + 16 }]}>
        <View style={S.headerTop}>
          <View style={S.headerTextContainer}>
            <Text style={S.headerTitle}>
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            <Text style={S.headerSubtitle}>Timetable</Text>
          </View>

          <TouchableOpacity style={S.dayPickerButton} onPress={() => setShowDayPicker(true)}>
            <View style={S.dayPickerContent}>
              <Text style={S.dayPickerLabel}>Day</Text>
              <View style={S.dayPickerDayContainer}>
                <Text style={S.dayPickerDay}>{selectedDay}</Text>
                {isToday && <View style={S.todayIndicator} />}
              </View>
            </View>
            <Icon name="chevron-down" size={20} color="#E0E7FF" />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={S.statsContainer}>
          {[
            { value: stats.total,     label: 'Total',   color: '#FFFFFF',  bg: 'rgba(255,255,255,0.2)' },
            { value: stats.completed, label: 'Done',    color: '#4CAF50',  bg: 'rgba(76,175,80,0.2)' },
            { value: stats.current,   label: 'Now',     color: '#2196F3',  bg: 'rgba(33,150,243,0.2)' },
            { value: stats.upcoming,  label: 'Left',    color: '#FF9800',  bg: 'rgba(255,152,0,0.2)' },
          ].map(s => (
            <View key={s.label} style={[S.statBox, { backgroundColor: s.bg }]}>
              <Text style={[S.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={S.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Next Class Banner ───────────────────────────────────────── */}
      {nextPeriod && isToday && (
        <View style={S.nextClassAlert}>
          <Icon name="clock-outline" size={18} color="#1E3A8A" />
          <Text style={S.nextClassText}>
            Next: {(nextPeriod as any).subject?.name} at {formatTime((nextPeriod as any).period?.start_time)}
          </Text>
        </View>
      )}

      {/* ── Period List ─────────────────────────────────────────────── */}
      <ScrollView
        style={S.timetableContainer}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E3A8A']} tintColor="#1E3A8A" />
        }
        showsVerticalScrollIndicator={false}
      >
        {timetableData.length === 0 ? (
          <View style={S.emptyContainer}>
            <Icon name="calendar-blank" size={72} color="#CBD5E1" />
            <Text style={S.emptyText}>No classes on {selectedDay}</Text>
            <Text style={S.emptySubtext}>Enjoy your free day!</Text>
          </View>
        ) : (
          timetableData.map((entry: any, index) => {
            const isCurrent = isCurrentPeriod(entry);
            const isPast = isPastPeriod(entry);
            const subjectColor = getSubjectColor(index);

            return (
              <View
                key={entry.id}
                style={[S.periodCard, isCurrent && S.currentPeriodCard, isPast && S.pastPeriodCard]}
              >
                <View style={[S.colorBar, { backgroundColor: isPast ? '#9E9E9E' : isCurrent ? '#4CAF50' : subjectColor }]} />

                <View style={S.periodContent}>
                  {/* Header row */}
                  <View style={S.periodHeader}>
                    <View style={S.periodNumberContainer}>
                      <View style={[S.periodBadge, { backgroundColor: subjectColor }]}>
                        <Text style={S.periodBadgeText}>P{entry.period?.period_number}</Text>
                      </View>
                      {isCurrent && (
                        <View style={S.currentBadge}>
                          <Text style={S.currentBadgeText}>ONGOING</Text>
                        </View>
                      )}
                      {isPast && (
                        <View style={S.pastBadge}>
                          <Icon name="check" size={12} color="#FFF" />
                        </View>
                      )}
                    </View>
                    <View style={S.timeContainer}>
                      <Icon name="clock-outline" size={15} color="#64748B" />
                      <Text style={S.timeText}>
                        {formatTime(entry.period?.start_time)} – {formatTime(entry.period?.end_time)}
                      </Text>
                    </View>
                  </View>

                  {/* Subject */}
                  <View style={S.subjectSection}>
                    <Text style={S.subjectName}>{entry.subject?.name}</Text>
                    {entry.subject?.code && (
                      <Text style={S.subjectCode}>({entry.subject?.code})</Text>
                    )}
                  </View>

                  {/* Details */}
                  <View style={S.detailsSection}>
                    <View style={S.detailItem}>
                      <Icon name="google-classroom" size={15} color="#64748B" />
                      <Text style={S.detailText}>
                        Class {entry.class?.grade?.grade} – {entry.class?.section?.section}
                      </Text>
                    </View>
                    {entry.class?.room_number && (
                      <View style={S.detailItem}>
                        <Icon name="door" size={15} color="#64748B" />
                        <Text style={S.detailText}>Room {entry.class?.room_number}</Text>
                      </View>
                    )}
                  </View>

                  {/* Progress (current only) */}
                  {isCurrent && (
                    <View style={S.progressContainer}>
                      <View style={S.progressBar}>
                        <View style={[S.progressFill, { width: `${calculateProgress(entry.period?.start_time, entry.period?.end_time)}%` as any }]} />
                      </View>
                      <Text style={S.progressText}>
                        {calculateProgress(entry.period?.start_time, entry.period?.end_time)}% complete
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Day Picker Modal ────────────────────────────────────────── */}
      <Modal
        visible={showDayPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDayPicker(false)}
      >
        <TouchableOpacity style={S.modalOverlay} activeOpacity={1} onPress={() => setShowDayPicker(false)}>
          <View style={[S.modalContent, { paddingBottom: insets.bottom + 8 }]}>
            <View style={S.modalHandle} />
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Select Day</Text>
              <TouchableOpacity onPress={() => setShowDayPicker(false)} style={S.modalClose}>
                <Icon name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={S.dayListContainer}>
              {DAYS_OF_WEEK.map(day => {
                const isDayToday = day === getTodayDayName();
                const isSelected = day === selectedDay;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[S.dayOption, isSelected && S.dayOptionSelected]}
                    onPress={() => { setSelectedDay(day); setShowDayPicker(false); }}
                  >
                    <View style={S.dayOptionContent}>
                      <View>
                        <Text style={[S.dayOptionText, isSelected && S.dayOptionTextSelected]}>{day}</Text>
                        {isDayToday && <Text style={S.todayLabel}>Today</Text>}
                      </View>
                      {isSelected && <Icon name="check-circle" size={22} color="#1E3A8A" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#64748B', fontWeight: '500' },

  // Header
  header: {
    backgroundColor: '#1E3A8A',
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 2, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, color: '#E0E7FF', fontWeight: '500' },

  dayPickerButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dayPickerContent: { alignItems: 'flex-end' },
  dayPickerLabel: { fontSize: 10, color: '#E0E7FF', fontWeight: '500', marginBottom: 2 },
  dayPickerDayContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayPickerDay: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
  todayIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },

  statsContainer: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 3 },
  statLabel: { fontSize: 11, color: '#E0E7FF', fontWeight: '500' },

  // Next class
  nextClassAlert: {
    backgroundColor: '#DBEAFE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 8,
  },
  nextClassText: { fontSize: 13, color: '#1E3A8A', fontWeight: '600', flex: 1 },

  // List
  timetableContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  emptyContainer: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 17, color: '#475569', textAlign: 'center', fontWeight: '600', marginTop: 8 },
  emptySubtext: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  // Period card
  periodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  currentPeriodCard: { backgroundColor: '#F0FDF4', elevation: 4, shadowOpacity: 0.12 },
  pastPeriodCard: { opacity: 0.6 },
  colorBar: { width: 5 },

  periodContent: { flex: 1, padding: 14 },
  periodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  periodNumberContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  periodBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  currentBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  currentBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  pastBadge: { backgroundColor: '#4CAF50', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  timeContainer: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 12, color: '#64748B', fontWeight: '600' },

  subjectSection: { marginBottom: 10 },
  subjectName: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  subjectCode: { fontSize: 12, color: '#64748B', fontWeight: '500' },

  detailsSection: { flexDirection: 'row', gap: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { fontSize: 12, color: '#64748B', fontWeight: '500' },

  progressContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  progressBar: { height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 3 },
  progressText: { fontSize: 11, color: '#4CAF50', fontWeight: '600', textAlign: 'right' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  modalClose: { padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  dayListContainer: { paddingHorizontal: 16, paddingTop: 8 },
  dayOption: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginVertical: 3, backgroundColor: '#F8FAFC' },
  dayOptionSelected: { backgroundColor: '#DBEAFE' },
  dayOptionContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayOptionText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  dayOptionTextSelected: { color: '#1E3A8A' },
  todayLabel: { fontSize: 11, color: '#10B981', fontWeight: '600', marginTop: 1 },
});