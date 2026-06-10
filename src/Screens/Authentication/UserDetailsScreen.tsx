import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const UserDetailsScreen = () => {
    const navigation = useNavigation<any>();
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('Feb');
    const [selectedDay, setSelectedDay] = useState('2');
    const [selectedYear, setSelectedYear] = useState('2001');
    const [gender, setGender] = useState<'male' | 'female' | ''>('');

    // Generate days & years
    const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
    const years = Array.from({ length: 100 }, (_, i) => (2025 - i).toString());

    const handleSave = () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter your name');
            return;
        }

        if (!surname.trim()) {
            Alert.alert('Error', 'Please enter your surname');
            return;
        }

        if (!gender) {
            Alert.alert('Error', 'Please select gender');
            return;
        }

        const dob = `${selectedYear}-${months.indexOf(selectedMonth) + 1}-${selectedDay}`;

        // ✅ Navigate here
        navigation.navigate('PremiumPrice');
    };

    const renderPickerRow = (
        data: string[],
        selected: string,
        setSelected: (val: string) => void
    ) => (
        <ScrollView showsVerticalScrollIndicator={false}>
            {data.map(item => (
                <TouchableOpacity
                    key={item}
                    style={[
                        styles.pickerItem,
                        selected === item && styles.selectedItem,
                    ]}
                    onPress={() => setSelected(item)}
                >
                    <Text
                        style={[
                            styles.pickerText,
                            selected === item && styles.selectedText,
                        ]}
                    >
                        {item}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Header */}
                    <Text style={styles.heading}>
                        <Text style={styles.headingBar}>| </Text>
                        Welcome! Let’s get started
                    </Text>

                    <Text style={styles.subText}>
                        We just need a few details to set up your health profile.
                    </Text>

                    {/* Name */}
                    <Text style={styles.label}>What is your name?</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Name"
                        value={name}
                        onChangeText={setName}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Surname"
                        value={surname}
                        onChangeText={setSurname}
                    />

                    {/* DOB */}
                    <Text style={styles.label}>Select your date of birth</Text>

                    <View style={styles.pickerContainer}>
                        {renderPickerRow(months, selectedMonth, setSelectedMonth)}
                        {renderPickerRow(days, selectedDay, setSelectedDay)}
                        {renderPickerRow(years, selectedYear, setSelectedYear)}
                    </View>

                    {/* Gender */}
                    <Text style={styles.label}>Select your gender</Text>

                    <TouchableOpacity
                        style={[
                            styles.genderBox,
                            gender === 'male' && styles.genderSelected,
                        ]}
                        onPress={() => setGender('male')}
                    >
                        <Text style={styles.genderText}>♂ Male</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.genderBox,
                            gender === 'female' && styles.genderSelected,
                        ]}
                        onPress={() => setGender('female')}
                    >
                        <Text style={styles.genderText}>♀ Female</Text>
                    </TouchableOpacity>

                    {/* Button */}
                    <TouchableOpacity style={styles.button} onPress={handleSave}>
                        <Text style={styles.buttonText}>Save</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default UserDetailsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F3F3',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    heading: {
        fontSize: 20,
        fontWeight: '700',
    },
    headingBar: {
        color: '#2F3DBD',
    },
    subText: {
        marginTop: 8,
        marginBottom: 20,
        color: '#555',
    },
    label: {
        marginTop: 20,
        marginBottom: 10,
        fontWeight: '600',
    },
    input: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    pickerContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 10,
        height: 140,
        overflow: 'hidden',
    },
    pickerItem: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    selectedItem: {
        backgroundColor: '#DDE1F5',
    },
    pickerText: {
        fontSize: 16,
    },
    selectedText: {
        fontWeight: '700',
    },
    genderBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    genderSelected: {
        borderColor: '#2F3DBD',
        backgroundColor: '#EEF0FF',
    },
    genderText: {
        fontSize: 16,
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
        fontSize: 16,
    },
});