import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// 더미 배지 24종
const BADGES = [
  { id: 'ally',        name: '안전한 대화가',   emoji: '👩‍🔬', cost: 90 },
  { id: 'listener',    name: '경청 챔피언',     emoji: '👂',  cost: 110 },
  { id: 'communicator',name: '의사소통 마스터', emoji: '💬',  cost: 140 },
  { id: 'empathy',     name: '공감 전문가',     emoji: '🤝',  cost: 150 },
  { id: 'respect',     name: '존중 수호자',     emoji: '🫡',  cost: 120 },

  { id: 'guardian',    name: '건강 수호자',     emoji: '🛡️', cost: 150 },
  { id: 'safety',      name: '안전 지킴이',     emoji: '🧯',  cost: 130 },
  { id: 'wellness',    name: '웰니스 메이커',   emoji: '🧘',  cost: 120 },
  { id: 'help-seeker', name: '도움요청 용기',   emoji: '🆘',  cost: 100 },
  { id: 'myth-buster', name: '괴담 파괴자',     emoji: '🔍',  cost: 140 },

  { id: 'fairness',    name: '성평등 지킴이',   emoji: '⚖️',  cost: 120 },
  { id: 'allyship',    name: '차별 반대 연대',   emoji: '🕊️',  cost: 130 },
  { id: 'consent',     name: '동의 존중러',     emoji: '✅',  cost: 110 },
  { id: 'privacy',     name: '사생활 수호자',   emoji: '🔒',  cost: 130 },

  { id: 'explorer2',   name: '탐험가 Lv.2',     emoji: '🧭',  cost: 120 },
  { id: 'explorer3',   name: '탐험가 Lv.3',     emoji: '🧭',  cost: 200 },
  { id: 'explorer4',   name: '탐험가 Lv.4',     emoji: '🧭',  cost: 260 },
  { id: 'explorer5',   name: '탐험가 Lv.5',     emoji: '🧭',  cost: 320 },

  { id: 'helper',      name: '커뮤니티 도우미', emoji: '🧩',  cost: 100 },
  { id: 'writer',      name: '지식 나눔러',     emoji: '✍️',  cost: 110 },
  { id: 'moderate',    name: '깨끗한 게시판',   emoji: '🧼',  cost: 140 },

  { id: 'streak3',     name: '3일 연속 학습',   emoji: '📅',  cost: 90 },
  { id: 'streak7',     name: '7일 연속 학습',   emoji: '📆',  cost: 150 },
  { id: 'streak30',    name: '30일 꾸준함',     emoji: '🏆',  cost: 300 },
];

export default function BadgeShopScreen() {
  const [myPoints, setMyPoints] = useState(500);
  const [owned, setOwned] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // 포인트 펄스 애니메이션
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const startAnim = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.0,  duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const openConfirm = (item) => {
    setSelected(item);
    setConfirmOpen(true);
  };

  const onConfirmBuy = () => {
    if (!selected) return;
    if (owned[selected.id]) { setConfirmOpen(false); return; }
    if (myPoints < selected.cost) { setConfirmOpen(false); return; }

    setMyPoints((p) => p - selected.cost);
    setOwned((o) => ({ ...o, [selected.id]: true }));
    setConfirmOpen(false);
    startAnim();
  };

  const renderItem = ({ item }) => {
    const has = !!owned[item.id];
    return (
      <TouchableOpacity
        onPress={() => openConfirm(item)}
        activeOpacity={0.9}
        style={[styles.card, has && styles.cardOwned]}
      >
        <Text style={styles.cardEmoji}>{item.emoji}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        {has ? (
          <View style={styles.ownedPill}><Text style={styles.ownedText}>보유중</Text></View>
        ) : (
          <View style={styles.pricePill}>
            <Text style={styles.coinDot}>●</Text>
            <Text style={styles.priceText}>{item.cost} P</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ⬇️ 헤더를 리스트의 헤더로 넣어서 전체 스크롤 가능 + sticky 고정
  const Header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>
      <Animated.View style={[styles.pointsWrap, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.pointsCoin}>●</Text>
        <Text style={styles.pointsText}>{myPoints.toLocaleString()} P</Text>
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={BADGES}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        numColumns={2}
        // 🔸 헤더/푸터 & 스크롤 설정
        ListHeaderComponent={Header}
        stickyHeaderIndices={[0]}   // 헤더 고정 (원하면 이 줄 삭제)
        ListFooterComponent={<View style={{ height: 24 }} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        showsVerticalScrollIndicator={false}
      />

      {/* 구매 모달 */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>배지 구매</Text>
            <Text style={styles.modalBadgeName}>{selected?.emoji} {selected?.name}</Text>
            <View style={[styles.pricePill, { marginTop: 8 }]}>
              <Text style={styles.coinDot}>●</Text>
              <Text style={styles.priceText}>{selected?.cost} P</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setConfirmOpen(false)}>
                <Text style={styles.modalBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBuy]} onPress={onConfirmBuy}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>구매하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },

  // 헤더(리스트 헤더)
  header: {
    backgroundColor: '#fff',        // sticky일 때 비침 방지
    paddingTop: 12, paddingBottom: 12,
    paddingHorizontal: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#f3f4f6',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  backText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  pointsWrap: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, height: 30, borderRadius: 999,
    backgroundColor: '#111827', gap: 6,
  },
  pointsCoin: { fontSize: 10, color: '#FFD54A' },
  pointsText: { fontWeight: '800', color: '#ffffff' },

  // 카드
  card: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOwned: { opacity: 0.6 },
  cardEmoji: { fontSize: 32, marginBottom: 8 },
  cardTitle: { fontWeight: '700', fontSize: 14, color: '#111827', textAlign: 'center' },

  // 가격/보유 pill
  pricePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, height: 26, borderRadius: 999,
    backgroundColor: '#111827', marginTop: 6,
  },
  coinDot: { fontSize: 10, color: '#FFD54A' },
  priceText: { color: '#fff', fontWeight: '700' },
  ownedPill: {
    marginTop: 6, paddingHorizontal: 10, height: 26,
    borderRadius: 999, backgroundColor: '#e5e7eb', justifyContent: 'center',
  },
  ownedText: { color: '#374151', fontWeight: '700' },

  // 모달
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 360,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalBadgeName: { marginTop: 6, fontSize: 16, color: '#374151' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  modalCancel: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  modalBuy: { backgroundColor: '#111827' },
  modalBtnText: { fontWeight: '700', color: '#111827' },
});