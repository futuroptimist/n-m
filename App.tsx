import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          n^m
        </Text>
        <Text style={styles.message}>
          The expanding-grid puzzle is on its way.
        </Text>
        <Text style={styles.detail}>
          This development build confirms that the app shell is ready.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f2e8',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: '#27231d',
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: -3,
    marginBottom: 24,
  },
  message: {
    color: '#27231d',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
    textAlign: 'center',
  },
  detail: {
    color: '#625c52',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 360,
    textAlign: 'center',
  },
});
