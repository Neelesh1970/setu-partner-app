import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import RazorpayCheckout from 'react-native-razorpay';
import { RootStackParamList } from '../../navigation/types';
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';
import {
  createRegistrationOrder,
  confirmRegistration,
  initAutopay5,
  confirmAutopay5,
} from '../../Services/authService';
import { saveRegisteredPatientAuthData, getLabUserId } from '../../Utils/storage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RegisterPlans'>;
type Route = RouteProp<RootStackParamList, 'RegisterPlans'>;

type Plan = 'yearly' | 'trial';

const RegisterPlans: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { mobile, firstName, lastName, dob, gender, lab_user_id } = route.params;

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);

  console.log('[RegisterPlans] Route params:', { mobile, firstName, lastName, dob, gender, lab_user_id });

  const handleYearlyPlan = async () => {
    console.log('==============================');
    console.log('🚀 [FLOW START] YEARLY PLAN');
    console.log('➡️ PARAMS:', { firstName, lastName, mobile });
    console.log('==============================');
    setLoading(true);
    try {
      const storedLabUserId = await getLabUserId();
      console.log('[YearlyPlan] lab_user_id from storage:', storedLabUserId);

      const orderRes = await createRegistrationOrder({
        firstName,
        lastName,
        phoneNumber: mobile,
      });

      console.log('🟢 [STEP 3] ORDER RESPONSE RECEIVED');
      console.log(JSON.stringify(orderRes, null, 2));

      const orderId = orderRes?.data?.order?.id;
      console.log('➡️ FINAL orderId:', orderId);
      const amount = orderRes?.data?.order?.amount ?? 19900;

      if (!orderId) {
        console.log('🔴 [FINAL ERROR] orderId missing');
        Alert.alert('Error', 'Failed to create order. Please try again.');
        return;
      }

      const options = {
        description: 'Yearly Membership Plan',
        currency: 'INR',
        key: 'rzp_test_SJVDT02ci0WUK8', // ✅ TEST KEY
        amount: String(amount),
        order_id: orderId,
        name: 'Setu Partner App',
        prefill: {
          contact: mobile,
          name: `${firstName} ${lastName}`,
        },
        theme: { color: '#2F3DBD' },
      };

      console.log('[YearlyPlan] Razorpay options:', JSON.stringify(options, null, 2));

      setLoading(false);

      RazorpayCheckout.open(options)
        .then(async (paymentData: any) => {
          console.log('[YearlyPlan] ✅ Razorpay payment success — starting confirm flow');
          console.log('[YearlyPlan] paymentData:', JSON.stringify(paymentData, null, 2));
          setLoading(true);

          // Wrap the entire post-payment flow in its own try/catch so any error
          // (API failure, parsing, navigation) is handled here and does NOT leak
          // into the Razorpay .catch() below (which is for Razorpay-specific errors only).
          try {
            const confirmPayload = {
              firstName,
              lastName,
              phoneNumber: mobile,
              dob,
              gender,
              email: 'test@example.com',
              username: mobile,
              password: 'Pass@123',
              confirmPassword: 'Pass@123',
              razorpay_order_id: paymentData.razorpay_order_id,
              razorpay_payment_id: paymentData.razorpay_payment_id,
              razorpay_signature: paymentData.razorpay_signature,
              lab_user_id: storedLabUserId ?? lab_user_id,
            };
            console.log('[YearlyPlan] confirmRegistration payload:', JSON.stringify(confirmPayload, null, 2));

            const confirmRes = await confirmRegistration(confirmPayload);
            console.log('[YearlyPlan] RAW confirmRes (full):', JSON.stringify(confirmRes, null, 2));

            // Try multiple response shapes — backend may nest differently.
            const token =
              confirmRes?.data?.response?.token ??
              (confirmRes as any)?.data?.token ??
              (confirmRes as any)?.token;
            const refreshToken =
              confirmRes?.data?.response?.refreshToken ??
              (confirmRes as any)?.data?.refreshToken ??
              (confirmRes as any)?.refreshToken;
            const userID =
              confirmRes?.data?.response?.user?.user_id ??
              (confirmRes as any)?.data?.user?.user_id ??
              (confirmRes as any)?.user?.user_id;

            console.log('========== NEW USER TOKENS (created under Lab User ID) ==========');
            console.log('Lab User ID    :', storedLabUserId ?? lab_user_id);
            console.log('User Token     :', token ?? 'MISSING');
            console.log('Refresh Token  :', refreshToken ?? 'MISSING');
            console.log('User ID        :', userID ?? 'MISSING');
            console.log('==================================================================');

            if (!token || !userID) {
              console.warn('[YearlyPlan] ❌ token or userID missing after confirmRegistration — check RAW confirmRes above');
              Alert.alert('Error', 'Registration confirmed but session data missing. Please try again.');
              return;
            }

            // Save patient tokens to patient-only keys — do NOT call saveAuthData here.
            // saveAuthData would overwrite the lab worker's AUTH_TOKEN/REFRESH_TOKEN.
            await saveRegisteredPatientAuthData(token, String(userID), refreshToken);
            console.log('[YearlyPlan] ✅ Patient auth saved to patient-only keys (lab worker session preserved)');
            console.log('[YearlyPlan] ✅ Calling navigation.reset → [Home, PreventiveHealth]');

            navigation.reset({
              index: 1,
              routes: [{ name: 'Home' }, { name: 'PreventiveHealth' }],
            });
          } catch (confirmErr: any) {
            console.error('[YearlyPlan] ❌ Error inside post-payment flow:', confirmErr?.message, confirmErr);
            Alert.alert('Error', confirmErr?.message || 'Something went wrong after payment. Please contact support.');
          } finally {
            setLoading(false);
          }
        })
        .catch((razorpayError: any) => {
          // This catch is ONLY for Razorpay-level errors (e.g. user dismissed, network).
          // Post-payment errors are handled inside the .then() try/catch above.
          console.log('[YearlyPlan] Razorpay catch — code:', razorpayError?.code, '| description:', razorpayError?.description);
          if (razorpayError?.code !== 0) {
            // code 0 = user dismissed, not an error
            Alert.alert('Payment Failed', razorpayError?.description ?? 'Payment could not be completed.');
          }
          setLoading(false);
        });
    } catch (err: any) {
      console.error('[YearlyPlan] Caught error:', err?.message, err);
      Alert.alert('Error', err?.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const handleTrialPlan = async () => {
    console.log('[TrialPlan] Starting trial plan flow');
    console.log('[TrialPlan] initAutopay5 payload:', { firstName, lastName, phoneNumber: mobile, dob, gender });
    setLoading(true);
    try {
      const storedLabUserId = await getLabUserId();
      console.log('[TrialPlan] lab_user_id from storage:', storedLabUserId);

      const initRes = await initAutopay5({
        firstName,
        lastName,
        phoneNumber: mobile,
        dob,
        gender,
      });

      console.log('[TrialPlan] SUBSCRIPTION INIT RESPONSE:', JSON.stringify(initRes, null, 2));

      const subscriptionId = initRes?.checkoutPayload?.subscriptionId;
      const customerId = initRes?.checkoutPayload?.customerId;
      const keyId = initRes?.checkoutPayload?.keyId;

      console.log('[TrialPlan] subscriptionId:', subscriptionId, '| customerId:', customerId, '| keyId:', keyId);

      if (!subscriptionId) {
        console.warn('[TrialPlan] subscriptionId missing — aborting');
        Alert.alert('Error', 'Failed to create subscription.');
        setLoading(false);
        return;
      }

      const options = {
        description: 'Trial Plan ₹5',
        currency: 'INR',
        key: keyId ?? 'rzp_test_SJVDT02ci0WUK8',
        subscription_id: subscriptionId,
        name: 'Setu Partner App',
        prefill: {
          contact: mobile,
          name: `${firstName} ${lastName}`,
        },
        theme: { color: '#2F3DBD' },
      };

      console.log('[TrialPlan] Razorpay options:', JSON.stringify(options, null, 2));

      setLoading(false);

      RazorpayCheckout.open(options)
        .then(async (paymentData: any) => {
          console.log('[TrialPlan] ✅ Razorpay payment success — starting confirm flow');
          console.log('[TrialPlan] paymentData:', JSON.stringify(paymentData, null, 2));
          setLoading(true);

          // Wrap the entire post-payment flow in its own try/catch so any error
          // does NOT leak into the Razorpay .catch() below.
          try {
            const confirmPayload = {
              firstName,
              lastName,
              phoneNumber: mobile,
              dob,
              gender,
              customerId: customerId!,
              razorpay_subscription_id:
                paymentData.razorpay_subscription_id ?? subscriptionId,
              razorpay_payment_id: paymentData.razorpay_payment_id,
              razorpay_signature: paymentData.razorpay_signature,
              razorpay_order_id: paymentData.razorpay_order_id,
              lab_user_id: storedLabUserId ?? lab_user_id,
            };
            console.log('[TrialPlan] confirmAutopay5 payload:', JSON.stringify(confirmPayload, null, 2));

            const confirmRes = await confirmAutopay5(confirmPayload);
            console.log('[TrialPlan] RAW confirmRes (full):', JSON.stringify(confirmRes, null, 2));

            // Try multiple response shapes — backend may nest differently.
            const token =
              confirmRes?.token ??
              (confirmRes as any)?.data?.token ??
              (confirmRes as any)?.data?.response?.token;
            const refreshToken =
              confirmRes?.refreshToken ??
              (confirmRes as any)?.data?.refreshToken ??
              (confirmRes as any)?.data?.response?.refreshToken;
            const userID =
              confirmRes?.user?.user_id ??
              (confirmRes as any)?.data?.user?.user_id ??
              (confirmRes as any)?.data?.response?.user?.user_id;

            console.log('========== NEW USER TOKENS (created under Lab User ID) ==========');
            console.log('Lab User ID    :', storedLabUserId ?? lab_user_id);
            console.log('User Token     :', token ?? 'MISSING');
            console.log('Refresh Token  :', refreshToken ?? 'MISSING');
            console.log('User ID        :', userID ?? 'MISSING');
            console.log('==================================================================');

            if (!token || !userID) {
              console.warn('[TrialPlan] ❌ token or userID missing after confirmAutopay5 — check RAW confirmRes above');
              Alert.alert('Error', 'Registration confirmed but session data missing. Please try again.');
              return;
            }

            // Save patient tokens to patient-only keys — do NOT call saveAuthData here.
            // saveAuthData would overwrite the lab worker's AUTH_TOKEN/REFRESH_TOKEN.
            await saveRegisteredPatientAuthData(token, String(userID), refreshToken);
            console.log('[TrialPlan] ✅ Patient auth saved to patient-only keys (lab worker session preserved)');
            console.log('[TrialPlan] ✅ Calling navigation.reset → [Home, PreventiveHealth]');

            navigation.reset({
              index: 1,
              routes: [{ name: 'Home' }, { name: 'PreventiveHealth' }],
            });
          } catch (confirmErr: any) {
            console.error('[TrialPlan] ❌ Error inside post-payment flow:', confirmErr?.message, confirmErr);
            Alert.alert('Error', confirmErr?.message || 'Something went wrong after payment. Please contact support.');
          } finally {
            setLoading(false);
          }
        })
        .catch((razorpayError: any) => {
          // This catch is ONLY for Razorpay-level errors (e.g. user dismissed, network).
          console.log('[TrialPlan] Razorpay catch — code:', razorpayError?.code, '| description:', razorpayError?.description);
          if (razorpayError?.code !== 0) {
            Alert.alert('Payment Failed', razorpayError?.description ?? 'Payment could not be completed.');
          }
          setLoading(false);
        });
    } catch (err: any) {
      console.error('[TrialPlan] Caught error:', err?.message, err);
      Alert.alert('Error', err?.message || 'Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    if (!selectedPlan) {
      Alert.alert('Select Plan', 'Please choose a plan to continue.');
      return;
    }
    if (selectedPlan === 'yearly') {
      handleYearlyPlan();
    } else {
      handleTrialPlan();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            showBack
            title=""
            onBackPress={() => navigation.goBack()}
          />
        </SafeAreaView>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bottomCard}>
          <Text style={styles.title}>Choose a Plan</Text>
          <Text style={styles.subtitle}>
            Select the plan that works best for the user.
          </Text>

          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'yearly' && styles.planCardSelected,
            ]}
            onPress={() => setSelectedPlan('yearly')}
            activeOpacity={0.85}
          >
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>Yearly Plan</Text>
                <Text style={styles.planDesc}>Full access for 12 months</Text>
              </View>
              <View style={styles.priceBlock}>
                <Text style={styles.planPrice}>₹199</Text>
                <Text style={styles.planPeriod}>/year</Text>
              </View>
            </View>
            <View style={styles.planFeatures}>
              <Text style={styles.planFeatureItem}>✓ Unlimited registrations</Text>
              <Text style={styles.planFeatureItem}>✓ Premium support</Text>
              <Text style={styles.planFeatureItem}>✓ Full dashboard access</Text>
            </View>
            {selectedPlan === 'yearly' && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>Selected</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'trial' && styles.planCardSelected,
              styles.trialCard,
            ]}
            onPress={() => setSelectedPlan('trial')}
            activeOpacity={0.85}
          >
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>Trial Plan</Text>
                <Text style={styles.planDesc}>Auto-renewing trial subscription</Text>
              </View>
              <View style={styles.priceBlock}>
                <Text style={styles.planPrice}>₹5</Text>
                <Text style={styles.planPeriod}>/month</Text>
              </View>
            </View>
            <View style={styles.planFeatures}>
              <Text style={styles.planFeatureItem}>✓ Auto-pay enabled</Text>
              <Text style={styles.planFeatureItem}>✓ Cancel anytime</Text>
              <Text style={styles.planFeatureItem}>✓ Basic access</Text>
            </View>
            {selectedPlan === 'trial' && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>Selected</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              (!selectedPlan || loading) && styles.buttonDisabled,
            ]}
            onPress={handleProceed}
            disabled={!selectedPlan || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {selectedPlan === 'yearly'
                  ? 'Pay ₹199 & Register'
                  : selectedPlan === 'trial'
                    ? 'Pay ₹5 & Register'
                    : 'Select a Plan'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default RegisterPlans;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED',
  },
  headerShell: {
    backgroundColor: '#1C39BB',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: '#1C39BB',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bottomCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    color: '#666',
    fontSize: 14,
  },
  planCard: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    backgroundColor: '#fafafa',
    position: 'relative',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: '#2F3DBD',
    backgroundColor: '#EEF0FB',
  },
  trialCard: {
    marginBottom: 8,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  planDesc: {
    fontSize: 13,
    color: '#666',
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2F3DBD',
  },
  planPeriod: {
    fontSize: 12,
    color: '#888',
  },
  planFeatures: {
    gap: 4,
  },
  planFeatureItem: {
    fontSize: 13,
    color: '#555',
  },
  selectedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#2F3DBD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#2F3DBD',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
