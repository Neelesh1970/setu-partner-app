import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
  BackHandler,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { ms, s, vs } from 'react-native-size-matters';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import PreventiveHealthHeader from './PreventiveHealthHeader';
import AppSkeleton from '../Components/AppSkeleton';
import CustomPopup from '../Components/CustomPopup';
import { useTranslation } from '../../../Utils/useTranslation';
import {
  resolveFetchPatientsList,
  deletePatientAsync,
  fetchPatients,
  selectPatientsList,
  selectPatientsLoading,
} from '../../../features/PreventiveHealth';
import type { PreventivePatientListItem } from '../../../features/PreventiveHealth';
import type { RootStackParamList } from '../../../navigation/types';
import type { AppDispatch, RootState } from '../../../store';
import { updateAuthUserProfile } from '../../../features/PreventiveHealth/PreventiveAPI';
import {
  getRegisteredPatientAuthToken,
  getRegisteredPatientRefreshToken,
} from '../../../Utils/storage';
import { getUserIdFromJwt } from '../../../Utils/jwt';

const COLORS = {
  headerBg: '#1C39BB',
  bg: '#FFFFFF',
  textPrimary: '#0F172A',
  textMuted: '#64748B',
  border: '#D1D5DB',
  divider: '#EEF2F7',
  cta: '#1C39BB',
  ctaText: '#FFFFFF',
  outline: '#1C39BB',
  delete: '#EF4444',
};

const HPAD = ms(16);

const STORAGE_KEYS = {
  patientId: 'preventive_patient_id_v1',
};

const MINIMUM_DOB = new Date(1900, 0, 1);
const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'SelectPatient'>;

const parsePatientDob = (dob?: string | null): Date | null => {
  const value = String(dob || '').trim();
  if (!value) return null;

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDobForApi = (date: Date): string =>
  `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;

const formatDobForDisplay = (date: Date | null): string =>
  date ? formatDobForApi(date) : 'Select date of birth';

const normalizeGenderForEdit = (gender?: string): string => {
  const normalized = String(gender || '').trim().toLowerCase();
  return GENDER_OPTIONS.find(option => option.toLowerCase() === normalized) ?? '';
};

const isPatientAgeValid = (age: PreventivePatientListItem['age']): boolean => {
  if (age == null || String(age).trim() === '') return false;
  return Number.isFinite(Number(age));
};

const formatGender = (gender?: string): string => {
  const v = String(gender || '').trim();
  if (!v) return '—';
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
};

const formatEmail = (email?: string | null): string => {
  const v = String(email || '').trim();
  return v || '—';
};

type PatientCardProps = {
  patient: PreventivePatientListItem;
  selected: boolean;
  onPress: () => void;
  onEditPress: () => void;
  onDeletePress: () => void;
  deleteDisabled: boolean;
};

function PatientCard({
  patient,
  selected,
  onPress,
  onEditPress,
  onDeletePress,
  deleteDisabled,
}: PatientCardProps) {
  return (
    <View style={[styles.patientCard, selected && styles.patientCardSelected]}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.patientSelectArea}>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>{patient.full_name || '—'}</Text>
          <Text style={styles.patientMeta}>
            {formatGender(patient.gender)}
            {patient.age != null ? ` · ${patient.age} yrs` : ''}
          </Text>
          <Text style={styles.patientMeta}>{patient.phone || '—'}</Text>
          <Text style={styles.patientMeta}>{formatEmail(patient.email)}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.patientActions}>
        {patient.is_self === true ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onEditPress}
            disabled={deleteDisabled}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.deleteBtn}
          >
            <Ionicons name="pencil-outline" size={ms(16)} color={COLORS.headerBg} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onDeletePress}
          disabled={deleteDisabled}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.deleteBtn}
        >
          <Ionicons name="trash-outline" size={ms(16)} color={COLORS.delete} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SelectPatient({ navigation, route }: Props) {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const patients = useSelector(selectPatientsList);
  const loading = useSelector(selectPatientsLoading);
  const { screening, fromScreen } = route?.params || {};

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: string } | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [profileWarningPatient, setProfileWarningPatient] =
    useState<PreventivePatientListItem | null>(null);
  const [editPatient, setEditPatient] = useState<PreventivePatientListItem | null>(null);
  const [editGender, setEditGender] = useState('');
  const [editDob, setEditDob] = useState<Date | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [editValidationError, setEditValidationError] = useState('');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const load = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }) => {
      const silent = opts?.silent;
      const force = opts?.force;
      try {
        const list = await resolveFetchPatientsList(dispatch, store.getState, { force });
        console.log('[PreventiveFlow] SelectPatient load patients', {
          count: Array.isArray(list) ? list.length : 0,
          force,
          silent,
        });
        const stillLoading = Boolean(store.getState()?.preventive?.patients?.loading);
        if (!silent && Array.isArray(list) && list.length === 0 && !stillLoading) {
          navigation.replace('PatientDetail', { fromScreen: 'PreventiveCart', screening });
        }
        return list;
      } catch {
        if (!silent) {
          navigation.replace('PatientDetail', { fromScreen: 'PreventiveCart', screening });
        }
        return [];
      } finally {
        if (!silent) setInitialLoadDone(true);
      }
    },
    [dispatch, store, navigation, screening],
  );

  useEffect(() => {
    if (patients.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !patients.some((p) => p.id === selectedId)) {
      setSelectedId(patients[0]?.id ?? null);
    }
  }, [patients, selectedId]);

  const onDelete = useCallback(
    (patient: PreventivePatientListItem) => {
      if (removeBusy) return;
      setPendingRemove({ id: patient.id });
      setRemoveConfirmVisible(true);
    },
    [removeBusy],
  );

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load({ silent: true, force: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate('PreventiveCart');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation]),
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openEditModal = useCallback((patient: PreventivePatientListItem) => {
    setEditPatient(patient);
    setEditGender(normalizeGenderForEdit(patient.gender));
    setEditDob(parsePatientDob(patient.dob));
    setDatePickerVisible(false);
    setEditValidationError('');
  }, []);

  const closeEditModal = useCallback(() => {
    if (updateBusy) return;
    setEditPatient(null);
    setDatePickerVisible(false);
    setEditValidationError('');
  }, [updateBusy]);

  const handleDobChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setDatePickerVisible(false);
      }
      if (event.type !== 'dismissed' && selectedDate) {
        setEditDob(selectedDate);
        setEditValidationError('');
      }
    },
    [],
  );

  const handleUpdateProfile = useCallback(async () => {
    if (!editPatient || updateBusy) return;

    if (!editGender || !editDob) {
      setEditValidationError('Please select gender and date of birth.');
      return;
    }

    try {
      setUpdateBusy(true);
      setEditValidationError('');

      const [accessToken, refreshToken] = await Promise.all([
        getRegisteredPatientAuthToken(),
        getRegisteredPatientRefreshToken(),
      ]);
      const userId = editPatient.setu_user_id ?? (
        accessToken ? getUserIdFromJwt(accessToken) : null
      );

      if (!accessToken || !refreshToken || userId == null || String(userId).trim() === '') {
        throw new Error('Unable to identify the signed-in user. Please sign in again.');
      }

      await updateAuthUserProfile({
        accessToken,
        refreshToken,
        userId,
        gender: editGender,
        dob: formatDobForApi(editDob),
      });
      await dispatch(fetchPatients({ force: true })).unwrap();
      setEditPatient(null);
      setDatePickerVisible(false);
    } catch (error: unknown) {
      const apiError = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setUpdateError(
        apiError.response?.data?.message ||
          apiError.message ||
          'Unable to update profile. Please try again.',
      );
    } finally {
      setUpdateBusy(false);
    }
  }, [dispatch, editDob, editGender, editPatient, updateBusy]);

  const onContinue = async () => {
    if (!selectedId) return;
    const selectedPatient = patients.find(patient => patient.id === selectedId);
    if (
      selectedPatient?.is_self === true &&
      (!String(selectedPatient.gender || '').trim() ||
        !isPatientAgeValid(selectedPatient.age))
    ) {
      setProfileWarningPatient(selectedPatient);
      return;
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.patientId, String(selectedId));
      console.log('[PreventiveFlow] SelectPatient Continue', {
        selectedPatientId: selectedId,
        storageKey: STORAGE_KEYS.patientId,
        fromScreen,
        screening,
      });
    } catch {
      // ignore storage errors
    }
    navigation.navigate('PreventiveBookingDetail', { fromScreen, screening });
  };

  const dismissDeletePopup = useCallback(() => {
    if (removeBusy) return;
    setRemoveConfirmVisible(false);
    setPendingRemove(null);
  }, [removeBusy]);

  const confirmDeletePatient = useCallback(async () => {
    if (removeBusy) return;
    const patientId = pendingRemove?.id;
    if (!patientId) {
      dismissDeletePopup();
      return;
    }

    try {
      setRemoveBusy(true);
      const list = await dispatch(deletePatientAsync({ patientId })).unwrap();

      try {
        const storedId = await AsyncStorage.getItem(STORAGE_KEYS.patientId);
        if (storedId === String(patientId)) {
          if (list.length > 0) {
            await AsyncStorage.setItem(STORAGE_KEYS.patientId, String(list[0]?.id));
          } else {
            await AsyncStorage.removeItem(STORAGE_KEYS.patientId);
          }
        }
      } catch {
        // ignore storage errors
      }

      if (!Array.isArray(list) || list.length === 0) {
        navigation.replace('PatientDetail', {
          fromScreen: 'PreventiveCart',
          screening,
        });
      }
    } catch {
      // keep UI unchanged on failure
    } finally {
      setRemoveBusy(false);
      setRemoveConfirmVisible(false);
      setPendingRemove(null);
    }
  }, [removeBusy, pendingRemove, dismissDeletePopup, dispatch, navigation, screening]);

  if (loading && !initialLoadDone && patients.length === 0) {
    return <AppSkeleton variant="default" />;
  }

  if (!loading && patients.length === 0) {
    return <AppSkeleton variant="default" />;
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <SafeAreaView style={styles.headerSafe} edges={['top', 'left', 'right']}>
        <PreventiveHealthHeader
          title={t('preventiveHealth.selectPatient.headerTitle')}
          onBackPress={() => navigation.navigate('PreventiveCart')}
          showRight1
          rightIcon1="add"
          onRightPress1={() =>
            navigation.navigate('PatientDetail', {
              fromScreen: 'SelectPatient',
              screening,
            })
          }
        />
      </SafeAreaView>

      <SafeAreaView style={styles.bodySafe} edges={['left', 'right', 'bottom']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <Text style={styles.heading}>{t('preventiveHealth.selectPatient.heading')}</Text>

          <View style={styles.listCard}>
            {patients.map((p) => (
              <PatientCard
                key={p.id}
                patient={p}
                selected={selectedId === p.id}
                onPress={() => setSelectedId(p.id)}
                onEditPress={() => openEditModal(p)}
                onDeletePress={() => onDelete(p)}
                deleteDisabled={removeBusy}
              />
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity activeOpacity={0.9} style={styles.cta} onPress={onContinue}>
            <Text style={styles.ctaText}>
              {t('preventiveHealth.selectPatient.ctaContinue')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <CustomPopup
        isVisible={removeConfirmVisible}
        onClose={dismissDeletePopup}
        onConfirm={dismissDeletePopup}
        onSecondaryConfirm={confirmDeletePatient}
        title={t('preventiveHealth.selectPatient.popupRemoveTitle')}
        iconName="trash-outline"
        iconColor={COLORS.delete}
        confirmText={t('preventiveHealth.selectPatient.popupCancel')}
        secondaryConfirmText={t('preventiveHealth.selectPatient.popupConfirm')}
        confirmStyle={{ backgroundColor: COLORS.headerBg }}
      />

      <CustomPopup
        isVisible={profileWarningPatient != null}
        onClose={() => setProfileWarningPatient(null)}
        onConfirm={() => {
          const patient = profileWarningPatient;
          setProfileWarningPatient(null);
          if (patient) openEditModal(patient);
        }}
        title="Profile Incomplete"
        message="Please fill age and gender to proceed, click to edit"
        iconName="alert-circle-outline"
        iconColor="#F59E0B"
        cancelText="Cancel"
        confirmText="Edit"
      />

      <Modal
        visible={editPatient != null}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.editModalCard}>
            <Text style={styles.editModalTitle}>Edit Profile</Text>

            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.85}
                  style={[
                    styles.genderOption,
                    editGender === option && styles.genderOptionSelected,
                  ]}
                  onPress={() => {
                    setEditGender(option);
                    setEditValidationError('');
                  }}
                  disabled={updateBusy}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      editGender === option && styles.genderOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Date of Birth</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.dobField}
              onPress={() => setDatePickerVisible(true)}
              disabled={updateBusy}
            >
              <Text style={[styles.dobText, !editDob && styles.placeholderText]}>
                {formatDobForDisplay(editDob)}
              </Text>
              <Ionicons name="calendar-outline" size={ms(18)} color={COLORS.textMuted} />
            </TouchableOpacity>

            {datePickerVisible ? (
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={editDob ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={MINIMUM_DOB}
                  maximumDate={new Date()}
                  onChange={handleDobChange}
                />
                {Platform.OS === 'ios' ? (
                  <TouchableOpacity
                    style={styles.datePickerDone}
                    onPress={() => setDatePickerVisible(false)}
                  >
                    <Text style={styles.datePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {editValidationError ? (
              <Text style={styles.validationText}>{editValidationError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.modalCancelButton}
                onPress={closeEditModal}
                disabled={updateBusy}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.modalUpdateButton, updateBusy && styles.buttonDisabled]}
                onPress={handleUpdateProfile}
                disabled={updateBusy}
              >
                {updateBusy ? (
                  <ActivityIndicator color={COLORS.ctaText} size="small" />
                ) : (
                  <Text style={styles.modalUpdateText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <CustomPopup
        isVisible={Boolean(updateError)}
        onClose={() => setUpdateError('')}
        onConfirm={() => setUpdateError('')}
        title="Update Failed"
        message={updateError}
        iconName="alert-circle-outline"
        iconColor={COLORS.delete}
        confirmText="OK"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  headerSafe: {
    backgroundColor: COLORS.headerBg,
    borderBottomLeftRadius: ms(18),
    borderBottomRightRadius: ms(18),
    overflow: 'hidden',
  },
  bodySafe: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: {
    paddingHorizontal: HPAD,
    paddingTop: vs(18),
    paddingBottom: vs(130),
  },
  heading: {
    fontSize: s(16),
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: vs(12),
  },
  listCard: {
    gap: vs(12),
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: ms(10),
    paddingVertical: vs(14),
    paddingHorizontal: ms(14),
    backgroundColor: COLORS.bg,
  },
  patientCardSelected: {
    borderColor: COLORS.headerBg,
  },
  patientSelectArea: {
    flex: 1,
    minWidth: 0,
  },
  patientActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteBtn: {
    width: ms(28),
    height: ms(28),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(-2),
  },
  patientInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: ms(8),
  },
  patientName: {
    fontSize: s(15),
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: vs(4),
  },
  patientMeta: {
    fontSize: s(13),
    fontWeight: '600',
    color: COLORS.textMuted,
    lineHeight: s(18),
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: HPAD,
    paddingTop: vs(12),
    paddingBottom: Platform.OS === 'ios' ? vs(18) : vs(16),
    backgroundColor: COLORS.bg,
  },
  cta: {
    backgroundColor: COLORS.cta,
    borderRadius: ms(26),
    paddingVertical: vs(14),
    alignItems: 'center',
  },
  ctaText: {
    color: COLORS.ctaText,
    fontSize: s(16),
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: HPAD,
  },
  editModalCard: {
    width: '100%',
    maxWidth: ms(420),
    backgroundColor: COLORS.bg,
    borderRadius: ms(20),
    paddingHorizontal: ms(20),
    paddingVertical: vs(22),
  },
  editModalTitle: {
    fontSize: s(18),
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: vs(20),
  },
  fieldLabel: {
    fontSize: s(13),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: vs(8),
  },
  genderRow: {
    flexDirection: 'row',
    gap: ms(8),
    marginBottom: vs(18),
  },
  genderOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: ms(10),
    paddingVertical: vs(10),
    alignItems: 'center',
  },
  genderOptionSelected: {
    backgroundColor: COLORS.headerBg,
    borderColor: COLORS.headerBg,
  },
  genderOptionText: {
    fontSize: s(13),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  genderOptionTextSelected: {
    color: COLORS.ctaText,
  },
  dobField: {
    minHeight: vs(44),
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: ms(10),
    paddingHorizontal: ms(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dobText: {
    fontSize: s(13),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  placeholderText: {
    color: COLORS.textMuted,
  },
  datePickerContainer: {
    marginTop: vs(8),
    alignItems: 'flex-end',
  },
  datePickerDone: {
    paddingHorizontal: ms(12),
    paddingVertical: vs(6),
  },
  datePickerDoneText: {
    fontSize: s(14),
    fontWeight: '700',
    color: COLORS.headerBg,
  },
  validationText: {
    fontSize: s(12),
    fontWeight: '600',
    color: COLORS.delete,
    marginTop: vs(8),
  },
  modalActions: {
    flexDirection: 'row',
    gap: ms(10),
    marginTop: vs(22),
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: ms(22),
    paddingVertical: vs(12),
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: s(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalUpdateButton: {
    flex: 1,
    backgroundColor: COLORS.cta,
    borderRadius: ms(22),
    paddingVertical: vs(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalUpdateText: {
    fontSize: s(14),
    fontWeight: '700',
    color: COLORS.ctaText,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
