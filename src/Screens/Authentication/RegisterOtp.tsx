import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { verifySmartpingOtp } from '../../Services/authService';

const OTP_LENGTH = 6;

const RegisterOtp = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();

    const { mobile } = route.params;

    const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);

    const handleChange = (text: string, index: number) => {
        if (/^[0-9]$/.test(text)) {
            const newOtp = [...otp];
            newOtp[index] = text;
            setOtp(newOtp);

            console.log(`[OTP INPUT] index: ${index}, value: ${text}`);
        }
    };

    const handleVerify = async () => {
        const otpValue = otp.join('');

        console.log('-----------------------------');
        console.log('[VERIFY OTP START]');
        console.log('Mobile:', mobile);
        console.log('OTP Entered:', otpValue);

        if (otpValue.length !== OTP_LENGTH) {
            Alert.alert('Invalid OTP', 'Please enter complete OTP');
            return;
        }

        setLoading(true);

        try {
            console.log('[API CALL] /auth/loginWithSmartpingOtp');

            const res = await verifySmartpingOtp({
                mobile,
                otp: otpValue,
            });
                
            console.log('[API SUCCESS]');
            console.log('Response:', res);

            navigation.navigate('UserDetails');

        } catch (error: any) {
            console.log('[API ERROR]');
            console.log('Error Message:', error?.message);
            console.log('Full Error:', error);

            Alert.alert('Error', error?.message || 'OTP verification failed');
        } finally {
            setLoading(false);
            console.log('[VERIFY OTP END]');
            console.log('-----------------------------');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Back */}
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>

                {/* Logo */}
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>Setu</Text>
                </View>

                {/* Bottom Card */}
                <View style={styles.card}>
                    <Text style={styles.title}>Enter OTP</Text>
                    <Text style={styles.subtitle}>
                        Enter the code we just sent to your phone.
                    </Text>

                    {/* OTP Boxes */}
                    <View style={styles.otpRow}>
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                style={styles.otpInput}
                                keyboardType="number-pad"
                                maxLength={1}
                                value={digit}
                                onChangeText={(text) => handleChange(text, index)}
                            />
                        ))}
                    </View>

                    {/* Resend */}
                    <Text style={styles.resendText}>
                        Didn’t receive the code?{' '}
                        <Text style={styles.resendLink}>Resend OTP</Text>
                    </Text>

                    {/* Button */}
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleVerify}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>
                            {loading ? 'Verifying...' : 'Verify & Continue'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default RegisterOtp;


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EDEDED',
    },
    backBtn: {
        padding: 16,
    },
    backArrow: {
        fontSize: 22,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    logoText: {
        fontSize: 42,
        fontWeight: '700',
        color: '#2F3DBD',
    },
    card: {
        marginTop: 'auto',
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 20,
        color: '#666',
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 20,
    },
    otpInput: {
        width: 45,
        height: 50,
        borderRadius: 10,
        backgroundColor: '#F2F2F2',
        textAlign: 'center',
        fontSize: 18,
    },
    resendText: {
        textAlign: 'center',
        color: '#555',
    },
    resendLink: {
        color: '#2F3DBD',
        fontWeight: '600',
    },
    button: {
        marginTop: 30,
        backgroundColor: '#2F3DBD',
        padding: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
});