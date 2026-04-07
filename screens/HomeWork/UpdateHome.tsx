import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, ActivityIndicator, Alert, StyleSheet, Platform, StatusBar } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../services/supabase';

// Types based on schema
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

interface TodayClass {
  id: string;
  class_id: string;
  subject_id: string;
  period_id: string;
  day: string;
  grade_name: string;
  section_name: string;
  subject_name: string;
  subject_code: string;
  period_number: number;
  start_time: string;
  end_time: string;
  room_number: string;
}

interface Homework {
  id: string;
  date: string;
  subject_id: string;
  class_id: string;
  title: string;
  description: string;
  status: string;
  subject_name: string;
  class_name: string;
  total_students: number;
  submitted_count: number;
  created_at: string;
}

interface HomeworkSubmission {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  status: 'Pending' | 'Submitted' | 'Late';
  submitted_at: string | null;
  remarks: string | null;
}

export default function HomeworkManagement({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'upload' | 'mark' | 'track'>('upload');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // User Info
  const [staffId, setStaffId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  
  // Upload Form States
  const [selectedClass, setSelectedClass] = useState<TodayClass | null>(null);
  const [homeworkDate, setHomeworkDate] = useState(new Date());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Data States
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [yesterdayHomework, setYesterdayHomework] = useState<Homework[]>([]);
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  
  // Dropdown States
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (staffId) {
      fetchTodayClasses();
      fetchYesterdayHomework();
      fetchHomeworkList();
    }
  }, [staffId]);

  const loadUserData = async () => {
    try {
      const [storedStaffId, storedUserId] = await Promise.all([
        AsyncStorage.getItem('staffId'),
        AsyncStorage.getItem('userId'),
      ]);
      
      if (storedStaffId) setStaffId(storedStaffId);
      if (storedUserId) setUserId(storedUserId);

      if (!storedStaffId) {
        Alert.alert('Error', 'Staff ID not found. Please login again.');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user information');
    }
  };

  const fetchTodayClasses = async () => {
    if (!staffId) return;

    try {
      setLoading(true);
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      
      const { data: timetableData, error: timetableError } = await supabase
        .from('timetable')
        .select(`
          id,
          class_id,
          subject_id,
          period_id,
          day,
          classes!timetable_class_id_fkey(
            id,
            room_number,
            grades!classes_grade_id_fkey(grade),
            sections!classes_section_id_fkey(section)
          ),
          subjects!timetable_subject_id_fkey(
            id,
            name,
            code
          ),
          periods!timetable_period_id_fkey(
            id,
            period_number,
            start_time,
            end_time
          )
        `)
        .eq('staff_id', staffId)
        .eq('day', today);

      if (timetableError) throw timetableError;

      const transformedClasses: TodayClass[] = (timetableData || []).map((item: any) => ({
        id: item.id,
        class_id: item.class_id,
        subject_id: item.subject_id,
        period_id: item.period_id,
        day: item.day,
        grade_name: item.classes?.grades?.grade || '',
        section_name: item.classes?.sections?.section || '',
        subject_name: item.subjects?.name || '',
        subject_code: item.subjects?.code || '',
        period_number: item.periods?.period_number || 0,
        start_time: item.periods?.start_time || '',
        end_time: item.periods?.end_time || '',
        room_number: item.classes?.room_number || '',
      }));

      transformedClasses.sort((a, b) => a.period_number - b.period_number);
      
      setTodayClasses(transformedClasses);
    } catch (error) {
      console.error('Error fetching today classes:', error);
      Alert.alert('Error', 'Failed to load today\'s classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchYesterdayHomework = async () => {
    if (!staffId) return;

    try {
      setLoading(true);
      
      // Get yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];
      
      const { data: homeworkData, error: homeworkError } = await supabase
        .from('homework')
        .select(`
          id,
          date,
          subject_id,
          class_id,
          title,
          description,
          status,
          created_at,
          subjects!homework_subject_id_fkey(name),
          classes!homework_class_id_fkey(
            id,
            grades!classes_grade_id_fkey(grade),
            sections!classes_section_id_fkey(section)
          )
        `)
        .eq('staff_id', staffId)
        .eq('date', yesterdayDate)
        .order('created_at', { ascending: false });

      if (homeworkError) throw homeworkError;

      const homeworkWithCounts = await Promise.all(
        (homeworkData || []).map(async (hw: any) => {
          const { count: totalStudents } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', hw.class_id)
            .eq('status', 'active');

          const { count: submittedCount } = await supabase
            .from('homework_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('homework_id', hw.id)
            .eq('status', 'Submitted');

          return {
            id: hw.id,
            date: hw.date,
            subject_id: hw.subject_id,
            class_id: hw.class_id,
            title: hw.title,
            description: hw.description,
            status: hw.status,
            subject_name: hw.subjects?.name || 'Unknown Subject',
            class_name: `${hw.classes?.grades?.grade || ''} ${hw.classes?.sections?.section || ''}`.trim(),
            total_students: totalStudents || 0,
            submitted_count: submittedCount || 0,
            created_at: hw.created_at,
          };
        })
      );

      setYesterdayHomework(homeworkWithCounts);
    } catch (error) {
      console.error('Error fetching yesterday homework:', error);
      Alert.alert('Error', 'Failed to load yesterday\'s homework');
    } finally {
      setLoading(false);
    }
  };

  const fetchHomeworkList = async () => {
    if (!staffId) return;

    try {
      setLoading(true);
      
      const { data: homeworkData, error: homeworkError } = await supabase
        .from('homework')
        .select(`
          id,
          date,
          subject_id,
          class_id,
          title,
          description,
          status,
          created_at,
          subjects!homework_subject_id_fkey(name),
          classes!homework_class_id_fkey(
            id,
            grades!classes_grade_id_fkey(grade),
            sections!classes_section_id_fkey(section)
          )
        `)
        .eq('staff_id', staffId)
        .order('date', { ascending: false })
        .limit(20);

      if (homeworkError) throw homeworkError;

      const homeworkWithCounts = await Promise.all(
        (homeworkData || []).map(async (hw: any) => {
          const { count: totalStudents } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', hw.class_id)
            .eq('status', 'active');

          const { count: submittedCount } = await supabase
            .from('homework_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('homework_id', hw.id)
            .eq('status', 'Submitted');

          return {
            id: hw.id,
            date: hw.date,
            subject_id: hw.subject_id,
            class_id: hw.class_id,
            title: hw.title,
            description: hw.description,
            status: hw.status,
            subject_name: hw.subjects?.name || 'Unknown Subject',
            class_name: `${hw.classes?.grades?.grade || ''} ${hw.classes?.sections?.section || ''}`.trim(),
            total_students: totalStudents || 0,
            submitted_count: submittedCount || 0,
            created_at: hw.created_at,
          };
        })
      );

      setHomeworkList(homeworkWithCounts);
    } catch (error) {
      console.error('Error fetching homework list:', error);
      Alert.alert('Error', 'Failed to load homework list');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (homeworkId: string) => {
    try {
      setLoading(true);
      
      const homework = [...yesterdayHomework, ...homeworkList].find(hw => hw.id === homeworkId);
      if (!homework) return;

      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          admission_number,
          users!students_user_id_fkey(
            first_name,
            last_name
          )
        `)
        .eq('class_id', homework.class_id)
        .eq('status', 'active')
        .order('admission_number', { ascending: true });

      if (studentsError) throw studentsError;

      const { data: existingSubmissions, error: submissionsError } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('homework_id', homeworkId);

      if (submissionsError) throw submissionsError;

      const submissionMap = new Map(
        (existingSubmissions || []).map(sub => [sub.student_id, sub])
      );

      const allSubmissions: HomeworkSubmission[] = (students || []).map((student: any) => {
        const submission = submissionMap.get(student.id);
        const firstName = student.users?.first_name || '';
        const lastName = student.users?.last_name || '';
        
        return {
          id: submission?.id || `pending-${student.id}`,
          student_id: student.id,
          student_name: `${firstName} ${lastName}`.trim(),
          admission_number: student.admission_number,
          status: submission?.status || 'Pending',
          submitted_at: submission?.submitted_at || null,
          remarks: submission?.remarks || null,
        };
      });

      allSubmissions.sort((a, b) => {
        if (a.status === 'Submitted' && b.status !== 'Submitted') return -1;
        if (a.status !== 'Submitted' && b.status === 'Submitted') return 1;
        return a.student_name.localeCompare(b.student_name);
      });

      setSubmissions(allSubmissions);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      Alert.alert('Error', 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSubmission = async (submissionId: string, studentId: string, currentStatus: string) => {
    const homework = selectedHomework;
    if (!homework) return;

    const newStatus = currentStatus === 'Submitted' ? 'Pending' : 'Submitted';

    try {
      setLoading(true);

      // Check if submission record exists
      const isNewSubmission = submissionId.startsWith('pending-');

      if (isNewSubmission) {
        // Create new submission record
        const { error: insertError } = await supabase
          .from('homework_submissions')
          .insert({
            homework_id: homework.id,
            student_id: studentId,
            status: newStatus,
            submitted_at: newStatus === 'Submitted' ? new Date().toISOString() : null,
          });

        if (insertError) throw insertError;
      } else {
        // Update existing submission
        const { error: updateError } = await supabase
          .from('homework_submissions')
          .update({
            status: newStatus,
            submitted_at: newStatus === 'Submitted' ? new Date().toISOString() : null,
          })
          .eq('id', submissionId);

        if (updateError) throw updateError;
      }

      // Refresh submissions
      await fetchSubmissions(homework.id);
      await fetchYesterdayHomework();

      Alert.alert(
        'Success',
        `Marked as ${newStatus}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error marking submission:', error);
      Alert.alert('Error', 'Failed to update submission status');
    } finally {
      setLoading(false);
    }
  };

  const handleClassSelect = (classItem: TodayClass) => {
    setSelectedClass(classItem);
    setShowClassDropdown(false);
  };

  const handleUploadHomework = async () => {
    if (!selectedClass || !title.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Please fill all required fields');
      return;
    }

    try {
      setLoading(true);

      const { data: newHomework, error: insertError } = await supabase
        .from('homework')
        .insert({
          date: homeworkDate.toISOString().split('T')[0],
          subject_id: selectedClass.subject_id,
          class_id: selectedClass.class_id,
          staff_id: staffId,
          title: title.trim(),
          description: description.trim(),
          status: 'Published',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', selectedClass.class_id)
        .eq('status', 'active');

      if (studentsError) throw studentsError;

      if (students && students.length > 0) {
        const submissions = students.map(student => ({
          homework_id: newHomework.id,
          student_id: student.id,
          status: 'Pending',
        }));

        const { error: submissionsError } = await supabase
          .from('homework_submissions')
          .insert(submissions);

        if (submissionsError) throw submissionsError;
      }

      Alert.alert('Success', 'Homework uploaded successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setTitle('');
            setDescription('');
            setSelectedClass(null);
            setHomeworkDate(new Date());
            
            fetchHomeworkList();
            fetchYesterdayHomework();
          },
        },
      ]);
    } catch (error) {
      console.error('Error uploading homework:', error);
      Alert.alert('Error', 'Failed to upload homework. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSubmissions = (homework: Homework) => {
    setSelectedHomework(homework);
    fetchSubmissions(homework.id);
    setShowModal(true);
  };

  const onRefreshUpload = useCallback(async () => {
    setRefreshing(true);
    await fetchTodayClasses();
    setRefreshing(false);
  }, [staffId]);

  const onRefreshMark = useCallback(async () => {
    setRefreshing(true);
    await fetchYesterdayHomework();
    setRefreshing(false);
  }, [staffId]);

  const onRefreshTrack = useCallback(async () => {
    setRefreshing(true);
    await fetchHomeworkList();
    setRefreshing(false);
  }, [staffId]);

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const renderUploadTab = () => (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Upload Homework for Today's Classes</Text>
          <TouchableOpacity onPress={fetchTodayClasses} disabled={loading}>
            <Icon name="refresh" size={20} color="#1E3A8A" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Select Class & Subject (Today's Periods) *</Text>
          <TouchableOpacity
            onPress={() => setShowClassDropdown(!showClassDropdown)}
            style={styles.dropdown}
          >
            <View style={styles.dropdownContent}>
              {selectedClass ? (
                <View>
                  <Text style={styles.dropdownText}>
                    {selectedClass.grade_name} {selectedClass.section_name} - {selectedClass.subject_name}
                  </Text>
                  <Text style={styles.dropdownSubtext}>
                    Period {selectedClass.period_number} • {formatTime(selectedClass.start_time)} - {formatTime(selectedClass.end_time)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.dropdownPlaceholder}>Choose from today's schedule</Text>
              )}
            </View>
            <Icon name={showClassDropdown ? "chevron-up" : "chevron-down"} size={20} color="#64748B" />
          </TouchableOpacity>
          
          {showClassDropdown && (
            <View style={styles.dropdownList}>
              {todayClasses.length === 0 ? (
                <View style={styles.emptyDropdown}>
                  <Icon name="calendar-remove" size={32} color="#CBD5E1" />
                  <Text style={styles.emptyDropdownText}>No classes scheduled for today</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  {todayClasses.map((classItem) => (
                    <TouchableOpacity
                      key={classItem.id}
                      onPress={() => handleClassSelect(classItem)}
                      style={styles.dropdownItem}
                    >
                      <View style={styles.periodBadge}>
                        <Text style={styles.periodBadgeText}>P{classItem.period_number}</Text>
                      </View>
                      <View style={styles.dropdownItemContent}>
                        <Text style={styles.dropdownItemText}>
                          {classItem.grade_name} {classItem.section_name} - {classItem.subject_name}
                        </Text>
                        <Text style={styles.dropdownItemSubtext}>
                          {formatTime(classItem.start_time)} - {formatTime(classItem.end_time)} • Room {classItem.room_number}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Homework Date *</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={styles.dropdown}
          >
            <Icon name="calendar" size={20} color="#64748B" />
            <Text style={styles.dropdownText}>
              {homeworkDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker
              value={homeworkDate}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setHomeworkDate(selectedDate);
              }}
            />
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Complete Chapter 5 Exercises"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Enter detailed instructions for students..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={[styles.input, styles.textArea]}
          />
        </View>

        <TouchableOpacity
          onPress={handleUploadHomework}
          disabled={loading || !selectedClass || !title.trim() || !description.trim()}
          style={[
            styles.button, 
            (loading || !selectedClass || !title.trim() || !description.trim()) && styles.buttonDisabled
          ]}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Icon name="cloud-upload" size={20} color="white" />
              <Text style={styles.buttonText}>Upload Homework</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderMarkTab = () => (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Mark Yesterday's Homework</Text>
          <TouchableOpacity onPress={fetchYesterdayHomework} disabled={loading}>
            <Icon name="refresh" size={20} color="#1E3A8A" />
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E3A8A" />
            <Text style={styles.loadingText}>Loading homework...</Text>
          </View>
        ) : yesterdayHomework.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="clipboard-check-outline" size={80} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No homework assigned yesterday</Text>
            <Text style={styles.emptyStateSubtext}>Yesterday's homework will appear here</Text>
          </View>
        ) : (
          yesterdayHomework.map((homework) => {
            const completionRate = homework.total_students > 0 
              ? ((homework.submitted_count / homework.total_students) * 100).toFixed(0)
              : 0;
            
            return (
              <View key={homework.id} style={styles.homeworkCard}>
                <View style={styles.homeworkHeader}>
                  <View style={styles.homeworkInfo}>
                    <Text style={styles.homeworkTitle}>{homework.title}</Text>
                    <Text style={styles.homeworkSubtext}>
                      {homework.subject_name} • {homework.class_name}
                    </Text>
                    <Text style={styles.homeworkSubtext}>
                      Date: {new Date(homework.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Icon name="calendar-clock" size={16} color="#F59E0B" />
                    <Text style={styles.badgeTextOrange}>Yesterday</Text>
                  </View>
                </View>
                
                <Text style={styles.homeworkDescription} numberOfLines={2}>
                  {homework.description}
                </Text>
                
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${completionRate}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>{completionRate}%</Text>
                </View>
                
                <View style={styles.homeworkFooter}>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Icon name="check-circle" size={16} color="#10B981" />
                      <Text style={styles.statValueGreen}>
                        {homework.submitted_count}/{homework.total_students}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Icon name="clock-alert-outline" size={16} color="#F59E0B" />
                      <Text style={styles.statValueOrange}>
                        {homework.total_students - homework.submitted_count}
                      </Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    onPress={() => handleViewSubmissions(homework)}
                    style={styles.markButton}
                  >
                    <Icon name="pencil" size={16} color="white" />
                    <Text style={styles.viewButtonText}>Mark</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );

  const renderTrackTab = () => (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Track Homework Submissions</Text>
          <TouchableOpacity onPress={fetchHomeworkList} disabled={loading}>
            <Icon name="refresh" size={20} color="#1E3A8A" />
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E3A8A" />
            <Text style={styles.loadingText}>Loading homework...</Text>
          </View>
        ) : homeworkList.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="file-document-outline" size={80} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No homework found</Text>
            <Text style={styles.emptyStateSubtext}>Upload homework to see it here</Text>
          </View>
        ) : (
          homeworkList.map((homework) => {
            const completionRate = homework.total_students > 0 
              ? ((homework.submitted_count / homework.total_students) * 100).toFixed(0)
              : 0;
            
            return (
              <View key={homework.id} style={styles.homeworkCard}>
                <View style={styles.homeworkHeader}>
                  <View style={styles.homeworkInfo}>
                    <Text style={styles.homeworkTitle}>{homework.title}</Text>
                    <Text style={styles.homeworkSubtext}>
                      {homework.subject_name} • {homework.class_name}
                    </Text>
                    <Text style={styles.homeworkSubtext}>
                      Date: {new Date(homework.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={[
                    styles.badge, 
                    homework.status === 'Published' ? styles.badgeSuccess : styles.badgeGray
                  ]}>
                    <Text style={[
                      styles.badgeText, 
                      homework.status === 'Published' ? styles.badgeTextSuccess : styles.badgeTextGray
                    ]}>
                      {homework.status}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.homeworkDescription} numberOfLines={2}>
                  {homework.description}
                </Text>
                
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${completionRate}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>{completionRate}%</Text>
                </View>
                
                <View style={styles.homeworkFooter}>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Icon name="check-circle" size={16} color="#10B981" />
                      <Text style={styles.statValueGreen}>
                        {homework.submitted_count}/{homework.total_students}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Icon name="clock-alert-outline" size={16} color="#F59E0B" />
                      <Text style={styles.statValueOrange}>
                        {homework.total_students - homework.submitted_count}
                      </Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    onPress={() => handleViewSubmissions(homework)}
                    style={styles.viewButton}
                  >
                    <Icon name="eye" size={16} color="white" />
                    <Text style={styles.viewButtonText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );

  const renderSubmissionsModal = () => (
    <Modal
      visible={showModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInfo}>
              <Text style={styles.modalTitle}>{selectedHomework?.title}</Text>
              <Text style={styles.modalSubtitle}>
                {selectedHomework?.subject_name} • {selectedHomework?.class_name}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeButton}>
              <Icon name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsContainer}>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Icon name="account-group" size={24} color="#64748B" />
              <Text style={styles.statNumber}>{selectedHomework?.total_students}</Text>
              <Text style={styles.statText}>Total</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Icon name="check-circle" size={24} color="#10B981" />
              <Text style={[styles.statNumber, styles.statNumberGreen]}>
                {selectedHomework?.submitted_count}
              </Text>
              <Text style={styles.statText}>Submitted</Text>
            </View>
            <View style={styles.statBox}>
              <Icon name="clock-alert" size={24} color="#F59E0B" />
              <Text style={[styles.statNumber, styles.statNumberOrange]}>
                {selectedHomework ? selectedHomework.total_students - selectedHomework.submitted_count : 0}
              </Text>
              <Text style={styles.statText}>Pending</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1E3A8A" />
              <Text style={styles.loadingText}>Loading submissions...</Text>
            </View>
          ) : (
            <FlatList
              data={submissions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => (
                <View style={styles.submissionCard}>
                  <View style={styles.submissionHeader}>
                    <View style={styles.submissionInfo}>
                      <Text style={styles.studentName}>{item.student_name}</Text>
                      <Text style={styles.admissionNumber}>Adm No: {item.admission_number}</Text>
                    </View>
                    
                    <TouchableOpacity
                      onPress={() => handleMarkSubmission(item.id, item.student_id, item.status)}
                      style={[
                        styles.markStatusButton,
                        item.status === 'Submitted' ? styles.markStatusButtonGreen : styles.markStatusButtonRed
                      ]}
                      disabled={loading}
                    >
                      <Icon 
                        name={item.status === 'Submitted' ? 'check-circle' : 'close-circle'} 
                        size={18} 
                        color="white" 
                      />
                      <Text style={styles.markStatusButtonText}>
                        {item.status === 'Submitted' ? 'Submitted' : 'Pending'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {item.submitted_at && (
                    <View style={styles.timeRow}>
                      <Icon name="clock-outline" size={14} color="#64748B" />
                      <Text style={styles.timeText}>
                        Submitted: {new Date(item.submitted_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  )}
                  
                  {item.remarks && (
                    <View style={styles.remarksBox}>
                      <Icon name="message-text" size={14} color="#1E3A8A" />
                      <Text style={styles.remarksText}>{item.remarks}</Text>
                    </View>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Icon name="account-off" size={64} color="#CBD5E1" />
                  <Text style={styles.emptyStateText}>No students found</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.screen}>
     
      

      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setActiveTab('upload')}
          style={[styles.tab, activeTab === 'upload' && styles.tabActive]}
        >
          <View style={styles.tabContent}>
            <Icon 
              name="cloud-upload" 
              size={20} 
              color={activeTab === 'upload' ? '#1E3A8A' : '#64748B'} 
            />
            <Text style={[styles.tabText, activeTab === 'upload' && styles.tabTextActive]}>
              Upload
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setActiveTab('mark')}
          style={[styles.tab, activeTab === 'mark' && styles.tabActive]}
        >
          <View style={styles.tabContent}>
            <Icon 
              name="pencil-box" 
              size={20} 
              color={activeTab === 'mark' ? '#1E3A8A' : '#64748B'} 
            />
            <Text style={[styles.tabText, activeTab === 'mark' && styles.tabTextActive]}>
              Mark
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setActiveTab('track')}
          style={[styles.tab, activeTab === 'track' && styles.tabActive]}
        >
          <View style={styles.tabContent}>
            <Icon 
              name="chart-line" 
              size={20} 
              color={activeTab === 'track' ? '#1E3A8A' : '#64748B'} 
            />
            <Text style={[styles.tabText, activeTab === 'track' && styles.tabTextActive]}>
              Track
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {activeTab === 'upload' && renderUploadTab()}
      {activeTab === 'mark' && renderMarkTab()}
      {activeTab === 'track' && renderTrackTab()}
      
      {renderSubmissionsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#1E3A8A',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#E0E7FF',
    fontSize: 13,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1E3A8A',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabText: {
    fontWeight: '600',
    color: '#64748B',
    fontSize: 15,
  },
  tabTextActive: {
    color: '#1E3A8A',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  dropdownContent: {
    flex: 1,
  },
  dropdownText: {
    color: '#1E293B',
    fontWeight: '500',
    fontSize: 15,
  },
  dropdownSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  dropdownPlaceholder: {
    color: '#94A3B8',
    fontSize: 15,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: 'white',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyDropdown: {
    padding: 32,
    alignItems: 'center',
  },
  emptyDropdownText: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 14,
  },
  dropdownItem: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  dropdownItemContent: {
    flex: 1,
  },
  dropdownItemText: {
    color: '#1E293B',
    fontWeight: '500',
    fontSize: 14,
  },
  dropdownItemSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  periodBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 12,
  },
  periodBadgeText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 14,
    color: '#1E293B',
    fontSize: 15,
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    elevation: 2,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    elevation: 0,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    color: '#64748B',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 14,
  },
  homeworkCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FAFBFC',
  },
  homeworkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  homeworkInfo: {
    flex: 1,
  },
  homeworkTitle: {
    fontWeight: 'bold',
    color: '#1E293B',
    fontSize: 16,
    marginBottom: 6,
  },
  homeworkSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
  },
  badgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  badgeGray: {
    backgroundColor: '#F1F5F9',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextSuccess: {
    color: '#065F46',
  },
  badgeTextGray: {
    color: '#475569',
  },
  badgeTextOrange: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },
  homeworkDescription: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10B981',
    minWidth: 42,
    textAlign: 'right',
  },
  homeworkFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValueGreen: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  statValueOrange: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  viewButton: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  closeButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxBorder: {
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 4,
  },
  statNumberGreen: {
    color: '#10B981',
  },
  statNumberOrange: {
    color: '#F59E0B',
  },
  statText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
  },
  submissionCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  submissionInfo: {
    flex: 1,
  },
  studentName: {
    fontWeight: '600',
    color: '#1E293B',
    fontSize: 15,
  },
  admissionNumber: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  markStatusButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markStatusButtonGreen: {
    backgroundColor: '#10B981',
  },
  markStatusButtonRed: {
    backgroundColor: '#EF4444',
  },
  markStatusButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#475569',
  },
  remarksBox: {
    marginTop: 10,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  remarksText: {
    fontSize: 12,
    color: '#1E3A8A',
    flex: 1,
    lineHeight: 18,
  },
});