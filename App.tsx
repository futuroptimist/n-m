import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text
          accessibilityLabel="n to the power of m"
          accessibilityRole="header"
          style={styles.title}
        >
          n^m
        </Text>
        <Text style={styles.subtitle}>The expanding-grid puzzle</Text>
        <Text style={styles.message}>App shell ready</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#f6f2e9',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    maxWidth: 420,
    paddingHorizontal: 36,
    paddingVertical: 48,
    width: '100%',
  },
  title: {
    color: '#27231f',
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 80,
  },
  subtitle: {
    color: '#514b43',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  message: {
    color: '#6b645b',
    fontSize: 16,
    marginTop: 24,
  },
});
