# v46: Specification-aware local catalog search

Search separates recognized physical requirements from material/type retrieval. Inch notation, schedule shorthand and common finish abbreviations are normalized. Confirmed requirements rank ahead of candidates with missing specifications. Results display a compact, explicit verification warning for missing requirements. Known conflicts remain excluded, including conflicts behind learned phrases. Existing manufacturer/job restrictions remain in force.

Size, schedule, angle, radius, length, material, finish, end connection and spring-type comparisons use recorded attributes; unclassified dimensions and thread identifiers stay in lexical matching rather than being guessed. This is conservative local matching, not an assertion that every conceivable specification can be parsed. Selecting a candidate with missing/conflicting recognized requirements records the selection but does not automatically learn that phrase. No catalog data migration, AI call or Bing request is used.

Deploy using the existing scripts/update-cloud-app.sh. This is an application update only: do not rerun the R2 import. Health release: specification-search-v46.
