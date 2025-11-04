// app/badgeShop.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const API = process.env.EXPO_PUBLIC_API;

/** ---------- 공통 fetch 유틸 (JWT 자동 부착 + 래퍼 파싱) ---------- */
async function authHeaders() {
  const at = await AsyncStorage.getItem('accessToken');
  return at ? { Authorization: `Bearer ${at}` } : {};
}
async function fetchJSON(path, { method = 'GET', body, headers } = {}) {
  const url = `${API}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // text / json 모두 안전 파싱
  let json = null;
  try { json = await res.json(); } catch { /* noop */ }

  // 공통 래퍼 대응
  const status = json?.status;
  const data = json?.data ?? json;

  if (!res.ok || status === 'error') {
    const msg = json?.message || data?.message || `요청 실패 (HTTP ${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return data ?? {};
}

export default function BadgeShopScreen() {
  const [catalog, setCatalog] = useState([]);   // [{id,name,emoji,description,price,owned?}]
  const [owned, setOwned] = useState({});       // { [id]: true }
  const [myPoints, setMyPoints] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  // 포인트 펄스 애니메이션
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulse = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  /** ---------- 초기 데이터 로드 ----------
   * GET /api/points/me  -> { points }
   * GET /api/badges     -> [{ id,name,emoji,description,price, owned? }]
   */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [pointsRes, badgesRes] = await Promise.all([
          fetchJSON('/api/points/me').catch(() => ({ points: 0 })),
          fetchJSON('/api/badges').catch(() => []),
        ]);

        const points = Number(pointsRes?.points ?? 0);
        setMyPoints(Number.isFinite(points) ? points : 0);

        const list = Array.isArray(badgesRes) ? badgesRes : [];
        const normalized = list.map((b, i) => ({
          id: b.id ?? b.badgeId ?? String(i),
          name: b.name,
          emoji: b.emoji,
          description: b.description ?? '',
          price: b.price ?? b.cost ?? 0,
          owned: !!b.owned,
        }));
        setCatalog(normalized);

        // 서버가 owned를 내려주면 반영
        const map = {};
        normalized.forEach((b) => { if (b.owned) map[b.id] = true; });
        setOwned(map);
      } catch (e) {
        if (e.status === 401) {
          // 비로그인: 카탈로그만 표시는 됨(구매 시 로그인 유도)
          return;
        }
        Alert.alert('불러오기 실패', e.message || '배지 정보를 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openConfirm = (badge) => {
    setSelected(badge);
    setConfirmOpen(true);
  };

  /** ---------- 구매 ----------
   * POST /api/badges/{badgeId}/purchase
   * 성공 시 data 안에 { points, ownedIds? } 또는 { badgeId } 등을 가정하고 동기화
   */
  const onConfirmBuy = async () => {
    if (!selected) return;
    const badgeId = selected.id;
    const price = selected.price ?? selected.cost ?? 0;

    if (owned[badgeId]) { setConfirmOpen(false); return; }
    if (myPoints < price) {
      setConfirmOpen(false);
      return Alert.alert('포인트 부족', '포인트가 부족해요.');
    }

    // 낙관적 반영
    setConfirmOpen(false);
    const prevPoints = myPoints;
    const prevOwned = { ...owned };
    setMyPoints((p) => p - price);
    setOwned((o) => ({ ...o, [badgeId]: true }));
    pulse();

    try {
      const res = await fetchJSON(`/api/badges/${encodeURIComponent(badgeId)}/purchase`, {
        method: 'POST',
      });

      // 서버값으로 동기화 (있을 때만)
      const nextPoints = Number(res?.points ?? res?.user?.points ?? res?.wallet?.points ?? myPoints);
      if (Number.isFinite(nextPoints)) setMyPoints(nextPoints);

      const ownedList = res?.ownedIds ?? res?.badgesOwned ?? res?.badges;
      if (Array.isArray(ownedList)) {
        const map = {};
        ownedList.forEach((id) => { map[id] = true; });
        setOwned(map);
      }
    } catch (e) {
      // 롤백
      setMyPoints(prevPoints);
      setOwned(prevOwned);

      if (e.status === 401) {
        return Alert.alert('로그인이 필요해요', '로그인 후 배지를 구매할 수 있어요.', [
          { text: '로그인으로 이동', onPress: () => router.push('/login') },
          { text: '닫기' },
        ]);
      }
      Alert.alert('구매 실패', e.message || '배지 구매 중 오류가 발생했어요.');
    }
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
            <Text style={styles.priceText}>{(item.price ?? item.cost ?? 0)} P</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const Header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>
      <Animated.View style={[styles.pointsWrap, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.pointsCoin}>●</Text>
        <Text style={styles.pointsText}>{loading ? '로딩…' : `${myPoints.toLocaleString()} P`}</Text>
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={catalog}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        numColumns={2}
        ListHeaderComponent={Header}
        stickyHeaderIndices={[0]}
        ListFooterComponent={<View style={{ height: 24 }} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        showsVerticalScrollIndicator={false}
      />

      {/* 구매 모달 */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>배지 구매</Text>
            <Text style={styles.modalBadgeName}>{selected?.emoji} {selected?.name}</Text>
            {!!selected?.description && (
              <Text style={{ color: '#6b7280', marginTop: 6 }}>{selected.description}</Text>
            )}
            <View style={[styles.pricePill, { marginTop: 8 }]}>
              <Text style={styles.coinDot}>●</Text>
              <Text style={styles.priceText}>{(selected?.price ?? selected?.cost ?? 0)} P</Text>
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

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },

  header: {
    backgroundColor: '#fff',
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