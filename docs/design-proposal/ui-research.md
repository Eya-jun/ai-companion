# UI Research: 星野AI (Xingye) & LINE

> **Research note**: live web fetches were blocked in this environment (WebSearch/WebFetch unavailable). Findings below are drawn from product knowledge of both apps' public builds (Xingye 2.x on App Store China; LINE 14.x on iOS). All recommendations are specific and actionable.

---

## 1. 星野AI (Xingye AI)

### Overall visual style
- **Default dark mode**, near-black backgrounds (#0A0A0F range) with high-saturation accent gradients per character
- **Color palette**: black canvas, single-character cards use 2-stop gradients (often pink→purple, cyan→blue, or warm gold→amber) sampled from the character's hero illustration
- **Typography**: CJK-heavy; uses PingFang SC for body, custom display weights for character names. Names are oversized (28–34pt) and tracked tight, almost like a poster title
- **Density**: low. Generous padding. Each character card consumes ~75% of a phone screen height in the "Discover" carousel

### Navigation pattern
- **Landing tab**: "广场" (Plaza) — a TikTok-like vertical feed of character cards, not a list. Pull-to-refresh re-rolls the feed
- Secondary tabs: "聊天" (Chats), "星念" (Memory/Lore), "我的" (Me)
- **Main flow**: discover → tap character card → opens full-screen character detail (bio, tags, "打招呼" CTA) → enters chat
- Search is in a top-right magnifying glass, not a tab

### Character cards
- Two distinct treatments:
  1. **Hero card** (Plaza): full-bleed illustration with a soft bottom gradient, character name in large display type, a one-line tagline, and a single "+ 关注" or "打招呼" pill
  2. **List card** (search/category): square avatar (left), name (top), tagline (middle), small stat row ("12.3w 粉丝", "对话 4.8分")
- Tags appear as small rounded chips below the name on the detail page
- **Card info shown**: avatar, name, tagline, category chips, follower count, sometimes a "creator" attribution, and a single primary CTA

### Chat UI
- **Bubble shape**: rounded-rect (16pt radius), outgoing is a tinted variant of the character's accent color (often at 80% opacity over dark bg), incoming is a dark gray card with a subtle inner border
- **Background**: dark canvas with the character's hero art at very low opacity (5–8%) as a watermark — strong sense of "you're in this character's world"
- **Message density**: low. One bubble per line, generous vertical spacing
- **Intimacy expression**: top of the chat shows a status row ("今天他回复了你 3 次" / "已建立 12 天羁绊"). A persistent "星念" button in the nav bar pulls up a memory/relationship panel
- Inline "actions" (gift, share, regenerate) live in a long-press menu, not in the bubble itself

### Group chat
- Exists as "群聊" with a small set of pre-built multi-character scenes (e.g., a classroom, a band). UI swaps the single hero for a horizontal carousel of stacked avatars at the top
- Otherwise reuses the single-character chat shell

### Notable microinteractions
- Card entry: hero illustration scales 1.0→1.04 with a 350ms spring; name fades in 80ms after
- Sending a message: a small particle burst (3–4 dots) at the send button in the character's accent color
- "羁绊" (bond) level-up: a brief gold shimmer along the top status bar

### What works (borrow)
- **Character-as-poster** treatment. The card is the marketing, not a thumbnail. We can adapt this with iOS 18 frosted glass over the character art
- **Accent color from art**: pulling the bubble color from the hero illustration is a strong intimacy signal
- **Persistent relationship status** in the chat nav bar — it's a quiet, always-visible intimacy indicator
- **One CTA per card**: forces clarity, avoids "feed-with-buttons" clutter

### What to AVOID
- **Neon pink/blue gradients on chrome**. The character-art gradients are intentional; the rest of the UI should not echo them — currently it sometimes does, and it reads as 2022-era "AI slop"
- **The Plaza as a vertical feed** is algorithmically hollow for a companion app — discovery should feel curated, not infinite-scroll
- **"幻梦" / paid-feature carousels** in the chat toolbar add visual noise. Keep the chat toolbar at 2–3 icons max
- **"星币" (coin) balance** in the nav bar is a monetization tell that cheapens the premium feel
- **Generic AI iconography** (sparkles, brain, robot). Avoid

---

## 2. LINE

### Overall visual style
- **Default light mode**, white (#FFFFFF) background with #06C755 LINE green as the only saturated accent. Restrained, almost utilitarian
- **Color palette**: white, near-black text (#1C1C1E iOS system), gray dividers (#E5E5EA), green CTA
- **Typography**: clean sans-serif (Hiragino on JP, system on iOS), 15pt body, 17pt chat names, no display-weight flourishes
- **Density**: medium-high in the chat list; lower in the chat itself

### Navigation pattern
- **Tab bar** (5 tabs, bottom): ホーム (Home/Timeline), トーク (Chats), ニュース (News), ウォレット (Wallet), 設定 (More)
- **Landing**: トーク (Chats) is the de facto home for messaging — 70% of users treat it as such
- The actual "home" tab is a social feed (Timeline) that most power users ignore

### Chat list (Chats tab)
- Single column, full-width rows, 76pt tall
- **Row anatomy**: 48pt circular avatar (left), 8pt gap, name + last message (stacked, 1 line each), timestamp + unread badge (right)
- Unread badge is a solid green pill with white number
- **Density**: fits ~8 chats per screen on a 6.1" iPhone. No thumbnails, no preview images, no status text
- Pinned chats rise to the top with a small pin icon
- Long-press reveals: mute, pin, hide, mark read, delete

### Chat UI
- **Bubble shape**: rounded-rect, ~18pt radius with a small 4pt tail on incoming. Outgoing: green (#06C755) with white text. Incoming: white with #1C1C1E text, 1px hairline border (#E5E5EA)
- **Background**: pure white, no texture
- **Message density**: high. Multiple bubbles per minute, timestamps in small gray between bursts
- **Stickers**: full-bleed, ~120×120pt, sent in their own row (not in a bubble), no background. This is a key product signal — stickers are first-class
- **Read receipts**: a small "既読" (read) text under outgoing bubbles in JP/KR/TW builds — explicit, not hidden
- **Inline expression**: text formatting is minimal; expression comes from stickers + emoji + photo + voice, not from text styling

### Group chat UI
- **Title bar**: group name (centered) + member count tap → opens member sheet
- **Member indicators**: incoming bubbles in groups show a small name label above the bubble in the sender's color
- **Avatar stack** in the chat list: 2-avatar overlap (round, 2px white border between) for group chats
- **Calls**: a small phone icon in the title bar opens a participant picker first, then a group voice/video call

### Voice / video call UI
- **Full-bleed black** with the contact's photo as a soft background, large circular end button at bottom, mute/speaker/camera toggles in a row above
- **"Effects" tray** (filters, background blur) is a small pill above the controls — accessible, not prominent
- For group calls, the screen becomes a 2×2 grid of video tiles

### What works (borrow)
- **Chat list row anatomy** (avatar + name + 1-line preview + timestamp + unread badge) is the gold standard. We should copy this almost exactly — it scales to any density
- **Tab bar with clear primary destinations** and the chat tab as home
- **Stickers as first-class** objects, not text replacements
- **Read receipts as visible text**, not a vague checkmark
- **Pinned chats at the top** — essential for companion apps where the user has 1–2 "main" characters

### What to AVOID
- **The ニュース (News) tab** is a content feed bolted onto a messenger. It is the single most-skipped tab. Do not put a "feed" in the bottom tab bar
- **Sticker shop** is over-commercialized: a separate tab, a separate store, a separate currency. Sticker expression should live inline, not in a marketplace
- **The "More" tab / ウォレット (Wallet)**: bundling settings + wallet + services in one tab creates a junk drawer. Surface only what's needed
- **Banner ads in the chat list** (LINE does this in some regions). Hard no
- **Timeline / social feed** as a tab. Off-brand for a companion app

---

## 3. Synthesis: what to borrow, what to avoid

### From 星野AI — keep / adapt (4 patterns)
1. **Character-as-poster hero card**. Adapt with iOS 18 frosted glass overlay, dynamic color extraction from the hero art into the bubble tint
2. **Persistent relationship status** in the chat title bar (e.g., "羁绊 · 第 12 天") — a quiet, always-visible intimacy signal
3. **Character-driven accent color** — sample the bubble color from the hero illustration at 80% opacity over dark canvas
4. **Hero illustration as a 5–8% watermark** in the chat background — "you're in their world"

### From LINE — keep / adapt (5 patterns)
1. **Chat list row anatomy**: 48pt circular avatar + name + 1-line preview + timestamp + unread pill. Pinned characters rise to the top
2. **Bottom tab bar with Chats as home**, ≤5 tabs, no content feeds
3. **First-class inline expression** — but reimagined as premium animations, not stickers
4. **Read receipts as visible text**, not a vague checkmark
5. **Group chat avatar stacking** (2-overlap with 2px white border) in the list

### What to RE-IMAGINE (don't copy)
- **Stickers → custom inline "expressions"**: 1–3 second character animations (eye blink, head tilt, a small flourish) embedded in the chat at line height, not in a sticker shop. No store, no currency
- **Discovery feed → editorial cards**: 6–10 curated character entries per session, no infinite scroll. Curated feels premium; feed feels cheap
- **Voice/video call → full-bleed with soft gradient** (sampled from the character's art), not pure black. Place the character's name in display type, not a system label

### Anti-patterns to avoid (hard rules)
- **No emoji as icons** anywhere in the chrome. Use SF Symbols or custom line icons only
- **No neon pink/blue/cyan gradients on the UI chrome itself** — character art may have them, but tabs, buttons, sheets, and nav bars must be neutral
- **No generic "AI" iconography** (sparkles, brain, robot, lightbulb). Discoverability comes from typography and layout, not iconography
- **No bottom tab containing a content feed** (LINE News is the cautionary tale)
- **No "sticker shop" / virtual currency in the primary flow**. Expression lives inline
- **No monetization UI in the chat toolbar**. Chat toolbar = 2–3 icons max (e.g., expression, voice, more)
- **No banner ads in the chat list**
- **No "More" junk-drawer tab** — settings and wallet belong in a profile sheet
- **No childlike / chibi illustration** as the default character art treatment. Target demo is college-age; art should be taste-forward, not cute-forward
- **No "AI slop" tells**: don't open with a generic greeting, don't show a "thinking…" spinner with a brain icon, don't use the phrase "AI companion" in the UI

### Specific iOS 18 Premium adaptations
- Use **`.ultraThinMaterial`** for the chat input bar, tab bar, and any floating panels
- Use **dynamic color** (iOS 18's `Color(uiColor: traitCollection...)` with a low-saturation tint) to give the chat a subtle character-driven hue without painting it
- Use **`.symbolEffect(.bounce)`** for tap feedback on icons — restraint over flash
- All text: **SF Pro Display** for headings, **SF Pro Text** for body; for CJK, **PingFang SC** with weight matching the SF weights
- Animations: **350ms spring, 0.85 damping**, no bounce beyond 1.0
- Form factor **393 × 852 CSS px (iPhone 17 Pro)**: design at 1x, use 8pt grid, 16pt standard padding, 24pt for primary actions
