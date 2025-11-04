// app/_layout.js
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider } from '../lib/auth-context';

SplashScreen.preventAutoHideAsync(); // 폰트 로드 전 스플래시 유지

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PretendardBold: require('../assets/fonts/Bold.ttf'),
    PretendardMedium: require('../assets/fonts/Medium.ttf'),
    PretendardRegular: require('../assets/fonts/Regular.ttf'),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false, // 기본 헤더 숨김
          // headerTitleStyle: { fontFamily: 'PretendardBold' },
        }}
      />
    </AuthProvider>
  );
}