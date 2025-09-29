// app/splash.js
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

export default function SplashScreen() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/login'), 5000); // 원하는 시간
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../image/img/splash.png')} 
        style={styles.full}
        resizeMode="cover" // 화면 가득
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EAD1FF' },
  full: { width: '100%', height: '100%' },
});