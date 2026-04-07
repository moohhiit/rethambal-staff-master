import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  Dimensions,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Linking,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// ─── Notification Server ──────────────────────────────────────────────────────
const NOTIFICATION_API = 'https://fcm-server-774r.onrender.com';

// ─── Design Tokens — ALL colors live here ────────────────────────────────────
const C = {
  // Brand
  primary:           '#1E3A8A',
  primaryMid:        '#2563EB',
  primaryLight:      '#EFF6FF',
  primaryFaint:      '#DBEAFE',

  // Semantic — success
  success:           '#059669',
  successLight:      '#ECFDF5',
  successText:       '#065F46',

  // Semantic — danger
  danger:            '#DC2626',
  dangerSoft:        '#EF4444',
  dangerLight:       '#FEF2F2',

  // Semantic — warning
  warning:           '#D97706',
  warningLight:      '#FFFBEB',

  // Neutrals
  bg:                '#F1F5F9',
  surface:           '#FFFFFF',
  surfaceAlt:        '#F8FAFC',
  border:            '#E2E8F0',

  // Typography
  textPrimary:       '#0F172A',
  textSecondary:     '#1E293B',
  textMuted:         '#64748B',
  textFaint:         '#94A3B8',
  textDisabled:      '#CBD5E1',

  // Hero overlays (semi-transparent, used only in the navy hero band)
  heroText:          '#FFFFFF',
  heroSubText:       '#93C5FD',
  heroDimText:       '#BFDBFE',
  heroOverlay:       'rgba(255,255,255,0.08)',
  heroOverlayBorder: 'rgba(255,255,255,0.10)',
  heroDivider:       'rgba(255,255,255,0.12)',
  heroResetBg:       'rgba(239,68,68,0.18)',

  // Progress bar live colors (computed at runtime, references above)
  progressHigh:      '#34D399',   // ≥75 %
  progressMid:       '#FCD34D',   // ≥50 %
  progressLow:       '#F87171',   // <50 %

  // Modal / sheet
  scrim:             'rgba(15,23,42,0.50)',

  // QR screen
  qrBg:              '#000000',
  qrSurface:         'rgba(255,255,255,0.10)',
  qrText:            'rgba(255,255,255,0.65)',

  // Shadows
  shadow:            '#0F172A',
  shadowSuccess:     '#059669',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student {
  id: string;
  user_id: string;
  admission_number: string;
  roll_number: string;
  class_id: string;
  status: string;
  user: { id: string; first_name: string; last_name: string; photo_url: string | null; fcm_token: string | null };
  class: { id: string; grade: { grade: string }; section: { section: string } };
}

interface Class {
  id: string;
  grade: { grade: string };
  section: { section: string };
  room_number: string;
}

interface NotifSummary {
  sent: number;
  failed: number;
  total: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudentAttendance({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [scanMode, setScanMode]               = useState<'manual' | 'qr'>('manual');
  const [loading, setLoading]                 = useState(false);
  const [refreshing, setRefreshing]           = useState(false);
  const [staffId, setStaffId]                 = useState('');
  const [userId, setUserId]                   = useState('');
  const [classes, setClasses]                 = useState<Class[]>([]);
  const [selectedClass, setSelectedClass]     = useState<Class | null>(null);
  const [students, setStudents]               = useState<Student[]>([]);
  const [presentStudents, setPresentStudents] = useState<Set<string>>(new Set());
  const [scannedStudents, setScannedStudents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery]         = useState('');
  const [showCamera, setShowCamera]           = useState(false);
  const [saveLoading, setSaveLoading]         = useState(false);
  const [selectedDate]                        = useState(new Date());
  const [hasPermission, setHasPermission]     = useState(false);
  const [notifLoading, setNotifLoading]       = useState(false);
  const [notifSummary, setNotifSummary]       = useState<NotifSummary | null>(null);
  const [showNotifModal, setShowNotifModal]   = useState(false);

  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (staffId) fetchClasses(); }, [staffId]);
  useEffect(() => { if (selectedClass) fetchStudents(); }, [selectedClass, selectedDate]);

  // ─── Data ─────────────────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      const [sid, uid] = await Promise.all([
        AsyncStorage.getItem('staffId'),
        AsyncStorage.getItem('userId'),
      ]);
      if (sid) setStaffId(sid);
      else { Alert.alert('Error', 'Staff data not found.'); navigation.goBack(); }
      if (uid) setUserId(uid);
      const perm = await Camera.getCameraPermissionStatus();
      if (perm === 'granted') setHasPermission(true);
      else if (perm === 'not-determined') {
        const np = await Camera.requestCameraPermission();
        setHasPermission(np === 'granted');
      }
    } catch (e) { console.error(e); }
  };

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const yr = new Date().getFullYear();
      const { data, error } = await supabase
        .from('classes')
        .select('id, room_number, grade:grades!classes_grade_id_fkey(grade), section:sections!classes_section_id_fkey(section)')
        .eq('teacher_id', staffId)
        .eq('academic_year', `${yr}-${yr + 1}`)
        .order('grade(grade)', { ascending: true });
      if (error) throw error;
      setClasses(data || []);
      if (data?.[0]) setSelectedClass(data[0]);
    } catch { Alert.alert('Error', 'Failed to load classes.'); }
    finally { setLoading(false); }
  };

  const fetchStudents = async () => {
    if (!selectedClass) return;
    try {
      setLoading(true);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { data: sd, error: se } = await supabase
        .from('students')
        .select('id, user_id, admission_number, roll_number, class_id, status, users!students_user_id_fkey(id, first_name, last_name, photo_url, fcm_token)')
        .eq('class_id', selectedClass.id).eq('status', 'active')
        .order('roll_number', { ascending: true });
      if (se) throw se;
      if (!sd?.length) { setStudents([]); setPresentStudents(new Set()); return; }
      const { data: ar } = await supabase
        .from('student_attendance').select('student_id, status')
        .eq('date', dateStr).in('student_id', sd.map(s => s.id));
      const ps = new Set<string>();
      ar?.forEach(r => { if (r.status === 'present') ps.add(r.student_id); });
      setPresentStudents(ps);
      setStudents(sd.map(s => ({ ...s, user: s.users as any, class: selectedClass })));
    } catch { Alert.alert('Error', 'Failed to load students.'); }
    finally { setLoading(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStudents();
    setRefreshing(false);
  }, [selectedClass, selectedDate]);

  // ─── QR ───────────────────────────────────────────────────────────────────

  const handleQRScan = useCallback((codes: any[]) => {
    if (!codes.length) return;
    try {
      const data = JSON.parse(codes[0].value);
      const sid = data.student_id;
      if (!sid || scannedStudents.has(sid)) return;
      const student = students.find(s => s.id === sid);
      if (student) {
        setPresentStudents(p => new Set(p).add(sid));
        setScannedStudents(p => new Set(p).add(sid));
        Alert.alert('✓ Marked Present', `${student.user.first_name} ${student.user.last_name}`, [{ text: 'OK' }], { cancelable: true });
      } else Alert.alert('Not Found', 'Student not in this class');
    } catch { Alert.alert('Invalid QR', 'Cannot read this QR code'); }
  }, [students, scannedStudents]);

  const codeScanner = useCodeScanner({ codeTypes: ['qr'], onCodeScanned: handleQRScan });

  // ─── Actions ──────────────────────────────────────────────────────────────

  const togglePresence = (id: string) =>
    setPresentStudents(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const markAllPresent = () =>
    Alert.alert('Mark All Present?', 'This will mark every student as present.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => setPresentStudents(new Set(students.map(s => s.id))) },
    ]);

  const resetAttendance = () =>
    Alert.alert('Reset Attendance?', 'All marks will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { setPresentStudents(new Set()); setScannedStudents(new Set()); } },
    ]);

  const sendAttendanceNotifications = async (
    savedStudents: Student[],
    markedPresent: Set<string>,
    dateStr: string,
  ): Promise<NotifSummary> => {
    const className = selectedClass ? `${selectedClass.grade.grade}-${selectedClass.section.section}` : 'your class';
    const results = await Promise.allSettled(
      savedStudents.map(async (student) => {
        const token = student.user?.fcm_token;
        if (!token) throw new Error('No FCM token');
        const isPresent = markedPresent.has(student.id);
        const response = await fetch(`${NOTIFICATION_API}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            title: isPresent ? '✅ Attendance Marked' : '❌ Absent Today',
            body: isPresent
              ? `${student.user.first_name} ${student.user.last_name} is present in ${className} on ${dateStr}.`
              : `${student.user.first_name} ${student.user.last_name} is absent from ${className} on ${dateStr}. Please contact the school if needed.`,
            data: { type: 'attendance', student_id: student.id, date: dateStr, status: isPresent ? 'present' : 'absent' },
          }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || 'Unknown error');
      })
    );
    return {
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      total: savedStudents.length,
    };
  };

  const saveAttendance = async () => {
    if (!presentStudents.size) { Alert.alert('No Students Marked', 'Mark at least one student present.'); return; }
    if (!userId) { Alert.alert('Session Error', 'Please log in again.'); return; }
    try {
      setSaveLoading(true);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const records = students.map(s => ({
        student_id: s.id, date: dateStr,
        status: presentStudents.has(s.id) ? 'present' : 'absent',
        marked_by: userId,
      }));
      const { data: existing } = await supabase.from('student_attendance').select('id, student_id')
        .eq('date', dateStr).in('student_id', students.map(s => s.id));

      const doSave = async () => {
        if (existing?.length) {
          await supabase.from('student_attendance').delete()
            .eq('date', dateStr).in('student_id', students.map(s => s.id));
        }
        const { error } = await supabase.from('student_attendance').insert(records);
        if (error) throw error;
        setSaveLoading(false);
        setNotifLoading(true);
        try {
          const summary = await sendAttendanceNotifications(students, presentStudents, dateStr);
          setNotifSummary(summary);
          setShowNotifModal(true);
        } catch (err) {
          console.error('Notification error:', err);
          setNotifSummary({ sent: 0, failed: students.length, total: students.length });
          setShowNotifModal(true);
        } finally { setNotifLoading(false); }
      };

      if (existing?.length) {
        Alert.alert('Update Attendance?', `${existing.length} record(s) already exist for this date.`, [
          { text: 'Cancel', style: 'cancel', onPress: () => setSaveLoading(false) },
          { text: 'Update', onPress: doSave },
        ]);
      } else { await doSave(); }
    } catch { Alert.alert('Error', 'Failed to save attendance.'); setSaveLoading(false); }
  };

  // ─── Computed ─────────────────────────────────────────────────────────────

  const stats = { total: students.length, present: presentStudents.size, absent: students.length - presentStudents.size };
  const pct = stats.total ? Math.round((stats.present / stats.total) * 100) : 0;
  const pctBarColor = pct >= 75 ? C.progressHigh : pct >= 50 ? C.progressMid : C.progressLow;
  const pctTextColor = pct >= 75 ? C.progressHigh : pct >= 50 ? C.progressMid : C.progressLow;

  const filtered = students.filter(s =>
    `${s.user?.first_name} ${s.user?.last_name} ${s.admission_number} ${s.roll_number}`
      .toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Sub-components ───────────────────────────────────────────────────────

  const Header = () => (
    <View style={[S.hero, { paddingTop: insets.top + 16 }]}>
      <View style={S.heroTopRow}>
        <View style={S.heroLeft}>
          <Text style={S.heroEyebrow}>STUDENT ATTENDANCE</Text>
          <Text style={S.heroTitle}>
            {selectedClass ? `Class ${selectedClass.grade.grade}–${selectedClass.section.section}` : 'Select a Class'}
          </Text>
          <Text style={S.heroDate}>
            {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <View style={S.heroActions}>
          <TouchableOpacity onPress={resetAttendance} style={S.heroResetBtn}>
            <Icon name="refresh" size={17} color={C.dangerSoft} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={saveAttendance}
            style={[S.heroSaveBtn, (saveLoading || notifLoading) && S.heroBtnDisabled]}
            disabled={saveLoading || notifLoading}
            activeOpacity={0.85}
          >
            {saveLoading
              ? <ActivityIndicator size="small" color={C.heroText} />
              : notifLoading
                ? <><ActivityIndicator size="small" color={C.heroText} /><Text style={S.heroSaveTxt}>Notifying…</Text></>
                : <><Icon name="content-save-check" size={15} color={C.heroText} /><Text style={S.heroSaveTxt}>Save</Text></>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats strip */}
      <View style={S.heroStatsRow}>
        {[
          { label: 'Total',   value: String(stats.total),   color: C.heroDimText   },
          { label: 'Present', value: String(stats.present), color: C.progressHigh  },
          { label: 'Absent',  value: String(stats.absent),  color: C.progressLow   },
          { label: 'Rate',    value: `${pct}%`,             color: pctTextColor     },
        ].map((s, i, arr) => (
          <React.Fragment key={s.label}>
            <View style={S.heroStatItem}>
              <Text style={[S.heroStatVal, { color: s.color }]}>{s.value}</Text>
              <Text style={S.heroStatLbl}>{s.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={S.heroStatSep} />}
          </React.Fragment>
        ))}
      </View>

      {/* Thin progress bar */}
      <View style={S.heroProgressTrack}>
        <View style={[S.heroProgressFill, { width: `${pct}%` as any, backgroundColor: pctBarColor }]} />
      </View>
    </View>
  );

  const ClassTabs = () => (
    <View style={S.tabsWrap}>
      <Text style={S.tabsEyebrow}>CLASS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {classes.map(cls => {
          const active = selectedClass?.id === cls.id;
          return (
            <TouchableOpacity
              key={cls.id}
              onPress={() => setSelectedClass(cls)}
              style={[S.tab, active && S.tabActive]}
              activeOpacity={0.75}
            >
              <Text style={[S.tabText, active && S.tabTextActive]}>
                {cls.grade.grade}–{cls.section.section}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const ToolBar = () => (
    <View style={S.toolbar}>
      <View style={S.searchBox}>
        <Icon name="magnify" size={17} color={C.textFaint} />
        <TextInput
          style={S.searchInput}
          placeholder="Search students…"
          placeholderTextColor={C.textFaint}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {!!searchQuery && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={17} color={C.textFaint} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={markAllPresent} style={S.toolBtn} activeOpacity={0.8}>
        <Icon name="check-all" size={19} color={C.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { setScanMode(m => m === 'manual' ? 'qr' : 'manual'); if (scanMode === 'manual') setShowCamera(true); }}
        style={[S.toolBtn, S.toolBtnQR]}
        activeOpacity={0.8}
      >
        <Icon name={scanMode === 'manual' ? 'qrcode-scan' : 'clipboard-list'} size={19} color={C.primary} />
      </TouchableOpacity>
    </View>
  );

  const StudentCard = ({ item }: { item: Student }) => {
    const present = presentStudents.has(item.id);
    const initials = `${item.user?.first_name?.[0] ?? ''}${item.user?.last_name?.[0] ?? ''}`;
    return (
      <TouchableOpacity
        onPress={() => togglePresence(item.id)}
        activeOpacity={0.75}
        style={[S.card, present && S.cardPresent]}
      >
        <View style={[S.cardStripe, { backgroundColor: present ? C.success : C.border }]} />
        <View style={[S.avatar, { backgroundColor: present ? C.successLight : C.primaryLight }]}>
          <Text style={[S.avatarText, { color: present ? C.success : C.primary }]}>{initials}</Text>
        </View>
        <View style={S.cardBody}>
          <Text style={[S.cardName, { color: present ? C.successText : C.textSecondary }]} numberOfLines={1}>
            {item.user?.first_name} {item.user?.last_name}
          </Text>
          <Text style={S.cardMeta}>Roll {item.roll_number} · {item.admission_number}</Text>
        </View>
        <View style={[S.badge, { backgroundColor: present ? C.successLight : C.bg }]}>
          <Icon
            name={present ? 'check-circle-outline' : 'close-circle-outline'}
            size={13}
            color={present ? C.success : C.textFaint}
          />
          <Text style={[S.badgeText, { color: present ? C.success : C.textFaint }]}>
            {present ? 'Present' : 'Absent'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Notification Modal ───────────────────────────────────────────────────

  const NotifModal = () => {
    if (!notifSummary) return null;
    const allGood  = notifSummary.failed === 0;
    const allBad   = notifSummary.sent   === 0;
    const noTokens = allBad && notifSummary.total > 0;

    const iconColor = allGood ? C.success  : allBad ? C.danger  : C.warning;
    const iconBg    = allGood ? C.successLight : allBad ? C.dangerLight : C.warningLight;
    const iconName  = allGood ? 'bell-check' : allBad ? 'bell-off' : 'bell-alert';

    return (
      <Modal visible={showNotifModal} transparent animationType="slide" onRequestClose={() => setShowNotifModal(false)}>
        <View style={S.modalOverlay}>
          <View style={[S.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={S.modalHandle} />
            <View style={[S.modalIconWrap, { backgroundColor: iconBg }]}>
              <Icon name={iconName} size={30} color={iconColor} />
            </View>
            <Text style={S.modalTitle}>Attendance Saved</Text>
            <Text style={S.modalSubtitle}>
              {allGood
                ? 'All parents have been notified successfully.'
                : allBad
                  ? 'Attendance saved, but no parent notifications were sent.'
                  : 'Attendance saved. Some notifications could not be delivered.'}
            </Text>
            <View style={S.modalStatsRow}>
              {[
                { label: 'Sent',   value: notifSummary.sent,   icon: 'check-circle-outline',  color: C.success, bg: C.successLight },
                { label: 'Failed', value: notifSummary.failed, icon: 'close-circle-outline',  color: C.danger,  bg: C.dangerLight  },
                { label: 'Total',  value: notifSummary.total,  icon: 'account-group-outline', color: C.primary, bg: C.primaryLight },
              ].map(s => (
                <View key={s.label} style={[S.modalStatBox, { backgroundColor: s.bg }]}>
                  <Icon name={s.icon} size={20} color={s.color} />
                  <Text style={[S.modalStatNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={S.modalStatLbl}>{s.label}</Text>
                </View>
              ))}
            </View>
            {notifSummary.failed > 0 && (
              <View style={S.modalHint}>
                <Icon name="information-outline" size={13} color={C.textFaint} />
                <Text style={S.modalHintText}>
                  {noTokens
                    ? 'No parent FCM tokens found. Ask parents to log in to the app.'
                    : `${notifSummary.failed} parent(s) may not have the app installed or notifications disabled.`}
                </Text>
              </View>
            )}
            <TouchableOpacity style={S.modalDoneBtn} onPress={() => setShowNotifModal(false)} activeOpacity={0.85}>
              <Text style={S.modalDoneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ─── QR Modal ─────────────────────────────────────────────────────────────

  const QRModal = () => (
    <Modal
      visible={showCamera}
      animationType="slide"
      onRequestClose={() => { setShowCamera(false); setScanMode('manual'); }}
    >
      <View style={S.qrScreen}>
        <StatusBar barStyle="light-content" />

        {/* Hero header matches main screen */}
        <View style={[S.qrHero, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={() => { setShowCamera(false); setScanMode('manual'); }} style={S.qrBackBtn}>
            <Icon name="arrow-left" size={21} color={C.heroText} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={S.qrHeroTitle}>QR Scanner</Text>
            {selectedClass && <Text style={S.qrHeroSub}>Class {selectedClass.grade.grade}–{selectedClass.section.section}</Text>}
          </View>
          <TouchableOpacity
            onPress={saveAttendance}
            disabled={!presentStudents.size || saveLoading}
            style={[S.heroSaveBtn, (!presentStudents.size || saveLoading) && S.heroBtnDisabled]}
            activeOpacity={0.85}
          >
            {saveLoading
              ? <ActivityIndicator size="small" color={C.heroText} />
              : <><Icon name="content-save-check" size={15} color={C.heroText} /><Text style={S.heroSaveTxt}>Save</Text></>
            }
          </TouchableOpacity>
        </View>

        {/* Camera or no-camera placeholder */}
        {!device || !hasPermission ? (
          <View style={S.qrPlaceholder}>
            <View style={S.qrPlaceholderIcon}>
              <Icon name="camera-off" size={38} color={C.qrText} />
            </View>
            <Text style={S.qrPlaceholderText}>{!device ? 'No camera available' : 'Camera permission required'}</Text>
            {!hasPermission && (
              <TouchableOpacity style={S.qrPermBtn} onPress={async () => {
                const p = await Camera.requestCameraPermission();
                if (p === 'denied') Linking.openSettings();
                else setHasPermission(p === 'granted');
              }}>
                <Text style={S.qrPermTxt}>Enable Camera</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={showCamera}
            codeScanner={codeScanner}
            photo={false} video={false} audio={false}
          >
            <View style={S.qrViewfinder}>
              <View style={S.qrFrame}>
                {(['tl', 'tr', 'bl', 'br'] as const).map(k => (
                  <View key={k} style={[S.qrCorner, S[`qrCorner_${k}` as keyof typeof S]]} />
                ))}
              </View>
              <Text style={S.qrHint}>Align the student's QR code within the frame</Text>
            </View>
          </Camera>
        )}

        {/* Bottom sheet */}
        <View style={[S.qrSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={S.qrSheetHandle} />
          <View style={S.qrSheetStats}>
            {[
              { label: 'Scanned',   value: scannedStudents.size, color: C.success },
              { label: 'Total',     value: stats.total,          color: C.textPrimary },
              { label: 'Remaining', value: stats.absent,         color: C.danger },
            ].map((s, i, arr) => (
              <React.Fragment key={s.label}>
                <View style={S.qrSheetStat}>
                  <Text style={[S.qrSheetStatNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={S.qrSheetStatLbl}>{s.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={S.qrSheetSep} />}
              </React.Fragment>
            ))}
          </View>
          <View style={S.qrProgressTrack}>
            <View style={[S.qrProgressFill, {
              width: `${stats.total ? (scannedStudents.size / stats.total) * 100 : 0}%` as any,
            }]} />
          </View>
          <TouchableOpacity
            style={S.qrSwitchBtn}
            onPress={() => { setShowCamera(false); setScanMode('manual'); }}
            activeOpacity={0.8}
          >
            <Icon name="clipboard-list-outline" size={18} color={C.primary} />
            <Text style={S.qrSwitchTxt}>Switch to Manual Mode</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ─── Root ─────────────────────────────────────────────────────────────────

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <Header />

      {loading && !students.length ? (
        <View style={S.loaderWrap}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={S.loaderText}>Loading students…</Text>
        </View>
      ) : (
        <>
          <ClassTabs />
          <ToolBar />
          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            renderItem={({ item }) => <StudentCard item={item} />}
            contentContainerStyle={[S.list, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />
            }
            ListEmptyComponent={
              <View style={S.emptyWrap}>
                <Icon name="account-search-outline" size={52} color={C.textDisabled} />
                <Text style={S.emptyTitle}>{searchQuery ? 'No results found' : 'No students'}</Text>
                <Text style={S.emptySub}>
                  {searchQuery ? 'Try a different search term' : 'No active students found in this class'}
                </Text>
              </View>
            }
          />
        </>
      )}
      <QRModal />
      <NotifModal />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: { backgroundColor: C.primary, paddingHorizontal: 20 },
  heroTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingBottom: 18,
  },
  heroLeft: { flex: 1, paddingRight: 12 },
  heroEyebrow: {
    fontSize: 10, fontWeight: '700', color: C.heroSubText,
    letterSpacing: 1.5, marginBottom: 4,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: C.heroText, letterSpacing: -0.4, marginBottom: 4 },
  heroDate: { fontSize: 12, color: C.heroDimText },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroResetBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.heroResetBg,
    justifyContent: 'center', alignItems: 'center',
  },
  heroSaveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.primaryMid,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
  },
  heroBtnDisabled: { opacity: 0.55 },
  heroSaveTxt: { color: C.heroText, fontSize: 13, fontWeight: '700' },

  heroStatsRow: {
    flexDirection: 'row',
    backgroundColor: C.heroOverlay,
    borderTopWidth: 1, borderTopColor: C.heroOverlayBorder,
    marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 12,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatSep: { width: 1, backgroundColor: C.heroDivider, marginVertical: 2 },
  heroStatVal: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  heroStatLbl: {
    fontSize: 9, color: 'rgba(255,255,255,0.45)',
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2,
  },
  heroProgressTrack: {
    height: 4, backgroundColor: C.heroDivider,
    marginHorizontal: -20, overflow: 'hidden',
  },
  heroProgressFill: { height: 4 },

  // ── Class Tabs ────────────────────────────────────────────────────────────
  tabsWrap: {
    backgroundColor: C.surface,
    paddingTop: 14, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  tabsEyebrow: {
    fontSize: 9, fontWeight: '700', color: C.textFaint,
    letterSpacing: 1.4, marginBottom: 10, textTransform: 'uppercase',
  },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 99,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surfaceAlt,
  },
  tabActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  tabTextActive: { color: C.primary },

  // ── Toolbar ───────────────────────────────────────────────────────────────
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.bg, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.textPrimary, padding: 0 },
  toolBtn: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border,
  },
  toolBtnQR: { backgroundColor: C.primaryLight, borderColor: C.primary },

  // ── List ──────────────────────────────────────────────────────────────────
  list: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },

  // ── Student Card ──────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden',
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardPresent: { shadowColor: C.shadowSuccess, shadowOpacity: 0.12 },
  cardStripe: { width: 4, alignSelf: 'stretch' },
  avatar: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 12, marginVertical: 12,
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 13 },
  cardName: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  cardMeta: { fontSize: 12, color: C.textFaint },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, marginRight: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // ── Loader / Empty ────────────────────────────────────────────────────────
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { fontSize: 14, color: C.textMuted, fontWeight: '500' },
  emptyWrap: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.textFaint, marginTop: 16 },
  emptySub: { fontSize: 13, color: C.textDisabled, marginTop: 6, textAlign: 'center', lineHeight: 20 },

  // ── Notification Modal ────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 12, alignItems: 'center',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 24 },
  modalIconWrap: { width: 64, height: 64, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.4, marginBottom: 8 },
  modalSubtitle: {
    fontSize: 13, color: C.textMuted, textAlign: 'center',
    lineHeight: 20, marginBottom: 24, paddingHorizontal: 8,
  },
  modalStatsRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 16 },
  modalStatBox: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, gap: 4 },
  modalStatNum: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  modalStatLbl: {
    fontSize: 10, color: C.textFaint,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4,
  },
  modalHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: C.surfaceAlt, borderRadius: 10,
    padding: 12, marginBottom: 16, width: '100%',
  },
  modalHintText: { flex: 1, fontSize: 12, color: C.textFaint, lineHeight: 17 },
  modalDoneBtn: {
    width: '100%', backgroundColor: C.primary,
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  modalDoneTxt: { color: C.heroText, fontSize: 15, fontWeight: '700' },

  // ── QR Screen ─────────────────────────────────────────────────────────────
  qrScreen: { flex: 1, backgroundColor: C.qrBg },
  qrHero: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: C.primary,
  },
  qrBackBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.qrSurface,
    justifyContent: 'center', alignItems: 'center',
  },
  qrHeroTitle: { fontSize: 16, fontWeight: '700', color: C.heroText },
  qrHeroSub: { fontSize: 11, color: C.heroSubText, marginTop: 2 },
  qrPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  qrPlaceholderIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: C.qrSurface,
    justifyContent: 'center', alignItems: 'center',
  },
  qrPlaceholderText: { color: C.qrText, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  qrPermBtn: { backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  qrPermTxt: { color: C.heroText, fontWeight: '700', fontSize: 14 },
  qrViewfinder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qrFrame: { width: 240, height: 240, position: 'relative' },
  qrCorner: { position: 'absolute', width: 28, height: 28, borderColor: C.heroText, borderWidth: 0 },
  qrCorner_tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  qrCorner_tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  qrCorner_bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  qrCorner_br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  qrHint: { color: C.qrText, fontSize: 13, marginTop: 28, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  qrSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
  },
  qrSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
  qrSheetStats: { flexDirection: 'row', marginBottom: 16 },
  qrSheetStat: { flex: 1, alignItems: 'center' },
  qrSheetStatNum: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  qrSheetStatLbl: { fontSize: 11, color: C.textFaint, fontWeight: '500', marginTop: 2 },
  qrSheetSep: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  qrProgressTrack: { height: 6, backgroundColor: C.bg, borderRadius: 99, overflow: 'hidden', marginBottom: 16 },
  qrProgressFill: { height: 6, backgroundColor: C.success, borderRadius: 99 },
  qrSwitchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primaryLight, borderWidth: 1.5, borderColor: C.primary,
    borderRadius: 12, paddingVertical: 13,
  },
  qrSwitchTxt: { fontSize: 14, fontWeight: '700', color: C.primary },
});