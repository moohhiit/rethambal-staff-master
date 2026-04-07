import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payroll {
  id: string;
  staff_id: string;
  month: number;
  year: number;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  leaves: number;
  base_salary: number;
  allowances: number;
  deductions: number;
  gross_salary: number;
  net_salary: number;
  payment_status: 'pending' | 'approved' | 'paid' | 'cancelled';
  payment_date?: string;
  payment_method?: string;
  transaction_id?: string;
  remarks?: string;
  created_at: string;
}

interface AuthData {
  authToken: string;
  staffId: string;
  userId: string;
  employeeId: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#3b82f6',
  paid: '#10b981',
  cancelled: '#ef4444',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Payrolls() {
  const insets = useSafeAreaInsets();

  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [authData, setAuthData] = useState<AuthData | null>(null);

  useEffect(() => { loadAuthData(); }, []);
  useEffect(() => { if (authData) fetchPayrolls(); }, [authData, filterYear]);

  const loadAuthData = async () => {
    try {
      const [authToken, staffId, userId, employeeId] = await AsyncStorage.multiGet([
        'authToken', 'staffId', 'userId', 'employeeId',
      ]);
      const token = authToken[1];
      const staff_Id = staffId[1];
      if (!token || !staff_Id) {
        Alert.alert('Error', 'Authentication data not found. Please login again.');
        return;
      }
      setAuthData({ authToken: token, staffId: staff_Id, userId: userId[1] || '', employeeId: employeeId[1] || '' });
    } catch (error) {
      console.error('Error loading auth data:', error);
      Alert.alert('Error', 'Failed to load authentication data');
    }
  };

  const fetchPayrolls = async () => {
    if (!authData) return;
    try {
      setLoading(true);
      let query = supabase
        .from('payrolls')
        .select(`*, staff:staff_id(employee_id, user:user_id(first_name, last_name)), generated_by_user:generated_by(first_name, last_name), approved_by_user:approved_by(first_name, last_name)`)
        .eq('staff_id', authData.staffId);
      if (filterYear) query = query.eq('year', filterYear);
      query = query.order('year', { ascending: false }).order('month', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      setPayrolls(data || []);
    } catch (error) {
      console.error('Error fetching payrolls:', error);
      Alert.alert('Error', 'Failed to fetch payroll data. Please try again.');
      setPayrolls([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchPayrolls(); };

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const calculateTotalEarnings = () =>
    payrolls.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + p.net_salary, 0);

  const getAvailableYears = () => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - i);
  };

  // ─── Sub-renders ──────────────────────────────────────────────────────────

  const renderPayrollCard = ({ item }: { item: Payroll }) => (
    <TouchableOpacity style={S.card} onPress={() => { setSelectedPayroll(item); setModalVisible(true); }} activeOpacity={0.7}>
      {/* Card Header */}
      <View style={S.cardHeader}>
        <View>
          <Text style={S.monthText}>{MONTHS[item.month - 1]}</Text>
          <Text style={S.yearText}>{item.year}</Text>
        </View>
        <View style={[S.statusBadge, { backgroundColor: STATUS_COLOR[item.payment_status] }]}>
          <Text style={S.statusText}>{STATUS_LABEL[item.payment_status]}</Text>
        </View>
      </View>

      <View style={S.divider} />

      {/* Card Body */}
      <View style={S.cardBody}>
        <View style={S.salaryRow}>
          <Text style={S.label}>Gross Salary</Text>
          <Text style={S.grossAmount}>{formatCurrency(item.gross_salary)}</Text>
        </View>
        <View style={S.salaryRow}>
          <Text style={S.label}>Deductions</Text>
          <Text style={S.deductionAmount}>– {formatCurrency(item.deductions)}</Text>
        </View>

        <View style={S.dividerLight} />

        <View style={S.salaryRow}>
          <Text style={S.netLabel}>Net Salary</Text>
          <Text style={S.netAmount}>{formatCurrency(item.net_salary)}</Text>
        </View>

        <View style={S.attendanceContainer}>
          <View style={S.attendanceItem}>
            <Ionicons name="checkmark-circle" size={15} color="#10b981" />
            <Text style={S.attendanceText}>{item.present_days} Present</Text>
          </View>
          <View style={S.attendanceItem}>
            <Ionicons name="close-circle" size={15} color="#ef4444" />
            <Text style={S.attendanceText}>{item.absent_days} Absent</Text>
          </View>
          <View style={S.attendanceItem}>
            <Ionicons name="calendar" size={15} color="#f59e0b" />
            <Text style={S.attendanceText}>{item.leaves} Leave</Text>
          </View>
        </View>

        {item.payment_date && (
          <View style={S.paymentDateRow}>
            <Ionicons name="calendar-outline" size={13} color="#64748b" />
            <Text style={S.paymentDateText}>Paid on {formatDate(item.payment_date)}</Text>
          </View>
        )}
      </View>

      <View style={S.cardFooter}>
        <Text style={S.viewDetailsText}>Tap to view details</Text>
        <Ionicons name="chevron-forward" size={15} color="#1e3a8a" />
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => (
    <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
      <View style={S.modalOverlay}>
        <View style={[S.modalContent, { paddingBottom: insets.bottom + 8 }]}>
          {/* Handle */}
          <View style={S.modalHandle} />

          {/* Modal Header */}
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>Payroll Details</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={S.modalClose}>
              <Ionicons name="close" size={22} color="#1e3a8a" />
            </TouchableOpacity>
          </View>

          {selectedPayroll && (
            <ScrollView style={S.modalBody} showsVerticalScrollIndicator={false}>
              {/* Period */}
              <View style={S.modalSection}>
                <Text style={S.modalSectionTitle}>Period</Text>
                <View style={S.modalRow}>
                  <Text style={S.modalLabel}>Month / Year</Text>
                  <Text style={S.modalValue}>{MONTHS[selectedPayroll.month - 1]} {selectedPayroll.year}</Text>
                </View>
              </View>

              {/* Attendance */}
              <View style={S.modalSection}>
                <Text style={S.modalSectionTitle}>Attendance Summary</Text>
                {[
                  { label: 'Total Working Days', value: selectedPayroll.total_working_days.toString(), color: undefined },
                  { label: 'Present Days',        value: selectedPayroll.present_days.toString(),       color: '#10b981' },
                  { label: 'Absent Days',          value: selectedPayroll.absent_days.toString(),        color: '#ef4444' },
                  { label: 'Leaves Taken',         value: selectedPayroll.leaves.toString(),             color: '#f59e0b' },
                ].map(r => (
                  <View key={r.label} style={S.modalRow}>
                    <Text style={S.modalLabel}>{r.label}</Text>
                    <Text style={[S.modalValue, r.color ? { color: r.color } : {}]}>{r.value}</Text>
                  </View>
                ))}
              </View>

              {/* Salary */}
              <View style={S.modalSection}>
                <Text style={S.modalSectionTitle}>Salary Breakdown</Text>
                <View style={S.modalRow}>
                  <Text style={S.modalLabel}>Base Salary</Text>
                  <Text style={S.modalValue}>{formatCurrency(selectedPayroll.base_salary)}</Text>
                </View>
                <View style={S.modalRow}>
                  <Text style={S.modalLabel}>Allowances</Text>
                  <Text style={[S.modalValue, { color: '#10b981' }]}>+ {formatCurrency(selectedPayroll.allowances)}</Text>
                </View>
                <View style={S.modalRow}>
                  <Text style={S.modalLabel}>Gross Salary</Text>
                  <Text style={S.modalValueBold}>{formatCurrency(selectedPayroll.gross_salary)}</Text>
                </View>
                <View style={S.modalRow}>
                  <Text style={S.modalLabel}>Deductions</Text>
                  <Text style={[S.modalValue, { color: '#ef4444' }]}>– {formatCurrency(selectedPayroll.deductions)}</Text>
                </View>
                <View style={S.dividerLight} />
                <View style={S.modalRow}>
                  <Text style={S.modalLabelBold}>Net Salary</Text>
                  <Text style={S.modalNetSalary}>{formatCurrency(selectedPayroll.net_salary)}</Text>
                </View>
              </View>

              {/* Payment Info */}
              <View style={S.modalSection}>
                <Text style={S.modalSectionTitle}>Payment Information</Text>
                <View style={S.modalRow}>
                  <Text style={S.modalLabel}>Status</Text>
                  <View style={[S.statusBadgeSmall, { backgroundColor: STATUS_COLOR[selectedPayroll.payment_status] }]}>
                    <Text style={S.statusTextSmall}>{STATUS_LABEL[selectedPayroll.payment_status]}</Text>
                  </View>
                </View>
                {selectedPayroll.payment_date && (
                  <View style={S.modalRow}>
                    <Text style={S.modalLabel}>Payment Date</Text>
                    <Text style={S.modalValue}>{formatDate(selectedPayroll.payment_date)}</Text>
                  </View>
                )}
                {selectedPayroll.payment_method && (
                  <View style={S.modalRow}>
                    <Text style={S.modalLabel}>Payment Method</Text>
                    <Text style={S.modalValue}>{selectedPayroll.payment_method.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                )}
                {selectedPayroll.transaction_id && (
                  <View style={S.modalRow}>
                    <Text style={S.modalLabel}>Transaction ID</Text>
                    <Text style={S.modalValue}>{selectedPayroll.transaction_id}</Text>
                  </View>
                )}
              </View>

              {selectedPayroll.remarks && (
                <View style={S.modalSection}>
                  <Text style={S.modalSectionTitle}>Remarks</Text>
                  <Text style={S.remarksText}>{selectedPayroll.remarks}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[S.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={S.loadingText}>Loading payrolls...</Text>
      </View>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <View style={S.container}>
      {/* Header */}
      <View style={[S.header, { paddingTop: insets.top + 16 }]}>
        <View style={S.headerTop}>
          <Text style={S.headerTitle}>My Payrolls</Text>
          {authData?.employeeId && <Text style={S.employeeId}>ID: {authData.employeeId}</Text>}
        </View>
        <View style={S.summaryCard}>
          <View style={S.summaryItem}>
            <Text style={S.summaryLabel}>Total Earnings (Paid)</Text>
            <Text style={S.summaryAmount}>{formatCurrency(calculateTotalEarnings())}</Text>
          </View>
          <View style={S.summaryDivider} />
          <View style={S.summaryItem}>
            <Text style={S.summaryLabel}>Records</Text>
            <Text style={S.summaryCount}>{payrolls.length}</Text>
          </View>
        </View>
      </View>

      {/* Year Filter */}
      <View style={S.yearFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.yearFilterContent}>
          {getAvailableYears().map(year => (
            <TouchableOpacity
              key={year}
              style={[S.yearButton, filterYear === year && S.yearButtonActive]}
              onPress={() => setFilterYear(year)}
            >
              <Text style={[S.yearButtonText, filterYear === year && S.yearButtonTextActive]}>{year}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={payrolls}
        renderItem={renderPayrollCard}
        keyExtractor={item => item.id}
        contentContainerStyle={[S.listContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} tintColor="#1e3a8a" />
        }
        ListEmptyComponent={
          <View style={S.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#cbd5e1" />
            <Text style={S.emptyText}>No payroll records found</Text>
            <Text style={S.emptySubText}>
              {filterYear ? `No records for ${filterYear}` : 'Your payroll information will appear here'}
            </Text>
          </View>
        }
      />

      {renderDetailModal()}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#64748b' },

  // Header
  header: { backgroundColor: '#1e3a8a', paddingBottom: 20, paddingHorizontal: 20 },
  headerTop: { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3 },
  employeeId: { fontSize: 13, color: '#e0e7ff', marginTop: 4 },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 16 },
  summaryLabel: { fontSize: 13, color: '#e0e7ff', marginBottom: 6 },
  summaryAmount: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  summaryCount: { fontSize: 22, fontWeight: '800', color: '#ffffff' },

  // Year filter
  yearFilterContainer: { backgroundColor: '#ffffff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  yearFilterContent: { paddingHorizontal: 16, gap: 8 },
  yearButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  yearButtonActive: { backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' },
  yearButtonText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  yearButtonTextActive: { color: '#ffffff' },

  // List
  listContainer: { padding: 16 },

  // Card
  card: {
    backgroundColor: '#ffffff', borderRadius: 14, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc' },
  monthText: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  yearText: { fontSize: 13, color: '#64748b', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  statusText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },

  cardBody: { padding: 16 },
  salaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, color: '#64748b' },
  grossAmount: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  deductionAmount: { fontSize: 13, fontWeight: '500', color: '#ef4444' },
  divider: { height: 1, backgroundColor: '#e2e8f0' },
  dividerLight: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  netLabel: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  netAmount: { fontSize: 20, fontWeight: '800', color: '#1e3a8a' },

  attendanceContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  attendanceItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attendanceText: { fontSize: 12, color: '#64748b' },

  paymentDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  paymentDateText: { fontSize: 12, color: '#64748b' },

  cardFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 11, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 4 },
  viewDetailsText: { fontSize: 12, color: '#1e3a8a', fontWeight: '500' },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#64748b', marginTop: 16 },
  emptySubText: { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalClose: { padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalBody: { paddingHorizontal: 20, paddingTop: 16 },
  modalSection: { marginBottom: 24 },
  modalSectionTitle: { fontSize: 14, fontWeight: '700', color: '#1e3a8a', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalLabel: { fontSize: 13, color: '#64748b' },
  modalLabelBold: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  modalValue: { fontSize: 13, fontWeight: '500', color: '#1e293b' },
  modalValueBold: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  modalNetSalary: { fontSize: 18, fontWeight: '800', color: '#1e3a8a' },
  statusBadgeSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusTextSmall: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  remarksText: { fontSize: 13, color: '#475569', lineHeight: 20, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
});