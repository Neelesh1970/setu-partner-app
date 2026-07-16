import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import PreventiveHealthHeader from './PreventiveHealthHeader';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectLocation'>;

/** Stub screen — location flow implemented in a later phase. */
export default function SelectLocation({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.headerSafe} edges={['top', 'left', 'right']}>
        <PreventiveHealthHeader
          title="Select Location"
          onBackPress={() => navigation.goBack()}
        />
      </SafeAreaView>
      <SafeAreaView style={styles.bodySafe}>
        <Text style={styles.placeholder}>Select Location — coming soon</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  headerSafe: {
    backgroundColor: '#1C39BB',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  bodySafe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  placeholder: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
});
