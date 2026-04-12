# Design System Document: The Lucid Architect

## 1. Overview & Creative North Star
**Creative North Star: "The Editorial Intelligence"**

This design system moves away from the "SaaS-in-a-box" aesthetic toward a high-end, editorial experience. It treats document summarization not as a utility, but as a curated insight service. We achieve this through "The Editorial Intelligence"—a philosophy that prioritizes breathing room, sophisticated tonal layering, and intentional asymmetry. By breaking the traditional rigid grid and replacing harsh borders with soft depth, we create a workspace that feels authoritative yet effortless. The goal is for the user to feel they are interacting with a polished digital publication rather than a database.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
Our palette is anchored in deep professional blues (`primary`) and clean, airy neutrals (`surface`). The objective is to convey trust without sterility.

*   **The "No-Line" Rule:** 1px solid borders for sectioning are strictly prohibited. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section should sit against a `surface` background to define its edges.
*   **Surface Hierarchy & Nesting:** Use surface tiers to create "physical" layers.
    *   **Base:** `surface` (#f7f9fb)
    *   **Nested Sections:** `surface-container-low` (#f2f4f6)
    *   **Actionable Cards:** `surface-container-lowest` (#ffffff)
*   **The "Glass & Gradient" Rule:** Floating panels (like AI chat sidebars or tooltips) should utilize Glassmorphism. Use `surface_container_lowest` at 80% opacity with a `24px` backdrop blur.
*   **Signature Textures:** For primary CTAs or the "Summarize" trigger, apply a subtle linear gradient from `primary` (#043568) to `primary_container` (#264c80) at a 135-degree angle to add a "liquid" professional sheen.

---

## 3. Typography: Authority Through Scale
We pair the geometric precision of **Manrope** for high-level guidance with the functional clarity of **Inter** for deep reading.

*   **Display & Headlines (Manrope):** Use `display-lg` and `headline-md` to create an editorial feel. The wide apertures of Manrope convey a modern, "open" intelligence.
*   **Body & Titles (Inter):** All document summaries and chat interactions use `body-lg` (1rem). The tracking should be tightened slightly (-0.01em) for titles and loosened (+0.01em) for long-form body text to maximize legibility.
*   **Hierarchy as Brand:** Use `on_surface_variant` (#424751) for secondary metadata to ensure the primary `on_surface` (#191c1e) text "pops" with authority.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows and borders are replaced by light-source simulation and tonal stacking.

*   **The Layering Principle:** To lift a document preview, place a `surface-container-lowest` card on top of a `surface-container` background. The subtle shift from `#eceef0` to `#ffffff` creates a natural edge.
*   **Ambient Shadows:** If a floating element (like a context menu) requires a shadow, use a blur of `32px`, an offset of `y: 8px`, and a color derived from `on_surface` at **4% opacity**. It should feel like a soft glow, not a dark drop.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke (e.g., in high-contrast modes), use `outline_variant` (#c2c6d3) at **15% opacity**. 

---

## 5. Components: The Summarizer Suite

### File Upload Zones
*   **Style:** Instead of a dashed box, use a large `surface-container-high` area with `xl` (0.75rem) rounded corners. 
*   **Interaction:** On drag-over, transition the background to `primary_fixed` (#d5e3ff) with a soft `48px` inner glow.

### Chat Bubbles (AI Interaction)
*   **AI Response:** Use `surface-container-lowest` with a subtle gradient "flare" in the top-left corner using `surface_tint`. No borders.
*   **User Input:** Use `secondary_container` (#cbe7f5) with `on_secondary_container` text. 
*   **Shape:** Use `xl` (0.75rem) radius for the outer corners, but a `sm` (0.125rem) radius for the corner closest to the sender's avatar to create a "tail" effect.

### Sidebar Navigation
*   **Layout:** A wide-margin, `surface-container-low` sidebar. 
*   **Active State:** Avoid "highlighter" boxes. Use a vertical `4px` pill of `primary` (#043568) to the left of the menu item, and shift the text weight to `title-sm` (Semi-bold).

### Document Previews
*   **Style:** Treat these as "digital paper." Use `surface_container_lowest` (#ffffff).
*   **Spacing:** Use generous padding (2rem) to simulate a physical page. 
*   **Forbid Dividers:** Use `1.5rem` of vertical whitespace to separate summary sections rather than horizontal lines.

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. Text: `on_primary`. Roundedness: `md` (0.375rem).
*   **Secondary:** `surface-container-highest` background with `on_surface` text. This blends into the UI until hovered.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical layouts for the dashboard. Let the document preview take 65% of the screen and the AI insights take 35% to create an editorial "spread" feel.
*   **Do** use `surface-dim` for inactive or "background" states to keep the focus on the active summary.
*   **Do** use the `lg` and `xl` corner radii for large containers to soften the professional tone.

### Don't
*   **Don't** use 100% black (#000000) for text. Always use `on_surface` (#191c1e) to maintain a soft, premium ink-on-paper look.
*   **Don't** use standard "Success Green" for completed uploads. Use a refined `secondary` (#48626e) or a muted version of `primary` to maintain the color story.
*   **Don't** cram icons. Every icon should have a minimum of `12px` of clear space (the "Breathing Room" rule) to prevent a "cluttered app" feel.