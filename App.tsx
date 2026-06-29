import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

type Excerpt = { id: string; quote: string; bookTitle: string; author: string; coverColor: string; createdAt: number };
type Tab = 'home' | 'books' | 'dashboard' | 'settings';
type FontSize = 'sm' | 'base' | 'lg' | 'xl';
type FontFamily = 'sans' | 'serif' | 'mono';

const C = { bg: '#FAFAF8', panel: '#F3F4F2', ink: '#252725', muted: '#767B78', accent: '#718E9E', danger: '#C55252', line: '#DFE1DE' };
const COLORS = ['#8DA6B5', '#252725', '#D9A05B', '#6D8E7D', '#A88174'];
const INITIAL: Excerpt[] = [
  { id: '1', quote: '「閱讀是一座隨身攜帶的小型避難所。」', bookTitle: '月亮與六便士', author: '威廉·薩默塞特·毛姆', coverColor: '#8DA6B5', createdAt: 1719541200000 },
  { id: '2', quote: '「你必須在內心深處有一片即便在最惡劣的氣候下也能生存的森林。」', bookTitle: '挪威的森林', author: '村上春樹', coverColor: '#252725', createdAt: 1719541100000 },
  { id: '3', quote: '「一個人可以被毀滅，但不能給打敗。」', bookTitle: '老人與海', author: '歐內斯特·海明威', coverColor: '#D9A05B', createdAt: 1719541000000 },
  { id: '4', quote: '「唯有誠實地面對自己，我們才能真正獲得自由。」', bookTitle: '德米安', author: '赫曼·赫塞', coverColor: '#6D8E7D', createdAt: 1719540900000 },
];

const storage = {
  async load<T>(key: string, fallback: T): Promise<T> {
    try { const value = await AsyncStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  },
  save(key: string, value: unknown) { return AsyncStorage.setItem(key, JSON.stringify(value)); },
};

function Button({ title, onPress, tone = 'dark', icon }: { title: string; onPress: () => void; tone?: 'dark' | 'light' | 'danger'; icon?: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.button, s[`button_${tone}`], pressed && s.pressed]}>
    {icon && <Icon name={icon as never} size={16} color={tone === 'dark' ? '#fff' : tone === 'danger' ? C.danger : C.ink} />}
    <Text style={[s.buttonText, tone === 'dark' ? s.white : tone === 'danger' ? s.danger : s.ink]}>{title}</Text>
  </Pressable>;
}

export default function App() {
  const [items, setItems] = useState<Excerpt[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [search, setSearch] = useState('');
  const [book, setBook] = useState<string | null>(null);
  const [editing, setEditing] = useState<Excerpt | null | undefined>();
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [oracle, setOracle] = useState(false);
  const [drawn, setDrawn] = useState<Excerpt | null>(null);
  const [fontSize, setFontSize] = useState<FontSize>('base');
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');

  useEffect(() => { (async () => {
    setItems(await storage.load('linekeep_excerpts', INITIAL));
    setFontSize(await storage.load('linekeep_font_size', 'base'));
    setFontFamily(await storage.load('linekeep_font_family', 'serif'));
    setReady(true);
  })(); }, []);
  const commit = (next: Excerpt[]) => { setItems(next); storage.save('linekeep_excerpts', next); };

  const books = useMemo(() => Object.values(items.reduce<Record<string, { title: string; author: string; color: string; quotes: Excerpt[] }>>((acc, item) => {
    const title = item.bookTitle.trim();
    acc[title] ??= { title, author: item.author, color: item.coverColor, quotes: [] };
    acc[title].quotes.push(item); return acc;
  }, {})), [items]);
  const filtered = useMemo(() => items.filter(item => {
    const q = search.trim().toLowerCase();
    return (!book || item.bookTitle === book) && (!q || `${item.quote} ${item.bookTitle} ${item.author}`.toLowerCase().includes(q));
  }), [items, search, book]);

  const remove = (item: Excerpt) => Alert.alert('刪除書摘', '此操作無法復原。', [
    { text: '取消', style: 'cancel' }, { text: '刪除', style: 'destructive', onPress: () => commit(items.filter(x => x.id !== item.id)) },
  ]);
  const setPreference = <T,>(setter: (v: T) => void, key: string, value: T) => { setter(value); storage.save(key, value); };

  if (!ready) return <SafeAreaView style={s.screen}><Text style={s.loading}>正在整理書頁…</Text></SafeAreaView>;
  return <SafeAreaView style={s.screen}>
    <StatusBar style="dark" />
    <View style={s.header}>
      <Pressable onPress={() => { setTab('home'); setBook(null); setSearch(''); }}>
        <Text style={s.logo}>拾句</Text><Text style={s.wordmark}>LINEKEEP</Text>
      </Pressable>
      <Pressable accessibilityLabel="書言占卜" onPress={() => { setDrawn(null); setOracle(true); }} style={s.iconButton}><Icon name="creation" size={20} color={C.accent} /></Pressable>
    </View>

    {tab !== 'settings' && tab !== 'dashboard' && <View style={s.search}>
      <Icon name="magnify" size={20} color={C.muted} />
      <TextInput value={search} onChangeText={setSearch} placeholder="搜尋書名、作者或句子" placeholderTextColor={C.muted} style={s.searchInput} />
      {!!search && <Pressable onPress={() => setSearch('')}><Icon name="close" size={18} color={C.muted} /></Pressable>}
    </View>}

    <View style={s.content}>
      {tab === 'home' && <Home items={filtered} book={book} fontFamily={fontFamily} fontSize={fontSize} onBack={() => setBook(null)} onEdit={setEditing} onDelete={remove} />}
      {tab === 'books' && <Books books={books} onSelect={title => { setBook(title); setTab('home'); }} />}
      {tab === 'dashboard' && <Dashboard items={items} books={books} />}
      {tab === 'settings' && <Settings fontFamily={fontFamily} fontSize={fontSize}
        setFontFamily={v => setPreference(setFontFamily, 'linekeep_font_family', v)}
        setFontSize={v => setPreference(setFontSize, 'linekeep_font_size', v)}
        onExport={async () => { await Clipboard.setStringAsync(JSON.stringify(items, null, 2)); Alert.alert('備份完成', 'JSON 已複製到剪貼簿。'); }}
        onImport={() => setImporting(true)}
        onRestore={() => Alert.alert('恢復預設', '目前書摘將被覆蓋。', [{ text: '取消' }, { text: '恢復', onPress: () => commit(INITIAL) }])}
        onClear={() => Alert.alert('清空所有書摘', '此操作無法復原。', [{ text: '取消' }, { text: '清空', style: 'destructive', onPress: () => commit([]) }])} />}
    </View>

    {(tab === 'home' || tab === 'books') && <Pressable accessibilityLabel="新增書摘" onPress={() => setEditing(null)} style={({ pressed }) => [s.fab, pressed && s.pressed]}><Icon name="plus" size={30} color="#fff" /></Pressable>}
    <View style={s.nav}>{([
      ['home', 'layers-outline'], ['books', 'book-open-page-variant-outline'], ['dashboard', 'chart-bar'], ['settings', 'cog-outline'],
    ] as [Tab, string][]).map(([key, icon]) => <Pressable key={key} accessibilityRole="tab" onPress={() => { setTab(key); setBook(null); }} style={s.navItem}>
      <Icon name={icon as never} size={25} color={tab === key ? C.accent : C.muted} />
    </Pressable>)}</View>

    <Editor visible={editing !== undefined} item={editing ?? null} onClose={() => setEditing(undefined)} onSave={saved => { commit(editing ? items.map(x => x.id === saved.id ? saved : x) : [saved, ...items]); setEditing(undefined); }} />
    <ImportModal visible={importing} value={importText} onChange={setImportText} onClose={() => setImporting(false)} onImport={() => {
      try { const parsed = JSON.parse(importText); if (!Array.isArray(parsed) || !parsed.every(x => typeof x?.quote === 'string' && typeof x?.bookTitle === 'string')) throw Error(); commit(parsed); setImporting(false); setImportText(''); }
      catch { Alert.alert('無法匯入', '請確認貼上的是有效的書摘 JSON 陣列。'); }
    }} />
    <Oracle visible={oracle} drawn={drawn} onClose={() => setOracle(false)} onDraw={() => { const pool = items.length ? items : INITIAL; setDrawn(pool[Math.floor(Math.random() * pool.length)]); }} onReset={() => setDrawn(null)} />
  </SafeAreaView>;
}

function Title({ children, count }: { children: React.ReactNode; count?: number }) { return <View style={s.titleRow}><Text style={s.title}>{children}</Text>{count !== undefined && <Text style={s.count}>{count} 條</Text>}</View>; }

function Home({ items, book, fontSize, fontFamily, onBack, onEdit, onDelete }: { items: Excerpt[]; book: string | null; fontSize: FontSize; fontFamily: FontFamily; onBack: () => void; onEdit: (x: Excerpt) => void; onDelete: (x: Excerpt) => void }) {
  const sizes = { sm: 14, base: 16, lg: 18, xl: 21 };
  const family = fontFamily === 'serif' ? Platform.select({ ios: 'Songti TC', android: 'serif' }) : fontFamily === 'mono' ? Platform.select({ ios: 'Menlo', android: 'monospace' }) : undefined;
  return <View style={s.flex}>{book && <Pressable onPress={onBack} style={s.back}><Icon name="arrow-left" size={15} color={C.accent} /><Text style={s.backText}>返回全部</Text></Pressable>}
    <Title count={items.length}>{book ? `《${book}》` : '最近書摘'}</Title>
    <FlatList data={items} keyExtractor={x => x.id} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
      ListEmptyComponent={<Empty icon="book-open-blank-variant-outline" title="沒有找到任何書摘" subtitle="點擊右下角新增一筆吧" />}
      renderItem={({ item }) => <View style={s.quoteCard}>
        <Text selectable style={[s.quote, { fontSize: sizes[fontSize], fontFamily: family }]}>{item.quote}</Text>
        <Text style={s.bookName}>——《{item.bookTitle}》</Text><Text style={s.author}>{item.author}</Text>
        <View style={s.cardActions}><Pressable onPress={() => onEdit(item)}><Icon name="pencil-outline" size={18} color={C.accent} /></Pressable><Pressable onPress={() => onDelete(item)}><Icon name="trash-can-outline" size={18} color={C.danger} /></Pressable></View>
      </View>} />
  </View>;
}

function Books({ books, onSelect }: { books: { title: string; author: string; color: string; quotes: Excerpt[] }[]; onSelect: (s: string) => void }) {
  return <View style={s.flex}><Title>書櫃展示</Title><FlatList data={books} keyExtractor={x => x.title} numColumns={2} columnWrapperStyle={s.bookRow} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
    ListEmptyComponent={<Empty icon="bookshelf" title="尚無書籍" subtitle="新增書摘後會自動生成書籍" />}
    renderItem={({ item }) => <Pressable onPress={() => onSelect(item.title)} style={({ pressed }) => [s.cover, { backgroundColor: item.color }, pressed && s.pressed]}>
      <View style={s.spine} /><Text style={s.coverMeta}>{item.quotes.length} EXCERPTS</Text><Text style={s.coverTitle}>《{item.title}》</Text><View><Text numberOfLines={1} style={s.coverAuthor}>{item.author}</Text><Text style={s.coverCount}>{item.quotes.length}</Text></View>
    </Pressable>} /></View>;
}

function Dashboard({ items, books }: { items: Excerpt[]; books: { title: string; author: string; color: string; quotes: Excerpt[] }[] }) {
  const authors = new Set(items.map(x => x.author)).size;
  const top = [...books].sort((a, b) => b.quotes.length - a.quotes.length).slice(0, 3);
  const longest = items.reduce<Excerpt | null>((a, b) => !a || b.quote.length > a.quote.length ? b : a, null);
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}><Title>數據分析</Title>
    <View style={s.stats}>{[['書摘總數', items.length], ['精選藏書', books.length], ['涉及作家', authors]].map(([label, value]) => <View key={String(label)} style={s.stat}><Text style={s.statLabel}>{label}</Text><Text style={s.statValue}>{value}</Text></View>)}</View>
    <Section title="心頭好書籍 · TOP 3">{top.length ? top.map((b, i) => <View key={b.title} style={s.rank}><Text style={s.rankName}>{i + 1}. 《{b.title}》</Text><Text style={s.rankCount}>{b.quotes.length} 條</Text></View>) : <Text style={s.muted}>尚無書籍分類</Text>}</Section>
    <Section title="閱讀色彩美學偏好"><View style={s.palette}>{COLORS.map(color => <View key={color} style={[s.paletteItem, { backgroundColor: color, flex: Math.max(1, items.filter(x => x.coverColor === color).length) }]} />)}</View></Section>
    {longest && <Section title="最長摘錄金句"><Text style={s.insight}>{longest.quote}</Text><Text style={s.bookName}>——《{longest.bookTitle}》 · {longest.quote.length} 字</Text></Section>}
  </ScrollView>;
}

function Settings({ fontFamily, fontSize, setFontFamily, setFontSize, onExport, onImport, onRestore, onClear }: { fontFamily: FontFamily; fontSize: FontSize; setFontFamily: (v: FontFamily) => void; setFontSize: (v: FontSize) => void; onExport: () => void; onImport: () => void; onRestore: () => void; onClear: () => void }) {
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}><Title>設置偏好</Title>
    <Section title="閱讀排版偏好"><Text style={s.label}>字體樣式</Text><View style={s.segment}>{(['serif', 'sans', 'mono'] as const).map((v, i) => <Choice key={v} active={fontFamily === v} title={['古典襯線', '人文無襯', '極簡等寬'][i]} onPress={() => setFontFamily(v)} />)}</View><Text style={s.label}>字體大小</Text><View style={s.segment}>{(['sm', 'base', 'lg', 'xl'] as const).map((v, i) => <Choice key={v} active={fontSize === v} title={['細緻', '適中', '優雅', '醒目'][i]} onPress={() => setFontSize(v)} />)}</View></Section>
    <Section title="資料備份與匯入"><Button title="備份至剪貼簿" icon="content-copy" tone="light" onPress={onExport} /><Button title="從備份匯入" icon="tray-arrow-down" tone="light" onPress={onImport} /></Section>
    <Section title="系統維護與重置"><Button title="恢復預設經典書摘" icon="restore" tone="light" onPress={onRestore} /><Button title="清空所有書摘" icon="trash-can-outline" tone="danger" onPress={onClear} /></Section>
    <View style={s.about}><Text style={s.aboutTitle}>LineKeep 拾句</Text><Text style={s.wordmark}>VERSION 1.0.0</Text><Text style={s.aboutText}>讓經典字句留下溫暖痕跡，在日常裡拾起片刻心靈的避難所。</Text></View>
  </ScrollView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>; }
function Choice({ active, title, onPress }: { active: boolean; title: string; onPress: () => void }) { return <Pressable onPress={onPress} style={[s.choice, active && s.choiceActive]}><Text style={[s.choiceText, active && s.white]}>{title}</Text></Pressable>; }
function Empty({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) { return <View style={s.empty}><Icon name={icon as never} size={28} color={C.accent} /><Text style={s.emptyTitle}>{title}</Text><Text style={s.muted}>{subtitle}</Text></View>; }

function Editor({ visible, item, onClose, onSave }: { visible: boolean; item: Excerpt | null; onClose: () => void; onSave: (x: Excerpt) => void }) {
  const [quote, setQuote] = useState(''); const [title, setTitle] = useState(''); const [author, setAuthor] = useState(''); const [color, setColor] = useState(COLORS[0]);
  useEffect(() => { if (visible) { setQuote(item?.quote ?? ''); setTitle(item?.bookTitle ?? ''); setAuthor(item?.author ?? ''); setColor(item?.coverColor ?? COLORS[0]); } }, [visible, item]);
  const save = () => { if (!quote.trim() || !title.trim()) return Alert.alert('資料未完整', '請填寫書摘內容與書名。'); onSave({ id: item?.id ?? Date.now().toString(), quote: quote.trim(), bookTitle: title.trim(), author: author.trim() || '佚名', coverColor: color, createdAt: item?.createdAt ?? Date.now() }); };
  return <Sheet visible={visible} title={item ? '編輯經典書摘' : '記錄一刻觸動'} onClose={onClose}><Field label="書摘內容" value={quote} onChangeText={setQuote} multiline placeholder="寫下觸動你的句子…" /><Field label="書名" value={title} onChangeText={setTitle} placeholder="例如：月亮與六便士" /><Field label="作者" value={author} onChangeText={setAuthor} placeholder="例如：威廉·薩默塞特·毛姆" /><Text style={s.label}>書籍封面色彩</Text><View style={s.colors}>{COLORS.map(v => <Pressable accessibilityLabel={`選擇顏色 ${v}`} key={v} onPress={() => setColor(v)} style={[s.color, { backgroundColor: v }, color === v && s.colorActive]}>{color === v && <Icon name="check" size={15} color="#fff" />}</Pressable>)}</View><Button title="儲存經典" onPress={save} /></Sheet>;
}
function ImportModal({ visible, value, onChange, onClose, onImport }: { visible: boolean; value: string; onChange: (v: string) => void; onClose: () => void; onImport: () => void }) { return <Sheet visible={visible} title="從備份匯入" onClose={onClose}><Field label="JSON 備份資料" value={value} onChangeText={onChange} multiline placeholder="在此貼上備份內容…" /><Button title="匯入書摘" onPress={onImport} /></Sheet>; }
function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) { const { label, multiline, ...input } = props; return <View><Text style={s.label}>{label}</Text><TextInput {...input} multiline={multiline} textAlignVertical="top" placeholderTextColor={C.muted} style={[s.input, multiline && s.textarea]} /></View>; }
function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) { return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}><View style={s.sheet}><View style={s.titleRow}><Text style={s.title}>{title}</Text><Pressable onPress={onClose} style={s.iconButton}><Icon name="close" size={20} color={C.muted} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>{children}</ScrollView></View></KeyboardAvoidingView></Modal>; }

function Oracle({ visible, drawn, onClose, onDraw, onReset }: { visible: boolean; drawn: Excerpt | null; onClose: () => void; onDraw: () => void; onReset: () => void }) { return <Modal visible={visible} animationType="fade" onRequestClose={onClose}><SafeAreaView style={s.oracle}><View style={s.oracleHeader}><Pressable onPress={onClose} style={s.oracleClose}><Icon name="arrow-left" size={20} color="#fff" /></Pressable><View><Text style={s.oracleTitle}>書言占卜</Text><Text style={s.oracleMeta}>LINEKEEP ORACLE</Text></View><View style={s.oracleClose} /></View>{drawn ? <View style={s.oracleBody}><Text style={s.oracleHint}>今日字句啟示</Text><View style={s.oracleCard}><Icon name="creation" size={22} color={C.accent} /><Text style={s.oracleQuote}>{drawn.quote}</Text><Text style={s.bookName}>——《{drawn.bookTitle}》</Text><Text style={s.author}>{drawn.author}</Text></View><Button title="重新占卜" onPress={onReset} /></View> : <View style={s.oracleBody}><Text style={s.oracleHeading}>叩問文字的啟示</Text><Text style={s.oracleCopy}>安靜想著此刻的疑惑，選一張神諭書卡。</Text><View style={s.oracleDeck}>{[1, 2, 3].map(n => <Pressable key={n} onPress={onDraw} style={({ pressed }) => [s.oracleBack, pressed && s.pressed]}><Icon name="compass-outline" size={26} color={C.accent} /><Text style={s.oracleMeta}>CARD {n}</Text></Pressable>)}</View></View>}</SafeAreaView></Modal>; }

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 }, loading: { margin: 'auto', color: C.muted },
  header: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 31, fontWeight: '800', color: C.ink, letterSpacing: -1 }, wordmark: { fontSize: 9, fontWeight: '700', color: C.muted, letterSpacing: 3 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 20, marginBottom: 14, minHeight: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.panel, flexDirection: 'row', alignItems: 'center' }, searchInput: { flex: 1, color: C.ink, paddingHorizontal: 10, fontSize: 14 },
  content: { flex: 1, paddingHorizontal: 20 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { fontSize: 19, fontWeight: '800', color: C.ink, marginBottom: 12 }, count: { color: C.accent, backgroundColor: C.panel, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 11, fontWeight: '700' },
  back: { alignSelf: 'flex-start', flexDirection: 'row', gap: 4, alignItems: 'center', marginBottom: 8 }, backText: { color: C.accent, fontSize: 12, fontWeight: '700' }, list: { paddingBottom: 110, gap: 12 },
  quoteCard: { padding: 20, borderRadius: 22, backgroundColor: C.panel, borderWidth: 1, borderColor: '#EAEBE8' }, quote: { color: C.ink, lineHeight: 27, fontWeight: '500', marginBottom: 16 }, bookName: { color: C.ink, fontSize: 12, fontWeight: '700', textAlign: 'right' }, author: { color: C.muted, fontSize: 11, textAlign: 'right', marginTop: 3 }, cardActions: { flexDirection: 'row', gap: 18, marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line, justifyContent: 'flex-end' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 }, emptyTitle: { color: C.ink, fontWeight: '700', marginTop: 5 }, muted: { color: C.muted, fontSize: 12 },
  bookRow: { gap: 14 }, cover: { flex: 1, height: 205, borderRadius: 18, padding: 18, marginBottom: 14, overflow: 'hidden', justifyContent: 'space-between' }, spine: { position: 'absolute', width: 14, left: 0, top: 0, bottom: 0, backgroundColor: '#00000020' }, coverMeta: { color: '#FFFFFFAA', fontSize: 9, letterSpacing: 1.5 }, coverTitle: { color: '#fff', fontSize: 16, lineHeight: 24, fontWeight: '700' }, coverAuthor: { color: '#FFFFFFBB', fontSize: 10 }, coverCount: { color: '#fff', fontWeight: '800', marginTop: 5 },
  stats: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, backgroundColor: C.panel, borderRadius: 17, padding: 13, alignItems: 'center' }, statLabel: { fontSize: 10, color: C.muted, fontWeight: '700' }, statValue: { fontSize: 24, color: C.ink, fontWeight: '900', marginTop: 4 }, section: { backgroundColor: C.panel, borderRadius: 22, padding: 16, gap: 11 }, sectionTitle: { color: C.muted, fontSize: 11, letterSpacing: 1, fontWeight: '800', borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 10 }, rank: { flexDirection: 'row', justifyContent: 'space-between' }, rankName: { color: C.ink, fontSize: 13, fontWeight: '600' }, rankCount: { color: C.accent, fontSize: 12, fontWeight: '800' }, palette: { height: 16, flexDirection: 'row', borderRadius: 8, overflow: 'hidden' }, paletteItem: { height: '100%' }, insight: { color: C.ink, fontSize: 14, lineHeight: 23 },
  label: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 3, marginBottom: 7 }, segment: { flexDirection: 'row', backgroundColor: '#FFFFFF99', padding: 4, borderRadius: 12 }, choice: { flex: 1, minHeight: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, choiceActive: { backgroundColor: C.ink }, choiceText: { color: C.muted, fontSize: 10, fontWeight: '700' },
  button: { minHeight: 46, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, button_dark: { backgroundColor: C.ink }, button_light: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line }, button_danger: { backgroundColor: '#FFF2F2', borderWidth: 1, borderColor: '#F1CCCC' }, buttonText: { fontSize: 13, fontWeight: '800' }, white: { color: '#fff' }, ink: { color: C.ink }, danger: { color: C.danger }, pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  about: { backgroundColor: C.panel, borderRadius: 22, padding: 20, alignItems: 'center' }, aboutTitle: { color: C.ink, fontWeight: '800' }, aboutText: { color: C.muted, textAlign: 'center', fontSize: 12, lineHeight: 20, marginTop: 10, maxWidth: 280 },
  fab: { position: 'absolute', right: 23, bottom: 82, width: 58, height: 58, borderRadius: 29, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: C.ink, shadowOpacity: .25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  nav: { height: 66, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', backgroundColor: C.bg }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }, sheet: { maxHeight: '92%', backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22 }, form: { gap: 15, paddingBottom: 20 }, input: { minHeight: 48, backgroundColor: C.panel, color: C.ink, borderRadius: 14, paddingHorizontal: 14, fontSize: 14, borderWidth: 1, borderColor: '#EAEBE8' }, textarea: { minHeight: 120, paddingTop: 14 }, colors: { flexDirection: 'row', gap: 14, marginBottom: 8 }, color: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, colorActive: { borderWidth: 3, borderColor: '#fff', outlineWidth: 2, outlineColor: C.accent },
  oracle: { flex: 1, backgroundColor: '#161716', padding: 22 }, oracleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, oracleClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF12' }, oracleTitle: { color: C.accent, textAlign: 'center', fontWeight: '800', letterSpacing: 3 }, oracleMeta: { color: '#FFFFFF55', fontSize: 9, letterSpacing: 2, textAlign: 'center', marginTop: 5 }, oracleBody: { flex: 1, alignItems: 'stretch', justifyContent: 'center', gap: 28 }, oracleHeading: { color: '#fff', fontSize: 23, fontWeight: '800', textAlign: 'center' }, oracleCopy: { color: '#FFFFFF99', fontSize: 13, lineHeight: 21, textAlign: 'center' }, oracleDeck: { flexDirection: 'row', justifyContent: 'center', gap: 13 }, oracleBack: { width: 96, height: 170, borderRadius: 18, borderWidth: 1, borderColor: '#8DA6B566', backgroundColor: '#252725', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 25 }, oracleHint: { color: C.accent, textAlign: 'center', fontWeight: '800', letterSpacing: 2 }, oracleCard: { minHeight: 330, backgroundColor: '#F3F0E9', borderRadius: 26, padding: 28, justifyContent: 'space-between', alignItems: 'center' }, oracleQuote: { color: C.ink, fontSize: 20, lineHeight: 34, textAlign: 'center', fontFamily: Platform.select({ ios: 'Songti TC', android: 'serif' }) },
});
