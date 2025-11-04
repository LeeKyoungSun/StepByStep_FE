// app.config.js
import 'dotenv/config';

export default {
  expo: {
    name: 'SCSC-App',
    slug: 'SCSC-App',
    sdkVersion: '54.0.0',
    newArchEnabled: true,
    plugins: [
      'expo-router',
      ['expo-splash-screen', {
        image: './image/img/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: { backgroundColor: '#000000' }
      }],
      'expo-font',
    ],
    ios: { bundleIdentifier: 'com.anonymous.SCSCApp', supportsTablet: true },
    android: {
      package: 'com.anonymous.SCSCApp',
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './image/img/android-icon-foreground.png',
        backgroundImage: './image/img/android-icon-background.png',
        monochromeImage: './image/img/android-icon-monochrome.png',
      },
    },
    web: { output: 'static', favicon: './image/img/favicon.png' },
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: {
      EXPO_PUBLIC_API: process.env.EXPO_PUBLIC_API ?? 'https://api.seongkeum.app',
      router: {},
    },
  },
};