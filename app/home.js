// app/home.js
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function HomeScreen() {
  // 더미 데이터 (UI 확인용)
  const [me] = useState({
    nickname: '이리온',
    points_total: 345,
    currentTitle: '성지식 탐험가 Lv.2',
    badges: [
      { id: 'fairness', name: '성평등 지킴이', emoji: '⚖️' },
      { id: 'health', name: '건강 수호자', emoji: '🛡️' },
    ],
    profileImage: undefined,
  });

  return (
    <View style={{ flex: 1 }}>
      {/* 배경 그라데이션 */}
      <LinearGradient
        colors={['#AF46CD', '#E2A9F1', '#fafafaff']}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        {/* 헤더 카드 (버튼 포함) */}
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            {/* 카드 내부 우측 상단 버튼 */}
            <TouchableOpacity
              onPress={() => router.push('/profile')}
              style={styles.profileBtnInside}
              activeOpacity={0.85}
            >
              <Text style={styles.profileSmallText}>개인정보 수정</Text>
            </TouchableOpacity>

            {/* 프로필 요약 */}
            <View style={styles.headerTop}>
              <View style={styles.avatarWrap}>
                {me?.profileImage ? (
                  <Image source={{ uri: me.profileImage }} style={styles.avatar} />
                ) : (
                  <Image source={require('../image/img/User.png')} style={styles.avatar} />
                )}
              </View>

              <View style={{ flex: 1, paddingRight: 92 }}>
                <Text style={styles.nickname} numberOfLines={1}>{me.nickname}</Text>
                <Text style={styles.title} numberOfLines={1}>{me.currentTitle}</Text>

                {/* 포인트 버튼: 배지 상점으로 이동 */}
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/badgeShop', params: { points: String(me.points_total) } })}
                  style={styles.pointsBtn}
                  activeOpacity={0.85}
                  accessibilityLabel="보유 포인트, 배지 상점으로 이동"
                >
                  <Text style={styles.pointsCoin}>●</Text>
                  <Text style={styles.pointsText}>{me.points_total.toLocaleString()} P</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 배지 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              style={{ marginTop: 6 }}
            >
              {me.badges?.length ? (
                me.badges.map((b) => (
                  <View key={b.id} style={styles.badgeChip}>
                    <Text style={styles.badgeText}>{b.emoji} {b.name}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.badgeEmpty}>획득한 배지가 아직 없어요</Text>
              )}
            </ScrollView>
          </View>
        </View>

        {/* 중앙 콘텐츠 */}
        <View style={styles.container}>
          <Image
            source={require('../image/img/scsc1.png')}
            style={{ width: 300, height: 300, marginBottom: -80 }}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>안녕 나는 토리야! 만나서 반가워</Text>
          <Text style={styles.titleMain}>성큼성큼</Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, styles.primary]}
              onPress={() => router.push('/chat')}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: '#ffffff' }]}>챗봇과 상담하기</Text>
              <Text style={styles.btnSub}>RAG 기반 Q&A</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.secondary]}
              onPress={() => router.push('/scenarioSelect')}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>시나리오</Text>
              <Text style={styles.btnSub}>상황형 퀴즈로 학습</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.secondary]}
              onPress={() => router.push('/board')}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>게시판</Text>
              <Text style={styles.btnSub}>익명으로 소통하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerInfo: {
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileBtnInside: {
    position: 'absolute',
    right: 10,
    top: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileSmallText: { fontSize: 12, color: '#374151', fontFamily: 'PretendardMedium' },

  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#eef2ff',
  },
  avatar: { width: 40, height: 40, resizeMode: 'cover' },

  nickname: { fontFamily: 'PretendardBold', fontSize: 16, color: '#111827', marginTop: 2 },
  title: { fontFamily: 'PretendardMedium', fontSize: 12, color: '#4b5563', marginTop: 2 },

  /* 기존 pointsPill → 버튼 스타일로 변경 */
  pointsBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#111827',
    gap: 6,
  },
  pointsCoin: { fontSize: 10, color: '#FFD54A' },
  pointsText: { fontFamily: 'PretendardBold', fontSize: 13, color: '#ffffff' },

  badgeChip: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: 'PretendardMedium', fontSize: 11, color: '#374151' },
  badgeEmpty: { fontFamily: 'PretendardMedium', fontSize: 11, color: '#9ca3af' },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  titleMain: { fontSize: 36, fontWeight: '800', letterSpacing: 1, fontFamily: 'PretendardBold' },
  subtitle: { fontSize: 14, color: '#374151', fontFamily: 'PretendardMedium' },

  buttons: { marginTop: 24, width: '100%', gap: 14 },
  btn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#111827' },
  secondary: { backgroundColor: '#e5e7eb' },
  btnText: { fontSize: 18, color: '#111827', fontFamily: 'PretendardBold' },
  btnSub: { marginTop: 4, fontSize: 12, color: '#6b7280', fontFamily: 'PretendardMedium' },
});