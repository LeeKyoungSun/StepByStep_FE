// app/post/[id].js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchJSON } from '../../lib/apiClient';
import { useAuth } from '../../lib/auth-context';

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

// 서버 → 앱 포맷
const normalizePost = (p) => ({
  id: p.id ?? p.postId,
  nickname: p.nickname,
  createdAt: p.createdAt,
  content: p.content,
  commentsNum: p.commentsNum ?? 0,
  likesNum: p.likesNum ?? 0,
  authorId: p.authorId ?? p.userId, // 상세 응답에 authorId 없을 수 있음(닉네임 fallback)
});
const normalizeComment = (c) => ({
  id: c.id ?? c.commentId,
  nickname: c.nickname,
  content: c.content ?? c.comments, // 명세 상 comments 이름도 허용
  createdAt: c.createdAt,
  authorId: c.authorId ?? c.userId,
  isMine: (typeof c.isMine === 'boolean' ? c.isMine : undefined),
});

function isMineByIdsOrNick({ authorId, nickname }, meId, meNick) {
  if (authorId && meId && String(authorId) === String(meId)) return true;
  const a = (nickname || '').trim().toLowerCase();
  const b = (meNick || '').trim().toLowerCase();
  if (a && b && a === b) return true;
  return false;
}

export default function PostDetailScreen() {
  // 토큰 로그
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        console.log('[AUTH] accessToken?', token);
      } catch {}
    })();
  }, []);

  const { user } = (useAuth?.() || {});
  const [meIdLocal, setMeIdLocal] = useState(null);
  const [meNickLocal, setMeNickLocal] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const uid = await AsyncStorage.getItem('x_user_id');
        const nick = await AsyncStorage.getItem('user_nickname');
        if (uid) setMeIdLocal(uid);
        if (nick) setMeNickLocal(nick);
      } catch {}
    })();
  }, []);
  useEffect(() => {
  (async () => {
    try {
      const t = await AsyncStorage.getItem('accessToken');
      if (t) {
        const payload = decodeJwtPayload(t);
        if (payload?.sub && !meIdLocal) setMeIdLocal(String(payload.sub));
        if (payload?.nickname && !meNickLocal) {
          setMeNickLocal(String(payload.nickname));
          await AsyncStorage.setItem('user_nickname', String(payload.nickname));
        }
      }
    } catch {}
  })();
}, []);

// 디버깅 로그 추가 (선택)
useEffect(() => {
  console.log('[WHOAMI]', { meId, meNickname, postNick: post?.nickname, postAuthor: post?.authorId });
}, [meId, meNickname, post]);

  const meId = (user?.userId ?? user?.id ?? meIdLocal) ?? null;
  const meNickname = (user?.nickname ?? meNickLocal) ?? null;
  if (typeof console !== 'undefined') console.reportErrorsAsExceptions = true;

  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [myComment, setMyComment] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editText, setEditText] = useState('');

  // 게시글 수정 모달
  const [postEditOpen, setPostEditOpen] = useState(false);
  const [postEditText, setPostEditText] = useState('');

  const listRef = useRef(null);
  const scrollToBottom = () => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

  const orderedComments = useMemo(() => {
    const arr = Array.isArray(comments) ? [...comments] : [];
    return arr.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  }, [comments]);

  // 상세 로드
  const load = async () => {
    try {
      setLoading(true);
      console.log('[POST] fetch start', id);
      const data = await fetchJSON(`/api/board/posts/${id}`);
      console.log('[POST] raw payload =', data);

      if (!data || typeof data !== 'object') {
        throw new Error('서버에서 유효한 게시글 데이터를 받지 못했습니다.');
      }

      const p = normalizePost(data);
      const cmtsRaw = Array.isArray(data?.data) ? data.data : [];
      const cmts = cmtsRaw.map(normalizeComment);

      console.log('[POST] normalized', { p, cmtsLen: cmts.length });

      setPost(p);
      setComments(cmts);
    } catch (e) {
      console.error('[POST] load error:', e);
      Alert.alert('불러오기 실패', e?.message || '게시글을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 0);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  // 댓글 작성
  const onCreate = async () => {
    const content = myComment.trim();
    if (!content) return;

    try {
      const created = await fetchJSON(`/api/board/posts/${id}/comments`, {
        method: 'POST',
        body: { content },
      });
      const newCmt = { ...normalizeComment(created), isMine: true };
      setComments((prev) => [...prev, newCmt]);
      setMyComment('');
      setTimeout(scrollToBottom, 0);
      await AsyncStorage.setItem('last_commented_post', String(id));
    } catch (e) {
      if (e.status === 401) Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      else Alert.alert('작성 실패', e.message);
    }
  };

  // 댓글 수정
  const openEdit = (c) => { setEditTarget(c); setEditText(c.content || ''); setEditOpen(true); };
  const onEditSubmit = async () => {
    if (!editTarget) return;
    const content = editText.trim();
    if (!content) return;
    try {
      const updated = await fetchJSON(`/api/comments/${editTarget.id}`, {
        method: 'PATCH',
        body: { content },
      });
      const newItem = normalizeComment(updated);
      setComments((prev) => prev.map((c) => (c.id === editTarget.id ? newItem : c)));
      setEditOpen(false);
      setTimeout(scrollToBottom, 0);
    } catch (e) {
      Alert.alert('수정 실패', e.message);
    }
  };

  // 댓글 삭제
  const onDelete = (c) => {
    Alert.alert('삭제', '댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await fetchJSON(`/api/comments/${c.id}`, { method: 'DELETE' });
            setComments((prev) => prev.filter((x) => x.id !== c.id));
          } catch (e) {
            Alert.alert('삭제 실패', e.message);
          }
        },
      },
    ]);
  };

  // 게시글 수정/삭제(상세)
  const isMinePost = post && isMineByIdsOrNick(post, meId, meNickname);

  const onPostEditOpen = () => {
    setPostEditText(post?.content || '');
    setPostEditOpen(true);
  };
  const onPostEditSave = async () => {
    const body = postEditText.trim();
    if (!body) return Alert.alert('내용을 입력해주세요');
    try {
      const updated = await fetchJSON(`/api/board/posts/${post.id}`, {
        method: 'PATCH',
        body: { content: body },
      });
      const np = normalizePost(updated);
      setPost(np);
      setPostEditOpen(false);
    } catch (e) {
      Alert.alert('수정 실패', e.message);
    }
  };

  const onPostDelete = () => {
    Alert.alert('삭제', '게시글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await fetchJSON(`/api/board/posts/${post.id}`, { method: 'DELETE' });
            router.back();
          } catch (e) {
            Alert.alert('삭제 실패', e.message || '삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const Header = (
    <View style={S.header}>
      <TouchableOpacity onPress={() => router.back()}><Text style={S.headerIcon}>‹</Text></TouchableOpacity>
      <Text style={S.headerTitle}>게시글 상세</Text>
      <TouchableOpacity onPress={load}><Text style={S.headerIcon}>↻</Text></TouchableOpacity>
    </View>
  );

  const PostCard = post && (
    <View style={S.postCardBig}>
      <View style={S.postHead}>
        <Text style={S.nickBig}>{post.nickname || '익명'}</Text>
        <Text style={S.dateBig}>{formatKST(post.createdAt)}</Text>
      </View>

      <Text style={S.bodyBig}>{post.content}</Text>

      <View style={[S.metaRow, { alignItems: 'center' }]}>
        <Text style={S.meta}>❤️ {post.likesNum || 0}</Text>
        <Text style={S.meta}>·</Text>
        <Text style={S.meta}>💬 {post.commentsNum ?? orderedComments.length}</Text>
        <View style={{ flex: 1 }} />
        {isMinePost && (
          <>
            <Pressable style={S.pill} onPress={onPostEditOpen}><Text style={S.pillText}>수정</Text></Pressable>
            <Pressable style={[S.pill, S.danger]} onPress={onPostDelete}><Text style={[S.pillText, { color:'#b91c1c' }]}>삭제</Text></Pressable>
          </>
        )}
      </View>
    </View>
  );

  const renderComment = ({ item }) => {
    const isMine = isMineByIdsOrNick(item, meId, meNickname);
    return (
      <View style={S.cmtCard}>
        <View style={S.cmtHead}>
          <Text style={S.cmtNick}>{item.nickname || '익명'}</Text>
          <Text style={S.cmtDate}>{formatKST(item.createdAt)}</Text>
        </View>
        <Text style={S.cmtBody}>{item.content}</Text>
        <View style={S.cmtActions}>
          {isMine && (
            <>
              <Pressable style={S.pill} onPress={() => openEdit(item)}><Text style={S.pillText}>수정</Text></Pressable>
              <Pressable style={[S.pill, S.danger]} onPress={() => onDelete(item)}><Text style={[S.pillText, { color:'#b91c1c' }]}>삭제</Text></Pressable>
            </>
          )}
        </View>
      </View>
    );
  };

  const [showDown, setShowDown] = useState(false);
  const onScroll = (e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const dist = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setShowDown(dist > 120);
  };

  return (
    <SafeAreaView style={S.safe}>
      {Header}

      {loading && !post ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text>불러오는 중…</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={orderedComments}
          keyExtractor={(x) => String(x.id)}
          renderItem={renderComment}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListHeaderComponent={
            <>
              {PostCard}
              <View style={S.sectionRow}>
                <Text style={S.sectionTitle}>댓글</Text>
                <View style={S.sectionLine} />
              </View>
            </>
          }
          ListEmptyComponent={!loading && (<Text style={S.empty}>첫 댓글을 남겨 보세요!</Text>)}
          refreshing={loading}
          onRefresh={load}
          onContentSizeChange={() => requestAnimationFrame(scrollToBottom)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        />
      )}

      {showDown && (
        <TouchableOpacity style={S.fab} onPress={scrollToBottom} activeOpacity={0.9}>
          <Text style={S.fabIcon}>↓</Text>
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding' })}
        keyboardVerticalOffset={insets.bottom ? 0 : 20}
        style={[S.inputBarWrap, { paddingBottom: insets.bottom || 8 }]}
      >
        <View style={S.inputRow}>
          <TextInput
            value={myComment}
            onChangeText={setMyComment}
            placeholder="댓글을 입력하세요"
            placeholderTextColor="#9ca3af"
            style={[S.input, { flex: 1 }]}
            returnKeyType="send"
            onSubmitEditing={onCreate}
          />
          <TouchableOpacity style={S.sendBtn} onPress={onCreate}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>등록</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 댓글 수정 모달 */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={S.modalBg}>
          <View style={S.modal}>
            <Text style={S.modalTitle}>댓글 수정</Text>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              placeholder="수정할 내용"
              placeholderTextColor="#9ca3af"
              style={S.editInput}
              multiline
            />
            <View style={S.modalRow}>
              <TouchableOpacity style={[S.modalBtn, S.modalCancel]} onPress={() => setEditOpen(false)}>
                <Text style={S.modalBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.modalBtn, S.modalOK]} onPress={onEditSubmit}>
                <Text style={[S.modalBtnText, { color: '#fff' }]}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 게시글 수정 모달 */}
      <Modal visible={postEditOpen} transparent animationType="fade" onRequestClose={() => setPostEditOpen(false)}>
        <View style={S.modalBg}>
          <View style={S.modal}>
            <Text style={S.modalTitle}>게시글 수정</Text>
            <TextInput
              value={postEditText}
              onChangeText={setPostEditText}
              placeholder="수정할 내용"
              placeholderTextColor="#9ca3af"
              style={S.editInput}
              multiline
            />
            <View style={S.modalRow}>
              <TouchableOpacity style={[S.modalBtn, S.modalCancel]} onPress={() => setPostEditOpen(false)}>
                <Text style={S.modalBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.modalBtn, S.modalOK]} onPress={onPostEditSave}>
                <Text style={[S.modalBtnText, { color: '#fff' }]}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    height: 56,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: CARD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: TEXT_MAIN, fontSize: 17, fontWeight: '700' },
  headerIcon: { color: TEXT_SUB, fontSize: 20 },

  postCardBig: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  nickBig: { fontWeight: '800', color: '#0f172a', fontSize: 16 },
  dateBig: { marginLeft: 10, color: '#64748b', fontSize: 12 },
  bodyBig: { color: '#0f172a', fontSize: 16, lineHeight: 24, marginTop: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 12 },
  sectionTitle: { fontWeight: '800', color: '#0f172a', marginRight: 10 },
  sectionLine: { height: 1, backgroundColor: '#e5e7eb', flex: 1 },

  metaRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  meta: { color: '#6b7280', fontSize: 12 },

  cmtCard: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 14, padding: 12, marginBottom: 10,
  },
  cmtHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cmtNick: { fontWeight: '700', color: '#111827' },
  cmtDate: { marginLeft: 8, color: '#6b7280', fontSize: 12 },
  cmtBody: { color: '#111827', lineHeight: 20, marginTop: 2 },

  cmtActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pill: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  pillText: { fontWeight: '700', color: '#111827' },
  danger: { borderColor: '#fecaca', backgroundColor: '#fff1f2' },

  empty: { textAlign: 'center', color: '#9ca3af', paddingTop: 40 },

  inputBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: CARD, borderTopWidth: 1, borderTopColor: BORDER },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  input: { height: 40, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, backgroundColor: '#fff', color: '#111827' },
  sendBtn: { height: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },

  fab: {
    position: 'absolute', right: 14, bottom: 100, width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  fabIcon: { color: '#fff', fontSize: 20, fontWeight: '900' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: TEXT_MAIN },
  editInput: { minHeight: 100, marginTop: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, color: TEXT_MAIN },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  modalCancel: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  modalOK: { backgroundColor: '#111827' },
  modalBtnText: { fontWeight: '700', color: TEXT_MAIN },
});