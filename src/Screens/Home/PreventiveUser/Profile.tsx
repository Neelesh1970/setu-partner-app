import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import type { Asset } from 'react-native-image-picker';
import { safeLaunchCamera, safeLaunchImageLibrary } from '../../../lib/safeImagePicker';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ms, vs, s } from 'react-native-size-matters';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { RootStackParamList } from '../../../navigation/types';
import { navigationRef } from '../../../navigation/navigationRef';
import { COLORS } from '../../../Constants/theme';
import PreventiveHealthHeader from './PreventiveHealthHeader';
import axiosInstance from '../../../api/axiosInstance';
import { postAuthLogout } from './PreventiveHealthAPI';
import { logoutUser } from '../../../auth/logoutUser';
import CustomPopup from '../Components/CustomPopup';

const PRIMARY = '#1C39BB';
const LABEL_GRAY = '#6B7280';
const BORDER = '#E5E7EB';

type PersonalInfo = {
  id?: string;
  full_name?: string | null;
  location?: string | null;
  age?: number | null;
  gender?: string | null;
  email?: string | null;
  phone_number?: string | null;
  profile_image_url?: string | null;
  profile_image_s3_key?: string | null;
  role?: string | null;
  service_scope?: string | null;
};

type WorkStats = {
  users_registered?: number;
  tests_completed?: number;
  walk_in_tests?: number;
  home_visits?: number;
};

type Earnings = {
  total_amount?: number;
  currency?: string;
  current_month_amount?: number;
  wallet_balance?: number;
};

type LabProfileData = {
  personal_info?: PersonalInfo;
  work_stats?: WorkStats;
  earnings?: Earnings;
};

type LabProfileResponse = {
  success?: boolean;
  message?: string;
  data?: LabProfileData;
};

type LabProfileImageUploadResponse = {
  success?: boolean;
  message?: string;
  data?: {
    personal_info?: PersonalInfo;
  };
};

const displayStr = (v: string | number | null | undefined, fallback = '—') => {
  if (v === null || v === undefined || v === '') return fallback;
  return String(v);
};

const formatInr = (amount: number | null | undefined, currency?: string) => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const sym = !currency || currency === 'INR' ? '₹' : `${currency} `;
  return `${sym}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const initialsFromName = (name: string | null | undefined): string => {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

type ProfileNav = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

const noop = () => {};

const pickerOptions = {
  mediaType: 'photo' as const,
  quality: 0.9 as const,
  maxWidth: 2048,
  maxHeight: 2048,
};

const Profile: React.FC = () => {
  const navigation = useNavigation<ProfileNav>();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, vs(16));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<LabProfileData | null>(null);
  const [uploading, setUploading] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editAge, setEditAge] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);

  const fetchLabProfile = useCallback(async (opts?: { isPullRefresh?: boolean }) => {
    const pull = opts?.isPullRefresh ?? false;
    if (pull) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await axiosInstance.get<LabProfileResponse>('lab/profile');
      const data = res.data?.data;
      if (!data) {
        setError('No profile data returned.');
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load profile.');
      setProfile(null);
    } finally {
      if (pull) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchLabProfile();
  }, [fetchLabProfile]);

  const uploadProfileImage = useCallback(async (asset: Asset) => {
    const uri = asset.uri;
    if (!uri) {
      return;
    }
    const fileName = asset.fileName ?? `profile_${Date.now()}.jpg`;
    const mime =
      asset.type && String(asset.type).startsWith('image/') ? asset.type : 'image/jpeg';

    const formData = new FormData();
    // RN multipart file part (not a web Blob)
    formData.append('image', { uri, name: fileName, type: mime } as unknown as Blob);

    setUploading(true);
    try {
      const res = await axiosInstance.post<LabProfileImageUploadResponse>(
        'lab/profile/image',
        formData,
      );
      const updated = res.data?.data?.personal_info;
      if (updated) {
        setProfile(prev => {
          if (!prev) {
            return { personal_info: updated };
          }
          return {
            ...prev,
            personal_info: { ...prev.personal_info, ...updated },
          };
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed.';
      Alert.alert('Profile photo', msg);
    } finally {
      setUploading(false);
    }
  }, []);

  const pickFromLibrary = useCallback(async () => {
    try {
      const result = await safeLaunchImageLibrary({
        ...pickerOptions,
        selectionLimit: 1,
      });
      if (result.didCancel) {
        return;
      }
      if (result.errorCode) {
        Alert.alert('Photo library', result.errorMessage ?? 'Could not open library.');
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        return;
      }
      await uploadProfileImage(asset);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Profile photo', msg);
    }
  }, [uploadProfileImage]);

  const takePhoto = useCallback(async () => {
    try {
      const result = await safeLaunchCamera({
        ...pickerOptions,
        saveToPhotos: false,
        cameraType: 'back',
      });
      if (result.didCancel) {
        return;
      }
      if (result.errorCode) {
        Alert.alert('Camera', result.errorMessage ?? 'Could not open camera.');
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        return;
      }
      await uploadProfileImage(asset);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Profile photo', msg);
    }
  }, [uploadProfileImage]);

  const openImageSourcePicker = useCallback(() => {
    if (uploading) {
      return;
    }
    setPhotoPickerVisible(true);
  }, [uploading]);

  const closePhotoPickerModal = useCallback(() => {
    setPhotoPickerVisible(false);
  }, []);

  const handleTakePhoto = useCallback(() => {
    setPhotoPickerVisible(false);
    takePhoto().catch(() => {});
  }, [takePhoto]);

  const handlePickFromLibrary = useCallback(() => {
    setPhotoPickerVisible(false);
    pickFromLibrary().catch(() => {});
  }, [pickFromLibrary]);

  const openEditModal = useCallback(() => {
    const p = profile?.personal_info;
    setEditFullName((p?.full_name ?? '').trim() ? String(p?.full_name) : '');
    setEditEmail((p?.email ?? '').trim() ? String(p?.email) : '');
    setEditGender((p?.gender ?? '').trim() ? String(p?.gender) : '');
    setEditAge(p?.age != null && !Number.isNaN(Number(p.age)) ? String(p.age) : '');
    setEditModalVisible(true);
  }, [profile]);

  const closeEditModal = useCallback(() => {
    if (savingProfile) {
      return;
    }
    setEditModalVisible(false);
  }, [savingProfile]);

  const saveProfileFromModal = useCallback(async () => {
    const full_name = editFullName.trim();
    const email = editEmail.trim();
    const gender = editGender.trim();
    const ageParsed = parseInt(String(editAge).trim(), 10);
    if (!full_name || !email || !gender) {
      Alert.alert('Profile', 'Please fill full name, email, and gender.');
      return;
    }
    if (Number.isNaN(ageParsed) || ageParsed < 1 || ageParsed > 120) {
      Alert.alert('Profile', 'Please enter a valid age.');
      return;
    }
    setSavingProfile(true);
    try {
      const body = { full_name, email, gender, age: ageParsed };
      const res = await axiosInstance.patch<LabProfileResponse>('lab/profile', body);
      const data = res.data?.data;
      const updatedPersonal = data?.personal_info;
      if (updatedPersonal) {
        setProfile(prev => {
          if (!prev) {
            return { personal_info: updatedPersonal };
          }
          return {
            ...prev,
            personal_info: { ...prev.personal_info, ...updatedPersonal },
          };
        });
      } else {
        await fetchLabProfile({ isPullRefresh: true });
      }
      setEditModalVisible(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not update profile.';
      Alert.alert('Profile', msg);
    } finally {
      setSavingProfile(false);
    }
  }, [editFullName, editEmail, editGender, editAge, fetchLabProfile]);

  const openLogoutModal = useCallback(() => {
    setLogoutModalVisible(true);
  }, []);

  const closeLogoutModal = useCallback(() => {
    if (loggingOut) {
      return;
    }
    setLogoutModalVisible(false);
  }, [loggingOut]);

  const confirmLogout = useCallback(async () => {
    setLoggingOut(true);

    try {
      // 1) Best-effort server logout (do not block UX)
      try {
        await postAuthLogout();
      } catch (e) {
      }

      // 2) Clear local session (AsyncStorage/tokens/redux/etc)
      await logoutUser();

      // 3) Close modal
      setLogoutModalVisible(false);

      // 4) Hard reset navigation to Welcome (no back navigation)
      if (navigationRef.isReady()) {
        navigationRef.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          }),
        );
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        });
      }
    } catch (e: any) {
      Alert.alert('Logout failed', e?.message || 'Something went wrong');
    } finally {
      setLoggingOut(false);
    }
  }, [navigation]);

  const personal = profile?.personal_info;
  const work = profile?.work_stats;
  const earnings = profile?.earnings;

  const name = displayStr(personal?.full_name ?? undefined, '—');
  const location = personal?.location != null && personal.location !== '' ? personal.location : '—';
  const roleLabel = displayStr(personal?.role ?? undefined, '');
  const avatarUrl = personal?.profile_image_url?.trim() || null;
  const initials = initialsFromName(personal?.full_name ?? undefined);

  const statsCards = [
    {
      value: displayStr(work?.tests_completed ?? undefined, '0'),
      label: 'Tests Completed',
    },
    {
      value: formatInr(earnings?.total_amount, earnings?.currency),
      label: 'Total Earned',
    },
    {
      value: displayStr(work?.users_registered ?? undefined, '0'),
      label: 'Users Registered',
    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="Profile"
            onBackPress={() => navigation.goBack()}
            showRight1
            rightIcon1="account-edit-outline"
            rightIcon1Type="material"
            onRightPress1={openEditModal}
          />
        </SafeAreaView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + vs(24) }]}
          showsVerticalScrollIndicator={false}
          bounces
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchLabProfile({ isPullRefresh: true })}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
        >
          {error ? (
            <View style={[styles.errorBlock, styles.errorPad]}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => fetchLabProfile()}
                activeOpacity={0.85}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {!error ? (
            <>
          <View style={styles.heroBlock}>
            <View style={styles.avatarWrap}>
              <TouchableOpacity
                style={styles.avatarLarge}
                onPress={openImageSourcePicker}
                activeOpacity={0.85}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Text style={styles.avatarLargeText}>{initials}</Text>
                )}
              </TouchableOpacity>
              {uploading ? (
                <View style={styles.avatarUploadingOverlay} pointerEvents="none">
                  <ActivityIndicator color={PRIMARY} />
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.cameraFab}
                onPress={openImageSourcePicker}
                activeOpacity={0.85}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                <Ionicons name="camera-outline" size={s(18)} color="#111827" />
              </TouchableOpacity>
            </View>
            <Text style={styles.profileName}>{name}</Text>
            {/* <Text style={styles.profileLocation}>{location}</Text> */}
            {roleLabel ? <Text style={styles.profileRole}>{roleLabel}</Text> : null}
          </View>

          <View style={styles.statsRow}>
            {statsCards.map((item) => (
              <View key={item.label} style={styles.statCard}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {item.value}
                </Text>
                <Text style={styles.statLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionHeading}>Contact Details</Text>
            <InfoRow label="Age" value={displayStr(personal?.age ?? undefined)} />
            <InfoRow label="Gender" value={displayStr(personal?.gender ?? undefined)} />
            <InfoRow label="Email ID" value={displayStr(personal?.email ?? undefined)} />
            <InfoRow label="Contact Number" value={displayStr(personal?.phone_number ?? undefined)} />
            <InfoRow label="Service scope" value={displayStr(personal?.service_scope ?? undefined)} isLast />

            <View style={styles.divider} />

            <Text style={styles.sectionHeading}>Work Overview</Text>
            <InfoRow label="Users Registered" value={displayStr(work?.users_registered ?? undefined)} />
            <InfoRow label="Tests Completed" value={displayStr(work?.tests_completed ?? undefined)} />
            <InfoRow label="Walk-in Tests" value={displayStr(work?.walk_in_tests ?? undefined)} />
            <InfoRow label="Home Visits" value={displayStr(work?.home_visits ?? undefined)} isLast />

            <View style={styles.divider} />

            <Text style={styles.sectionHeading}>Earnings</Text>
            <InfoRow label="Total Earnings" value={formatInr(earnings?.total_amount, earnings?.currency)} />
            <InfoRow label="This Month" value={formatInr(earnings?.current_month_amount, earnings?.currency)} />
            <InfoRow label="Wallet Balance" value={formatInr(earnings?.wallet_balance, earnings?.currency)} isLast />
          </View>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={noop}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.linkRowLabel}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={s(20)} color={LABEL_GRAY} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={noop}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.linkRowLabel}>Settings</Text>
            <Ionicons name="chevron-forward" size={s(20)} color={LABEL_GRAY} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={openLogoutModal}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeEditModal} />
          <View style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, vs(12)) }]}>
            <Text style={styles.modalTitle}>Edit profile</Text>
            <Text style={styles.modalHint}>Update your details below.</Text>

            <Text style={styles.modalFieldLabel}>Full name</Text>
            <TextInput
              style={styles.modalInput}
              value={editFullName}
              onChangeText={setEditFullName}
              placeholder="Full name"
              placeholderTextColor={COLORS.PLACEHOLDER}
              autoCapitalize="words"
              editable={!savingProfile}
            />

            <Text style={styles.modalFieldLabel}>Email</Text>
            <TextInput
              style={styles.modalInput}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Email"
              placeholderTextColor={COLORS.PLACEHOLDER}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!savingProfile}
            />

            <Text style={styles.modalFieldLabel}>Gender</Text>
            <TextInput
              style={styles.modalInput}
              value={editGender}
              onChangeText={setEditGender}
              placeholder="e.g. Female, Male"
              placeholderTextColor={COLORS.PLACEHOLDER}
              autoCapitalize="words"
              editable={!savingProfile}
            />

            <Text style={styles.modalFieldLabel}>Age</Text>
            <TextInput
              style={styles.modalInput}
              value={editAge}
              onChangeText={setEditAge}
              placeholder="Age"
              placeholderTextColor={COLORS.PLACEHOLDER}
              keyboardType="number-pad"
              editable={!savingProfile}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closeEditModal}
                activeOpacity={0.85}
                disabled={savingProfile}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalUpdateBtn, savingProfile && styles.modalUpdateBtnDisabled]}
                onPress={() => saveProfileFromModal()}
                activeOpacity={0.85}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalUpdateText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomPopup
        isVisible={photoPickerVisible}
        onClose={closePhotoPickerModal}
        onConfirm={handleTakePhoto}
        onSecondaryConfirm={handlePickFromLibrary}
        title="Profile photo"
        message="Choose a source"
        iconName="camera-outline"
        cancelText="Cancel"
        secondaryConfirmText="Choose from library"
        confirmText="Take photo"
      />

      <CustomPopup
        isVisible={logoutModalVisible}
        onClose={closeLogoutModal}
        onConfirm={() => {
          if (!loggingOut) {
            confirmLogout();
          }
        }}
        title="Logout"
        message="Are you sure you want to logout?"
        iconName="log-out-outline"
        cancelText="Cancel"
        confirmText={loggingOut ? 'Logging out...' : 'Logout'}
      />
    </View>
  );
};

const InfoRow: React.FC<{
  label: string;
  value: string;
  isLast?: boolean;
}> = ({ label, value, isLast }) => (
  <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  headerShell: {
    backgroundColor: PRIMARY,
    borderBottomLeftRadius: ms(16),
    borderBottomRightRadius: ms(16),
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: PRIMARY,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorPad: {
    paddingHorizontal: ms(24),
  },
  errorText: {
    fontSize: s(15),
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: vs(16),
  },
  retryBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: vs(12),
    paddingHorizontal: ms(24),
    borderRadius: ms(10),
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: s(15),
    fontWeight: '700',
  },
  errorBlock: {
    paddingVertical: vs(24),
    alignItems: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ms(20),
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  modalCard: {
    width: '100%',
    maxWidth: ms(400),
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: ms(18),
    paddingTop: vs(18),
    paddingBottom: vs(16),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  modalTitle: {
    fontSize: s(18),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: vs(4),
  },
  modalHint: {
    fontSize: s(13),
    color: LABEL_GRAY,
    marginBottom: vs(14),
  },
  modalFieldLabel: {
    fontSize: s(13),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: vs(6),
  },
  modalInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: ms(10),
    paddingVertical: Platform.OS === 'ios' ? vs(12) : vs(10),
    paddingHorizontal: ms(12),
    fontSize: s(15),
    color: COLORS.TEXT_PRIMARY,
    marginBottom: vs(12),
    backgroundColor: '#FAFAFA',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: ms(10),
    marginTop: vs(4),
  },
  modalCancelBtn: {
    paddingVertical: vs(12),
    paddingHorizontal: ms(16),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
  },
  modalCancelText: {
    fontSize: s(15),
    fontWeight: '700',
    color: LABEL_GRAY,
  },
  modalUpdateBtn: {
    minWidth: ms(120),
    paddingVertical: vs(12),
    paddingHorizontal: ms(20),
    borderRadius: ms(10),
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalUpdateBtnDisabled: {
    opacity: 0.7,
  },
  modalUpdateText: {
    fontSize: s(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: ms(16),
    paddingTop: vs(20),
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: vs(20),
  },
  avatarWrap: {
    marginBottom: vs(12),
    alignSelf: 'center',
    position: 'relative',
    width: ms(112),
  },
  avatarLarge: {
    width: ms(112),
    height: ms(112),
    borderRadius: ms(56),
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarLargeText: {
    fontSize: s(36),
    fontWeight: '700',
    color: '#6B7280',
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: ms(112),
    height: ms(112),
    borderRadius: ms(56),
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFab: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  profileName: {
    fontSize: s(18),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  profileLocation: {
    marginTop: vs(4),
    fontSize: s(14),
    color: LABEL_GRAY,
    textAlign: 'center',
  },
  profileRole: {
    marginTop: vs(6),
    fontSize: s(13),
    color: LABEL_GRAY,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: ms(8),
    marginBottom: vs(20),
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: vs(14),
    paddingHorizontal: ms(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: s(17),
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: vs(6),
    textAlign: 'center',
  },
  statLabel: {
    fontSize: s(11),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: s(14),
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: ms(16),
    paddingTop: vs(16),
    paddingBottom: vs(8),
    marginBottom: vs(12),
  },
  sectionHeading: {
    fontSize: s(16),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: vs(12),
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: vs(14),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vs(12),
    gap: ms(12),
  },
  infoRowLast: {
    marginBottom: 0,
  },
  infoLabel: {
    flex: 0.42,
    fontSize: s(14),
    color: LABEL_GRAY,
  },
  infoValue: {
    flex: 0.58,
    fontSize: s(14),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'right',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: vs(16),
    paddingHorizontal: ms(16),
    marginBottom: vs(10),
  },
  linkRowLabel: {
    fontSize: s(16),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  logoutBtn: {
    marginTop: vs(8),
    alignSelf: 'stretch',
    paddingVertical: vs(14),
    borderRadius: ms(28),
    borderWidth: 1.5,
    borderColor: PRIMARY,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: s(16),
    fontWeight: '700',
    color: PRIMARY,
  },
});

export default Profile;
