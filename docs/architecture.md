# Peblo TV Mini architecture

The system uses a single TypeScript application with a database-backed editorial layer and a public catalogue read model. Editorial operations are exposed through authenticated procedures and equivalent REST resources, while the viewer surface uses only the generated catalogue contract. This separation prevents the viewer from reading unpublished editorial state.

| Concern | Implementation decision | Rationale |
|---|---|---|
| Editorial model | `shows`, `seasons`, `episodes`, `artwork`, `publish_runs`, and `catalogue_snapshots` tables | The shape represents the workflow and preserves a durable audit trail. |
| Seed ingestion | An idempotent importer groups raw episode rows into shows and seasons, preserving each episode identifier | The source data is episode-first while the editorial model is relational. |
| Publishing | Build the next document, persist it as a versioned snapshot, then flip the single active snapshot pointer in a transaction | Readers see either the previous complete document or the next complete document—never a partial payload. |
| File storage | A `StorageAdapter` interface with an S3-backed implementation | Upload validation and metadata persistence have no provider-specific API dependency. |
| Authorization | Server-side editor and admin guards; only administrators can publish | UI visibility is advisory; procedures and REST endpoints apply the actual boundary. |
| Viewer reads | Public `GET /catalog` and `GET /catalog/search` read only the active payload | Catalogue traffic does not query editorial tables and cannot accidentally expose drafts. |
| Search | Database-side search over the active pre-published JSON payload with composed query/category/language/section filters | It is simple at the challenge scale; a search index becomes appropriate as active catalogue size or query complexity grows. |

The local implementation persists the generated document in the `catalogue_snapshots` table to retain atomicity under autoscaling. The same interface can write a temporary object and promote it in Cloudflare R2; the active snapshot pointer remains the reader’s atomic hand-off.
