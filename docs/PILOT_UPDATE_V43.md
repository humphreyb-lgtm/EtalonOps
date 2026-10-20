# Catalog JSON v2 import

Paste `etalonops-catalog-v2` output into **Administration → Workbook imports → ChatGPT research JSON**. Check it, then **Upload pasted research for review**. Both material-only and manufacturer-product items appear in the existing grouped review. Edit, select, approve and publish when ready. Uploading never publishes automatically, and this import makes no AI or Bing call.

## Record types

- `recordType: "material"`: manufacturer and partNumber must be null or omitted. No manufacturer/product record is invented. Suitable for generic hardware, fasteners, drill bits and consumables, while preserving meaningful size, finish, grade, spring configuration and other purchasing specifications.
- `recordType: "product"`: requires both a real manufacturer and manufacturer part number. Placeholder manufacturers such as Approved Vendor are rejected. The product links to its generic material.

Supported categories are general, conduit, bracket, box, hardware_fasteners, drill_bits and consumables. The last three add built-in catalog categories, with underscore aliases normalized to hyphenated internal IDs. Conduit still requires its structured size, material, schedule, length and end connection; generic does not mean specification-free.

## Ordering, packaging and supplier references

`unit` is the MRF ordering unit. Hardware and consumables default to EA when omitted; conduit and wire require an explicit unit. An explicit unit such as BOX or ROLL is respected. Package quantity never changes the ordering unit. Use EA for a spring nut requested individually, even if the supplier packages 25 together.

`packageQuantity` and `supplierReferences` are purchasing details, separate from material identity. Generic material details are stored with that material. Product details are stored with the manufacturer product. Supplier names/catalog numbers also become searchable aliases. Supplier catalog numbers never become manufacturer parts automatically. Notes and additional evidence URLs are retained for review.

Repeated material specifications reuse the canonical material. New generic subcategories can reuse matching prior general materials without automatically changing their category. Matching manufacturer products are reused. Different defining attributes remain distinct. Existing metadata is not silently overwritten: conflicting package quantities or supplier-detail values are held for review and consolidation instead of creating another material. As before, differently worded or differently structured specifications may need manual duplicate review.

## Images and review

A material-only image becomes a generic material image. A product image remains linked to its manufacturer product. Both have image upload and URL replacement controls in the grouped review. Uploaded images take display priority. Image URLs can still be blocked by their host; upload a file or replace the URL if needed.

Descriptions are editable independently of identifying specifications. Search phrases, images and details stay with one grouped approval. Publication remains provisional fact verification; the administrator must review the researched information.

## Example

```json
{
  "schemaVersion": "etalonops-catalog-v2",
  "items": [{
    "recordType": "material",
    "manufacturer": null,
    "partNumber": null,
    "description": "1/2-13 short spring channel nut, galvanized steel",
    "category": "hardware_fasteners",
    "attributes": {
      "type": "Short spring channel nut",
      "specification": "1/2-13 internal thread; galvanized steel; short coil spring"
    },
    "unit": "EA",
    "packageQuantity": 25,
    "supplierReferences": [{
      "supplier": "Grainger",
      "catalogNumber": "4A985",
      "url": "https://www.grainger.com/product/4A985"
    }],
    "productUrl": "https://www.grainger.com/product/4A985",
    "imageUrl": null,
    "translations": ["half inch short spring nut", "Grainger 4A985"],
    "sources": ["https://www.grainger.com/product/4A985"],
    "notes": "Example import structure; verify product facts before publication."
  }]
}
```

Older catalog-v1 and research-v1 imports remain supported. No new database migration, Azure resource or paid test call is required. Purchasing details use the existing material/product JSON storage outside defining specifications. Expected release: `catalog-import-v43`.
