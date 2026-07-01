import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Alert, Animated, FlatList, KeyboardAvoidingView, Modal, NativeModules, PanResponder, Platform, Pressable,
  Image, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Excerpt = { id: string; quote: string; bookTitle: string; author: string; coverColor: string; createdAt: number };
type Note = { id: string; quote: string; bookTitle: string; author: string; note: string; createdAt: number };
type Tab = 'home' | 'books' | 'dashboard' | 'settings';
const NAV_TABS: Tab[] = ['home', 'books', 'dashboard'];
type ThemeName = 'minimal' | 'garden' | 'midnight' | 'sunlight';
type ThemeColors = { bg: string; panel: string; navOn: string; navOff: string; ink: string; muted: string; accent: string; danger: string; line: string };
type GradientColors = [string, string, string];
type ActionGradients = { fab: GradientColors; draw: GradientColors };

// ponytail: tiny 24px PNG tiles, tiled via Image resizeMode="repeat" + tintColor — no svg/image deps
const PATTERNS = {
  dots: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAHklEQVR42mNgGAWjYBSMAuqC/0hg1IJRMApGwVACAAumI91QKiASAAAAAElFTkSuQmCC',
  grid: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAJElEQVR42mP4T2PAACZoCUYtGLVg1IJRC0YtGLVg1IJRC6gCAJUbu0WcFZuQAAAAAElFTkSuQmCC',
  diag: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAALElEQVR42mP4DwQMeACl8gy0NByv/Kjho4YPEsNH88Go4aOGj+aDUcOHiuEAuAAe8LLsdKkAAAAASUVORK5CYII=',
};
const THEMES: Record<ThemeName, { label: string; colors: ThemeColors; texture?: keyof typeof PATTERNS }> = {
  minimal: { label: '極簡配色', colors: { bg: '#F1F2F3', panel: '#FAFAF8', navOn: '#718E9E', navOff: '#767B78', ink: '#252725', muted: '#606061', accent: '#74D6FD', danger: '#C55252', line: '#DFE1DE' } },
  garden: { label: '花園藤椅', colors: { bg: '#DDCEB3', panel: '#FFFFFF', navOn: '#8E954C', navOff: '#667264', ink: '#301F1F', muted: '#0D5437', accent: '#B3BD4F', danger: '#A45244', line: '#C9C5B8' }, texture: 'dots' },
  midnight: { label: '午夜霓虹', colors: { bg: '#09090C', panel: '#1A2127', navOn: '#CEE218', navOff: '#1988A7', ink: '#CECDDC', muted: '#1992A7', accent: '#D30CB1', danger: '#D3310C', line: '#1F2126' }, texture: 'diag' },
  sunlight: { label: '日光閃爍', colors: { bg: '#DDE5E6', panel: '#FDFDFC', navOn: '#EC930D', navOff: '#728CA4', ink: '#32779B', muted: '#EC930D', accent: '#DA8210', danger: '#E86E49', line: '#7BC7E0' }, texture: 'grid' },
};
type Lang = 'zh' | 'en';
// ponytail: zh strings ARE the keys — only the EN map exists; t() returns the key verbatim for zh. Missing key falls back to the zh text.
const EN: Record<string, string> = {
  '搜尋書摘': 'Search excerpts', '篩選書籍': 'Filter books', '搜尋書名、作者或句子': 'Search title, author, or quote', '關閉搜尋': 'Close search', '抽書籤': 'Draw', '新增書摘': 'Add excerpt',
  '沒有找到任何書摘': 'No excerpts found', '點擊右下角新增一筆吧': 'Tap the button to add one', '長按可拖動排序': 'Long-press to reorder',
  '關閉': 'Close', '收起卡片': 'Close card', '翻開卡片': 'Flip card', '輕觸揭曉': 'Tap to reveal', '分享': 'Share', '寫下心得': 'Write a note', '再玩一次': 'Draw again', '靜心，與一句話相遇': 'Be still, and meet a sentence',
  '編輯書摘': 'Edit excerpt', '刪除書摘': 'Delete excerpt', '書背展示': 'Spine view', '書封展示': 'Cover view',
  '書摘總數': 'Excerpts', '精選藏書': 'Books', '涉及作家': 'Authors', '心頭好書籍 · TOP 3': 'Favorite books · TOP 3', '條': 'entries', '尚無書籍分類': 'No books yet', '閱讀色彩美學偏好': 'Color palette preference', '最長摘錄金句': 'Longest excerpt', '字': 'chars',
  '抽牌心得': 'Draw notes', '查看我的心得': 'View my notes', '介面配色': 'Theme',
  '資料備份與匯入': 'Backup & import', '備份至剪貼簿': 'Copy backup to clipboard', '從備份匯入': 'Import from backup', '系統維護與重置': 'Maintenance & reset', '恢復預設經典書摘': 'Restore default excerpts', '清空所有書摘': 'Clear all excerpts',
  '收藏曾與你相遇的句子，讓值得重讀的片刻，再次回到日常。': 'Keep the sentences you have met, and let moments worth rereading return to daily life.', '語言': 'Language',
  '此刻的心得': 'Your thoughts', '這句話讓你想到什麼？': 'What does this sentence remind you of?', '儲存心得': 'Save note', '我的抽牌心得': 'My draw notes', '刪除心得': 'Delete note', '還沒有任何心得': 'No notes yet', '抽一張卡片，寫下你的感受': 'Draw a card and write how you feel',
  '配色': 'Colors', '先選擇要調整的項目，變更會立即套用並保存。': 'Pick an item to adjust; changes apply and save instantly.', '精準選色': 'Precise color', '吸取目前配色': 'Pick from current palette', '顏色': 'color', '輸入色號': 'Enter hex', 'HEX 色號': 'HEX code',
  '背景': 'Background', '面板': 'Panel', '導航圖示(選中)': 'Nav icon (active)', '導航圖示(未選)': 'Nav icon (inactive)', '主要文字': 'Primary text', '次要文字': 'Secondary text', '強調': 'Accent', '警示': 'Alert', '分隔線': 'Divider',
  '漸層': 'Gradient', '選擇色點': 'Pick a stop', '漸層色': 'Gradient color', '極簡配色': 'Minimal', '花園藤椅': 'Garden', '午夜霓虹': 'Midnight', '日光閃爍': 'Sunlight',
  '編輯經典書摘': 'Edit excerpt', '記錄一刻觸動': 'Capture a moment', '書摘內容': 'Excerpt', '寫下觸動你的句子…': 'Write the sentence that moved you…', '書名': 'Book title', '例如：月亮與六便士': 'e.g. The Moon and Sixpence', '作者': 'Author', '例如：威廉·薩默塞特·毛姆': 'e.g. W. Somerset Maugham', '儲存經典': 'Save',
  '資料未完整': 'Incomplete', '請填寫書摘內容與書名。': 'Please fill in the excerpt and book title.', '佚名': 'Unknown',
  'JSON 備份資料': 'JSON backup data', '在此貼上備份內容…': 'Paste backup content here…', '匯入書摘': 'Import excerpts', '篩選書摘': 'Filter excerpts', '可複選，只顯示所選書籍的書摘。': 'Select multiple; only excerpts from chosen books are shown.', '尚無書籍': 'No books', '新增書摘後即可篩選': 'Add excerpts to enable filtering', '清除全部': 'Clear all', '完成': 'Done',
  '設定': 'Settings', '正在整理書頁…': 'Preparing the pages…',
  '此操作無法復原。': 'This cannot be undone.', '取消': 'Cancel', '刪除': 'Delete', '無法匯入': 'Import failed', '請確認貼上的是有效的書摘 JSON 陣列。': 'Make sure you pasted a valid excerpt JSON array.', '新增書摘後會自動生成書籍': 'Books are generated from your excerpts', '飽和度與明度選色區': 'Saturation and brightness picker', '色相選擇條': 'Hue slider', '恢復預設': 'Restore defaults', '目前書摘將被覆蓋。': 'Current excerpts will be overwritten.', '恢復': 'Restore', '清空': 'Clear', '備份完成': 'Backup complete', 'JSON 已複製到剪貼簿。': 'JSON copied to clipboard.',
};
// ponytail: read device locale from RN NativeModules — no expo-localization dep. Swap to expo-localization if more locales/region logic is needed.
const deviceLang = (): Lang => {
  const sm = NativeModules.SettingsManager?.settings;
  const locale: string = sm?.AppleLocale || sm?.AppleLanguages?.[0] || NativeModules.I18nManager?.localeIdentifier || '';
  return /^zh/i.test(locale) ? 'zh' : 'en';
};
const makeT = (lang: Lang) => (key: string) => lang === 'en' ? (EN[key] ?? key) : key;
const ThemeContext = React.createContext<{ colors: ThemeColors; styles: ReturnType<typeof createStyles>; t: (key: string) => string; lang: Lang } | null>(null);
const useTheme = () => { const value = React.useContext(ThemeContext); if (!value) throw Error('ThemeProvider missing'); return value; };
const COLORS = ['#8DA6B5', '#252725', '#D9A05B', '#6D8E7D', '#A88174'];
const ACTION_GRADIENTS: ActionGradients = {
  fab: ['#57CD42', '#71C66A', '#D2E268'],
  draw: ['#BCEAC1', '#A0E49C', '#EDF684'],
};
const translucentGradient = (colors: GradientColors): GradientColors => colors.map(color => `${color}B3`) as GradientColors;
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
const todayKey = () => { const date = new Date(); return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; };

function Button({ title, onPress, tone = 'dark', icon, feedback = true }: { title: string; onPress: () => void; tone?: 'dark' | 'light' | 'danger'; icon?: string; feedback?: boolean }) {
  const { colors: C, styles: s } = useTheme();
  return <Pressable accessibilityRole="button" onPress={() => { if (feedback) haptic.light(); onPress(); }} style={({ pressed }) => [s.button, s.softSurface, s[`button_${tone}`], pressed && s.pressed]}>
    {icon && <Icon name={icon as never} size={16} color={tone === 'dark' ? C.bg : tone === 'danger' ? C.danger : C.ink} />}
    <Text style={[s.buttonText, tone === 'dark' ? s.white : tone === 'danger' ? s.danger : s.ink]}>{title}</Text>
  </Pressable>;
}

export default function App() {
  const [theme, setTheme] = useState<ThemeName>('minimal');
  const [lang, setLangState] = useState<Lang>(deviceLang);
  useEffect(() => { storage.load<ThemeName>('linekeep_theme', 'minimal').then(saved => setTheme(THEMES[saved] ? saved : 'minimal')); storage.load<Lang | null>('passage_lang', null).then(saved => saved && setLangState(saved)); }, []);
  const setLang = (next: Lang) => { setLangState(next); storage.save('passage_lang', next); };
  const colors = THEMES[theme].colors;
  const value = useMemo(() => ({ colors, styles: createStyles(colors), t: makeT(lang), lang }), [colors, lang]);
  return <ThemeContext.Provider value={value}><SafeAreaProvider><Main theme={theme} gradients={ACTION_GRADIENTS} lang={lang} setLang={setLang} setTheme={next => { setTheme(next); storage.save('linekeep_theme', next); }} /></SafeAreaProvider></ThemeContext.Provider>;
}

function Main({ theme, gradients, lang, setLang, setTheme }: { theme: ThemeName; gradients: ActionGradients; lang: Lang; setLang: (next: Lang) => void; setTheme: (theme: ThemeName) => void }) {
  const { colors: C, styles: s, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Excerpt[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookFilters, setBookFilters] = useState<string[]>([]);
  const [filtering, setFiltering] = useState(false);
  const [featured, setFeatured] = useState<Excerpt | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDraft, setNoteDraft] = useState<Excerpt | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [editing, setEditing] = useState<Excerpt | null | undefined>();
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [hasDrawnToday, setHasDrawnToday] = useState(false);
  const navMotion = useRef(new Animated.Value(0)).current;
  const navIndex = useRef(new Animated.Value(0)).current;
  const [navW, setNavW] = useState(0);
  const navHidden = useRef(false); const scrollAnchor = useRef(0);

  useEffect(() => { (async () => {
    setItems(await storage.load('linekeep_excerpts', INITIAL));
    setNotes(await storage.load('linekeep_notes', []));
    setHasDrawnToday(await storage.load('passage_last_draw_date', '') === todayKey());
    setReady(true);
  })(); }, []);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion); return () => subscription.remove(); }, []);
  useEffect(() => { const i = NAV_TABS.indexOf(tab); if (i < 0) return; Animated.spring(navIndex, { toValue: i, useNativeDriver: true, speed: 18, bounciness: 8 }).start(); }, [tab, navIndex]);
  const commit = (next: Excerpt[]) => { setItems(next); storage.save('linekeep_excerpts', next); };
  const commitNotes = (next: Note[]) => { setNotes(next); storage.save('linekeep_notes', next); };

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

  const remove = (item: Excerpt) => Alert.alert(t('刪除書摘'), t('此操作無法復原。'), [
    { text: t('取消'), style: 'cancel' }, { text: t('刪除'), style: 'destructive', onPress: () => commit(items.filter(x => x.id !== item.id)) },
  ]);
  const draw = () => { haptic.medium(); setFeatured(filtered[Math.floor(Math.random() * filtered.length)]); setHasDrawnToday(true); storage.save('passage_last_draw_date', todayKey()); };
  const setNavVisible = (visible: boolean) => { if (navHidden.current === !visible) return; navHidden.current = !visible; Animated.timing(navMotion, { toValue: visible ? 0 : 1, duration: reduceMotion ? 0 : 180, useNativeDriver: true }).start(); };
  const onContentScroll = ({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }: NativeSyntheticEvent<NativeScrollEvent>) => { const y = contentOffset.y; if (y < 8 || y + layoutMeasurement.height >= contentSize.height - 8) { scrollAnchor.current = y; setNavVisible(true); return; } const distance = y - scrollAnchor.current; if (Math.abs(distance) < 12) return; setNavVisible(distance < 0); scrollAnchor.current = y; };

  if (!ready) return <SafeAreaView style={s.screen}><Text style={s.loading}>{t('正在整理書頁…')}</Text></SafeAreaView>;
  const texture = THEMES[theme].texture;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
    <StatusBar style={isDark(C.bg) ? 'light' : 'dark'} />
    {texture && <Image source={{ uri: PATTERNS[texture] }} resizeMode="repeat" tintColor={C.ink} style={s.texture} />}
    <View style={s.header}>
      <Pressable onPress={() => { setTab('home'); setBookFilters([]); setSearch(''); scrollAnchor.current = 0; setNavVisible(true); }}><Text style={s.logo}>Passage</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('設定')} accessibilityState={{ selected: tab === 'settings' }} onPress={() => { if (tab !== 'settings') haptic.select(); setTab('settings'); setSearch(''); setSearchOpen(false); scrollAnchor.current = 0; setNavVisible(true); }} style={s.headerIcon}><Icon name={tab === 'settings' ? 'cog' : 'cog-outline'} size={23} color={C.ink} /></Pressable>
    </View>

    {tab === 'home' && <View style={s.homeTools}>
      {!searchOpen && <View style={s.homeToolsRight}>
        <Pressable accessibilityLabel={t('搜尋書摘')} onPress={() => { haptic.light(); setSearchOpen(true); }} style={s.iconButton}><Icon name="magnify" size={21} color={C.muted} /></Pressable>
        <Pressable accessibilityLabel={t('篩選書籍')} onPress={() => { haptic.light(); setFiltering(true); }} style={[s.iconButton, !!bookFilters.length && s.iconButtonActive]}><Icon name="filter-variant" size={21} color={bookFilters.length ? C.ink : C.muted} />{!!bookFilters.length && <Text style={s.filterBadge}>{bookFilters.length}</Text>}</Pressable>
      </View>}
      {searchOpen
        ? <View style={s.headerSearch}><Icon name="magnify" size={20} color={C.muted} /><TextInput autoFocus value={search} onChangeText={setSearch} placeholder={t('搜尋書名、作者或句子')} placeholderTextColor={C.muted} style={s.searchInput} /><Pressable accessibilityLabel={t('關閉搜尋')} onPress={() => { setSearch(''); setSearchOpen(false); }} style={s.searchClose}><Icon name="close" size={18} color={C.muted} /></Pressable></View>
        : <Pressable accessibilityRole="button" accessibilityLabel={t('抽書籤')} accessibilityState={{ disabled: !filtered.length }} disabled={!filtered.length} onPress={() => { draw(); setRevealing(true); }} style={({ pressed }) => [s.drawButtonShell, { shadowColor: gradients.draw[1] }, !filtered.length && s.disabled, pressed && s.pressed]}><LinearGradient colors={gradients.draw} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.drawButton}><DrawShimmer active={!hasDrawnToday && !!filtered.length} reduceMotion={reduceMotion} /><Icon name="creation" size={19} color={isDark(gradients.draw[1]) ? '#fff' : '#252725'} /><Text style={[s.drawButtonText, { color: isDark(gradients.draw[1]) ? '#fff' : '#252725' }]}>{t('抽書籤')}</Text></LinearGradient></Pressable>}
    </View>}

    <View style={s.content}>
      {tab === 'home' && <Home items={filtered} reorderable={!search.trim() && !bookFilters.length} onReorder={commit} onScroll={onContentScroll} onEdit={setEditing} onDelete={remove} />}
      {tab === 'books' && <Books books={books} onScroll={onContentScroll} onSelect={title => { setBookFilters([title]); setTab('home'); scrollAnchor.current = 0; setNavVisible(true); }} />}
      {tab === 'dashboard' && <Dashboard items={items} books={books} onScroll={onContentScroll} />}
      {tab === 'settings' && <Settings theme={theme} lang={lang} setLang={setLang} onScroll={onContentScroll} setTheme={setTheme}
        notesCount={notes.length} onOpenNotes={() => { haptic.light(); setShowNotes(true); }}
        onExport={async () => { await Clipboard.setStringAsync(JSON.stringify(items, null, 2)); haptic.success(); Alert.alert(t('備份完成'), t('JSON 已複製到剪貼簿。')); }}
        onImport={() => setImporting(true)}
        onRestore={() => Alert.alert(t('恢復預設'), t('目前書摘將被覆蓋。'), [{ text: t('取消') }, { text: t('恢復'), onPress: () => { haptic.warning(); commit(INITIAL); } }])}
        onClear={() => Alert.alert(t('清空所有書摘'), t('此操作無法復原。'), [{ text: t('取消') }, { text: t('清空'), style: 'destructive', onPress: () => { haptic.warning(); commit([]); } }])} />}
    </View>

    {(tab === 'home' || tab === 'books') && <Pressable accessibilityLabel={t('新增書摘')} onPress={() => { haptic.medium(); setEditing(null); }} style={({ pressed }) => [s.fab, { bottom: 90 + insets.bottom, shadowColor: gradients.fab[1] }, pressed && s.pressed]}><BlurView intensity={14} tint={isDark(C.bg) ? 'dark' : 'light'} experimentalBlurMethod="dimezisBlurView" style={s.fabGlass}><LinearGradient colors={translucentGradient(gradients.fab)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fabGradient}><Icon name="plus" size={26} color={isDark(gradients.fab[1]) ? '#fff' : '#252725'} /></LinearGradient></BlurView></Pressable>}
    <Animated.View style={[s.navShell, { bottom: 12 + insets.bottom, opacity: navMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: navMotion.interpolate({ inputRange: [0, 1], outputRange: [0, 96] }) }] }]}><View style={s.navBackdrop} /><View style={s.navItems} onLayout={e => setNavW(e.nativeEvent.layout.width)}>{navW > 0 && NAV_TABS.includes(tab) && <Animated.View style={[s.navPill, { width: navW / NAV_TABS.length - 20, backgroundColor: '#CCCCCC26', transform: [{ translateX: navIndex.interpolate({ inputRange: [0, NAV_TABS.length - 1], outputRange: [10, 10 + (navW / NAV_TABS.length) * (NAV_TABS.length - 1)] }) }] }]} />}{([
      ['home', 'layers-outline', 'layers'], ['books', 'book-open-page-variant-outline', 'book-open-page-variant'], ['dashboard', 'chart-box-outline', 'chart-box'],
    ] as [Tab, string, string][]).map(([key, outlineIcon, filledIcon]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => { if (tab !== key) haptic.select(); setTab(key); setSearch(''); setSearchOpen(false); scrollAnchor.current = 0; setNavVisible(true); }} style={s.navItem}>
      <Icon name={(tab === key ? filledIcon : outlineIcon) as never} size={25} color={tab === key ? C.navOn : C.navOff} />
    </Pressable>)}</View></Animated.View>

    <DrawReveal visible={revealing} item={featured} onClose={() => setRevealing(false)} onAgain={draw} onWriteNote={it => { setRevealing(false); setNoteDraft(it); }} />
    <NoteEditor excerpt={noteDraft} onClose={() => setNoteDraft(null)} onSave={note => { commitNotes([{ id: String(Date.now()), quote: noteDraft!.quote, bookTitle: noteDraft!.bookTitle, author: noteDraft!.author, note, createdAt: Date.now() }, ...notes]); setNoteDraft(null); }} />
    <NotesPage visible={showNotes} notes={notes} onClose={() => setShowNotes(false)} onDelete={n => Alert.alert(t('刪除心得'), t('此操作無法復原。'), [{ text: t('取消'), style: 'cancel' }, { text: t('刪除'), style: 'destructive', onPress: () => { haptic.warning(); commitNotes(notes.filter(x => x.id !== n.id)); } }])} />
    <Editor visible={editing !== undefined} item={editing ?? null} onClose={() => setEditing(undefined)} onSave={saved => { commit(editing ? items.map(x => x.id === saved.id ? saved : x) : [saved, ...items]); setEditing(undefined); }} />
    <BookFilter visible={filtering} books={books} selected={bookFilters} onToggle={title => { haptic.select(); setBookFilters(current => current.includes(title) ? current.filter(x => x !== title) : [...current, title]); }} onClear={() => setBookFilters([])} onClose={() => setFiltering(false)} />
    <ImportModal visible={importing} value={importText} onChange={setImportText} onClose={() => setImporting(false)} onImport={() => {
      try { const parsed = JSON.parse(importText); if (!Array.isArray(parsed) || !parsed.every(x => typeof x?.quote === 'string' && typeof x?.bookTitle === 'string')) throw Error(); commit(parsed); haptic.success(); setImporting(false); setImportText(''); }
      catch { haptic.error(); Alert.alert(t('無法匯入'), t('請確認貼上的是有效的書摘 JSON 陣列。')); }
    }} />
  </SafeAreaView>;
}

function DrawShimmer({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const { styles: s } = useTheme(); const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!active || reduceMotion) { sweep.stopAnimation(); sweep.setValue(0); return; } const loop = Animated.loop(Animated.sequence([Animated.delay(1800), Animated.timing(sweep, { toValue: 1, duration: 850, useNativeDriver: true }), Animated.delay(4200)])); loop.start(); return () => loop.stop(); }, [active, reduceMotion]);
  if (!active || reduceMotion) return null;
  return <Animated.View pointerEvents="none" style={[s.drawShimmer, { opacity: sweep.interpolate({ inputRange: [0, .08, .8, 1], outputRange: [0, .15, .55, 0] }), transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-90, 180] }) }, { rotate: '18deg' }] }]} />;
}

const FAMILY = Platform.select({ ios: 'Songti TC', android: 'serif' });
const ROW_GAP = 12;

function Home({ items, reorderable, onReorder, onScroll, onEdit, onDelete }: { items: Excerpt[]; reorderable: boolean; onReorder: (next: Excerpt[]) => void; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void; onEdit: (x: Excerpt) => void; onDelete: (x: Excerpt) => void }) {
  const { styles: s, t } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [openId, setOpenId] = useState<string | null>(null);
  const empty = <Empty icon="book-open-blank-variant-outline" title={t('沒有找到任何書摘')} subtitle={t('點擊右下角新增一筆吧')} />;
  if (!reorderable) return <View style={s.flex}><FlatList data={items} keyExtractor={x => x.id} contentContainerStyle={[s.list, s.homeListTop, { paddingBottom: 170 + bottom }]} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll} onScrollBeginDrag={() => setOpenId(null)}
      ListEmptyComponent={empty}
      renderItem={({ item }) => <QuoteCard item={item} fontSize={18} fontFamily={FAMILY} isOpen={openId === item.id} onOpen={open => setOpenId(open ? item.id : null)} onEdit={onEdit} onDelete={onDelete} />} />
  </View>;
  return <View style={s.flex}><DraggableList data={items} openId={openId} setOpenId={setOpenId} onReorder={onReorder} onScroll={onScroll} onEdit={onEdit} onDelete={onDelete} empty={empty} /></View>;
}

// ponytail: hand-rolled long-press drag reorder over a ScrollView — no reanimated/gesture-handler/draggable-flatlist deps. Rows shift by the dragged card's height (approximate when card heights differ); good enough for this list size.
function DraggableList({ data, openId, setOpenId, onReorder, onScroll, onEdit, onDelete, empty }: { data: Excerpt[]; openId: string | null; setOpenId: (id: string | null) => void; onReorder: (next: Excerpt[]) => void; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void; onEdit: (x: Excerpt) => void; onDelete: (x: Excerpt) => void; empty: React.ReactNode }) {
  const { styles: s } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [order, setOrder] = useState(data);
  useEffect(() => { setOrder(data); }, [data]);
  const heights = useRef<Record<string, number>>({});
  const tops = useRef<number[]>([]);
  const originIndex = useRef(0);
  const dragH = useRef(190);
  const hoverRef = useRef(0);
  const dragIdRef = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const start = (id: string) => {
    const idx = order.findIndex(x => x.id === id); if (idx < 0) return;
    originIndex.current = idx; hoverRef.current = idx; dragH.current = heights.current[id] ?? 190;
    let acc = 0; tops.current = order.map(x => { const top = acc; acc += (heights.current[x.id] ?? 190) + ROW_GAP; return top; });
    dragY.setValue(0); dragIdRef.current = id; setDragId(id); setHoverIndex(idx); setScrollEnabled(false); setOpenId(null); haptic.medium();
  };
  const move = (dy: number) => {
    dragY.setValue(dy);
    const center = tops.current[originIndex.current] + dragH.current / 2 + dy;
    let hover = order.length - 1;
    for (let i = 0; i < order.length; i++) { const h = heights.current[order[i].id] ?? 190; if (center < tops.current[i] + h + ROW_GAP) { hover = i; break; } }
    if (hover !== hoverRef.current) { hoverRef.current = hover; setHoverIndex(hover); haptic.select(); }
  };
  const end = () => {
    const from = originIndex.current, to = hoverRef.current;
    dragIdRef.current = null; setDragId(null); setScrollEnabled(true); setHoverIndex(null); dragY.setValue(0);
    if (from !== to) { const next = [...order]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); setOrder(next); onReorder(next); haptic.success(); }
  };
  if (!order.length) return <ScrollView contentContainerStyle={[s.list, s.homeListTop, { paddingBottom: 170 + bottom }]} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll}>{empty}</ScrollView>;
  return <ScrollView style={s.dragList} removeClippedSubviews={false} scrollEnabled={scrollEnabled} contentContainerStyle={[s.list, s.homeListTop, { paddingBottom: 170 + bottom }]} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll} onScrollBeginDrag={() => setOpenId(null)}>
    {order.map((item, index) => <DragRow key={item.id} item={item} index={index} dragId={dragId} originIndex={originIndex.current} hoverIndex={hoverIndex} dragH={dragH.current} dragY={dragY} dragIdRef={dragIdRef} openId={openId} setOpenId={setOpenId} onStart={start} onMove={move} onEnd={end} onEdit={onEdit} onDelete={onDelete} onMeasure={h => { heights.current[item.id] = h; }} />)}
  </ScrollView>;
}

function DragRow({ item, index, dragId, originIndex, hoverIndex, dragH, dragY, dragIdRef, openId, setOpenId, onStart, onMove, onEnd, onEdit, onDelete, onMeasure }: { item: Excerpt; index: number; dragId: string | null; originIndex: number; hoverIndex: number | null; dragH: number; dragY: Animated.Value; dragIdRef: React.MutableRefObject<string | null>; openId: string | null; setOpenId: (id: string | null) => void; onStart: (id: string) => void; onMove: (dy: number) => void; onEnd: () => void; onEdit: (x: Excerpt) => void; onDelete: (x: Excerpt) => void; onMeasure: (h: number) => void }) {
  const offset = useRef(new Animated.Value(0)).current;
  const isDragging = dragId === item.id;
  let target = 0;
  if (dragId && !isDragging && hoverIndex != null) {
    if (originIndex < hoverIndex && index > originIndex && index <= hoverIndex) target = -(dragH + ROW_GAP);
    else if (hoverIndex < originIndex && index >= hoverIndex && index < originIndex) target = dragH + ROW_GAP;
  }
  useEffect(() => { if (!dragId) { offset.setValue(0); return; } Animated.timing(offset, { toValue: target, duration: 140, useNativeDriver: true }).start(); }, [target, dragId, offset]);
  // ponytail: handlers via ref so the PanResponder stays stable — recreating panHandlers mid-drag makes RN terminate the gesture and snap the card back.
  const cb = useRef({ onMove, onEnd });
  cb.current = { onMove, onEnd };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => dragIdRef.current === item.id,
    onPanResponderMove: (_, g) => cb.current.onMove(g.dy),
    onPanResponderRelease: () => cb.current.onEnd(),
    onPanResponderTerminate: () => cb.current.onEnd(),
    onPanResponderTerminationRequest: () => false,
  }), [item.id, dragIdRef]);
  return <Animated.View {...pan.panHandlers} onLayout={e => onMeasure(e.nativeEvent.layout.height)} style={{ zIndex: isDragging ? 10 : 0, transform: isDragging ? [{ translateY: dragY }, { scale: 1.02 }] : [{ translateY: offset }] }}>
    <QuoteCard item={item} fontSize={18} fontFamily={FAMILY} isOpen={openId === item.id} onOpen={open => setOpenId(open ? item.id : null)} onEdit={onEdit} onDelete={onDelete} onLongPress={() => onStart(item.id)} dragging={isDragging} />
  </Animated.View>;
}

function DrawReveal({ visible, item, onClose, onAgain, onWriteNote }: { visible: boolean; item: Excerpt | null; onClose: () => void; onAgain: () => void; onWriteNote: (item: Excerpt) => void }) {
  const { colors: C, styles: s, t } = useTheme();
  const veil = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0.8)).current;
  const flip = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);
  const family = Platform.select({ ios: 'Songti TC', android: 'serif' });

  useEffect(() => {
    if (!visible) return;
    setRevealed(false); veil.setValue(0); enter.setValue(0.8); flip.setValue(0);
    Animated.parallel([
      Animated.timing(veil, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.spring(enter, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1900, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, item?.id]);

  const reveal = () => { if (revealed) return; haptic.success(); setRevealed(true); Animated.spring(flip, { toValue: 1, friction: 8, tension: 38, useNativeDriver: true }).start(); };
  const close = () => Animated.timing(veil, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => onClose());
  const share = () => item && Share.share({ message: `${item.quote.trim()}\n\n—《${item.bookTitle}》${item.author}` }).catch(() => {});

  if (!item) return null;
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [-9, 9] });
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const backOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });
  const quote = item.quote.trim().replace(/^[「『“"]|[」』”"]$/g, '');

  return <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
    <Animated.View style={[s.revealVeil, { opacity: veil }]}>
      <Pressable accessibilityLabel={t('關閉')} onPress={close} style={StyleSheet.absoluteFill} />
      <Animated.View style={{ transform: [{ scale: enter }, { translateY: revealed ? 0 : floatY }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={revealed ? t('收起卡片') : t('翻開卡片')} onPress={revealed ? close : reveal} style={s.revealStage}>
          <Animated.View style={[s.revealCard, { backgroundColor: item.coverColor, opacity: backOpacity, transform: [{ perspective: 1000 }, { rotateY: backRotate }] }]}>
            <Icon name="creation" size={48} color="#FFFFFFD0" />
            <Text style={s.revealHint}>{t('輕觸揭曉')}</Text>
          </Animated.View>
          <Animated.View style={[s.revealCard, s.revealFront, { opacity: frontOpacity, transform: [{ perspective: 1000 }, { rotateY: frontRotate }] }]}>
            <View style={s.revealFrontInner}>
              <View style={s.revealQuoteBody}><Text style={[s.revealQuote, { fontSize: 22, fontFamily: family }]}>{quote}</Text></View>
              <View style={s.quoteFooter}><Text style={s.revealBook}>《{item.bookTitle}》</Text><Text style={s.revealAuthor}>{item.author}</Text></View>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
      {revealed
        ? <View style={s.revealActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('分享')} onPress={() => { haptic.light(); share(); }} style={({ pressed }) => [s.revealAction, pressed && s.pressed]}><Icon name="share-variant" size={22} color="#fff" /><Text style={s.revealActionLabel}>{t('分享')}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('寫下心得')} onPress={() => { haptic.light(); onWriteNote(item); }} style={({ pressed }) => [s.revealAction, pressed && s.pressed]}><Icon name="notebook-edit-outline" size={22} color="#fff" /><Text style={s.revealActionLabel}>{t('寫下心得')}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('再玩一次')} onPress={() => { haptic.medium(); onAgain(); }} style={({ pressed }) => [s.revealAction, pressed && s.pressed]}><Icon name="dice-multiple-outline" size={22} color="#fff" /><Text style={s.revealActionLabel}>{t('再玩一次')}</Text></Pressable>
          </View>
        : <Text style={s.revealFootnote}>{t('靜心，與一句話相遇')}</Text>}
    </Animated.View>
  </Modal>;
}

function QuoteCard({ item, fontSize, fontFamily, isOpen, onOpen, onEdit, onDelete, onLongPress, dragging }: { item: Excerpt; fontSize: number; fontFamily?: string; isOpen: boolean; onOpen: (open: boolean) => void; onEdit: (x: Excerpt) => void; onDelete: (x: Excerpt) => void; onLongPress?: () => void; dragging?: boolean }) {
  const { colors: C, styles: s, t } = useTheme();
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
  return <View style={[s.quoteShell, s.depth, dragging && s.quoteShellDragging]}>
    <View style={s.swipeActions}><Pressable accessibilityLabel={t('編輯書摘')} onPress={event => { event.stopPropagation(); haptic.light(); onEdit(item); }} style={[s.swipeAction, s.editAction]}><Icon name="pencil-outline" size={20} color={C.accent} /></Pressable><Pressable accessibilityLabel={t('刪除書摘')} onPress={event => { event.stopPropagation(); haptic.warning(); onDelete(item); }} style={[s.swipeAction, s.deleteAction]}><Icon name="trash-can-outline" size={20} color={C.danger} /></Pressable></View>
    <Animated.View {...pan.panHandlers} style={[s.quoteCard, { transform: [{ translateX: x }] }]}><Pressable style={s.quoteCardTap} onPress={() => onOpen(false)} onLongPress={onLongPress} delayLongPress={220}><View style={s.quoteBody}><Text selectable={!onLongPress} style={[s.quote, { fontSize, fontFamily }]}>{item.quote.trim().replace(/^[「『“"]|[」』”"]$/g, '')}</Text></View><View style={s.quoteFooter}><Text style={s.bookName}>《{item.bookTitle}》</Text><Text style={s.author}>{item.author}</Text></View></Pressable></Animated.View>
  </View>;
}

function Books({ books, onScroll, onSelect }: { books: { title: string; author: string; color: string; quotes: Excerpt[] }[]; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void; onSelect: (s: string) => void }) {
  const { styles: s, t } = useTheme();
  const [display, setDisplay] = useState<'spine' | 'cover'>('cover');
  return <View style={s.flex}><View style={[s.displayToggle, s.softSurface]}><Choice active={display === 'spine'} title={t('書背展示')} onPress={() => setDisplay('spine')} /><Choice active={display === 'cover'} title={t('書封展示')} onPress={() => setDisplay('cover')} /></View><FlatList key={display} data={books} keyExtractor={x => x.title} numColumns={display === 'cover' ? 2 : 1} columnWrapperStyle={display === 'cover' ? s.bookRow : undefined} contentContainerStyle={s.list} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll}
    ListEmptyComponent={<Empty icon="bookshelf" title={t('尚無書籍')} subtitle={t('新增書摘後會自動生成書籍')} />}
    renderItem={({ item }) => display === 'cover' ? <Pressable onPress={() => { haptic.select(); onSelect(item.title); }} style={({ pressed }) => [s.cover, s.lift, { backgroundColor: item.color }, pressed && s.pressed]}><View style={s.spine} /><Text style={s.coverMeta}>{item.quotes.length} EXCERPTS</Text><Text style={s.coverTitle}>《{item.title}》</Text><View><Text numberOfLines={1} style={s.coverAuthor}>{item.author}</Text><Text style={s.coverCount}>{item.quotes.length}</Text></View></Pressable>
      : <Pressable onPress={() => { haptic.select(); onSelect(item.title); }} style={({ pressed }) => [s.spineBook, s.lift, { backgroundColor: item.color }, pressed && s.pressed]}><View style={s.spineBookBody}><Text style={s.spineBookTitle}>《{item.title}》</Text><Text style={s.spineBookAuthor}>{item.author}</Text></View><Text style={s.spineBookCount}>{item.quotes.length}</Text></Pressable>} /></View>;
}

function Dashboard({ items, books, onScroll }: { items: Excerpt[]; books: { title: string; author: string; color: string; quotes: Excerpt[] }[]; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void }) {
  const { styles: s, t } = useTheme();
  const authors = new Set(items.map(x => x.author)).size;
  const top = [...books].sort((a, b) => b.quotes.length - a.quotes.length).slice(0, 3);
  const longest = items.reduce<Excerpt | null>((a, b) => !a || b.quote.length > a.quote.length ? b : a, null);
  return <ScrollView showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll} contentContainerStyle={s.list}>
    <View style={s.stats}>{([['書摘總數', items.length], ['精選藏書', books.length], ['涉及作家', authors]] as [string, number][]).map(([label, value]) => <View key={label} style={[s.stat, s.softSurface]}><Text style={s.statLabel}>{t(label)}</Text><Text style={s.statValue}>{value}</Text></View>)}</View>
    <Section title={t('心頭好書籍 · TOP 3')}>{top.length ? top.map((b, i) => <View key={b.title} style={s.rank}><Text style={s.rankName}>{i + 1}. 《{b.title}》</Text><Text style={s.rankCount}>{b.quotes.length} {t('條')}</Text></View>) : <Text style={s.muted}>{t('尚無書籍分類')}</Text>}</Section>
    <Section title={t('閱讀色彩美學偏好')}><View style={s.palette}>{COLORS.map(color => <View key={color} style={[s.paletteItem, { backgroundColor: color, flex: Math.max(1, items.filter(x => x.coverColor === color).length) }]} />)}</View></Section>
    {longest && <Section title={t('最長摘錄金句')}><Text style={s.insight}>{longest.quote}</Text><Text style={s.bookName}>——《{longest.bookTitle}》 · {longest.quote.length} {t('字')}</Text></Section>}
  </ScrollView>;
}

function Settings({ theme, notesCount, lang, setLang, onScroll, onOpenNotes, setTheme, onExport, onImport, onRestore, onClear }: { theme: ThemeName; notesCount: number; lang: Lang; setLang: (next: Lang) => void; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void; onOpenNotes: () => void; setTheme: (v: ThemeName) => void; onExport: () => void; onImport: () => void; onRestore: () => void; onClear: () => void }) {
  const { colors: C, styles: s, t } = useTheme();
  const [themeOpen, setThemeOpen] = useState(false);
  return <ScrollView showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll} contentContainerStyle={[s.list, s.settingsList]}>
    <SettingsField label={t('語言')}><View style={s.segment}><Choice active={lang === 'zh'} title="繁體中文" onPress={() => setLang('zh')} /><Choice active={lang === 'en'} title="English" onPress={() => setLang('en')} /></View></SettingsField>
    <Button title={notesCount ? `${t('查看我的心得')} (${notesCount})` : t('查看我的心得')} icon="notebook-outline" tone="light" onPress={onOpenNotes} />
    <View style={s.settingsField}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('介面配色')} accessibilityState={{ expanded: themeOpen }} onPress={() => { haptic.light(); setThemeOpen(open => !open); }} style={s.themeToggle}><Text style={s.themeToggleLabel}>{t('介面配色')}</Text><Text style={s.themeToggleValue}>{t(THEMES[theme].label)}</Text><Icon name={themeOpen ? 'chevron-up' : 'chevron-down'} size={20} color={C.muted} /></Pressable>
      {themeOpen && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.themeList}>{(Object.keys(THEMES) as ThemeName[]).map(key => <ThemeChoice key={key} themeKey={key} active={theme === key} onPress={() => { setTheme(key); setThemeOpen(false); }} />)}</ScrollView>}
    </View>
    <Button title={t('備份至剪貼簿')} icon="content-copy" tone="light" onPress={onExport} />
    <Button title={t('從備份匯入')} icon="tray-arrow-down" tone="light" onPress={onImport} />
    <Button title={t('恢復預設經典書摘')} icon="restore" tone="light" onPress={onRestore} />
    <Button title={t('清空所有書摘')} icon="trash-can-outline" tone="danger" onPress={onClear} />
    <View style={s.about}><Text style={s.aboutTitle}>Passage 拾句</Text><Text style={s.tagline}>WORDS WORTH MEETING AGAIN.</Text><Text style={s.aboutText}>{t('收藏曾與你相遇的句子，讓值得重讀的片刻，再次回到日常。')}</Text></View>
  </ScrollView>;
}

const stripQuote = (q: string) => q.trim().replace(/^[「『“"]|[」』”"]$/g, '');

function NoteEditor({ excerpt, onClose, onSave }: { excerpt: Excerpt | null; onClose: () => void; onSave: (note: string) => void }) {
  const { styles: s, t } = useTheme();
  const [note, setNote] = useState('');
  useEffect(() => { if (excerpt) setNote(''); }, [excerpt]);
  const save = () => { const trimmed = note.trim(); if (!trimmed) return; haptic.success(); onSave(trimmed); };
  return <Sheet visible={!!excerpt} title={t('寫下心得')} onClose={onClose}>
    {excerpt && <View style={s.noteQuote}><Text style={s.noteQuoteText}>{stripQuote(excerpt.quote)}</Text><Text style={s.noteQuoteMeta}>《{excerpt.bookTitle}》{excerpt.author}</Text></View>}
    <Field label={t('此刻的心得')} value={note} onChangeText={setNote} multiline placeholder={t('這句話讓你想到什麼？')} />
    <Button title={t('儲存心得')} feedback={false} onPress={save} />
  </Sheet>;
}

function NotesPage({ visible, notes, onClose, onDelete }: { visible: boolean; notes: Note[]; onClose: () => void; onDelete: (n: Note) => void }) {
  const { colors: C, styles: s, t } = useTheme();
  return <Sheet visible={visible} title={t('我的抽牌心得')} onClose={onClose}>
    {notes.length ? notes.map(n => <View key={n.id} style={[s.noteCard, s.softSurface]}>
      <Text style={s.noteCardQuote}>{stripQuote(n.quote)}</Text>
      <Text style={s.noteCardMeta}>《{n.bookTitle}》{n.author}</Text>
      <Text style={s.noteCardNote}>{n.note}</Text>
      <View style={s.noteCardFoot}><Text style={s.noteCardDate}>{new Date(n.createdAt).toLocaleDateString()}</Text><Pressable accessibilityLabel={t('刪除心得')} hitSlop={8} onPress={() => onDelete(n)}><Icon name="trash-can-outline" size={18} color={C.muted} /></Pressable></View>
    </View>) : <Empty icon="notebook-outline" title={t('還沒有任何心得')} subtitle={t('抽一張卡片，寫下你的感受')} />}
  </Sheet>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { const { styles: s } = useTheme(); return <View style={[s.section, s.softSurface]}><Text style={s.sectionTitle}>{title}</Text>{children}</View>; }
function SettingsField({ label, children }: { label: string; children: React.ReactNode }) { const { styles: s } = useTheme(); return <View style={s.settingsField}><Text style={s.settingsLabel}>{label}</Text>{children}</View>; }
function Choice({ active, title, onPress }: { active: boolean; title: string; onPress: () => void }) { const { styles: s } = useTheme(); return <Pressable onPress={() => { if (!active) haptic.select(); onPress(); }} style={[s.choice, active && s.choiceActive]}><Text style={[s.choiceText, active && s.white]}>{title}</Text></Pressable>; }
function ThemeChoice({ themeKey, active, onPress }: { themeKey: ThemeName; active: boolean; onPress: () => void }) { const { styles: s, t } = useTheme(); const option = THEMES[themeKey]; return <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => { if (!active) haptic.select(); onPress(); }} style={[s.themeChoice, active && s.themeChoiceActive]}><View style={s.themeSwatches}>{Object.values(option.colors).slice(0, 3).map((color, i) => <View key={`${color}-${i}`} style={[s.themeSwatch, { backgroundColor: color }]} />)}</View><Text style={s.themeName}>{t(option.label)}</Text></Pressable>; }
const COLOR_ROLES: { key: keyof ThemeColors; label: string }[] = [{ key: 'bg', label: '背景' }, { key: 'panel', label: '面板' }, { key: 'navOn', label: '導航圖示(選中)' }, { key: 'navOff', label: '導航圖示(未選)' }, { key: 'ink', label: '主要文字' }, { key: 'muted', label: '次要文字' }, { key: 'accent', label: '強調' }, { key: 'danger', label: '警示' }, { key: 'line', label: '分隔線' }];
const validHex = (value: string) => /^#[0-9A-F]{6}$/i.test(value);
const isDark = (color: string) => { const n = Number.parseInt(color.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) < 128000; };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const hsvToHex = (h: number, s: number, v: number) => { const i = Math.floor(h * 6); const f = h * 6 - i; const p = v * (1 - s); const q = v * (1 - f * s); const t = v * (1 - (1 - f) * s); const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]; return `#${[r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase(); };
const hexToHsv = (hex: string) => { const n = Number.parseInt(hex.slice(1), 16); const r = (n >> 16) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255; const max = Math.max(r, g, b); const d = max - Math.min(r, g, b); const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h / 6, s: max === 0 ? 0 : d / max, v: max }; };
if (__DEV__) console.assert(hsvToHex(0, 1, 1) === '#FF0000' && hsvToHex(...Object.values(hexToHsv('#718E9E')) as [number, number, number]) === '#718E9E', 'HSV color conversion failed');

function PrecisionColorPicker({ value, onChange, onComplete }: { value: string; onChange: (color: string) => void; onComplete: (color: string) => void }) {
  const { styles: s, t } = useTheme();
  const initial = hexToHsv(value);
  const [hue, setHue] = useState(initial.h); const [sat, setSat] = useState(initial.s); const [val, setVal] = useState(initial.v);
  const hsv = useRef(initial); const [svWidth, setSvWidth] = useState(1); const [hueWidth, setHueWidth] = useState(1);
  useEffect(() => { const next = hexToHsv(value); hsv.current = next; setHue(next.h); setSat(next.s); setVal(next.v); }, [value]);
  const updateSV = (x: number, y: number, done = false) => { const next = { ...hsv.current, s: clamp(x / svWidth), v: 1 - clamp(y / 180) }; hsv.current = next; setSat(next.s); setVal(next.v); const color = hsvToHex(next.h, next.s, next.v); done ? onComplete(color) : onChange(color); };
  const updateHue = (x: number, done = false) => { const next = { ...hsv.current, h: clamp(x / hueWidth) }; hsv.current = next; setHue(next.h); const color = hsvToHex(next.h, next.s, next.v); done ? onComplete(color) : onChange(color); };
  const svPan = PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderGrant: e => updateSV(e.nativeEvent.locationX, e.nativeEvent.locationY), onPanResponderMove: e => updateSV(e.nativeEvent.locationX, e.nativeEvent.locationY), onPanResponderRelease: e => updateSV(e.nativeEvent.locationX, e.nativeEvent.locationY, true), onPanResponderTerminationRequest: () => false });
  const huePan = PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderGrant: e => updateHue(e.nativeEvent.locationX), onPanResponderMove: e => updateHue(e.nativeEvent.locationX), onPanResponderRelease: e => updateHue(e.nativeEvent.locationX, true), onPanResponderTerminationRequest: () => false });
  return <View style={s.precisionPicker}>
    <View accessibilityLabel={t('飽和度與明度選色區')} onLayout={e => setSvWidth(e.nativeEvent.layout.width)} {...svPan.panHandlers} style={s.svPicker}><View pointerEvents="none" style={StyleSheet.absoluteFill}>{Array.from({ length: 12 }, (_, row) => <View key={row} style={s.pickerStrip}>{Array.from({ length: 12 }, (_, col) => <View key={col} style={[s.pickerPixel, { backgroundColor: hsvToHex(hue, col / 11, 1 - row / 11) }]} />)}</View>)}</View><View pointerEvents="none" style={[s.pickerThumb, { left: `${sat * 100}%`, top: `${(1 - val) * 100}%`, backgroundColor: value }]} /></View>
    <View accessibilityLabel={t('色相選擇條')} onLayout={e => setHueWidth(e.nativeEvent.layout.width)} {...huePan.panHandlers} style={s.huePicker}><View pointerEvents="none" style={s.hueSpectrum}>{Array.from({ length: 24 }, (_, i) => <View key={i} style={[s.huePixel, { backgroundColor: hsvToHex(i / 24, 1, 1) }]} />)}</View><View pointerEvents="none" style={[s.hueThumb, { left: `${hue * 100}%` }]} /></View>
  </View>;
}

function ColorEditor({ themeName, colors, onChange, onClose }: { themeName: ThemeName | null; colors: ThemeColors; onChange: (role: keyof ThemeColors, color: string, persist?: boolean) => void; onClose: () => void }) {
  const { colors: C, styles: s, t } = useTheme();
  const [role, setRole] = useState<keyof ThemeColors>('bg');
  const [hex, setHex] = useState(colors.bg);
  useEffect(() => { if (themeName) { setRole('bg'); setHex(colors.bg); } }, [themeName]);
  useEffect(() => { setHex(colors[role]); }, [colors, role]);
  const choose = (color: string) => { haptic.select(); setHex(color.toUpperCase()); onChange(role, color.toUpperCase()); };
  const typeHex = (value: string) => { const next = `#${value.replace(/[^0-9a-f]/gi, '').slice(0, 6)}`.toUpperCase(); setHex(next); if (validHex(next)) onChange(role, next); };
  return <Sheet visible={!!themeName} title={`${themeName ? t(THEMES[themeName].label) : ''} · ${t('配色')}`} onClose={onClose}>
    <Text style={s.muted}>{t('先選擇要調整的項目，變更會立即套用並保存。')}</Text>
    <View style={s.colorRoles}>{COLOR_ROLES.map(item => <Pressable key={item.key} accessibilityRole="radio" accessibilityState={{ selected: role === item.key }} onPress={() => { setRole(item.key); haptic.select(); }} style={[s.colorRole, role === item.key && s.colorRoleActive]}><View style={[s.colorDot, { backgroundColor: colors[item.key] }]} /><Text style={[s.colorRoleText, role === item.key && s.colorRoleTextActive]}>{t(item.label)}</Text></Pressable>)}</View>
    <Text style={s.label}>{t('精準選色')}</Text><PrecisionColorPicker value={colors[role]} onChange={color => { setHex(color); onChange(role, color, false); }} onComplete={color => { setHex(color); onChange(role, color); }} />
    <Text style={s.label}>{t('吸取目前配色')}</Text><View style={s.pickerGrid}>{COLOR_ROLES.map(item => <Pressable key={item.key} accessibilityLabel={t(item.label)} onPress={() => choose(colors[item.key])} style={[s.pickerColor, { backgroundColor: colors[item.key] }]}><Icon name="eyedropper-variant" size={16} color={C.bg} /></Pressable>)}</View>
    <Text style={s.label}>{t('輸入色號')}</Text><View style={s.hexRow}><View style={[s.hexPreview, { backgroundColor: validHex(hex) ? hex : colors[role] }]} /><TextInput accessibilityLabel={t('HEX 色號')} autoCapitalize="characters" autoCorrect={false} maxLength={7} value={hex} onChangeText={typeHex} onEndEditing={() => setHex(colors[role])} placeholder="#RRGGBB" placeholderTextColor={C.muted} style={s.hexInput} /></View>
  </Sheet>;
}
function Empty({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) { const { colors: C, styles: s } = useTheme(); return <View style={s.empty}><Icon name={icon as never} size={28} color={C.accent} /><Text style={s.emptyTitle}>{title}</Text><Text style={s.muted}>{subtitle}</Text></View>; }

function Editor({ visible, item, onClose, onSave }: { visible: boolean; item: Excerpt | null; onClose: () => void; onSave: (x: Excerpt) => void }) {
  const { t } = useTheme();
  const [quote, setQuote] = useState(''); const [title, setTitle] = useState(''); const [author, setAuthor] = useState('');
  useEffect(() => { if (visible) { setQuote(item?.quote ?? ''); setTitle(item?.bookTitle ?? ''); setAuthor(item?.author ?? ''); } }, [visible, item]);
  const save = () => { if (!quote.trim() || !title.trim()) { haptic.error(); return Alert.alert(t('資料未完整'), t('請填寫書摘內容與書名。')); } haptic.success(); onSave({ id: item?.id ?? Date.now().toString(), quote: quote.trim(), bookTitle: title.trim(), author: author.trim() || t('佚名'), coverColor: item?.coverColor ?? COLORS[0], createdAt: item?.createdAt ?? Date.now() }); };
  return <Sheet visible={visible} tall title={item ? t('編輯經典書摘') : t('記錄一刻觸動')} onClose={onClose}><Field label={t('書摘內容')} value={quote} onChangeText={setQuote} multiline placeholder={t('寫下觸動你的句子…')} /><Field label={t('書名')} value={title} onChangeText={setTitle} placeholder={t('例如：月亮與六便士')} /><Field label={t('作者')} value={author} onChangeText={setAuthor} placeholder={t('例如：威廉·薩默塞特·毛姆')} /><Button title={t('儲存經典')} feedback={false} onPress={save} /></Sheet>;
}
function ImportModal({ visible, value, onChange, onClose, onImport }: { visible: boolean; value: string; onChange: (v: string) => void; onClose: () => void; onImport: () => void }) { const { t } = useTheme(); return <Sheet visible={visible} title={t('從備份匯入')} onClose={onClose}><Field label={t('JSON 備份資料')} value={value} onChangeText={onChange} multiline placeholder={t('在此貼上備份內容…')} /><Button title={t('匯入書摘')} feedback={false} onPress={onImport} /></Sheet>; }
function BookFilter({ visible, books, selected, onToggle, onClear, onClose }: { visible: boolean; books: { title: string; quotes: Excerpt[] }[]; selected: string[]; onToggle: (title: string) => void; onClear: () => void; onClose: () => void }) { const { colors: C, styles: s, t } = useTheme(); return <Sheet visible={visible} title={t('篩選書摘')} onClose={onClose}><Text style={s.muted}>{t('可複選，只顯示所選書籍的書摘。')}</Text><View style={s.filterList}>{books.length ? books.map(book => { const active = selected.includes(book.title); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: active }} key={book.title} onPress={() => onToggle(book.title)} style={s.filterRow}><Icon name={active ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={23} color={active ? C.accent : C.muted} /><Text numberOfLines={2} style={s.filterTitle}>《{book.title}》</Text><Text style={s.filterCount}>{book.quotes.length}</Text></Pressable>; }) : <Empty icon="bookshelf" title={t('尚無書籍')} subtitle={t('新增書摘後即可篩選')} />}</View>{!!selected.length && <Button title={t('清除全部')} tone="light" onPress={onClear} />}<Button title={t('完成')} onPress={onClose} /></Sheet>; }
function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) { const { colors: C, styles: s } = useTheme(); const { label, multiline, ...input } = props; return <View><Text style={s.label}>{label}</Text><TextInput {...input} multiline={multiline} textAlignVertical="top" placeholderTextColor={C.muted} style={[s.input, multiline && s.textarea]} /></View>; }
function Sheet({ visible, tall = false, title, onClose, children }: { visible: boolean; tall?: boolean; title: string; onClose: () => void; children: React.ReactNode }) { const { colors: C, styles: s, t } = useTheme(); return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><SafeAreaProvider><SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={s.overlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? tall ? 'height' : 'padding' : undefined} style={s.sheetAvoider}><View style={[s.sheet, tall && s.sheetTall]}><View style={s.titleRow}><Text style={s.title}>{title}</Text><Pressable accessibilityLabel={t('關閉')} onPress={onClose} style={s.iconButton}><Icon name="close" size={20} color={C.muted} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>{children}</ScrollView></View></KeyboardAvoidingView></SafeAreaView></SafeAreaProvider></Modal>; }

function createStyles(C: ThemeColors) {
  const depth = { shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 6 }, elevation: 0 } as const;
  const lift = { shadowColor: C.ink, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 } as const;
  const softSurface = { shadowColor: C.ink, shadowOpacity: 0.02, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 0 } as const;
  return StyleSheet.create({
  depth, lift, softSurface,
  screen: { flex: 1, backgroundColor: C.bg }, texture: { ...StyleSheet.absoluteFillObject, opacity: 0.14, pointerEvents: 'none' }, flex: { flex: 1 }, loading: { margin: 'auto', color: C.muted },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 34, fontWeight: '600', fontStyle: 'italic', fontFamily: Platform.select({ ios: 'Baskerville', android: 'serif' }), color: C.ink, letterSpacing: -0.4 }, tagline: { color: C.muted, textAlign: 'center', fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginTop: 8 },
  drawButtonShell: { minWidth: 116, minHeight: 44, borderRadius: 14, shadowOpacity: .16, shadowRadius: 11, shadowOffset: { width: 0, height: 0 }, elevation: 3 }, drawButton: { minHeight: 44, borderRadius: 14, overflow: 'hidden', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, drawShimmer: { position: 'absolute', top: -22, bottom: -22, width: 28, backgroundColor: '#FFFFFFCC' }, drawButtonText: { fontSize: 15, fontWeight: '600' }, disabled: { opacity: .4 }, homeTools: { minHeight: 52, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, homeToolsRight: { flexDirection: 'row', alignItems: 'center', gap: 8 }, headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, iconButton: { ...softSurface, width: 44, height: 44, borderRadius: 22, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' }, iconButtonActive: { backgroundColor: C.line }, filterBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, overflow: 'hidden', backgroundColor: C.accent, color: C.bg, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  headerSearch: { flex: 1, minWidth: 0, minHeight: 44, paddingLeft: 13, borderRadius: 16, backgroundColor: C.panel, flexDirection: 'row', alignItems: 'center' }, searchInput: { flex: 1, minWidth: 0, color: C.ink, paddingHorizontal: 10, fontSize: 16 }, searchClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20 }, dragList: { overflow: 'visible' }, homeListTop: { paddingTop: 12 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { fontSize: 21, fontWeight: '800', color: C.ink, marginBottom: 12 }, list: { paddingBottom: 110, gap: 12 },
  quoteShell: { borderRadius: 22, overflow: 'hidden', backgroundColor: C.panel }, quoteShellDragging: { shadowColor: C.ink, shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 }, swipeActions: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 112, flexDirection: 'row' }, swipeAction: { flex: 1, alignItems: 'center', justifyContent: 'center' }, editAction: { backgroundColor: C.line }, deleteAction: { backgroundColor: C.panel }, quoteCard: { minHeight: 190, padding: 20, borderRadius: 22, backgroundColor: C.panel }, quoteCardTap: { flex: 1 }, quoteBody: { flexGrow: 1, justifyContent: 'center', paddingVertical: 14 }, quote: { color: C.ink, lineHeight: 31, fontWeight: '500', textAlign: 'center' }, quoteFooter: { alignItems: 'flex-end' }, bookName: { color: C.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' }, author: { color: C.muted, fontSize: 13, textAlign: 'right', marginTop: 3 },
  revealVeil: { flex: 1, backgroundColor: 'rgba(9,11,19,0.94)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  revealStage: { width: 300, height: 416 },
  revealCard: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, padding: 26, alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden', shadowColor: C.ink, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  revealFront: { backgroundColor: C.panel }, revealFrontInner: { flex: 1, width: '100%', justifyContent: 'space-between' },
  revealHint: { color: '#FFFFFFD0', fontSize: 15, fontWeight: '700', letterSpacing: 4, marginTop: 20 },
  revealQuoteBody: { flexGrow: 1, justifyContent: 'center', paddingVertical: 12 }, revealQuote: { color: C.ink, lineHeight: 38, fontWeight: '500', textAlign: 'center' },
  revealBook: { color: C.ink, fontSize: 15, fontWeight: '800', textAlign: 'right' }, revealAuthor: { color: C.muted, fontSize: 13, textAlign: 'right', marginTop: 3 },
  revealFootnote: { position: 'absolute', bottom: 56, color: '#FFFFFF99', fontSize: 13, letterSpacing: 2 },
  revealActions: { position: 'absolute', bottom: 48, flexDirection: 'row', gap: 26 }, revealAction: { alignItems: 'center', gap: 7 }, revealActionLabel: { color: '#FFFFFFDD', fontSize: 13, fontWeight: '700' },
  noteQuote: { padding: 16, borderRadius: 16, backgroundColor: C.panel, borderLeftWidth: 3, borderLeftColor: C.accent }, noteQuoteText: { color: C.ink, fontSize: 16, lineHeight: 26, fontWeight: '500' }, noteQuoteMeta: { color: C.muted, fontSize: 13, marginTop: 8 },
  noteCard: { padding: 18, borderRadius: 18, backgroundColor: C.panel, gap: 6 }, noteCardQuote: { color: C.ink, fontSize: 15, lineHeight: 24, fontWeight: '600' }, noteCardMeta: { color: C.muted, fontSize: 12 }, noteCardNote: { color: C.ink, fontSize: 15, lineHeight: 24, marginTop: 6 }, noteCardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }, noteCardDate: { color: C.muted, fontSize: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 }, emptyTitle: { color: C.ink, fontWeight: '700', marginTop: 5 }, muted: { color: C.muted, fontSize: 14 },
  displayToggle: { flexDirection: 'row', minHeight: 52, marginBottom: 14, padding: 4, borderRadius: 14, backgroundColor: C.panel }, bookRow: { gap: 14 }, cover: { flex: 1, height: 205, borderRadius: 18, padding: 18, marginBottom: 14, overflow: 'hidden', justifyContent: 'space-between', borderWidth: 1, borderColor: C.line }, spine: { position: 'absolute', width: 14, left: 0, top: 0, bottom: 0, backgroundColor: '#00000020' }, coverMeta: { color: '#FFFFFFAA', fontSize: 12, letterSpacing: 1.5 }, coverTitle: { color: '#fff', fontSize: 18, lineHeight: 26, fontWeight: '700' }, coverAuthor: { color: '#FFFFFFBB', fontSize: 12 }, coverCount: { color: '#fff', fontWeight: '800', marginTop: 5 }, spineBook: { minHeight: 76, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line }, spineBookBody: { flex: 1, gap: 4 }, spineBookTitle: { color: '#fff', fontSize: 16, lineHeight: 23, fontWeight: '800' }, spineBookAuthor: { color: '#FFFFFFCC', fontSize: 13 }, spineBookCount: { color: '#fff', fontSize: 16, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, backgroundColor: C.panel, borderRadius: 17, padding: 13, alignItems: 'center' }, statLabel: { fontSize: 12, color: C.muted, fontWeight: '700' }, statValue: { fontSize: 26, color: C.ink, fontWeight: '700', marginTop: 4 }, section: { backgroundColor: C.panel, borderRadius: 22, padding: 16, gap: 11 }, sectionTitle: { color: C.muted, fontSize: 13, letterSpacing: 1, fontWeight: '700', paddingBottom: 4 }, rank: { flexDirection: 'row', justifyContent: 'space-between' }, rankName: { color: C.ink, fontSize: 15, fontWeight: '600' }, rankCount: { color: C.accent, fontSize: 14, fontWeight: '700' }, palette: { height: 16, flexDirection: 'row', borderRadius: 8, overflow: 'hidden' }, paletteItem: { height: '100%' }, insight: { color: C.ink, fontSize: 16, lineHeight: 25 },
  label: { color: C.ink, fontSize: 14, fontWeight: '700', marginTop: 3, marginBottom: 7 }, settingsList: { gap: 10 }, settingsField: { gap: 8, paddingVertical: 6 }, settingsLabel: { color: C.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1 }, themeToggle: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.panel, flexDirection: 'row', alignItems: 'center', gap: 10 }, themeToggleLabel: { flex: 1, color: C.ink, fontSize: 15, fontWeight: '700' }, themeToggleValue: { color: C.muted, fontSize: 14 }, segment: { flexDirection: 'row', backgroundColor: C.panel, padding: 4, borderRadius: 12 }, choice: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, choiceActive: { backgroundColor: C.ink }, choiceText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  themeList: { flexDirection: 'row', gap: 8, paddingRight: 4 }, themeChoice: { width: 124, minHeight: 116, padding: 10, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', backgroundColor: C.panel, alignItems: 'center', justifyContent: 'space-between', gap: 10 }, themeChoiceActive: { borderColor: C.ink }, themeSwatches: { width: '100%', height: 62, borderRadius: 10, overflow: 'hidden', flexDirection: 'row' }, themeSwatch: { flex: 1 }, themeName: { color: C.ink, fontSize: 14, fontWeight: '700', textAlign: 'center' }, themeEdit: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel },
  colorRoles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, colorRole: { minHeight: 44, paddingHorizontal: 11, borderRadius: 12, backgroundColor: C.panel, flexDirection: 'row', alignItems: 'center', gap: 7 }, colorRoleActive: { backgroundColor: C.line }, colorRoleText: { color: C.muted, fontSize: 13, fontWeight: '700' }, colorRoleTextActive: { color: C.ink }, colorDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: C.line }, precisionPicker: { gap: 12 }, svPicker: { height: 180, borderRadius: 14, overflow: 'hidden' }, pickerStrip: { flex: 1, flexDirection: 'row' }, pickerPixel: { flex: 1 }, pickerThumb: { position: 'absolute', width: 20, height: 20, marginLeft: -10, marginTop: -10, borderRadius: 10, borderWidth: 3, borderColor: '#fff' }, huePicker: { height: 44, borderRadius: 12, overflow: 'hidden' }, hueSpectrum: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' }, huePixel: { flex: 1 }, hueThumb: { position: 'absolute', top: 0, bottom: 0, width: 4, marginLeft: -2, backgroundColor: '#fff', borderWidth: 1, borderColor: '#252725' }, pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, pickerColor: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, hexRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }, hexPreview: { width: 48, height: 48, borderRadius: 14 }, hexInput: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  button: { minHeight: 46, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, button_dark: { backgroundColor: C.ink }, button_light: { backgroundColor: C.panel }, button_danger: { backgroundColor: C.panel }, buttonText: { fontSize: 15, fontWeight: '800' }, white: { color: C.bg }, ink: { color: C.ink }, danger: { color: C.danger }, pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  about: { paddingVertical: 24, alignItems: 'center' }, aboutTitle: { color: C.ink, fontWeight: '800' }, aboutText: { color: C.muted, textAlign: 'center', fontSize: 14, lineHeight: 22, marginTop: 10, maxWidth: 280 },
  fab: { position: 'absolute', right: 23, bottom: 82, width: 58, height: 58, borderRadius: 29, elevation: 3, shadowOpacity: .16, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }, fabGlass: { flex: 1, width: '100%', borderRadius: 29, overflow: 'hidden' }, fabGradient: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  navShell: { position: 'absolute', zIndex: 10, alignSelf: 'center', width: '60%', maxWidth: 300, height: 62, borderRadius: 31, shadowColor: '#07111C', shadowOpacity: isDark(C.bg) ? .1 : .035, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }, navBackdrop: { ...StyleSheet.absoluteFillObject, borderRadius: 31, backgroundColor: C.panel }, navItems: { flex: 1, flexDirection: 'row' }, navItem: { flex: 1, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, navPill: { position: 'absolute', top: 9, bottom: 9, left: 0, borderRadius: 22 },
  overlay: { flex: 1, backgroundColor: 'transparent' }, sheetAvoider: { flex: 1, justifyContent: 'flex-end' }, sheet: { maxHeight: '92%', backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, shadowColor: '#07111C', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 24 }, sheetTall: { height: '96%', maxHeight: '96%' }, form: { gap: 15, paddingBottom: 20 }, input: { minHeight: 48, backgroundColor: C.panel, color: C.ink, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, borderWidth: 1, borderColor: C.line }, textarea: { minHeight: 120, paddingTop: 14 }, filterList: { gap: 8 }, filterRow: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: C.panel, flexDirection: 'row', alignItems: 'center', gap: 10 }, filterTitle: { flex: 1, color: C.ink, fontSize: 16, fontWeight: '600' }, filterCount: { color: C.muted, fontSize: 13, fontWeight: '700' },
  });
}
