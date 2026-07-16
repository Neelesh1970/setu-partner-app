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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  selectPatientsList,
  selectPatientsLoading,
} from '../../../features/PreventiveHealth';
import type { PreventivePatientListItem } from '../../../features/PreventiveHealth';
import type { RootStackParamList } from '../../../navigation/types';
import type { AppDispatch, RootState } from '../../../store';

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

type Props = NativeStackScreenProps<RootStackParamList, 'SelectPatient'>;

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
  onDeletePress: () => void;
  deleteDisabled: boolean;
};

function PatientCard({
  patient,
  selected,
  onPress,
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

  const onContinue = async () => {
    if (!selectedId) return;
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
});
