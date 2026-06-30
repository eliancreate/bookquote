# Passage 拾句 觸覺回饋清單

觸覺回饋由 `expo-haptics` 提供，集中定義在 `App.tsx` 的 `haptic` helper。只在狀態改變、主要操作與結果確認時觸發，避免一般瀏覽產生過度震動。

| 位置 | 時機 | 回饋 |
|---|---|---|
| 底部導航 | 切換到不同分頁 | Selection |
| 主題與主題配色 | 選擇不同主題、語意色或色票 | Selection |
| 主要按鈕漸層 | 切換編輯中的漸層色點 | Selection |
| 搜尋與書籍篩選 | 展開工具／切換書籍 | Light impact／Selection |
| 書櫃 | 切換展示方式／開啟一本書 | Selection |
| 書摘卡片 | 左滑展開或右滑收回完成 | Light impact |
| 書摘卡片 | 點擊編輯 | Light impact |
| 書摘卡片 | 點擊刪除 | Warning notification |
| 新增書摘 FAB | 開啟新增表單 | Medium impact |
| 首頁抽卡 | 點擊右上「抽一張」並揭曉書摘 | Medium impact |
| 一般按鈕 | 點擊主要或次要按鈕 | Light impact |
| 儲存書摘 | 資料有效並完成儲存 | Success notification |
| 儲存書摘 | 必填資料缺漏 | Error notification |
| 匯入備份 | 匯入成功／格式錯誤 | Success／Error notification |
| 匯出備份 | 複製完成 | Success notification |
| 恢復預設／清空資料 | 使用者確認執行 | Warning notification |

## 使用原則

- 不對搜尋輸入、選色器連續滑動、捲動、返回、關閉視窗或重複點擊目前選項提供回饋。
- 手勢只在卡片的開啟狀態實際改變時震動，不隨拖曳距離連續觸發。
- Web 與不支援觸覺回饋的裝置維持正常功能，不以震動作為唯一提示。
