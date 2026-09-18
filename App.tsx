import { StatusBar, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3e9" />
      <View
        accessibilityRole="header"
        accessible
        accessibilityLabel="n to the power of m"
      >
        <Text style={styles.title}>n^m</Text>
      </View>
      <Text style={styles.subtitle} accessibilityRole="text">
        An expanding-grid puzzle is taking shape.
      </Text>
      <Text style={styles.status} accessibilityRole="text">
        The application shell is ready.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f7f3e9',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#172121',
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -3,
  },
  subtitle: {
    color: '#344747',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    maxWidth: 320,
    textAlign: 'center',
  },
  status: {
    color: '#526565',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
});
