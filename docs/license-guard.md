# LicenseGuard Component

A React component for protecting premium features behind a license check. Automatically shows/hides content based on the user's license status.

## Overview

`LicenseGuard` is a wrapper component that:
- ✅ Shows protected content when the user has a valid license
- 🔒 Shows an unlock button when the user is unlicensed
- 🔄 Automatically reacts to license status changes (no page reload needed)
- 🎨 Provides customization options for styling and behavior

## Basic Usage

### Simple Protection

Wrap any premium feature with `LicenseGuard`:

```tsx
import { LicenseGuard } from '@/components/LicenseGuard';

function MyComponent() {
  return (
    <LicenseGuard>
      <PremiumFeature />
    </LicenseGuard>
  );
}
```

**Behavior:**
- **Licensed users**: See `<PremiumFeature />`
- **Unlicensed users**: See default unlock button with Lock/LockOpen icons

### Custom Button Text

```tsx
<LicenseGuard title="Unlock Outline">
  <MarkdownOutline />
</LicenseGuard>
```

### Icon Only (No Text)

```tsx
<LicenseGuard title="">
  <PremiumFeature />
</LicenseGuard>
```

### Custom Styling

```tsx
<LicenseGuard 
  className="fixed top-12 right-6"
  title="Unlock"
>
  <PremiumFeature />
</LicenseGuard>
```

### With Tooltip

Use the native HTML `title` attribute via `tooltipTitle` prop:

```tsx
<LicenseGuard 
  title=""
  tooltipTitle="Activate your license to unlock this feature"
>
  <PremiumFeature />
</LicenseGuard>
```

## Advanced Usage

### Custom Fallback Component

Provide a completely custom UI for unlicensed users:

```tsx
<LicenseGuard
  fallback={
    <div className="p-4 border rounded-lg">
      <h3>Premium Feature</h3>
      <p>This feature requires a license.</p>
      <Button onClick={() => window.open('https://buy.example.com')}>
        Buy Now
      </Button>
    </div>
  }
>
  <PremiumFeature />
</LicenseGuard>
```

### Custom Render Function

For complete control over the unlock UI:

```tsx
<LicenseGuard
  renderUnlockButton={(showPopover) => (
    <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
      <Lock className="h-5 w-5 text-yellow-600" />
      <div>
        <h4 className="font-semibold">Premium Feature Locked</h4>
        <p className="text-sm text-muted-foreground">
          Unlock advanced features with a license
        </p>
      </div>
      <Button onClick={showPopover}>
        Activate License
      </Button>
    </div>
  )}
>
  <PremiumFeature />
</LicenseGuard>
```

## Props API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `React.ReactNode` | *required* | The premium content to protect |
| `title` | `string` | `"Unlock Feature"` | Text shown on the default unlock button |
| `tooltipTitle` | `string` | `undefined` | Native HTML tooltip text (uses `title` attribute) |
| `className` | `string` | `"gap-2"` | CSS classes for the default unlock button |
| `fallback` | `React.ReactNode` | `undefined` | Custom component to show when unlicensed |
| `renderUnlockButton` | `(showPopover: () => void) => React.ReactNode` | `undefined` | Custom render function for unlock UI |

## Priority Order

When multiple customization props are provided, they are used in this order:

1. **`renderUnlockButton`** (highest priority) - Full custom render
2. **`fallback`** - Custom fallback component
3. **Default button** - Built-in Lock/LockOpen button with `title` and `className`

## Real-World Examples

### Example 1: Markdown Outline (Icon Only)

```tsx
<LicenseGuard 
  className="fixed top-12 right-6" 
  title="" 
  tooltipTitle="Enable Markdown Outline"
>
  <MarkdownOutlineWrapper
    editor={editor}
    visible={isOutlineOpen}
    onToggle={() => setIsOutlineOpen(!isOutlineOpen)}
  />
</LicenseGuard>
```

### Example 2: Export Feature

```tsx
<LicenseGuard
  title="Unlock Export"
  className="w-full"
>
  <Button onClick={handleExport}>
    Export to PDF
  </Button>
</LicenseGuard>
```

### Example 3: Settings Panel

```tsx
<LicenseGuard
  fallback={
    <Card className="p-6">
      <CardHeader>
        <CardTitle>Advanced Settings</CardTitle>
        <CardDescription>
          Unlock advanced settings with a license
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" onClick={() => showLicenseDialog()}>
          View License Options
        </Button>
      </CardFooter>
    </Card>
  }
>
  <AdvancedSettingsPanel />
</LicenseGuard>
```

## How It Works

### Reactive License Status

`LicenseGuard` uses Jotai's `licenseStatusAtom` to automatically react to license changes:

```tsx
const licenseStatus = useAtomValue(licenseStatusAtom);
const isLicensed = licenseStatus?.status === 'licensed';
```

**This means:**
- ✅ No page reload needed when license is activated
- ✅ Instant UI updates across all components
- ✅ Consistent state across the entire app

### License States

The component recognizes three license states:

1. **`licensed`** - Valid license, shows protected content
2. **`grace_period`** - Grace period active, shows protected content
3. **`expired`** - No valid license, shows unlock UI

### Opening the License Dialog

When the default unlock button is clicked, it calls `showLicensePopoverAtom`:

```tsx
const showPopover = useSetAtom(showLicensePopoverAtom);
// ...
onClick={() => showPopover()}
```

This opens the license activation dialog where users can:
- Enter a license key
- View license status
- Purchase a license

## Styling Guide

### Default Button Styles

The default unlock button uses:
- **Variant**: `outline`
- **Size**: `sm`
- **Icons**: `Lock` (default) / `LockOpen` (on hover)
- **Default className**: `gap-2`

### Customizing the Button

Override with the `className` prop:

```tsx
// Full width button
<LicenseGuard className="w-full justify-center">

// Minimal icon button
<LicenseGuard className="p-2" title="">

// Custom colors
<LicenseGuard className="gap-2 border-yellow-500 text-yellow-600">
```

### Positioning

Use Tailwind positioning classes:

```tsx
// Fixed position
<LicenseGuard className="fixed top-4 right-4">

// Absolute position
<LicenseGuard className="absolute bottom-0 left-0">

// Centered
<LicenseGuard className="mx-auto">
```

## Best Practices

### 1. Use Descriptive Titles

```tsx
// ❌ Generic
<LicenseGuard title="Unlock Feature">

// ✅ Specific
<LicenseGuard title="Unlock AI Assistant">
```

### 2. Provide Context with Tooltips

```tsx
<LicenseGuard 
  title=""
  tooltipTitle="Premium feature - requires active license"
>
```

### 3. Match Your App's Design

Use `renderUnlockButton` for complex custom designs:

```tsx
<LicenseGuard
  renderUnlockButton={(showPopover) => (
    <YourCustomUnlockUI onActivate={showPopover} />
  )}
>
```

### 4. Don't Nest LicenseGuards

```tsx
// ❌ Avoid nesting
<LicenseGuard>
  <LicenseGuard>
    <Feature />
  </LicenseGuard>
</LicenseGuard>

// ✅ Use one guard per feature
<LicenseGuard>
  <Feature />
</LicenseGuard>
```

### 5. Keep Protected Content Lightweight

```tsx
// ✅ Good - only protects the specific feature
<LicenseGuard>
  <PremiumButton />
</LicenseGuard>

// ❌ Avoid - protects entire page unnecessarily
<LicenseGuard>
  <EntirePage />
</LicenseGuard>
```

## Testing

### Testing with Different License States

Set the grace period to 0 to test expired state:

```bash
# In .env
TAURI_GRACE_PERIOD_DAYS=0
```

Then remove the install file:

```bash
rm ~/Library/Application\ Support/com.depdok.app/.depdok-install
```

### Testing License Activation

Use the dev license key (only works in debug builds):

```bash
# In .env
TAURI_DEV_LICENSE_KEY=test-key-12345
```

Then activate with key: `test-key-12345`

## Troubleshooting

### Button Doesn't Disappear After Activation

**Cause**: LicenseGuard is not reactive to license changes.

**Solution**: Ensure you're using the latest version that uses `useAtomValue(licenseStatusAtom)`.

### Tooltip Not Working

**Cause**: The `tooltipTitle` prop uses native HTML `title` attribute, which may not work with all button configurations.

**Solution**: Use a custom `renderUnlockButton` with a proper Tooltip component if needed.

### Styling Not Applied

**Cause**: The `className` prop only applies to the default button.

**Solution**: Use `renderUnlockButton` or `fallback` for full styling control.

## Related Components

- **LicenseStatusBadge** - Shows license status in the titlebar
- **LicenseActivationDialog** - Dialog for entering license keys
- **LicenseManagementDialog** - Dialog for managing active licenses
- **LicensePopover** - Popover container for license dialogs

## Source Code

Location: `/src/components/LicenseGuard.tsx`

For implementation details, see the source code or contact the development team.
