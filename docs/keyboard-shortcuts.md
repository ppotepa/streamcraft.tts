# StreamCraft TTS UI - Keyboard Shortcuts

## Wizard Navigation

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Ctrl+→` (or `Cmd+→` on Mac) | Next step | Only works when next step is unlocked |
| `Ctrl+←` (or `Cmd+←` on Mac) | Previous step | Only works when not on first step |
| `Ctrl+R` (or `Cmd+R` on Mac) | Rerun current step | Triggers the main action for active step |

**Note**: Wizard shortcuts are disabled when typing in input fields, textareas, or when modals/overlays are open.

## Segment Review Overlay

| Key | Action | Notes |
|-----|--------|-------|
| `A` or `→` (Right Arrow) | Accept current segment | Marks segment as accepted and moves to next |
| `R` or `←` (Left Arrow) | Reject current segment | Marks segment as rejected and moves to next |
| `↑` (Up Arrow) | Navigate to previous segment | Moves focus up in the segment list |
| `↓` (Down Arrow) | Navigate to next segment | Moves focus down in the segment list |
| `Esc` | Close overlay | Exits without saving changes |

**Workflow**:
1. Click "Review segments" button in Sanitize step
2. Use A/R or arrow keys to accept/reject each segment
3. Press ESC to cancel, or click "Save" to persist votes to API

## Copy Actions

| Action | Trigger | Result |
|--------|---------|--------|
| Click "Copy" button on PathRow | Any output file path | Copies path to clipboard + shows toast |
| Click "Open" button on PathRow | Any output file path | Opens path in new browser tab |

## Modal/Overlay Interactions

| Shortcut | Context | Action |
|----------|---------|--------|
| `Esc` | Segment Review overlay | Close without saving |
| `Esc` | Preset modal (Save As / Manage) | Close modal |
| Click outside modal | Any modal/overlay | Close (if not prevented) |

## Tips

- **Quick Navigation**: Use `Ctrl+→` to jump to next unlocked step after completing current step
- **Quick Rerun**: Use `Ctrl+R` to instantly rerun a failed step instead of clicking the button
- **Keyboard-First Review**: The Segment Review overlay is designed for keyboard-only operation (no mouse needed)
- **Disabled During Input**: Shortcuts are automatically disabled when focus is in text inputs to prevent conflicts

## Future Shortcuts (Planned)

- `Ctrl+S`: Save current preset (quick save without modal)
- `Ctrl+L`: Toggle console panel collapse
- `Ctrl+1` through `Ctrl+5`: Jump directly to specific step
- `Space`: Play/pause audio preview (when preview card has focus)

---

**Last Updated**: January 2025  
**Keyboard Layout Compatibility**: QWERTY (US) - other layouts may vary for letter keys
