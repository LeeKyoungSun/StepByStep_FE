// app/board.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform,
  Pressable, RefreshControl, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchJSON } from '../lib/apiClient';
import { useAuth } from '../lib/auth-context';
import { decodeJwtPayload } from '../lib/jwt';

const BG = '#F7F7FA';
const CARD = '#FFFFFF';
const BORDER = '#E6E7EC';
const TEXT_MAIN = '#0E0F12';
const TEXT_SUB = '#5E6472';

const formatKST = (iso) => {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return iso; }
};

// 서버 → 앱 표준화
function normalizePost(p) {
  const id = p.postId ?? p.id;
  return {
    id,
    authorId: p.authorId ?? p.userId ?? p.writerId ?? null,
    nickname: p.nickname,
    createdAt: p.createdAt,
    content: p.content,
    commentsNum: p.commentsNum ?? p.commentCount ?? 0,
    likesNum: p.likesNum ?? p.likes ?? 0,
    liked: typeof p.liked === 'boolean' ? p.liked : false,
    isMine: typeof p.isMine === 'boolean' ? p.isMine : undefined, // 서버가 내려주면 최우선
    _localAuthor: !!p._localAuthor,                               // 즉시 반영용
  };
}

// “내 글” 판정: 서버 isMine > 아이디 > 닉네임 > 로컬 플래그
function isMineBy(item, me) {
  if (!item) return false;
  if (item.isMine !== undefined) return !!item.isMine;
  const meId = me?.userId || me?.id || null;
  if (meId && item.authorId) return String(item.authorId) === String(meId);
  const mNick = (me?.nickname || '').trim().toLowerCase();
  const pNick = (item.nickname || '').trim().toLowerCase();
  if (mNick && pNick) return mNick === pNick;
  if (item._localAuthor) return true;
  return false;
}

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAuth?.();
  const me = {
    userId: auth?.user?.id ?? null,
    nickname: auth?.user?.nickname ?? null,
  };

  // 로컬 캐시로 보조
  const [myNickLocal, setMyNickLocal] = useState('');
  const [myIdLocal, setMyIdLocal] = useState('');
  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem('user_nickname');
      if (v) setMyNickLocal(v);
      const uid = await AsyncStorage.getItem('x_user_id');
      if (uid) setMyIdLocal(uid);
    })();
  }, []);
  const meFallback = {
    userId: me.userId ?? myIdLocal ?? null,
    nickname: me.nickname ?? myNickLocal ?? null,
  };
  useEffect(() => {
  (async () => {
    try {
      const t = await AsyncStorage.getItem('accessToken');
      if (t) {
        const payload = decodeJwtPayload(t);
        if (payload?.sub && !myIdLocal) setMyIdLocal(String(payload.sub));
        if (payload?.nickname && !myNickLocal) {
          setMyNickLocal(String(payload.nickname));
          await AsyncStorage.setItem('user_nickname', String(payload.nickname));
        }
      }
    } catch {}
  })();
}, []);

  // 목록/입력 상태
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [content, setContent] = useState('');

  // 수정 모드 상태
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJSON('/api/board/posts');
      const arr = Array.isArray(data?.content) ? data.content.map(normalizePost) : [];
      setPosts(arr);
    } catch (e) {
      Alert.alert('불러오기 실패', e.message || '게시글을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);
  useFocusEffect(useCallback(() => { loadPosts(); }, [loadPosts]));

  // 글 작성
  const onCreate = async () => {
    const body = content.trim();
    if (!body) return Alert.alert('내용을 입력해주세요');
    try {
      const created = await fetchJSON('/api/board/posts', {
        method: 'POST',
        body: { content: body },
      });

      if (created?.nickname) {
        await AsyncStorage.setItem('user_nickname', String(created.nickname));
        setMyNickLocal(String(created.nickname));
      }

      const newPost = normalizePost({ ...created, _localAuthor: true });
      setPosts((prev) => [newPost, ...prev]);
      setContent('');
      setComposeOpen(false);
    } catch (e) {
      if (e.status === 401) return Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      Alert.alert('작성 실패', e.message);
    }
  };

  // 좋아요 토글
  const onToggleLike = async (post) => {
    const { id, liked } = post;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, liked: !liked, likesNum: (p.likesNum || 0) + (liked ? -1 : 1) } : p
      )
    );
    try {
      const res = await fetchJSON(`/api/board/posts/${id}/like`, {
        method: liked ? 'DELETE' : 'POST',
      });
      if (res && (typeof res.likeNum === 'number' || typeof res.liked === 'boolean')) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  likesNum: typeof res.likeNum === 'number' ? res.likeNum : p.likesNum,
                  liked: typeof res.liked === 'boolean' ? res.liked : p.liked,
                }
              : p
          )
        );
      }
    } catch (e) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, liked, likesNum: (p.likesNum || 0) + (liked ? 1 : -1) } : p
        )
      );
      Alert.alert('좋아요 실패', e.message);
    }
  };

  // 삭제
  const onDelete = (id) => {
    Alert.alert('삭제', '정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const prev = posts;
          setPosts((p) => p.filter((x) => String(x.id ?? x.postId) !== String(id)));
          try {
            await fetchJSON(`/api/board/posts/${id}`, { method: 'DELETE' });
          } catch (e) {
            setPosts(prev); // 롤백
            const msg = e?.message || '서버 오류가 발생했습니다.';
            console.log('[REQ FAIL]', e.status, e.url, e.response);
            Alert.alert('삭제 실패', msg);
          }
        },
      },
    ]);
  };

  // 수정 모달 열기
  const onEditOpen = (item) => {
    setEditId(item.id);
    setEditText(item.content || '');
    setEditOpen(true);
  };

  // 수정 저장
  const onUpdate = async () => {
    const body = editText.trim();
    if (!body) return Alert.alert('내용을 입력해주세요');
    try {
      const updated = await fetchJSON(`/api/board/posts/${editId}`, {
        method: 'PATCH',
        body: { content: body },
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === editId ? { ...p, ...normalizePost(updated) } : p))
      );
      setEditOpen(false);
      setEditId(null);
      setEditText('');
    } catch (e) {
      Alert.alert('수정 실패', e.message);
    }
  };

  // 검색 필터
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = posts.map((p) => ({
      ...p,
      isMineComputed: (p.isMine !== undefined ? !!p.isMine : isMineBy(p, meFallback)),
    }));
    if (!q) return arr;
    return arr.filter(
      (p) => p.content?.toLowerCase().includes(q) || p.nickname?.toLowerCase().includes(q)
    );
  }, [posts, search, meFallback.userId, meFallback.nickname]);

  const renderItem = ({ item }) => {
    const isMine = item.isMineComputed;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() =>
          router.push({ pathname: '/post/[id]', params: { id: String(item.id ?? item.postId) } })
        }
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardNick}>{item.nickname || '익명'}</Text>
          <Text style={styles.cardDate}>{formatKST(item.createdAt)}</Text>
        </View>

        <Text style={styles.cardBody}>{item.content}</Text>

        <View style={styles.cardActions}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>💬 {item.commentsNum || 0}</Text>
          </View>

          <Pressable
            style={styles.pill}
            onPress={(e) => {
              e.stopPropagation();
              onToggleLike(item);
            }}
          >
            <Text style={styles.pillText}>{item.liked ? '❤️' : '🤍'} {item.likesNum || 0}</Text>
          </Pressable>

          <View style={{ flex: 1 }} />

          {isMine && (
            <>
              <Pressable
                style={styles.pill}
                onPress={(e) => {
                  e.stopPropagation();
                  onEditOpen(item);
                }}
              >
                <Text style={styles.pillText}>수정</Text>
              </Pressable>
              <Pressable
                style={[styles.pill, styles.danger]}
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete(item.id ?? item.postId);
                }}
              >
                <Text style={[styles.pillText, { color: '#b91c1c' }]}>삭제</Text>
              </Pressable>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>익명 게시판</Text>
        <TouchableOpacity onPress={loadPosts} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
          <Text style={styles.headerIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* 검색 & 글쓰기 */}
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="검색: 내용/닉네임"
          placeholderTextColor="#9ca3af"
          style={styles.search}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.composeBtn} onPress={() => setComposeOpen(true)}>
          <Text style={styles.composeBtnText}>글쓰기</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id ?? item.postId)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>첫 글을 남겨 보세요!</Text>}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPosts} />}
      />

      {/* 글쓰기 모달 */}
      <Modal visible={composeOpen} animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex:1, backgroundColor:'#fff', paddingTop: insets.top + 8 }}
          behavior={Platform.select({ ios: 'padding' })}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setComposeOpen(false)}><Text style={styles.cancel}>닫기</Text></Pressable>
            <Text style={styles.modalTitle}>새 글 쓰기</Text>
            <View style={{ width: 48 }} />
          </View>

          <View style={styles.modalBody}>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="내용을 입력하세요 (욕설/개인정보 금지)"
              placeholderTextColor="#9ca3af"
              style={styles.textarea}
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />
            <TouchableOpacity style={styles.submit} onPress={onCreate} activeOpacity={0.9}>
              <Text style={styles.submitText}>게시하기</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 수정 모달 */}
      <Modal visible={editOpen} animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex:1, backgroundColor:'#fff', paddingTop: insets.top + 8 }}
          behavior={Platform.select({ ios: 'padding' })}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setEditOpen(false)}><Text style={styles.cancel}>닫기</Text></Pressable>
            <Text style={styles.modalTitle}>글 수정</Text>
            <View style={{ width: 48 }} />
          </View>

          <View style={styles.modalBody}>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              placeholder="내용을 입력하세요"
              placeholderTextColor="#9ca3af"
              style={styles.textarea}
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />
            <TouchableOpacity style={styles.submit} onPress={onUpdate} activeOpacity={0.9}>
              <Text style={styles.submitText}>수정 저장</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    height: 56, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: BORDER,
    backgroundColor: CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { color: TEXT_MAIN, fontSize: 17, fontWeight: '700' },
  headerIcon: { color: TEXT_SUB, fontSize: 22 },

  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: BG },
  search: {
    flex: 1, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 12, backgroundColor: '#f9fafb', color: '#111827',
  },
  composeBtn: {
    height: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
  },
  composeBtnText: { color: '#fff', fontWeight: '700' },

  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: '#fff' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardNick: { fontWeight: '700', color: '#111827' },
  cardDate: { marginLeft: 8, color: '#6b7280', fontSize: 12 },
  cardBody: { color: '#111827', lineHeight: 20, marginTop: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  pill: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  pillText: { fontWeight: '700', color: '#111827' },
  danger: { borderColor: '#fecaca', backgroundColor: '#fff1f2' },
  empty: { textAlign: 'center', color: '#9ca3af', paddingTop: 48 },

  modalHeader: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cancel: { color: '#6b7280', fontWeight: '700' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalBody: { padding: 16, gap: 10 },
  textarea: {
    minHeight: 160, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 12, backgroundColor: '#fff', color: '#111827',
  },
  submit: {
    marginTop: 8, height: 48, borderRadius: 14, backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800' },
});