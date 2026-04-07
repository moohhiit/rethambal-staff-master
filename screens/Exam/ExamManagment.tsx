import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import React, { useState, useEffect } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';
 // Adjust path as needed

// Types based on the database schema
interface Student {
  id: string;
  user_id: string;
  admission_number: string;
  roll_number: string;
  first_name: string;
  last_name: string;
}

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  subject_name: string;
  date: string;
  max_theory_marks: number;
  max_practical_marks: number;
  max_internal_marks: number;
  total_max_marks: number;
  passing_marks: number;
  status: string;
}

interface ExamMark {
  id?: string;
  student_id: string;
  is_absent: boolean;
  theory_marks: number | null;
  practical_marks: number | null;
  internal_marks: number | null;
  total_marks: number | null;
  percentage: number | null;
  grade: string;
  status: string;
}

export default function ExamManagement() {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classes, setClasses] = useState<any[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [examMarks, setExamMarks] = useState<Map<string, ExamMark>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'entered' | 'pending'>('all');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [staffId, setStaffId] = useState<string>('');

  useEffect(() => {
    getUserDataFromStorage();
  }, []);

  useEffect(() => {
    if (staffId) {
      loadClasses();
    }
  }, [staffId]);

  useEffect(() => {
    if (selectedClass) {
      loadExams();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedExam) {
      loadStudents();
      loadExamMarks();
    }
  }, [selectedExam]);

  // Get user data from AsyncStorage
  const getUserDataFromStorage = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      const storedStaffId = await AsyncStorage.getItem('staffId');
      const userRole = await AsyncStorage.getItem('userRole');

      if (!storedUserId) {
        Alert.alert('Error', 'User not logged in');
        return;
      }

      setCurrentUserId(storedUserId);

      // If staff data is available in storage, use it
      if (storedStaffId) {
        setStaffId(storedStaffId);
      } else if (userRole === 'teacher' || userRole === 'principal') {
        // If not in storage but user is a teacher, fetch from database
        const { data: staffData, error } = await supabase
          .from('staff')
          .select('id')
          .eq('user_id', storedUserId)
          .single();

        if (error) {
          console.error('Error fetching staff data:', error);
          Alert.alert('Error', 'Failed to load staff information');
          return;
        }

        if (staffData) {
          setStaffId(staffData.id);
          // Store for future use
          await AsyncStorage.setItem('staffId', staffData.id);
        }
      }
    } catch (error) {
      console.error('Error getting user data from storage:', error);
      Alert.alert('Error', 'Failed to load user information');
    }
  };

  // Load classes assigned to the teacher
  const loadClasses = async () => {
    try {
      setLoading(true);

      if (!staffId) {
        setLoading(false);
        return;
      }

      // Get classes where teacher is assigned
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id,
          academic_year,
          room_number,
          grades (
            id,
            grade
          ),
          sections (
            id,
            section
          )
        `)
        .eq('teacher_id', staffId);

      if (error) throw error;

      const formattedClasses = data?.map(cls => ({
        id: cls.id,
        name: `${cls.grades.grade}-${cls.sections.section}`,
        academic_year: cls.academic_year
      })) || [];

      setClasses(formattedClasses);
    } catch (error) {
      console.error('Error loading classes:', error);
      Alert.alert('Error', 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  // Load exams for selected class
  const loadExams = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exams')
        .select(`
          id,
          name,
          exam_type,
          date,
          start_time,
          end_time,
          max_theory_marks,
          max_practical_marks,
          max_internal_marks,
          total_max_marks,
          passing_marks,
          status,
          is_published,
          subjects (
            id,
            name
          )
        `)
        .eq('class_id', selectedClass)
        .order('date', { ascending: false });

      if (error) throw error;

      const formattedExams: Exam[] = data?.map(exam => ({
        id: exam.id,
        name: exam.name,
        exam_type: exam.exam_type,
        subject_name: exam.subjects.name,
        date: exam.date,
        max_theory_marks: exam.max_theory_marks || 0,
        max_practical_marks: exam.max_practical_marks || 0,
        max_internal_marks: exam.max_internal_marks || 0,
        total_max_marks: exam.total_max_marks,
        passing_marks: exam.passing_marks,
        status: exam.status
      })) || [];

      setExams(formattedExams);
    } catch (error) {
      console.error('Error loading exams:', error);
      Alert.alert('Error', 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  // Load students for selected class
  const loadStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          user_id,
          admission_number,
          roll_number,
          users (
            id,
            first_name,
            last_name
          )
        `)
        .eq('class_id', selectedClass)
        .eq('status', 'active')
        .order('roll_number', { ascending: true });

      if (error) throw error;

      const formattedStudents: Student[] = data?.map(student => ({
        id: student.id,
        user_id: student.user_id,
        admission_number: student.admission_number,
        roll_number: student.roll_number,
        first_name: student.users.first_name,
        last_name: student.users.last_name
      })) || [];

      setStudents(formattedStudents);
    } catch (error) {
      console.error('Error loading students:', error);
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  // Load existing exam marks
  const loadExamMarks = async () => {
    if (!selectedExam) return;

    try {
      const { data, error } = await supabase
        .from('exam_marks')
        .select('*')
        .eq('exam_id', selectedExam.id);

      if (error) throw error;

      const marksMap = new Map<string, ExamMark>();
      
      // Initialize marks for all students
      students.forEach(student => {
        const existingMark = data?.find(m => m.student_id === student.id);
        
        if (existingMark) {
          marksMap.set(student.id, {
            id: existingMark.id,
            student_id: existingMark.student_id,
            is_absent: existingMark.is_absent,
            theory_marks: existingMark.theory_marks,
            practical_marks: existingMark.practical_marks,
            internal_marks: existingMark.internal_marks,
            total_marks: existingMark.total_marks,
            percentage: existingMark.percentage,
            grade: existingMark.grade,
            status: existingMark.status
          });
        } else {
          marksMap.set(student.id, {
            student_id: student.id,
            is_absent: false,
            theory_marks: null,
            practical_marks: null,
            internal_marks: null,
            total_marks: null,
            percentage: null,
            grade: '',
            status: 'pass'
          });
        }
      });

      setExamMarks(marksMap);
    } catch (error) {
      console.error('Error loading exam marks:', error);
      Alert.alert('Error', 'Failed to load exam marks');
    }
  };

  const calculateGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  };

  const openMarkModal = (student: Student) => {
    setCurrentStudent(student);
    setShowMarkModal(true);
  };

  const toggleAbsent = (studentId: string) => {
    const currentMark = examMarks.get(studentId);
    if (currentMark) {
      const updatedMark = {
        ...currentMark,
        is_absent: !currentMark.is_absent,
        theory_marks: !currentMark.is_absent ? null : currentMark.theory_marks,
        practical_marks: !currentMark.is_absent ? null : currentMark.practical_marks,
        internal_marks: !currentMark.is_absent ? null : currentMark.internal_marks,
        total_marks: !currentMark.is_absent ? null : currentMark.total_marks,
        percentage: !currentMark.is_absent ? null : currentMark.percentage,
        grade: !currentMark.is_absent ? '' : currentMark.grade,
      };
      const newMarks = new Map(examMarks);
      newMarks.set(studentId, updatedMark);
      setExamMarks(newMarks);
    }
  };

  const saveMarks = async (marks: ExamMark) => {
    if (!currentStudent || !selectedExam) return;

    let totalMarks = 0;
    
    if (selectedExam.max_theory_marks > 0 && marks.theory_marks !== null) {
      if (marks.theory_marks > selectedExam.max_theory_marks) {
        Alert.alert('Error', `Theory marks cannot exceed ${selectedExam.max_theory_marks}`);
        return;
      }
      totalMarks += marks.theory_marks;
    }

    if (selectedExam.max_practical_marks > 0 && marks.practical_marks !== null) {
      if (marks.practical_marks > selectedExam.max_practical_marks) {
        Alert.alert('Error', `Practical marks cannot exceed ${selectedExam.max_practical_marks}`);
        return;
      }
      totalMarks += marks.practical_marks;
    }

    if (selectedExam.max_internal_marks > 0 && marks.internal_marks !== null) {
      if (marks.internal_marks > selectedExam.max_internal_marks) {
        Alert.alert('Error', `Internal marks cannot exceed ${selectedExam.max_internal_marks}`);
        return;
      }
      totalMarks += marks.internal_marks;
    }

    const percentage = marks.is_absent ? null : (totalMarks / selectedExam.total_max_marks) * 100;
    const grade = marks.is_absent ? '' : calculateGrade(percentage || 0);
    const status = marks.is_absent ? 'absent' : (totalMarks >= selectedExam.passing_marks ? 'pass' : 'fail');

    const updatedMark: ExamMark = {
      ...marks,
      total_marks: marks.is_absent ? null : totalMarks,
      percentage: percentage ? parseFloat(percentage.toFixed(2)) : null,
      grade,
      status
    };

    try {
      setSaving(true);

      const markData = {
        exam_id: selectedExam.id,
        student_id: currentStudent.id,
        is_absent: updatedMark.is_absent,
        theory_marks: updatedMark.theory_marks,
        practical_marks: updatedMark.practical_marks,
        internal_marks: updatedMark.internal_marks,
        total_marks: updatedMark.total_marks,
        percentage: updatedMark.percentage,
        grade: updatedMark.grade,
        status: updatedMark.status,
        entered_by: currentUserId
      };

      let error;
      
      if (marks.id) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('exam_marks')
          .update(markData)
          .eq('id', marks.id);
        error = updateError;
      } else {
        // Insert new record
        const { data, error: insertError } = await supabase
          .from('exam_marks')
          .insert([markData])
          .select()
          .single();
        
        if (!insertError && data) {
          updatedMark.id = data.id;
        }
        error = insertError;
      }

      if (error) throw error;

      const newMarks = new Map(examMarks);
      newMarks.set(currentStudent.id, updatedMark);
      setExamMarks(newMarks);
      setShowMarkModal(false);
      setCurrentStudent(null);
      Alert.alert('Success', 'Marks saved successfully!');
    } catch (error) {
      console.error('Error saving marks:', error);
      Alert.alert('Error', 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const saveAllMarks = async () => {
    try {
      setSaving(true);
      
      const marksToSave: any[] = [];
      const marksToUpdate: any[] = [];

      examMarks.forEach((mark, studentId) => {
        if (mark.total_marks !== null || mark.is_absent) {
          const markData = {
            exam_id: selectedExam?.id,
            student_id: studentId,
            is_absent: mark.is_absent,
            theory_marks: mark.theory_marks,
            practical_marks: mark.practical_marks,
            internal_marks: mark.internal_marks,
            total_marks: mark.total_marks,
            percentage: mark.percentage,
            grade: mark.grade,
            status: mark.status,
            entered_by: currentUserId
          };

          if (mark.id) {
            marksToUpdate.push({ ...markData, id: mark.id });
          } else {
            marksToSave.push(markData);
          }
        }
      });

      // Insert new marks
      if (marksToSave.length > 0) {
        const { error: insertError } = await supabase
          .from('exam_marks')
          .insert(marksToSave);
        
        if (insertError) throw insertError;
      }

      // Update existing marks
      for (const mark of marksToUpdate) {
        const { id, ...updateData } = mark;
        const { error: updateError } = await supabase
          .from('exam_marks')
          .update(updateData)
          .eq('id', id);
        
        if (updateError) throw updateError;
      }

      Alert.alert('Success', 'All marks saved successfully!');
      loadExamMarks(); // Reload to get latest data
    } catch (error) {
      console.error('Error saving all marks:', error);
      Alert.alert('Error', 'Failed to save all marks');
    } finally {
      setSaving(false);
    }
  };

  const getFilteredStudents = () => {
    return students.filter(student => {
      const mark = examMarks.get(student.id);
      if (!mark) return false;
      
      if (filterStatus === 'entered') {
        return mark.total_marks !== null || mark.is_absent;
      }
      if (filterStatus === 'pending') {
        return mark.total_marks === null && !mark.is_absent;
      }
      return true;
    });
  };

  const MarkEntryModal = () => {
    if (!currentStudent || !selectedExam) return null;

    const currentMark = examMarks.get(currentStudent.id) || {
      student_id: currentStudent.id,
      is_absent: false,
      theory_marks: null,
      practical_marks: null,
      internal_marks: null,
      total_marks: null,
      percentage: null,
      grade: '',
      status: 'pass'
    };

    const [tempMark, setTempMark] = useState({ ...currentMark });

    return (
      <Modal
        visible={showMarkModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMarkModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E3A8A' }}>
                Enter Marks
              </Text>
              <TouchableOpacity onPress={() => setShowMarkModal(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Student</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>
                {currentStudent.first_name} {currentStudent.last_name} (Roll: {currentStudent.roll_number})
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedExam.max_theory_marks > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, color: '#374151', marginBottom: 8, fontWeight: '500' }}>
                    Theory Marks (Max: {selectedExam.max_theory_marks})
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      backgroundColor: tempMark.is_absent ? '#F3F4F6' : 'white'
                    }}
                    keyboardType="numeric"
                    value={tempMark.theory_marks?.toString() || ''}
                    onChangeText={(text) => setTempMark({ ...tempMark, theory_marks: text ? parseFloat(text) : null })}
                    placeholder="Enter theory marks"
                    editable={!tempMark.is_absent}
                  />
                </View>
              )}

              {selectedExam.max_practical_marks > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, color: '#374151', marginBottom: 8, fontWeight: '500' }}>
                    Practical Marks (Max: {selectedExam.max_practical_marks})
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      backgroundColor: tempMark.is_absent ? '#F3F4F6' : 'white'
                    }}
                    keyboardType="numeric"
                    value={tempMark.practical_marks?.toString() || ''}
                    onChangeText={(text) => setTempMark({ ...tempMark, practical_marks: text ? parseFloat(text) : null })}
                    placeholder="Enter practical marks"
                    editable={!tempMark.is_absent}
                  />
                </View>
              )}

              {selectedExam.max_internal_marks > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, color: '#374151', marginBottom: 8, fontWeight: '500' }}>
                    Internal Marks (Max: {selectedExam.max_internal_marks})
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      backgroundColor: tempMark.is_absent ? '#F3F4F6' : 'white'
                    }}
                    keyboardType="numeric"
                    value={tempMark.internal_marks?.toString() || ''}
                    onChangeText={(text) => setTempMark({ ...tempMark, internal_marks: text ? parseFloat(text) : null })}
                    placeholder="Enter internal marks"
                    editable={!tempMark.is_absent}
                  />
                </View>
              )}

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  borderRadius: 8,
                  marginBottom: 20
                }}
                onPress={() => setTempMark({ ...tempMark, is_absent: !tempMark.is_absent })}
              >
                <Icon
                  name={tempMark.is_absent ? "checkbox" : "square-outline"}
                  size={24}
                  color="#1E3A8A"
                />
                <Text style={{ marginLeft: 8, fontSize: 14, color: '#374151', fontWeight: '500' }}>
                  Mark as Absent
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  backgroundColor: '#1E3A8A',
                  padding: 14,
                  borderRadius: 8,
                  alignItems: 'center'
                }}
                onPress={() => saveMarks(tempMark)}
              >
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Save Marks</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#1E3A8A', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}>Exam Management</Text>
        <Text style={{ fontSize: 14, color: '#93C5FD', marginTop: 4 }}>Manage marks and attendance</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Class Selection */}
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>
            Select Class
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {classes.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8,
                  marginRight: 10,
                  backgroundColor: selectedClass === cls.id ? '#1E3A8A' : 'white',
                  borderWidth: 1,
                  borderColor: selectedClass === cls.id ? '#1E3A8A' : '#E5E7EB'
                }}
                onPress={() => setSelectedClass(cls.id)}
              >
                <Text style={{
                  color: selectedClass === cls.id ? 'white' : '#374151',
                  fontWeight: '600'
                }}>
                  {cls.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Exam Selection */}
        {selectedClass && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>
              Select Exam
            </Text>
            {loading ? (
              <ActivityIndicator size="large" color="#1E3A8A" />
            ) : (
              exams.map((exam) => (
                <TouchableOpacity
                  key={exam.id}
                  style={{
                    backgroundColor: selectedExam?.id === exam.id ? '#EFF6FF' : 'white',
                    padding: 16,
                    borderRadius: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: selectedExam?.id === exam.id ? '#1E3A8A' : '#E5E7EB',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2
                  }}
                  onPress={() => setSelectedExam(exam)}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 }}>
                        {exam.name}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>
                        {exam.subject_name} • {exam.exam_type}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Icon name="calendar-outline" size={14} color="#6B7280" />
                        <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>
                          {new Date(exam.date).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>
                        Total Marks: {exam.total_max_marks} • Passing: {exam.passing_marks}
                      </Text>
                    </View>
                    {selectedExam?.id === exam.id && (
                      <Icon name="checkmark-circle" size={24} color="#1E3A8A" />
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Students List */}
        {selectedExam && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 100 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>
                Students ({getFilteredStudents().length})
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['all', 'entered', 'pending'] as const).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      backgroundColor: filterStatus === status ? '#1E3A8A' : '#E5E7EB'
                    }}
                    onPress={() => setFilterStatus(status)}
                  >
                    <Text style={{
                      fontSize: 12,
                      color: filterStatus === status ? 'white' : '#374151',
                      fontWeight: '500',
                      textTransform: 'capitalize'
                    }}>
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {getFilteredStudents().map((student) => {
              const mark = examMarks.get(student.id);
              const hasMarks = mark && (mark.total_marks !== null || mark.is_absent);

              return (
                <View
                  key={student.id}
                  style={{
                    backgroundColor: 'white',
                    padding: 16,
                    borderRadius: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <View style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: '#1E3A8A',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 12
                        }}>
                          <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                            {student.roll_number}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>
                            {student.first_name} {student.last_name}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#6B7280' }}>
                            {student.admission_number}
                          </Text>
                        </View>
                      </View>

                      {mark?.is_absent ? (
                        <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', marginTop: 8 }}>
                          <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '600' }}>ABSENT</Text>
                        </View>
                      ) : mark?.total_marks !== null ? (
                        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                            <Text style={{ fontSize: 12, color: '#374151' }}>
                              Total: {mark.total_marks}/{selectedExam.total_max_marks}
                            </Text>
                          </View>
                          <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                            <Text style={{ fontSize: 12, color: '#1E3A8A', fontWeight: '600' }}>
                              {mark.percentage}% • Grade: {mark.grade}
                            </Text>
                          </View>
                          <View style={{
                            backgroundColor: mark.status === 'pass' ? '#D1FAE5' : '#FEE2E2',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 4
                          }}>
                            <Text style={{
                              fontSize: 12,
                              color: mark.status === 'pass' ? '#059669' : '#DC2626',
                              fontWeight: '600',
                              textTransform: 'uppercase'
                            }}>
                              {mark.status}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', marginTop: 8 }}>
                          <Text style={{ fontSize: 12, color: '#D97706', fontWeight: '600' }}>PENDING</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          backgroundColor: mark?.is_absent ? '#DC2626' : '#E5E7EB'
                        }}
                        onPress={() => toggleAbsent(student.id)}
                      >
                        <Icon
                          name="close-circle"
                          size={20}
                          color={mark?.is_absent ? 'white' : '#6B7280'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          backgroundColor: '#1E3A8A'
                        }}
                        onPress={() => openMarkModal(student)}
                        disabled={mark?.is_absent}
                      >
                        <Icon name="create-outline" size={20} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      {selectedExam && students.length > 0 && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 20,
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 5
        }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#1E3A8A',
              padding: 16,
              borderRadius: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center'
            }}
            onPress={saveAllMarks}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Icon name="save-outline" size={20} color="white" />
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                  Save All Marks
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <MarkEntryModal />
    </View>
  );
}