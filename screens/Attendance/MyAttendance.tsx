import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';

interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  check_out_time: string | null;
  remarks: string | null;
}

interface MonthSummary {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  percentage: number;
}

interface MonthGroup {
  label: string;       // "April 2025"
  key: string;         // "2025-04"
  records: AttendanceRecord[];
  summary: MonthSummary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<AttendanceStatus, { label: string; color: string; bg: string; icon: string }> = {
  present:   { label: 'Present',   color: '#059669', bg: '#ECFDF5', icon: 'check-circle-outline' },
  absent:    { label: 'Absent',    color: '#dc2626', bg: '#FEF2F2', icon: 'close-circle-outline' },
  late:      { label: 'Late',      color: '#d97706', bg: '#FFFBEB', icon: 'clock-alert-outline' },
  half_day:  { label: 'Half Day',  color: '#0891b2', bg: '#ECFEFF', icon: 'circle-half-full' },
  on_leave:  { label: 'On Leave',  color: '#7c3aed', bg: '#F5F3FF', icon: 'calendar-remove-outline' },
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTHS[parseInt(month) - 1]} ${year}`;
}

function buildSummary(records: AttendanceRecord[]): MonthSummary {
  const s: MonthSummary = { totalDays: records.length, present: 0, absent: 0, late: 0, halfDay: 0, onLeave: 0, percentage: 0 };
  records.forEach(r => {
    if (r.status === 'present')  s.present++;
    if (r.status === 'absent')   s.absent++;
    if (r.status === 'late')     s.late++;
    if (r.status === 'half_day') s.halfDay++;
    if (r.status === 'on_leave') s.onLeave++;
  });
  const effectivePresent = s.present + s.late + s.halfDay * 0.5;
  const denominator = s.totalDays - s.onLeave;
  s.percentage = denominator > 0 ? Math.round((effectivePresent / denominator) * 100) : 0;
  return s;
}

function groupByMonth(records: AttendanceRecord[]): MonthGroup[] {
  const map = new Map<string, AttendanceRecord[]>();
  records.forEach(r => {
    const key = getMonthKey(r.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, recs]) => ({
      key,
      label: getMonthLabel(key),
      records: recs.sort((a, b) => b.date.localeCompare(a.date)),
      summary: buildSummary(recs),
    }));
}

// ─── Gauge Component ──────────────────────────────────────────────────────────

function AttendanceGauge({ percentage }: { percentage: number }) {
  const radius = 52;
  const stroke = 8;
  const normalizedR = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedR;
  const progress = (percentage / 100) * circumference;

  const color = percentage >= 85 ? '#34d399' : percentage >= 70 ? '#fbbf24' : '#f87171';

  return (
    <View style={gaugeStyles.container}>
      {/* Background circle via border */}
      <View style={[gaugeStyles.track, { width: radius * 2, height: radius * 2, borderRadius: radius, borderColor: 'rgba(255,255,255,0.12)' }]} />
      {/* We'll use a simpler visual since SVG isn't straightforward in RN without react-native-svg */}
      <View style={gaugeStyles.inner}>
        <Text style={[gaugeStyles.value, { color }]}>{percentage}%</Text>
        <Text style={gaugeStyles.label}>Attendance</Text>
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', width: 110, height: 110 },
  track: {
    position: 'absolute',
    borderWidth: 8,
  },
  inner: { alignItems: 'center' },
  value: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MyAttendanceScreen() {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);
  const [overallSummary, setOverallSummary] = useState<MonthSummary | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // ── Filter State ──────────────────────────────────────────────────────────
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | 'all'>('all');

  useEffect(() => {
    loadAndFetch();
  }, []);

  const loadAndFetch = async () => {
    try {
      setLoading(true);
      const [userDataStr, staffIdStr] = await AsyncStorage.multiGet(['userData', 'staffId']);
      const userData = userDataStr[1] ? JSON.parse(userDataStr[1]) : null;
      const sid = staffIdStr[1] || userData?.staff?.id;

      if (!sid) {
        Alert.alert('Error', 'Staff profile not found. Please login again.');
        return;
      }

      const name = userData ? `${userData.first_name} ${userData.last_name}` : 'Staff';
      setStaffId(sid);
      setStaffName(name);
      await fetchAttendance(sid);
    } catch (e) {
      console.error('loadAndFetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async (sid: string) => {
    try {
      // Fetch last 12 months of attendance
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 11);
      fromDate.setDate(1);
      const fromStr = fromDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('staff_attendance')
        .select('id, date, status, check_in_time, check_out_time, remarks')
        .eq('staff_id', sid)
        .gte('date', fromStr)
        .order('date', { ascending: false });

      if (error) throw error;

      const allRecords: AttendanceRecord[] = data || [];
      setRecords(allRecords);
      setMonthGroups(groupByMonth(allRecords));
      setOverallSummary(buildSummary(allRecords));

      // Auto-expand current month
      const currentKey = new Date().toISOString().slice(0, 7);
      setExpandedMonth(currentKey);
    } catch (e) {
      console.error('fetchAttendance error:', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (staffId) await fetchAttendance(staffId);
    setRefreshing(false);
  }, [staffId]);

  // ── Filtered records ──────────────────────────────────────────────────────
  const filteredGroups = monthGroups.map(g => ({
    ...g,
    records: selectedStatus === 'all' ? g.records : g.records.filter(r => r.status === selectedStatus),
  })).filter(g => g.records.length > 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading attendance…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} tintColor="#1e3a8a" />
        }
      >
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          <View style={styles.heroInner}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroEyebrow}>MY ATTENDANCE</Text>
              <Text style={styles.heroName}>{staffName}</Text>
              <Text style={styles.heroSub}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>

              {/* Overall pills */}
              {overallSummary && (
                <View style={styles.heroPills}>
                  <View style={styles.heroPill}>
                    <Icon name="check-circle-outline" size={12} color="#34d399" />
                    <Text style={styles.heroPillText}>{overallSummary.present} Present</Text>
                  </View>
                  <View style={styles.heroPill}>
                    <Icon name="close-circle-outline" size={12} color="#f87171" />
                    <Text style={styles.heroPillText}>{overallSummary.absent} Absent</Text>
                  </View>
                  <View style={styles.heroPill}>
                    <Icon name="clock-alert-outline" size={12} color="#fbbf24" />
                    <Text style={styles.heroPillText}>{overallSummary.late} Late</Text>
                  </View>
                </View>
              )}
            </View>

            {overallSummary && <AttendanceGauge percentage={overallSummary.percentage} />}
          </View>

          {/* ── Summary Bar ──────────────────────────────────────────────── */}
          {overallSummary && (
            <View style={styles.summaryBar}>
              {[
                { label: 'Present',  value: overallSummary.present,  color: '#34d399' },
                { label: 'Absent',   value: overallSummary.absent,   color: '#f87171' },
                { label: 'Late',     value: overallSummary.late,     color: '#fbbf24' },
                { label: 'Half Day', value: overallSummary.halfDay,  color: '#38bdf8' },
                { label: 'On Leave', value: overallSummary.onLeave,  color: '#c084fc' },
              ].map((s, i, arr) => (
                <View key={s.label} style={[styles.summaryItem, i < arr.length - 1 && styles.summaryItemBorder]}>
                  <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.summaryLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Progress Visual ───────────────────────────────────────────────── */}
        {overallSummary && overallSummary.totalDays > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last 12 Months Overview</Text>
            <View style={styles.progressCard}>
              <View style={styles.progressBarRow}>
                {[
                  { key: 'present', value: overallSummary.present, color: '#059669' },
                  { key: 'late',    value: overallSummary.late,    color: '#d97706' },
                  { key: 'half',    value: overallSummary.halfDay, color: '#0891b2' },
                  { key: 'leave',   value: overallSummary.onLeave, color: '#7c3aed' },
                  { key: 'absent',  value: overallSummary.absent,  color: '#dc2626' },
                ].map(s => {
                  const pct = (s.value / overallSummary.totalDays) * 100;
                  return pct > 0 ? (
                    <View key={s.key} style={[styles.progressSegment, { flex: pct, backgroundColor: s.color }]} />
                  ) : null;
                })}
              </View>
              <View style={styles.progressLegend}>
                {(Object.keys(STATUS_META) as AttendanceStatus[]).map(k => (
                  <View key={k} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: STATUS_META[k].color }]} />
                    <Text style={styles.legendText}>{STATUS_META[k].label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Filter Chips ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {(['all', ...Object.keys(STATUS_META)] as Array<AttendanceStatus | 'all'>).map(k => {
              const isAll = k === 'all';
              const active = selectedStatus === k;
              const meta = isAll ? null : STATUS_META[k as AttendanceStatus];
              return (
                <TouchableOpacity
                  key={k}
                  style={[
                    styles.chip,
                    active && { backgroundColor: meta ? meta.color : '#1e3a8a', borderColor: meta ? meta.color : '#1e3a8a' },
                  ]}
                  onPress={() => setSelectedStatus(k)}
                  activeOpacity={0.75}
                >
                  {meta && <Icon name={meta.icon} size={13} color={active ? '#fff' : meta.color} style={{ marginRight: 4 }} />}
                  <Text style={[styles.chipText, active && { color: '#fff' }]}>
                    {isAll ? 'All Records' : meta!.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Monthly Groups ────────────────────────────────────────────────── */}
        {filteredGroups.length === 0 ? (
          <View style={[styles.section, styles.emptyWrap]}>
            <Icon name="calendar-blank-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptySubtitle}>No attendance data matches the selected filter.</Text>
          </View>
        ) : (
          filteredGroups.map(group => {
            const isExpanded = expandedMonth === group.key;
            return (
              <View key={group.key} style={styles.section}>
                {/* Month Header */}
                <TouchableOpacity
                  style={styles.monthHeader}
                  onPress={() => setExpandedMonth(isExpanded ? null : group.key)}
                  activeOpacity={0.8}
                >
                  <View style={styles.monthHeaderLeft}>
                    <View style={styles.monthIconWrap}>
                      <Icon name="calendar-month" size={16} color="#1e3a8a" />
                    </View>
                    <View>
                      <Text style={styles.monthLabel}>{group.label}</Text>
                      <Text style={styles.monthMeta}>{group.records.length} records · {group.summary.percentage}% attendance</Text>
                    </View>
                  </View>
                  <View style={styles.monthHeaderRight}>
                    <View style={[
                      styles.monthBadge,
                      {
                        backgroundColor: group.summary.percentage >= 85 ? '#ECFDF5' : group.summary.percentage >= 70 ? '#FFFBEB' : '#FEF2F2',
                      }
                    ]}>
                      <Text style={[
                        styles.monthBadgeText,
                        { color: group.summary.percentage >= 85 ? '#059669' : group.summary.percentage >= 70 ? '#d97706' : '#dc2626' }
                      ]}>
                        {group.summary.percentage}%
                      </Text>
                    </View>
                    <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" style={{ marginLeft: 8 }} />
                  </View>
                </TouchableOpacity>

                {/* Month Mini-Summary */}
                {isExpanded && (
                  <View style={styles.monthMiniSummary}>
                    {[
                      { label: 'P', value: group.summary.present,  color: '#059669', bg: '#ECFDF5' },
                      { label: 'A', value: group.summary.absent,   color: '#dc2626', bg: '#FEF2F2' },
                      { label: 'L', value: group.summary.late,     color: '#d97706', bg: '#FFFBEB' },
                      { label: 'H', value: group.summary.halfDay,  color: '#0891b2', bg: '#ECFEFF' },
                      { label: 'OL', value: group.summary.onLeave, color: '#7c3aed', bg: '#F5F3FF' },
                    ].map(s => (
                      <View key={s.label} style={[styles.miniStatBox, { backgroundColor: s.bg }]}>
                        <Text style={[styles.miniStatValue, { color: s.color }]}>{s.value}</Text>
                        <Text style={[styles.miniStatLabel, { color: s.color }]}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Records List */}
                {isExpanded && (
                  <View style={styles.card}>
                    {group.records.map((rec, i, arr) => {
                      const meta = STATUS_META[rec.status];
                      const isLast = i === arr.length - 1;
                      return (
                        <TouchableOpacity
                          key={rec.id}
                          style={[styles.attendanceRow, isLast && { borderBottomWidth: 0 }]}
                          onPress={() => setSelectedRecord(rec)}
                          activeOpacity={0.75}
                        >
                          {/* Date Column */}
                          <View style={styles.dateCol}>
                            <Text style={styles.dateDay}>
                              {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                            </Text>
                            <Text style={styles.dateNum}>
                              {new Date(rec.date).getDate()}
                            </Text>
                          </View>

                          {/* Divider line */}
                          <View style={[styles.rowLine, { backgroundColor: meta.color }]} />

                          {/* Content */}
                          <View style={styles.rowContent}>
                            <View style={styles.rowTop}>
                              <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                                <Icon name={meta.icon} size={12} color={meta.color} />
                                <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                              </View>
                              {rec.remarks ? (
                                <Icon name="information-outline" size={14} color="#94a3b8" />
                              ) : null}
                            </View>
                            {(rec.check_in_time || rec.check_out_time) && (
                              <View style={styles.timeRow}>
                                {rec.check_in_time && (
                                  <View style={styles.timeChip}>
                                    <Icon name="login" size={11} color="#059669" />
                                    <Text style={styles.timeChipText}>{rec.check_in_time.slice(0, 5)}</Text>
                                  </View>
                                )}
                                {rec.check_out_time && (
                                  <View style={styles.timeChip}>
                                    <Icon name="logout" size={11} color="#dc2626" />
                                    <Text style={styles.timeChipText}>{rec.check_out_time.slice(0, 5)}</Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>

                          <Icon name="chevron-right" size={16} color="#e2e8f0" />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      <Modal
        visible={!!selectedRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRecord(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedRecord(null)}>
          <TouchableOpacity style={styles.modalSheet} activeOpacity={1}>
            {/* Handle */}
            <View style={styles.modalHandle} />

            {selectedRecord && (() => {
              const meta = STATUS_META[selectedRecord.status];
              return (
                <>
                  <View style={styles.modalHeader}>
                    <View style={[styles.modalIconBig, { backgroundColor: meta.bg }]}>
                      <Icon name={meta.icon} size={28} color={meta.color} />
                    </View>
                    <Text style={styles.modalDate}>{formatDate(selectedRecord.date)}</Text>
                    <View style={[styles.statusPill, { backgroundColor: meta.bg, alignSelf: 'center', marginTop: 6 }]}>
                      <Icon name={meta.icon} size={13} color={meta.color} />
                      <Text style={[styles.statusPillText, { color: meta.color, fontSize: 13 }]}>{meta.label}</Text>
                    </View>
                  </View>

                  <View style={styles.modalDivider} />

                  <View style={styles.modalDetails}>
                    {selectedRecord.check_in_time && (
                      <View style={styles.modalDetailRow}>
                        <View style={styles.modalDetailIcon}>
                          <Icon name="login" size={16} color="#059669" />
                        </View>
                        <View>
                          <Text style={styles.modalDetailLabel}>Check-In Time</Text>
                          <Text style={styles.modalDetailValue}>{selectedRecord.check_in_time.slice(0, 5)}</Text>
                        </View>
                      </View>
                    )}
                    {selectedRecord.check_out_time && (
                      <View style={styles.modalDetailRow}>
                        <View style={styles.modalDetailIcon}>
                          <Icon name="logout" size={16} color="#dc2626" />
                        </View>
                        <View>
                          <Text style={styles.modalDetailLabel}>Check-Out Time</Text>
                          <Text style={styles.modalDetailValue}>{selectedRecord.check_out_time.slice(0, 5)}</Text>
                        </View>
                      </View>
                    )}
                    {selectedRecord.check_in_time && selectedRecord.check_out_time && (
                      <View style={styles.modalDetailRow}>
                        <View style={styles.modalDetailIcon}>
                          <Icon name="timer-outline" size={16} color="#0891b2" />
                        </View>
                        <View>
                          <Text style={styles.modalDetailLabel}>Duration</Text>
                          <Text style={styles.modalDetailValue}>
                            {(() => {
                              const [ih, im] = selectedRecord.check_in_time.split(':').map(Number);
                              const [oh, om] = selectedRecord.check_out_time.split(':').map(Number);
                              const diff = (oh * 60 + om) - (ih * 60 + im);
                              if (diff <= 0) return '—';
                              return `${Math.floor(diff / 60)}h ${diff % 60}m`;
                            })()}
                          </Text>
                        </View>
                      </View>
                    )}
                    {selectedRecord.remarks && (
                      <View style={styles.modalDetailRow}>
                        <View style={styles.modalDetailIcon}>
                          <Icon name="note-text-outline" size={16} color="#7c3aed" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalDetailLabel}>Remarks</Text>
                          <Text style={[styles.modalDetailValue, { flexWrap: 'wrap' }]}>{selectedRecord.remarks}</Text>
                        </View>
                      </View>
                    )}
                    {!selectedRecord.check_in_time && !selectedRecord.check_out_time && !selectedRecord.remarks && (
                      <View style={styles.modalEmptyWrap}>
                        <Icon name="information-outline" size={28} color="#cbd5e1" />
                        <Text style={styles.modalEmptyText}>No additional details recorded.</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedRecord(null)}>
                    <Text style={styles.modalCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  scroll: {},

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b', fontWeight: '500' },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  heroInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
  },
  heroLeft: { flex: 1, paddingRight: 12 },
  heroEyebrow: { fontSize: 11, color: '#93c5fd', fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  heroName: { fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, marginBottom: 6 },
  heroSub: { fontSize: 12, color: '#93c5fd', fontWeight: '400', marginBottom: 12 },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  heroPillText: { fontSize: 11, color: '#e0f2fe', fontWeight: '600' },

  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)' },
  summaryValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12, letterSpacing: -0.2 },

  // Progress Card
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  progressBarRow: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    marginBottom: 14,
  },
  progressSegment: { height: 10 },
  progressLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  // Filter Chips
  chipRow: { paddingRight: 16, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },

  // Month Header
  monthHeader: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  monthIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  monthLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  monthMeta: { fontSize: 11, color: '#94a3b8', fontWeight: '400', marginTop: 2 },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  monthBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  monthBadgeText: { fontSize: 12, fontWeight: '800' },

  // Mini Summary
  monthMiniSummary: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    marginTop: 8,
  },
  miniStatBox: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  miniStatValue: { fontSize: 16, fontWeight: '800' },
  miniStatLabel: { fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // Attendance Row
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  dateCol: { width: 40, alignItems: 'center' },
  dateDay: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateNum: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginTop: 2 },
  rowLine: { width: 3, height: 40, borderRadius: 2 },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  timeRow: { flexDirection: 'row', gap: 8 },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  timeChipText: { fontSize: 11, color: '#475569', fontWeight: '600' },

  // Empty State
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#94a3b8' },
  emptySubtitle: { fontSize: 13, color: '#cbd5e1', textAlign: 'center' },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center', marginBottom: 20,
  },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalIconBig: {
    width: 64, height: 64, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  modalDate: { fontSize: 18, fontWeight: '800', color: '#0f172a', letterSpacing: -0.4 },
  modalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#f1f5f9', marginBottom: 20 },
  modalDetails: { gap: 16 },
  modalDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  modalDetailIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#f8fafc',
    justifyContent: 'center', alignItems: 'center',
  },
  modalDetailLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  modalDetailValue: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  modalEmptyWrap: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  modalEmptyText: { fontSize: 13, color: '#94a3b8' },
  modalCloseBtn: {
    marginTop: 24,
    backgroundColor: '#1e3a8a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});