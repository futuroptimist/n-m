import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          n^m
        </Text>
        <Text style={styles.subtitle}>An expanding-grid puzzle</Text>
        <Text style={styles.message}>
          The application shell is ready. Gameplay is coming next.
        </Text>
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#f4efe6',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    maxWidth: 420,
    paddingHorizontal: 32,
    paddingVertical: 48,
    width: '100%',
  },
  title: {
    color: '#2d2926',
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
  },
  subtitle: {
    color: '#5c534d',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  message: {
    color: '#5c534d',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 24,
    textAlign: 'center',
  },
});
