# Profile Card Hover System — Implementation Guide

## Overview
Replaced the old floating sticker system with a custom hover card that displays a creator's professional summary, including a custom image and pitch video.

## What Changed

### 1. **ValueSkinEntry Type** (`AvatarOptions.tsx`)
Added two new optional fields:
```typescript
export interface ValueSkinEntry {
  profession: string;
  aboutMe: string;
  attestation?: IdentityAttestation;
  customImage?: string;        // NEW: URL to custom hover card image
  pitchVideoUrl?: string;      // NEW: URL to pitch video (why hire this creator)
}
```

### 2. **New ProfileCardDisplay Component** (`AvatarOptions.tsx`)
Displays a small thumbnail image (120px × 140px) with a blue border. When users hover over it, a fullscreen card appears showing:
- Custom image (280px height)
- Creator name & profession
- About Me summary
- Embedded pitch video (if provided)
- "View Full Profile" button

**Usage:**
```tsx
<ProfileCardDisplay
  valueSkins={valueSkins}
  onValueSkinsChange={onValueSkinsChange}
  displayName={displayName}
  level={level}
/>
```

### 3. **Updated AboutMePanel** (`AvatarOptions.tsx`)
When editing a profession slot, creators can now:
- Write/edit their "About Me" summary
- Upload a custom image (paste URL)
- Upload a pitch video (paste URL)
- Preview both before saving

The edit panel shows:
- **About Me** textarea
- **Custom Image** input + live preview
- **Pitch Video URL** input + live preview

### 4. **Updated CreatorProfilePreview** (`CreatorProfilePreview.tsx`)
- Removed the old `ValueSkinStickers` import
- Added `ProfileCardDisplay` import
- Profile card now displays next to name/level if a custom image exists
- Uses conditional rendering: card only shows if `valueSkins.profession?.customImage` is set

## How to Use

### For Creators (Editing Profile)
1. Open their profile settings/About Me panel
2. Click "Edit" next to their profession slot
3. In the edit panel:
   - Update "About Me" text
   - Paste image URL in "Custom Image" field (JPG/PNG)
   - Paste video URL in "Pitch Video URL" field (MP4/WebM)
   - Click "Save"
4. The custom card now appears on their profile

### For Brands/Other Users (Viewing Profile)
1. See the creator's profile
2. Hover over the custom image card (if present)
3. Full card preview appears showing:
   - Large version of custom image
   - Creator name & profession
   - About Me text
   - Pitch video they can watch
4. Click outside or move mouse away to close

## Styling Details

### Thumbnail (Hover Trigger)
- Size: 120px × 140px
- Border: 2px solid rgba(0,102,204,0.4) (light blue)
- Background: #1A1A1A (dark)
- Contains avatar icon (👤) that fades when hovered
- Rounded corners (8px)

### Preview Card
- Max width: 480px (responsive)
- Image section: 280px height
- Padding: 24px
- Dark theme (#141414 background, #262626 border)
- Video controls enabled for playback
- Animated fade-in (200ms)
- Positioned at center of screen (fixed positioning)

## File Locations

### Modified Files
- `marketplace/src/features/valueskins/core/identity/AvatarOptions.tsx` — Core components
- `marketplace/src/components/CreatorProfilePreview.tsx` — Integration in profile view

### New Components (within AvatarOptions.tsx)
- `ProfileCardDisplay()` — Main component showing hover trigger
- `ProfileCardPreview()` — Modal card shown on hover

## Data Flow

```
CreatorProfilePreview
  └─ ProfileCardDisplay
      ├─ Shows thumbnail if valueSkins.profession.customImage exists
      └─ OnHover → ProfileCardPreview modal
           └─ Displays full card with all content

AboutMePanel (Edit mode)
  ├─ Edits aboutMe text
  ├─ Edits customImage URL
  ├─ Edits pitchVideoUrl
  └─ Saves all to ValueSkinEntry
```

## Important Notes

1. **Image/Video URLs**: Users must paste URLs directly. The component does NOT handle file uploads - it expects URLs to be provided (e.g., from an image host, video platform, or backend file service).

2. **Backward Compatibility**: The old `ValueSkinStickers` component still exists and can be used elsewhere. The profile only shows the new card if a custom image is set.

3. **Conditional Display**: The profile card only appears when `valueSkins.profession?.customImage` is defined. This allows for gradual adoption.

4. **Mobile**: The hover card uses `onMouseEnter`/`onMouseLeave` on desktop. On mobile, users would need to tap/press. Consider adding touch gesture support if needed.

5. **Performance**: Card content (image, video) loads on demand when hovered. Videos use native HTML5 `<video>` element with controls.

## Future Enhancements

- [ ] Add file upload UI instead of requiring manual URLs
- [ ] Image cropping/preview before save
- [ ] Video thumbnail generation
- [ ] Touch gesture support for mobile (long-press)
- [ ] Analytics: track hover/view rates
- [ ] Share preview card via link
