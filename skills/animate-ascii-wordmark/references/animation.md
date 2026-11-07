# Animation contract

Read this when modifying the engine or evaluating a result whose motion or legibility is wrong. The generator is the default implementation; ordinary text changes do not need a new animation algorithm.

## Composition

Rasterize the text with the bundled font into a sparse ASCII silhouette. Preserve each letter's negative space and separation so the word remains readable at its intended display size. Use a restrained palette with theme-appropriate contrast. The canvas background stays transparent.

One `@` cursor acts as the chaser. Start with multiple loose colored glyphs and introduce additional loose glyphs during the sequence. Keep the activity distributed across the word without turning the whole silhouette into noise.

## Motion and closure

Move on discrete grid cells. Each visible chase step has a physical path; do not teleport the cursor to a new target. Restoring a loose glyph returns that glyph to its own position in the silhouette.

The opening picture already contains displaced initial glyphs. After the cursor restores them, they walk back to those same displaced starting cells while the cursor repairs the additional glyphs. A loop is complete only when those initial glyphs are back at their opening positions, the additional glyphs are restored, and the cursor is home. Keep the chase and return journeys in the simulation. A hard reset, opacity wipe, or duplicate first frame does not establish loop closure.

Use a deterministic seed so a text-and-seed pair can be reproduced. Capture the full cycle, including its ending, before repeating. If export reaches its duration limit before closure, treat that as an incomplete export; adjust the movement or capture budget and validate again.

## Review

Check the actual animation on light and dark surfaces at a wide and narrow width. Inspect the static silhouette, busy middle frames, and the transition from the final frame back to the first. Reduced-motion users should receive a stable readable wordmark. Keep automatic playback free of playback/reset controls unless the user specifically asks for a different interaction.

Use the runtime tests and export validation to check simulation invariants, then inspect the rendered result. Correct state transitions alone do not establish readable letterforms or a convincing loop.
