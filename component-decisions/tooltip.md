# Tooltip Component Decisions 🛠️

This page tracks major design choices for the Tooltip component so we have a clear record of what was explored and why we landed on the final solution.

- **Decision Date:** 2025-06-15
- **Context:** See the design exploration in [Figma](https://www.figma.com/).
- **Status:** In review

## Requirements

- ✨ Must support keyboard focus
- 📱 Works on touch devices
- 🎨 Visual style aligns with brand guidelines

## Explorations

1. **Hover vs. Click** – a hover-only approach didn’t work for mobile.
2. **Animation timing** – tested 100ms, 150ms, and 200ms fades; 150ms felt best.
3. **Placement options** – default to top, but auto-adjust to avoid clipping.

## Final Decision ✅

When the design review is complete, capture the final choice here. Link back to the issue or discussion where the decision was made.
