import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { pick, types, isErrorWithCode, errorCodes, DocumentPickerResponse } from '@react-native-documents/picker';
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';
import { RootStackParamList } from '../../navigation/types';
import type { PickedFile, IdProofTypeApi } from '../../Services/identityVerificationTypes';
import {
  submitIdentityVerification,
  getIdentityVerificationStatus,
  type IdentityVerificationRecord,
} from '../../Services/authService';

type IdentityNavProp = NativeStackNavigationProp<
  RootStackParamList,
  'IdentityVerification'
>;

const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

const ID_PROOF_OPTIONS: ReadonlyArray<{ label: string; apiValue: IdProofTypeApi }> = [
  { label: 'Aadhaar Card', apiValue: 'AADHAR' },
  { label: 'PAN Card', apiValue: 'PAN' },
  { label: 'Voter ID', apiValue: 'VOTER_ID' },
];

const isApprovedVerification = (record: IdentityVerificationRecord | undefined): boolean => {
  if (!record) {
    return false;
  }
  const status = String(record.verification_status ?? '').toUpperCase();
  return status === 'APPROVED' || record.is_approved === true;
};

/** Only treat as submitted when the backend confirms upload (not a stub register record). */
const hasSubmittedVerification = (record: IdentityVerificationRecord | undefined): boolean => {
  if (!record) {
    return false;
  }
  if (record.submitted === true) {
    return true;
  }
  return Boolean(record.document_url?.trim());
};

const IdentityVerificationScreen: React.FC = () => {
  const navigation = useNavigation<IdentityNavProp>();

  const [idProofType, setIdProofType] = useState<IdProofTypeApi | ''>('');
  const [idNumber, setIdNumber] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [idProofFile, setIdProofFile] = useState<PickedFile | null>(null);
  const [labCertificateFile, setLabCertificateFile] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [headerChecking, setHeaderChecking] = useState(false);

  // Redirect to Home if approved; to VerificationPending only after documents were submitted.
  const checkStatusForRedirect = useCallback(async () => {
    try {
      const statusRes = await getIdentityVerificationStatus();
      const record = statusRes?.data;
      if (isApprovedVerification(record)) {
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      } else if (hasSubmittedVerification(record)) {
        navigation.reset({ index: 0, routes: [{ name: 'VerificationPending' }] });
      }
    } catch (e) {
      console.log('[IdentityVerificationScreen] status-check error:', e);
    }
  }, [navigation]);

  useEffect(() => {
    void checkStatusForRedirect();
  }, [checkStatusForRedirect]);

  const onPullToRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await checkStatusForRedirect();
    } finally {
      setRefreshing(false);
    }
  }, [checkStatusForRedirect]);

  const onHeaderRefresh = useCallback(async () => {
    if (headerChecking) {return;}
    setHeaderChecking(true);
    try {
      const statusRes = await getIdentityVerificationStatus();
      if (isApprovedVerification(statusRes?.data)) {
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      }
    } catch (e) {
      console.log('[IdentityVerificationScreen] header refresh error:', e);
    } finally {
      setHeaderChecking(false);
    }
  }, [headerChecking, navigation]);

  const pickIdDocument = async () => {
    try {
      const result: DocumentPickerResponse[] = await pick({
        type: [types.images, types.pdf],
        allowMultiSelection: false,
      });
      const file = result[0];
      if (file.size != null && file.size > DOCUMENT_MAX_BYTES) {
        Alert.alert('File too large', 'Please choose a file under 5 MB.');
        return;
      }
      setIdProofFile({
        uri: file.uri,
        name: file.name ?? 'document',
        type: file.type ?? 'application/octet-stream',
      });
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const pickLabCertificate = async () => {
    try {
      const result: DocumentPickerResponse[] = await pick({
        type: [types.images, types.pdf],
        allowMultiSelection: false,
      });
      const file = result[0];
      if (file.size != null && file.size > DOCUMENT_MAX_BYTES) {
        Alert.alert('File too large', 'Please choose a file under 5 MB.');
        return;
      }
      setLabCertificateFile({
        uri: file.uri,
        name: file.name ?? 'document',
        type: file.type ?? 'application/octet-stream',
      });
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handleContinue = async () => {
    if (!idProofType || !idNumber.trim()) {
      Alert.alert('Incomplete', 'Please select an ID proof type and enter the ID number.');
      return;
    }
    if (!idProofFile) {
      Alert.alert('Incomplete', 'Please upload your ID proof document.');
      return;
    }

    setLoading(true);
    try {
      const response = await submitIdentityVerification({
        id_proof_type: idProofType,
        id_number: idNumber.trim(),
        document: idProofFile,
        technician_certificate: labCertificateFile ?? undefined,
      });

      console.log('[IdentityVerificationScreen] submit response:', response);

      if (response.success) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'VerificationPending' }],
        });
      } else {
        Alert.alert('Error', response.message || 'Submission failed');
      }
    } catch (error: any) {
      console.log('[IdentityVerificationScreen] submit error:', error);
      Alert.alert('Error', error?.message ?? 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />
      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader
          title="Identity Verification"
          rightSlot={
            <TouchableWithoutFeedback onPress={onHeaderRefresh} hitSlop={10}>
              <View style={styles.headerIconBtn}>
                {headerChecking ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Ionicons name="refresh-outline" size={24} color="#FFF" />
                )}
              </View>
            </TouchableWithoutFeedback>
          }
        />
      </SafeAreaView>

      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullToRefresh}
              colors={['#1A49AB']}
              tintColor="#1A49AB"
            />
          }
        >
          <Text style={styles.description}>
            This helps us assign nearby patients and test{'\n'}requests.
          </Text>

          <Text style={styles.label}>ID Proof Type</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowDropdown(prev => !prev)}
            activeOpacity={0.7}
          >
            <Text style={idProofType ? styles.inputText : styles.placeholder}>
              {ID_PROOF_OPTIONS.find(o => o.apiValue === idProofType)?.label ?? 'Select'}
            </Text>
            <Text style={styles.dropdownIcon}>⌄</Text>
          </TouchableOpacity>

          {showDropdown && (
            <View style={styles.dropdownMenu}>
              {ID_PROOF_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.apiValue}
                  style={[
                    styles.dropdownOption,
                    idProofType === option.apiValue && styles.dropdownOptionSelected,
                  ]}
                  onPress={() => {
                    setIdProofType(option.apiValue);
                    setShowDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      idProofType === option.apiValue && styles.dropdownOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>ID Number</Text>
          <TextInput
            style={styles.input}
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder="Enter ID number"
            placeholderTextColor="#A0A0A0"
          />

          <UploadCard
            title="Upload ID Proof"
            uploadedFile={idProofFile}
            onUpload={pickIdDocument}
          />

          <UploadCard
            title="Upload Lab Technician Certificate"
            uploadedFile={labCertificateFile}
            onUpload={pickLabCertificate}
          />

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleContinue}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

// --- Sub-components ---

interface UploadCardProps {
  title: string;
  uploadedFile: PickedFile | null;
  onUpload: () => void;
}

const UploadCard: React.FC<UploadCardProps> = ({ title, uploadedFile, onUpload }) => (
  <View style={styles.uploadSection}>
    <Text style={styles.label}>{title}</Text>
    <View style={styles.uploadBox}>
      <View style={styles.uploadIconStack}>
        <View style={styles.cloudBackdrop} />
        <View style={styles.cloudCircle}>
          <Text style={styles.upArrow}>↑</Text>
        </View>
      </View>

      {uploadedFile ? (
        <Text style={styles.uploadedFileName} numberOfLines={1}>{uploadedFile.name}</Text>
      ) : (
        <>
          <Text style={styles.uploadMainText}>Upload Document</Text>
          <Text style={styles.uploadSubText}>
            Accepted formats: <Text style={styles.boldText}>JPG, PNG, PDF</Text>
          </Text>
          <Text style={styles.uploadSubText}>
            Max file size: <Text style={styles.boldText}>5 MB</Text>
          </Text>
        </>
      )}

      <TouchableOpacity style={styles.uploadButton} onPress={onUpload} activeOpacity={0.8}>
        <Text style={styles.uploadButtonText}>
          {uploadedFile ? 'Replace' : 'Upload'}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  headerSafe: {
    backgroundColor: '#1C39BB',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 28,
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 14,
    fontWeight: '400',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    marginTop: 14,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#E4E4E4',
    borderRadius: 8,
    backgroundColor: '#FFF',
    marginTop: 2,
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownOptionSelected: {
    backgroundColor: '#EEF1FF',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#000',
  },
  dropdownOptionTextSelected: {
    color: '#1A49AB',
    fontWeight: '600',
  },
  inputText: {
    fontSize: 14,
    color: '#000',
  },
  placeholder: {
    color: '#A0A0A0',
    fontSize: 14,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E4E4E4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#FFFFFF',
  },
  uploadSection: {
    marginBottom: 12,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    paddingVertical: 22,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  uploadIconStack: {
    width: 96,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cloudBackdrop: {
    position: 'absolute',
    width: 96,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#EEF4FF',
    opacity: 0.9,
    transform: [{ scaleX: 0.92 }, { scaleY: 0.82 }],
  },
  cloudCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1A49AB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upArrow: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  uploadMainText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  uploadSubText: {
    fontSize: 12,
    color: '#555',
  },
  boldText: {
    fontWeight: '700',
    color: '#000',
  },
  uploadedFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A49AB',
    marginBottom: 4,
    maxWidth: '80%',
  },
  uploadButton: {
    backgroundColor: '#1A49AB',
    borderRadius: 22,
    paddingHorizontal: 40,
    paddingVertical: 10,
    marginTop: 12,
  },
  uploadButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#1A49AB',
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default IdentityVerificationScreen;
