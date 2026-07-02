import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Alert, Animated, Image, NativeScrollEvent, NativeSyntheticEvent,
  Platform, Pressable, Text, TextInput, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ACTION_GRADIENTS, BookFilter, Books, Dashboard, DrawReveal, DrawShimmer, Editor,
  Home, ImportModal, makeT, NotesPage, NoteEditor, PATTERNS, Settings, storage,
  THEMES, ThemeContext, createStyles, defaultExcerpts, deviceLang, haptic, isDark,
  NAV_TABS, todayKey, translucentGradient, useTheme,
} from './ui';
import type { ActionGradients, Excerpt, Lang, Note, Tab, ThemeName } from './ui';

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
    setItems(await storage.load('linekeep_excerpts', defaultExcerpts()));
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
    <StatusBar style={isDark(C.bg) ? 'light' : 'dark'} backgroundColor={C.bg} />
    {texture && <Image source={{ uri: PATTERNS[texture] }} resizeMode="repeat" tintColor={C.ink} style={s.texture} />}
    {Platform.OS === 'android' && <View pointerEvents="none" style={[s.statusBarGuard, { height: insets.top }]} />}
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
        onRestore={() => Alert.alert(t('恢復預設'), t('目前書摘將被覆蓋。'), [{ text: t('取消') }, { text: t('恢復'), onPress: () => { haptic.warning(); commit(defaultExcerpts()); } }])}
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
