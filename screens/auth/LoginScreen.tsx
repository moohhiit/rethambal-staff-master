import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { supabase } from '../../services/supabase';
import { CommonActions } from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';

import data from "../../client/clienttinfo.json"


const { width, height } = Dimensions.get('window');

interface StaffLoginScreenProps {
  navigation: any;
}

interface StaffRecord {
  id: string;
  employee_id: string;
  staff_type: string;
  designation: string;
  department: string;
  status: string;
}

interface UserData {
  id: string;
  role: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  photo_url: string;
  password_hash: string;
  fcm_token?: string;
  status: string;
  staff?: StaffRecord[] | StaffRecord | null;
}

// Available roles (excluding student)
const AVAILABLE_ROLES = [
  // { value: 'super_admin', label: 'Super Admin', icon: '👑' },
  // { value: 'admin', label: 'Admin', icon: '⚙️' },
  // { value: 'principal', label: 'Principal', icon: '🎓' },
  { value: 'teacher', label: 'Teacher', icon: '👨‍🏫' },
  // { value: 'accountant', label: 'Accountant', icon: '💰' },
  // { value: 'librarian', label: 'Librarian', icon: '📚' },
  // { value: 'driver', label: 'Driver', icon: '🚌' },
  // { value: 'peon', label: 'Peon', icon: '👷' },
  // { value: 'security', label: 'Security', icon: '🔒' },
  // { value: 'lab_assistant', label: 'Lab Assistant', icon: '🔬' },
  // { value: 'nurse', label: 'Nurse', icon: '💊' },
  // { value: 'office_staff', label: 'Office Staff', icon: '📋' },
  // { value: 'receptionist', label: 'Receptionist', icon: '📞' },
  // { value: 'cleaner', label: 'Cleaner', icon: '🧹' },
  // { value: 'parent', label: 'Parent', icon: '👨‍👩‍👧' },
];

const StaffLoginScreen: React.FC<StaffLoginScreenProps> = ({ navigation }) => {
  const [selectedRole, setSelectedRole] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    const initializeScreen = async () => {
      await loadRememberedCredentials();
      await checkExistingSession();
      await requestNotificationPermission();
    };
    initializeScreen();
  }, []);

  const requestNotificationPermission = async () => {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Notification permission granted');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const getFCMToken = async (): Promise<string | null> => {
    try {
      const token = await messaging().getToken();
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  };

  const updateFCMToken = async (userId: string, fcmToken: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ fcm_token: fcmToken })
        .eq('id', userId);

      if (error) {
        console.error('Error updating FCM token:', error);
        throw error;
      }
      console.log('FCM token updated successfully');
    } catch (error) {
      console.error('Error updating FCM token:', error);
      throw error;
    }
  };

  const checkExistingSession = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      
      if (userData) {
        const user = JSON.parse(userData);
        console.log("User Present:", user);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  const normalizeStaffData = (staff: any): StaffRecord | null => {
    if (!staff) return null;
    
    // Handle array
    if (Array.isArray(staff)) {
      if (staff.length === 0) return null;
      return staff[0];
    }
    
    // Handle single object
    return staff;
  };

  const handleMobileSubmit = async () => {
    // Validation
    if (!selectedRole) {
      Alert.alert('Error', 'Please select your role');
      return;
    }

    if (!mobileNumber.trim()) {
      Alert.alert('Error', 'Please enter your mobile number');
      return;
    }

    // Basic mobile number validation (10 digits)
    const cleanMobile = mobileNumber.trim().replace(/\s+/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);

    try {
      console.log('Searching for user:', { phone: cleanMobile, role: selectedRole });

      // Fetch user data with staff details (if applicable)
      const { data: fetchedUserData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          staff:staff!staff_user_id_fkey(*)
        `)
        .eq('phone', cleanMobile)
        .eq('role', selectedRole);
      
      console.log('Query result:', { fetchedUserData, userError });

      // Handle error
      if (userError) {
        console.error('Database error:', userError);
        Alert.alert('Error', `Database error: ${userError.message}`);
        setLoading(false);
        return;
      }

      // Handle no data
      if (!fetchedUserData || fetchedUserData.length === 0) {
        Alert.alert(
          'User Not Found', 
          `No ${selectedRole.replace(/_/g, ' ')} account found with mobile number ${cleanMobile}.\n\nPlease verify:\n• Mobile number is correct\n• Role selection matches your account\n• Account exists in the system`
        );
        setLoading(false);
        return;
      }

      // Handle multiple users (shouldn't happen but let's be safe)
      if (fetchedUserData.length > 1) {
        console.warn('Multiple users found with same phone and role:', fetchedUserData);
        Alert.alert(
          'Multiple Accounts Found',
          'Multiple accounts found with this mobile number. Please contact admin.\n\nEmail: admin@school.com\nPhone: +91 XXXXXXXXXX'
        );
        setLoading(false);
        return;
      }

      const user = fetchedUserData[0];
      console.log('Found user:', user);
      
      // Check if user account is active
      if (user.status !== 'active') {
        Alert.alert(
          'Account Inactive',
          `Your account status is: ${user.status}\n\nPlease contact administration to activate your account.\n\nEmail: admin@school.com\nPhone: +91 XXXXXXXXXX`
        );
        setLoading(false);
        return;
      }

      // Check if staff record exists and is active (for staff roles)
      const staffRoles = [
        'teacher', 'principal', 'accountant', 'librarian', 
        'driver', 'peon', 'security', 'lab_assistant', 
        'nurse', 'office_staff', 'receptionist', 'cleaner',
        'admin', 'super_admin'
      ];

      if (staffRoles.includes(user.role)) {
        const staffRecord = normalizeStaffData(user.staff);
        
        if (!staffRecord) {
          Alert.alert(
            'Staff Record Not Found',
            'Your user account exists but staff record is missing. Please contact admin.\n\nEmail: admin@school.com\nPhone: +91 XXXXXXXXXX'
          );
          setLoading(false);
          return;
        }

        if (staffRecord.status !== 'active') {
          Alert.alert(
            'Staff Record Inactive',
            `Your staff record status is: ${staffRecord.status}\n\nPlease contact administration.\n\nEmail: admin@school.com\nPhone: +91 XXXXXXXXXX`
          );
          setLoading(false);
          return;
        }
      }

      // Set user data and show modal
      setUserData(user);
      setShowStaffModal(true);
      setLoading(false);

    } catch (error: any) {
      console.error('Error fetching user data:', error);
      Alert.alert(
        'Error',
        error.message || 'Unable to fetch user details. Please try again.'
      );
      setLoading(false);
    }
  };

  const handleModalConfirm = async () => {
    if (!selectedOption) {
      Alert.alert('Error', 'Please select a login purpose');
      return;
    }

    if (!userData) {
      Alert.alert('Error', 'User data not found');
      return;
    }

    setModalLoading(true);

    try {
      // Check if FCM token already exists
      if (userData.fcm_token && userData.fcm_token.trim() !== '') {
        Alert.alert(
          'Device Already Registered',
          'This account is already logged in on another device. Do you want to logout from other device and login here?',
          [
            {
              text: 'Cancel',
              onPress: () => {
                setModalLoading(false);
                setShowStaffModal(false);
                setSelectedOption('');
              },
              style: 'cancel',
            },
            {
              text: 'Login Here',
              onPress: async () => {
                try {
                  // Force login by clearing old FCM token
                  await proceedWithLogin();
                } catch (error: any) {
                  console.error('Login error:', error);
                  setModalLoading(false);
                  Alert.alert('Error', error.message || 'Login failed. Please try again.');
                }
              },
            },
          ]
        );
        return;
      }

      // No existing token, proceed with login
      await proceedWithLogin();

    } catch (error: any) {
      console.error('Login error:', error);
      setModalLoading(false);
      Alert.alert(
        'Error',
        error.message || 'Unable to complete login. Please try again.'
      );
    }
  };

  const proceedWithLogin = async () => {
    if (!userData) return;

    try {
      // Get FCM token
      const fcmToken = await getFCMToken();

      if (!fcmToken) {
        Alert.alert(
          'Notification Error',
          'Unable to get device token. Notifications may not work properly. Continue anyway?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setModalLoading(false) },
            { text: 'Continue', onPress: () => completeLogin(null) },
          ]
        );
        return;
      }

      await completeLogin(fcmToken);
    } catch (error) {
      throw error;
    }
  };

  const completeLogin = async (fcmToken: string | null) => {
    if (!userData) return;

    try {
      // Get device information
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        loginTime: new Date().toISOString(),
        selectedPurpose: selectedOption,
        mobileNumber: mobileNumber.trim(),
        role: selectedRole,
      };

      // Update FCM token in database if available
      if (fcmToken) {
        await updateFCMToken(userData.id, fcmToken);
      }

      // Generate auth token
      const authToken = `${userData.id}_${Date.now()}_${Math.random().toString(36)}`;
      const tokenExpiry = new Date().getTime() + (30 * 24 * 60 * 60 * 1000);

      // Update user's last login
      await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString()
        })
        .eq('id', userData.id);

      // Normalize staff data
      const staffRecord = normalizeStaffData(userData.staff);

      // Remove password_hash from user data before storing
      const { password_hash, staff, ...userWithoutPassword } = userData;
      const userDataToStore = {
        ...userWithoutPassword,
        fcm_token: fcmToken || '',
        staff: staffRecord,
      };

      // Prepare storage data
      const storageData: Array<[string, string]> = [
        ['authToken', authToken],
        ['tokenExpiry', tokenExpiry.toString()],
        ['userData', JSON.stringify(userDataToStore)],
        ['userRole', userData.role],
        ['userId', userData.id],
        ['mobileNumber', mobileNumber.trim()],
        ['selectedOption', selectedOption],
        ['deviceInfo', JSON.stringify(deviceInfo)],
        ['loginTime', new Date().toISOString()],
      ];

      if (fcmToken) {
        storageData.push(['fcmToken', fcmToken]);
      }

      // Add staff-specific data if available
      if (staffRecord) {
        storageData.push(['staffId', staffRecord.id]);
        storageData.push(['employeeId', staffRecord.employee_id]);
      }

      await AsyncStorage.multiSet(storageData);

      // Handle remember me
      if (rememberMe) {
        await AsyncStorage.multiSet([
          ['rememberedMobileNumber', mobileNumber.trim()],
          ['rememberedRole', selectedRole],
        ]);
      } else {
        await AsyncStorage.multiRemove(['rememberedMobileNumber', 'rememberedRole']);
      }
      
      setModalLoading(false);
      setShowStaffModal(false);
      setSelectedOption('');

      // Navigate using CommonActions.reset - this will properly reset the navigation state
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        })
      );

      // Show success message after navigation
      setTimeout(() => {
        Alert.alert(
          'Login Successful', 
          `Welcome back, ${userData.first_name}!`,
          [{ text: 'OK' }]
        );
      }, 500);

    } catch (error: any) {
      console.error('Complete login error:', error);
      throw error;
    }
  };

  const loadRememberedCredentials = async () => {
    try {
      const [rememberedMobile, rememberedRole] = await AsyncStorage.multiGet([
        'rememberedMobileNumber',
        'rememberedRole',
      ]);
      
      if (rememberedMobile[1]) {
        setMobileNumber(rememberedMobile[1]);
        setRememberMe(true);
      }
      
      if (rememberedRole[1]) {
        setSelectedRole(rememberedRole[1]);
      }
    } catch (error) {
      console.error('Error loading remembered credentials:', error);
    }
  };

  const handleBiometricLogin = async () => {
    Alert.alert('Coming Soon', 'Biometric login will be available in the next update.');
  };

  const closeModal = () => {
    if (!modalLoading) {
      setShowStaffModal(false);
      setSelectedOption('');
      setUserData(null);
    }
  };

  const closeRoleModal = () => {
    setShowRoleModal(false);
  };

  const selectRole = (role: string) => {
    setSelectedRole(role);
    setShowRoleModal(false);
  };

  const getSelectedRoleLabel = () => {
    const role = AVAILABLE_ROLES.find(r => r.value === selectedRole);
    return role ? `${role.icon} ${role.label}` : 'Select Role';
  };

  const getStaffInfo = () => {
    if (!userData) return null;
    return normalizeStaffData(userData.staff);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section with Gradient Background */}
          <View style={styles.headerSection}>
            <View style={styles.headerGradient}>
              {/* Logo Container */}
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <Image
                    source={{uri : data.Icon }}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.schoolName}>{data.Name}</Text>
                <Text style={styles.subtitle}>Staff Portal</Text>
              </View>
            </View>
            
            {/* Curved Bottom */}
            <View style={styles.curvedBottom} />
          </View>

          {/* Login Form Container */}
          <View style={styles.formContainer}>
            <View style={styles.formCard}>
              <Text style={styles.welcomeText}>Welcome Back!</Text>
              <Text style={styles.loginText}>Select your role and enter mobile number</Text>

              {/* Role Selection */}
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowRoleModal(true)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <View style={styles.inputIconContainer}>
                  <Text style={styles.inputIcon}>👤</Text>
                </View>
                <Text style={[styles.roleText, !selectedRole && styles.placeholderText]}>
                  {getSelectedRoleLabel()}
                </Text>
                <View style={styles.dropdownIcon}>
                  <Text style={styles.dropdownIconText}>▼</Text>
                </View>
              </TouchableOpacity>

              {/* Mobile Number Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Text style={styles.inputIcon}>📱</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Mobile Number"
                  placeholderTextColor="#9ca3af"
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleMobileSubmit}
                />
              </View>

              {/* Remember Me */}
              <View style={styles.rememberMeRow}>
                <TouchableOpacity
                  style={styles.rememberMeContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.rememberMeText}>Remember Me</Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleMobileSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>Continue</Text>
                )}
              </TouchableOpacity>

              {/* Additional Options */}
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.divider} />
              </View>

              {/* Biometric Login Option */}
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricLogin}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.biometricIcon}>🔐</Text>
                <Text style={styles.biometricText}>Login with Biometric</Text>
              </TouchableOpacity>
            </View>

            {/* Help Section */}
            <View style={styles.helpSection}>
              <Text style={styles.helpText}>Need help? Contact Admin</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.contactText}>📞 +91 {data.Contect.Phone}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © 2026 Rethambal. All rights reserved.
            </Text>
            <Text style={styles.versionText}>{DeviceInfo.getVersion()}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Role Selection Modal */}
      <Modal
        visible={showRoleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeRoleModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.roleModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Your Role</Text>
              <TouchableOpacity onPress={closeRoleModal} activeOpacity={0.7}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {AVAILABLE_ROLES.map((role) => (
                <TouchableOpacity
                  key={role.value}
                  style={[
                    styles.roleOption,
                    selectedRole === role.value && styles.roleOptionSelected
                  ]}
                  onPress={() => selectRole(role.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.roleOptionIcon}>{role.icon}</Text>
                  <Text style={[
                    styles.roleOptionText,
                    selectedRole === role.value && styles.roleOptionTextSelected
                  ]}>
                    {role.label}
                  </Text>
                  {selectedRole === role.value && (
                    <Text style={styles.selectedIcon}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* User Details Confirmation Modal */}
      <Modal
        visible={showStaffModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Your Details</Text>
                <TouchableOpacity onPress={closeModal} disabled={modalLoading} activeOpacity={0.7}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* User Photo */}
              {userData?.photo_url && (
                <View style={styles.modalPhotoContainer}>
                  <Image
                    source={{ uri: userData.photo_url }}
                    style={styles.modalPhoto}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* User Details */}
              {userData && (
                <View style={styles.detailsContainer}>
                  <DetailRow label="Name" value={`${userData.first_name} ${userData.last_name}`} />
                  <DetailRow label="Role" value={userData.role.replace(/_/g, ' ').toUpperCase()} />
                  {getStaffInfo() && (
                    <>
                      <DetailRow label="Employee ID" value={getStaffInfo()!.employee_id} />
                      <DetailRow label="Designation" value={getStaffInfo()!.designation || 'N/A'} />
                      <DetailRow label="Department" value={getStaffInfo()!.department || 'N/A'} />
                      <DetailRow label="Staff Type" value={getStaffInfo()!.staff_type.replace(/_/g, ' ')} />
                    </>
                  )}
                  <DetailRow label="Email" value={userData.email || 'N/A'} />
                  <DetailRow label="Phone" value={userData.phone || 'N/A'} />
                  <DetailRow label="Status" value={userData.status.toUpperCase()} />
                </View>
              )}

              {/* Selection Options */}
              <View style={styles.optionsContainer}>
                <Text style={styles.optionsTitle}>Select Login Purpose:</Text>
                               
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    selectedOption === 'general' && styles.optionButtonSelected
                  ]}
                  onPress={() => setSelectedOption('general')}
                  disabled={modalLoading}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <Text style={styles.optionIcon}>🏫</Text>
                    <View style={styles.optionTextContainer}>
                      <Text style={[
                        styles.optionLabel,
                        selectedOption === 'general' && styles.optionLabelSelected
                      ]}>
                        General Access
                      </Text>
                      <Text style={styles.optionDescription}>
                        Full access to all features
                      </Text>
                    </View>
                  </View>
                  {selectedOption === 'general' && (
                    <Text style={styles.selectedIcon}>✓</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!selectedOption || modalLoading) && styles.confirmButtonDisabled
                ]}
                onPress={handleModalConfirm}
                disabled={!selectedOption || modalLoading}
                activeOpacity={0.8}
              >
                {modalLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm & Login</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Helper component for detail rows
const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerSection: {
    position: 'relative',
    height: height * 0.35,
  },
  headerGradient: {
    flex: 1,
    backgroundColor: data.style.color.background,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  curvedBottom: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  schoolName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#cbd5e1',
    marginTop: 4,
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: -40,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  loginText: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 56,
  },
  inputIconContainer: {
    width: 50,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputIcon: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    paddingRight: 16,
  },
  roleText: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    paddingRight: 16,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  dropdownIcon: {
    width: 50,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownIconText: {
    fontSize: 12,
    color: '#64748b',
  },
  rememberMeRow: {
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: data.style.color.background,
    borderColor: data.style.color.background,
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rememberMeText: {
    fontSize: 14,
    color: '#64748b',
  },
  loginButton: {
    backgroundColor: data.style.color.background,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  biometricIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  biometricText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '600',
  },
  helpSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  helpText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#1e3a8a',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 4,
  },
  versionText: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: width * 0.9,
    maxHeight: height * 0.7,
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: width * 0.9,
    maxHeight: height * 0.85,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    fontSize: 24,
    color: '#64748b',
    fontWeight: 'bold',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  roleOptionSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#1e3a8a',
  },
  roleOptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  roleOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  roleOptionTextSelected: {
    color: '#1e3a8a',
  },
  modalPhotoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#1e3a8a',
  },
  detailsContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1e293b',
    flex: 2,
    textAlign: 'right',
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  optionButtonSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#1e3a8a',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: '#1e3a8a',
  },
  optionDescription: {
    fontSize: 12,
    color: '#64748b',
  },
  selectedIcon: {
    fontSize: 20,
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#1e3a8a',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default StaffLoginScreen;