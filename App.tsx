import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, FlatList, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Excerpt = { id: string; quote: string; bookTitle: string; author: string; coverColor: string; createdAt: number };
type Tab = 'home' | 'books' | 'dashboard' | 'settings';
type FontSize = 'sm' | 'base' | 'lg' | 'xl';
type FontFamily = 'sans' | 'serif' | 'mono';
type ThemeName = 'minimal' | 'garden' | 'midnight' | 'sunlight';
type ThemeColors = { bg: string; panel: string; ink: string; muted: string; accent: string; danger: string; line: string };

const THEMES: Record<ThemeName, { label: string; colors: ThemeColors; swatches: string[] }> = {
  minimal: { label: '極簡色調', colors: { bg: '#F3F4F2', panel: '#FAFAF8', ink: '#252725', muted: '#767B78', accent: '#718E9E', danger: '#C55252', line: '#DFE1DE' }, swatches: ['#F3F4F2', '#FAFAF8', '#718E9E', '#252725'] },
  garden: { label: '花園藤椅', colors: { bg: '#F7F5F1', panel: '#E0DCD1', ink: '#344945', muted: '#667264', accent: '#B4BD62', danger: '#A45244', line: '#C9C5B8' }, swatches: ['#F7F5F1', '#E0DCD1', '#8EBD9D', '#B4BD62'] },
  midnight: { label: '午夜霓虹', colors: { bg: '#080D1C', panel: '#111A35', ink: '#F7F5F1', muted: '#B7C3E7', accent: '#DDF57A', danger: '#F07AD9', line: '#24345F' }, swatches: ['#080D1C', '#111A35', '#B7C3E7', '#F07AD9', '#DDF57A'] },
  sunlight: { label: '日光閃爍', colors: { bg: '#D5E3E8', panel: '#FFFDF5', ink: '#1B475D', muted: '#567482', accent: '#FAD564', danger: '#E86E49', line: '#95B1EE' }, swatches: ['#D5E3E8', '#95B1EE', '#FFFDF5', '#FAD564'] },
};
const ThemeContext = React.createContext<{ colors: ThemeColors; styles: ReturnType<typeof createStyles> } | null>(null);
const useTheme = () => { const value = React.useContext(ThemeContext); if (!value) throw Error('ThemeProvider missing'); return value; };
const COLORS = ['#8DA6B5', '#252725', '#D9A05B', '#6D8E7D', '#A88174'];
const haptic = {
  select: () => void Haptics.selectionAsync(),
  light: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
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

function Button({ title, onPress, tone = 'dark', icon, feedback = true }: { title: string; onPress: () => void; tone?: 'dark' | 'light' | 'danger'; icon?: string; feedback?: boolean }) {
  const { colors: C, styles: s } = useTheme();
  return <Pressable accessibilityRole="button" onPress={() => { if (feedback) haptic.light(); onPress(); }} style={({ pressed }) => [s.button, s[`button_${tone}`], pressed && s.pressed]}>
    {icon && <Icon name={icon as never} size={16} color={tone === 'dark' ? C.bg : tone === 'danger' ? C.danger : C.ink} />}
    <Text style={[s.buttonText, tone === 'dark' ? s.white : tone === 'danger' ? s.danger : s.ink]}>{title}</Text>
  </Pressable>;
}

export default function App() {
  const [theme, setTheme] = useState<ThemeName>('minimal');
  useEffect(() => { storage.load<ThemeName>('linekeep_theme', 'minimal').then(saved => setTheme(THEMES[saved] ? saved : 'minimal')); }, []);
  const colors = THEMES[theme].colors;
  const value = useMemo(() => ({ colors, styles: createStyles(colors) }), [colors]);
  return <ThemeContext.Provider value={value}><SafeAreaProvider><Main theme={theme} setTheme={next => { setTheme(next); storage.save('linekeep_theme', next); }} /></SafeAreaProvider></ThemeContext.Provider>;
}

function Main({ theme, setTheme }: { theme: ThemeName; setTheme: (theme: ThemeName) => void }) {
  const { colors: C, styles: s } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Excerpt[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookFilters, setBookFilters] = useState<string[]>([]);
  const [filtering, setFiltering] = useState(false);
  const [featured, setFeatured] = useState<Excerpt | null>(null);
  const [editing, setEditing] = useState<Excerpt | null | undefined>();
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
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
    return (!bookFilters.length || bookFilters.includes(item.bookTitle)) && (!q || `${item.quote} ${item.bookTitle} ${item.author}`.toLowerCase().includes(q));
  }), [items, search, bookFilters]);
  useEffect(() => { setFeatured(null); }, [items, search, bookFilters]);

  const remove = (item: Excerpt) => Alert.alert('刪除書摘', '此操作無法復原。', [
    { text: '取消', style: 'cancel' }, { text: '刪除', style: 'destructive', onPress: () => commit(items.filter(x => x.id !== item.id)) },
  ]);
  const setPreference = <T,>(setter: (v: T) => void, key: string, value: T) => { setter(value); storage.save(key, value); };

  if (!ready) return <SafeAreaView style={s.screen}><Text style={s.loading}>正在整理書頁…</Text></SafeAreaView>;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
    <StatusBar style={theme === 'midnight' ? 'light' : 'dark'} />
    <View style={s.header}>
      <Pressable onPress={() => { setTab('home'); setBookFilters([]); setSearch(''); }}><Text style={s.logo}>拾句</Text></Pressable>
      {tab === 'home' && <Pressable accessibilityRole="button" accessibilityLabel="抽一張書摘" accessibilityState={{ disabled: !filtered.length }} disabled={!filtered.length} onPress={() => { haptic.medium(); setFeatured(filtered[Math.floor(Math.random() * filtered.length)]); }} style={({ pressed }) => [s.drawButton, !filtered.length && s.disabled, pressed && s.pressed]}><Icon name="creation" size={19} color={C.bg} /><Text style={s.drawButtonText}>抽一張</Text></Pressable>}
    </View>

    {tab === 'home' && <View style={s.homeTools}>{searchOpen ? <View style={s.headerSearch}><Icon name="magnify" size={20} color={C.muted} /><TextInput autoFocus value={search} onChangeText={setSearch} placeholder="搜尋書名、作者或句子" placeholderTextColor={C.muted} style={s.searchInput} /><Pressable accessibilityLabel="關閉搜尋" onPress={() => { setSearch(''); setSearchOpen(false); }} style={s.searchClose}><Icon name="close" size={18} color={C.muted} /></Pressable></View> : <Pressable accessibilityLabel="搜尋書摘" onPress={() => { haptic.light(); setSearchOpen(true); }} style={s.iconButton}><Icon name="magnify" size={21} color={C.muted} /></Pressable>}<Pressable accessibilityLabel="篩選書籍" onPress={() => { haptic.light(); setFiltering(true); }} style={[s.iconButton, !!bookFilters.length && s.iconButtonActive]}><Icon name="filter-variant" size={21} color={bookFilters.length ? C.ink : C.muted} />{!!bookFilters.length && <Text style={s.filterBadge}>{bookFilters.length}</Text>}</Pressable></View>}

    <View style={s.content}>
      {tab === 'home' && <Home items={filtered} featured={featured} fontFamily={fontFamily} fontSize={fontSize} onEdit={setEditing} onDelete={remove} />}
      {tab === 'books' && <Books books={books} onSelect={title => { setBookFilters([title]); setTab('home'); }} />}
      {tab === 'dashboard' && <Dashboard items={items} books={books} />}
      {tab === 'settings' && <Settings fontFamily={fontFamily} fontSize={fontSize}
        theme={theme} setTheme={setTheme}
        setFontFamily={v => setPreference(setFontFamily, 'linekeep_font_family', v)}
        setFontSize={v => setPreference(setFontSize, 'linekeep_font_size', v)}
        onExport={async () => { await Clipboard.setStringAsync(JSON.stringify(items, null, 2)); haptic.success(); Alert.alert('備份完成', 'JSON 已複製到剪貼簿。'); }}
        onImport={() => setImporting(true)}
        onRestore={() => Alert.alert('恢復預設', '目前書摘將被覆蓋。', [{ text: '取消' }, { text: '恢復', onPress: () => { haptic.warning(); commit(INITIAL); } }])}
        onClear={() => Alert.alert('清空所有書摘', '此操作無法復原。', [{ text: '取消' }, { text: '清空', style: 'destructive', onPress: () => { haptic.warning(); commit([]); } }])} />}
    </View>

    {(tab === 'home' || tab === 'books') && <Pressable accessibilityLabel="新增書摘" onPress={() => { haptic.medium(); setEditing(null); }} style={({ pressed }) => [s.fab, { bottom: 82 + insets.bottom }, pressed && s.pressed]}><Icon name="plus" size={30} color="#fff" /></Pressable>}
    <View style={[s.nav, { height: 66 + insets.bottom, paddingBottom: insets.bottom }]}>{([
      ['home', 'layers-outline'], ['books', 'book-open-page-variant-outline'], ['dashboard', 'chart-bar'], ['settings', 'cog-outline'],
    ] as [Tab, string][]).map(([key, icon]) => <Pressable key={key} accessibilityRole="tab" onPress={() => { if (tab !== key) haptic.select(); setTab(key); setSearch(''); setSearchOpen(false); }} style={s.navItem}>
      <Icon name={icon as never} size={25} color={tab === key ? C.accent : C.muted} />
    </Pressable>)}</View>

    <Editor visible={editing !== undefined} item={editing ?? null} onClose={() => setEditing(undefined)} onSave={saved => { commit(editing ? items.map(x => x.id === saved.id ? saved : x) : [saved, ...items]); setEditing(undefined); }} />
    <BookFilter visible={filtering} books={books} selected={bookFilters} onToggle={title => { haptic.select(); setBookFilters(current => current.includes(title) ? current.filter(x => x !== title) : [...current, title]); }} onClear={() => setBookFilters([])} onClose={() => setFiltering(false)} />
    <ImportModal visible={importing} value={importText} onChange={setImportText} onClose={() => setImporting(false)} onImport={() => {
      try { const parsed = JSON.parse(importText); if (!Array.isArray(parsed) || !parsed.every(x => typeof x?.quote === 'string' && typeof x?.bookTitle === 'string')) throw Error(); commit(parsed); haptic.success(); setImporting(false); setImportText(''); }
      catch { haptic.error(); Alert.alert('無法匯入', '請確認貼上的是有效的書摘 JSON 陣列。'); }
    }} />
  </SafeAreaView>;
}

function Home({ items, featured, fontSize, fontFamily, onEdit, onDelete }: { items: Excerpt[]; featured: Excerpt | null; fontSize: FontSize; fontFamily: FontFamily; onEdit: (x: Excerpt) => void; onDelete: (x: Excerpt) => void }) {
  const { styles: s } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const sizes = { sm: 16, base: 18, lg: 20, xl: 23 };
  const family = fontFamily === 'serif' ? Platform.select({ ios: 'Songti TC', android: 'serif' }) : fontFamily === 'mono' ? Platform.select({ ios: 'Menlo', android: 'monospace' }) : undefined;
  return <View style={s.flex}><FlatList data={items} keyExtractor={x => x.id} contentContainerStyle={s.list} showsVerticalScrollIndicator={false} onScrollBeginDrag={() => setOpenId(null)}
      ListHeaderComponent={featured ? <DrawResult item={featured} fontSize={sizes[fontSize]} fontFamily={family} /> : null}
      ListEmptyComponent={<Empty icon="book-open-blank-variant-outline" title="沒有找到任何書摘" subtitle="點擊右下角新增一筆吧" />}
      renderItem={({ item }) => <QuoteCard item={item} fontSize={sizes[fontSize]} fontFamily={family} isOpen={openId === item.id} onOpen={open => setOpenId(open ? item.id : null)} onEdit={onEdit} onDelete={onDelete} />} />
  </View>;
}

function DrawResult({ item, fontSize, fontFamily }: { item: Excerpt; fontSize: number; fontFamily?: string }) { const { styles: s } = useTheme(); return <View style={s.drawResult}><View style={s.quoteBody}><Text style={[s.quote, { fontSize, fontFamily }]}>{item.quote.trim().replace(/^[「『“"]|[」』”"]$/g, '')}</Text></View><View style={s.quoteFooter}><Text style={s.bookName}>《{item.bookTitle}》</Text><Text style={s.author}>{item.author}</Text></View></View>; }

function QuoteCard({ item, fontSize, fontFamily, isOpen, onOpen, onEdit, onDelete }: { item: Excerpt; fontSize: number; fontFamily?: string; isOpen: boolean; onOpen: (open: boolean) => void; onEdit: (x: Excerpt) => void; onDelete: (x: Excerpt) => void }) {
  const { colors: C, styles: s } = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const settle = (next: boolean) => { open.current = next; Animated.spring(x, { toValue: next ? -112 : 0, useNativeDriver: true, bounciness: 0 }).start(); };
  useEffect(() => { if (isOpen !== open.current) settle(isOpen); }, [isOpen]);
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy),
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => x.setValue(Math.max(-112, Math.min(0, (open.current ? -112 : 0) + g.dx))),
    onPanResponderRelease: (_, g) => { const next = open.current ? g.dx < 12 && g.vx < .1 : g.dx < -28 || g.vx < -.25; if (next !== open.current) haptic.light(); settle(next); onOpen(next); },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => settle(open.current),
  })).current;
  return <View style={s.quoteShell}>
    <View style={s.swipeActions}><Pressable accessibilityLabel="編輯書摘" onPress={event => { event.stopPropagation(); haptic.light(); onEdit(item); }} style={[s.swipeAction, s.editAction]}><Icon name="pencil-outline" size={20} color={C.accent} /></Pressable><Pressable accessibilityLabel="刪除書摘" onPress={event => { event.stopPropagation(); haptic.warning(); onDelete(item); }} style={[s.swipeAction, s.deleteAction]}><Icon name="trash-can-outline" size={20} color={C.danger} /></Pressable></View>
    <Animated.View {...pan.panHandlers} style={[s.quoteCard, { transform: [{ translateX: x }] }]}><Pressable style={s.quoteCardTap} onPress={() => onOpen(false)}><View style={s.quoteBody}><Text selectable style={[s.quote, { fontSize, fontFamily }]}>{item.quote.trim().replace(/^[「『“"]|[」』”"]$/g, '')}</Text></View><View style={s.quoteFooter}><Text style={s.bookName}>《{item.bookTitle}》</Text><Text style={s.author}>{item.author}</Text></View></Pressable></Animated.View>
  </View>;
}

function Books({ books, onSelect }: { books: { title: string; author: string; color: string; quotes: Excerpt[] }[]; onSelect: (s: string) => void }) {
  const { styles: s } = useTheme();
  const [display, setDisplay] = useState<'spine' | 'cover'>('cover');
  return <View style={s.flex}><View style={s.displayToggle}><Choice active={display === 'spine'} title="書背展示" onPress={() => setDisplay('spine')} /><Choice active={display === 'cover'} title="書封展示" onPress={() => setDisplay('cover')} /></View><FlatList key={display} data={books} keyExtractor={x => x.title} numColumns={display === 'cover' ? 2 : 1} columnWrapperStyle={display === 'cover' ? s.bookRow : undefined} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
    ListEmptyComponent={<Empty icon="bookshelf" title="尚無書籍" subtitle="新增書摘後會自動生成書籍" />}
    renderItem={({ item }) => display === 'cover' ? <Pressable onPress={() => { haptic.select(); onSelect(item.title); }} style={({ pressed }) => [s.cover, { backgroundColor: item.color }, pressed && s.pressed]}><View style={s.spine} /><Text style={s.coverMeta}>{item.quotes.length} EXCERPTS</Text><Text style={s.coverTitle}>《{item.title}》</Text><View><Text numberOfLines={1} style={s.coverAuthor}>{item.author}</Text><Text style={s.coverCount}>{item.quotes.length}</Text></View></Pressable>
      : <Pressable onPress={() => { haptic.select(); onSelect(item.title); }} style={({ pressed }) => [s.spineBook, { backgroundColor: item.color }, pressed && s.pressed]}><View style={s.spineBookBody}><Text style={s.spineBookTitle}>《{item.title}》</Text><Text style={s.spineBookAuthor}>{item.author}</Text></View><Text style={s.spineBookCount}>{item.quotes.length}</Text></Pressable>} /></View>;
}

function Dashboard({ items, books }: { items: Excerpt[]; books: { title: string; author: string; color: string; quotes: Excerpt[] }[] }) {
  const { styles: s } = useTheme();
  const authors = new Set(items.map(x => x.author)).size;
  const top = [...books].sort((a, b) => b.quotes.length - a.quotes.length).slice(0, 3);
  const longest = items.reduce<Excerpt | null>((a, b) => !a || b.quote.length > a.quote.length ? b : a, null);
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
    <View style={s.stats}>{[['書摘總數', items.length], ['精選藏書', books.length], ['涉及作家', authors]].map(([label, value]) => <View key={String(label)} style={s.stat}><Text style={s.statLabel}>{label}</Text><Text style={s.statValue}>{value}</Text></View>)}</View>
    <Section title="心頭好書籍 · TOP 3">{top.length ? top.map((b, i) => <View key={b.title} style={s.rank}><Text style={s.rankName}>{i + 1}. 《{b.title}》</Text><Text style={s.rankCount}>{b.quotes.length} 條</Text></View>) : <Text style={s.muted}>尚無書籍分類</Text>}</Section>
    <Section title="閱讀色彩美學偏好"><View style={s.palette}>{COLORS.map(color => <View key={color} style={[s.paletteItem, { backgroundColor: color, flex: Math.max(1, items.filter(x => x.coverColor === color).length) }]} />)}</View></Section>
    {longest && <Section title="最長摘錄金句"><Text style={s.insight}>{longest.quote}</Text><Text style={s.bookName}>——《{longest.bookTitle}》 · {longest.quote.length} 字</Text></Section>}
  </ScrollView>;
}

function Settings({ theme, fontFamily, fontSize, setTheme, setFontFamily, setFontSize, onExport, onImport, onRestore, onClear }: { theme: ThemeName; fontFamily: FontFamily; fontSize: FontSize; setTheme: (v: ThemeName) => void; setFontFamily: (v: FontFamily) => void; setFontSize: (v: FontSize) => void; onExport: () => void; onImport: () => void; onRestore: () => void; onClear: () => void }) {
  const { styles: s } = useTheme();
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
    <Section title="介面配色"><View style={s.themeList}>{(Object.keys(THEMES) as ThemeName[]).map(key => <ThemeChoice key={key} themeKey={key} active={theme === key} onPress={() => setTheme(key)} />)}</View></Section>
    <Section title="閱讀排版偏好"><Text style={s.label}>字體樣式</Text><View style={s.segment}>{(['serif', 'sans', 'mono'] as const).map((v, i) => <Choice key={v} active={fontFamily === v} title={['古典襯線', '人文無襯', '極簡等寬'][i]} onPress={() => setFontFamily(v)} />)}</View><Text style={s.label}>字體大小</Text><View style={s.segment}>{(['sm', 'base', 'lg', 'xl'] as const).map((v, i) => <Choice key={v} active={fontSize === v} title={['細緻', '適中', '優雅', '醒目'][i]} onPress={() => setFontSize(v)} />)}</View></Section>
    <Section title="資料備份與匯入"><Button title="備份至剪貼簿" icon="content-copy" tone="light" onPress={onExport} /><Button title="從備份匯入" icon="tray-arrow-down" tone="light" onPress={onImport} /></Section>
    <Section title="系統維護與重置"><Button title="恢復預設經典書摘" icon="restore" tone="light" onPress={onRestore} /><Button title="清空所有書摘" icon="trash-can-outline" tone="danger" onPress={onClear} /></Section>
    <View style={s.about}><Text style={s.aboutTitle}>LineKeep 拾句</Text><Text style={s.wordmark}>VERSION 1.0.0</Text><Text style={s.aboutText}>讓經典字句留下溫暖痕跡，在日常裡拾起片刻心靈的避難所。</Text></View>
  </ScrollView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { const { styles: s } = useTheme(); return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>; }
function Choice({ active, title, onPress }: { active: boolean; title: string; onPress: () => void }) { const { styles: s } = useTheme(); return <Pressable onPress={() => { if (!active) haptic.select(); onPress(); }} style={[s.choice, active && s.choiceActive]}><Text style={[s.choiceText, active && s.white]}>{title}</Text></Pressable>; }
function ThemeChoice({ themeKey, active, onPress }: { themeKey: ThemeName; active: boolean; onPress: () => void }) { const { colors: C, styles: s } = useTheme(); const option = THEMES[themeKey]; return <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => { if (!active) haptic.select(); onPress(); }} style={[s.themeChoice, active && s.themeChoiceActive]}><View style={s.themeSwatches}>{option.swatches.map(color => <View key={color} style={[s.themeSwatch, { backgroundColor: color }]} />)}</View><Text style={s.themeName}>{option.label}</Text>{active && <Icon name="check-circle" size={20} color={C.accent} />}</Pressable>; }
function Empty({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) { const { colors: C, styles: s } = useTheme(); return <View style={s.empty}><Icon name={icon as never} size={28} color={C.accent} /><Text style={s.emptyTitle}>{title}</Text><Text style={s.muted}>{subtitle}</Text></View>; }

function Editor({ visible, item, onClose, onSave }: { visible: boolean; item: Excerpt | null; onClose: () => void; onSave: (x: Excerpt) => void }) {
  const { styles: s } = useTheme();
  const [quote, setQuote] = useState(''); const [title, setTitle] = useState(''); const [author, setAuthor] = useState(''); const [color, setColor] = useState(COLORS[0]);
  useEffect(() => { if (visible) { setQuote(item?.quote ?? ''); setTitle(item?.bookTitle ?? ''); setAuthor(item?.author ?? ''); setColor(item?.coverColor ?? COLORS[0]); } }, [visible, item]);
  const save = () => { if (!quote.trim() || !title.trim()) { haptic.error(); return Alert.alert('資料未完整', '請填寫書摘內容與書名。'); } haptic.success(); onSave({ id: item?.id ?? Date.now().toString(), quote: quote.trim(), bookTitle: title.trim(), author: author.trim() || '佚名', coverColor: color, createdAt: item?.createdAt ?? Date.now() }); };
  return <Sheet visible={visible} title={item ? '編輯經典書摘' : '記錄一刻觸動'} onClose={onClose}><Field label="書摘內容" value={quote} onChangeText={setQuote} multiline placeholder="寫下觸動你的句子…" /><Field label="書名" value={title} onChangeText={setTitle} placeholder="例如：月亮與六便士" /><Field label="作者" value={author} onChangeText={setAuthor} placeholder="例如：威廉·薩默塞特·毛姆" /><Text style={s.label}>書籍封面色彩</Text><View style={s.colors}>{COLORS.map(v => <Pressable accessibilityLabel={`選擇顏色 ${v}`} key={v} onPress={() => { if (color !== v) haptic.select(); setColor(v); }} style={[s.color, { backgroundColor: v }, color === v && s.colorActive]}>{color === v && <Icon name="check" size={15} color="#fff" />}</Pressable>)}</View><Button title="儲存經典" feedback={false} onPress={save} /></Sheet>;
}
function ImportModal({ visible, value, onChange, onClose, onImport }: { visible: boolean; value: string; onChange: (v: string) => void; onClose: () => void; onImport: () => void }) { return <Sheet visible={visible} title="從備份匯入" onClose={onClose}><Field label="JSON 備份資料" value={value} onChangeText={onChange} multiline placeholder="在此貼上備份內容…" /><Button title="匯入書摘" feedback={false} onPress={onImport} /></Sheet>; }
function BookFilter({ visible, books, selected, onToggle, onClear, onClose }: { visible: boolean; books: { title: string; quotes: Excerpt[] }[]; selected: string[]; onToggle: (title: string) => void; onClear: () => void; onClose: () => void }) { const { colors: C, styles: s } = useTheme(); return <Sheet visible={visible} title="篩選書摘" onClose={onClose}><Text style={s.muted}>可複選，只顯示所選書籍的書摘。</Text><View style={s.filterList}>{books.length ? books.map(book => { const active = selected.includes(book.title); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: active }} key={book.title} onPress={() => onToggle(book.title)} style={s.filterRow}><Icon name={active ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={23} color={active ? C.accent : C.muted} /><Text numberOfLines={2} style={s.filterTitle}>《{book.title}》</Text><Text style={s.filterCount}>{book.quotes.length}</Text></Pressable>; }) : <Empty icon="bookshelf" title="尚無書籍" subtitle="新增書摘後即可篩選" />}</View>{!!selected.length && <Button title="清除全部" tone="light" onPress={onClear} />}<Button title="完成" onPress={onClose} /></Sheet>; }
function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) { const { colors: C, styles: s } = useTheme(); const { label, multiline, ...input } = props; return <View><Text style={s.label}>{label}</Text><TextInput {...input} multiline={multiline} textAlignVertical="top" placeholderTextColor={C.muted} style={[s.input, multiline && s.textarea]} /></View>; }
function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) { const { colors: C, styles: s } = useTheme(); return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><SafeAreaProvider><SafeAreaView edges={['right', 'bottom', 'left']} style={s.overlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetAvoider}><View style={s.sheet}><View style={s.titleRow}><Text style={s.title}>{title}</Text><Pressable accessibilityLabel="關閉" onPress={onClose} style={s.iconButton}><Icon name="close" size={20} color={C.muted} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>{children}</ScrollView></View></KeyboardAvoidingView></SafeAreaView></SafeAreaProvider></Modal>; }

function createStyles(C: ThemeColors) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 }, loading: { margin: 'auto', color: C.muted },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 33, fontWeight: '800', color: C.ink, letterSpacing: -1 }, wordmark: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 3 },
  drawButton: { minWidth: 116, minHeight: 44, borderRadius: 14, paddingHorizontal: 16, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, drawButtonText: { color: C.bg, fontSize: 15, fontWeight: '800' }, disabled: { opacity: .4 }, homeTools: { minHeight: 52, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }, iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' }, iconButtonActive: { backgroundColor: C.line }, filterBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, overflow: 'hidden', backgroundColor: C.accent, color: C.bg, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  headerSearch: { flex: 1, minWidth: 0, minHeight: 44, paddingLeft: 13, borderRadius: 16, backgroundColor: C.panel, flexDirection: 'row', alignItems: 'center' }, searchInput: { flex: 1, minWidth: 0, color: C.ink, paddingHorizontal: 10, fontSize: 16 }, searchClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: 20 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { fontSize: 21, fontWeight: '800', color: C.ink, marginBottom: 12 }, list: { paddingBottom: 110, gap: 12 },
  quoteShell: { borderRadius: 22, overflow: 'hidden', backgroundColor: C.panel }, swipeActions: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 112, flexDirection: 'row' }, swipeAction: { flex: 1, alignItems: 'center', justifyContent: 'center' }, editAction: { backgroundColor: C.line }, deleteAction: { backgroundColor: C.panel }, quoteCard: { minHeight: 190, padding: 20, borderRadius: 22, backgroundColor: C.panel }, quoteCardTap: { flex: 1 }, quoteBody: { flexGrow: 1, justifyContent: 'center', paddingVertical: 14 }, quote: { color: C.ink, lineHeight: 31, fontWeight: '500', textAlign: 'center' }, quoteFooter: { alignItems: 'flex-end' }, bookName: { color: C.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' }, author: { color: C.muted, fontSize: 13, textAlign: 'right', marginTop: 3 },
  drawResult: { minHeight: 190, padding: 20, borderRadius: 22, backgroundColor: C.line },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 }, emptyTitle: { color: C.ink, fontWeight: '700', marginTop: 5 }, muted: { color: C.muted, fontSize: 14 },
  displayToggle: { flexDirection: 'row', minHeight: 52, marginBottom: 14, padding: 4, borderRadius: 14, backgroundColor: C.panel }, bookRow: { gap: 14 }, cover: { flex: 1, height: 205, borderRadius: 18, padding: 18, marginBottom: 14, overflow: 'hidden', justifyContent: 'space-between' }, spine: { position: 'absolute', width: 14, left: 0, top: 0, bottom: 0, backgroundColor: '#00000020' }, coverMeta: { color: '#FFFFFFAA', fontSize: 12, letterSpacing: 1.5 }, coverTitle: { color: '#fff', fontSize: 18, lineHeight: 26, fontWeight: '700' }, coverAuthor: { color: '#FFFFFFBB', fontSize: 12 }, coverCount: { color: '#fff', fontWeight: '800', marginTop: 5 }, spineBook: { minHeight: 76, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }, spineBookBody: { flex: 1, gap: 4 }, spineBookTitle: { color: '#fff', fontSize: 16, lineHeight: 23, fontWeight: '800' }, spineBookAuthor: { color: '#FFFFFFCC', fontSize: 13 }, spineBookCount: { color: '#fff', fontSize: 16, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, backgroundColor: C.panel, borderRadius: 17, padding: 13, alignItems: 'center' }, statLabel: { fontSize: 12, color: C.muted, fontWeight: '700' }, statValue: { fontSize: 26, color: C.ink, fontWeight: '900', marginTop: 4 }, section: { backgroundColor: C.panel, borderRadius: 22, padding: 16, gap: 11 }, sectionTitle: { color: C.muted, fontSize: 13, letterSpacing: 1, fontWeight: '800', borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 10 }, rank: { flexDirection: 'row', justifyContent: 'space-between' }, rankName: { color: C.ink, fontSize: 15, fontWeight: '600' }, rankCount: { color: C.accent, fontSize: 14, fontWeight: '800' }, palette: { height: 16, flexDirection: 'row', borderRadius: 8, overflow: 'hidden' }, paletteItem: { height: '100%' }, insight: { color: C.ink, fontSize: 16, lineHeight: 25 },
  label: { color: C.ink, fontSize: 14, fontWeight: '700', marginTop: 3, marginBottom: 7 }, segment: { flexDirection: 'row', backgroundColor: C.bg, padding: 4, borderRadius: 12 }, choice: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, choiceActive: { backgroundColor: C.ink }, choiceText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  themeList: { gap: 8 }, themeChoice: { minHeight: 58, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 12 }, themeChoiceActive: { borderColor: C.accent }, themeSwatches: { width: 76, height: 28, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' }, themeSwatch: { flex: 1 }, themeName: { flex: 1, color: C.ink, fontSize: 15, fontWeight: '700' },
  button: { minHeight: 46, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, button_dark: { backgroundColor: C.ink }, button_light: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line }, button_danger: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.danger }, buttonText: { fontSize: 15, fontWeight: '800' }, white: { color: C.bg }, ink: { color: C.ink }, danger: { color: C.danger }, pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  about: { backgroundColor: C.panel, borderRadius: 22, padding: 20, alignItems: 'center' }, aboutTitle: { color: C.ink, fontWeight: '800' }, aboutText: { color: C.muted, textAlign: 'center', fontSize: 14, lineHeight: 22, marginTop: 10, maxWidth: 280 },
  fab: { position: 'absolute', right: 23, bottom: 82, width: 58, height: 58, borderRadius: 29, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: C.ink, shadowOpacity: .25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  nav: { height: 66, flexDirection: 'row', backgroundColor: C.bg }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'transparent' }, sheetAvoider: { flex: 1, justifyContent: 'flex-end' }, sheet: { maxHeight: '92%', backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22 }, form: { gap: 15, paddingBottom: 20 }, input: { minHeight: 48, backgroundColor: C.panel, color: C.ink, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, borderWidth: 1, borderColor: C.line }, textarea: { minHeight: 120, paddingTop: 14 }, colors: { flexDirection: 'row', gap: 14, marginBottom: 8 }, color: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, colorActive: { borderWidth: 3, borderColor: C.bg, outlineWidth: 2, outlineColor: C.accent }, filterList: { gap: 8 }, filterRow: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: C.panel, flexDirection: 'row', alignItems: 'center', gap: 10 }, filterTitle: { flex: 1, color: C.ink, fontSize: 16, fontWeight: '600' }, filterCount: { color: C.muted, fontSize: 13, fontWeight: '700' },
}); }
