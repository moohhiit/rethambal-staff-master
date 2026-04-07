import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import StaffDashboard from '../screens/Dashboard/StaffDashboard';
import StudentAttendance from '../screens/Attendance/StudentAttendance';
import Payrolls from '../screens/Payrolls/Payrolls';
import TimetablePage from '../screens/TimeTable/TimeTable';
import UpdateHome from '../screens/HomeWork/UpdateHome';
import ExamManagement from '../screens/Exam/ExamManagment';

export type BottomTabParamList = {
    Dashboard: undefined;
    Attendance: undefined;
    Homework: undefined;
    Timetable: undefined;
    More: undefined;
};

// ─── Tab icon + label config ──────────────────────────────────────────────────

const TAB_ICONS: Record<string, { active: string; inactive: string; label: string }> = {
    Dashboard:  { active: 'home',             inactive: 'home-outline',             label: 'Dashboard'  },
    Attendance: { active: 'checkmark-circle', inactive: 'checkmark-circle-outline', label: 'Attendance' },
    Homework:   { active: 'book',             inactive: 'book-outline',             label: 'Homework'   },
    Timetable:  { active: 'calendar',         inactive: 'calendar-outline',         label: 'Timetable'  },
    More:       { active: 'grid',             inactive: 'grid-outline',             label: 'More'       },
};

// ─── Role-based tab access ────────────────────────────────────────────────────

const TAB_ACCESS: Record<string, string[]> = {
    Dashboard:  ['super_admin', 'admin', 'principal', 'teacher', 'accountant', 'librarian', 'driver', 'peon', 'security', 'lab_assistant', 'nurse', 'office_staff', 'receptionist', 'cleaner'],
    Attendance: ['super_admin', 'admin', 'principal', 'teacher'],
    Homework:   ['super_admin', 'admin', 'principal', 'teacher'],
    Timetable:  ['super_admin', 'admin', 'principal', 'teacher'],
    More:       ['super_admin', 'admin', 'principal', 'teacher', 'accountant', 'librarian', 'driver', 'peon', 'security', 'lab_assistant', 'nurse', 'office_staff', 'receptionist', 'cleaner'],
};

// ─── Navigator ────────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<BottomTabParamList>();

const NativeBottomTabsNavigator: React.FC = () => {
    const [userRole, setUserRole] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUserRole();
    }, []);

    const loadUserRole = async () => {
        try {
            const role = await AsyncStorage.getItem('userRole');
            if (role) setUserRole(role);
        } catch (error) {
            console.error('Error loading user role:', error);
        } finally {
            setLoading(false);
        }
    };

    const canShow = (tabName: string): boolean => {
        if (loading || !userRole) return true;
        return TAB_ACCESS[tabName]?.includes(userRole) ?? false;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1e3a8a" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <Tab.Navigator
            initialRouteName="Dashboard"
            screenOptions={({ route }) => {
                const iconCfg = TAB_ICONS[route.name] ?? { active: 'help', inactive: 'help-outline', label: route.name };

                return {
                    // ── Icon ─────────────────────────────────────────────────────
                    tabBarIcon: ({ focused }) => (
                        <View style={styles.tabIconWrapper}>
                            <Icon
                                name={focused ? iconCfg.active : iconCfg.inactive}
                                size={24}
                                color={focused ? '#1e3a8a' : '#94a3b8'}
                            />
                            {focused && <View style={styles.activeDot} />}
                        </View>
                    ),

                    // ── Label ────────────────────────────────────────────────────
                    tabBarLabel: ({ focused }) => (
                        <Text style={[
                            styles.tabLabel,
                            focused ? styles.tabLabelActive : styles.tabLabelInactive,
                        ]}>
                            {iconCfg.label}
                        </Text>
                    ),

                    tabBarActiveTintColor: '#1e3a8a',
                    tabBarInactiveTintColor: '#94a3b8',
                    tabBarStyle: styles.tabBar,
                    tabBarItemStyle: styles.tabBarItem,
                    tabBarHideOnKeyboard: true,

                    headerShown: false,
                    headerStyle: styles.headerStyle,
                    headerTintColor: '#ffffff',
                    headerTitleStyle: {
                        fontWeight: 'bold' as const,
                        fontSize: 18,
                        color: '#ffffff',
                    },
                };
            }}
        >
            {/* ── Dashboard ────────────────────────────────────────────────── */}
            {canShow('Dashboard') && (
                <Tab.Screen
                    name="Dashboard"
                    component={StaffDashboard}
                    options={{ headerTitle: 'Dashboard' }}
                />
            )}

            {/* ── Attendance ───────────────────────────────────────────────── */}
            {canShow('Attendance') && (
                <Tab.Screen
                    name="Attendance"
                    component={StudentAttendance}
                    options={{ headerTitle: 'Student Attendance' }}
                />
            )}

            {/* ── Homework ─────────────────────────────────────────────────── */}
            {canShow('Homework') && (
                <Tab.Screen
                    name="Homework"
                    component={UpdateHome}
                    options={{
                        headerShown: true,
                        header: () => (
                            <View style={styles.customHeader}>
                                <View style={styles.headerTop}>
                                    <View style={styles.headerTextContainer}>
                                        <Text style={styles.headerTitle}>Homework Management</Text>
                                        <Text style={styles.headerSubtitle}>
                                            Upload and track student homework
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ),
                    }}
                />
            )}

            {/* ── Timetable ────────────────────────────────────────────────── */}
            {canShow('Timetable') && (
                <Tab.Screen
                    name="Timetable"
                    component={TimetablePage}
                    options={{ headerTitle: 'Time Table' }}
                />
            )}

            {/* ── More ─────────────────────────────────────────────────────── */}
            {canShow('More') && (
                <Tab.Screen
                    name="More"
                    component={Payrolls}
                    options={{ headerShown: false }}
                />
            )}
        </Tab.Navigator>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // ── Loading ───────────────────────────────────────────────────────────────
    loadingContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6',
    },
    loadingText: {
        marginTop: 12, fontSize: 16, color: '#64748b', fontWeight: '500',
    },

    // ── Header ────────────────────────────────────────────────────────────────
    headerStyle: {
        backgroundColor: '#1e3a8a',
        elevation: 0,
        shadowOpacity: 0,
    },
    customHeader: {
        backgroundColor: '#1e3a8a',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 16,
        paddingHorizontal: 20,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTextContainer: { flex: 1 },
    headerTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#e0e7ff',
        fontSize: 13,
        marginTop: 4,
    },

    // ── Tab bar ───────────────────────────────────────────────────────────────
    tabBar: {
        backgroundColor: '#ffffff',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#e2e8f0',
        height: Platform.OS === 'ios' ? 88 : 66,
        paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        paddingTop: 6,
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
    },
    tabBarItem: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Tab icon ─────────────────────────────────────────────────────────────
    tabIconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#1e3a8a',
    },

    // ── Tab label ─────────────────────────────────────────────────────────────
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 1,
    },
    tabLabelActive: {
        color: '#1e3a8a',
        fontWeight: '700',
    },
    tabLabelInactive: {
        color: '#94a3b8',
    },
});

export default NativeBottomTabsNavigator;