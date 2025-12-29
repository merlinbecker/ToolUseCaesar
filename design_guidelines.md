# Design Guidelines: Tooluse Caesar 2

## Design Approach

**Selected System:** Linear + VS Code inspired utility-first design
**Rationale:** This is a developer-focused productivity tool requiring clarity, efficiency, and professional polish. Drawing from Linear's clean data-dense layouts and VS Code's familiar code editing patterns.

## Core Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, and 12 exclusively
- Component padding: p-4, p-6
- Section spacing: py-8, py-12
- Element gaps: gap-4, gap-6
- Icon-text spacing: gap-2

**Structure:**
- Sidebar navigation (240px fixed): Tool list, status indicators, search
- Main content area: Full-height with responsive padding (px-8 py-6)
- Two-panel layout for tool editor: Definition form (left 60%) + Preview/Test panel (right 40%)
- Dashboard: Grid layout (grid-cols-1 lg:grid-cols-3 gap-6) for tool cards

## Typography

**Font Family:** 
- Interface: Inter (Google Fonts) - weights 400, 500, 600
- Code: JetBrains Mono (Google Fonts) - weight 400

**Hierarchy:**
- Page titles: text-2xl font-semibold
- Section headers: text-lg font-semibold
- Card titles: text-base font-medium
- Body text: text-sm font-normal
- Labels: text-xs font-medium uppercase tracking-wide
- Code/JSON: text-sm font-mono

## Component Library

### Navigation Sidebar
- Full-height fixed sidebar with search at top
- Tool list items: hover state with subtle background shift
- Active tool: bold text with left border accent (border-l-2)
- Status badges: inline with tool names (text-xs, rounded-full, px-2)

### Tool Cards (Dashboard)
- Rounded corners (rounded-lg), subtle border
- Header: Tool name + status toggle + actions menu (three-dot)
- Body: Description (text-sm, line-clamp-2) + metadata chips
- Footer: Last modified timestamp + execution count

### Tool Editor Form
- Sectioned layout with clear dividers (border-t, mt-6, pt-6)
- Input groups with labels above inputs
- Code editors: Full-width Monaco editor integration with min-height of 300px
- Tab navigation for Pre-processing/Post-processing code sections

### Execution Panel
- Sticky top panel in tool detail view
- Input field for parameters (JSON editor with syntax highlighting)
- Execute button (prominent, full-width within panel)
- Results display: Expandable JSON tree view with copy button

### API Key Display
- Monospace text with copy-to-clipboard button
- Format: `/<api-key>/tools/...` with key highlighted
- Helper text showing example calls

### Status Indicators
- Active/Inactive toggle: Switch component (h-6)
- Execution status: Colored dots (h-2 w-2 rounded-full) - inline with text
- Loading states: Spinner icons (w-4 h-4) from Heroicons

### Buttons
- Primary actions: px-4 py-2, rounded-md, font-medium
- Secondary actions: border variant with same padding
- Icon-only buttons: p-2, rounded-md
- Button groups: Joined borders with gap-0

### Forms
- Text inputs: h-10, rounded-md, border, px-3
- Textareas: min-h-24, rounded-md, border, p-3
- Select dropdowns: h-10, appearance-none with chevron icon
- Labels: mb-2, consistent spacing above inputs

### Code Display
- Inline code: px-1.5, py-0.5, rounded, font-mono, text-sm
- Code blocks: p-4, rounded-lg, font-mono, text-sm, overflow-x-auto
- Syntax highlighting: Use Monaco editor's built-in themes

### Data Tables
- Borderless rows with hover states
- Header: text-xs, font-medium, uppercase, tracking-wide, pb-3
- Cells: py-3, text-sm
- Actions column: Right-aligned with icon buttons

## Key UI Patterns

**Dashboard Layout:**
- Top bar: Page title + "New Tool" button (right-aligned)
- Stats row: 3-column grid showing total tools, active count, execution stats
- Tool grid: Filterable/searchable cards in responsive grid

**Tool Detail/Editor:**
- Breadcrumb navigation: Home > Tools > [Tool Name]
- Top actions bar: Save, Test, Delete (right-aligned)
- Form sections: Metadata → HTTP Config → Processing Code → Fake Response
- Live preview panel: Shows Mistral-format JSON in real-time

**Execution Interface:**
- Clear separation between input (parameter definition) and output (results)
- Execution history: Collapsible list below results showing recent runs
- Error states: Red-tinted backgrounds with clear error messages

**Icons:** Heroicons (CDN link)
- Use outline style for navigation and secondary actions
- Use solid style for status indicators and primary actions
- Consistent sizing: w-5 h-5 for standard icons, w-4 h-4 for inline

## Animations

**Minimal, purposeful only:**
- Page transitions: None
- Form validation: Shake animation on error (duration-200)
- Success states: Subtle fade-in for success messages (duration-300)
- Tool execution: Loading spinner only, no elaborate animations

## Images

**No hero images required.** This is a utility application focused on functionality. Use icons and data visualizations instead of decorative imagery.