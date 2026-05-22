// import React, { useState } from 'react';
// import {
//     ActivityIndicator,
//     Button,
//     Linking,
//     Modal,
//     StyleSheet,
//     Text,
//     TouchableOpacity,
//     View,
// } from 'react-native';
// import {
//     Camera,
//     useCameraDevice,
//     useCameraPermission,
//     useCodeScanner,
// } from 'react-native-vision-camera';
// import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
// import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import type { RootStackParamList } from '../../navigation/types';
// import { postRemidioQrResult } from '../../api/iotDeviceResults';
// import axiosInstance from '../../api/axiosInstance';

// type RemidioQRScannerProps = {
//     onBack?: () => void;
// };

// interface EyeReading {
//     S: string;
//     C: string;
//     A: string;
// }

// interface RemidioResult {
//     examID: string;
//     result: {
//         'R-Avg'?: EyeReading;
//         'L-Avg'?: EyeReading;
//         [key: string]: EyeReading | undefined;
//     };
// }

// type RemidioRouteProp = RouteProp<RootStackParamList, 'RemidioQRScanner'>;
// type RemidioNavProp = NativeStackNavigationProp<RootStackParamList>;

// const RemidioQRScanner = ({ onBack }: RemidioQRScannerProps) => {
//     const device = useCameraDevice('back');
//     const { hasPermission, requestPermission } = useCameraPermission();
//     const navigation = useNavigation<RemidioNavProp>();
//     const handleBack = onBack ?? (() => navigation.goBack());
//     const route = useRoute<RemidioRouteProp>();
//     const routeDeviceId = route.params?.deviceId ?? null;
//     const routeDeviceName = route.params?.deviceName ?? null;
//     const routeBookingItemId = route.params?.bookingItemId ?? null;
//     const routeBookingId = route.params?.bookingId ?? null;

//     const [qrValue, setQrValue] = useState<string>('');
//     const [scanned, setScanned] = useState<boolean>(false);
//     const [modalVisible, setModalVisible] = useState<boolean>(false);
//     const [scanResult, setScanResult] = useState<RemidioResult | null>(null);

//     // State for the post-Done "Generate PDF" modal
//     const [pdfModalVisible, setPdfModalVisible] = useState<boolean>(false);
//     const [isDoneLoading, setIsDoneLoading] = useState<boolean>(false);
//     const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);

//     /**
//      * Called when the user taps Done in the results modal.
//      * Posts QR result to the backend, then shows the Generate PDF modal.
//      */
//     const handleDone = async (): Promise<void> => {
//         console.log('[RemidioQRScanner] handleDone pressed');
//         if (!scanResult) {
//             console.log('[RemidioQRScanner] handleDone: no scanResult, closing modal');
//             setModalVisible(false);
//             setScanned(false);
//             setQrValue('');
//             setScanResult(null);
//             return;
//         }

//         setIsDoneLoading(true);
//         console.log('[RemidioQRScanner] handleDone: submitting QR result to backend');
//         console.log('[RemidioQRScanner] handleDone route params =', {
//             deviceId: routeDeviceId,
//             deviceName: routeDeviceName,
//             bookingItemId: routeBookingItemId,
//             bookingId: routeBookingId,
//             examID: scanResult.examID,
//         });

//         try {
//             if (routeDeviceId && routeBookingItemId) {
//                 const res = await postRemidioQrResult({
//                     deviceId: routeDeviceId,
//                     bookingItemId: routeBookingItemId,
//                     examID: scanResult.examID,
//                     result: scanResult.result as unknown as Record<string, unknown>,
//                 });
//                 console.log('[RemidioQRScanner] handleDone: POST qr-results success', res);
//             } else {
//                 console.log(
//                     '[RemidioQRScanner] handleDone: skipping POST — missing deviceId or bookingItemId',
//                     { deviceId: routeDeviceId, bookingItemId: routeBookingItemId },
//                 );
//             }
//         } catch (err) {
//             console.log('[RemidioQRScanner] handleDone: POST qr-results failed', err);
//         } finally {
//             setIsDoneLoading(false);
//         }

//         // Close the results modal and show the Generate PDF modal
//         setModalVisible(false);
//         console.log('[RemidioQRScanner] handleDone: showing Generate PDF modal');
//         setPdfModalVisible(true);
//     };

//     /**
//      * Called when the user taps "Generate PDF" in the PDF modal.
//      * Calls reports/payload/pdf with the bookingId, then navigates to Reports.
//      */
//     const handleGeneratePdf = async (): Promise<void> => {
//         console.log('[RemidioQRScanner] handleGeneratePdf pressed');
//         console.log('[RemidioQRScanner] handleGeneratePdf bookingId =', routeBookingId);

//         if (!routeBookingId) {
//             console.log(
//                 '[RemidioQRScanner] handleGeneratePdf: no bookingId available, navigating to Reports anyway',
//             );
//             setPdfModalVisible(false);
//             navigation.replace('Reports');
//             return;
//         }

//         setIsPdfLoading(true);
//         try {
//             const pdfBody = { bookingId: routeBookingId };
//             console.log('[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf body =', JSON.stringify(pdfBody, null, 2));

//             const pdfRes = await axiosInstance.post('reports/payload/pdf', pdfBody);
//             console.log('[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf status =', pdfRes.status);
//             console.log('[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf response =', JSON.stringify(pdfRes.data ?? {}, null, 2));
//         } catch (err) {
//             const e = err as { response?: { status?: number; data?: unknown }; message?: string };
//             console.log('[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf FAILED status =', e?.response?.status ?? 'no-status');
//             console.log('[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf FAILED data =', JSON.stringify(e?.response?.data ?? {}, null, 2));
//             console.log('[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf FAILED message =', e?.message ?? '(none)');
//         } finally {
//             setIsPdfLoading(false);
//         }

//         setPdfModalVisible(false);
//         console.log('[RemidioQRScanner] handleGeneratePdf: navigating to Reports with bookingId =', routeBookingId);
//         // replace instead of navigate so pressing back from Reports goes to TestActivity, not back to the scanner
//         navigation.replace('Reports', { bookingId: routeBookingId ?? undefined });
//     };

//     const handleClosePdfModal = () => {
//         console.log('[RemidioQRScanner] handleClosePdfModal: closing PDF modal without generating PDF');
//         setPdfModalVisible(false);
//         setScanned(false);
//         setQrValue('');
//         setScanResult(null);
//     };

//     const parseQR = async (value: string): Promise<void> => {
//         setQrValue(value);

//         try {
//             const json = JSON.parse(value) as RemidioResult;
//             if (json?.examID && json?.result) {
//                 console.log('[RemidioQRScanner] parseQR: valid Remidio JSON scanned, examID =', json.examID);
//                 setScanResult(json);
//                 setModalVisible(true);
//                 // API call intentionally deferred to Done button press
//                 return;
//             }
//         } catch {
//             // not a Remidio JSON
//         }

//         if (value.startsWith('http://') || value.startsWith('https://')) {
//             await Linking.openURL(value);
//             return;
//         }
//     };

//     const handleClose = () => {
//         setModalVisible(false);
//         setScanned(false);
//         setQrValue('');
//         setScanResult(null);
//     };

//     const handleScanAgain = () => {
//         setModalVisible(false);
//         setScanResult(null);
//         setScanned(false);
//         setQrValue('');
//     };

//     const codeScanner = useCodeScanner({
//         codeTypes: ['qr'],
//         onCodeScanned: codes => {
//             if (scanned) {
//                 return;
//             }
//             const value = codes[0]?.value;
//             if (!value) {
//                 return;
//             }
//             setScanned(true);
//             parseQR(value);
//         },
//     });

//     if (!hasPermission) {
//         return (
//             <View style={styles.deviceWrap}>
//                 <Header onBack={handleBack} />
//                 <Button title="Allow Camera" onPress={requestPermission} />
//             </View>
//         );
//     }

//     if (!device) {
//         return (
//             <View style={styles.deviceWrap}>
//                 <Header onBack={handleBack} />
//                 <Text style={styles.statusText}>No camera found</Text>
//             </View>
//         );
//     }

//     return (
//         <View style={styles.deviceWrap}>
//             <Header onBack={handleBack} />

//             <View style={styles.cameraWrap}>
//                 <Camera
//                     style={styles.camera}
//                     device={device}
//                     isActive={!scanned}
//                     codeScanner={codeScanner}
//                 />
//                 {!scanned && (
//                     <View style={styles.scanOverlay}>
//                         <View style={styles.scanFrame} />
//                         <Text style={styles.scanHint}>Align QR code within the frame</Text>
//                     </View>
//                 )}
//             </View>

//             <View style={styles.footer}>
//                 {scanned && !modalVisible && (
//                     <TouchableOpacity style={styles.scanAgainBtn} onPress={handleScanAgain}>
//                         <Text style={styles.scanAgainText}>Scan Again</Text>
//                     </TouchableOpacity>
//                 )}
//             </View>

//             {scanResult && (
//                 <ResultModal
//                     visible={modalVisible}
//                     result={scanResult}
//                     onClose={handleClose}
//                     onScanAgain={handleScanAgain}
//                     onDone={handleDone}
//                     isDoneLoading={isDoneLoading}
//                 />
//             )}

//             <GeneratePdfModal
//                 visible={pdfModalVisible}
//                 onGeneratePdf={handleGeneratePdf}
//                 onClose={handleClosePdfModal}
//                 isPdfLoading={isPdfLoading}
//             />
//         </View>
//     );
// };

// interface ResultModalProps {
//     visible: boolean;
//     result: RemidioResult;
//     onClose: () => void;
//     onScanAgain: () => void;
//     onDone: () => void;
//     isDoneLoading: boolean;
// }

// const MetricRow = ({ label, value }: { label: string; value: string }) => (
//     <View style={styles.metricRow}>
//         <Text style={styles.metricLabel}>{label}</Text>
//         <Text style={styles.metricValue}>{value}</Text>
//     </View>
// );

// const EyeCard = ({
//     title,
//     icon,
//     reading,
//     cardStyle,
// }: {
//     title: string;
//     icon: string;
//     reading?: EyeReading;
//     cardStyle?: object;
// }) => (
//     <View style={[styles.eyeCard, cardStyle]}>
//         <View style={styles.eyeCardHeader}>
//             <Text style={styles.eyeIcon}>{icon}</Text>
//             <Text style={styles.eyeTitle}>{title}</Text>
//         </View>
//         <View style={styles.divider} />
//         {reading ? (
//             <>
//                 <MetricRow label="SPH (Sphere)" value={reading.S || '-'} />
//                 <MetricRow label="CYL (Cylinder)" value={reading.C || '-'} />
//                 <MetricRow label="Axis" value={reading.A ? `${reading.A}°` : '-'} />
//             </>
//         ) : (
//             <Text style={styles.noDataText}>No eye data available</Text>
//         )}
//     </View>
// );

// const ResultModal = ({ visible, result, onClose, onScanAgain, onDone, isDoneLoading }: ResultModalProps) => {
//     const rAvg = result.result['R-Avg'];
//     const lAvg = result.result['L-Avg'];

//     return (
//         <Modal
//             visible={visible}
//             transparent
//             animationType="slide"
//             onRequestClose={onClose}>
//             <View style={styles.modalOverlay}>
//                 <View style={styles.modalContainer}>
//                     {/* Header */}
//                     <View style={styles.modalHeader}>
//                         <View style={styles.modalTitleWrap}>
//                             <Text style={styles.modalTitle}>Eye Exam Results</Text>
//                             <View style={styles.examIdBadge}>
//                                 <Text style={styles.examIdLabel}>Exam ID</Text>
//                                 <Text style={styles.examIdValue}>{result.examID}</Text>
//                             </View>
//                         </View>
//                         <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
//                             <Text style={styles.closeBtnText}>✕</Text>
//                         </TouchableOpacity>
//                     </View>

//                     {/* Eye Cards */}
//                     <View style={styles.cardsRow}>
//                         <EyeCard
//                             title="Right Eye"
//                             icon="👁"
//                             reading={rAvg}
//                             cardStyle={styles.rightEyeCard}
//                         />
//                         <EyeCard
//                             title="Left Eye"
//                             icon="👁"
//                             reading={lAvg}
//                             cardStyle={styles.leftEyeCard}
//                         />
//                     </View>

//                     {/* Legend */}
//                     <View style={styles.legend}>
//                         <Text style={styles.legendText}>
//                             SPH: Sphere correction &nbsp;·&nbsp; CYL: Cylinder correction
//                             &nbsp;·&nbsp; Axis: Orientation
//                         </Text>
//                     </View>

//                     {/* Actions */}
//                     <View style={styles.actionsRow}>
//                         <TouchableOpacity
//                             style={[styles.actionBtn, styles.scanAgainOutline]}
//                             onPress={onScanAgain}>
//                             <Text style={styles.scanAgainOutlineText}>Scan Again</Text>
//                         </TouchableOpacity>
//                         <TouchableOpacity
//                             style={[styles.actionBtn, styles.doneBtn, isDoneLoading && styles.disabledBtn]}
//                             onPress={onDone}
//                             disabled={isDoneLoading}>
//                             {isDoneLoading ? (
//                                 <ActivityIndicator color="#fff" size="small" />
//                             ) : (
//                                 <Text style={styles.doneBtnText}>Done</Text>
//                             )}
//                         </TouchableOpacity>
//                     </View>
//                 </View>
//             </View>
//         </Modal>
//     );
// };

// interface GeneratePdfModalProps {
//     visible: boolean;
//     onGeneratePdf: () => void;
//     onClose: () => void;
//     isPdfLoading: boolean;
// }

// const GeneratePdfModal = ({ visible, onGeneratePdf, onClose, isPdfLoading }: GeneratePdfModalProps) => (
//     <Modal
//         visible={visible}
//         transparent
//         animationType="slide"
//         onRequestClose={onClose}>
//         <View style={styles.modalOverlay}>
//             <View style={styles.modalContainer}>
//                 {/* Header */}
//                 <View style={styles.modalHeader}>
//                     <View style={styles.modalTitleWrap}>
//                         <Text style={styles.modalTitle}>Results Saved</Text>
//                         <Text style={styles.pdfModalSubtitle}>
//                             Eye exam data has been recorded. Generate a PDF report to view detailed results.
//                         </Text>
//                     </View>
//                     <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={isPdfLoading}>
//                         <Text style={styles.closeBtnText}>✕</Text>
//                     </TouchableOpacity>
//                 </View>

//                 {/* Generate PDF Button — full width */}
//                 <TouchableOpacity
//                     style={[styles.generatePdfBtn, isPdfLoading && styles.disabledBtn]}
//                     onPress={onGeneratePdf}
//                     disabled={isPdfLoading}>
//                     {isPdfLoading ? (
//                         <ActivityIndicator color="#fff" size="small" />
//                     ) : (
//                         <Text style={styles.generatePdfBtnText}>Generate PDF</Text>
//                     )}
//                 </TouchableOpacity>
//             </View>
//         </View>
//     </Modal>
// );

// const Header = ({ onBack }: { onBack: () => void }) => (
//     <View style={styles.header}>
//         <TouchableOpacity style={styles.backButton} onPress={onBack}>
//             <Text style={styles.backButtonText}>{'‹'}</Text>
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Eye Scan — REMIDIO</Text>
//         <View style={styles.headerSpacer} />
//     </View>
// );

// export default RemidioQRScanner;

// const BLUE = '#2563EB';
// const BLUE_LIGHT = '#EFF6FF';
// const GREEN = '#059669';
// const GREEN_LIGHT = '#ECFDF5';

// const styles = StyleSheet.create({
//     deviceWrap: {
//         flex: 1,
//         backgroundColor: '#F8FAFC',
//     },
//     noDataText: {
//         fontSize: 13,
//         color: '#64748B',
//         textAlign: 'center',
//         marginTop: 12,
//         fontWeight: '500',
//     },
//     header: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         paddingHorizontal: 16,
//         paddingVertical: 12,
//         backgroundColor: '#fff',
//         borderBottomWidth: 1,
//         borderBottomColor: '#E2E8F0',
//     },
//     backButton: {
//         paddingVertical: 4,
//         paddingRight: 12,
//     },
//     backButtonText: {
//         fontSize: 26,
//         fontWeight: '300',
//         color: '#111',
//         lineHeight: 28,
//     },
//     headerTitle: {
//         flex: 1,
//         textAlign: 'center',
//         fontSize: 16,
//         fontWeight: '700',
//         color: '#0F172A',
//     },
//     headerSpacer: {
//         width: 32,
//     },
//     cameraWrap: {
//         flex: 1,
//         margin: 16,
//         overflow: 'hidden',
//         borderRadius: 16,
//         backgroundColor: '#000',
//     },
//     camera: {
//         flex: 1,
//     },
//     scanOverlay: {
//         ...StyleSheet.absoluteFillObject,
//         alignItems: 'center',
//         justifyContent: 'center',
//     },
//     scanFrame: {
//         width: 220,
//         height: 220,
//         borderWidth: 3,
//         borderColor: '#fff',
//         borderRadius: 16,
//         backgroundColor: 'transparent',
//     },
//     scanHint: {
//         marginTop: 16,
//         color: '#fff',
//         fontSize: 13,
//         fontWeight: '500',
//         backgroundColor: 'rgba(0,0,0,0.45)',
//         paddingHorizontal: 12,
//         paddingVertical: 6,
//         borderRadius: 20,
//         overflow: 'hidden',
//     },
//     footer: {
//         paddingHorizontal: 16,
//         paddingBottom: 20,
//     },
//     scanAgainBtn: {
//         backgroundColor: BLUE,
//         borderRadius: 12,
//         paddingVertical: 14,
//         alignItems: 'center',
//     },
//     scanAgainText: {
//         color: '#fff',
//         fontWeight: '700',
//         fontSize: 15,
//     },
//     statusText: {
//         fontSize: 14,
//         color: '#64748B',
//         textAlign: 'center',
//         marginTop: 20,
//     },

//     // Modal
//     modalOverlay: {
//         flex: 1,
//         backgroundColor: 'rgba(15,23,42,0.55)',
//         justifyContent: 'flex-end',
//     },
//     modalContainer: {
//         backgroundColor: '#fff',
//         borderTopLeftRadius: 24,
//         borderTopRightRadius: 24,
//         paddingHorizontal: 20,
//         paddingBottom: 32,
//         paddingTop: 20,
//     },
//     modalHeader: {
//         flexDirection: 'row',
//         alignItems: 'flex-start',
//         marginBottom: 20,
//     },
//     modalTitleWrap: {
//         flex: 1,
//     },
//     modalTitle: {
//         fontSize: 20,
//         fontWeight: '800',
//         color: '#0F172A',
//         marginBottom: 6,
//     },
//     pdfModalSubtitle: {
//         fontSize: 13,
//         color: '#64748B',
//         lineHeight: 18,
//         marginTop: 4,
//     },
//     examIdBadge: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         backgroundColor: '#F1F5F9',
//         borderRadius: 8,
//         paddingHorizontal: 10,
//         paddingVertical: 5,
//         alignSelf: 'flex-start',
//         gap: 6,
//     },
//     examIdLabel: {
//         fontSize: 12,
//         color: '#64748B',
//         fontWeight: '600',
//     },
//     examIdValue: {
//         fontSize: 12,
//         color: '#0F172A',
//         fontWeight: '700',
//     },
//     closeBtn: {
//         width: 32,
//         height: 32,
//         borderRadius: 16,
//         backgroundColor: '#F1F5F9',
//         alignItems: 'center',
//         justifyContent: 'center',
//         marginLeft: 8,
//     },
//     closeBtnText: {
//         fontSize: 14,
//         color: '#475569',
//         fontWeight: '700',
//     },

//     // Eye Cards
//     cardsRow: {
//         flexDirection: 'row',
//         gap: 12,
//         marginBottom: 16,
//     },
//     eyeCard: {
//         flex: 1,
//         borderRadius: 16,
//         padding: 14,
//     },
//     rightEyeCard: {
//         backgroundColor: BLUE_LIGHT,
//         borderWidth: 1,
//         borderColor: '#BFDBFE',
//     },
//     leftEyeCard: {
//         backgroundColor: GREEN_LIGHT,
//         borderWidth: 1,
//         borderColor: '#A7F3D0',
//     },
//     eyeCardHeader: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         marginBottom: 10,
//         gap: 6,
//     },
//     eyeIcon: {
//         fontSize: 18,
//     },
//     eyeTitle: {
//         fontSize: 14,
//         fontWeight: '700',
//         color: '#0F172A',
//     },
//     divider: {
//         height: 1,
//         backgroundColor: 'rgba(0,0,0,0.08)',
//         marginBottom: 10,
//     },
//     metricRow: {
//         flexDirection: 'row',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         paddingVertical: 5,
//     },
//     metricLabel: {
//         fontSize: 12,
//         color: '#475569',
//         fontWeight: '500',
//         flex: 1,
//     },
//     metricValue: {
//         fontSize: 14,
//         color: '#0F172A',
//         fontWeight: '700',
//         textAlign: 'right',
//     },

//     // Legend
//     legend: {
//         backgroundColor: '#F8FAFC',
//         borderRadius: 10,
//         paddingHorizontal: 12,
//         paddingVertical: 8,
//         marginBottom: 20,
//     },
//     legendText: {
//         fontSize: 11,
//         color: '#94A3B8',
//         textAlign: 'center',
//         lineHeight: 16,
//     },

//     // Action buttons
//     actionsRow: {
//         flexDirection: 'row',
//         gap: 12,
//     },
//     actionBtn: {
//         flex: 1,
//         borderRadius: 12,
//         paddingVertical: 14,
//         alignItems: 'center',
//     },
//     scanAgainOutline: {
//         borderWidth: 1.5,
//         borderColor: BLUE,
//         backgroundColor: 'transparent',
//     },
//     scanAgainOutlineText: {
//         color: BLUE,
//         fontWeight: '700',
//         fontSize: 15,
//     },
//     doneBtn: {
//         backgroundColor: BLUE,
//     },
//     doneBtnText: {
//         color: '#fff',
//         fontWeight: '700',
//         fontSize: 15,
//     },
//     disabledBtn: {
//         opacity: 0.6,
//     },

//     // Generate PDF button
//     generatePdfBtn: {
//         backgroundColor: BLUE,
//         borderRadius: 12,
//         paddingVertical: 16,
//         alignItems: 'center',
//         width: '100%',
//     },
//     generatePdfBtnText: {
//         color: '#fff',
//         fontWeight: '700',
//         fontSize: 16,
//     },
// });

















// nEW CODE WITH NEW UI

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  useWindowDimensions,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { postRemidioQrResult } from '../../api/iotDeviceResults';
import axiosInstance from '../../api/axiosInstance';
import { setPendingCompletedBookingItemId } from '../../Utils/multiDeviceSession';
import autoRefractometerImg from '../../assets/iot/auto_refractometer.png';
import { COLORS, FONT_SIZE, SPACING } from '../../Constants/theme';
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
type RemidioQRScannerProps = {
  onBack?: () => void;
};

interface EyeReading {
  S: string;
  C: string;
  A: string;
}

interface RemidioResult {
  examID: string;
  result: {
    'R-Avg'?: EyeReading;
    'L-Avg'?: EyeReading;
    [key: string]: EyeReading | undefined;
  };
}

type RemidioRouteProp = RouteProp<RootStackParamList, 'RemidioQRScanner'>;
type RemidioNavProp = NativeStackNavigationProp<RootStackParamList>;

const RemidioQRScanner = ({ onBack }: RemidioQRScannerProps) => {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const navigation = useNavigation<RemidioNavProp>();
  const handleBack = onBack ?? (() => navigation.goBack());
  const route = useRoute<RemidioRouteProp>();
  const routeDeviceId = route.params?.deviceId ?? null;
  const routeDeviceName = route.params?.deviceName ?? null;
  const routeBookingItemId = route.params?.bookingItemId ?? null;
  const routeBookingId = route.params?.bookingId ?? null;
  const routeIsMultiDevice = route.params?.isMultiDevice ?? false;
  const [showScanner, setShowScanner] = useState(false);
  const { width, height } = useWindowDimensions();
  const sidePad = Math.min(24, Math.max(16, width * 0.04));
  const compact = height < 640;
  const RADIUS_LG = 20;
  const RADIUS_MD = 12;
  const RADIUS_PILL = 22;

  const [qrValue, setQrValue] = useState<string>('');
  const [scanned, setScanned] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<RemidioResult | null>(null);

  // State for the post-Done "Generate PDF" modal
  const [pdfModalVisible, setPdfModalVisible] = useState<boolean>(false);
  const [isDoneLoading, setIsDoneLoading] = useState<boolean>(false);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);

  /**
   * Called when the user taps Done in the results modal.
   * Posts QR result to the backend, then shows the Generate PDF modal.
   */
  const handleDone = async (): Promise<void> => {
    console.log('[RemidioQRScanner] handleDone pressed');
    if (!scanResult) {
      console.log(
        '[RemidioQRScanner] handleDone: no scanResult, closing modal',
      );
      setModalVisible(false);
      setScanned(false);
      setQrValue('');
      setScanResult(null);
      return;
    }

    setIsDoneLoading(true);
    console.log(
      '[RemidioQRScanner] handleDone: submitting QR result to backend',
    );
    console.log('[RemidioQRScanner] handleDone route params =', {
      deviceId: routeDeviceId,
      deviceName: routeDeviceName,
      bookingItemId: routeBookingItemId,
      bookingId: routeBookingId,
      examID: scanResult.examID,
    });

    try {
      if (routeDeviceId && routeBookingItemId) {
        const res = await postRemidioQrResult({
          deviceId: routeDeviceId,
          bookingItemId: routeBookingItemId,
          examID: scanResult.examID,
          result: scanResult.result as unknown as Record<string, unknown>,
        });
        console.log(
          '[RemidioQRScanner] handleDone: POST qr-results success',
          res,
        );
      } else {
        console.log(
          '[RemidioQRScanner] handleDone: skipping POST — missing deviceId or bookingItemId',
          { deviceId: routeDeviceId, bookingItemId: routeBookingItemId },
        );
      }
    } catch (err) {
      console.log('[RemidioQRScanner] handleDone: POST qr-results failed', err);
    } finally {
      setIsDoneLoading(false);
    }

    setModalVisible(false);

    if (routeIsMultiDevice && routeBookingItemId) {
      // Multi-device flow: store the completed item id in a module-level variable then go back.
      // goBack() does not touch DeviceSelect's params — devices/packages stay intact.
      setPendingCompletedBookingItemId(routeBookingItemId);
      navigation.goBack();
      return;
    }

    // Single-device flow: show Generate PDF modal as before.
    console.log('[RemidioQRScanner] handleDone: showing Generate PDF modal');
    setPdfModalVisible(true);
  };

  /**
   * Called when the user taps "Generate PDF" in the PDF modal.
   * Calls reports/payload/pdf with the bookingId, then navigates to Reports.
   */
  const handleGeneratePdf = async (): Promise<void> => {
    console.log('[RemidioQRScanner] handleGeneratePdf pressed');
    console.log(
      '[RemidioQRScanner] handleGeneratePdf bookingId =',
      routeBookingId,
    );

    if (!routeBookingId) {
      console.log(
        '[RemidioQRScanner] handleGeneratePdf: no bookingId available, navigating to Reports anyway',
      );
      setPdfModalVisible(false);
      navigation.replace('Reports');
      return;
    }

    setIsPdfLoading(true);
    try {
      const pdfBody = { bookingId: routeBookingId };
      console.log(
        '[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf body =',
        JSON.stringify(pdfBody, null, 2),
      );

      const pdfRes = await axiosInstance.post('reports/payload/pdf', pdfBody);
      console.log(
        '[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf status =',
        pdfRes.status,
      );
      console.log(
        '[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf response =',
        JSON.stringify(pdfRes.data ?? {}, null, 2),
      );
    } catch (err) {
      const e = err as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      console.log(
        '[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf FAILED status =',
        e?.response?.status ?? 'no-status',
      );
      console.log(
        '[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf FAILED data =',
        JSON.stringify(e?.response?.data ?? {}, null, 2),
      );
      console.log(
        '[RemidioQRScanner] handleGeneratePdf: POST reports/payload/pdf FAILED message =',
        e?.message ?? '(none)',
      );
    } finally {
      setIsPdfLoading(false);
    }

    setPdfModalVisible(false);
    console.log(
      '[RemidioQRScanner] handleGeneratePdf: navigating to Reports with bookingId =',
      routeBookingId,
    );
    // replace instead of navigate so pressing back from Reports goes to TestActivity, not back to the scanner
    navigation.replace('Reports', { bookingId: routeBookingId ?? undefined });
  };

  const handleClosePdfModal = () => {
    console.log(
      '[RemidioQRScanner] handleClosePdfModal: closing PDF modal without generating PDF',
    );
    setPdfModalVisible(false);
    setScanned(false);
    setQrValue('');
    setScanResult(null);
  };

  const parseQR = async (value: string): Promise<void> => {
    setQrValue(value);

    try {
      const json = JSON.parse(value) as RemidioResult;
      if (json?.examID && json?.result) {
        console.log(
          '[RemidioQRScanner] parseQR: valid Remidio JSON scanned, examID =',
          json.examID,
        );
        setScanResult(json);
        setModalVisible(true);
        // API call intentionally deferred to Done button press
        return;
      }
    } catch {
      // not a Remidio JSON
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      await Linking.openURL(value);
      return;
    }
  };

  const handleClose = () => {
    setModalVisible(false);
    setScanned(false);
    setQrValue('');
    setScanResult(null);
  };

  const handleScanAgain = () => {
    setModalVisible(false);
    setScanResult(null);
    setScanned(false);
    setQrValue('');
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (scanned) {
        return;
      }
      const value = codes[0]?.value;
      if (!value) {
        return;
      }
      setScanned(true);
      parseQR(value);
    },
  });
  if (!showScanner) {
    return (
      <View style={styles.autoRefractometerRoot}>
        <View style={styles.headerShell}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <PreventiveHealthHeader
              title="Auto Refractometer "
              showBack
              onBackPress={handleBack}
            />
          </SafeAreaView>
        </View>

        <View
          style={[
            styles.autoRefractometerImageWrap,
            { paddingHorizontal: sidePad },
          ]}
        >
          <Image
            source={autoRefractometerImg}
            style={styles.autoRefractometerHeroImage}
            resizeMode="contain"
          />
        </View>

        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.autoRefractometerBottomCard,
            { marginHorizontal: sidePad },
            compact && styles.autoRefractometerBottomCardCompact,
          ]}
        >
          <Text
            style={[
              styles.autoRefractometerTitle,
              compact && styles.autoRefractometerTitleCompact,
            ]}
          >
            Pair Device
          </Text>

          <Text
            style={[
              styles.autoRefractometerDescription,
              compact && styles.autoRefractometerDescriptionCompact,
            ]}
            numberOfLines={compact ? 4 : undefined}
          >
            We’ve detected your Auto Refractometer. Please allow camera access
            and scan the QR code on the device.
          </Text>

          <TouchableOpacity
            style={styles.autoRefractometerButton}
            onPress={() => setShowScanner(true)}
            activeOpacity={0.88}
          >
            <Text style={styles.autoRefractometerButtonText}>Allow Camera</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }
  if (!hasPermission) {
    return (
      <View style={styles.deviceWrap}>
        <View style={styles.headerShell}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <PreventiveHealthHeader
              title="Eye Scan — REMIDIO"
              showBack
              onBackPress={handleBack}
            />
          </SafeAreaView>
        </View>

        <Button title="Allow Camera" onPress={requestPermission} />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.deviceWrap}>
        <View style={styles.headerShell}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <PreventiveHealthHeader
              title="Eye Scan — REMIDIO"
              showBack
              onBackPress={handleBack}
            />
          </SafeAreaView>
        </View>
        <Text style={styles.statusText}>No camera found</Text>
      </View>
    );
  }

  return (
    <View style={styles.deviceWrap}>
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="Eye Scan — REMIDIO"
            showBack
            onBackPress={handleBack}
          />
        </SafeAreaView>
      </View>

      <View style={styles.cameraWrap}>
        <Camera
          style={styles.camera}
          device={device}
          isActive={!scanned}
          codeScanner={codeScanner}
        />
        {!scanned && (
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>Align QR code within the frame</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {scanned && !modalVisible && (
          <TouchableOpacity
            style={styles.scanAgainBtn}
            onPress={handleScanAgain}
          >
            <Text style={styles.scanAgainText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>

      {scanResult && (
        <ResultModal
          visible={modalVisible}
          result={scanResult}
          onClose={handleClose}
          onScanAgain={handleScanAgain}
          onDone={handleDone}
          isDoneLoading={isDoneLoading}
        />
      )}

      <GeneratePdfModal
        visible={pdfModalVisible}
        onGeneratePdf={handleGeneratePdf}
        onClose={handleClosePdfModal}
        isPdfLoading={isPdfLoading}
      />
    </View>
  );
};

interface ResultModalProps {
  visible: boolean;
  result: RemidioResult;
  onClose: () => void;
  onScanAgain: () => void;
  onDone: () => void;
  isDoneLoading: boolean;
}

const MetricRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metricRow}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const EyeCard = ({
  title,
  icon,
  reading,
  cardStyle,
}: {
  title: string;
  icon: string;
  reading?: EyeReading;
  cardStyle?: object;
}) => (
  <View style={[styles.eyeCard, cardStyle]}>
    <View style={styles.eyeCardHeader}>
      <Text style={styles.eyeIcon}>{icon}</Text>
      <Text style={styles.eyeTitle}>{title}</Text>
    </View>
    <View style={styles.divider} />
    {reading ? (
      <>
        <MetricRow label="SPH (Sphere)" value={reading.S || '-'} />
        <MetricRow label="CYL (Cylinder)" value={reading.C || '-'} />
        <MetricRow label="Axis" value={reading.A ? `${reading.A}°` : '-'} />
      </>
    ) : (
      <Text style={styles.noDataText}>No eye data available</Text>
    )}
  </View>
);

const ResultModal = ({
  visible,
  result,
  onClose,
  onScanAgain,
  onDone,
  isDoneLoading,
}: ResultModalProps) => {
  const rAvg = result.result['R-Avg'];
  const lAvg = result.result['L-Avg'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalTitle}>Eye Exam Results</Text>
              <View style={styles.examIdBadge}>
                <Text style={styles.examIdLabel}>Exam ID</Text>
                <Text style={styles.examIdValue}>{result.examID}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Eye Cards */}
          <View style={styles.cardsRow}>
            <EyeCard
              title="Right Eye"
              icon="👁"
              reading={rAvg}
              cardStyle={styles.rightEyeCard}
            />
            <EyeCard
              title="Left Eye"
              icon="👁"
              reading={lAvg}
              cardStyle={styles.leftEyeCard}
            />
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendText}>
              SPH: Sphere correction &nbsp;·&nbsp; CYL: Cylinder correction
              &nbsp;·&nbsp; Axis: Orientation
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.scanAgainOutline]}
              onPress={onScanAgain}
            >
              <Text style={styles.scanAgainOutlineText}>Scan Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.doneBtn,
                isDoneLoading && styles.disabledBtn,
              ]}
              onPress={onDone}
              disabled={isDoneLoading}
            >
              {isDoneLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.doneBtnText}>Done</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface GeneratePdfModalProps {
  visible: boolean;
  onGeneratePdf: () => void;
  onClose: () => void;
  isPdfLoading: boolean;
}

const GeneratePdfModal = ({
  visible,
  onGeneratePdf,
  onClose,
  isPdfLoading,
}: GeneratePdfModalProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleWrap}>
            <Text style={styles.modalTitle}>Results Saved</Text>
            <Text style={styles.pdfModalSubtitle}>
              Eye exam data has been recorded. Generate a PDF report to view
              detailed results.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            disabled={isPdfLoading}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Generate PDF Button — full width */}
        <TouchableOpacity
          style={[styles.generatePdfBtn, isPdfLoading && styles.disabledBtn]}
          onPress={onGeneratePdf}
          disabled={isPdfLoading}
        >
          {isPdfLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.generatePdfBtnText}>Generate PDF</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const Header = ({ onBack }: { onBack: () => void }) => (
  <SafeAreaView style={styles.header}>
    <TouchableOpacity style={styles.backButton} onPress={onBack}>
      <Text style={styles.backButtonText}>{'‹'}</Text>
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Eye Scan — REMIDIO</Text>
    <View style={styles.headerSpacer} />
  </SafeAreaView>
);

export default RemidioQRScanner;

const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const GREEN = '#059669';
const GREEN_LIGHT = '#ECFDF5';

const styles = StyleSheet.create({
  deviceWrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.WHITE,
    justifyContent: 'space-between',
  },
  noDataText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 26,
    fontWeight: '300',
    color: '#111',
    lineHeight: 28,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSpacer: {
    width: 32,
  },
  cameraWrap: {
    flex: 1,
    margin: 16,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scanHint: {
    marginTop: 16,
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  scanAgainBtn: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  scanAgainText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  statusText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 20,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  pdfModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 4,
  },
  examIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    gap: 6,
  },
  examIdLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  examIdValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeBtnText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },

  // Eye Cards
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  eyeCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
  },
  rightEyeCard: {
    backgroundColor: BLUE_LIGHT,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  leftEyeCard: {
    backgroundColor: GREEN_LIGHT,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  eyeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  eyeIcon: {
    fontSize: 18,
  },
  eyeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  metricLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
    textAlign: 'right',
  },

  // Legend
  legend: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  legendText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  scanAgainOutline: {
    borderWidth: 1.5,
    borderColor: BLUE,
    backgroundColor: 'transparent',
  },
  scanAgainOutlineText: {
    color: BLUE,
    fontWeight: '700',
    fontSize: 15,
  },
  doneBtn: {
    backgroundColor: BLUE,
  },
  doneBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  disabledBtn: {
    opacity: 0.6,
  },

  // Generate PDF button
  generatePdfBtn: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  generatePdfBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  autoRefractometerRoot: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.WHITE,
  },

  autoRefractometerImageWrap: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: SPACING.SM,
  },
  autoRefractometerHeroImage: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 0.85,
  },

  autoRefractometerBottomCard: {
    flexShrink: 0,
    marginHorizontal: SPACING.MD,
    marginBottom: SPACING.SM,
    marginTop: SPACING.XS,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.MD,
    paddingBottom: SPACING.MD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },

  autoRefractometerBottomCardCompact: {
    paddingTop: SPACING.SM,
    paddingBottom: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    marginBottom: SPACING.XS,
  },

  autoRefractometerTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },

  autoRefractometerTitleCompact: {
    fontSize: FONT_SIZE.LG,
    marginBottom: SPACING.XS,
  },

  autoRefractometerDescription: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.MD,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.MD,
  },

  autoRefractometerDescriptionCompact: {
    fontSize: FONT_SIZE.SM,
    lineHeight: 18,
    marginBottom: SPACING.SM,
  },

  autoRefractometerButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    borderRadius: 999,
    alignItems: 'center',
  },

  autoRefractometerButtonText: {
    color: COLORS.WHITE,
    fontSize: 17,
    fontWeight: '700',
  },
  headerShell: {
    backgroundColor: COLORS.PRIMARY,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },

  headerSafe: {
    backgroundColor: COLORS.PRIMARY,
  },
});
