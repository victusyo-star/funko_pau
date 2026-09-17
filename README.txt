FUNKO PAU VERSION 5.8.2
Read V5-START-HERE.txt for setup, the initial PIN (2026), editing and publication.
The original project notes are preserved below.

FUNKO PAU — BASE-PRESERVED EDITION

1. OPEN THE APP
Extract the ZIP completely, then double-click index.html.
No installation, terminal, account or local server is required.
Use a current version of Chrome, Edge, Firefox or Safari.
An internet connection is required for remote product artwork.

2. DESIGN BASELINE
This version is built directly on the original Pop-Archive.zip project.
The original view-switching architecture is preserved: Collection, Wishlist, Universes
and Contributors all render into the same central browse area. They are not stacked
page sections and navigation does not scroll down the page to find them.
The original product-card structure, bottom product-number row, hover treatment,
light/dark theme, inline browser favicon, spacing language and core typography remain
the visual baseline. The browser tab and site identity are Funko Pau.

3. INCLUDED FUNCTIONALITY
33 owned catalog entries from Pau's confirmed collection.
Pau is the first homepage spotlight.
Collection, Wishlist, Universes and Contributors are switchable application views.
English / Spanish interface switching with local preference storage.
Contributor ranking calculated from giftedBy in collection.js.
Contributor avatar fallbacks when local WebP files have not yet been added.
Search, universe filtering, series filtering, acquisition filtering and sorting.
Light/dark themes, keyboard search shortcut, product details and related figures.
Remote product artwork remains outside the package to keep it lightweight.

4. PEOPLE AND AVATARS
people.js contains Pau and the contributor records.
Owner image path:
  assets/owner/pau.webp
Contributor image paths:
  assets/gift-givers/carlos.webp
  assets/gift-givers/christian.webp
  assets/gift-givers/jose_carlos.webp
  assets/gift-givers/martha.webp
  assets/gift-givers/lehky.webp
  assets/gift-givers/mily.webp
Transparent WebP is recommended. Missing files fall back to initials automatically.
The owner spotlight uses the original Pop Archive direct-image structure, so transparent
artwork is not placed over a visible fallback layer and the original hover motion remains intact.

5. COLLECTION DATA
collection.js contains Pau's lightweight personal records.
catalogId references catalog.js.
status is "owned" or "wishlist".
shelfOrder controls the default collection order.
acquiredAt uses YYYY-MM-DD when known.
acquisition can be "Bought", "Gifted", "Traded" or another description.
giftedBy references a contributor id from people.js, such as "carlos".
notes is optional.
Unknown personal details are intentionally null rather than invented.

6. CONTRIBUTOR RANKING
The ranking is derived automatically from giftedBy.
For example, setting giftedBy: "martha" on an owned figure adds one gift to Martha.
No duplicate ranking data needs to be maintained.
Opening Contributors replaces the central browse content with the ranking; it does not
insert a second section below the collection. Clicking a contributor with linked gifts
returns to Collection with that contributor applied as a filter.

7. CATALOG DATA
catalog.js contains public product metadata, box numbers, franchise/series data,
remote image URLs and catalog/product links.
The product number remains in the original bottom metadata row of every card.
sources.json contains source notes used for the catalog snapshot.

8. LANGUAGE
The ES / EN control switches the interface language.
Character names, franchise names and licensed series names stay in their catalog form.
The selected interface language is stored locally in the visitor's browser when allowed.

9. GITHUB PAGES LATER
Nothing in this package requires a build step or server-side code.
When ready, upload these files at the chosen GitHub Pages root.
All local application paths are relative and compatible with repository subpaths.
The wishlist remains public read-only data unless a separate backend is added later.

10. BASELINE RULE
Existing Pop Archive design decisions are treated as established behavior.
The original styles.css is preserved byte-for-byte as the first part of the stylesheet;
Funko Pau-specific rules are appended after it rather than rewriting the base rules.
New capabilities should extend the existing architecture instead of moving working UI,
restyling established controls, or converting application views into scroll destinations.

Funko and character imagery/trademarks belong to their respective owners.
This is an independent personal fan catalog and is not affiliated with Funko.
