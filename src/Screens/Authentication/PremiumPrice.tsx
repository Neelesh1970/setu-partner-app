import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PremiumPrice = () => {
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'trial'>('yearly');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Yearly Plan */}
        <TouchableOpacity
          style={[
            styles.card,
            selectedPlan === 'yearly' && styles.selectedCard,
          ]}
          activeOpacity={0.8}
          onPress={() => setSelectedPlan('yearly')}
        >
          <View>
            <Text style={styles.title}>Yearly</Text>
            <Text style={styles.subtitle}>Less than ₹1/day</Text>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹199</Text>
            <Text style={styles.perText}>per year</Text>
          </View>
        </TouchableOpacity>

        {/* Trial Plan */}
        <TouchableOpacity
          style={[
            styles.card,
            selectedPlan === 'trial' && styles.selectedCard,
          ]}
          activeOpacity={0.8}
          onPress={() => setSelectedPlan('trial')}
        >
          <View>
            <Text style={styles.title}>Try 14 days free trial</Text>
            <Text style={styles.subtitle}>Try it risk-free</Text>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹5</Text>
          </View>
        </TouchableOpacity>

        {/* Footer Text */}
        <Text style={styles.footerText}>
          Select one of above and get started
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
};

export default PremiumPrice;

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F2F2F2',
    },
    content: {
      padding: 16,
    },
    card: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  
      borderWidth: 1,
      borderColor: '#ddd',
    },
    selectedCard: {
      borderColor: '#2F3DBD',
      borderWidth: 1.5,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
    },
    subtitle: {
      marginTop: 4,
      fontSize: 13,
      color: '#666',
    },
    priceContainer: {
      alignItems: 'flex-end',
    },
    price: {
      fontSize: 18,
      fontWeight: '700',
      color: '#2F3DBD',
    },
    perText: {
      fontSize: 12,
      color: '#666',
      marginTop: 2,
    },
    footerText: {
      marginTop: 10,
      fontSize: 13,
      color: '#555',
    },
  });