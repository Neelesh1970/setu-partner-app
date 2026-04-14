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
  Image,
  Platform,
  Modal,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { pick, types, isErrorWithCode, errorCodes, DocumentPickerResponse } from '@react-native-documents/picker';
import ScreenHeader from '../../Components/ScreenHeader/ScreenHeader';
import { RootStackParamList } from '../../navigation/types';
import type { PickedFile, IdProofTypeApi } from '../../Services/identityVerificationTypes';
import {
  submitIdentityVerification,
  getBackgroundImageS3Url,
  IDENTITY_VERIFICATION_MODAL_IMAGE_ID,
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

const IdentityVerificationScreen: React.FC = () => {
  const navigation = useNavigation<IdentityNavProp>();

  // --- Form States ---
  const [idProofType, setIdProofType] = useState<IdProofTypeApi | ''>('');
  const [idNumber, setIdNumber] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [idProofFile, setIdProofFile] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Modal & API States ---
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [modalImageLoading, setModalImageLoading] = useState(false);

  const loadModalIllustration = async () => {
    setModalImageLoading(true);
    try {
      const url = await getBackgroundImageS3Url(IDENTITY_VERIFICATION_MODAL_IMAGE_ID);
      if (url) {
        setModalImageUrl(url);
      }
    } catch {
      // Presigned URL is optional for closing the flow; modal still shows copy.
    } finally {
      setModalImageLoading(false);
    }
  };

  useEffect(() => {
    loadModalIllustration();
  }, []);

  useEffect(() => {
    if (!showSuccessModal || modalImageUrl) {
      return;
    }
    void loadModalIllustration();
  }, [showSuccessModal, modalImageUrl]);

  const handleModalClose = useCallback(() => {
    setShowSuccessModal(false);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);

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
      });

      console.log('[IdentityVerificationScreen] response:', response);
      
      // SUCCESS: Instead of navigating, show the Modal
      if (response.success) {
        setShowSuccessModal(true);
      } else {
        Alert.alert('Error', response.message || 'Submission failed');
      }
    } catch (error: any) {
      console.log('[IdentityVerificationScreen] error:', error);
      Alert.alert('Error', error?.message ?? 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Identity Verification" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.description}>
          This helps us assign nearby patients and test requests.
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
          <Text style={styles.dropdownIcon}>{showDropdown ? '▲' : '▼'}</Text>
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

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalBackdropRoot}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="dark"
            blurAmount={Platform.OS === 'ios' ? 16 : 24}
            reducedTransparencyFallbackColor="rgba(30, 30, 35, 0.92)"
            {...Platform.select({
              android: {
                blurRadius: 18,
                overlayColor: 'transparent',
              },
              default: {},
            })}
          />
          <View style={styles.modalBackdropTint} pointerEvents="none" />
          <View style={styles.modalForeground}>
            <View style={styles.modalCard}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={handleModalClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>

              <View style={styles.modalImageWrapper}>
                {modalImageUrl ? (
                  <Image
                    source={{ uri: modalImageUrl }}
                    style={styles.statusImage}
                    resizeMode="contain"
                  />
                ) : modalImageLoading ? (
                  <ActivityIndicator color="#1A49AB" size="large" />
                ) : (
                  <View style={styles.modalImagePlaceholder} />
                )}
              </View>

              <Text style={styles.modalTitle}>Verification in Progress</Text>
              <Text style={styles.modalSubText}>
                Your profile is under review. You will be notified within 24–48 hours after
                verification.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
      <View style={styles.cloudCircle}>
        <Text style={styles.upArrow}>↑</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 20,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    marginTop: 10,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
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
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#FAFAFA',
  },
  uploadSection: {
    marginBottom: 16,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 25,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  cloudCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A49AB',
    marginBottom: 10,
  },
  upArrow: {
    fontSize: 20,
    color: '#1A49AB',
    fontWeight: 'bold',
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
    borderRadius: 20,
    paddingHorizontal: 35,
    paddingVertical: 8,
    marginTop: 15,
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
    marginTop: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },

  modalBackdropRoot: {
    flex: 1,
  },
  /** Light dim on top of blur — keeps the popup crisp; blur handles the “frosted” look */
  modalBackdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  modalForeground: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 28,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
    zIndex: 2,
    backgroundColor: '#E8E8E8',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconText: {
    fontSize: 15,
    color: '#222',
    fontWeight: '700',
  },
  modalImageWrapper: {
    width: '100%',
    minHeight: 168,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  statusImage: {
    width: 200,
    height: 168,
  },
  modalImagePlaceholder: {
    width: 200,
    height: 168,
    backgroundColor: '#F3F5F9',
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  modalSubText: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
    paddingHorizontal: 4,
  },
});

export default IdentityVerificationScreen;