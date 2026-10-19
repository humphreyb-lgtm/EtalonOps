# ChatGPT Project instructions: catalog research

When I say “Research and Output XXX”, research that product and respond ONLY with the JSON object below. No Markdown or introductory text. Replace the example values. Multiple products may be included in items. Do not invent facts or URLs.

Use manufacturer evidence first, then reputable distributors where needed. Read linked product specifications or PDFs to resolve defining details. Include only facts needed to distinguish and order the product: size, material, schedule, length, connection, finish, installation range or mounting as applicable. Do not demand shipping weight, country of origin or overall dimensions when not necessary for selection. Unknown optional facts may be omitted. Keep notes short and limited to a real conflict or defining missing specification.

Find a usable product image: inspect the visible product gallery, image links, HTML img/picture/source elements, srcset, lazy-loading data attributes, Product JSON-LD, og:image and twitter:image. Resolve relative URLs and inspect linked image assets. If unavailable, search online by manufacturer and exact part, including image search when available. Manufacturer CDN and reputable distributor images are allowed. A family image may represent the product if clearly relevant. Exclude logos, icons and unrelated products. Return the actual HTTPS image URL (PNG, JPG or WebP), not an image-search results page. Never invent a URL. If no image can be verified, use null; the administrator can paste one later. Images and facts are subject to administrator approval.

Ordering units: hardware, fittings, brackets, supports and boxes default EA. Conduit may be EA or FT; wire may be EA or FT. For conduit EA means one documented length, for wire EA means a documented spool/package. Do not guess spool lengths or conversions. If conduit/wire ordering basis is unclear use unit:null. Packaging quantities do not change the default hardware unit.

Generate useful field search phrases with common abbreviations and size spellings. Avoid unsafe broad phrases that would match materially different products. Manufacturer and part are automatically searchable. Dimensions in attributes use numeric decimal inches; the interface formats trade fractions.

Output contract (etalonops-catalog-v1): manufacturer, partNumber, description, category, attributes, productUrl and translations required. category is conduit, bracket, box or general. unit, imageUrl, sources and notes optional. For conduit include diameterIn, material, schedule, lengthIn, endConnection. For bracket include minSpanIn, maxSpanIn (usable installation range), mounting and material. For box include widthIn, heightIn, depthIn, material and knockouts. General items need type and specification. Do not relabel usable span as physical length.

Example structure using owner-supplied product/image references (verify specifications when researching):

```json
{
  "schemaVersion": "etalonops-catalog-v1",
  "items": [{
    "manufacturer": "nVent CADDY",
    "partNumber": "TSGB1624",
    "description": "Adjustable stud-mounted box support bracket",
    "category": "bracket",
    "unit": "EA",
    "attributes": {"minSpanIn": 15.75, "maxSpanIn": 25, "mounting": "stud face", "material": "steel", "finish": "pregalvanized"},
    "productUrl": "https://www.nvent.com/en-us/caddy/products/efstsgb1624",
    "imageUrl": "https://www.nvent.com/sites/default/files/styles/product_and_sku_image_582x334_no_crop/public/dam/zl383hvspt/ph43215.png.webp?itok=m1D1BPG4",
    "translations": ["telescoping box bracket", "adjustable stud box support", "16 to 24 stud bracket"],
    "sources": [],
    "notes": ""
  }]
}
```

## Import into EtalonOps

Administration → Workbook imports → Paste ChatGPT product research. Paste the JSON, check, then upload for review. All rows remain unpublished. Review dimensions and image; paste a replacement Image URL on the product row if needed, then Save inline changes. Select and approve publication. Existing material/manufacturer-part checks prevent duplicate publication and hold conflicts for correction.

The older etalonops-research-v1 contract remains accepted. Its complete original evidence and optional notes remain downloadable under Research scope and coverage; optional caveats no longer flood the review attention list. Paste import and manual image edits make no AI/Bing call. Image previews contact the supplied host. This feature does not add a dedicated image-search API or bypass blocked webpages.

Compact attributes may include bounded lists of text or numeric values, such as compatibleBoxDepthsIn: [1.5, 2.125, 2.5]. Compatible box depths are retained with the manufacturer product details rather than defining a separate generic material. Original arrays remain in the downloadable research JSON.
