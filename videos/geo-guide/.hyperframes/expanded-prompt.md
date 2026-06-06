# GEO Guide — Expanded Production Prompt

## Title + Style Block

**Title:** "2026年不懂GEO？你的网站可能白做了"
**Platform:** Douyin / TikTok (vertical 1080x1920)
**Duration:** ~25s
**Format:** Vertical short-form video, text + animated graphics (no live-action)

### Palette (derived from design.md + bold-energetic house palette)

| Token       | Value     | Usage                           |
|-------------|-----------|---------------------------------|
| canvas      | #0B0F1A   | Deep navy-black background      |
| surface     | #161B2E   | Cards, panels, elevated areas   |
| accent      | #00D4AA   | GEO brand mint/teal             |
| highlight   | #FFBE0B   | Gold — highlights, emphasis     |
| warning     | #FF3B5C   | Red — danger, alerts            |
| text        | #F0F2F5   | Primary text                    |
| muted       | #8892A4   | Secondary text, labels          |
| border      | #2A3050   | Dividers, thin structural lines |

### Typography

| Level    | Font        | Size    | Weight | Usage             |
|----------|-------------|---------|--------|-------------------|
| hero     | Geist       | 100-130px | 900  | "GEO", big words  |
| headline | Geist       | 60-80px | 800    | Section titles    |
| body     | Geist       | 32-40px | 400    | Script text       |
| label    | Geist Mono  | 22-28px | 500    | Tags, step labels |

### Mood

Tech-forward, punchy, alert. Think "digital news broadcast meets social media infographic." High contrast, neon accents on dark canvas. Energy builds through each scene.

## Rhythm Declaration

**PUNCH-SLAM-WARN-REVEAL-CTA**

Fast hook → confident build → hard disruption → systematic reveal → warm resolve.

## Global Rules

- **Parallax:** Background decoratives drift slowly; foreground content snaps in.
- **Micro-motion:** Every decorative element has ambient motion (breathe, drift, pulse).
- **Transitions:** CSS-only (no shaders). Primary: blur crossfade. Accent: hard cut for disruption.
- **Highlight effect:** Yellow marker sweep (css-patterns.md) for each of the three steps.
- **Sound design cues noted but not embedded** — "叮" sfx markers for step highlights.

## Per-Scene Beats

### Scene 1: Hook (0–3s)

**Concept:** GEO slams onto screen like a siren. Search results cascade in background. Viewer feels urgency — "I need to pay attention NOW."

**Mood:** Digital emergency broadcast. Alerts flashing.

**Depth layers:**
- BG: Scrolling code/search-result lines (ghost text at 8-12%, slow upward drift)
- BG: Radial glow centered on "GEO" (#00D4AA, 20% opacity, breathing)
- MG: "GEO" hero text (130px, 900wt, mint #00D4AA)
- MG: Subtitle line "你的网站还没被AI'看懂'？"
- FG: Thin hairline rule top/bottom (accent color, pulse)
- FG: "2026" label (mono, top-right corner)

**Choreography:**
- "GEO" SLAMS in from scale 0 → 1.1 → 1.0 with 0.15s expo (impact)
- Subtitle TYPES ON (opacity + x stagger per character group)
- Search results DRIFT upward continuously
- Radial glow BREATHES (scale 1 → 1.08 yoyo)

**Transition out:** Zoom through (scale 1.1 + blur 15px, 0.3s power3.in)

### Scene 2: GEO Intro (3–8s)

**Concept:** A website card floats in 3D space, surrounded by orbiting AI "scan" indicators. The metaphor: GEO is the translator between your site and AI.

**Mood:** Tech showcase, confident. Think Apple product reveal meets data visualization.

**Depth layers:**
- BG: Subtle grid pattern (thin #2A3050 lines, 40px grid)
- BG: Large ghost "AI" text (120px, 5% opacity, slow drift)
- MG: Website card mockup (3D perspective tilt, white surface)
- MG: 3 orbiting dots/pills (accent color, different speeds, "scanning" the card)
- MG: "GEO = AI的导航员" label
- MG: Body text "AI搜索引擎现在直接扒你家底..."
- FG: "第一" step indicator (top-left, accent pill)

**Choreography:**
- Card DROPS in from y:-80 with perspective rotation (0.6s expo.out)
- Orbit dots STAGGER in (0.15s apart, scale 0 → 1, elastic.out)
- Label SLIDES from left (0.4s power3.out)
- Body text FADES UP (0.5s, 0.3s offset)
- Card has continuous SLOW ROTATION (ambient, 0.5deg)

**Transition out:** Hard cut (instant scene swap — disruption)

### Scene 3: Warning (8–13s)

**Concept:** Red alert. Broken page icons scatter. "踩坑警告" dominates. Energy shifts from confident to alarming.

**Mood:** Digital alarm. Red on dark. Sharp, urgent.

**Depth layers:**
- BG: Red radial pulse from center (#FF3B5C, breathing)
- BG: Scattered broken-page SVGs (small, muted, drifting)
- MG: Warning triangle icon (large, #FF3B5C, pulse)
- MG: "踩坑警告" headline (80px, red, bold)
- MG: Body text about keyword stuffing / structured data abuse
- FG: "第二" step indicator (top-left, warning pill)
- FG: Red vignette overlay (subtle, breathes)

**Choreography:**
- Warning triangle SLAMS in (scale 0 → 1.2 → 1.0, 0.2s)
- "踩坑警告" CRASHES from top (y:-100 → 0, 0.3s back.out)
- Body text CASCADES in (stagger 0.15s per line)
- Broken pages SCATTER outward from center
- Red pulse BREATHES throughout

**Transition out:** Push slide (exit x:-400 + blur, entry x:400→0, 0.3s power3)

### Scene 4: Three Steps (13–20s)

**Concept:** Clean mind-map / flowchart reveals three steps sequentially. Each step gets a gold highlight sweep + visual emphasis. This is the core value delivery.

**Mood:** Organized, trustworthy. Data visualization meets infographic. The calm after the storm.

**Depth layers:**
- BG: Thin connecting lines between steps (hairline, accent color)
- BG: Soft radial glow (accent, 12%, breathing)
- MG: Step 1 card: "内容净化"
- MG: Step 2 card: "语义关联"
- MG: Step 3 card: "用户意图匹配"
- MG: Quote text below cards
- FG: Arrow connectors between steps
- FG: "第三" step indicator (top-left)

**Choreography:**
- Step cards CASCADE in (stagger 1.5s, each: scale 0 → 1 with 0.4s back.out)
- Each card gets highlight bar sweep AFTER entry (gold #FFBE0B, scaleX 0→1, 0.5s)
- "叮" sync point: highlight sweep moment
- Connecting lines DRAW from scaleX 0 → 1 (between cards)
- Quote text FADES UP after all three steps (0.5s, at ~18s)

**Transition out:** Blur crossfade (0.4s power2.inOut)

### Scene 5: CTA (20–25s)

**Concept:** Warm resolve. "2026流量密码" animates in with energy. CTA buttons glow. The viewer should feel compelled to act.

**Mood:** Warm, inviting, energetic. Gold + mint on dark.

**Depth layers:**
- BG: Dual radial glows (mint left, gold right, 15% opacity, breathing)
- MG: "2026流量密码" animated text (large, gold accent)
- MG: CTA line "点赞收藏，评论区扣'GEO'"
- MG: "关注我" indicator with glow
- FG: Accent lines / decorative rules

**Choreography:**
- "2026流量密码" BUILDS character-by-character (stagger 0.05s, from opacity 0 + y:20)
- CTA line SLIDES up (0.5s, power2.out)
- "关注" pill POPS (scale 0 → 1, 0.3s elastic.out)
- Glows BREATHE throughout
- Final fade to slightly darker (0.5s, last 0.5s — exit allowed on final scene)

## Recurring Motifs

- Step indicators ("第一", "第二", "第三") as small colored pills top-left
- Accent color #00D4AA appears in every scene as a structural thread
- Hairline rules as scene-framing elements
- Ghost text in backgrounds (thematic words at 3-8%)

## Negative Prompt

- No pastel colors
- No light/corporate backgrounds (this is dark tech theme)
- No decorative gradients (solid + radial glow only)
- No centered-stacks (use split/anchored layouts)
- No web-sized text (everything 24px+)
- No static decoratives (all must have ambient motion)
