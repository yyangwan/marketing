# Storyboard — ContentOS Product Demo

**Format:** 1920×1080
**Audio:** Chinese Mandarin TTS voiceover
**VO direction:** Mid-age professional, calm confident delivery. Modern tech company tone — clear, efficient, warm authority. Not sales-y.
**Style basis:** DESIGN.md — light canvas, indigo accent, Geist typography, clean SaaS aesthetic

**Rhythm:** slow-BUILD-BUILD-PEAK-breathe-resolve-CTA (7 beats, ~45s)

**Global guardrails:**
- Light canvas throughout (`#F9FAFB` base). Never flip to dark — make light cinematic with texture, strong borders, oversized type, and structural elements.
- Indigo `#4F46E5` is the hero color. Use at full saturation for focal elements, 15-25% for atmospheric glows.
- Every beat must have background texture (subtle dot grid, noise, gradient wash), midground content, and foreground accents (data labels, registration marks, monospace metadata).
- 2-3 techniques per beat from techniques.md. No two consecutive beats should share the same primary technique.

**Underscore:** Minimal electronic. Warm sustained pad, never competing with VO. Subtle rhythmic pulse in the workflow beat. Swells gently during the platform reveal. Resolves on a clean final chord.

---

## Asset Audit

| Asset | Type | Assign to Beat | Role |
|-------|------|----------------|------|
| scroll-000.png | Screenshot (kanban) | Beat 3 | Reference for UI recreation |
| No downloaded images — all assets are UI-based | — | All | Build UI elements from captured tokens + source code |
| Geist font family | Font | All | Primary typography |
| Geist Mono font family | Font | All | Labels, badges, metadata |
| `#4F46E5` indigo | Color | All | Brand accent |
| Platform names (微信/微博/小红书/抖音) | Text | Beat 4 | Platform showcase |
| Workflow stages (10 columns) | Data | Beat 3 | Kanban visualization |

**Utilization note:** This is a SaaS dashboard with no hero photography — the visual identity is defined by UI patterns. All compositions will be built from code-based UI recreations using captured design tokens.

---

## BEAT 1 — HOOK (0.10–3.29s, duration: 3.19s)

**VO:** "你的内容团队，值得更好的工作流。"

**Concept:** A single provocative question hangs in space. The word "工作流" (workflow) is the visual anchor — oversized, indigo, alive. Behind it, a faint grid of kanban columns drifts like an architectural blueprint. The viewer immediately understands: this is about process, and it's about to get redefined.

**Mood:** Cinematic title sequence. The kind of opening where you lean forward. Think Apple keynote minimal — one element, maximum impact.

**Visual:** Light canvas `#F9FAFB` with a subtle dot grid pattern (2px dots at 8% opacity, 40px spacing) providing texture. The word "工作流" appears center-frame at 140px, weight 700, color `#4F46E5` — it SLAMS in from below with a slight rotation (-3° → 0°), opacity 0→1, 0.6s, power3.out. A thin horizontal rule (2px, `#4F46E5`, 40% width) draws itself left-to-right beneath the word. In the background, ghost kanban columns (thin vertical lines at 4% opacity, evenly spaced) drift slowly upward at different speeds — parallax depth.

**Camera:** Slight zoom in, scale 1.0 → 1.03 over 4s, power1.inOut.

**Animation choreography:**
- "工作流" — SLAMS from y:80, rotate -3°, opacity 0 → y:0, rotate 0°, opacity 1 (0.6s, power3.out)
- Horizontal rule — DRAWS from scaleX:0 to scaleX:1 (0.4s, power2.out, delay 0.3s)
- Ghost columns — FLOAT upward at 3-8px/s, different speeds for parallax
- Subtle indigo radial glow (25% opacity) pulses gently behind the word

**Techniques:** SVG path drawing (rule), CSS 3D transforms (slight rotate on text entry)

**Transition OUT:** Velocity-matched upward — y:-150, blur:30px, 0.33s power2.in

**SFX:** Deep warm bass note on the SLAM. Faint ambient hum from the ghost columns.

---

## BEAT 2 — BRAND INTRO (3.24–7.69s, duration: 4.45s)

**VO:** "ContentOS，一站式 AI 内容营销平台。"

**Concept:** The brand name materializes with authority. "ContentOS" in oversized Geist at the golden ratio point. Below it, the tagline types on character by character. This is the "who we are" moment — confident, not flashy.

**Mood:** Warm workspace. Nice notebook energy, not technical blueprint. Think Notion's calm confidence.

**Visual:** Same light canvas with a diagonal gradient wash — top-left corner a soft indigo glow (radial, `#4F46E5` at 12% opacity, 600px radius) fading to the neutral `#F9FAFB`. "ContentOS" at 96px, weight 800, `#111827`, positioned at left 8%, top 30%. The "OS" portion in `#4F46E5` for brand emphasis. Below it, "一站式 AI 内容营销平台" types on at 60ms per character using a typewriter effect, 32px, weight 400, `#6B7280`. A small "v1.0" monospace label (18px, Geist Mono, `#4F46E5`, 60% opacity) sits top-right as a registration mark. A thin 2px indigo vertical line anchors the left edge from top to bottom.

**Camera:** Static. Clean hold. Let the typography breathe.

**Animation choreography:**
- "ContentOS" — FADES in + slight rise, y:24→0, opacity 0→1 (0.8s, power2.out)
- "OS" letters — subtle scale pulse to 102% and back (0.3s, power2.inOut, delay 0.5s)
- Tagline — TYPES ON character by character (60ms/char, starting at 0.6s)
- Vertical line — DRAWS from height:0 to height:100% (1.0s, power2.out, delay 0.2s)
- Corner glow — PULSES gently, opacity 10%→16%→10% (4s cycle)

**Techniques:** Typing effect (tagline), CSS decorative elements (vertical line, corner glow)

**Transition IN:** Velocity-matched from below — y:150→0, blur:30px→0, 1.0s power2.out
**Transition OUT:** Whip pan right — x:-400, blur:24px, 0.3s power3.in

**SFX:** Clean electronic chime on brand name appearance. Typewriter click on each tagline character.

---

## BEAT 3 — THE WORKFLOW (7.69–14.34s, duration: 6.65s)

**VO:** "从创意简报到 AI 生成，从人工精修到客户审核，十步流程一目了然。"

**Concept:** The kanban board comes alive. Ten columns sweep in from left to right in a cascading stagger, each one lighting up with its stage name and a subtle content card. This is the hero visualization — the product's DNA. The columns form a horizontal river of workflow stages, each with a unique accent dot (indigo for AI stages, green for approved, amber for scheduled). An animated connector line draws itself between stages, showing the flow.

**Mood:** Geometric, rhythmic, precise. The board is a living machine — each column a station on an assembly line. Think Bauhaus grid meets modern dashboard.

**Visual:** Full-width kanban recreation. Light `#F9FAFB` background with faint horizontal rules every 80px (2px, `#E5E7EB`, 20% opacity). Ten columns cascade in with staggered 0.15s delays. Each column: 160px wide, white card (`#FFFFFF`, 2px border `#E5E7EB`, 8px border-radius), header with stage name in Geist 16px weight 600 `#111827`, small count badge top-right (Geist Mono 14px, `#4F46E5`), and 1-2 mock content cards inside (white, 1px border, small text). Columns from left to right: AI草稿 (indigo dot), Genie生成 (indigo), 人工编辑 (gray), 客户审核 (amber), 需修改 (red), 已批准 (green), 已排期 (amber), 发布中 (blue), 发布失败 (red), 已发布 (green). A glowing SVG connector line draws itself along the bottom of the columns, left to right — the flow visualization. A large semi-transparent "10" (120px, `#4F46E5` at 8% opacity) sits bottom-right as a background watermark.

**Camera:** Slow horizontal drift right, x:0→60px over 6s, power1.inOut. Slight zoom, scale 1.0→1.02.

**Animation choreography:**
- Columns — CASCADE in from y:40, opacity 0, staggered 0.15s, each 0.5s power2.out
- Content cards within columns — SLIDE UP from y:20, opacity 0, staggered 0.1s within each column
- Connector SVG — DRAWS itself left to right, strokeDashoffset animation (0.8s, power2.inOut, starts after last column lands)
- Stage dots — PULSE on appearance, scale 0→1.3→1 (0.4s, power2.out)
- Background "10" — FADES in slowly, opacity 0→8%

**Techniques:** SVG path drawing (connector line), CSS stagger animations (columns)

**Transition IN:** Whip pan from left — x:400→0, blur:24px→0, 0.3s power3.out
**Transition OUT:** Zoom through — scale 1→1.2, blur:20px, 0.2s power3.in

**SFX:** Soft percussive hit on each column landing (ascending pitch). Warm sustained pad rises. Flowing water ambience under the connector line drawing.

---

## BEAT 4 — PLATFORM POWER (14.34–24.40s, duration: 10.06s)

**Concept:** Four platforms explode outward from center — WeChat, Weibo, Xiaohongshu, Douyin — each in its signature color, each with a mock content preview floating beside it. The AI quality analysis panel appears: a radar chart with four axes (质量, 互动, 品牌, 平台) that animates from 0 to scored values. The message: AI doesn't just generate — it evaluates and optimizes for each platform.

**VO:** "支持微信、微博、小红书、抖音四大平台。AI 匹配你的品牌语调，实时分析内容质量与 SEO 表现。"

**Mood:** Vibrant, dynamic. The canvas stays light but gets colorful — platform identity colors add energy. Think tech product reveal with data visualization energy.

**Visual:** Split frame — left 55%, right 45%. Left side: four platform cards arranged in a 2×2 grid. Each card: white background, 3px left border in platform color (WeChat `#07C160`, Weibo `#E6162D`, Xiaohongshu `#FE2C55`, Douyin `#161823`), platform name in 24px weight 700, and a small mock content preview (2-3 lines of placeholder Chinese text in 14px `#6B7280`). Cards scale up from 0.85 with staggered 0.2s delays. Right side: a quality radar chart (SVG polygon) with four axes — 内容质量, 互动预测, 品牌匹配, 平台适配. The chart fills from 0% to target scores (8.5, 7.2, 9.1, 8.8) with smooth animation. An "SEO 评分: 92" counter COUNTS UP from 0 to 92 at the bottom. Background: subtle indigo radial glow at center (15% opacity) where the four platforms diverge.

**Camera:** Static hold, slight drift right (x:0→20px, 8s).

**Animation choreography:**
- Platform cards — SCALE UP from 0.85 + FADE, staggered 0.2s, 0.6s power2.out
- Radar chart — FILLS from center outward, SVG path animation (1.5s, power2.out, starts at 0.5s)
- Score numbers — COUNT UP from 0 to target (1.0s each, staggered 0.3s)
- "SEO 评分" — COUNTER animates from 0→92 (1.0s, power1.out, starts at 1.5s)
- Platform borders — DRAW from height:0 to height:100% (0.4s each)

**Techniques:** SVG path drawing (radar chart), counter animation (score numbers)

**Transition IN:** Zoom through — scale 0.85→1, blur:20px→0, 0.5s expo.out
**Transition OUT:** Blur through — blur:20px, 0.3s

**SFX:** Each platform card landing gets a crisp, distinct note (four-note ascending chord). Radar chart fill has a gentle "data processing" hum. Counter gets a satisfying tick at each decade (10, 20, 30...).

---

## BEAT 5 — PUBLISH & DATA (24.40–26.84s, duration: 2.44s)

**VO:** "一键发布，数据驱动。"

**Concept:** Quick-hit beat. A single "发布" (Publish) button SLAMS center-frame, then the screen dissolves into an analytics dashboard. Three big stat cards appear with counter animations. Energy spike — the video's percussion hit.

**Mood:** Percussive, confident. The "we shipped it" moment. Think product launch keynote number reveal.

**Visual:** Starts with a large indigo "发布" button centered — pill shape, `#4F46E5` fill, white text 64px, 2px subtle glow. It PUNCHES in from scale:0→1.1→1 (0.4s, back.out). Hold 0.5s. Then the entire frame SMASH CUTS to an analytics view: three stat cards in a row. Card 1: "128" (large 80px, `#111827`) + "总内容" label (20px, `#6B7280`). Card 2: "8.6" + "平均质量" with a small upward arrow `#16A34A`. Card 3: "94%" + "发布成功率" with a small checkmark. Cards have white backgrounds, 3px border-radius, subtle indigo top-border (2px, `#4F46E5`). A small trend line (SVG polyline) animates beneath card 2.

**Camera:** Static.

**Animation choreography:**
- Button — PUNCHES in, scale 0→1.1→1 (0.4s, back.out)
- Smash cut — hard cut at 1.2s
- Stat cards — CASCADE in from y:30, staggered 0.15s, 0.4s power2.out
- Numbers — COUNT UP from 0 to final value (0.8s, power1.out)
- Trend line — DRAWS left to right (0.5s, power2.out)

**Techniques:** Counter animation (stats), SVG path drawing (trend line)

**Transition IN:** Hard cut (following zoom-out from Beat 4)
**Transition OUT:** Velocity-matched upward — y:-150, blur:30px, 0.33s power2.in

**SFX:** Satisfying "click" on the button. Sharp percussive hit on the smash cut. Counter ticks.

---

## BEAT 6 — TEAM COLLABORATION (26.84–29.34s, duration: 2.50s)

**VO:** "团队协作，高效交付。"

**Concept:** A top-down view of a collaboration workspace. Multiple user avatars arranged in a circle with connection lines between them, suggesting teamwork. A content card floats in the center, passing from one avatar to the next — each "touch" leaves a small quality badge. The message: multiple people, one seamless flow.

**Mood:** Warm, human. The technology serves the team, not the other way. Think Figma collaboration energy — shared cursors, live presence.

**Visual:** Light canvas with a faint circular dashed border (200px radius, 2px, `#E5E7EB`). Four avatar circles at cardinal positions (top, right, bottom, left), each a 48px circle with initials: "策划" (indigo bg), "编辑" (green bg), "审核" (amber bg), "发布" (blue bg). Connection lines (SVG, `#4F46E5` at 15% opacity) draw between adjacent avatars. Center: a floating content card (white, 200×120px, 2px shadow, slight rotation 2°) with mock title and quality score badge. Small "进行中" pulse indicator (indigo dot, 8px, pulsing opacity 40%→100%→40%, 2s cycle). A monospace "4 人协作 · 实时同步" label bottom-center, 18px, `#6B7280`.

**Camera:** Slow rotate around the circle (2° total over 3s), creating subtle parallax between avatar layers.

**Animation choreography:**
- Avatars — SCALE in from 0, staggered 0.15s, 0.4s back.out
- Connection lines — DRAW between avatars (0.6s each, staggered, power2.out)
- Content card — FLOATS in from y:20, opacity 0 (0.5s, power2.out, starts at 0.4s)
- Quality badge — POPs onto card (scale 0→1.2→1, 0.3s, back.out)
- Pulse indicator — Continuous CSS pulse

**Techniques:** SVG path drawing (connection lines), CSS 3D transforms (subtle rotation)

**Transition IN:** Velocity-matched from below — y:150→0, blur:30px→0, 1.0s power2.out
**Transition OUT:** Whip pan left — x:-400, blur:24px, 0.3s power3.in

**SFX:** Warm collaborative ambience. Soft chime when quality badge pops. Connection line draw sounds like a gentle thread being pulled.

---

## BEAT 7 — CTA / RESOLVE (29.34–33.34s, duration: 4.00s)

**VO:** "ContentOS，让每一篇内容都精准到位。"

**Concept:** The brand returns for the final statement. "ContentOS" large and centered, the tagline beneath. The kanban columns from Beat 3 return in miniature along the bottom edge as a visual echo. The indigo accent glows warm. This is the exhale — confident, resolved, memorable.

**Mood:** Resolution. The final chord. Think Apple "one more thing" landing — everything stops, the brand hangs in space, clean.

**Visual:** Light `#F9FAFB` canvas. Large "ContentOS" at 88px, weight 800, `#111827`, centered horizontally, positioned at vertical 35%. The "OS" in `#4F46E5`. Below it: "让每一篇内容都精准到位" in 36px, weight 400, `#6B7280`. The tagline FADES in 0.5s after the brand name. Along the bottom 15% of the frame: a miniature kanban strip — 10 tiny columns (4px wide, 24px tall, white with colored top-borders matching the workflow stages). A large indigo radial glow (400px radius, 18% opacity) emanates from behind the brand name. A thin 2px horizontal rule (full width, `#4F46E5` at 20%) separates the text from the kanban strip.

**Camera:** Static. Hold. Breathe.

**Animation choreography:**
- "ContentOS" — FADES in + slight rise, y:16→0, opacity 0→1 (0.6s, power2.out)
- "OS" letters — subtle indigo glow pulse (text-shadow: 0 0 30px #4F46E5 at 40%)
- Tagline — FADES in, opacity 0→1 (0.5s, power2.out, delay 0.5s)
- Horizontal rule — EXPANDS from center, scaleX:0→1 (0.6s, power2.out, delay 0.3s)
- Mini kanban — COLUMNS RISE from y:10, opacity 0, staggered 0.05s (0.3s each, power2.out)
- Radial glow — GENTLY PULSES, opacity 16%→22%→16% (4s cycle)

**Techniques:** CSS decorative elements (glow, rule), stagger animation (mini kanban)

**Transition IN:** Whip pan from right — x:400→0, blur:24px→0, 0.3s power3.out
**Transition OUT:** Final hold 2s, then gentle blur out, blur:0→10px, opacity 1→0 (1.0s, power2.in)

**SFX:** Final warm chord on brand appearance. Resolving pad. Clean silence under the tagline. Very faint warm reverb tail on the last word.

---

## Production Architecture

```
videos/product-demo/
├── index.html                    root — VO + underscore + beat orchestration
├── DESIGN.md                     brand reference
├── SCRIPT.md                     narration text
├── STORYBOARD.md                 THIS FILE — creative north star
├── transcript.json               word-level timestamps (from Step 5)
├── narration.wav                 TTS audio (from Step 5)
├── capture/                      captured website data
│   ├── screenshots/
│   │   └── scroll-000.png
│   ├── assets/
│   │   ├── fonts/
│   │   └── svgs/
│   └── extracted/
│       ├── tokens.json
│       ├── visible-text.txt
│       ├── animations.json
│       ├── assets-catalog.json
│       └── detected-libraries.json
└── compositions/
    ├── beat-1-hook.html
    ├── beat-2-brand.html
    ├── beat-3-workflow.html
    ├── beat-4-platforms.html
    ├── beat-5-publish.html
    ├── beat-6-team.html
    ├── beat-7-cta.html
    └── captions.html
```
