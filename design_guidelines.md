# Design Guidelines: Unified Application Platform

## Design Approach: Material Design System
**Rationale**: Data-heavy productivity tool requiring clear hierarchy, robust component patterns, and excellent visual feedback for form interactions and real-time updates.

## Core Design Principles
- **Clarity Over Decoration**: Prioritize readability and quick information scanning
- **Consistent Patterns**: Maintain uniform UI across all three modules for seamless transitions
- **Functional Aesthetics**: Clean, professional interface that enhances productivity
- **Visual Feedback**: Clear states for interactive elements (active module, loading, success/error)

## Color Palette

**Dark Mode (Primary)**
- Background: 217 33% 10% (deep slate)
- Surface: 217 33% 14% (elevated slate)
- Primary: 217 90% 60% (vibrant blue)
- Primary Variant: 217 80% 50% (darker blue)
- Text Primary: 0 0% 98%
- Text Secondary: 217 20% 70%
- Border: 217 30% 22%
- Success: 142 70% 45%
- Error: 0 72% 55%

**Light Mode**
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Primary: 217 90% 50%
- Text Primary: 217 33% 17%
- Text Secondary: 217 25% 45%
- Border: 217 30% 88%

## Typography
**Font Family**: Inter via Google Fonts (clean, professional, excellent readability for data)
- Headings: 600 weight
- Module Titles: 24px (text-2xl)
- Section Headers: 18px (text-lg)
- Body Text: 14px (text-sm)
- Data Tables: 13px (text-xs to text-sm)
- Labels: 12px (text-xs), 500 weight

## Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 or p-6
- Section spacing: space-y-6
- Card gaps: gap-4
- Module content margins: m-6 or m-8
- Dense data layouts: gap-2

**Container Structure**:
- Navigation sidebar: Fixed width 260px (w-64)
- Main content area: Remaining width with max-w-7xl padding
- Responsive breakpoint: Collapse to top bar on mobile (< md)

## Navigation Architecture

**Fixed Sidebar (Desktop)**
- Left-aligned vertical navigation
- Company logo/app name at top
- Three module buttons with icons:
  - Esteira de Demandas (primary - home icon)
  - DashRealtime (chart icon)
  - BICadastro (users icon)
- Active state: Primary color background, bold text
- Hover state: Subtle background change
- Each button shows icon + label

**Mobile Header Bar**
- Hamburger menu revealing drawer with same three options
- Current module name displayed in center
- Drawer slides from left, overlays content

## Component Library

**Data Tables**
- Striped rows for better scanning (alternating background)
- Sticky header on scroll
- Hover highlight on rows
- Sortable columns with arrow indicators
- Pagination controls at bottom
- Borders: subtle dividers between columns

**Forms**
- Consistent input styling across modules
- Labels above inputs
- Helper text below for guidance
- Clear error states with red text and border
- Success feedback with green checkmark
- Group related fields with subtle section dividers

**Cards**
- Elevated surfaces (subtle shadow in light mode, lighter background in dark)
- Rounded corners (rounded-lg)
- Consistent padding (p-6)
- Header with title and optional actions

**Buttons**
- Primary: Filled with primary color
- Secondary: Outline style
- Disabled: Reduced opacity
- Loading state: Spinner with disabled appearance

**Dashboard Widgets (DashRealtime)**
- KPI cards: Large number, label below, trend indicator
- Chart containers: Card styling with title and time range selector
- Grid layout: 2-3 columns on desktop, stack on mobile

**Status Indicators**
- Color-coded badges for workflow states
- Dot indicators for real-time status
- Progress bars for completion tracking

## Module-Specific Considerations

**Esteira de Demandas**
- Kanban-style columns or table view toggle
- Priority flags with color coding
- Timeline/history section for each demand
- Quick action buttons (edit, delete, status change)

**DashRealtime**
- Live data updates with subtle pulse animation
- Refresh timestamp display
- Auto-refresh toggle control
- Metric comparison (current vs. previous period)

**BICadastro**
- Multi-step form wizard if applicable
- Clear save/cancel actions
- Confirmation dialogs for destructive actions
- Search and filter controls for browsing records

## Consistency Rules
- All modules share exact same header/navigation styling
- Forms use identical input components across modules
- Tables maintain same styling and interaction patterns
- Consistent spacing and typography throughout
- Unified color usage for status indicators

## Responsive Behavior
- Desktop (lg+): Full sidebar navigation, multi-column layouts for tables/forms
- Tablet (md): Collapsed navigation, 2-column grids reduce to 1
- Mobile (base): Drawer navigation, single column, stack all elements vertically