import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';
import { useNavigation } from '@react-navigation/native';

// ─── Color Palette (matches Dashboard) ────────────────────────────────────────
// Primary Navy   : #1e3a8a
// Sky Blue       : #0891b2
// Amber          : #d97706
// Emerald        : #059669
// Red            : #dc2626
// Violet         : #7c3aed
// Page BG        : #F1F5F9
// Card BG        : #ffffff
// Text Primary   : #0f172a
// Text Secondary : #64748b
// Border         : #f1f5f9
// ─────────────────────────────────────────────────────────────────────────────

const { width } = Dimensions.get('window');

interface StaffProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  staffType: string;
  designation: string;
  department: string;
  employeeId: string;
  email: string;
  phone: string;
  qualification: string;
  experience_years: number;
  joining_date: string;
  salary: number;
  shift: string;
  status: string;
  photo_url: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  date_of_birth: string;
  gender: string;
  blood_group: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  rating: number | null;
  // driver / transport specific
  license_number: string | null;
  license_type: string | null;
  license_expiry: string | null;
  assigned_area: string | null;
  assigned_floor: string | null;
  assigned_gate: string | null;
}

const STAFF_TYPE_LABELS: Record<string, string> = {
  teacher: 'Teacher',
  peon: 'Peon',
  security: 'Security Guard',
  accountant: 'Accountant',
  librarian: 'Librarian',
  lab_assistant: 'Lab Assistant',
  nurse: 'Nurse',
  office_staff: 'Office Staff',
  driver: 'Driver',
  receptionist: 'Receptionist',
  cleaner: 'Cleaner',
  principal: 'Principal',
};

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Morning',
  evening: 'Evening',
  night: 'Night',
  full_day: 'Full Day',
  rotating: 'Rotating',
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: '#059669', bg: '#ECFDF5', label: 'Active' },
  inactive: { color: '#64748b', bg: '#F8FAFC', label: 'Inactive' },
  on_leave: { color: '#d97706', bg: '#FFFBEB', label: 'On Leave' },
  terminated: { color: '#dc2626', bg: '#FEF2F2', label: 'Terminated' },
};

export default function StaffProfile() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [userDataStr, staffIdStr] = await AsyncStorage.multiGet(['userData', 'staffId']);
      const userData = userDataStr[1];
      const staffId = staffIdStr[1];

      if (!userData) {
        Alert.alert('Error', 'User session not found. Please login again.');
        return;
      }

      const parsedUser = JSON.parse(userData);
      const finalStaffId = staffId || parsedUser.staff?.id;

      if (!finalStaffId) {
        // Build profile from AsyncStorage alone
        buildProfileFromCache(parsedUser);
        return;
      }

      // Fetch rich staff data from Supabase
      const { data: staffData, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', finalStaffId)
        .single();

      if (error || !staffData) {
        buildProfileFromCache(parsedUser);
        return;
      }

      setProfile({
        id: finalStaffId,
        name: `${parsedUser.first_name} ${parsedUser.last_name}`,
        firstName: parsedUser.first_name,
        lastName: parsedUser.last_name,
        role: parsedUser.role,
        staffType: staffData.staff_type,
        designation: staffData.designation || 'Staff',
        department: staffData.department || '—',
        employeeId: staffData.employee_id,
        email: parsedUser.email || '—',
        phone: parsedUser.phone || '—',
        qualification: staffData.qualification || '—',
        experience_years: staffData.experience_years || 0,
        joining_date: staffData.joining_date,
        salary: staffData.salary || 0,
        shift: staffData.shift || '—',
        status: staffData.status || 'active',
        photo_url: parsedUser.photo_url || null,
        address: parsedUser.address || '—',
        city: parsedUser.city || '—',
        state: parsedUser.state || '—',
        pincode: parsedUser.pincode || '—',
        date_of_birth: parsedUser.date_of_birth || '—',
        gender: parsedUser.gender || '—',
        blood_group: parsedUser.blood_group || '—',
        emergency_contact_name: staffData.emergency_contact_name || '—',
        emergency_contact_phone: staffData.emergency_contact_phone || '—',
        rating: staffData.rating || null,
        license_number: staffData.license_number || null,
        license_type: staffData.license_type || null,
        license_expiry: staffData.license_expiry || null,
        assigned_area: staffData.assigned_area || null,
        assigned_floor: staffData.assigned_floor || null,
        assigned_gate: staffData.assigned_gate || null,
      });
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const buildProfileFromCache = (parsedUser: any) => {
    setProfile({
      id: parsedUser.id,
      name: `${parsedUser.first_name} ${parsedUser.last_name}`,
      firstName: parsedUser.first_name,
      lastName: parsedUser.last_name,
      role: parsedUser.role,
      staffType: parsedUser.staff?.staff_type || parsedUser.role,
      designation: parsedUser.staff?.designation || 'Staff',
      department: parsedUser.staff?.department || '—',
      employeeId: parsedUser.staff?.employee_id || '—',
      email: parsedUser.email || '—',
      phone: parsedUser.phone || '—',
      qualification: parsedUser.staff?.qualification || '—',
      experience_years: parsedUser.staff?.experience_years || 0,
      joining_date: parsedUser.staff?.joining_date || '—',
      salary: parsedUser.staff?.salary || 0,
      shift: parsedUser.staff?.shift || '—',
      status: parsedUser.staff?.status || 'active',
      photo_url: parsedUser.photo_url || null,
      address: parsedUser.address || '—',
      city: parsedUser.city || '—',
      state: parsedUser.state || '—',
      pincode: parsedUser.pincode || '—',
      date_of_birth: parsedUser.date_of_birth || '—',
      gender: parsedUser.gender || '—',
      blood_group: parsedUser.blood_group || '—',
      emergency_contact_name: parsedUser.staff?.emergency_contact_name || '—',
      emergency_contact_phone: parsedUser.staff?.emergency_contact_phone || '—',
      rating: parsedUser.staff?.rating || null,
      license_number: parsedUser.staff?.license_number || null,
      license_type: parsedUser.staff?.license_type || null,
      license_expiry: parsedUser.staff?.license_expiry || null,
      assigned_area: parsedUser.staff?.assigned_area || null,
      assigned_floor: parsedUser.staff?.assigned_floor || null,
      assigned_gate: parsedUser.staff?.assigned_gate || null,
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoggingOut(true);
              await supabase.auth.signOut();
              await AsyncStorage.multiRemove([
                'userData', 'staffId', 'userId', 'userRole', 'authToken',
              ]);
              // Navigate to login screen — adjust route name as needed
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' as never }],
              });
            } catch (err) {
              console.error('Logout error:', err);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '—') return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  const callPhone = (phone: string) => {
    if (phone && phone !== '—') Linking.openURL(`tel:${phone}`);
  };

  const sendEmail = (email: string) => {
    if (email && email !== '—') Linking.openURL(`mailto:${email}`);
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading || !profile) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[profile.status] || STATUS_CONFIG.active;
  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase();
  const isDriver = profile.staffType === 'driver';
  const hasSecurity = ['security', 'peon', 'cleaner'].includes(profile.staffType);

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const InfoRow = ({
    icon,
    label,
    value,
    color = '#1e3a8a',
    onPress,
  }: {
    icon: string;
    label: string;
    value: string;
    color?: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={styles.infoRow}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.infoIconWrap, { backgroundColor: color + '15' }]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, onPress && { color: '#1e3a8a' }]}>{value}</Text>
      </View>
      {onPress && <Icon name="chevron-right" size={16} color="#cbd5e1" />}
    </TouchableOpacity>
  );

  const SectionCard = ({
    title,
    icon,
    iconColor,
    children,
  }: {
    title: string;
    icon: string;
    iconColor: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: iconColor + '18' }]}>
          <Icon name={icon} size={16} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero / Avatar Banner ─────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        {/* Back button (optional, comment out if using tab nav) */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-left" size={22} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.heroCenter}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>

          <Text style={styles.heroName}>{profile.name}</Text>
          <Text style={styles.heroDesignation}>
            {profile.designation} · {STAFF_TYPE_LABELS[profile.staffType] || profile.staffType}
          </Text>

          {/* Quick contact actions */}
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={[styles.heroActionBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              onPress={() => callPhone(profile.phone)}
            >
              <Icon name="phone-outline" size={18} color="#ffffff" />
              <Text style={styles.heroActionLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroActionBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              onPress={() => sendEmail(profile.email)}
            >
              <Icon name="email-outline" size={18} color="#ffffff" />
              <Text style={styles.heroActionLabel}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Meta chips row */}
        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Icon name="card-account-details-outline" size={12} color="#93c5fd" />
            <Text style={styles.chipText}>{profile.employeeId}</Text>
          </View>
          {profile.department !== '—' && (
            <View style={styles.chip}>
              <Icon name="office-building-outline" size={12} color="#93c5fd" />
              <Text style={styles.chipText}>{profile.department}</Text>
            </View>
          )}
          {profile.experience_years > 0 && (
            <View style={styles.chip}>
              <Icon name="briefcase-outline" size={12} color="#93c5fd" />
              <Text style={styles.chipText}>{profile.experience_years} yrs exp</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Rating (Driver) ──────────────────────────────────────────────── */}
      {isDriver && profile.rating && (
        <View style={[styles.section, { marginTop: 20 }]}>
          <View style={styles.ratingCard}>
            <Icon name="star" size={22} color="#d97706" />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.ratingValue}>{profile.rating.toFixed(1)} / 5.0</Text>
              <Text style={styles.ratingLabel}>Driver Rating</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Personal Information ─────────────────────────────────────────── */}
      <SectionCard title="Personal Information" icon="account-outline" iconColor="#1e3a8a">
        <InfoRow
          icon="phone-outline"
          label="Phone"
          value={profile.phone}
          color="#059669"
          onPress={() => callPhone(profile.phone)}
        />
        <InfoRow
          icon="email-outline"
          label="Email"
          value={profile.email}
          color="#0891b2"
          onPress={() => sendEmail(profile.email)}
        />
        <InfoRow icon="calendar-outline"      label="Date of Birth"  value={formatDate(profile.date_of_birth)} color="#7c3aed" />
        <InfoRow icon="gender-male-female"    label="Gender"         value={profile.gender}                    color="#d97706" />
        <InfoRow icon="water-outline"         label="Blood Group"    value={profile.blood_group}               color="#dc2626" />
        <InfoRow
          icon="map-marker-outline"
          label="Address"
          value={[profile.address, profile.city, profile.state, profile.pincode].filter(v => v && v !== '—').join(', ')}
          color="#64748b"
        />
      </SectionCard>

      {/* ── Employment Details ───────────────────────────────────────────── */}
      <SectionCard title="Employment Details" icon="briefcase-outline" iconColor="#0891b2">
        <InfoRow icon="badge-account-outline"    label="Employee ID"   value={profile.employeeId}                                    color="#0891b2" />
        <InfoRow icon="office-building-outline"  label="Department"    value={profile.department}                                    color="#1e3a8a" />
        <InfoRow icon="account-tie-outline"      label="Designation"   value={profile.designation}                                   color="#7c3aed" />
        <InfoRow icon="school-outline"           label="Qualification" value={profile.qualification}                                 color="#059669" />
        <InfoRow icon="calendar-check-outline"   label="Joining Date"  value={formatDate(profile.joining_date)}                      color="#d97706" />
        <InfoRow icon="clock-time-eight-outline" label="Shift"         value={SHIFT_LABELS[profile.shift] || profile.shift || '—'}  color="#0891b2" />
      </SectionCard>

      {/* ── Driver Details (only for drivers) ───────────────────────────── */}
      {isDriver && (
        <SectionCard title="License & Transport" icon="car-outline" iconColor="#d97706">
          <InfoRow icon="card-text-outline"    label="License Number" value={profile.license_number || '—'} color="#d97706" />
          <InfoRow icon="license"              label="License Type"   value={profile.license_type || '—'}   color="#d97706" />
          <InfoRow icon="calendar-remove"      label="License Expiry" value={formatDate(profile.license_expiry || '')} color="#dc2626" />
        </SectionCard>
      )}

      {/* ── Assigned Area (security / peon / cleaner) ────────────────────── */}
      {hasSecurity && (profile.assigned_area || profile.assigned_floor || profile.assigned_gate) && (
        <SectionCard title="Assigned Area" icon="map-marker-radius-outline" iconColor="#059669">
          {profile.assigned_area  && <InfoRow icon="domain"          label="Area"  value={profile.assigned_area}  color="#059669" />}
          {profile.assigned_floor && <InfoRow icon="layers-outline"  label="Floor" value={profile.assigned_floor} color="#0891b2" />}
          {profile.assigned_gate  && <InfoRow icon="gate"            label="Gate"  value={profile.assigned_gate}  color="#d97706" />}
        </SectionCard>
      )}

      {/* ── Emergency Contact ────────────────────────────────────────────── */}
      <SectionCard title="Emergency Contact" icon="alarm-light-outline" iconColor="#dc2626">
        <InfoRow icon="account-outline" label="Contact Name"  value={profile.emergency_contact_name}                 color="#dc2626" />
        <InfoRow
          icon="phone-alert-outline"
          label="Contact Phone"
          value={profile.emergency_contact_phone}
          color="#dc2626"
          onPress={() => callPhone(profile.emergency_contact_phone)}
        />
      </SectionCard>

      {/* ── Logout Button ────────────────────────────────────────────────── */}
      <View style={[styles.section, styles.logoutSection]}>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.85}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Icon name="logout" size={20} color="#ffffff" />
              <Text style={styles.logoutText}>Logout</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.versionText}>School Management System · v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  scroll: {},

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b', fontWeight: '500' },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  heroCenter: { alignItems: 'center', paddingBottom: 16 },

  avatar: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)',
    marginBottom: 12,
  },
  avatarFallback: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#2d4fa1',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 12,
  },
  avatarInitials: { fontSize: 32, fontWeight: '800', color: '#ffffff' },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginBottom: 10,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  heroName: { fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, marginBottom: 4 },
  heroDesignation: { fontSize: 13, color: '#93c5fd', fontWeight: '500', marginBottom: 16 },

  heroActions: { flexDirection: 'row', gap: 12 },
  heroActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 12,
  },
  heroActionLabel: { fontSize: 13, color: '#ffffff', fontWeight: '600' },

  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    justifyContent: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 14,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  chipText: { fontSize: 11, color: '#bfdbfe', fontWeight: '500' },

  // ── Rating Card ───────────────────────────────────────────────────────────
  ratingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  ratingValue: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  ratingLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  // ── Section ───────────────────────────────────────────────────────────────
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionIconWrap: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', letterSpacing: -0.2 },

  // ── Card ──────────────────────────────────────────────────────────────────
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

  // ── Info Row ─────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  infoIconWrap: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 14, color: '#1e293b', fontWeight: '600' },

  // ── Logout ────────────────────────────────────────────────────────────────
  logoutSection: { alignItems: 'center' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  logoutText: { fontSize: 16, fontWeight: '800', color: '#ffffff', letterSpacing: 0.3 },
  versionText: { marginTop: 14, fontSize: 11, color: '#94a3b8', fontWeight: '400' },
});